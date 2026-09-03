import { query, mutation } from "./_generated/server"
import { api } from "./_generated/api"
import { v } from "convex/values"
import { parseDateTimeToMs, checkTimeOverlap } from "./schedules"

// Limpa caracteres especiais de CPF e Telefones
function cleanNumbers(val: string): string {
  return val.replace(/\D/g, "")
}

// 1. Identificacao Rapida do Paciente (Opcao A - Sem Friccao de Senhas)
export const identifyPatient = query({
  args: { identifier: v.string() },
  handler: async (ctx, args) => {
    const raw = args.identifier.trim()
    if (!raw) return null

    const cleanInput = cleanNumbers(raw)

    // 1. Tentar correspondência exata via índice by_cpf
    if (cleanInput.length >= 11) {
      const byCpf = await ctx.db
        .query("patients")
        .withIndex("by_cpf", (q) => q.eq("documentCpf", raw))
        .first()
      if (byCpf) {
        return {
          _id: byCpf._id,
          name: byCpf.name,
          documentCpf: byCpf.documentCpf,
          phone: byCpf.phone,
          email: byCpf.email,
        }
      }
    }

    // 2. Tentar correspondência exata via índice by_phone
    if (cleanInput.length >= 8) {
      const byPhone = await ctx.db
        .query("patients")
        .withIndex("by_phone", (q) => q.eq("phone", raw))
        .first()
      if (byPhone) {
        return {
          _id: byPhone._id,
          name: byPhone.name,
          documentCpf: byPhone.documentCpf,
          phone: byPhone.phone,
          email: byPhone.email,
        }
      }
    }

    // 3. Fallback limitado para compatibilidade com formatação alternativa
    const samplePatients = await ctx.db.query("patients").take(50)
    const matched = samplePatients.find((p) => {
      const pCpfClean = cleanNumbers(p.documentCpf)
      const pPhoneClean = cleanNumbers(p.phone)

      if (cleanInput.length >= 8) {
        if (pCpfClean === cleanInput || pPhoneClean === cleanInput) return true
        if (pCpfClean.includes(cleanInput) || pPhoneClean.includes(cleanInput)) return true
      }

      if (p.email && p.email.toLowerCase() === raw.toLowerCase()) return true
      if (p.name.toLowerCase() === raw.toLowerCase()) return true

      return false
    })

    if (!matched) return null

    return {
      _id: matched._id,
      name: matched.name,
      documentCpf: matched.documentCpf,
      phone: matched.phone,
      email: matched.email,
    }
  },
})

// 2. Consulta Completa de Dados do Portal do Paciente
export const getPatientPortalData = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    const patient = await ctx.db.get(args.patientId)
    if (!patient) return null

    const settings = await ctx.db.query("clinicSettings").first()
    const noticeHoursRequired = settings?.cancellationNoticeHours ?? 2
    const expiryDays = settings?.replacementExpiryDays ?? 30

    // 2.1. Buscar todas as participacoes do paciente
    const participations = await ctx.db
      .query("scheduleParticipants")
      .withIndex("by_patient", (q) => q.eq("patientId", args.patientId))
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
      .withIndex("by_patient", (q) => q.eq("patientId", args.patientId))
      .collect()

    const enrichedPackages = await Promise.all(
      rawPackages.map(async (pkg) => {
        const pkgDef = await ctx.db.get(pkg.packageId)
        const usagePercentage =
          pkg.totalSessions > 0
            ? Math.round((pkg.usedSessions / pkg.totalSessions) * 100)
            : 0

        return {
          ...pkg,
          packageName: pkgDef?.name || "Plano Altar Fisio",
          packagePrice: pkgDef?.price,
          usagePercentage,
          isLowBalance: pkg.remainingSessions <= 2,
        }
      })
    )

    // 2.3. Creditos de Reposicao
    const replacementCredits = await ctx.db
      .query("replacementCredits")
      .withIndex("by_patient_status", (q) =>
        q.eq("patientId", args.patientId).eq("status", "available")
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
  args: {
    participantId: v.id("scheduleParticipants"),
    patientId: v.id("patients"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const participant = await ctx.db.get(args.participantId)
    if (!participant) throw new Error("Agendamento nao encontrado.")
    if (participant.patientId !== args.patientId) {
      throw new Error("Acesso nao autorizado para este agendamento.")
    }

    const schedule = await ctx.db.get(participant.scheduleId)
    if (!schedule) throw new Error("Sessao nao encontrada.")

    const settings = await ctx.db.query("clinicSettings").first()
    const noticeHoursRequired = settings?.cancellationNoticeHours ?? 2
    const expiryDays = settings?.replacementExpiryDays ?? 30

    const sessionMs = parseDateTimeToMs(schedule.date, schedule.startTime)
    const now = Date.now()
    const hoursNotice = (sessionMs - now) / (1000 * 60 * 60)
    const isWithinPolicy = hoursNotice >= noticeHoursRequired

    if (isWithinPolicy) {
      const expiry = new Date()
      expiry.setDate(expiry.getDate() + expiryDays)
      const expiryStr = expiry.toISOString().split("T")[0]

      // Gera credito de reposicao
      const creditId = await ctx.db.insert("replacementCredits", {
        patientId: args.patientId,
        originScheduleId: schedule._id,
        generatedAt: now,
        expiryDate: expiryStr,
        status: "available",
      })

      // Atualiza participante para falta justificada (libera a vaga para outros)
      const note = args.reason
        ? `Desmarcado pelo aluno (${hoursNotice.toFixed(1)}h antes): ${args.reason}`
        : `Desmarcado pelo aluno (${hoursNotice.toFixed(1)}h antes do inicio)`

      await ctx.db.patch(args.participantId, {
        status: "justified_absence",
        notes: note,
      })

      // Dispara confirmacao via WhatsApp
      const patient = await ctx.db.get(args.patientId)
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
        message: `Sessao desmarcada com sucesso! Geramos 1 credito de reposicao valido ate ${expiryStr}.`,
      }
    } else {
      // Fora do prazo: marca ausencia sem gerar credito
      await ctx.db.patch(args.participantId, {
        status: "absence",
        notes: args.reason
          ? `Desmarcado pelo aluno fora do prazo (${hoursNotice.toFixed(1)}h antes): ${args.reason}`
          : `Desmarcado pelo aluno com menos de ${noticeHoursRequired}h de antecedencia`,
      })

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
  args: {
    participantId: v.id("scheduleParticipants"),
    targetScheduleId: v.id("schedules"),
    patientId: v.id("patients"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const currentPart = await ctx.db.get(args.participantId)
    if (!currentPart) throw new Error("Agendamento atual nao encontrado.")
    if (currentPart.patientId !== args.patientId) {
      throw new Error("Nao autorizado.")
    }

    const currentSchedule = await ctx.db.get(currentPart.scheduleId)
    if (!currentSchedule) throw new Error("Sessao atual nao encontrada.")

    const targetSchedule = await ctx.db.get(args.targetScheduleId)
    if (!targetSchedule) throw new Error("Novo horario selecionado nao encontrado.")

    // Checar capacidade no novo horario
    const existingParts = await ctx.db
      .query("scheduleParticipants")
      .withIndex("by_schedule", (q) => q.eq("scheduleId", args.targetScheduleId))
      .collect()

    const activeParts = existingParts.filter((p) => p.status !== "justified_absence")
    if (activeParts.length >= targetSchedule.maxCapacity) {
      throw new Error("O novo horario selecionado ja preencheu todas as vagas!")
    }

    // 1. Libera o horario antigo
    await ctx.db.patch(args.participantId, {
      status: "justified_absence",
      notes: `Remarcado pelo aluno para ${targetSchedule.date} as ${targetSchedule.startTime}`,
    })

    // 2. Insere no novo horario com o mesmo pacote vinculado (se houver)
    const newPartId = await ctx.db.insert("scheduleParticipants", {
      scheduleId: args.targetScheduleId,
      patientId: args.patientId,
      status: "scheduled",
      patientPackageId: currentPart.patientPackageId,
      notes: `Remarcacao transferida da sessao de ${currentSchedule.date} as ${currentSchedule.startTime}`,
    })

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
  args: {
    creditId: v.id("replacementCredits"),
    targetScheduleId: v.id("schedules"),
    patientId: v.id("patients"),
  },
  handler: async (ctx, args) => {
    const credit = await ctx.db.get(args.creditId)
    if (!credit || credit.status !== "available") {
      throw new Error("Credito de reposicao invalido ou ja utilizado.")
    }
    if (credit.patientId !== args.patientId) {
      throw new Error("Credito pertence a outro paciente.")
    }

    const todayStr = new Date().toISOString().split("T")[0]
    if (credit.expiryDate < todayStr) {
      await ctx.db.patch(args.creditId, { status: "expired" })
      throw new Error("Este credito de reposicao expirou em " + credit.expiryDate)
    }

    const targetSchedule = await ctx.db.get(args.targetScheduleId)
    if (!targetSchedule) throw new Error("Horario nao encontrado.")

    const existingParts = await ctx.db
      .query("scheduleParticipants")
      .withIndex("by_schedule", (q) => q.eq("scheduleId", args.targetScheduleId))
      .collect()

    const activeParts = existingParts.filter((p) => p.status !== "justified_absence")
    if (activeParts.length >= targetSchedule.maxCapacity) {
      throw new Error("Este horario ja atingiu o limite de capacidade!")
    }

    // 1. Marca credito como utilizado
    await ctx.db.patch(args.creditId, {
      status: "used",
      usedInScheduleId: args.targetScheduleId,
    })

    // 2. Insere aluno como status "replacement"
    const partId = await ctx.db.insert("scheduleParticipants", {
      scheduleId: args.targetScheduleId,
      patientId: args.patientId,
      status: "replacement",
      replacementCreditId: args.creditId,
      notes: "Agendamento realizado via credito de reposicao",
    })

    return {
      success: true,
      participantId: partId,
      date: targetSchedule.date,
      startTime: targetSchedule.startTime,
      message: `Reposicao agendada com sucesso para ${targetSchedule.date} as ${targetSchedule.startTime}!`,
    }
  },
})

// 6. Listagem de Vagas Livres para Remarcacao e Reposicao
export const listAvailableSlotsForBooking = query({
  args: {
    specialty: v.union(v.literal("fisioterapia"), v.literal("pilates"), v.literal("rpg")),
    startDate: v.string(), // YYYY-MM-DD
    daysCount: v.optional(v.number()), // Padrao: 14 dias
  },
  handler: async (ctx, args) => {
    const days = args.daysCount || 14
    const result: any[] = []

    const startObj = new Date(`${args.startDate}T12:00:00Z`)

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

        const activeCount = parts.filter((p) => p.status !== "justified_absence").length
        const vacancies = Math.max(0, s.maxCapacity - activeCount)

        if (vacancies > 0) {
          const room = await ctx.db.get(s.roomId)
          const prof = await ctx.db.get(s.professionalId)

          result.push({
            scheduleId: s._id,
            title: s.title,
            date: s.date,
            startTime: s.startTime,
            endTime: s.endTime,
            roomName: room?.name || "Sala",
            professionalName: prof?.name || "Profissional",
            vacanciesLeft: vacancies,
            maxCapacity: s.maxCapacity,
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
export const ensurePatientDemoSchedules = mutation({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    const patient = await ctx.db.get(args.patientId)
    if (!patient) throw new Error("Paciente nao encontrado")

    // Checar se o paciente ja tem agendamentos futuros
    const todayStr = new Date().toISOString().split("T")[0]
    const participations = await ctx.db
      .query("scheduleParticipants")
      .withIndex("by_patient", (q) => q.eq("patientId", args.patientId))
      .collect()

    let hasFuture = false
    for (const part of participations) {
      const sch = await ctx.db.get(part.scheduleId)
      if (sch && sch.date >= todayStr && part.status === "scheduled") {
        hasFuture = true
        break
      }
    }

    if (hasFuture) {
      return { success: true, message: "Paciente ja possui agendamentos futuros." }
    }

    // Criar salas / profissionais se necessario
    const rooms = await ctx.db.query("rooms").collect()
    const profs = await ctx.db.query("professionals").collect()
    const studioRoom = rooms.find((r) => r.type.includes("pilates")) || rooms[0]
    const profCamila = profs.find((p) => p.name.includes("Camila")) || profs[0]

    if (!studioRoom || !profCamila) {
      return { success: false, message: "Salas ou profissionais nao configurados." }
    }

    // Gerar datas para amanha e daqui a 3 dias
    const d1 = new Date()
    d1.setDate(d1.getDate() + 1)
    if (d1.getDay() === 0) d1.setDate(d1.getDate() + 1)
    const date1Str = d1.toISOString().split("T")[0]

    const d2 = new Date()
    d2.setDate(d2.getDate() + 3)
    if (d2.getDay() === 0) d2.setDate(d2.getDate() + 1)
    const date2Str = d2.toISOString().split("T")[0]

    // Criar Sessao 1 (Amanha 09:00 - Pilates)
    const sch1 = await ctx.db.insert("schedules", {
      title: "Pilates Aparelhos - Manha",
      type: "turma",
      specialty: "pilates",
      roomId: studioRoom._id,
      professionalId: profCamila._id,
      date: date1Str,
      startTime: "09:00",
      endTime: "10:00",
      maxCapacity: 4,
      status: "scheduled",
    })

    await ctx.db.insert("scheduleParticipants", {
      scheduleId: sch1,
      patientId: args.patientId,
      status: "scheduled",
    })

    // Criar Sessao 2 (Daqui a 3 dias 16:00 - Pilates)
    const sch2 = await ctx.db.insert("schedules", {
      title: "Pilates Aparelhos - Tarde",
      type: "turma",
      specialty: "pilates",
      roomId: studioRoom._id,
      professionalId: profCamila._id,
      date: date2Str,
      startTime: "16:00",
      endTime: "17:00",
      maxCapacity: 4,
      status: "scheduled",
    })

    await ctx.db.insert("scheduleParticipants", {
      scheduleId: sch2,
      patientId: args.patientId,
      status: "scheduled",
    })

    // Criar Horarios Alternativos com Vagas Livres para Remarcacao
    const dAlt = new Date()
    dAlt.setDate(dAlt.getDate() + 2)
    if (dAlt.getDay() === 0) dAlt.setDate(dAlt.getDate() + 1)
    const altDateStr = dAlt.toISOString().split("T")[0]

    await ctx.db.insert("schedules", {
      title: "Pilates Aparelhos - Turma Vagas Livres",
      type: "turma",
      specialty: "pilates",
      roomId: studioRoom._id,
      professionalId: profCamila._id,
      date: altDateStr,
      startTime: "10:00",
      endTime: "11:00",
      maxCapacity: 4,
      status: "scheduled",
    })

    await ctx.db.insert("schedules", {
      title: "Pilates Aparelhos - Final de Tarde",
      type: "turma",
      specialty: "pilates",
      roomId: studioRoom._id,
      professionalId: profCamila._id,
      date: altDateStr,
      startTime: "17:00",
      endTime: "18:00",
      maxCapacity: 4,
      status: "scheduled",
    })

    // Se o paciente nao tiver credito de reposicao, criar 1 de exemplo
    const existingCredits = await ctx.db
      .query("replacementCredits")
      .withIndex("by_patient_status", (q) =>
        q.eq("patientId", args.patientId).eq("status", "available")
      )
      .collect()

    if (existingCredits.length === 0) {
      const expDate = new Date()
      expDate.setDate(expDate.getDate() + 30)
      await ctx.db.insert("replacementCredits", {
        patientId: args.patientId,
        originScheduleId: sch1,
        generatedAt: Date.now() - 86400000,
        expiryDate: expDate.toISOString().split("T")[0],
        status: "available",
      })
    }

    return {
      success: true,
      message: "Horarios de demonstracao e creditos gerados com sucesso para o paciente!",
    }
  },
})
