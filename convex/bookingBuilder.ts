import { query, mutation } from "./_generated/server"
import { api } from "./_generated/api"
import { v } from "convex/values"

export const DEFAULT_BOOKING_STEPS = [
  {
    id: "step_triagem",
    title: "Triagem & Convênio",
    description: "Informações sobre plano de saúde e histórico para personalizarmos seu atendimento",
    order: 1,
    type: "intake_form" as const,
  },
  {
    id: "step_vaga",
    title: "Sessão & Horário",
    description: "Escolha a especialidade, serviço e o melhor horário disponível na clínica",
    order: 2,
    type: "slot_picker" as const,
  },
  {
    id: "step_dados",
    title: "Seus Dados",
    description: "Preencha suas informações para confirmarmos sua reserva",
    order: 3,
    type: "patient_info" as const,
  },
]

export const DEFAULT_BOOKING_FIELDS = [
  {
    id: "field_has_insurance",
    stepId: "step_triagem",
    label: "Você possui plano ou convênio de saúde?",
    type: "yes_no" as const,
    required: true,
    order: 1,
    helpText: "Atendemos particular e emitimos documentação completa para reembolso de todos os planos",
  },
  {
    id: "field_insurance_name",
    stepId: "step_triagem",
    label: "Qual é o seu plano de saúde / convênio?",
    type: "select" as const,
    options: [
      "Unimed",
      "Bradesco Saúde",
      "SulAmérica",
      "Amil",
      "NotreDame Intermédica",
      "Porto Seguro Saúde",
      "Omint",
      "Cassi",
      "Outro Convênio",
      "Particular (Sem convênio)",
    ],
    required: true,
    order: 2,
    placeholder: "Selecione o seu plano...",
    conditional: {
      dependsOnFieldId: "field_has_insurance",
      equalsValue: "Sim",
    },
  },
  {
    id: "field_insurance_card",
    stepId: "step_triagem",
    label: "Número da carteirinha ou matrícula (opcional)",
    type: "text" as const,
    required: false,
    order: 3,
    placeholder: "Ex: 0054.1234.9876-00",
    conditional: {
      dependsOnFieldId: "field_has_insurance",
      equalsValue: "Sim",
    },
  },
  {
    id: "field_chief_complaint",
    stepId: "step_triagem",
    label: "Qual é a sua queixa principal ou objetivo com o tratamento?",
    type: "textarea" as const,
    required: true,
    order: 4,
    placeholder: "Ex: Sinto dores lombares ao ficar sentado, busco Pilates para postura e fortalecimento, reabilitação pós-cirúrgica...",
    helpText: "Seja o mais específico possível para direcionarmos o profissional mais adequado",
  },
  {
    id: "field_pain_level",
    stepId: "step_triagem",
    label: "Em uma régua de 0 a 10, como você classificaria sua dor hoje?",
    type: "select" as const,
    options: [
      "0 - Sem dor no momento",
      "1 a 3 - Leve (incomoda pouco)",
      "4 a 6 - Moderada (dificulta algumas tarefas)",
      "7 a 8 - Intensa (limita movimentos)",
      "9 a 10 - Insuportável / Crise aguda",
    ],
    required: true,
    order: 5,
  },
  {
    id: "field_has_referral",
    stepId: "step_triagem",
    label: "Você possui encaminhamento ou exame médico recente?",
    type: "yes_no" as const,
    required: false,
    order: 6,
    helpText: "Você poderá trazer no dia da primeira sessão ou enviar por WhatsApp",
  },
]

// 1. Obter configuração do Construtor de Agendamento
export const getBookingConfig = query({
  handler: async (ctx) => {
    const config = await ctx.db.query("bookingFormConfig").first()
    if (!config) {
      return {
        requireApproval: false,
        steps: DEFAULT_BOOKING_STEPS,
        fields: DEFAULT_BOOKING_FIELDS,
        welcomeTitle: "Agende sua Consulta ou Sessão",
        welcomeMessage: "Bem-vindo à Altar Fisio (Dr. Marcelo). Escolha o serviço, tire suas dúvidas e reserve seu horário online com rapidez e comodidade.",
        successMessage: "Seu agendamento foi registrado com sucesso! Entraremos em contato via WhatsApp com os detalhes da sua sessão.",
        updatedAt: Date.now(),
        isDefault: true,
      }
    }
    return {
      ...config,
      isDefault: false,
    }
  },
})

// 2. Atualizar Configuração do Construtor (Painel Admin)
export const updateBookingConfig = mutation({
  args: {
    requireApproval: v.boolean(),
    steps: v.array(
      v.object({
        id: v.string(),
        title: v.string(),
        description: v.optional(v.string()),
        order: v.number(),
        type: v.union(
          v.literal("intake_form"),
          v.literal("slot_picker"),
          v.literal("patient_info")
        ),
      })
    ),
    fields: v.array(
      v.object({
        id: v.string(),
        stepId: v.string(),
        label: v.string(),
        type: v.union(
          v.literal("yes_no"),
          v.literal("select"),
          v.literal("text"),
          v.literal("textarea"),
          v.literal("multiselect")
        ),
        options: v.optional(v.array(v.string())),
        required: v.boolean(),
        order: v.number(),
        placeholder: v.optional(v.string()),
        helpText: v.optional(v.string()),
        conditional: v.optional(
          v.object({
            dependsOnFieldId: v.string(),
            equalsValue: v.string(),
          })
        ),
      })
    ),
    welcomeTitle: v.optional(v.string()),
    welcomeMessage: v.optional(v.string()),
    successMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("bookingFormConfig").first()
    const now = Date.now()

    if (existing) {
      await ctx.db.patch(existing._id, {
        requireApproval: args.requireApproval,
        steps: args.steps,
        fields: args.fields,
        welcomeTitle: args.welcomeTitle,
        welcomeMessage: args.welcomeMessage,
        successMessage: args.successMessage,
        updatedAt: now,
      })
    } else {
      await ctx.db.insert("bookingFormConfig", {
        requireApproval: args.requireApproval,
        steps: args.steps,
        fields: args.fields,
        welcomeTitle: args.welcomeTitle,
        welcomeMessage: args.welcomeMessage,
        successMessage: args.successMessage,
        updatedAt: now,
      })
    }

    // Registra trilha de auditoria
    await ctx.db.insert("auditLogs", {
      action: "update_booking_builder",
      userName: "Administrador",
      userRole: "admin",
      details: `Configuração do construtor de agendamento atualizada (${args.steps.length} etapas, ${args.fields.length} campos, aprovação manual: ${args.requireApproval ? "Sim" : "Não"})`,
      timestamp: now,
    })

    return { success: true }
  },
})

// 3. Restaurar Perguntas Padrão da Clínica
export const resetBookingConfigToDefault = mutation({
  handler: async (ctx) => {
    const existing = await ctx.db.query("bookingFormConfig").first()
    const now = Date.now()

    const defaultData = {
      requireApproval: false,
      steps: DEFAULT_BOOKING_STEPS,
      fields: DEFAULT_BOOKING_FIELDS,
      welcomeTitle: "Agende sua Consulta ou Sessão",
      welcomeMessage: "Bem-vindo à Altar Fisio (Dr. Marcelo). Escolha o serviço, tire suas dúvidas e reserve seu horário online com rapidez e comodidade.",
      successMessage: "Seu agendamento foi registrado com sucesso! Entraremos em contato via WhatsApp com os detalhes da sua sessão.",
      updatedAt: now,
    }

    if (existing) {
      await ctx.db.patch(existing._id, defaultData)
    } else {
      await ctx.db.insert("bookingFormConfig", defaultData)
    }

    await ctx.db.insert("auditLogs", {
      action: "reset_booking_builder",
      userName: "Administrador",
      userRole: "admin",
      details: "Configuração do construtor de agendamento restaurada para o padrão clínico",
      timestamp: now,
    })

    return { success: true }
  },
})

// 4. Listar Horários Públicos Disponíveis para uma Data e Serviço
export const listPublicAvailableSlots = query({
  args: {
    date: v.string(), // YYYY-MM-DD
    specialty: v.optional(v.union(v.literal("pilates"), v.literal("fisioterapia"), v.literal("rpg"))),
    professionalId: v.optional(v.id("professionals")),
  },
  handler: async (ctx, args) => {
    // Busca salas ativas
    const rooms = await ctx.db
      .query("rooms")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect()

    // Busca profissionais ativos
    let professionals = await ctx.db
      .query("professionals")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect()

    if (args.professionalId) {
      professionals = professionals.filter((p) => p._id === args.professionalId)
    } else if (args.specialty) {
      const specFilter = args.specialty.toLowerCase()
      professionals = professionals.filter((p) =>
        p.specialties.some((s) => s.toLowerCase().includes(specFilter))
      )
    }

    // Busca agendamentos existentes no dia
    const existingSchedules = await ctx.db
      .query("schedules")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .collect()

    // Busca participantes de cada agendamento
    const schedulesWithParticipants = await Promise.all(
      existingSchedules.map(async (sch) => {
        const participants = await ctx.db
          .query("scheduleParticipants")
          .withIndex("by_schedule", (q) => q.eq("scheduleId", sch._id))
          .collect()
        return {
          ...sch,
          currentParticipantsCount: participants.filter((p) => p.status !== "absence").length,
        }
      })
    )

    // Horários padrão de atendimento da clínica (07:00 até 20:00)
    const timeSlots = [
      { start: "07:00", end: "07:55" },
      { start: "08:00", end: "08:55" },
      { start: "09:00", end: "09:55" },
      { start: "10:00", end: "10:55" },
      { start: "11:00", end: "11:55" },
      { start: "14:00", end: "14:55" },
      { start: "15:00", end: "15:55" },
      { start: "16:00", end: "16:55" },
      { start: "17:00", end: "17:55" },
      { start: "18:00", end: "18:55" },
      { start: "19:00", end: "19:55" },
    ]

    const slotsResult = timeSlots.map((slot) => {
      // Verifica se já existem turmas ou agendamentos nesse horário
      const schedulesAtTime = schedulesWithParticipants.filter(
        (s) => s.startTime === slot.start && s.status !== "cancelled"
      )

      // Salas compatíveis com a especialidade
      let compatibleRooms = rooms
      if (args.specialty === "pilates") {
        compatibleRooms = rooms.filter(
          (r) => r.type === "pilates_aparelhos" || r.type === "pilates_solo"
        )
      } else if (args.specialty === "rpg") {
        compatibleRooms = rooms.filter((r) => r.type === "rpg")
      } else if (args.specialty === "fisioterapia") {
        compatibleRooms = rooms.filter(
          (r) => r.type === "fisioterapia" || r.type === "consultorio"
        )
      }

      // Procura salas com vagas restantes
      const availableRoomsWithSpots = compatibleRooms.map((room) => {
        const scheduleInRoom = schedulesAtTime.find((s) => s.roomId === room._id)
        if (!scheduleInRoom) {
          return {
            roomId: room._id,
            roomName: room.name,
            capacity: room.capacity,
            occupied: 0,
            availableSpots: room.capacity,
            existingScheduleId: null,
          }
        }
        const occupied = scheduleInRoom.currentParticipantsCount
        const spots = Math.max(0, room.capacity - occupied)
        return {
          roomId: room._id,
          roomName: room.name,
          capacity: room.capacity,
          occupied,
          availableSpots: spots,
          existingScheduleId: scheduleInRoom._id,
        }
      })

      const totalSpots = availableRoomsWithSpots.reduce((acc, r) => acc + r.availableSpots, 0)
      const hasRoomAvailable = availableRoomsWithSpots.some((r) => r.availableSpots > 0)
      const hasProfAvailable = professionals.length > 0

      return {
        startTime: slot.start,
        endTime: slot.end,
        isAvailable: hasRoomAvailable && hasProfAvailable && totalSpots > 0,
        totalAvailableSpots: totalSpots,
        rooms: availableRoomsWithSpots.filter((r) => r.availableSpots > 0),
        availableProfessionals: professionals.map((p) => ({
          id: p._id,
          name: p.name,
          specialties: p.specialties,
        })),
      }
    })

    return slotsResult
  },
})

// 5. Submeter Agendamento Público (Realizado pelo Paciente na Página /agendar)
export const submitPublicBooking = mutation({
  args: {
    name: v.string(),
    documentCpf: v.string(),
    phone: v.string(),
    email: v.optional(v.string()),
    birthDate: v.string(),
    serviceId: v.optional(v.id("services")),
    professionalId: v.optional(v.id("professionals")),
    roomId: v.optional(v.id("rooms")),
    date: v.string(), // YYYY-MM-DD
    startTime: v.string(),
    endTime: v.string(),
    specialty: v.optional(v.union(v.literal("pilates"), v.literal("fisioterapia"), v.literal("rpg"))),
    answers: v.array(
      v.object({
        questionId: v.string(),
        questionLabel: v.string(),
        answer: v.string(),
      })
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now()

    // 1. Busca ou cadastra o paciente pelo CPF ou Telefone
    const cleanCpf = args.documentCpf.replace(/\D/g, "")
    const cleanPhone = args.phone.replace(/\D/g, "")

    let patient = await ctx.db
      .query("patients")
      .withIndex("by_cpf", (q) => q.eq("documentCpf", cleanCpf))
      .first()

    if (!patient) {
      const patientId = await ctx.db.insert("patients", {
        name: args.name.trim(),
        documentCpf: cleanCpf,
        phone: cleanPhone,
        email: args.email?.trim() || undefined,
        birthDate: args.birthDate,
        active: true,
        notes: `Cadastrado via Agendamento Online em ${new Date(now).toLocaleDateString("pt-BR")}. ${args.notes || ""}`,
        createdAt: now,
      })
      patient = await ctx.db.get(patientId)
    }

    if (!patient) {
      throw new Error("Erro ao registrar os dados do paciente.")
    }

    // 2. Consulta configuração do construtor para verificar aprovação necessária
    const config = await ctx.db.query("bookingFormConfig").first()
    const requireApproval = config?.requireApproval ?? false
    const initialStatus = requireApproval ? "pending_approval" : "confirmed"

    let assignedScheduleId: any = undefined

    // 3. Se for auto-confirmação, aloca ou cria o agendamento no sistema
    if (!requireApproval) {
      // Localiza sala e profissional adequados
      let roomId = args.roomId
      let profId = args.professionalId

      if (!roomId) {
        const rooms = await ctx.db.query("rooms").collect()
        const matchedRoom = rooms.find((r) =>
          args.specialty === "pilates"
            ? r.type.includes("pilates")
            : args.specialty === "rpg"
            ? r.type === "rpg"
            : true
        )
        roomId = matchedRoom?._id || rooms[0]?._id
      }

      if (!profId) {
        const profs = await ctx.db.query("professionals").collect()
        profId = profs[0]?._id
      }

      if (roomId && profId) {
        // Procura turma/sessão existente no mesmo horário e sala
        const existingSchedule = await ctx.db
          .query("schedules")
          .withIndex("by_room_date", (q) => q.eq("roomId", roomId!).eq("date", args.date))
          .filter((q) => q.eq(q.field("startTime"), args.startTime))
          .first()

        if (existingSchedule) {
          assignedScheduleId = existingSchedule._id
          // Adiciona participante
          await ctx.db.insert("scheduleParticipants", {
            scheduleId: existingSchedule._id,
            patientId: patient._id,
            status: "scheduled",
            notes: "Agendamento realizado via Portal Público",
          })
        } else {
          // Cria novo agendamento
          const specialty = args.specialty || "fisioterapia"
          const room = await ctx.db.get(roomId)
          const newScheduleId = await ctx.db.insert("schedules", {
            title: specialty === "pilates" ? "Pilates Studio (Online)" : "Atendimento Fisioterapia (Online)",
            type: specialty === "pilates" ? "turma" : "individual",
            specialty,
            roomId,
            professionalId: profId,
            date: args.date,
            startTime: args.startTime,
            endTime: args.endTime,
            maxCapacity: room?.capacity || 1,
            status: "scheduled",
            notes: `Agendado via Portal Público pelo paciente ${args.name}`,
          })

          await ctx.db.insert("scheduleParticipants", {
            scheduleId: newScheduleId,
            patientId: patient._id,
            status: "scheduled",
            notes: "Agendamento online",
          })

          assignedScheduleId = newScheduleId
        }
      }
    }

    // 4. Salva a submissão do agendamento público com as respostas da triagem
    const publicBookingId = await ctx.db.insert("publicBookings", {
      patientId: patient._id,
      scheduleId: assignedScheduleId,
      status: initialStatus,
      serviceId: args.serviceId,
      professionalId: args.professionalId,
      roomId: args.roomId,
      date: args.date,
      startTime: args.startTime,
      endTime: args.endTime,
      answers: args.answers,
      notes: args.notes,
      createdAt: now,
    })

    // 5. Cria log/alerta interno para a recepção da clínica
    await ctx.db.insert("notificationLogs", {
      channel: "whatsapp_uazapi",
      recipientName: "Recepção Altar Fisio",
      recipientContact: args.phone,
      triggerType: "agendamento_online",
      content: `O paciente ${args.name} (${args.phone}) agendou para ${args.date} às ${args.startTime}. Status: ${initialStatus}`,
      status: "sent",
      timestamp: now,
    })

    // 6. Envia confirmação WhatsApp para o paciente caso agendado
    if (patient.phone && !requireApproval) {
      const room = args.roomId ? await ctx.db.get(args.roomId) : null
      const prof = args.professionalId ? await ctx.db.get(args.professionalId) : null
      const serviceTitle =
        args.specialty === "pilates"
          ? "Pilates Studio"
          : args.specialty === "rpg"
          ? "RPG"
          : "Fisioterapia"

      await ctx.scheduler.runAfter(0, api.notifications.sendScheduleConfirmationAction, {
        patientName: patient.name,
        phone: patient.phone,
        serviceName: serviceTitle,
        professionalName: prof?.name || "Dr(a). Fisioterapeuta",
        date: args.date,
        startTime: args.startTime,
        endTime: args.endTime,
        roomName: room?.name || "Unidade Principal",
      })
    }

    // 7. Registra na trilha de auditoria
    await ctx.db.insert("auditLogs", {
      action: "public_booking_created",
      userName: args.name,
      userRole: "patient",
      patientId: patient._id,
      patientName: args.name,
      details: `Agendamento público criado por ${args.name} para ${args.date} às ${args.startTime} (Status: ${initialStatus})`,
      timestamp: now,
    })

    return {
      success: true,
      bookingId: publicBookingId,
      patientId: patient._id,
      status: initialStatus,
      requireApproval,
      scheduledDate: args.date,
      scheduledTime: args.startTime,
      patientName: args.name,
    }
  },
})

// 6. Listar Agendamentos Públicos (Para a Recepção e Administração)
export const listPublicBookings = query({
  args: {
    status: v.optional(
      v.union(v.literal("pending_approval"), v.literal("confirmed"), v.literal("rejected"), v.literal("all"))
    ),
  },
  handler: async (ctx, args) => {
    let bookings
    if (args.status && args.status !== "all") {
      bookings = await ctx.db
        .query("publicBookings")
        .withIndex("by_status_created", (q) => q.eq("status", args.status as any))
        .order("desc")
        .take(50)
    } else {
      bookings = await ctx.db
        .query("publicBookings")
        .order("desc")
        .take(50)
    }

    const enriched = await Promise.all(
      bookings.map(async (b) => {
        const patient = await ctx.db.get(b.patientId)
        const professional = b.professionalId ? await ctx.db.get(b.professionalId) : null
        const room = b.roomId ? await ctx.db.get(b.roomId) : null
        const service = b.serviceId ? await ctx.db.get(b.serviceId) : null

        return {
          ...b,
          patientName: patient?.name || "Paciente",
          patientPhone: patient?.phone || "",
          patientCpf: patient?.documentCpf || "",
          professionalName: professional?.name || "Qualquer Profissional",
          roomName: room?.name || "Sala Principal",
          serviceName: service?.name || "Atendimento",
        }
      })
    )

    return enriched
  },
})

// 7. Atualizar Status do Agendamento Público (Aprovar / Rejeitar pela Recepção)
export const updatePublicBookingStatus = mutation({
  args: {
    bookingId: v.id("publicBookings"),
    status: v.union(v.literal("confirmed"), v.literal("rejected")),
    rejectionReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const booking = await ctx.db.get(args.bookingId)
    if (!booking) {
      throw new Error("Agendamento público não encontrado.")
    }

    const now = Date.now()

    if (args.status === "confirmed" && !booking.scheduleId) {
      // Cria a sessão na agenda se ainda não estava vinculada
      const patient = await ctx.db.get(booking.patientId)
      const rooms = await ctx.db.query("rooms").collect()
      const profs = await ctx.db.query("professionals").collect()

      const roomId = booking.roomId || rooms[0]?._id
      const profId = booking.professionalId || profs[0]?._id

      if (roomId && profId) {
        const room = await ctx.db.get(roomId)
        const newScheduleId = await ctx.db.insert("schedules", {
          title: "Atendimento Clínico (Aprovado Online)",
          type: "individual",
          specialty: "fisioterapia",
          roomId,
          professionalId: profId,
          date: booking.date,
          startTime: booking.startTime,
          endTime: booking.endTime,
          maxCapacity: room?.capacity || 1,
          status: "scheduled",
          notes: `Aprovado pela recepção. Paciente: ${patient?.name}`,
        })

        await ctx.db.insert("scheduleParticipants", {
          scheduleId: newScheduleId,
          patientId: booking.patientId,
          status: "scheduled",
          notes: "Agendamento online aprovado pela equipe",
        })

        await ctx.db.patch(args.bookingId, {
          status: "confirmed",
          scheduleId: newScheduleId,
        })
      }
    } else {
      await ctx.db.patch(args.bookingId, {
        status: args.status,
        rejectionReason: args.rejectionReason,
      })
    }

    await ctx.db.insert("auditLogs", {
      action: `public_booking_${args.status}`,
      userName: "Recepção / Administrador",
      userRole: "admin",
      patientId: booking.patientId,
      details: `Agendamento online para ${booking.date} às ${booking.startTime} marcado como ${args.status}`,
      timestamp: now,
    })

    return { success: true }
  },
})
