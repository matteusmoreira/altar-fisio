import { requirePatient } from './lib/security'
import { bookCredit, cancelReplacement, processWaitlist } from './lib/waitlist'
import { cancelParticipantJobs, clinicToday, occupiesSeat, prepareReminders } from './lib/appointmentJobs'
import { query, mutation } from "./_generated/server"
import { api, internal } from "./_generated/api"
import { v } from "convex/values"
import { parseDateTimeToMs, checkTimeOverlap } from "./schedules"

// Limpa caracteres especiais de CPF e Telefones
function cleanNumbers(val: string): string {
  return val.replace(/\D/g, "")
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

      // Calculo de antecedencia em horas para cancelamento
      const sessionMs = parseDateTimeToMs(schedule.date, schedule.startTime)
      const hoursUntilSession = (sessionMs - now) / (1000 * 60 * 60)
      const isWithinNoticePolicy = hoursUntilSession >= noticeHoursRequired

      const item = {
        participantId: part._id,
        scheduleId: schedule._id,
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
        const pkgDef = await ctx.db.get(pkg.packageId)
        let specialty: "pilates" | "fisioterapia" | "rpg" = "pilates"
        let serviceName = "Pilates"
        if (pkgDef?.serviceId) {
          const service = await ctx.db.get(pkgDef.serviceId)
          if (service?.specialty) specialty = service.specialty
          if (service?.name) serviceName = service.name
        } else {
          const nameLower = (pkgDef?.name || "").toLowerCase()
          if (nameLower.includes("fisio")) specialty = "fisioterapia"
          else if (nameLower.includes("rpg")) specialty = "rpg"
        }

        const isExpired = pkg.status !== "active" || pkg.expiryDate < todayStr
        const actualStatus = isExpired ? "expired" : pkg.status

        // Quantidade de aulas futuras já agendadas consumindo este pacote
        const bookedFutureSessionsCount = upcomingList.filter(
          (u) => u.patientPackageId === pkg._id
        ).length

        // Saldo real livre para novos agendamentos no futuro
        const bookableSessionsCount = Math.max(
          0,
          pkg.remainingSessions - bookedFutureSessionsCount
        )

        const usagePercentage =
          pkg.totalSessions > 0
            ? Math.round((pkg.usedSessions / pkg.totalSessions) * 100)
            : 0

        return {
          ...pkg,
          status: actualStatus,
          packageName: pkgDef?.name || "Plano Altar Fisio",
          packagePrice: pkgDef?.price,
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
    if (!normParticipantId) throw new Error("Agendamento nao encontrado.")
    const normPatientId = ctx.db.normalizeId("patients", args.patientId)
    if (!normPatientId) throw new Error("Paciente nao encontrado.")

    const participant = await ctx.db.get(normParticipantId)
    if (!participant) throw new Error("Agendamento nao encontrado.")
    if (participant.patientId !== normPatientId) {
      throw new Error("Acesso nao autorizado para este agendamento.")
    }

    if (!['scheduled', 'replacement'].includes(participant.status)) throw new Error('Este agendamento já foi processado.')
    const schedule = await ctx.db.get(participant.scheduleId)
    if (!schedule || schedule.status === 'cancelled') throw new Error("Sessao nao encontrada.")

    const settings = await ctx.db.query("clinicSettings").first()
    const noticeHoursRequired = settings?.cancellationNoticeHours ?? 2
    const expiryDays = settings?.replacementExpiryDays ?? 30

    const sessionMs = parseDateTimeToMs(schedule.date, schedule.startTime)
    const now = Date.now()
    const hoursNotice = (sessionMs - now) / (1000 * 60 * 60)
    const isWithinPolicy = hoursNotice >= noticeHoursRequired

    if (sessionMs <= now) throw new Error('Não é possível desmarcar uma sessão já iniciada.')
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
    const { portalToken, ...args } = input
    const portalPatient = await requirePatient(ctx, portalToken, args.patientId);

    const normParticipantId = ctx.db.normalizeId("scheduleParticipants", args.participantId)
    if (!normParticipantId) throw new Error("Agendamento atual nao encontrado.")
    const normTargetScheduleId = ctx.db.normalizeId("schedules", args.targetScheduleId)
    if (!normTargetScheduleId) throw new Error("Novo horario selecionado nao encontrado.")
    const normPatientId = ctx.db.normalizeId("patients", args.patientId)
    if (!normPatientId) throw new Error("Paciente nao autorizado.")

    const currentPart = await ctx.db.get(normParticipantId)
    if (!currentPart) throw new Error("Agendamento atual nao encontrado.")
    if (!['scheduled', 'replacement'].includes(currentPart.status)) throw new Error('Este agendamento já foi processado.')
    if (currentPart.patientId !== normPatientId) {
      throw new Error("Nao autorizado.")
    }

    const currentSchedule = await ctx.db.get(currentPart.scheduleId)
    if (!currentSchedule) throw new Error("Sessao atual nao encontrada.")

    const targetSchedule = await ctx.db.get(normTargetScheduleId)
    if (!targetSchedule) throw new Error("Novo horario selecionado nao encontrado.")
    await processWaitlist(ctx, normTargetScheduleId)
    const settings = await ctx.db.query('clinicSettings').first()
    if (currentSchedule.status === 'cancelled' || parseDateTimeToMs(currentSchedule.date, currentSchedule.startTime) - Date.now() < (settings?.cancellationNoticeHours ?? 2) * 3600000) throw new Error('Prazo para remarcação encerrado. Fale com a recepção.')
    if (targetSchedule.status !== 'scheduled' || targetSchedule.specialty !== currentSchedule.specialty || parseDateTimeToMs(targetSchedule.date, targetSchedule.startTime) <= Date.now()) throw new Error('Horário de destino inválido.')
    if (currentPart.replacementCreditId) {
      if (currentSchedule._id === targetSchedule._id) throw new Error('Escolha outro horário.')
      await cancelReplacement(ctx, currentPart, true, 'Reposição transferida para outro horário.')
      const newParticipantId = await bookCredit(ctx, normPatientId, currentPart.replacementCreditId, normTargetScheduleId)
      return { success: true, newParticipantId, newDate: targetSchedule.date, newStartTime: targetSchedule.startTime, message: 'Reposição remarcada com o mesmo crédito, sem alterar sua validade.' }
    }
    if (currentPart.patientPackageId) {
      const pkg = await ctx.db.get(currentPart.patientPackageId)
      if (!pkg || pkg.patientId !== normPatientId || pkg.status !== 'active' || pkg.remainingSessions < 1 || pkg.expiryDate < targetSchedule.date) throw new Error('Plano indisponível para a data selecionada.')
    }
    const ownParts = await ctx.db.query('scheduleParticipants').withIndex('by_patient', q => q.eq('patientId', normPatientId)).collect()
    for (const part of ownParts) {
      if (part._id === currentPart._id || ['absence', 'justified_absence'].includes(part.status)) continue
      const existing = await ctx.db.get(part.scheduleId)
      if (existing && existing.status !== 'cancelled' && existing.date === targetSchedule.date && checkTimeOverlap(existing.startTime, existing.endTime, targetSchedule.startTime, targetSchedule.endTime)) throw new Error('Você já possui agendamento neste horário.')
    }

    // Checar capacidade no novo horario
    const existingParts = await ctx.db
      .query("scheduleParticipants")
      .withIndex("by_schedule", (q) => q.eq("scheduleId", normTargetScheduleId))
      .collect()

    const activeParts = existingParts.filter(occupiesSeat)
    if (activeParts.length >= targetSchedule.maxCapacity) {
      throw new Error("O novo horario selecionado ja preencheu todas as vagas!")
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
      message: `Remarcacao concluida com sucesso para ${targetSchedule.date} as ${targetSchedule.startTime}!`,
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
    const { portalToken, ...args } = input
    const portalPatient = await requirePatient(ctx, portalToken, args.patientId);

    const normCreditId = ctx.db.normalizeId("replacementCredits", args.creditId)
    if (!normCreditId) throw new Error("Credito de reposicao invalido.")
    const normTargetScheduleId = ctx.db.normalizeId("schedules", args.targetScheduleId)
    if (!normTargetScheduleId) throw new Error("Horario nao encontrado.")
    const normPatientId = ctx.db.normalizeId("patients", args.patientId)
    if (!normPatientId) throw new Error("Paciente nao encontrado.")

    const credit = await ctx.db.get(normCreditId)
    if (!credit || credit.status !== "available") {
      throw new Error("Credito de reposicao invalido ou ja utilizado.")
    }
    if (credit.patientId !== normPatientId) {
      throw new Error("Credito pertence a outro paciente.")
    }

    const todayStr = clinicToday()
    if (credit.expiryDate < todayStr) {
      await ctx.db.patch(normCreditId, { status: "expired" })
      throw new Error("Este credito de reposicao expirou em " + credit.expiryDate)
    }

    const targetSchedule = await ctx.db.get(normTargetScheduleId)
    if (!targetSchedule) throw new Error("Horario nao encontrado.")
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
  args: { portalToken: v.string(),
    specialty: v.union(v.literal("fisioterapia"), v.literal("pilates"), v.literal("rpg")),
    startDate: v.string(), // YYYY-MM-DD
    daysCount: v.optional(v.number()), // Padrao: 14 dias
    patientId: v.optional(v.string()),
  },
  handler: async (ctx, input) => {
    const { portalToken, ...args } = input
    const portalPatient = await requirePatient(ctx, portalToken, args.patientId);

    const days = args.daysCount ?? 14
    if (!Number.isInteger(days) || days < 1 || days > 31) throw new Error('Período inválido.')
    const result: any[] = []

    const startObj = new Date(`${args.startDate}T12:00:00Z`)
    const normPatientId = portalPatient._id

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
        (s) => s.specialty === args.specialty && s.status !== "cancelled"
      )

      for (const s of matching) {
        const parts = await ctx.db
          .query("scheduleParticipants")
          .withIndex("by_schedule", (q) => q.eq("scheduleId", s._id))
          .collect()

        const activeParts = parts.filter(
          (p) => p.status !== "justified_absence" && p.status !== "absence"
        )
        const activeCount = activeParts.length
        const vacancies = Math.max(0, s.maxCapacity - activeCount)

        const isAlreadyEnrolled = normPatientId
          ? activeParts.some((p) => p.patientId === normPatientId)
          : false

        if (vacancies > 0 || isAlreadyEnrolled) {
          const room = await ctx.db.get(s.roomId)
          const prof = await ctx.db.get(s.professionalId)

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
            maxCapacity: s.maxCapacity,
            isAlreadyEnrolled,
          })
        }
      }
    }

    return result.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date)
      return a.startTime.localeCompare(b.startTime)
    })
  },
})

// 7. Seed Auxiliar de Demonstracao (Garante agendamentos e vagas para teste imediato)


// 8. Novo Agendamento pelo Aluno (Consumindo Saldo do Pacote Ativo com Smart Allocation)
export const bookAppointmentFromPortal = mutation({
  args: { portalToken: v.string(),
    patientId: v.string(),
    patientPackageId: v.string(),
    scheduleId: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, input) => {
    const { portalToken, ...args } = input
    const portalPatient = await requirePatient(ctx, portalToken, args.patientId);

    const normPatientId = ctx.db.normalizeId("patients", args.patientId)
    if (!normPatientId) throw new Error("Paciente não encontrado.")

    const normPackageId = ctx.db.normalizeId("patientPackages", args.patientPackageId)
    if (!normPackageId) throw new Error("Plano/Pacote não encontrado.")

    const normScheduleId = ctx.db.normalizeId("schedules", args.scheduleId)
    if (!normScheduleId) throw new Error("Horário de aula não encontrado.")

    const patient = await ctx.db.get(normPatientId)
    if (!patient) throw new Error("Paciente não encontrado.")

    const pkg = await ctx.db.get(normPackageId)
    if (!pkg) throw new Error("Plano/Pacote não encontrado.")
    if (pkg.patientId !== normPatientId) throw new Error("Este plano pertence a outro aluno.")

    const todayStr = new Date().toISOString().split("T")[0]
    if (pkg.status !== "active" || pkg.expiryDate < todayStr) {
      throw new Error("Este plano está inativo ou expirado. Renove seu pacote na recepção.")
    }

    if (pkg.remainingSessions <= 0) {
      throw new Error("Você não possui saldo restante de sessões neste plano.")
    }

    // 1. Validar Smart Allocation (sessões futuras já agendadas com este pacote)
    const participations = await ctx.db
      .query("scheduleParticipants")
      .withIndex("by_patient", (q) => q.eq("patientId", normPatientId))
      .collect()

    const futureBookings: any[] = []
    for (const part of participations) {
      if (
        part.patientPackageId === normPackageId &&
        part.status !== "justified_absence" &&
        part.status !== "absence"
      ) {
        const sch = await ctx.db.get(part.scheduleId)
        if (sch && sch.status !== "cancelled" && sch.date >= todayStr) {
          futureBookings.push(part)
        }
      }
    }

    if (futureBookings.length >= pkg.remainingSessions) {
      throw new Error(
        `Você já possui ${futureBookings.length} aula(s) futura(s) agendada(s) para este plano, atingindo seu saldo de ${pkg.remainingSessions} sessão(ões) disponível(is).`
      )
    }

    // 2. Validar horário da aula
    const schedule = await ctx.db.get(normScheduleId)
    if (!schedule || schedule.status === "cancelled") {
      throw new Error("Esta aula não está disponível para agendamento.")
    }

    if (schedule.date < todayStr) {
      throw new Error("Não é possível agendar aulas em datas passadas.")
    }

    // 3. Validar se o paciente já está matriculado nesta aula
    await processWaitlist(ctx, normScheduleId)
    const scheduleParts = await ctx.db
      .query("scheduleParticipants")
      .withIndex("by_schedule", (q) => q.eq("scheduleId", normScheduleId))
      .collect()

    const alreadyEnrolled = scheduleParts.some(
      (p) => p.patientId === normPatientId && p.status !== "justified_absence" && p.status !== "absence"
    )
    if (alreadyEnrolled) {
      throw new Error("Você já está matriculado(a) neste horário!")
    }

    // 4. Validar capacidade da turma
    const activeParticipants = scheduleParts.filter(
      (p) => p.status !== "justified_absence" && p.status !== "absence"
    )
    if (activeParticipants.length >= schedule.maxCapacity) {
      throw new Error("Este horário acabou de preencher todas as vagas disponíveis!")
    }

    // 5. Validar anti-conflito de horário do paciente no mesmo dia
    for (const p of participations) {
      if (p.status === "justified_absence" || p.status === "absence") continue
      const s = await ctx.db.get(p.scheduleId)
      if (!s || s.status === "cancelled" || s.date !== schedule.date) continue

      if (checkTimeOverlap(s.startTime, s.endTime, schedule.startTime, schedule.endTime)) {
        throw new Error(
          `Você já possui um atendimento conflitante das ${s.startTime} às ${s.endTime} no dia ${schedule.date}.`
        )
      }
    }

    // 6. Inserir participante na turma
    const participantId = await ctx.db.insert("scheduleParticipants", {
      scheduleId: normScheduleId,
      patientId: normPatientId,
      status: "scheduled",
      patientPackageId: normPackageId,
      notes: args.notes || "Agendado pelo próprio aluno no Portal",
    })
    await prepareReminders(ctx, participantId)

    // 7. Notificações
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
