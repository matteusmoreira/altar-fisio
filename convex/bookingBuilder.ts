import { bookingConfirmationValidator } from "./lib/bookingConfirmation"
import { DEFAULT_CONFIRMATION } from "../shared/bookingConfirmation"
import { DEFAULT_INSURANCE_PARTNERS } from "../shared/bookingInsurance"
import { validDate } from './lib/validation'
import { hashToken, requireStaff } from './lib/security'
import { query, mutation, action, internalMutation } from "./_generated/server"
import { credentialFields, ensurePatientCredential, findPatients } from './lib/patientCredentials'
import { isValidCpf, isValidPhone, normalizeCpf, normalizePhone } from '../shared/patientIdentity'
import type { Id, Doc } from './_generated/dataModel'
import { api, internal } from "./_generated/api"
import { v, ConvexError } from "convex/values"
import { getPublicSlots, resolveBookingService } from './lib/bookingSlots'
import { bookGroupSession } from './lib/bookGroupSession'

export const DEFAULT_BOOKING_STEPS = [
  {
    id: "step_triagem",
    title: "Triagem Inicial",
    description: "Conte sobre seu objetivo e histórico para personalizarmos seu atendimento",
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

export const DEFAULT_BOOKING_FIELDS: Doc<"bookingFormConfig">["fields"] = [
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
        confirmation: DEFAULT_CONFIRMATION,
        requireApproval: false,
        insurancePartners: DEFAULT_INSURANCE_PARTNERS,
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
      insurancePartners: config.insurancePartners ?? DEFAULT_INSURANCE_PARTNERS,
      isDefault: false,
    }
  },
})

// 2. Atualizar Configuração do Construtor (Painel Admin)
export const updateBookingConfig = mutation({
  args: { sessionToken: v.string(),
    confirmation: v.optional(bookingConfirmationValidator),
    requireApproval: v.boolean(),
    insurancePartners: v.optional(v.array(v.object({ id: v.string(), name: v.string(), logo: v.optional(v.string()) }))),
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
  handler: async (ctx, input) => {
    const { sessionToken, ...args } = input
    const actor = await requireStaff(ctx, sessionToken, ["admin","reception"]);

    const existing = await ctx.db.query("bookingFormConfig").first()
    for (const type of ["slot_picker", "patient_info"]) {
      if (args.steps.filter(step => step.type === type).length !== 1) throw new ConvexError("Mantenha uma etapa de horário e uma de dados pessoais.")
    }
    if (new Set(args.steps.map(step => step.id)).size !== args.steps.length || args.steps.some(step => !step.title.trim())) throw new ConvexError("Etapas inválidas.")
    if (args.fields.some(field => !args.steps.some(step => step.id === field.stepId && step.type === "intake_form"))) throw new ConvexError("Selecione uma etapa de perguntas válida.")
    const fieldIds = new Set(args.fields.map(field => field.id))
    if (args.fields.some(field => field.conditional && (!fieldIds.has(field.conditional.dependsOnFieldId) || field.conditional.dependsOnFieldId === field.id))) throw new ConvexError("Revise as condições das perguntas.")
    if (args.insurancePartners) {
      if (JSON.stringify(args.insurancePartners).length > 600000) throw new ConvexError("As logos excedem 600 KB no total. Use imagens menores ou URLs HTTPS.")
      if (args.insurancePartners.length > 30 || new Set(args.insurancePartners.map(p => p.id)).size !== args.insurancePartners.length) throw new ConvexError("Lista de convênios inválida (máximo 30).")
      for (const partner of args.insurancePartners) {
        if (!partner.id.trim() || !partner.name.trim() || partner.name === "Outro") throw new ConvexError("Informe o nome do convênio.")
        if (partner.logo && (partner.logo.length > 220000 || !/^(https:\/\/|\/assets\/convenios\/|data:image\/(png|jpeg|webp);base64,)/.test(partner.logo))) throw new ConvexError("Use uma imagem PNG, JPG, WebP ou URL HTTPS válida (até 150 KB).")
      }
    }
    if (args.confirmation && Object.entries(args.confirmation).some(([key, value]) => typeof value === "string" && (value.length > 2000 || (key !== "address" && !value.trim())))) throw new ConvexError("Preencha os textos da confirmação com até 2000 caracteres.")
    const now = Date.now()

    if (existing) {
      await ctx.db.patch(existing._id, {
        confirmation: args.confirmation ?? existing?.confirmation,
        requireApproval: args.requireApproval,
        insurancePartners: args.insurancePartners ?? existing?.insurancePartners ?? DEFAULT_INSURANCE_PARTNERS,
        steps: args.steps,
        fields: args.fields,
        welcomeTitle: args.welcomeTitle,
        welcomeMessage: args.welcomeMessage,
        successMessage: args.successMessage,
        updatedAt: now,
      })
    } else {
      await ctx.db.insert("bookingFormConfig", {
        confirmation: args.confirmation,
        requireApproval: args.requireApproval,
        insurancePartners: args.insurancePartners ?? DEFAULT_INSURANCE_PARTNERS,
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
      userRole: actor.role,
      details: `Configuração do construtor de agendamento atualizada (${args.steps.length} etapas, ${args.fields.length} campos, aprovação manual: ${args.requireApproval ? "Sim" : "Não"})`,
      timestamp: now,
    })

    return { success: true }
  },
})

// 3. Restaurar Perguntas Padrão da Clínica
export const resetBookingConfigToDefault = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, input) => {
    const { sessionToken, ...args } = input
    await requireStaff(ctx, sessionToken, ["admin","reception"]);

    const existing = await ctx.db.query("bookingFormConfig").first()
    const now = Date.now()

    const defaultData = {
      confirmation: DEFAULT_CONFIRMATION,
      requireApproval: false,
      insurancePartners: DEFAULT_INSURANCE_PARTNERS,
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
    serviceId: v.optional(v.id("services")),
    packageId: v.optional(v.id("packages")),
  },
  handler: async (ctx, args) => {
    const service = await resolveBookingService(ctx, args)
    if (!service?.isEvaluation || service.modality !== 'individual') return []
    return getPublicSlots(ctx, args)
  },
})

// 4.1 Listar Pacotes e Planos Ativos para Agendamento Público
export const listPublicPackages = query({
  handler: async (ctx) => {
    const packages = await ctx.db.query("packages").collect()
    const activePublicPackages = packages.filter(
      (pkg) => pkg.active && pkg.showInPublicBooking !== false
    )

    const publicPackages = await Promise.all(
      activePublicPackages.map(async (pkg) => {
        const service = await ctx.db.get(pkg.serviceId)
        if (!service?.active || !service.isEvaluation || service.modality !== 'individual') return null
        return {
          ...pkg,
          serviceName: service?.name || "Serviço",
          modality: service?.modality || "turma",
          specialty: service?.specialty || "pilates",
          durationMinutes: service?.durationMinutes || 55,
          pricePerSession: pkg.sessionCount > 0 ? Number((pkg.price / pkg.sessionCount).toFixed(2)) : 0,
        }
      })
    )
    return publicPackages.filter(pkg => pkg !== null)
  },
})

// 5. Submeter Agendamento Público (Realizado pelo Paciente na Página /agendar)
const publicBookingArgs = {
    requestId: v.optional(v.string()),
    name: v.string(),
    documentCpf: v.string(),
    phone: v.string(),
    email: v.optional(v.string()),
    birthDate: v.string(),
    serviceId: v.optional(v.id("services")),
    packageId: v.optional(v.id("packages")),
    packageName: v.optional(v.string()),
    hasHealthInsurance: v.optional(v.boolean()),
    healthInsuranceName: v.optional(v.string()),
    selectedPrice: v.optional(v.number()),
    selectedPaymentMethod: v.optional(v.string()), // "pix" | "cartao"
    pricingDetails: v.optional(v.string()),
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
  }
export const submitPublicBooking = action({
  args: publicBookingArgs,
  handler: async (ctx, args): Promise<{ success: boolean; bookingId: Id<'publicBookings'>; patientId: Id<'patients'>; status: string; requireApproval: boolean; scheduledDate: string; scheduledTime: string; patientName: string; portalAccessCreated: boolean }> => {
    if (!isValidCpf(args.documentCpf) || !isValidPhone(args.phone)) throw new ConvexError('CPF ou telefone inválido.')
    await ctx.runMutation(internal.portalAccess.reserveAttempt, { key: 'booking:' + normalizePhone(args.phone) })
    const credential = await ctx.runAction(internal.portalAuth.prepareDefault, {})
    return ctx.runMutation(internal.bookingBuilder.persistPublicBooking, { ...args, credential })
  },
})
export const persistPublicBooking = internalMutation({
  args: { ...publicBookingArgs, credential: v.object(credentialFields) },
  handler: async (ctx, args) => {
    const { credential: _credential, requestId, ...request } = args
    if (requestId && !/^[0-9a-f-]{36}$/i.test(requestId)) throw new ConvexError('Solicitação inválida. Atualize a página.')
    const fingerprint = requestId ? await hashToken(JSON.stringify(request)) : undefined
    if (requestId) {
      const receipt = await ctx.db.query('publicBookingReceipts').withIndex('by_request', q => q.eq('requestId', requestId)).unique()
      if (receipt) {
        if (receipt.fingerprint !== fingerprint) throw new ConvexError('Esta solicitação já foi utilizada. Atualize a página para fazer outro agendamento.')
        return receipt.result
      }
    }
    const evaluation = await resolveBookingService(ctx, args)
    if (!evaluation?.isEvaluation || evaluation.modality !== 'individual') throw new ConvexError('O agendamento público aceita somente avaliação individual. Tratamentos são reservados no portal do paciente.')
    const now = Date.now()
    validDate(args.date); validDate(args.birthDate)
    if (!args.name.trim() || args.name.length > 200 || args.answers.length > 50 || args.answers.some(a => a.answer.length > 5000) || (args.notes?.length || 0) > 5000) throw new ConvexError('Dados de agendamento inválidos.')
    if (!isValidCpf(args.documentCpf) || !isValidPhone(args.phone)) throw new ConvexError('CPF ou telefone inválido.')
    if (new Date(args.date + 'T' + args.startTime + ':00-03:00').getTime() <= now) throw new ConvexError('Selecione um horário futuro.')
    if (args.packageId) {
      const pkg = await ctx.db.get(args.packageId)
      if (!pkg?.active || pkg.showInPublicBooking === false) throw new ConvexError('Plano indisponível.')
      const service = await ctx.db.get(pkg.serviceId)
      if (!service?.active) throw new ConvexError('Serviço indisponível.')
      args.serviceId = pkg.serviceId; args.packageName = pkg.name; args.specialty = service.specialty
      args.selectedPrice = args.hasHealthInsurance ? (args.selectedPaymentMethod === 'pix' ? pkg.insurancePricePix ?? pkg.insurancePrice ?? 0 : pkg.insurancePrice ?? 0) : (args.selectedPaymentMethod === 'pix' ? pkg.pricePix ?? pkg.price : pkg.price)
    } else if (args.serviceId) {
      const service = await ctx.db.get(args.serviceId)
      if (!service?.active) throw new ConvexError('Serviço indisponível.')
      args.selectedPrice = args.hasHealthInsurance ? 0 : service.defaultPrice; args.specialty = service.specialty
    } else { args.selectedPrice = undefined }

    const slots = await getPublicSlots(ctx, args)
    const selected = slots.find(slot => slot.startTime === args.startTime && slot.endTime === args.endTime && slot.isAvailable)
    const selectedRoom = selected?.rooms.find(room => (!args.roomId || room.roomId === args.roomId) && (!args.professionalId || room.professionalId === args.professionalId))
    if (!selectedRoom) throw new ConvexError('Horário indisponível. Atualize a agenda e selecione novamente.')
    args.roomId = selectedRoom.roomId
    args.professionalId = selectedRoom.professionalId
    args.specialty = selectedRoom.specialty

    // 1. Busca ou cadastra o paciente pelo CPF ou Telefone
    const cleanCpf = normalizeCpf(args.documentCpf)
    const cleanPhone = normalizePhone(args.phone)

    const matches = await findPatients(ctx, 'cpf', cleanCpf)
    if (matches.length > 1 || (matches.length === 1 && !matches[0].active)) throw new ConvexError('Procure a clínica para conferir seu cadastro.')
    let patient: Doc<'patients'> | null = matches[0] ?? null

    const insuranceToSave = args.hasHealthInsurance
      ? args.healthInsuranceName || "Com Convênio"
      : "Particular"

    if (!patient) {
      const patientId = await ctx.db.insert("patients", {
        name: args.name.trim(),
        documentCpf: cleanCpf,
        phone: cleanPhone,
        normalizedCpf: cleanCpf,
        normalizedPhone: cleanPhone,
        email: args.email?.trim() || undefined,
        birthDate: args.birthDate,
        healthInsurance: insuranceToSave,
        active: true,
        notes: `Cadastrado via Agendamento Online em ${new Date(now).toLocaleDateString("pt-BR")}. ${args.notes || ""}`,
        createdAt: now,
      })
      patient = await ctx.db.get(patientId)
    }

    if (!patient) {
      throw new ConvexError("Erro ao registrar os dados do paciente.")
    }
    const portalAccessCreated = await ensurePatientCredential(ctx, patient._id, args.credential)

    // 2. Consulta configuração do construtor para verificar aprovação necessária
    const config = await ctx.db.query("bookingFormConfig").first()
    const requireApproval = config?.requireApproval ?? false
    const initialStatus = requireApproval ? "pending_approval" : "confirmed"

    const assignedScheduleId = requireApproval
      ? undefined
      : (await bookGroupSession(ctx, { ...args, patientId: patient._id })).scheduleId

    // 4. Salva a submissão do agendamento público com as respostas da triagem
    const publicBookingId = await ctx.db.insert("publicBookings", {
      patientId: patient._id,
      scheduleId: assignedScheduleId,
      status: initialStatus,
      specialty: args.specialty,
      serviceId: args.serviceId,
      packageId: args.packageId,
      packageName: args.packageName,
      hasHealthInsurance: args.hasHealthInsurance,
      healthInsuranceName: args.healthInsuranceName,
      selectedPrice: args.selectedPrice,
      selectedPaymentMethod: args.selectedPaymentMethod,
      pricingDetails: args.pricingDetails,
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
    const planInfo = args.packageName
      ? `Plano: ${args.packageName} | ${args.hasHealthInsurance ? "Convênio: " + (args.healthInsuranceName || "Sim") : "Particular"} | Valor: R$ ${args.selectedPrice ?? "0,00"}`
      : `Especialidade: ${args.specialty || "Fisioterapia"}`

    await ctx.db.insert("notificationLogs", {
      channel: "whatsapp_uazapi",
      recipientName: "Recepção Altar Fisio",
      recipientContact: args.phone,
      triggerType: "agendamento_online",
      content: `O paciente ${args.name} (${args.phone}) agendou para ${args.date} às ${args.startTime}. ${planInfo}. Status: ${initialStatus}`,
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

      await ctx.scheduler.runAfter(0, internal.notifications.sendScheduleConfirmationAction, {
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

    const result = {
      success: true,
      bookingId: publicBookingId,
      portalAccessCreated,
      patientId: patient._id,
      status: initialStatus,
      requireApproval,
      scheduledDate: args.date,
      scheduledTime: args.startTime,
      patientName: args.name,
    }
    if (requestId) await ctx.db.insert('publicBookingReceipts', { requestId, fingerprint: fingerprint!, result })
    return result
  },
})

// 6. Listar Agendamentos Públicos (Para a Recepção e Administração)
export const listPublicBookings = query({
  args: { sessionToken: v.string(),
    status: v.optional(
      v.union(v.literal("pending_approval"), v.literal("confirmed"), v.literal("rejected"), v.literal("all"))
    ),
  },
  handler: async (ctx, input) => {
    const { sessionToken, ...args } = input
    await requireStaff(ctx, sessionToken, ["admin","reception"]);

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
export const deletePublicBooking = mutation({
  args: { sessionToken: v.string(), bookingId: v.id("publicBookings") },
  handler: async (ctx, { sessionToken, bookingId }) => {
    const actor = await requireStaff(ctx, sessionToken, ["admin"])
    const booking = await ctx.db.get(bookingId)
    if (!booking) throw new ConvexError("Solicitação não encontrada.")
    await ctx.db.delete(bookingId)
    await ctx.db.insert("auditLogs", {
      action: "public_booking_deleted",
      userName: actor.name,
      userRole: actor.role,
      patientId: booking.patientId,
      details: `Solicitação online de ${booking.date} às ${booking.startTime} excluída. Agendamento na agenda preservado.`,
      timestamp: Date.now(),
    })
    return { success: true }
  },
})

export const updatePublicBookingStatus = mutation({
  args: { sessionToken: v.string(),
    bookingId: v.id("publicBookings"),
    status: v.union(v.literal("confirmed"), v.literal("rejected")),
    rejectionReason: v.optional(v.string()),
  },
  handler: async (ctx, input) => {
    const { sessionToken, ...args } = input
    const actor = await requireStaff(ctx, sessionToken, ["admin","reception"]);

    const booking = await ctx.db.get(args.bookingId)
    if (!booking) {
      throw new ConvexError("Agendamento público não encontrado.")
    }

    const now = Date.now()

    if (args.status === "confirmed" && !booking.scheduleId) {
      const evaluation = await resolveBookingService(ctx, booking)
      if (!evaluation?.isEvaluation || evaluation.modality !== 'individual') throw new ConvexError('Esta solicitação não é uma avaliação individual. Agende o tratamento pelo painel da clínica.')
      const { scheduleId } = await bookGroupSession(ctx, { ...booking, specialty: booking.specialty })
      await ctx.db.patch(args.bookingId, { status: 'confirmed', scheduleId })
    } else {
      await ctx.db.patch(args.bookingId, {
        status: args.status,
        rejectionReason: args.rejectionReason,
      })
    }

    await ctx.db.insert("auditLogs", {
      action: `public_booking_${args.status}`,
      userName: actor.name,
      userRole: "admin",
      patientId: booking.patientId,
      details: `Agendamento online para ${booking.date} às ${booking.startTime} marcado como ${args.status}`,
      timestamp: now,
    })

    return { success: true }
  },
})
