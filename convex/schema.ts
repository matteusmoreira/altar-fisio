import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
  // Configurações Globais da Clínica Altar Fisio
  clinicSettings: defineTable({
    clinicName: v.string(),
    clinicSubtitle: v.string(),
    primaryColor: v.string(), // HSL ou HEX
    colorPreset: v.string(),
    mode: v.union(v.literal("light"), v.literal("dark")),
    logoUrl: v.optional(v.string()),
    logoStorageId: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    // Regras de agendamento & reposição
    cancellationNoticeHours: v.number(), // Ex: 2 (horas de antecedência mínima para gerar reposição)
    replacementExpiryDays: v.number(), // Ex: 30 (dias para usar o crédito de reposição)
    // Integrações de Notificação
    uazapiEndpoint: v.optional(v.string()),
    uazapiToken: v.optional(v.string()),
    uazapiInstanceId: v.optional(v.string()),
    uazapiAdminToken: v.optional(v.string()),
    activeWhatsappInstanceToken: v.optional(v.string()),
    activeReminder24hTemplateId: v.optional(v.id("messageTemplates")),
    activeReminder2hTemplateId: v.optional(v.id("messageTemplates")),
    activeConfirmationTemplateId: v.optional(v.id("messageTemplates")),
    resendApiKey: v.optional(v.string()),
    resendFromEmail: v.optional(v.string()),
  }),

  // Salas Físicas e Recursos
  rooms: defineTable({
    name: v.string(), // Ex: "Sala Pilates Aparelhos", "Sala RPG", "Box Fisio 1"
    type: v.union(
      v.literal("pilates_aparelhos"),
      v.literal("pilates_solo"),
      v.literal("rpg"),
      v.literal("fisioterapia"),
      v.literal("consultorio")
    ),
    capacity: v.number(), // Limite máximo de alunos simultâneos
    color: v.string(), // Tag visual da sala
    description: v.optional(v.string()),
    isActive: v.boolean(),
  }).index("by_active", ["isActive"]),

  // Profissionais de Saúde
  professionals: defineTable({
    name: v.string(),
    email: v.string(),
    phone: v.string(),
    crefito: v.string(), // Registro profissional
    specialties: v.array(v.string()), // ["Fisioterapia", "Pilates", "RPG"]
    commissionType: v.union(v.literal("percentage"), v.literal("fixed")),
    commissionValue: v.number(), // Ex: 40 (%) ou 50 (R$ fixo por atendimento)
    avatarUrl: v.optional(v.string()),
    active: v.boolean(),
  }).index("by_email", ["email"]).index("by_active", ["active"]),

  // Pacientes e Alunos
  patients: defineTable({
    name: v.string(),
    documentCpf: v.string(),
    phone: v.string(),
    email: v.optional(v.string()),
    birthDate: v.string(),
    gender: v.optional(v.string()),
    address: v.optional(v.string()),
    emergencyContact: v.optional(v.string()),
    emergencyPhone: v.optional(v.string()),
    healthInsurance: v.optional(v.string()), // Convênio ou Particular
    notes: v.optional(v.string()),
    active: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_cpf", ["documentCpf"])
    .index("by_name", ["name"])
    .index("by_phone", ["phone"])
    .index("by_active", ["active"])
    .searchIndex("search_name", {
      searchField: "name",
      filterFields: ["active"],
    }),

  // Serviços e Atendimentos Oferecidos
  services: defineTable({
    name: v.string(), // Ex: "Pilates em Grupo", "Fisioterapia Ortopédica", "Sessão de RPG"
    modality: v.union(v.literal("individual"), v.literal("turma")),
    specialty: v.union(v.literal("fisioterapia"), v.literal("pilates"), v.literal("rpg")),
    durationMinutes: v.number(),
    defaultPrice: v.number(),
    description: v.optional(v.string()),
    active: v.boolean(),
  }),

  // Planos e Pacotes de Sessões
  packages: defineTable({
    name: v.string(), // Ex: "Pilates 2x/Semana (Mensal)", "Pacote 10 Sessões Fisio"
    serviceId: v.id("services"),
    sessionCount: v.number(), // Ex: 8 sessões, 10 sessões
    validityDays: v.number(), // Ex: 30 dias, 60 dias
    price: v.number(),
    description: v.optional(v.string()),
    active: v.boolean(),
  }),

  // Pacotes Adquiridos pelos Pacientes
  patientPackages: defineTable({
    patientId: v.id("patients"),
    packageId: v.id("packages"),
    totalSessions: v.number(),
    usedSessions: v.number(),
    remainingSessions: v.number(),
    startDate: v.string(),
    expiryDate: v.string(),
    status: v.union(v.literal("active"), v.literal("completed"), v.literal("expired")),
  }).index("by_patient", ["patientId"]).index("by_status", ["status"]),

  // Agendamentos & Aulas
  schedules: defineTable({
    title: v.string(),
    type: v.union(v.literal("individual"), v.literal("turma")),
    specialty: v.union(v.literal("fisioterapia"), v.literal("pilates"), v.literal("rpg")),
    roomId: v.id("rooms"),
    professionalId: v.id("professionals"),
    date: v.string(), // YYYY-MM-DD
    startTime: v.string(), // HH:mm
    endTime: v.string(), // HH:mm
    maxCapacity: v.number(),
    status: v.union(
      v.literal("scheduled"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
    notes: v.optional(v.string()),
    recurringGroupId: v.optional(v.string()),
    isRecurring: v.optional(v.boolean()),
  })
    .index("by_date", ["date"])
    .index("by_professional_date", ["professionalId", "date"])
    .index("by_room_date", ["roomId", "date"])
    .index("by_recurring_group", ["recurringGroupId"]),

  // Participantes / Alunos em cada Agendamento
  scheduleParticipants: defineTable({
    scheduleId: v.id("schedules"),
    patientId: v.id("patients"),
    status: v.union(
      v.literal("scheduled"),
      v.literal("present"),
      v.literal("absence"),
      v.literal("justified_absence"),
      v.literal("replacement")
    ),
    patientPackageId: v.optional(v.id("patientPackages")),
    replacementCreditId: v.optional(v.id("replacementCredits")),
    checkedInAt: v.optional(v.number()),
    notes: v.optional(v.string()),
  }).index("by_schedule", ["scheduleId"]).index("by_patient", ["patientId"]),

  // Créditos de Reposição Gerados por Desmarcações Antecipadas
  replacementCredits: defineTable({
    patientId: v.id("patients"),
    originScheduleId: v.id("schedules"),
    generatedAt: v.number(),
    expiryDate: v.string(), // YYYY-MM-DD
    status: v.union(v.literal("available"), v.literal("used"), v.literal("expired")),
    usedInScheduleId: v.optional(v.id("schedules")),
  })
    .index("by_patient_status", ["patientId", "status"])
    .index("by_status", ["status"]),

  // Prontuário Clínico & Avaliações
  clinicalRecords: defineTable({
    patientId: v.id("patients"),
    chiefComplaint: v.string(), // Queixa principal
    hpi: v.string(), // História da moléstia atual
    medicalHistory: v.string(), // Histórico patológico pregresso
    medications: v.string(), // Medicações em uso
    painScaleEva: v.number(), // 0 a 10
    painLocation: v.string(),
    // Avaliação Postural e Biomecânica (4 Vistas Padronizadas)
    posturalNotes: v.optional(v.string()),
    posturalDate: v.optional(v.string()),
    posturalAlignmentMetrics: v.optional(v.string()),
    anteriorPhotoUrl: v.optional(v.string()),
    anteriorStorageId: v.optional(v.string()),
    posteriorPhotoUrl: v.optional(v.string()),
    posteriorStorageId: v.optional(v.string()),
    lateralPhotoUrl: v.optional(v.string()), // Retrocompatibilidade
    lateralRightPhotoUrl: v.optional(v.string()),
    lateralRightStorageId: v.optional(v.string()),
    lateralLeftPhotoUrl: v.optional(v.string()),
    lateralLeftStorageId: v.optional(v.string()),
    testsAndMeasures: v.optional(v.string()),
    clinicalGoals: v.string(), // Metas terapêuticas
    updatedAt: v.number(),
  }).index("by_patient", ["patientId"]),

  // Evoluções Diárias de Atendimento (Padrão SOAP - CREFITO)
  clinicalEvolutions: defineTable({
    patientId: v.id("patients"),
    professionalId: v.id("professionals"),
    scheduleId: v.optional(v.id("schedules")),
    date: v.string(),
    timestamp: v.number(),
    // Formato SOAP
    subjective: v.string(), // Relato do paciente sobre dor e disposição
    objective: v.string(), // Exercícios executados, cargas, manobras de RPG
    assessment: v.string(), // Resposta do paciente ao tratamento
    plan: v.string(), // Planejamento para a próxima sessão
    painScaleAfter: v.optional(v.number()),
    techniqueCategory: v.optional(v.string()), // Pilates, RPG, Fisioterapia Ortopédica
    signedProfessionalName: v.string(),
    crefito: v.string(),
    // Integridade Legal COFFITO
    isLocked: v.optional(v.boolean()), // Trava de integridade inalterável
    signatureHash: v.optional(v.string()), // Assinatura digital auditável
  }).index("by_patient", ["patientId"]).index("by_professional", ["professionalId"]),

  // Financeiro Interno: Contas a Pagar e Receber & Vendas
  financialTransactions: defineTable({
    type: v.union(v.literal("income"), v.literal("expense")),
    category: v.string(), // "Mensalidade Pilates", "Pacote Fisio", "Aluguel", "Manutenção Aparelhos", "Materiais"
    description: v.string(),
    amount: v.number(),
    dueDate: v.string(), // YYYY-MM-DD
    paymentDate: v.optional(v.string()),
    paymentMethod: v.union(
      v.literal("pix"),
      v.literal("dinheiro"),
      v.literal("cartao_debito"),
      v.literal("cartao_credito"),
      v.literal("transferencia")
    ),
    status: v.union(v.literal("pending"), v.literal("paid"), v.literal("cancelled")),
    patientId: v.optional(v.id("patients")),
    professionalId: v.optional(v.id("professionals")),
    packageId: v.optional(v.id("packages")),
    receiptIssued: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_status_due", ["status", "dueDate"])
    .index("by_type", ["type"])
    .index("by_patient", ["patientId"])
    .index("by_dueDate", ["dueDate"])
    .index("by_month_type", ["dueDate", "type"]),

  // Fechamento de Repasses e Comissões dos Profissionais
  commissions: defineTable({
    professionalId: v.id("professionals"),
    periodMonthYear: v.string(), // Ex: "2026-09"
    totalAttendances: v.number(),
    totalGrossAmount: v.number(),
    totalCommissionAmount: v.number(),
    status: v.union(v.literal("pending"), v.literal("paid")),
    paidAt: v.optional(v.number()),
    notes: v.optional(v.string()),
  }).index("by_professional_period", ["professionalId", "periodMonthYear"]),

  // Log de Disparos de Notificações (UAZAPI & Resend)
  notificationLogs: defineTable({
    channel: v.union(v.literal("whatsapp_uazapi"), v.literal("email_resend")),
    recipientName: v.string(),
    recipientContact: v.string(), // Telefone ou E-mail
    triggerType: v.string(), // "lembrete_24h", "lembrete_2h", "recibo_pagamento", "credito_reposicao"
    content: v.string(),
    status: v.union(v.literal("sent"), v.literal("failed"), v.literal("queued")),
    scheduleId: v.optional(v.id("schedules")),
    timestamp: v.number(),
    errorMessage: v.optional(v.string()),
  }).index("by_timestamp", ["timestamp"])
    .index("by_channel", ["channel", "timestamp"])
    .index("by_status", ["status"])
    .index("by_schedule", ["scheduleId", "triggerType"])
    .index("by_schedule_recipient", ["scheduleId", "triggerType", "recipientContact"]),

  // Usuários do Sistema & Controle de Acesso (RBAC)
  users: defineTable({
    name: v.string(),
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("professional"), v.literal("reception")),
    passwordHash: v.string(),
    salt: v.string(),
    professionalId: v.optional(v.id("professionals")),
    avatarUrl: v.optional(v.string()),
    active: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_role", ["role"]),

  // Sessões de Usuários
  userSessions: defineTable({
    userId: v.id("users"),
    token: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_user", ["userId"])
    .index("by_expiresAt", ["expiresAt"]),

  // Trilha de Auditoria LGPD e COFFITO
  auditLogs: defineTable({
    userId: v.optional(v.id("users")),
    userName: v.string(),
    userRole: v.string(), // "admin" | "professional" | "reception" | "system"
    action: v.string(), // "view_clinical_record" | "export_pdf_certificate" | "export_pdf_receipt" | "export_pdf_report" | "export_pdf_tcle" | "save_clinical_record" | "add_soap_evolution" | "save_consent"
    patientId: v.optional(v.id("patients")),
    patientName: v.optional(v.string()),
    details: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("by_timestamp", ["timestamp"])
    .index("by_patient", ["patientId", "timestamp"])
    .index("by_action", ["action", "timestamp"]),

  // Termos de Consentimento e Autorizações LGPD
  patientConsents: defineTable({
    patientId: v.id("patients"),
    termType: v.union(
      v.literal("tcle_treatment"),
      v.literal("lgpd_data_processing"),
      v.literal("postural_photo_consent")
    ),
    accepted: v.boolean(),
    acceptedAt: v.number(),
    signedByName: v.string(),
    documentVersion: v.string(),
    ipAddress: v.optional(v.string()),
    notes: v.optional(v.string()),
  })
    .index("by_patient", ["patientId"])
    .index("by_patient_term", ["patientId", "termType"]),

  // ==========================================================================
  // MÓDULO WHATSAPP UAZAPI: INSTÂNCIAS, TEMPLATES & DISPARADOR EM MASSA
  // ==========================================================================

  // Instâncias Uazapi Conectadas
  whatsappInstances: defineTable({
    name: v.string(),
    instanceId: v.string(), // ID gerado na Uazapi (ex: "rc7dde9bdf259a3")
    token: v.string(), // Token de autenticação da instância
    status: v.union(v.literal("connected"), v.literal("disconnected"), v.literal("connecting")),
    profileName: v.optional(v.string()),
    profilePicUrl: v.optional(v.string()),
    ownerNumber: v.optional(v.string()),
    isDefault: v.boolean(),
    qrcode: v.optional(v.string()), // Data URI em base64 do QR Code para conexão
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_default", ["isDefault"])
    .index("by_status", ["status"]),

  // Biblioteca de Templates de Mensagens Interativas
  messageTemplates: defineTable({
    title: v.string(),
    type: v.union(v.literal("text"), v.literal("button"), v.literal("list"), v.literal("carousel")),
    content: v.string(), // Texto da mensagem com placeholders: {{paciente}}, {{data}}, etc.
    footerText: v.optional(v.string()),
    // Botões interativos (type = "button")
    buttons: v.optional(
      v.array(
        v.object({
          text: v.string(),
          actionType: v.union(v.literal("reply"), v.literal("url")),
          payload: v.string(), // id da resposta ou URL completa
        })
      )
    ),
    // Menu em lista (type = "list")
    listButtonText: v.optional(v.string()),
    listSections: v.optional(
      v.array(
        v.object({
          title: v.string(),
          rows: v.array(
            v.object({
              title: v.string(),
              description: v.optional(v.string()),
              rowId: v.string(),
            })
          ),
        })
      )
    ),
    // Carrossel de cartões (type = "carousel")
    carouselCards: v.optional(
      v.array(
        v.object({
          title: v.string(),
          description: v.string(),
          imageUrl: v.string(),
          buttonText: v.string(),
          buttonType: v.union(v.literal("reply"), v.literal("url")),
          buttonPayload: v.string(),
        })
      )
    ),
    category: v.union(
      v.literal("reminder_24h"),
      v.literal("reminder_2h"),
      v.literal("booking_confirmation"),
      v.literal("broadcast"),
      v.literal("custom")
    ),
    isSystemDefault: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_category", ["category"]),

  // Campanhas de Disparo em Massa & Recorrência
  broadcastCampaigns: defineTable({
    name: v.string(),
    templateId: v.optional(v.id("messageTemplates")),
    customText: v.string(),
    messageType: v.union(v.literal("text"), v.literal("button"), v.literal("list"), v.literal("carousel")),
    targetPatientIds: v.array(v.id("patients")),
    recurrence: v.union(
      v.literal("none"),
      v.literal("daily"),
      v.literal("weekly"),
      v.literal("biweekly"),
      v.literal("monthly")
    ),
    scheduledHour: v.string(), // "HH:mm"
    scheduledDaysOfWeek: v.optional(v.array(v.number())), // [0 = Domingo, 1 = Segunda, ...]
    status: v.union(v.literal("active"), v.literal("paused"), v.literal("completed"), v.literal("cancelled")),
    lastExecutedAt: v.optional(v.number()),
    nextRunAt: v.optional(v.number()),
    totalRecipients: v.number(),
    sentCount: v.number(),
    failedCount: v.number(),
    createdAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_next_run", ["status", "nextRunAt"]),

  // Laudos Clínicos e Documentos Oficiais Emitidos (CRUD de Laudos)
  clinicalReports: defineTable({
    patientId: v.id("patients"),
    professionalId: v.id("professionals"),
    type: v.union(
      v.literal("report"),
      v.literal("certificate"),
      v.literal("receipt"),
      v.literal("tcle")
    ),
    title: v.string(), // Ex: "Laudo de Evolução Clínica e Biomecânica"
    date: v.string(), // YYYY-MM-DD
    // Conteúdo clínico estruturado do laudo
    chiefComplaint: v.optional(v.string()),
    painScaleEva: v.optional(v.number()),
    painLocation: v.optional(v.string()),
    hpi: v.optional(v.string()),
    clinicalGoals: v.optional(v.string()),
    diagnosticCid: v.optional(v.string()),
    evolutionSummary: v.optional(v.string()),
    conclusion: v.optional(v.string()), // Parecer do Fisioterapeuta
    customNotes: v.optional(v.string()),
    // Campos auxiliares para outros tipos de documentos
    purpose: v.optional(v.string()),
    receiptAmount: v.optional(v.number()),
    sessionsCount: v.optional(v.number()),
    paymentMethod: v.optional(v.string()),
    serviceDescription: v.optional(v.string()),
    // Rastreabilidade e Assinatura Legal COFFITO
    documentHash: v.string(),
    signedProfessionalName: v.string(),
    crefito: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_patient", ["patientId"])
    .index("by_professional", ["professionalId"])
    .index("by_date", ["date"]),

  // Configuração do Construtor de Agendamento Público e Triagem
  bookingFormConfig: defineTable({
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
    updatedAt: v.number(),
  }),

  // Submissões de Agendamentos Públicos Realizados por Pacientes
  publicBookings: defineTable({
    patientId: v.id("patients"),
    scheduleId: v.optional(v.id("schedules")),
    status: v.union(
      v.literal("pending_approval"),
      v.literal("confirmed"),
      v.literal("rejected")
    ),
    serviceId: v.optional(v.id("services")),
    professionalId: v.optional(v.id("professionals")),
    roomId: v.optional(v.id("rooms")),
    date: v.string(),
    startTime: v.string(),
    endTime: v.string(),
    answers: v.array(
      v.object({
        questionId: v.string(),
        questionLabel: v.string(),
        answer: v.string(),
      })
    ),
    notes: v.optional(v.string()),
    rejectionReason: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_patient", ["patientId"])
    .index("by_date", ["date"])
    .index("by_status_created", ["status", "createdAt"]),
})


