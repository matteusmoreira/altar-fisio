import { query, mutation } from "./_generated/server"
import { v } from "convex/values"

export const listPatients = query({
  args: { search: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!args.search || args.search.trim() === "") {
      return await ctx.db
        .query("patients")
        .withIndex("by_name")
        .collect()
    }

    const term = args.search.trim()
    const cleanDigits = term.replace(/\D/g, "")

    // 1. Busca direta por CPF indexado
    if (cleanDigits.length >= 11) {
      const byCpf = await ctx.db
        .query("patients")
        .withIndex("by_cpf", (q) => q.eq("documentCpf", term))
        .first()
      if (byCpf) return [byCpf]
    }

    // 2. Busca direta por Telefone indexado
    if (cleanDigits.length >= 8) {
      const byPhone = await ctx.db
        .query("patients")
        .withIndex("by_phone", (q) => q.eq("phone", term))
        .first()
      if (byPhone) return [byPhone]
    }

    // 3. Busca pelo Search Index de Nome
    const searchResults = await ctx.db
      .query("patients")
      .withSearchIndex("search_name", (q) => q.search("name", term))
      .take(20)

    if (searchResults.length > 0) {
      return searchResults
    }

    // Fallback: filtro em memória limitado
    const all = await ctx.db.query("patients").take(100)
    const lower = term.toLowerCase()
    return all.filter(
      (p) =>
        p.name.toLowerCase().includes(lower) ||
        p.documentCpf.includes(lower) ||
        p.phone.includes(lower)
    )
  },
})

export const getPatient = query({
  args: { id: v.id("patients") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
  },
})

export const createPatient = mutation({
  args: {
    name: v.string(),
    documentCpf: v.string(),
    phone: v.string(),
    email: v.optional(v.string()),
    birthDate: v.string(),
    gender: v.optional(v.string()),
    address: v.optional(v.string()),
    emergencyContact: v.optional(v.string()),
    emergencyPhone: v.optional(v.string()),
    healthInsurance: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("patients", {
      ...args,
      active: true,
      createdAt: Date.now(),
    })
  },
})

export const updatePatient = mutation({
  args: {
    id: v.id("patients"),
    name: v.string(),
    documentCpf: v.string(),
    phone: v.string(),
    email: v.optional(v.string()),
    birthDate: v.string(),
    gender: v.optional(v.string()),
    address: v.optional(v.string()),
    emergencyContact: v.optional(v.string()),
    emergencyPhone: v.optional(v.string()),
    healthInsurance: v.optional(v.string()),
    notes: v.optional(v.string()),
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { id, ...data } = args
    await ctx.db.patch(id, data)
    return id
  },
})

// Exclusão com cascata completa para manter o banco Convex sem arquivos ou registros órfãos
export const deletePatient = mutation({
  args: {
    id: v.id("patients"),
  },
  handler: async (ctx, args) => {
    const patient = await ctx.db.get(args.id)
    if (!patient) throw new Error("Paciente não encontrado")

    // 1. Limpeza de Prontuário e Fotos no Storage
    const clinicalRec = await ctx.db
      .query("clinicalRecords")
      .withIndex("by_patient", (q) => q.eq("patientId", args.id))
      .first()

    if (clinicalRec) {
      if (clinicalRec.anteriorStorageId) await ctx.storage.delete(clinicalRec.anteriorStorageId).catch(() => {})
      if (clinicalRec.posteriorStorageId) await ctx.storage.delete(clinicalRec.posteriorStorageId).catch(() => {})
      if (clinicalRec.lateralRightStorageId) await ctx.storage.delete(clinicalRec.lateralRightStorageId).catch(() => {})
      if (clinicalRec.lateralLeftStorageId) await ctx.storage.delete(clinicalRec.lateralLeftStorageId).catch(() => {})
      await ctx.db.delete(clinicalRec._id)
    }

    // 2. Limpeza de Evoluções SOAP
    const evolutions = await ctx.db
      .query("clinicalEvolutions")
      .withIndex("by_patient", (q) => q.eq("patientId", args.id))
      .collect()
    for (const evo of evolutions) {
      await ctx.db.delete(evo._id)
    }

    // 3. Limpeza de Pacientes-Pacotes
    const patientPkgs = await ctx.db
      .query("patientPackages")
      .withIndex("by_patient", (q) => q.eq("patientId", args.id))
      .collect()
    for (const pp of patientPkgs) {
      await ctx.db.delete(pp._id)
    }

    // 4. Limpeza de Créditos de Reposição
    const credits = await ctx.db
      .query("replacementCredits")
      .withIndex("by_patient_status", (q) => q.eq("patientId", args.id))
      .collect()
    for (const cr of credits) {
      await ctx.db.delete(cr._id)
    }

    // 5. Limpeza de Termos e Consentimentos LGPD
    const consents = await ctx.db
      .query("patientConsents")
      .withIndex("by_patient", (q) => q.eq("patientId", args.id))
      .collect()
    for (const cs of consents) {
      await ctx.db.delete(cs._id)
    }

    // 6. Limpeza de Matrículas em Agendamentos
    const participations = await ctx.db
      .query("scheduleParticipants")
      .withIndex("by_patient", (q) => q.eq("patientId", args.id))
      .collect()
    for (const part of participations) {
      await ctx.db.delete(part._id)
    }

    // 7. Limpeza de Laudos Emitidos
    const reports = await ctx.db
      .query("clinicalReports")
      .withIndex("by_patient", (q) => q.eq("patientId", args.id))
      .collect()
    for (const rep of reports) {
      await ctx.db.delete(rep._id)
    }

    // 8. Exclui o paciente
    await ctx.db.delete(args.id)
    return { success: true, id: args.id }
  },
})

