import { v } from 'convex/values'
import { paginationOptsValidator } from 'convex/server'
import { internalAction, internalMutation, mutation, query } from './_generated/server'
import type { MutationCtx } from './_generated/server'
import type { Doc } from './_generated/dataModel'
import { internal } from './_generated/api'
import { requireStaff } from './lib/security'
import { prepareReminders, queueAppointmentJob, scheduleFingerprint, sessionTime } from './lib/appointmentJobs'
import { isValidPhone } from '../shared/patientIdentity'
import { sendUazapiInteractiveMessage, sanitizeUazapiEndpoint, formatDateBR } from './whatsapp'

async function isCurrent(ctx: MutationCtx, job: Doc<'appointmentJobs'>) {
  if (job.kind === 'waitlist_closed') {
    const entry = job.entryId && await ctx.db.get(job.entryId)
    return entry?.status === 'closed'
  }
  const p = job.participantId && await ctx.db.get(job.participantId)
  const s = await ctx.db.get(job.scheduleId)
  return !!p && !!s && ['scheduled', 'replacement'].includes(p.status) && s.status === 'scheduled' && sessionTime(s) > Date.now() && scheduleFingerprint(s) === job.fingerprint
}

export const claim = internalMutation({
  args: { jobId: v.id('appointmentJobs') },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId)
    if (!job || job.status !== 'queued' || job.dueAt > Date.now()) return null
    if (!await isCurrent(ctx, job)) { await ctx.db.patch(job._id, { status: 'skipped' }); return null }
    const patient = await ctx.db.get(job.patientId)
    if (!patient?.active || !isValidPhone(patient.phone)) {
      await ctx.db.patch(job._id, { status: 'failed', error: 'WhatsApp ausente ou inválido. Corrija o cadastro.' })
      return null
    }
    const schedule = await ctx.db.get(job.scheduleId)
    const settings = await ctx.db.query('clinicSettings').first()
    const templateId = job.kind === 'reminder_24h' ? settings?.activeReminder24hTemplateId : job.kind === 'reminder_1h' ? settings?.activeReminder1hTemplateId : job.kind === 'reminder_30m' ? settings?.activeReminder30mTemplateId : job.kind === 'waitlist_booked' ? settings?.activeWaitlistTemplateId : undefined
    const template = templateId ? await ctx.db.get(templateId) : null
    await ctx.db.patch(job._id, { status: 'sending', attemptedAt: Date.now(), error: undefined })
    await ctx.scheduler.runAfter(120000, internal.appointmentNotifications.markUncertain, { jobId: job._id, attemptedAt: Date.now() })
    return { job, patient, schedule, settings, template, professional: schedule && await ctx.db.get(schedule.professionalId), room: schedule && await ctx.db.get(schedule.roomId) }
  },
})

export const markUncertain = internalMutation({
  args: { jobId: v.id('appointmentJobs'), attemptedAt: v.number() },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId)
    if (job?.status === 'sending' && job.attemptedAt === args.attemptedAt) await ctx.db.patch(job._id, { status: 'uncertain', error: 'O envio não retornou resultado. Confira o WhatsApp antes de reenviar.' })
  },
})

export const finish = internalMutation({
  args: { jobId: v.id('appointmentJobs'), status: v.union(v.literal('sent'), v.literal('failed'), v.literal('uncertain')), content: v.string(), error: v.optional(v.string()), phone: v.string(), name: v.string() },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId)
    if (!job || job.status !== 'sending') return
    await ctx.db.patch(job._id, { status: args.status, error: args.error })
    await ctx.db.insert('notificationLogs', { channel: 'whatsapp_uazapi', recipientName: args.name, recipientContact: args.phone, triggerType: job.kind === 'reminder_24h' ? 'lembrete_24h' : job.kind, content: args.content, status: args.status === 'sent' ? 'sent' : 'failed', timestamp: Date.now(), scheduleId: job.scheduleId, errorMessage: args.error })
  },
})

export const send = internalAction({
  args: { jobId: v.id('appointmentJobs') },
  handler: async (ctx, args): Promise<void> => {
    const data = await ctx.runMutation(internal.appointmentNotifications.claim, args)
    if (!data) return
    const { job, patient, schedule, settings, professional, room, template } = data
    const vars: Record<string, string> = { paciente: patient.name, clinica: settings?.clinicName || 'Altar Fisio', data: schedule ? formatDateBR(schedule.date) : '', horario: schedule?.startTime || '', profissional: professional?.name || '', sala: room?.name || '', telefone_clinica: settings?.phone || '', dica: '', regras: `Cancelamentos com pelo menos ${settings?.cancellationNoticeHours ?? 2}h de antecedência permitem reposição conforme a política da clínica.` }
    const intro = job.kind === 'waitlist_closed' ? `Sua espera foi encerrada: ${job.reason} Acesse o portal para acompanhar seu crédito.` : job.kind === 'waitlist_booked' ? 'Sua reposição foi agendada automaticamente pela fila de espera. Este encaixe vale somente para esta data.' : job.kind === 'reminder_24h' ? `Lembrete do seu compromisso de amanhã. ${vars.regras}` : `Lembrete: seu compromisso começa em ${job.kind === 'reminder_1h' ? '1 hora' : '30 minutos'}.`
    const content = `Olá, *${patient.name}*! ${intro}${schedule && job.kind !== 'waitlist_closed' ? `\n\n${vars.clinica}\nData: ${vars.data}\nHorário: ${schedule.startTime} às ${schedule.endTime}\nProfissional: ${vars.profissional}\nSala: ${vars.sala}` : ''}`
    let status: 'sent' | 'failed' | 'uncertain' = 'failed'
    let error: string | undefined
    try {
      const instance = await ctx.runQuery(internal.whatsapp.getDefaultInstanceInternal, {})
      const token = instance?.token || settings?.activeWhatsappInstanceToken || settings?.uazapiToken
      const endpoint = sanitizeUazapiEndpoint(settings?.uazapiEndpoint)
      if (!token || !endpoint) error = 'WhatsApp não configurado. A recepção deve conferir o envio.'
      else {
        const result = await sendUazapiInteractiveMessage(endpoint, token, patient.phone, template || { type: 'text', content }, vars)
        status = result.success ? 'sent' : 'uncertain'
        // O helper pode receber timeout depois que o provedor aceitou a mensagem.
        error = result.success ? undefined : 'Envio não confirmado pelo provedor. Confira o WhatsApp antes de reenviar.'
      }
    } catch {
      status = 'uncertain'
      error = 'Não foi possível confirmar o envio. Confira o WhatsApp antes de reenviar.'
    }
    const loggedContent = template ? template.content.replace(/\{\{(\w+)\}\}/g, (_: string, key: string) => vars[key] ?? '') : content
    await ctx.runMutation(internal.appointmentNotifications.finish, { jobId: job._id, status, error, content: loggedContent, phone: patient.phone, name: patient.name })
  },
})

export const retry = mutation({
  args: { sessionToken: v.string(), jobId: v.id('appointmentJobs') },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken, ['admin', 'reception'])
    const job = await ctx.db.get(args.jobId)
    if (!job || !['failed', 'uncertain'].includes(job.status)) throw new Error('Este envio não pode ser repetido.')
    if (!await isCurrent(ctx, job)) throw new Error('Este compromisso ou aviso não está mais válido.')
    const scheduledFunctionId = await ctx.scheduler.runAfter(0, internal.appointmentNotifications.send, { jobId: job._id })
    await ctx.db.patch(job._id, { status: 'queued', dueAt: Date.now(), scheduledFunctionId, error: undefined })
  },
})

export const problems = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken, ['admin', 'reception'])
    const jobs = (await Promise.all((['failed', 'uncertain', 'sending'] as const).map(status => ctx.db.query('appointmentJobs').withIndex('by_status_due', q => q.eq('status', status)).order('desc').take(50)))).flat()
    return Promise.all(jobs.map(async j => ({ ...j, patientName: (await ctx.db.get(j.patientId))?.name || 'Paciente' })))
  },
})

// Bootstrap paginado e idempotente: também recupera agendamentos feitos por integrações antigas.
export const backfill = internalMutation({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const page = await ctx.db.query('schedules').withIndex('by_date', q => q.gte('date', new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(Date.now()))).paginate(args.paginationOpts)
    for (const s of page.page) {
      if (s.status !== 'scheduled') continue
      const parts = await ctx.db.query('scheduleParticipants').withIndex('by_schedule', q => q.eq('scheduleId', s._id)).collect()
      for (const p of parts) await prepareReminders(ctx, p._id)
    }
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.appointmentNotifications.backfill, { paginationOpts: { numItems: 10, cursor: page.continueCursor } })
    return { done: page.isDone, cursor: page.continueCursor }
  },
})

export const scan = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken, ['admin', 'reception'])
    await ctx.scheduler.runAfter(0, internal.appointmentNotifications.backfill, { paginationOpts: { numItems: 10, cursor: null } })
    return { message: 'Preparação dos lembretes futuros iniciada. Envios vencidos não serão repetidos.' }
  },
})

export const prepareDaily = internalMutation({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    const schedules = await ctx.db.query('schedules').withIndex('by_date', q => q.eq('date', args.date)).collect()
    let queuedCount = 0
    for (const s of schedules) {
      if (s.status !== 'scheduled' || sessionTime(s) <= Date.now()) continue
      const participants = await ctx.db.query('scheduleParticipants').withIndex('by_schedule', q => q.eq('scheduleId', s._id)).collect()
      for (const p of participants) {
        if (!['scheduled', 'replacement'].includes(p.status)) continue
        const jobs = await ctx.db.query('appointmentJobs').withIndex('by_participant', q => q.eq('participantId', p._id)).collect()
        if (jobs.some(j => j.kind === 'reminder_24h' && j.fingerprint === scheduleFingerprint(s) && j.status !== 'skipped')) continue
        const patient = await ctx.db.get(p.patientId)
        if (!patient) continue
        // Evita duplicar mensagens que a versão anterior já enviou hoje.
        const oldLog = await ctx.db.query('notificationLogs').withIndex('by_schedule_recipient', q => q.eq('scheduleId', s._id).eq('triggerType', 'lembrete_24h').eq('recipientContact', patient.phone)).first()
        if (oldLog && !jobs.some(j => j.kind === 'reminder_24h')) continue
        await queueAppointmentJob(ctx, { patientId: p.patientId, scheduleId: s._id, participantId: p._id, kind: 'reminder_24h', fingerprint: scheduleFingerprint(s), dueAt: Date.now() })
        queuedCount++
      }
    }
    return { queuedCount }
  },
})
