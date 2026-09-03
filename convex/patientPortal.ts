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

// 1.1. Pacientes de Demonstracao Dinamicos (para testes rapidos sem IDs fixos entre ambientes)
export const getDemoPatients = query({
  args: {},
  handler: async (ctx) => {
    const samplePatients = await ctx.db
      .query("patients")
      .withIndex("by_active", (q) => q.eq("active", true))
      .take(4)

    return Promise.all(
      samplePatients.map(async (p) => {
        const activePkg = await ctx.db
          .query("patientPackages")
          .withIndex("by_patient", (q) => q.eq("patientId", p._id))
          .filter((q) => q.eq(q.field("status"), "active"))
          .first()

        let planDesc = "Aluno Cadastrado"
        if (activePkg) {
          const pkgDef = await ctx.db.get(activePkg.packageId)
          planDesc = `${pkgDef?.name || "Plano Ativo"} (${activePkg.remainingSessions} sessões)`
        }

        const nameParts = p.name.trim().split(/\s+/)
        const initials =
          nameParts.length >= 2
            ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
            : (p.name.slice(0, 2) || "AL").toUpperCase()

        return {
          _id: p._id,
          name: p.name,
          documentCpf: p.documentCpf,
          phone: p.phone,
          planDesc,
          initials,
        }
      })
    )
  },
})

// 2. Consulta Completa de Dados do Portal do Paciente
export const getPatientPortalData = query({
  args: { patientId: v.string() },
  handler: async (ctx, args) => {
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
  args: {
    participantId: v.string(),
    patientId: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const normParticipantId = ctx.db.normalizeId("scheduleParticipants", args.participantId)
    if (!normParticipantId) throw new Error("Agendamento nao encontrado.")
    const normPatientId = ctx.db.normalizeId("patients", args.patientId)
    if (!normPatientId) throw new Error("Paciente nao encontrado.")

    const participant = await ctx.db.get(normParticipantId)
    if (!participant) throw new Error("Agendamento nao encontrado.")
    if (participant.patientId !== normPatientId) {
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

      // Dispara confirmacao via WhatsApp
      const patient = await ctx.db.get(normPatientId)
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
      await ctx.db.patch(normParticipantId, {
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
    participantId: v.string(),
    targetScheduleId: v.string(),
    patientId: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const normParticipantId = ctx.db.normalizeId("scheduleParticipants", args.participantId)
    if (!normParticipantId) throw new Error("Agendamento atual nao encontrado.")
    const normTargetScheduleId = ctx.db.normalizeId("schedules", args.targetScheduleId)
    if (!normTargetScheduleId) throw new Error("Novo horario selecionado nao encontrado.")
    const normPatientId = ctx.db.normalizeId("patients", args.patientId)
    if (!normPatientId) throw new Error("Paciente nao autorizado.")

    const currentPart = await ctx.db.get(normParticipantId)
    if (!currentPart) throw new Error("Agendamento atual nao encontrado.")
    if (currentPart.patientId !== normPatientId) {
      throw new Error("Nao autorizado.")
    }

    const currentSchedule = await ctx.db.get(currentPart.scheduleId)
    if (!currentSchedule) throw new Error("Sessao atual nao encontrada.")

    const targetSchedule = await ctx.db.get(normTargetScheduleId)
    if (!targetSchedule) throw new Error("Novo horario selecionado nao encontrado.")

    // Checar capacidade no novo horario
    const existingParts = await ctx.db
      .query("scheduleParticipants")
      .withIndex("by_schedule", (q) => q.eq("scheduleId", normTargetScheduleId))
      .collect()

    const activeParts = existingParts.filter((p) => p.status !== "justified_absence")
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
    creditId: v.string(),
    targetScheduleId: v.string(),
    patientId: v.string(),
  },
  handler: async (ctx, args) => {
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

    const todayStr = new Date().toISOString().split("T")[0]
    if (credit.expiryDate < todayStr) {
      await ctx.db.patch(normCreditId, { status: "expired" })
      throw new Error("Este credito de reposicao expirou em " + credit.expiryDate)
    }

    const targetSchedule = await ctx.db.get(normTargetScheduleId)
    if (!targetSchedule) throw new Error("Horario nao encontrado.")

    const existingParts = await ctx.db
      .query("scheduleParticipants")
      .withIndex("by_schedule", (q) => q.eq("scheduleId", normTargetScheduleId))
      .collect()

    const activeParts = existingParts.filter((p) => p.status !== "justified_absence")
    if (activeParts.length >= targetSchedule.maxCapacity) {
      throw new Error("Este horario ja atingiu o limite de capacidade!")
    }

    // 1. Marca credito como utilizado
    await ctx.db.patch(normCreditId, {
      status: "used",
      usedInScheduleId: normTargetScheduleId,
    })

    // 2. Insere aluno como status "replacement"
    const partId = await ctx.db.insert("scheduleParticipants", {
      scheduleId: normTargetScheduleId,
      patientId: normPatientId,
      status: "replacement",
      replacementCreditId: normCreditId,
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

// 6. Listagem de Vagas Livres para Agendamento, Remarcacao e Reposicao
export const listAvailableSlotsForBooking = query({
  args: {
    specialty: v.union(v.literal("fisioterapia"), v.literal("pilates"), v.literal("rpg")),
    startDate: v.string(), // YYYY-MM-DD
    daysCount: v.optional(v.number()), // Padrao: 14 dias
    patientId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const days = args.daysCount || 14
    const result: any[] = []

    const startObj = new Date(`${args.startDate}T12:00:00Z`)
    const normPatientId = args.patientId ? ctx.db.normalizeId("patients", args.patientId) : null

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
export const ensurePatientDemoSchedules = mutation({
  args: { patientId: v.string() },
  handler: async (ctx, args) => {
    const normPatientId = ctx.db.normalizeId("patients", args.patientId)
    if (!normPatientId) return { success: false, message: "Paciente nao encontrado" }

    const patient = await ctx.db.get(normPatientId)
    if (!patient) return { success: false, message: "Paciente nao encontrado" }

    // Checar se o paciente ja tem agendamentos futuros
    const todayStr = new Date().toISOString().split("T")[0]
    const participations = await ctx.db
      .query("scheduleParticipants")
      .withIndex("by_patient", (q) => q.eq("patientId", normPatientId))
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

    // Se o paciente tiver pacote ativo, vincula nas sessoes de demonstracao
    const activePkg = await ctx.db
      .query("patientPackages")
      .withIndex("by_patient", (q) => q.eq("patientId", normPatientId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first()

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
      patientId: normPatientId,
      status: "scheduled",
      patientPackageId: activePkg?._id,
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
      patientId: normPatientId,
      status: "scheduled",
      patientPackageId: activePkg?._id,
    })

    // Criar Horarios Alternativos com Vagas Livres para Agendamento e Remarcacao
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
        q.eq("patientId", normPatientId).eq("status", "available")
      )
      .collect()

    if (existingCredits.length === 0) {
      const expDate = new Date()
      expDate.setDate(expDate.getDate() + 30)
      await ctx.db.insert("replacementCredits", {
        patientId: normPatientId,
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

// 8. Novo Agendamento pelo Aluno (Consumindo Saldo do Pacote Ativo com Smart Allocation)
export const bookAppointmentFromPortal = mutation({
  args: {
    patientId: v.string(),
    patientPackageId: v.string(),
    scheduleId: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
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
      await ctx.scheduler.runAfter(0, api.notifications.sendScheduleConfirmationAction, {
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
