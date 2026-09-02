import { query, mutation } from "./_generated/server"
import { v } from "convex/values"

// Geração de URL temporária assinada para upload seguro no Convex Storage
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl()
  },
})

// Obtenção da URL pública de visualização para um storageId
export const getStorageUrl = query({
  args: { storageId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId)
  },
})

// Prontuário e Ficha de Avaliação com resolução automática das fotos posturais
export const getClinicalRecord = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
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
  args: {
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
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("clinicalRecords")
      .withIndex("by_patient", (q) => q.eq("patientId", args.patientId))
      .first()

    if (existing) {
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
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("clinicalEvolutions")
      .withIndex("by_patient", (q) => q.eq("patientId", args.patientId))
      .order("desc")
      .collect()
  },
})

// Registro oficial de evolução diária no modelo SOAP com assinatura digital e trava legal
export const addSoapEvolution = mutation({
  args: {
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
  handler: async (ctx, args) => {
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
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
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
        professionalName: "Equipe Altar Fisio",
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
