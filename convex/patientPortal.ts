import { monthlyArgs, choiceValidator, monthlyOptions, reviewMonthly } from './lib/monthlyBooking'
import { scheduleService, effectiveScheduleCapacity } from './lib/scheduleService'
import { getPackageBookingBalance } from './lib/packageBookingBalance'
import { assertPortalBookingOpen } from './lib/portalBooking'
import { DEFAULT_PORTAL_MESSAGE } from '../shared/portalMessage'
import { requirePatient } from './lib/security'
import { bookCredit, cancelReplacement, processWaitlist } from './lib/waitlist'
import { cancelParticipantJobs, clinicToday, occupiesSeat, prepareReminders } from './lib/appointmentJobs'
import { validDate } from './lib/validation'
import { query, mutation } from "./_generated/server"
import type { QueryCtx, MutationCtx } from './_generated/server'
import type { Doc } from './_generated/dataModel'
import { api, internal } from "./_generated/api"
import { v, ConvexError } from "convex/values"
import { parseDateTimeToMs, checkTimeOverlap } from "./schedules"

// Limpa caracteres especiais de CPF e Telefones
function cleanNumbers(val: string): string {
  return val.replace(/\D/g, "")
}

async function resolvePatientPackageService(
  ctx: QueryCtx | MutationCtx,
  patientPackage: Doc<'patientPackages'>
): Promise<{ packageDefinition: Doc<'packages'> | null; service: Doc<'services'> | null }> {
  const packageDefinition = await ctx.db.get(patientPackage.packageId)
  const serviceId = patientPackage.serviceId ?? packageDefinition?.serviceId
  const service = serviceId ? await ctx.db.get(serviceId) : null
  return { packageDefinition, service: service?.active ? service : null }
}

// 1. Identificacao Rapida do Paciente (Opcao A - Sem Friccao de Senhas)


// 1.1. Pacientes de Demonstracao Dinamicos (para testes rapidos sem IDs fixos entre ambientes)


// 2. Consulta Completa de Dados do Portal do Paciente
export const getPatientPortalData = query({
  args: { portalToken: v.string(),  patientId: v.string() },
  handler: async (ctx, input) => {
    const { portalToken, ...args } = input
    const portalPatient = await requirePatient(ctx, portalToken, args.patientId);

    const normPatientId = ctx.db.normalizeId("patients", args.patientId)
    if (!normPatientId) return null

    const patient = await ctx.db.get(normPatientId)
    if (!patient) return null

    const settings = await ctx.db.query("clinicSettings").first()
    const noticeHoursRequired = settings?.cancellationNoticeHours ?? 2
    const expiryDays = settings?.replacementExpiryDays ?? 30

    // 2.1. Buscar todas as participacoes do paciente
    const participations = await ctx.db
      .query("scheduleParticipants")
      .withIndex("by_patient", (q) => q.eq("patientId", normPatientId))
      .collect()

    const now = Date.now()
    const todayStr = new Date().toISOString().split("T")[0]

    const upcomingList: any[] = []
    const historyList: any[] = []

    for (const part of participations) {
      const schedule = await ctx.db.get(part.scheduleId)
      if (!schedule) continue

      const room = await ctx.db.get(schedule.roomId)
      const professional = await ctx.db.get(schedule.professionalId)
      const schedService = await scheduleService(ctx, schedule)

      // Calculo de antecedencia em horas para cancelamento
      const sessionMs = parseDateTimeToMs(schedule.date, schedule.startTime)
      const hoursUntilSession = (sessionMs - now) / (1000 * 60 * 60)
      const isWithinNoticePolicy = hoursUntilSession >= noticeHoursRequired

      const item = {
        participantId: part._id,
        scheduleId: schedule._id,
        serviceId: schedule.serviceId ?? schedService?._id,
        patientPackageId: part.patientPackageId,
        replacementCreditId: part.replacementCreditId,
        title: schedule.title,
        specialty: schedule.specialty,
        type: schedule.type,
        date: schedule.date,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        roomName: room?.name || "Sala Clinica",
        roomColor: room?.color || "#10b981",
        professionalName: professional?.name || "Profissional",
        professionalAvatar: professional?.avatarUrl,
        participantStatus: part.status,
        scheduleStatus: schedule.status,
        hoursUntilSession: Number(hoursUntilSession.toFixed(1)),
        canCancelWithCredit: isWithinNoticePolicy,
        isPast: sessionMs < now,
        notes: part.notes,
        isWaitlistBooking: !!part.waitlistEntryId,
      }

      // Sessoes futuras ativas
      if (
        (schedule.date > todayStr || (schedule.date === todayStr && sessionMs >= now)) &&
        part.status !== "justified_absence" &&
        part.status !== "absence"
      ) {
        upcomingList.push(item)
      } else {
        historyList.push(item)
      }
    }

    // Ordenar proximas por data crescente
    upcomingList.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date)
      return a.startTime.localeCompare(b.startTime)
    })

    // Ordenar historico por data decrescente
    historyList.sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date)
      return b.startTime.localeCompare(a.startTime)
    })

    // 2.2. Pacotes e Planos Ativos
    const rawPackages = await ctx.db
      .query("patientPackages")
      .withIndex("by_patient", (q) => q.eq("patientId", normPatientId))
      .collect()

    const enrichedPackages = await Promise.all(
      rawPackages.map(async (pkg) => {
        const { packageDefinition: pkgDef, service } = await resolvePatientPackageService(ctx, pkg)
        let specialty: "pilates" | "fisioterapia" | "rpg" = "pilates"
        let serviceName = "Pilates"
        if (service) {
          specialty = service.specialty
          serviceName = service.name
        } else {
          const nameLower = (pkgDef?.name || "").toLowerCase()
          if (nameLower.includes("fisio")) specialty = "fisioterapia"
          else if (nameLower.includes("rpg")) specialty = "rpg"
        }

        const isExpired = pkg.status !== "active" || pkg.expiryDate < todayStr
        const actualStatus = isExpired ? "expired" : pkg.status

        const { bookedCount: bookedFutureSessionsCount, freeBalance: bookableSessionsCount } = await getPackageBookingBalance(ctx, pkg, participations)

        const usagePercentage =
          pkg.totalSessions > 0
            ? Math.round((pkg.usedSessions / pkg.totalSessions) * 100)
            : 0

        return {
          ...pkg,
          status: actualStatus,
          packageName: pkgDef?.name || "Plano Altar Fisio",
          packagePrice: pkgDef?.price,
          serviceId: service?._id,
          serviceName,
          specialty,
          usagePercentage,
          bookedFutureSessionsCount,
          bookableSessionsCount,
          isLowBalance: pkg.remainingSessions <= 2,
          canBook: actualStatus === "active" && bookableSessionsCount > 0,
        }
      })
    )

    // 2.3. Creditos de Reposicao
    const replacementCredits = await ctx.db
      .query("replacementCredits")
      .withIndex("by_patient_status", (q) =>
        q.eq("patientId", normPatientId).eq("status", "available")
      )
      .collect()

    const enrichedCredits = await Promise.all(
      replacementCredits.map(async (c) => {
        const originSchedule = await ctx.db.get(c.originScheduleId)
        return {
          ...c,
          originTitle: originSchedule?.title || "Sessao Desmarcada",
          originDate: originSchedule?.date || "",
          originSpecialty: originSchedule?.specialty || "pilates",
        }
      })
    )

    return {
      patient: {
        _id: patient._id,
        name: patient.name,
        documentCpf: patient.documentCpf,
        phone: patient.phone,
        email: patient.email,
        birthDate: patient.birthDate,
      },
      upcomingSchedules: upcomingList,
      historySchedules: historyList.slice(0, 15),
      packages: enrichedPackages,
      replacementCredits: enrichedCredits,
      portalBookingEnabled: settings?.portalBookingEnabled !== false,
      portalBookingMessage: settings?.portalBookingMessage ?? DEFAULT_PORTAL_MESSAGE,
      policy: {
        cancellationNoticeHours: noticeHoursRequired,
        replacementExpiryDays: expiryDays,
        clinicPhone: settings?.phone || "(11) 98765-4321",
        clinicAddress: settings?.address || "Av. Paulista, 1000 - Bela Vista, Sao Paulo - SP",
        clinicName: settings?.clinicName || "Altar Fisio",
      },
    }
  },
})

// 3. Cancelamento pelo Paciente (com aplicacao automatica da regra de 2 horas)
export const cancelAppointmentByPatient = mutation({
  args: { portalToken: v.string(),
    participantId: v.string(),
    patientId: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, input) => {
    const { portalToken, ...args } = input
    const portalPatient = await requirePatient(ctx, portalToken, args.patientId);

    const normParticipantId = ctx.db.normalizeId("scheduleParticipants", args.participantId)
    if (!normParticipantId) throw new ConvexError("Agendamento não encontrado.")
    const normPatientId = ctx.db.normalizeId("patients", args.patientId)
    if (!normPatientId) throw new ConvexError("Paciente não encontrado.")

    const participant = await ctx.db.get(normParticipantId)
    if (!participant) throw new ConvexError("Agendamento não encontrado.")
    if (participant.patientId !== normPatientId) {
      throw new ConvexError("Acesso não autorizado para este agendamento.")
    }

    if (!['scheduled', 'replacement'].includes(participant.status)) throw new ConvexError('Este agendamento já foi processado.')
    const schedule = await ctx.db.get(participant.scheduleId)
    if (!schedule || schedule.status === 'cancelled') throw new ConvexError("Sessão não encontrada.")

    const settings = await ctx.db.query("clinicSettings").first()
    const noticeHoursRequired = settings?.cancellationNoticeHours ?? 2
    const expiryDays = settings?.replacementExpiryDays ?? 30

    const sessionMs = parseDateTimeToMs(schedule.date, schedule.startTime)
    const now = Date.now()
    const hoursNotice = (sessionMs - now) / (1000 * 60 * 60)
    const isWithinPolicy = hoursNotice >= noticeHoursRequired

    if (sessionMs <= now) throw new ConvexError('Não é possível desmarcar uma sessão já iniciada.')
    if (participant.replacementCreditId) return { ...await cancelReplacement(ctx, participant, isWithinPolicy, args.reason), hoursNotice }

    if (isWithinPolicy) {
      const expiry = new Date()
      expiry.setDate(expiry.getDate() + expiryDays)
      const expiryStr = expiry.toISOString().split("T")[0]

      // Gera credito de reposicao
      const creditId = await ctx.db.insert("replacementCredits", {
        patientId: normPatientId,
        originScheduleId: schedule._id,
        generatedAt: now,
        expiryDate: expiryStr,
        status: "available",
      })

      // Atualiza participante para falta justificada (libera a vaga para outros)
      const note = args.reason
        ? `Desmarcado pelo aluno (${hoursNotice.toFixed(1)}h antes): ${args.reason}`
        : `Desmarcado pelo aluno (${hoursNotice.toFixed(1)}h antes do inicio)`

      await ctx.db.patch(normParticipantId, {
        status: "justified_absence",
        notes: note,
      })
      await cancelParticipantJobs(ctx, normParticipantId)
      await processWaitlist(ctx, schedule._id)

      // Dispara confirmacao via WhatsApp
      const patient = await ctx.db.get(normPatientId)
      if (patient?.phone) {
        await ctx.scheduler.runAfter(0, internal.notifications.sendReplacementCreditNoticeAction, {
          patientName: patient.name,
          phone: patient.phone,
          scheduleDate: schedule.date,
          scheduleTime: schedule.startTime,
          expiryDate: expiryStr,
          noticeHours: noticeHoursRequired,
        })
      }

      return {
        success: true,
        generatedCredit: true,
        creditId,
        expiryDate: expiryStr,
        hoursNotice: Number(hoursNotice.toFixed(1)),
        message: `Sessao desmarcada com sucesso! Geramos 1 credito de reposicao valido ate ${expiryStr}.`,
      }
    } else {
      // Fora do prazo: marca ausencia sem gerar credito
      await ctx.db.patch(normParticipantId, {
        status: "absence",
        notes: args.reason
          ? `Desmarcado pelo aluno fora do prazo (${hoursNotice.toFixed(1)}h antes): ${args.reason}`
          : `Desmarcado pelo aluno com menos de ${noticeHoursRequired}h de antecedencia`,
      })

      await cancelParticipantJobs(ctx, normParticipantId)
      await processWaitlist(ctx, schedule._id)

      return {
        success: true,
        generatedCredit: false,
        hoursNotice: Number(hoursNotice.toFixed(1)),
        message: `Sessao desmarcada. Conforme as regras da clinica (minimo de ${noticeHoursRequired}h de antecedencia), nao foi possivel gerar credito de reposicao automatico.`,
      }
    }
  },
})

// 4. Remarcacao de Sessao pelo Paciente (Troca de Horario Atomica)
export const rescheduleAppointmentByPatient = mutation({
  args: { portalToken: v.string(),
    participantId: v.string(),
    targetScheduleId: v.string(),
    patientId: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, input) => {
    await assertPortalBookingOpen(ctx)
    const { portalToken, ...args } = input
    const portalPatient = await requirePatient(ctx, portalToken, args.patientId);

    const normParticipantId = ctx.db.normalizeId("scheduleParticipants", args.participantId)
    if (!normParticipantId) throw new ConvexError("Agendamento atual não encontrado.")
    const normTargetScheduleId = ctx.db.normalizeId("schedules", args.targetScheduleId)
    if (!normTargetScheduleId) throw new ConvexError("Novo horário selecionado não encontrado.")
    const normPatientId = ctx.db.normalizeId("patients", args.patientId)
    if (!normPatientId) throw new ConvexError("Paciente não autorizado.")

    const currentPart = await ctx.db.get(normParticipantId)
    if (!currentPart) throw new ConvexError("Agendamento atual não encontrado.")
    if (!['scheduled', 'replacement'].includes(currentPart.status)) throw new ConvexError('Este agendamento já foi processado.')
    if (currentPart.patientId !== normPatientId) {
      throw new ConvexError("Acesso não autorizado.")
    }

    const currentSchedule = await ctx.db.get(currentPart.scheduleId)
    if (!currentSchedule) throw new ConvexError("Sessão atual não encontrada.")

    const targetSchedule = await ctx.db.get(normTargetScheduleId)
    if (!targetSchedule) throw new ConvexError("Novo horário selecionado não encontrado.")
    const originService = await scheduleService(ctx, currentSchedule), targetService = await scheduleService(ctx, targetSchedule)
    if ((currentSchedule.serviceId || targetSchedule.serviceId) && (!originService || originService._id !== targetService?._id)) throw new ConvexError('Escolha uma turma do mesmo tratamento.')
    if (!(await ctx.db.get(targetSchedule.roomId))?.isActive || !(await ctx.db.get(targetSchedule.professionalId))?.active) throw new ConvexError('Sala ou profissional indisponível no novo horário.')
    await processWaitlist(ctx, normTargetScheduleId)
    const settings = await ctx.db.query('clinicSettings').first()
    if (currentSchedule.status === 'cancelled' || parseDateTimeToMs(currentSchedule.date, currentSchedule.startTime) - Date.now() < (settings?.cancellationNoticeHours ?? 2) * 3600000) throw new ConvexError('Prazo para remarcação encerrado. Fale com a recepção.')
    if (targetSchedule.status !== 'scheduled' || targetSchedule.specialty !== currentSchedule.specialty || parseDateTimeToMs(targetSchedule.date, targetSchedule.startTime) <= Date.now()) throw new ConvexError('Horário de destino inválido.')
    if (currentPart.replacementCreditId) {
      if (currentSchedule._id === targetSchedule._id) throw new ConvexError('Escolha outro horário diferente do atual.')
      await cancelReplacement(ctx, currentPart, true, 'Reposição transferida para outro horário.')
      const newParticipantId = await bookCredit(ctx, normPatientId, currentPart.replacementCreditId, normTargetScheduleId)
      return { success: true, newParticipantId, newDate: targetSchedule.date, newStartTime: targetSchedule.startTime, message: 'Reposição remarcada com o mesmo crédito, sem alterar sua validade.' }
    }
    if (currentPart.patientPackageId) {
      const pkg = await ctx.db.get(currentPart.patientPackageId)
      if (!pkg || pkg.patientId !== normPatientId || pkg.status !== 'active' || pkg.expiryDate < targetSchedule.date || pkg.startDate > targetSchedule.date) {
        throw new ConvexError('Plano indisponível para a data selecionada. Verifique o período de validade do seu pacote.')
      }
    }
    const ownParts = await ctx.db.query('scheduleParticipants').withIndex('by_patient', q => q.eq('patientId', normPatientId)).collect()
    for (const part of ownParts) {
      if (part._id === currentPart._id || ['absence', 'justified_absence'].includes(part.status)) continue
      const existing = await ctx.db.get(part.scheduleId)
      if (existing && existing.status !== 'cancelled' && existing.date === targetSchedule.date && checkTimeOverlap(existing.startTime, existing.endTime, targetSchedule.startTime, targetSchedule.endTime)) {
        throw new ConvexError(`Você já possui um agendamento conflitante das ${existing.startTime} às ${existing.endTime} no dia ${targetSchedule.date}.`)
      }
    }

    // Checar capacidade no novo horario
    const existingParts = await ctx.db
      .query("scheduleParticipants")
      .withIndex("by_schedule", (q) => q.eq("scheduleId", normTargetScheduleId))
      .collect()

    const activeParts = existingParts.filter(occupiesSeat)
    if (activeParts.length >= await effectiveScheduleCapacity(ctx, targetSchedule)) {
      throw new ConvexError("O novo horário selecionado já preencheu todas as vagas disponíveis.")
    }

    // 1. Libera o horario antigo
    await ctx.db.patch(normParticipantId, {
      status: "justified_absence",
      notes: `Remarcado pelo aluno para ${targetSchedule.date} as ${targetSchedule.startTime}`,
    })

    // 2. Insere no novo horario com o mesmo pacote vinculado (se houver)
    const newPartId = await ctx.db.insert("scheduleParticipants", {
      scheduleId: normTargetScheduleId,
      patientId: normPatientId,
      status: "scheduled",
      patientPackageId: currentPart.patientPackageId,
      packageDebited: currentPart.packageDebited,
      notes: `Remarcacao transferida da sessao de ${currentSchedule.date} as ${currentSchedule.startTime}`,
    })
    await cancelParticipantJobs(ctx, normParticipantId)
    await prepareReminders(ctx, newPartId)
    await processWaitlist(ctx, currentSchedule._id)

    return {
      success: true,
      newParticipantId: newPartId,
      newDate: targetSchedule.date,
      newStartTime: targetSchedule.startTime,
      message: `Remarcação concluída com sucesso para ${targetSchedule.date} às ${targetSchedule.startTime}!`,
    }
  },
})

// 5. Agendar Horario Usando Credito de Reposicao Disponivel
export const useReplacementCreditToBook = mutation({
  args: { portalToken: v.string(),
    creditId: v.string(),
    targetScheduleId: v.string(),
    patientId: v.string(),
  },
  handler: async (ctx, input) => {
    await assertPortalBookingOpen(ctx)
    const { portalToken, ...args } = input
    const portalPatient = await requirePatient(ctx, portalToken, args.patientId);

    const normCreditId = ctx.db.normalizeId("replacementCredits", args.creditId)
    if (!normCreditId) throw new ConvexError("Crédito de reposição inválido.")
    const normTargetScheduleId = ctx.db.normalizeId("schedules", args.targetScheduleId)
    if (!normTargetScheduleId) throw new ConvexError("Horário não encontrado.")
    const normPatientId = ctx.db.normalizeId("patients", args.patientId)
    if (!normPatientId) throw new ConvexError("Paciente não encontrado.")

    const credit = await ctx.db.get(normCreditId)
    if (!credit || credit.status !== "available") {
      throw new ConvexError("Crédito de reposição inválido ou já utilizado.")
    }
    if (credit.patientId !== normPatientId) {
      throw new ConvexError("Crédito pertence a outro paciente.")
    }

    const todayStr = clinicToday()
    if (credit.expiryDate < todayStr) {
      await ctx.db.patch(normCreditId, { status: "expired" })
      throw new ConvexError("Este crédito de reposição expirou em " + credit.expiryDate)
    }

    const targetSchedule = await ctx.db.get(normTargetScheduleId)
    if (!targetSchedule) throw new ConvexError("Horário não encontrado.")
    await processWaitlist(ctx, normTargetScheduleId)
    const partId = await bookCredit(ctx, normPatientId, normCreditId, normTargetScheduleId)

    return {
      success: true,
      participantId: partId,
      date: targetSchedule.date,
      startTime: targetSchedule.startTime,
      message: `Reposicao agendada com sucesso para ${targetSchedule.date} as ${targetSchedule.startTime}!`,
    }
  },
})

// 6. Listagem de Vagas Livres para Agendamento, Remarcacao e Reposicao
export const listAvailableSlotsForBooking = query({
  args: {
    portalToken: v.string(),
    specialty: v.union(v.literal("fisioterapia"), v.literal("pilates"), v.literal("rpg")),
    startDate: v.string(), // YYYY-MM-DD
    daysCount: v.optional(v.number()), // Padrao: 14 dias
    patientId: v.optional(v.string()),
    serviceId: v.optional(v.string()),
    excludeParticipantId: v.optional(v.string()),
  },
  handler: async (ctx, input) => {
    const { portalToken, serviceId, excludeParticipantId, ...args } = input
    const portalPatient = await requirePatient(ctx, portalToken, args.patientId);

    const days = args.daysCount ?? 14
    if (!Number.isInteger(days) || days < 1 || days > 31) throw new ConvexError('Período inválido.')
    const result: any[] = []

    const startObj = new Date(`${args.startDate}T12:00:00Z`)
    const normPatientId = portalPatient._id
    const normExcludePartId = excludeParticipantId ? ctx.db.normalizeId("scheduleParticipants", excludeParticipantId) : null
    const normServiceId = serviceId ? ctx.db.normalizeId("services", serviceId) : null

    // Buscar agendamentos do paciente para cálculo de conflito de horário
    const ownParts = await ctx.db
      .query("scheduleParticipants")
      .withIndex("by_patient", (q) => q.eq("patientId", normPatientId))
      .collect()

    const activeOwnSchedules: Doc<'schedules'>[] = []
    for (const p of ownParts) {
      if (normExcludePartId && p._id === normExcludePartId) continue
      if (p.status === 'absence' || p.status === 'justified_absence') continue
      const sch = await ctx.db.get(p.scheduleId)
      if (sch && sch.status !== 'cancelled') {
        activeOwnSchedules.push(sch)
      }
    }

    const now = Date.now()

    for (let i = 0; i < days; i++) {
      const d = new Date(startObj)
      d.setDate(d.getDate() + i)
      // Exclui domingos
      if (d.getDay() === 0) continue

      const dateStr = d.toISOString().split("T")[0]

      const daySchedules = await ctx.db
        .query("schedules")
        .withIndex("by_date", (q) => q.eq("date", dateStr))
        .collect()

      const matching = daySchedules.filter(
        (s) => s.specialty === args.specialty && s.status !== "cancelled" && parseDateTimeToMs(s.date, s.startTime) > now
      )

      for (const s of matching) {
        // Se informado serviceId, restringir a turmas do mesmo serviço
        if (normServiceId) {
          const sService = await scheduleService(ctx, s)
          const resolvedServiceId = s.serviceId ?? sService?._id
          if (resolvedServiceId && resolvedServiceId !== normServiceId) continue
        }

        const room = await ctx.db.get(s.roomId)
        const prof = await ctx.db.get(s.professionalId)
        if (!room?.isActive || !prof?.active) continue

        const parts = await ctx.db
          .query("scheduleParticipants")
          .withIndex("by_schedule", (q) => q.eq("scheduleId", s._id))
          .collect()

        const activeParts = parts.filter(occupiesSeat)
        const activeCount = activeParts.length
        const maxCap = await effectiveScheduleCapacity(ctx, s)
        const vacancies = Math.max(0, maxCap - activeCount)

        const isAlreadyEnrolled = activeParts.some((p) => p.patientId === normPatientId)
        const hasConflict = activeOwnSchedules.some(
          (own) => own.date === s.date && checkTimeOverlap(own.startTime, own.endTime, s.startTime, s.endTime)
        )

        result.push({
          scheduleId: s._id,
          title: s.title,
          specialty: s.specialty,
          type: s.type,
          date: s.date,
          startTime: s.startTime,
          endTime: s.endTime,
          roomName: room?.name || "Sala",
          professionalName: prof?.name || "Profissional",
          vacanciesLeft: vacancies,
          maxCapacity: maxCap,
          isAlreadyEnrolled,
          hasConflict,
          canSelect: vacancies > 0 && !isAlreadyEnrolled && !hasConflict,
        })
      }
    }

    return result.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date)
      return a.startTime.localeCompare(b.startTime)
    })
  },
})

// Slots virtuais da grade semanal para novos agendamentos pelo Portal.
// Remarcações e reposições continuam usando apenas sessões já materializadas.
export const listAvailabilitySlotsForPatientBooking = query({
  args: {
    portalToken: v.string(),
    patientPackageId: v.string(),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    const patient = await requirePatient(ctx, args.portalToken)
    validDate(args.date)

    const patientPackageId = ctx.db.normalizeId('patientPackages', args.patientPackageId)
    if (!patientPackageId) throw new ConvexError('Plano/Pacote não encontrado.')
    const patientPackage = await ctx.db.get(patientPackageId)
    if (!patientPackage || patientPackage.patientId !== patient._id) throw new ConvexError('Este plano pertence a outro paciente.')
    if (patientPackage.status !== 'active' || patientPackage.remainingSessions < 1 || patientPackage.expiryDate < args.date) return []

    const { service } = await resolvePatientPackageService(ctx, patientPackage)
    if (!service) throw new ConvexError('Este plano não está vinculado a um serviço ativo. Fale com a recepção.')

    const patientParticipations = await ctx.db
      .query('scheduleParticipants')
      .withIndex('by_patient', q => q.eq('patientId', patient._id))
      .collect()
    const activeScheduleIds = new Set(
      patientParticipations
        .filter(participant => occupiesSeat(participant))
        .map(participant => participant.scheduleId)
    )

    const schedules = await ctx.db.query('schedules').withIndex('by_date', q => q.eq('date', args.date)).collect()
    const result = []
    for (const schedule of schedules) {
      if (schedule.type !== 'turma' || schedule.status !== 'scheduled' || parseDateTimeToMs(schedule.date, schedule.startTime) <= Date.now() || (await scheduleService(ctx, schedule))?._id !== service._id) continue
      const room = await ctx.db.get(schedule.roomId), professional = await ctx.db.get(schedule.professionalId)
      if (!room?.isActive || !professional?.active) continue
      const participants = await ctx.db.query('scheduleParticipants').withIndex('by_schedule', q => q.eq('scheduleId', schedule._id)).collect()
      const maxCapacity = await effectiveScheduleCapacity(ctx, schedule)
      const vacanciesLeft = Math.max(0, maxCapacity - participants.filter(occupiesSeat).length)
      if (vacanciesLeft > 0) result.push({ slotKey: schedule._id, scheduleId: schedule._id, title: schedule.title, specialty: schedule.specialty, type: schedule.type, date: schedule.date, startTime: schedule.startTime, endTime: schedule.endTime, roomId: room._id, roomName: room.name, professionalId: professional._id, professionalName: professional.name, vacanciesLeft, maxCapacity, isAlreadyEnrolled: activeScheduleIds.has(schedule._id) })
    }
    return result.sort((a,b) => a.startTime.localeCompare(b.startTime))
  },
})

// 7. Seed Auxiliar de Demonstracao (Garante agendamentos e vagas para teste imediato)


// 8. Novo Agendamento pelo Aluno (Consumindo Saldo do Pacote Ativo com Smart Allocation)
export const bookAppointmentFromPortal = mutation({
  args: { portalToken: v.string(),
    patientId: v.string(),
    patientPackageId: v.string(),
    date: v.string(),
    startTime: v.string(),
    endTime: v.string(),
    roomId: v.id('rooms'),
    professionalId: v.id('professionals'),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, input) => {
    await assertPortalBookingOpen(ctx)
    const { portalToken, ...args } = input
    const portalPatient = await requirePatient(ctx, portalToken, args.patientId);

    const normPatientId = ctx.db.normalizeId("patients", args.patientId)
    if (!normPatientId) throw new ConvexError("Paciente não encontrado.")

    const normPackageId = ctx.db.normalizeId("patientPackages", args.patientPackageId)
    if (!normPackageId) throw new ConvexError("Plano/Pacote não encontrado.")

    const patient = await ctx.db.get(normPatientId)
    if (!patient) throw new ConvexError("Paciente não encontrado.")

    const pkg = await ctx.db.get(normPackageId)
    if (!pkg) throw new ConvexError("Plano/Pacote não encontrado.")
    if (pkg.patientId !== normPatientId) throw new ConvexError("Este plano pertence a outro aluno.")

    const todayStr = new Date().toISOString().split("T")[0]
    if (pkg.status !== "active" || pkg.expiryDate < args.date || pkg.startDate > args.date) {
      throw new ConvexError("Este plano está inativo ou expirado. Renove seu pacote na recepção.")
    }

    if (pkg.remainingSessions <= 0) {
      throw new ConvexError("Você não possui saldo restante de sessões neste plano.")
    }

    // 1. Validar Smart Allocation (sessões futuras já agendadas com este pacote)
    const participations = await ctx.db
      .query("scheduleParticipants")
      .withIndex("by_patient", (q) => q.eq("patientId", normPatientId))
      .collect()

    const balance = await getPackageBookingBalance(ctx, pkg, participations)
    if (balance.freeBalance < 1) {
      throw new ConvexError('Saldo livre insuficiente: suas reservas futuras e créditos de reposição já comprometem as sessões deste plano.')
    }

    const { service } = await resolvePatientPackageService(ctx, pkg)
    if (!service) throw new ConvexError('Este plano não está vinculado a um serviço ativo. Fale com a recepção.')

    // 2. Validar anti-conflito de horário do paciente no mesmo dia
    for (const p of participations) {
      if (p.status === "justified_absence" || p.status === "absence") continue
      const s = await ctx.db.get(p.scheduleId)
      if (!s || s.status === "cancelled" || s.date !== args.date) continue

      if (checkTimeOverlap(s.startTime, s.endTime, args.startTime, args.endTime)) {
        throw new ConvexError(
          `Você já possui um atendimento conflitante das ${s.startTime} às ${s.endTime} no dia ${args.date}.`
        )
      }
    }

    // Compatibility endpoint: reserve an existing class, never create virtual slots.
    const daySchedules = await ctx.db.query('schedules').withIndex('by_date', q => q.eq('date', args.date)).collect()
    const schedule = daySchedules.find(s => s.roomId === args.roomId && s.professionalId === args.professionalId && s.startTime === args.startTime && s.endTime === args.endTime && s.status === 'scheduled' && s.type === 'turma')
    if (!schedule || parseDateTimeToMs(schedule.date, schedule.startTime) <= Date.now() || (await scheduleService(ctx, schedule))?._id !== service._id) throw new ConvexError('Turma indisponível. Escolha uma turma cadastrada pela clínica.')
    const selectedRoom = await ctx.db.get(schedule.roomId), selectedProfessional = await ctx.db.get(schedule.professionalId)
    if (!selectedRoom?.isActive || !selectedProfessional?.active) throw new ConvexError('Sala ou profissional indisponível.')
    await processWaitlist(ctx, schedule._id)
    const members = await ctx.db.query('scheduleParticipants').withIndex('by_schedule', q => q.eq('scheduleId', schedule._id)).collect()
    if (members.filter(occupiesSeat).length >= await effectiveScheduleCapacity(ctx, schedule)) throw new ConvexError('Turma lotada.')
    const scheduleId = schedule._id
    const participantId = await ctx.db.insert('scheduleParticipants', { scheduleId, patientId: normPatientId, patientPackageId: normPackageId, packageDebited: false, status: 'scheduled', notes: args.notes })
    await prepareReminders(ctx, participantId)

    // 4. Notificações
    const room = await ctx.db.get(schedule.roomId)
    const prof = await ctx.db.get(schedule.professionalId)

    // Log interno para recepção
    await ctx.db.insert("notificationLogs", {
      channel: "whatsapp_uazapi",
      recipientName: "Recepção Altar Fisio",
      recipientContact: patient.phone || "Portal Aluno",
      triggerType: "agendamento_portal_aluno",
      content: `O aluno ${patient.name} agendou ${schedule.title} para ${schedule.date} às ${schedule.startTime} via Portal do Aluno.`,
      status: "sent",
      timestamp: Date.now(),
    })

    // Disparo de confirmação WhatsApp para o aluno
    if (patient.phone) {
      await ctx.scheduler.runAfter(0, internal.notifications.sendScheduleConfirmationAction, {
        patientName: patient.name,
        phone: patient.phone,
        serviceName: schedule.title,
        professionalName: prof?.name || "Instrutor(a)",
        date: schedule.date,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        roomName: room?.name || "Sala Clínica",
      })
    }

    return {
      success: true,
      participantId,
      date: schedule.date,
      startTime: schedule.startTime,
      title: schedule.title,
      message: `Aula agendada com sucesso para ${schedule.date} às ${schedule.startTime}!`,
    }
  },
})


// Matrícula nas turmas existentes, com conferência e gravação atômica.
export const listMonthlyClasses = query({ args: monthlyArgs, handler: monthlyOptions })
export const previewMonthlyBooking = query({ args: { ...monthlyArgs, choices: choiceValidator }, handler: reviewMonthly })
export const bookMonthlyClasses = mutation({
  args: { ...monthlyArgs, choices: choiceValidator, expectedScheduleIds: v.array(v.id('schedules')), requestId: v.string() },
  handler: async (ctx, args) => {
    const patient = await requirePatient(ctx, args.portalToken)
    await assertPortalBookingOpen(ctx)
    if (!args.requestId || args.requestId.length > 100) throw new ConvexError('Identificador de reserva inválido.')
    const receipt = await ctx.db.query('monthlyBookingReceipts').withIndex('by_patient_request', q => q.eq('patientId', patient._id).eq('requestId', args.requestId)).first()
    if (receipt) return { createdCount: receipt.createdCount }
    const preview = await reviewMonthly(ctx, args)
    if (!preview.canConfirm || !preview.serviceId) throw new ConvexError(preview.errors.join('; ') || 'Tratamento indisponível.')
    const actual = preview.dates.map(d => d.scheduleId).sort().join(',')
    if (actual !== [...args.expectedScheduleIds].sort().join(',')) throw new ConvexError('As datas da turma mudaram. Confira a seleção novamente.')
    for (const date of preview.dates.filter(d => !d.alreadyBooked)) {
      await processWaitlist(ctx, date.scheduleId)
      const schedule = await ctx.db.get(date.scheduleId)
      if (!schedule) throw new ConvexError('Turma removida.')
      const participants = await ctx.db.query('scheduleParticipants').withIndex('by_schedule', q => q.eq('scheduleId', date.scheduleId)).collect()
      if (participants.filter(occupiesSeat).length >= await effectiveScheduleCapacity(ctx, schedule)) throw new ConvexError('Uma vaga foi preenchida. Confira as turmas novamente.')
      if (!schedule.serviceId) await ctx.db.patch(schedule._id, { serviceId: preview.serviceId })
      const id = await ctx.db.insert('scheduleParticipants', { scheduleId: date.scheduleId, patientId: patient._id, patientPackageId: args.patientPackageId, packageDebited: false, status: 'scheduled' })
      await prepareReminders(ctx, id)
    }
    await ctx.db.insert('monthlyBookingReceipts', { patientId: patient._id, requestId: args.requestId, createdCount: preview.required })
    return { createdCount: preview.required }
  },
})
