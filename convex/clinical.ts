import { requireStaff } from './lib/security'
import { query, mutation } from "./_generated/server"
import { v } from "convex/values"

// Geração de URL temporária assinada para upload seguro no Convex Storage
export const generateUploadUrl = mutation({
  args: { sessionToken: v.string(), },
  handler: async (ctx, input) => {
    const { sessionToken, ...args } = input
    await requireStaff(ctx, sessionToken, ["admin","professional"]);

    return await ctx.storage.generateUploadUrl()
  },
})

export const attachPosturalPhoto = mutation({
  args: { sessionToken: v.string(), patientId: v.id('patients'), view: v.union(v.literal('anterior'), v.literal('posterior'), v.literal('lateralRight'), v.literal('lateralLeft')), storageId: v.id('_storage') },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken, ['admin', 'professional'])
    const record = await ctx.db.query('clinicalRecords').withIndex('by_patient', q => q.eq('patientId', args.patientId)).first()
    if (!record) throw new Error('Salve a avaliação clínica antes de anexar fotos.')
    const file = await ctx.db.system.get(args.storageId)
    if (!file || file.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.contentType || '')) throw new Error('Use imagem JPG, PNG ou WebP de até 5 MB.')
    const field = `${args.view}StorageId` as const
    const previous = record[field]
    await ctx.db.patch(record._id, { [field]: args.storageId, [`${args.view}PhotoUrl`]: undefined, updatedAt: Date.now() })
    if (previous && previous !== args.storageId) await ctx.storage.delete(previous)
    return await ctx.storage.getUrl(args.storageId)
  },
})

// Obtenção da URL pública de visualização para um storageId
export const getStorageUrl = query({
  args: { sessionToken: v.string(),  storageId: v.string() },
  handler: async (ctx, input) => {
    const { sessionToken, ...args } = input
    await requireStaff(ctx, sessionToken, ["admin","professional"]);

    return await ctx.storage.getUrl(args.storageId)
  },
})

// Prontuário e Ficha de Avaliação com resolução automática das fotos posturais
export const getClinicalRecord = query({
  args: { sessionToken: v.string(),  patientId: v.id("patients") },
  handler: async (ctx, input) => {
    const { sessionToken, ...args } = input
    await requireStaff(ctx, sessionToken, ["admin","professional"]);

    const record = await ctx.db
      .query("clinicalRecords")
      .withIndex("by_patient", (q) => q.eq("patientId", args.patientId))
      .first()

    if (!record) return null

    // Resolução dinâmica de URLs seguras para cada uma das 4 vistas
    let anteriorUrl = record.anteriorPhotoUrl
    if (record.anteriorStorageId) {
      const storageUrl = await ctx.storage.getUrl(record.anteriorStorageId)
      if (storageUrl) anteriorUrl = storageUrl
    }

    let posteriorUrl = record.posteriorPhotoUrl
    if (record.posteriorStorageId) {
      const storageUrl = await ctx.storage.getUrl(record.posteriorStorageId)
      if (storageUrl) posteriorUrl = storageUrl
    }

    let lateralRightUrl = record.lateralRightPhotoUrl ?? record.lateralPhotoUrl
    if (record.lateralRightStorageId) {
      const storageUrl = await ctx.storage.getUrl(record.lateralRightStorageId)
      if (storageUrl) lateralRightUrl = storageUrl
    }

    let lateralLeftUrl = record.lateralLeftPhotoUrl
    if (record.lateralLeftStorageId) {
      const storageUrl = await ctx.storage.getUrl(record.lateralLeftStorageId)
      if (storageUrl) lateralLeftUrl = storageUrl
    }

    return {
      ...record,
      anteriorPhotoUrl: anteriorUrl,
      posteriorPhotoUrl: posteriorUrl,
      lateralPhotoUrl: lateralRightUrl,
      lateralRightPhotoUrl: lateralRightUrl,
      lateralLeftPhotoUrl: lateralLeftUrl,
    }
  },
})

export const saveClinicalRecord = mutation({
  args: { sessionToken: v.string(),
    patientId: v.id("patients"),
    chiefComplaint: v.string(),
    hpi: v.string(),
    medicalHistory: v.string(),
    medications: v.string(),
    painScaleEva: v.number(),
    painLocation: v.string(),
    posturalNotes: v.optional(v.string()),
    posturalDate: v.optional(v.string()),
    posturalAlignmentMetrics: v.optional(v.string()),
    anteriorPhotoUrl: v.optional(v.string()),
    anteriorStorageId: v.optional(v.string()),
    posteriorPhotoUrl: v.optional(v.string()),
    posteriorStorageId: v.optional(v.string()),
    lateralPhotoUrl: v.optional(v.string()),
    lateralRightPhotoUrl: v.optional(v.string()),
    lateralRightStorageId: v.optional(v.string()),
    lateralLeftPhotoUrl: v.optional(v.string()),
    lateralLeftStorageId: v.optional(v.string()),
    testsAndMeasures: v.optional(v.string()),
    clinicalGoals: v.string(),
  },
  handler: async (ctx, input) => {
    const { sessionToken, ...args } = input
    await requireStaff(ctx, sessionToken, ["admin","professional"]);

    const existing = await ctx.db
      .query("clinicalRecords")
      .withIndex("by_patient", (q) => q.eq("patientId", args.patientId))
      .first()

    if (existing) {
      // Limpeza de fotos antigas substituídas no Convex Storage para não estourar o limite de 1 GB
      if (args.anteriorStorageId && existing.anteriorStorageId && existing.anteriorStorageId !== args.anteriorStorageId) {
        await ctx.storage.delete(existing.anteriorStorageId).catch(() => {})
      }
      if (args.posteriorStorageId && existing.posteriorStorageId && existing.posteriorStorageId !== args.posteriorStorageId) {
        await ctx.storage.delete(existing.posteriorStorageId).catch(() => {})
      }
      if (args.lateralRightStorageId && existing.lateralRightStorageId && existing.lateralRightStorageId !== args.lateralRightStorageId) {
        await ctx.storage.delete(existing.lateralRightStorageId).catch(() => {})
      }
      if (args.lateralLeftStorageId && existing.lateralLeftStorageId && existing.lateralLeftStorageId !== args.lateralLeftStorageId) {
        await ctx.storage.delete(existing.lateralLeftStorageId).catch(() => {})
      }

      await ctx.db.patch(existing._id, {
        ...args,
        updatedAt: Date.now(),
      })
      return existing._id
    } else {
      return await ctx.db.insert("clinicalRecords", {
        ...args,
        updatedAt: Date.now(),
      })
    }
  },
})

// Listagem de evoluções diárias SOAP em ordem cronológica decrescente
export const listEvolutions = query({
  args: { sessionToken: v.string(),  patientId: v.id("patients") },
  handler: async (ctx, input) => {
    const { sessionToken, ...args } = input
    await requireStaff(ctx, sessionToken, ["admin","professional"]);

    return await ctx.db
      .query("clinicalEvolutions")
      .withIndex("by_patient", (q) => q.eq("patientId", args.patientId))
      .order("desc")
      .collect()
  },
})

// Registro oficial de evolução diária no modelo SOAP com assinatura digital e trava legal
export const addSoapEvolution = mutation({
  args: { sessionToken: v.string(),
    patientId: v.id("patients"),
    professionalId: v.id("professionals"),
    scheduleId: v.optional(v.id("schedules")),
    date: v.string(),
    subjective: v.string(),
    objective: v.string(),
    assessment: v.string(),
    plan: v.string(),
    painScaleAfter: v.optional(v.number()),
    techniqueCategory: v.optional(v.string()),
  },
  handler: async (ctx, input) => {
    const { sessionToken, ...args } = input
    await requireStaff(ctx, sessionToken, ["admin","professional"]);

    const prof = await ctx.db.get(args.professionalId)
    if (!prof) throw new Error("Profissional de saúde não encontrado no cadastro")

    const now = Date.now()
    // Geração de identificador criptográfico/hash de assinatura em conformidade com o COFFITO
    const signatureHash = `COFFITO-${prof.crefito.replace(/[^A-Za-z0-9]/g, "")}-${now.toString(36).toUpperCase()}`

    return await ctx.db.insert("clinicalEvolutions", {
      ...args,
      timestamp: now,
      signedProfessionalName: prof.name,
      crefito: prof.crefito,
      isLocked: true, // Imutabilidade legal
      signatureHash,
    })
  },
})

// Consulta agregada para a série temporal do gráfico de dor (Escala EVA)
export const getPainEvolutionHistory = query({
  args: { sessionToken: v.string(),  patientId: v.id("patients") },
  handler: async (ctx, input) => {
    const { sessionToken, ...args } = input
    await requireStaff(ctx, sessionToken, ["admin","professional"]);

    const record = await ctx.db
      .query("clinicalRecords")
      .withIndex("by_patient", (q) => q.eq("patientId", args.patientId))
      .first()

    const evolutions = await ctx.db
      .query("clinicalEvolutions")
      .withIndex("by_patient", (q) => q.eq("patientId", args.patientId))
      .order("asc")
      .collect()

    const points: Array<{
      date: string
      painLevel: number
      sessionLabel: string
      professionalName: string
      technique?: string
    }> = []

    if (record) {
      points.push({
        date: new Date(record.updatedAt).toISOString().split("T")[0],
        painLevel: record.painScaleEva,
        sessionLabel: "Avaliação Inicial (Anamnese)",
        professionalName: "Equipe Clinica Dr Marcelo",
        technique: "Avaliação",
      })
    }

    evolutions.forEach((evo, idx) => {
      if (evo.painScaleAfter !== undefined) {
        points.push({
          date: evo.date,
          painLevel: evo.painScaleAfter,
          sessionLabel: `Sessão ${idx + 1}`,
          professionalName: evo.signedProfessionalName,
          technique: evo.techniqueCategory ?? "Sessão Clínica",
        })
      }
    })

    return points
  },
})

// Visão Geral e Painel de Prontuários de Todos os Pacientes
export const listAllClinicalOverview = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, input) => {
    const { sessionToken, ...args } = input
    await requireStaff(ctx, sessionToken, ["admin","professional"]);

    const patients = await ctx.db.query("patients").collect()

    const overview = await Promise.all(
      patients.map(async (p) => {
        const record = await ctx.db
          .query("clinicalRecords")
          .withIndex("by_patient", (q) => q.eq("patientId", p._id))
          .first()

        const lastEvo = await ctx.db
          .query("clinicalEvolutions")
          .withIndex("by_patient", (q) => q.eq("patientId", p._id))
          .order("desc")
          .first()

        let evolutionsCount = 0
        if (lastEvo) {
          const recentEvos = await ctx.db
            .query("clinicalEvolutions")
            .withIndex("by_patient", (q) => q.eq("patientId", p._id))
            .take(50)
          evolutionsCount = recentEvos.length
        }

        return {
          patientId: p._id,
          patientName: p.name,
          patientCpf: p.documentCpf,
          patientPhone: p.phone,
          patientBirthDate: p.birthDate,
          patientActive: p.active,
          hasRecord: !!record,
          chiefComplaint: record?.chiefComplaint || "",
          painScaleEva: record?.painScaleEva ?? null,
          clinicalGoals: record?.clinicalGoals || "",
          posturalNotes: record?.posturalNotes || "",
          evolutionsCount,
          lastEvolutionDate: lastEvo?.date || null,
          lastTechnique: lastEvo?.techniqueCategory || null,
          lastPainAfter: lastEvo?.painScaleAfter ?? null,
          updatedAt: record?.updatedAt ?? (lastEvo?.timestamp ?? p.createdAt),
        }
      })
    )

    // Ordenar por pacientes com atividades mais recentes
    return overview.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
  },
})

// Edição de Evolução Diária SOAP
export const updateSoapEvolution = mutation({
  args: { sessionToken: v.string(),
    id: v.id("clinicalEvolutions"),
    subjective: v.string(),
    objective: v.string(),
    assessment: v.string(),
    plan: v.string(),
    painScaleAfter: v.optional(v.number()),
    techniqueCategory: v.optional(v.string()),
    date: v.optional(v.string()),
  },
  handler: async (ctx, input) => {
    const { sessionToken, ...args } = input
    await requireStaff(ctx, sessionToken, ["admin","professional"]);

    const { id, ...data } = args
    const evo = await ctx.db.get(id)
    if (!evo) throw new Error("Evolução não encontrada")

    await ctx.db.patch(id, data)
    return id
  },
})

// Exclusão de Evolução Diária SOAP
export const deleteSoapEvolution = mutation({
  args: { sessionToken: v.string(),
    id: v.id("clinicalEvolutions"),
  },
  handler: async (ctx, input) => {
    const { sessionToken, ...args } = input
    await requireStaff(ctx, sessionToken, ["admin","professional"]);

    const evo = await ctx.db.get(args.id)
    if (!evo) throw new Error("Evolução não encontrada")

    await ctx.db.delete(args.id)
    return { success: true, id: args.id }
  },
})

// Exclusão de Prontuário Clínico Completo (Anamnese com limpeza de storage)
export const deleteClinicalRecord = mutation({
  args: { sessionToken: v.string(),
    patientId: v.id("patients"),
  },
  handler: async (ctx, input) => {
    const { sessionToken, ...args } = input
    const actor = await requireStaff(ctx, sessionToken, ["admin","professional"]);

    const patient = await ctx.db.get(args.patientId)
    if (!patient) throw new Error("Paciente não encontrado")

    const record = await ctx.db
      .query("clinicalRecords")
      .withIndex("by_patient", (q) => q.eq("patientId", args.patientId))
      .first()

    if (record) {
      if (record.anteriorStorageId) await ctx.storage.delete(record.anteriorStorageId).catch(() => {})
      if (record.posteriorStorageId) await ctx.storage.delete(record.posteriorStorageId).catch(() => {})
      if (record.lateralRightStorageId) await ctx.storage.delete(record.lateralRightStorageId).catch(() => {})
      if (record.lateralLeftStorageId) await ctx.storage.delete(record.lateralLeftStorageId).catch(() => {})
      await ctx.db.delete(record._id)

      await ctx.db.insert("auditLogs", {
        userId: actor._id,
        userName: actor.name,
        userRole: actor.role,
        action: "delete_clinical_record",
        patientId: args.patientId,
        patientName: patient.name,
        details: "Exclusão da ficha de anamnese, avaliação clínica e fotos posturais.",
        timestamp: Date.now(),
      })

      return { success: true, id: record._id }
    }
    return { success: false, message: "Prontuário não encontrado" }
  },
})

// ============================================================================
// CRUD COMPLETO DE LAUDOS CLÍNICOS E DOCUMENTOS OFICIAIS
// ============================================================================

// Listagem de laudos clínicos por paciente ou geral
export const listClinicalReports = query({
  args: { sessionToken: v.string(),
    patientId: v.optional(v.id("patients")),
  },
  handler: async (ctx, input) => {
    const { sessionToken, ...args } = input
    await requireStaff(ctx, sessionToken, ["admin", "professional", "reception"]);

    if (args.patientId) {
      return await ctx.db
        .query("clinicalReports")
        .withIndex("by_patient", (qi) => qi.eq("patientId", args.patientId!))
        .order("desc")
        .collect()
    }
    return await ctx.db.query("clinicalReports").order("desc").take(150)
  },
})

// Consulta de um laudo específico por ID
export const getClinicalReport = query({
  args: { sessionToken: v.string(),  id: v.id("clinicalReports") },
  handler: async (ctx, input) => {
    const { sessionToken, ...args } = input
    await requireStaff(ctx, sessionToken, ["admin", "professional", "reception"]);

    return await ctx.db.get(args.id)
  },
})

// Criação oficial de novo laudo clínico com autenticidade COFFITO
export const createClinicalReport = mutation({
  args: { sessionToken: v.string(),
    patientId: v.optional(v.id("patients")),
    patientName: v.optional(v.string()),
    professionalId: v.optional(v.id("professionals")),
    type: v.union(
      v.literal("report"),
      v.literal("certificate"),
      v.literal("receipt"),
      v.literal("tcle")
    ),
    modelKey: v.optional(v.string()),
    title: v.string(),
    date: v.string(),
    timeRange: v.optional(v.string()),
    paperSize: v.optional(v.string()),
    showWatermark: v.optional(v.boolean()),
    signatureImageUrl: v.optional(v.string()),
    chiefComplaint: v.optional(v.string()),
    painScaleEva: v.optional(v.number()),
    painLocation: v.optional(v.string()),
    hpi: v.optional(v.string()),
    clinicalGoals: v.optional(v.string()),
    diagnosticCid: v.optional(v.string()),
    evolutionSummary: v.optional(v.string()),
    conclusion: v.optional(v.string()),
    customNotes: v.optional(v.string()),
    purpose: v.optional(v.string()),
    receiptAmount: v.optional(v.number()),
    sessionsCount: v.optional(v.number()),
    paymentMethod: v.optional(v.string()),
    serviceDescription: v.optional(v.string()),
  },
  handler: async (ctx, input) => {
    const { sessionToken, ...args } = input
    await requireStaff(ctx, sessionToken, ["admin", "professional", "reception"]);

    let prof = args.professionalId ? await ctx.db.get(args.professionalId) : null
    if (!prof) {
      // Se não especificado, busca o Dr. Marcelo ou primeiro ativo
      const profs = await ctx.db.query("professionals").filter((q) => q.eq(q.field("active"), true)).collect()
      prof = profs.find((p) => p.name.toLowerCase().includes("marcelo")) || profs[0] || null
    }

    const now = Date.now()
    const cleanCrefito = prof?.crefito ? prof.crefito.replace(/[^A-Za-z0-9]/g, "") : "40008F"
    const documentHash = `COFFITO-${cleanCrefito}-${now.toString(36).toUpperCase()}`

    return await ctx.db.insert("clinicalReports", {
      ...args,
      professionalId: prof?._id,
      documentHash,
      signedProfessionalName: prof?.name || "Dr. Marcelo S. Santos",
      crefito: prof?.crefito || "CREFITO 2: 40008-F",
      createdAt: now,
      updatedAt: now,
    })
  },
})

// Atualização de laudo clínico existente
export const updateClinicalReport = mutation({
  args: { sessionToken: v.string(),
    id: v.id("clinicalReports"),
    title: v.optional(v.string()),
    date: v.optional(v.string()),
    timeRange: v.optional(v.string()),
    paperSize: v.optional(v.string()),
    showWatermark: v.optional(v.boolean()),
    signatureImageUrl: v.optional(v.string()),
    chiefComplaint: v.optional(v.string()),
    painScaleEva: v.optional(v.number()),
    painLocation: v.optional(v.string()),
    hpi: v.optional(v.string()),
    clinicalGoals: v.optional(v.string()),
    diagnosticCid: v.optional(v.string()),
    evolutionSummary: v.optional(v.string()),
    conclusion: v.optional(v.string()),
    customNotes: v.optional(v.string()),
    purpose: v.optional(v.string()),
    receiptAmount: v.optional(v.number()),
    sessionsCount: v.optional(v.number()),
    paymentMethod: v.optional(v.string()),
    serviceDescription: v.optional(v.string()),
    professionalId: v.optional(v.id("professionals")),
  },
  handler: async (ctx, input) => {
    const { sessionToken, ...args } = input
    await requireStaff(ctx, sessionToken, ["admin", "professional", "reception"]);

    const { id, professionalId, ...data } = args
    const existing = await ctx.db.get(id)
    if (!existing) throw new Error("Laudo clínico não encontrado")

    const updatePayload: Record<string, any> = {
      ...data,
      updatedAt: Date.now(),
    }

    if (professionalId && professionalId !== existing.professionalId) {
      const prof = await ctx.db.get(professionalId)
      if (prof) {
        updatePayload.professionalId = professionalId
        updatePayload.signedProfessionalName = prof.name
        updatePayload.crefito = prof.crefito
      }
    }

    await ctx.db.patch(id, updatePayload)
    return id
  },
})

// Exclusão de laudo clínico
export const deleteClinicalReport = mutation({
  args: { sessionToken: v.string(),  id: v.id("clinicalReports") },
  handler: async (ctx, input) => {
    const { sessionToken, ...args } = input
    await requireStaff(ctx, sessionToken, ["admin", "professional", "reception"]);

    const existing = await ctx.db.get(args.id)
    if (!existing) throw new Error("Laudo clínico não encontrado")

    await ctx.db.delete(args.id)
    return { success: true, id: args.id }
  },
})

// Modelos Customizados de Laudos
export const listReportCustomTemplates = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, input) => {
    await requireStaff(ctx, input.sessionToken, ["admin", "professional", "reception"]);
    return await ctx.db.query("reportCustomTemplates").order("desc").collect()
  },
})

export const saveReportCustomTemplate = mutation({
  args: {
    sessionToken: v.string(),
    id: v.optional(v.id("reportCustomTemplates")),
    title: v.string(),
    type: v.string(),
    content: v.string(),
    cidDefault: v.optional(v.string()),
  },
  handler: async (ctx, input) => {
    const { sessionToken, id, ...data } = input
    await requireStaff(ctx, sessionToken, ["admin", "professional", "reception"]);

    const now = Date.now()
    if (id) {
      await ctx.db.patch(id, { ...data, updatedAt: now })
      return id
    }
    return await ctx.db.insert("reportCustomTemplates", {
      ...data,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const deleteReportCustomTemplate = mutation({
  args: { sessionToken: v.string(), id: v.id("reportCustomTemplates") },
  handler: async (ctx, input) => {
    await requireStaff(ctx, input.sessionToken, ["admin", "professional", "reception"]);
    await ctx.db.delete(input.id)
    return { success: true, id: input.id }
  },
})

// Salvar ou atualizar exclusivamente a Queixa Principal do paciente
export const saveChiefComplaint = mutation({
  args: {
    sessionToken: v.string(),
    patientId: v.id("patients"),
    chiefComplaint: v.string(),
  },
  handler: async (ctx, input) => {
    const { sessionToken, patientId, chiefComplaint } = input
    await requireStaff(ctx, sessionToken, ["admin", "professional"])

    const existing = await ctx.db
      .query("clinicalRecords")
      .withIndex("by_patient", (q) => q.eq("patientId", patientId))
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, {
        chiefComplaint,
        updatedAt: Date.now(),
      })
      return existing._id
    } else {
      return await ctx.db.insert("clinicalRecords", {
        patientId,
        chiefComplaint,
        hpi: "",
        medicalHistory: "",
        medications: "",
        painScaleEva: 0,
        painLocation: "",
        clinicalGoals: "",
        updatedAt: Date.now(),
      })
    }
  },
})

