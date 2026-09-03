import { query, mutation } from "./_generated/server"
import { api } from "./_generated/api"
import { v } from "convex/values"

// Função utilitária para checar sobreposição de horários
export function checkTimeOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  return startA < endB && startB < endA
}

// Converte YYYY-MM-DD e HH:mm para timestamp em milissegundos no fuso de Brasília (UTC-3)
export function parseDateTimeToMs(dateStr: string, timeStr: string): number {
  return new Date(`${dateStr}T${timeStr}:00-03:00`).getTime()
}

export const listSchedulesByDate = query({
  args: { date: v.string() }, // YYYY-MM-DD
  handler: async (ctx, args) => {
    const schedules = await ctx.db
      .query("schedules")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .collect()

    // Enriquecer com dados de sala, profissional e participantes ativos
    const enriched = await Promise.all(
      schedules.map(async (schedule) => {
        const room = await ctx.db.get(schedule.roomId)
        const professional = await ctx.db.get(schedule.professionalId)
        const participants = await ctx.db
          .query("scheduleParticipants")
          .withIndex("by_schedule", (q) => q.eq("scheduleId", schedule._id))
          .collect()

        const todayStr = new Date().toISOString().split("T")[0]

        const enrichedParticipants = await Promise.all(
          participants.map(async (p) => {
            const patient = await ctx.db.get(p.patientId)

            // Buscar se o paciente tem pacote ativo correspondente à especialidade
            const patientPkgs = await ctx.db
              .query("patientPackages")
              .withIndex("by_patient", (q) => q.eq("patientId", p.patientId))
              .collect()

            const validPkgs = []
            for (const item of patientPkgs) {
              if (item.status === "active" && item.remainingSessions > 0 && item.expiryDate >= todayStr) {
                const pkgDef = await ctx.db.get(item.packageId)
                let matchesSpecialty = true
                if (pkgDef?.serviceId) {
                  const svc = await ctx.db.get(pkgDef.serviceId)
                  if (svc && svc.specialty !== schedule.specialty) {
                    matchesSpecialty = false
                  }
                }
                if (matchesSpecialty) {
                  validPkgs.push({
                    ...item,
                    packageName: pkgDef?.name || "Pacote",
                  })
                }
              }
            }

            validPkgs.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))
            const primaryPkg = validPkgs[0]

            return {
              ...p,
              patientName: patient?.name || "Paciente",
              patientPhone: patient?.phone || "",
              hasActivePackage: !!primaryPkg,
              activePackageName: primaryPkg?.packageName,
              remainingSessions: primaryPkg?.remainingSessions,
              totalSessions: primaryPkg?.totalSessions,
            }
          })
        )

        // Vagas consideram apenas participantes ativos (ausências justificadas liberam a vaga)
        const activeCount = participants.filter(
          (p) => p.status !== "justified_absence"
        ).length

        return {
          ...schedule,
          roomName: room?.name || "Sala",
          roomColor: room?.color || "#10b981",
          roomCapacity: room?.capacity || 4,
          professionalName: professional?.name || "Profissional",
          participants: enrichedParticipants,
          activeCount,
          vacanciesLeft: Math.max(0, schedule.maxCapacity - activeCount),
        }
      })
    )

    // Ordenar por horário de início
    return enriched.sort((a, b) => a.startTime.localeCompare(b.startTime))
  },
})

// Validador de Conflitos em Tempo Real
export const checkScheduleConflict = query({
  args: {
    date: v.string(),
    startTime: v.string(),
    endTime: v.string(),
    roomId: v.id("rooms"),
    professionalId: v.id("professionals"),
    ignoreScheduleId: v.optional(v.id("schedules")),
  },
  handler: async (ctx, args) => {
    if (args.startTime >= args.endTime) {
      return { hasConflict: true, message: "O horário de início deve ser anterior ao término." }
    }

    const daySchedules = await ctx.db
      .query("schedules")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .collect()

    const activeSchedules = daySchedules.filter(
      (s) => s.status !== "cancelled" && s._id !== args.ignoreScheduleId
    )

    // Checar conflito de sala
    const roomConflict = activeSchedules.find(
      (s) => s.roomId === args.roomId && checkTimeOverlap(s.startTime, s.endTime, args.startTime, args.endTime)
    )
    if (roomConflict) {
      const room = await ctx.db.get(args.roomId)
      return {
        hasConflict: true,
        conflictType: "room",
        message: `A sala ${room?.name || ""} já está ocupada das ${roomConflict.startTime} às ${roomConflict.endTime} ("${roomConflict.title}").`,
      }
    }

    // Checar conflito de profissional
    const profConflict = activeSchedules.find(
      (s) => s.professionalId === args.professionalId && checkTimeOverlap(s.startTime, s.endTime, args.startTime, args.endTime)
    )
    if (profConflict) {
      const prof = await ctx.db.get(args.professionalId)
      return {
        hasConflict: true,
        conflictType: "professional",
        message: `${prof?.name || "O profissional"} já possui atendimento agendado das ${profConflict.startTime} às ${profConflict.endTime} ("${profConflict.title}").`,
      }
    }

    return { hasConflict: false }
  },
})

// Criação de Agendamento Individual ou de Turma com Validação Rígida
export const createSchedule = mutation({
  args: {
    title: v.string(),
    type: v.union(v.literal("individual"), v.literal("turma")),
    specialty: v.union(v.literal("fisioterapia"), v.literal("pilates"), v.literal("rpg")),
    roomId: v.id("rooms"),
    professionalId: v.id("professionals"),
    date: v.string(),
    startTime: v.string(),
    endTime: v.string(),
    maxCapacity: v.number(),
    notes: v.optional(v.string()),
    recurringGroupId: v.optional(v.string()),
    isRecurring: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (args.startTime >= args.endTime) {
      throw new Error("O horário de início deve ser anterior ao de término!")
    }

    const room = await ctx.db.get(args.roomId)
    if (!room) throw new Error("Sala não encontrada")

    // Validação de capacidade da sala
    if (args.maxCapacity > room.capacity) {
      throw new Error(`A sala ${room.name} suporta no máximo ${room.capacity} aluno(s).`)
    }

    // Validação de conflitos no mesmo dia
    const daySchedules = await ctx.db
      .query("schedules")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .collect()

    const activeSchedules = daySchedules.filter((s) => s.status !== "cancelled")

    // Conflito de Sala
    const roomConflict = activeSchedules.find(
      (s) => s.roomId === args.roomId && checkTimeOverlap(s.startTime, s.endTime, args.startTime, args.endTime)
    )
    if (roomConflict) {
      throw new Error(`Conflito: A sala ${room.name} já está ocupada das ${roomConflict.startTime} às ${roomConflict.endTime} ("${roomConflict.title}")!`)
    }

    // Conflito de Profissional
    const profConflict = activeSchedules.find(
      (s) => s.professionalId === args.professionalId && checkTimeOverlap(s.startTime, s.endTime, args.startTime, args.endTime)
    )
    if (profConflict) {
      const prof = await ctx.db.get(args.professionalId)
      throw new Error(`Conflito: ${prof?.name || "O profissional"} já está alocado em outra sala das ${profConflict.startTime} às ${profConflict.endTime} ("${profConflict.title}")!`)
    }

    return await ctx.db.insert("schedules", {
      ...args,
      status: "scheduled",
    })
  },
})

// Motor de Criação de Séries Recorrentes de Turmas (ex: Pilates Seg/Qua)
export const createRecurringScheduleSeries = mutation({
  args: {
    title: v.string(),
    type: v.union(v.literal("individual"), v.literal("turma")),
    specialty: v.union(v.literal("fisioterapia"), v.literal("pilates"), v.literal("rpg")),
    roomId: v.id("rooms"),
    professionalId: v.id("professionals"),
    startTime: v.string(),
    endTime: v.string(),
    maxCapacity: v.number(),
    daysOfWeek: v.array(v.number()), // 0: Dom, 1: Seg, 2: Ter, 3: Qua, 4: Qui, 5: Sex, 6: Sab
    startDate: v.string(), // YYYY-MM-DD
    weeksCount: v.number(), // Ex: 4, 8, 12 semanas
    notes: v.optional(v.string()),
    enrolledPatientIds: v.optional(v.array(v.id("patients"))),
  },
  handler: async (ctx, args) => {
    if (args.startTime >= args.endTime) {
      throw new Error("Horário de início deve ser anterior ao término.")
    }
    if (args.daysOfWeek.length === 0) {
      throw new Error("Selecione pelo menos um dia da semana para a recorrência.")
    }

    const room = await ctx.db.get(args.roomId)
    if (!room) throw new Error("Sala não encontrada")
    if (args.maxCapacity > room.capacity) {
      throw new Error(`Capacidade excede o limite físico de ${room.capacity} alunos da sala ${room.name}.`)
    }

    const recurringGroupId = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const createdSchedules: any[] = []
    const skippedDates: { date: string; reason: string }[] = []

    const start = new Date(`${args.startDate}T12:00:00Z`)
    const totalDays = args.weeksCount * 7

    for (let d = 0; d < totalDays; d++) {
      const current = new Date(start)
      current.setDate(current.getDate() + d)
      const dayOfWeek = current.getDay()

      if (!args.daysOfWeek.includes(dayOfWeek)) continue

      const dateStr = current.toISOString().split("T")[0]

      // Checar conflitos na data específica
      const daySchedules = await ctx.db
        .query("schedules")
        .withIndex("by_date", (q) => q.eq("date", dateStr))
        .collect()

      const activeSchedules = daySchedules.filter((s) => s.status !== "cancelled")

      const roomConflict = activeSchedules.find(
        (s) => s.roomId === args.roomId && checkTimeOverlap(s.startTime, s.endTime, args.startTime, args.endTime)
      )
      if (roomConflict) {
        skippedDates.push({ date: dateStr, reason: `Sala ocupada (${roomConflict.startTime}-${roomConflict.endTime})` })
        continue
      }

      const profConflict = activeSchedules.find(
        (s) => s.professionalId === args.professionalId && checkTimeOverlap(s.startTime, s.endTime, args.startTime, args.endTime)
      )
      if (profConflict) {
        skippedDates.push({ date: dateStr, reason: `Profissional ocupado (${profConflict.startTime}-${profConflict.endTime})` })
        continue
      }

      // Criar agendamento
      const scheduleId = await ctx.db.insert("schedules", {
        title: args.title,
        type: args.type,
        specialty: args.specialty,
        roomId: args.roomId,
        professionalId: args.professionalId,
        date: dateStr,
        startTime: args.startTime,
        endTime: args.endTime,
        maxCapacity: args.maxCapacity,
        status: "scheduled",
        notes: args.notes,
        recurringGroupId,
        isRecurring: true,
      })

      // Matricular alunos fixos na série
      if (args.enrolledPatientIds && args.enrolledPatientIds.length > 0) {
        for (const patientId of args.enrolledPatientIds) {
          await ctx.db.insert("scheduleParticipants", {
            scheduleId,
            patientId,
            status: "scheduled",
          })
        }
      }

      createdSchedules.push({ scheduleId, date: dateStr })
    }

    return {
      recurringGroupId,
      createdCount: createdSchedules.length,
      skippedCount: skippedDates.length,
      skippedDates,
    }
  },
})

// Matrícula ou Encaixe de Reposição em Agendamento Existente
export const addParticipantToSchedule = mutation({
  args: {
    scheduleId: v.id("schedules"),
    patientId: v.id("patients"),
    isReplacement: v.boolean(),
    replacementCreditId: v.optional(v.id("replacementCredits")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const schedule = await ctx.db.get(args.scheduleId)
    if (!schedule) throw new Error("Agendamento não encontrado")

    const participants = await ctx.db
      .query("scheduleParticipants")
      .withIndex("by_schedule", (q) => q.eq("scheduleId", args.scheduleId))
      .collect()

    // Considerar apenas alunos ativos (não liberados por desmarcação)
    const activeParticipants = participants.filter(
      (p) => p.status !== "justified_absence"
    )

    if (activeParticipants.length >= schedule.maxCapacity) {
      throw new Error("Esta turma já atingiu a sua capacidade máxima!")
    }

    // Se estiver usando crédito de reposição, validar e consumir
    if (args.isReplacement && args.replacementCreditId) {
      const credit = await ctx.db.get(args.replacementCreditId)
      if (!credit || credit.status !== "available") {
        throw new Error("Crédito de reposição inválido ou já utilizado.")
      }
      if (credit.patientId !== args.patientId) {
        throw new Error("Este crédito de reposição pertence a outro paciente.")
      }

      await ctx.db.patch(args.replacementCreditId, {
        status: "used",
        usedInScheduleId: args.scheduleId,
      })
    }

    return await ctx.db.insert("scheduleParticipants", {
      scheduleId: args.scheduleId,
      patientId: args.patientId,
      status: args.isReplacement ? "replacement" : "scheduled",
      replacementCreditId: args.replacementCreditId,
      notes: args.notes,
    })
  },
})

// Check-in e Presença com Débito Automático de Sessão do Pacote Ativo
export const checkInParticipant = mutation({
  args: {
    participantId: v.id("scheduleParticipants"),
    status: v.union(v.literal("present"), v.literal("absence"), v.literal("scheduled")),
  },
  handler: async (ctx, args) => {
    const participant = await ctx.db.get(args.participantId)
    if (!participant) throw new Error("Participante não encontrado")

    const schedule = await ctx.db.get(participant.scheduleId)
    const wasPresent = participant.status === "present"
    const isNowPresent = args.status === "present"

    let deductedPackageId = participant.patientPackageId
    let resultMessage = ""
    let hasPackage = false
    let remainingSessions: number | undefined

    // 1. Transição para PRESENTE: Consumir 1 sessão do pacote ativo
    if (isNowPresent && !wasPresent) {
      let targetPackage = null
      if (participant.patientPackageId) {
        targetPackage = await ctx.db.get(participant.patientPackageId)
      }

      if (!targetPackage || targetPackage.status !== "active" || targetPackage.remainingSessions <= 0) {
        // Buscar pacotes ativos do paciente
        const allPatientPackages = await ctx.db
          .query("patientPackages")
          .withIndex("by_patient", (q) => q.eq("patientId", participant.patientId))
          .collect()

        const todayStr = new Date().toISOString().split("T")[0]
        const validPackages = []

        for (const pp of allPatientPackages) {
          if (pp.status === "active" && pp.remainingSessions > 0 && pp.expiryDate >= todayStr) {
            const pkgDef = await ctx.db.get(pp.packageId)
            let matches = true
            if (pkgDef?.serviceId && schedule) {
              const svc = await ctx.db.get(pkgDef.serviceId)
              if (svc && svc.specialty !== schedule.specialty) {
                matches = false
              }
            }
            if (matches) {
              validPackages.push({ pp, pkgDef })
            }
          }
        }

        // Ordenar pelo que expira mais cedo (Smart FIFO)
        validPackages.sort((a, b) => a.pp.expiryDate.localeCompare(b.pp.expiryDate))

        if (validPackages.length > 0) {
          targetPackage = validPackages[0].pp
        }
      }

      if (targetPackage && targetPackage.remainingSessions > 0) {
        const newUsed = targetPackage.usedSessions + 1
        const newRemaining = targetPackage.remainingSessions - 1
        const newStatus = newRemaining <= 0 ? "completed" : "active"

        await ctx.db.patch(targetPackage._id, {
          usedSessions: newUsed,
          remainingSessions: newRemaining,
          status: newStatus,
        })

        deductedPackageId = targetPackage._id
        hasPackage = true
        remainingSessions = newRemaining

        const pkgDef = await ctx.db.get(targetPackage.packageId)
        resultMessage = `Presença confirmada! 1 sessão debitada do plano "${pkgDef?.name || "Pacote"}". Saldo: ${newRemaining} restante(s).`
      } else {
        deductedPackageId = undefined
        hasPackage = false
        resultMessage = "Presença confirmada! Paciente sem pacote ativo (Atendimento Avulso / Pendente)."
      }
    }

    // 2. Revertendo PRESENTE (voltando para scheduled ou absence): Estornar a sessão
    if (!isNowPresent && wasPresent && participant.patientPackageId) {
      const targetPackage = await ctx.db.get(participant.patientPackageId)
      if (targetPackage) {
        const newUsed = Math.max(0, targetPackage.usedSessions - 1)
        const newRemaining = targetPackage.remainingSessions + 1
        await ctx.db.patch(targetPackage._id, {
          usedSessions: newUsed,
          remainingSessions: newRemaining,
          status: "active",
        })
      }
      deductedPackageId = undefined
      resultMessage = "Presença desfeita. 1 sessão estornada ao pacote do paciente."
    }

    await ctx.db.patch(args.participantId, {
      status: args.status,
      patientPackageId: deductedPackageId,
      checkedInAt: args.status === "present" ? Date.now() : undefined,
    })

    return {
      success: true,
      hasPackage,
      remainingSessions,
      message: resultMessage,
    }
  },
})

// Desmarcação com Motor Inteligente de Reposição & Política de Antecedência
export const cancelWithReplacementCredit = mutation({
  args: {
    participantId: v.id("scheduleParticipants"),
    reason: v.optional(v.string()),
    forceExemption: v.optional(v.boolean()), // Autorização especial do gestor para gerar reposição fora do prazo
  },
  handler: async (ctx, args) => {
    const participant = await ctx.db.get(args.participantId)
    if (!participant) throw new Error("Participante não encontrado")

    const schedule = await ctx.db.get(participant.scheduleId)
    if (!schedule) throw new Error("Agendamento não encontrado")

    const settings = await ctx.db.query("clinicSettings").first()
    const noticeHoursRequired = settings?.cancellationNoticeHours ?? 2
    const expiryDays = settings?.replacementExpiryDays ?? 30

    // Cálculo da antecedência em horas
    const sessionTimeMs = parseDateTimeToMs(schedule.date, schedule.startTime)
    const nowMs = Date.now()
    const hoursNotice = (sessionTimeMs - nowMs) / (1000 * 60 * 60)

    const isWithinPolicy = hoursNotice >= noticeHoursRequired
    const shouldGrantCredit = isWithinPolicy || !!args.forceExemption

    if (shouldGrantCredit) {
      // Calcula expiração
      const expiry = new Date()
      expiry.setDate(expiry.getDate() + expiryDays)
      const expiryStr = expiry.toISOString().split("T")[0]

      // 1. Gera o crédito de reposição
      const creditId = await ctx.db.insert("replacementCredits", {
        patientId: participant.patientId,
        originScheduleId: participant.scheduleId,
        generatedAt: nowMs,
        expiryDate: expiryStr,
        status: "available",
      })

      // 2. Libera a vaga marcando como falta justificada
      const notePrefix = args.forceExemption && !isWithinPolicy
        ? `Desmarcado com cortesia/exceção (${hoursNotice.toFixed(1)}h antes)`
        : `Desmarcado no prazo (${hoursNotice.toFixed(1)}h antes)`

      await ctx.db.patch(args.participantId, {
        status: "justified_absence",
        notes: args.reason ? `${notePrefix}: ${args.reason}` : notePrefix,
      })

      // 3. Notificação Imediata WhatsApp: Notificar o paciente do crédito gerado
      const patient = await ctx.db.get(participant.patientId)
      if (patient?.phone) {
        await ctx.scheduler.runAfter(0, api.notifications.sendReplacementCreditNoticeAction, {
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
        isExemption: !!args.forceExemption && !isWithinPolicy,
      }
    } else {
      // Fora do prazo: marca como falta sem gerar crédito automático
      await ctx.db.patch(args.participantId, {
        status: "absence",
        notes: args.reason
          ? `Desmarcado fora do prazo (${hoursNotice.toFixed(1)}h antes): ${args.reason}`
          : `Desmarcado fora do prazo (${hoursNotice.toFixed(1)}h antes - mínimo ${noticeHoursRequired}h)`,
      })

      return {
        success: true,
        generatedCredit: false,
        hoursNotice: Number(hoursNotice.toFixed(1)),
        noticeHoursRequired,
        message: `Cancelamento realizado com ${hoursNotice.toFixed(1)}h de antecedência. O prazo mínimo da clínica é de ${noticeHoursRequired}h, por isso não gerou crédito automático.`,
      }
    }
  },
})

// Listagem de Todos os Créditos de Reposição Disponíveis na Clínica
export const listAvailableReplacementCredits = query({
  args: { patientId: v.optional(v.id("patients")) },
  handler: async (ctx, args) => {
    let creditsQuery = ctx.db
      .query("replacementCredits")
      .withIndex("by_status", (q) => q.eq("status", "available"))

    if (args.patientId) {
      creditsQuery = ctx.db
        .query("replacementCredits")
        .withIndex("by_patient_status", (q) =>
          q.eq("patientId", args.patientId!).eq("status", "available")
        )
    }

    const credits = await creditsQuery.collect()
    const todayStr = new Date().toISOString().split("T")[0]

    // Enriquecer créditos com nome do paciente e dados da aula original
    const enriched = await Promise.all(
      credits.map(async (c) => {
        const patient = await ctx.db.get(c.patientId)
        const originSchedule = await ctx.db.get(c.originScheduleId)
        const isExpired = c.expiryDate < todayStr

        const expiryDateObj = new Date(`${c.expiryDate}T23:59:59Z`)
        const daysLeft = Math.ceil((expiryDateObj.getTime() - Date.now()) / (1000 * 60 * 60 * 24))

        return {
          ...c,
          patientName: patient?.name || "Paciente",
          patientPhone: patient?.phone || "",
          patientCpf: patient?.documentCpf || "",
          originDate: originSchedule?.date || "—",
          originTitle: originSchedule?.title || "Aula",
          originSpecialty: originSchedule?.specialty || "pilates",
          isExpired,
          daysLeft: Math.max(0, daysLeft),
        }
      })
    )

    // Ordenar por prazo mais próximo de vencer
    return enriched.sort((a, b) => a.daysLeft - b.daysLeft)
  },
})

// Busca de Vagas Ociosas para Alocação de Reposições
export const listAvailableTurmasForReplacement = query({
  args: {
    startDate: v.string(), // YYYY-MM-DD
    endDate: v.string(), // YYYY-MM-DD
    specialty: v.optional(v.union(v.literal("fisioterapia"), v.literal("pilates"), v.literal("rpg"))),
  },
  handler: async (ctx, args) => {
    // Buscar agendamentos indexados por intervalo de datas (elimina table scan completo)
    const schedules = await ctx.db
      .query("schedules")
      .withIndex("by_date", (q) =>
        q.gte("date", args.startDate).lte("date", args.endDate)
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("type"), "turma"),
          q.neq(q.field("status"), "cancelled")
        )
      )
      .collect()

    const enriched = await Promise.all(
      schedules.map(async (s) => {
        if (args.specialty && s.specialty !== args.specialty) return null

        const room = await ctx.db.get(s.roomId)
        const prof = await ctx.db.get(s.professionalId)
        const participants = await ctx.db
          .query("scheduleParticipants")
          .withIndex("by_schedule", (q) => q.eq("scheduleId", s._id))
          .collect()

        const activeCount = participants.filter((p) => p.status !== "justified_absence").length
        const vacancies = s.maxCapacity - activeCount

        if (vacancies <= 0) return null

        return {
          ...s,
          roomName: room?.name || "Sala",
          roomColor: room?.color || "#10b981",
          professionalName: prof?.name || "Profissional",
          activeCount,
          vacanciesLeft: vacancies,
        }
      })
    )

    return enriched
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date)
        return a.startTime.localeCompare(b.startTime)
      })
  },
})

// Edição de Agendamento ou Turma
export const updateSchedule = mutation({
  args: {
    id: v.id("schedules"),
    title: v.optional(v.string()),
    specialty: v.optional(v.union(v.literal("fisioterapia"), v.literal("pilates"), v.literal("rpg"))),
    roomId: v.optional(v.id("rooms")),
    professionalId: v.optional(v.id("professionals")),
    date: v.optional(v.string()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    maxCapacity: v.optional(v.number()),
    notes: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("scheduled"),
        v.literal("in_progress"),
        v.literal("completed"),
        v.literal("cancelled")
      )
    ),
  },
  handler: async (ctx, args) => {
    const { id, ...data } = args
    const existing = await ctx.db.get(id)
    if (!existing) throw new Error("Agendamento não encontrado")

    await ctx.db.patch(id, data)
    return id
  },
})

// Exclusão de Agendamento ou Turma (com suporte a exclusão em série)
export const deleteSchedule = mutation({
  args: {
    id: v.id("schedules"),
    deleteSeries: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const schedule = await ctx.db.get(args.id)
    if (!schedule) throw new Error("Agendamento não encontrado")

    if (args.deleteSeries && schedule.recurringGroupId) {
      const series = await ctx.db
        .query("schedules")
        .withIndex("by_recurring_group", (q) => q.eq("recurringGroupId", schedule.recurringGroupId!))
        .collect()

      for (const s of series) {
        // Remover participantes
        const parts = await ctx.db
          .query("scheduleParticipants")
          .withIndex("by_schedule", (q) => q.eq("scheduleId", s._id))
          .collect()
        for (const p of parts) {
          await ctx.db.delete(p._id)
        }
        await ctx.db.delete(s._id)
      }
      return { success: true, count: series.length }
    } else {
      // Excluir apenas este agendamento e seus participantes
      const parts = await ctx.db
        .query("scheduleParticipants")
        .withIndex("by_schedule", (q) => q.eq("scheduleId", args.id))
        .collect()
      for (const p of parts) {
        await ctx.db.delete(p._id)
      }
      await ctx.db.delete(args.id)
      return { success: true, count: 1 }
    }
  },
})

// Remoção / Desmatrícula de participante da turma
export const removeParticipantFromSchedule = mutation({
  args: {
    scheduleId: v.id("schedules"),
    participantRecordId: v.id("scheduleParticipants"),
  },
  handler: async (ctx, args) => {
    const part = await ctx.db.get(args.participantRecordId)
    if (!part) throw new Error("Participante não encontrado")

    await ctx.db.delete(args.participantRecordId)
    return { success: true }
  },
})


