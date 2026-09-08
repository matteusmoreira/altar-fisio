import type { MutationCtx, QueryCtx } from '../_generated/server'
import type { Doc, Id } from '../_generated/dataModel'
import { internal } from '../_generated/api'
import { isValidPhone } from '../../shared/patientIdentity'
import { cancelParticipantJobs, clinicToday, occupiesSeat, prepareReminders, queueAppointmentJob, scheduleFingerprint, sessionTime } from './appointmentJobs'

export const WAITLIST_NOTICE_MS = 90 * 60000

export async function creditBookingError(ctx: QueryCtx, patientId: Id<'patients'>, creditId: Id<'replacementCredits'>, s: Doc<'schedules'>, requirePhone = false): Promise<string | null> {
  const credit = await ctx.db.get(creditId)
  if (!credit || credit.patientId !== patientId || credit.status !== 'available') return 'Crédito indisponível.'
  if (credit.expiryDate < s.date || credit.expiryDate < clinicToday()) return 'Crédito vencido para esta data.'
  const origin = await ctx.db.get(credit.originScheduleId)
  if (!origin || origin.specialty !== s.specialty) return 'Escolha a mesma especialidade da sessão original.'
  if (s.status !== 'scheduled' || sessionTime(s) <= Date.now()) return 'Sessão indisponível.'
  const patient = await ctx.db.get(patientId)
  if (!patient?.active) return 'Paciente inativo.'
  if (requirePhone && !isValidPhone(patient.phone)) return 'Solicite à recepção a correção do seu WhatsApp antes de entrar na fila.'
  const parts = await ctx.db.query('scheduleParticipants').withIndex('by_patient', q => q.eq('patientId', patientId)).collect()
  for (const p of parts.filter(occupiesSeat)) {
    const other = await ctx.db.get(p.scheduleId)
    if (other && other.status !== 'cancelled' && other.date === s.date && other.startTime < s.endTime && s.startTime < other.endTime) return 'Você já possui compromisso neste horário.'
  }
  return null
}

export async function closeCreditQueue(ctx: MutationCtx, creditId: Id<'replacementCredits'>, reason: string) {
  const entries = await ctx.db.query('waitlistEntries').withIndex('by_credit_status', q => q.eq('creditId', creditId).eq('status', 'waiting')).collect()
  for (const e of entries) await ctx.db.patch(e._id, { status: 'closed', reason })
}

export async function closeScheduleQueue(ctx: MutationCtx, scheduleId: Id<'schedules'>, reason: string) {
  const entries = await ctx.db.query('waitlistEntries').withIndex('by_schedule_status', q => q.eq('scheduleId', scheduleId).eq('status', 'waiting')).collect()
  for (const e of entries) {
    await ctx.db.patch(e._id, { status: 'closed', reason })
    await queueAppointmentJob(ctx, { patientId: e.patientId, scheduleId, entryId: e._id, kind: 'waitlist_closed', fingerprint: '', dueAt: Date.now(), reason })
  }
}

export async function bookCredit(ctx: MutationCtx, patientId: Id<'patients'>, creditId: Id<'replacementCredits'>, scheduleId: Id<'schedules'>, entryId?: Id<'waitlistEntries'>): Promise<Id<'scheduleParticipants'>> {
  const s = await ctx.db.get(scheduleId)
  if (!s) throw new Error('Sessão não encontrada.')
  const error = await creditBookingError(ctx, patientId, creditId, s, !!entryId)
  if (error) throw new Error(error)
  const parts = await ctx.db.query('scheduleParticipants').withIndex('by_schedule', q => q.eq('scheduleId', scheduleId)).collect()
  if (parts.filter(occupiesSeat).length >= s.maxCapacity) throw new Error('Este horário está lotado.')
  await closeCreditQueue(ctx, creditId, 'Crédito utilizado em reposição.')
  await ctx.db.patch(creditId, { status: 'used', usedInScheduleId: scheduleId })
  const participantId = await ctx.db.insert('scheduleParticipants', { patientId, scheduleId, status: 'replacement', replacementCreditId: creditId, waitlistEntryId: entryId, notes: entryId ? 'Reposição — encaixe pela fila' : 'Agendamento realizado via crédito de reposição' })
  await prepareReminders(ctx, participantId)
  if (entryId) {
    await ctx.db.patch(entryId, { status: 'booked', participantId, reason: undefined })
    await queueAppointmentJob(ctx, { patientId, scheduleId, participantId, entryId, kind: 'waitlist_booked', fingerprint: scheduleFingerprint(s), dueAt: Date.now() })
  }
  return participantId
}

export async function processWaitlist(ctx: MutationCtx, scheduleId: Id<'schedules'>) {
  const s = await ctx.db.get(scheduleId)
  if (!s || s.status !== 'scheduled') return
  if (sessionTime(s) - Date.now() < WAITLIST_NOTICE_MS) {
    await closeScheduleQueue(ctx, scheduleId, 'Prazo de encaixe encerrado. Seu crédito continua disponível até a validade original.')
    return
  }
  const entries = await ctx.db.query('waitlistEntries').withIndex('by_schedule_status', q => q.eq('scheduleId', scheduleId).eq('status', 'waiting')).collect()
  for (const e of entries) {
    const error = await creditBookingError(ctx, e.patientId, e.creditId, s, true)
    if (error) {
      await ctx.db.patch(e._id, { status: 'closed', reason: error })
      continue
    }
    const parts = await ctx.db.query('scheduleParticipants').withIndex('by_schedule', q => q.eq('scheduleId', scheduleId)).collect()
    if (parts.filter(occupiesSeat).length >= s.maxCapacity) break
    await bookCredit(ctx, e.patientId, e.creditId, scheduleId, e._id)
  }
}

export async function enterWaitlist(ctx: MutationCtx, patientId: Id<'patients'>, creditId: Id<'replacementCredits'>, scheduleId: Id<'schedules'>) {
  const s = await ctx.db.get(scheduleId)
  if (!s) throw new Error('Sessão não encontrada.')
  const error = await creditBookingError(ctx, patientId, creditId, s, true)
  if (error) throw new Error(error)
  const cutoffAt = sessionTime(s) - WAITLIST_NOTICE_MS
  if (Date.now() > cutoffAt) throw new Error('A fila encerra 90 minutos antes da sessão.')
  const existing = await ctx.db.query('waitlistEntries').withIndex('by_credit_status', q => q.eq('creditId', creditId).eq('status', 'waiting')).first()
  if (existing?.scheduleId === scheduleId) return existing._id
  const sameSession = await ctx.db.query('waitlistEntries').withIndex('by_schedule_status', q => q.eq('scheduleId', scheduleId).eq('status', 'waiting')).collect()
  if (sameSession.some(e => e.patientId === patientId)) throw new Error('Você já está nesta fila com outro crédito.')
  if (existing) await ctx.db.patch(existing._id, { status: 'cancelled', reason: 'Paciente trocou o horário.' })
  const id = await ctx.db.insert('waitlistEntries', { patientId, creditId, scheduleId, cutoffAt, joinedAt: Date.now(), status: 'waiting' })
  // O instante exato de 90 minutos ainda é elegível.
  await ctx.scheduler.runAt(cutoffAt + 1, internal.waitlist.expire, { scheduleId })
  await processWaitlist(ctx, scheduleId)
  return id
}

export async function cancelReplacement(ctx: MutationCtx, p: Doc<'scheduleParticipants'>, grantCredit: boolean, reason?: string) {
  if (!p.replacementCreditId) throw new Error('Reposição sem crédito vinculado.')
  if (!['scheduled', 'replacement'].includes(p.status)) throw new Error('Este agendamento já foi processado.')
  const credit = await ctx.db.get(p.replacementCreditId)
  if (!credit || credit.patientId !== p.patientId || credit.usedInScheduleId !== p.scheduleId || credit.status !== 'used') throw new Error('Crédito de reposição inconsistente. Fale com a recepção.')
  const restored = grantCredit && credit.expiryDate >= clinicToday()
  if (grantCredit) await ctx.db.patch(credit._id, { status: restored ? 'available' : 'expired', usedInScheduleId: undefined })
  await ctx.db.patch(p._id, { status: grantCredit ? 'justified_absence' : 'absence', notes: reason || 'Reposição desmarcada.' })
  if (p.waitlistEntryId) await ctx.db.patch(p.waitlistEntryId, { status: 'cancelled', reason: 'Encaixe desmarcado.' })
  await cancelParticipantJobs(ctx, p._id)
  await processWaitlist(ctx, p.scheduleId)
  return { success: true, generatedCredit: restored, creditId: credit._id, expiryDate: credit.expiryDate, message: restored ? 'Reposição desmarcada. Seu crédito foi devolvido com a validade original.' : 'Reposição desmarcada sem crédito disponível para devolução.' }
}
