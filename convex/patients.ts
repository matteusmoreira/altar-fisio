import { requireStaff, requireStaffAction } from './lib/security'
import { query, mutation, action, internalMutation } from "./_generated/server"
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { credentialFields, ensurePatientCredential, findPatients, revokePatientSessions } from './lib/patientCredentials'
import { isValidCpf, isValidPhone, normalizeCpf, normalizePhone } from '../shared/patientIdentity'
import { v, ConvexError } from "convex/values"

export const listPatients = query({
  args: { sessionToken: v.string(),  search: v.optional(v.string()) },
  handler: async (ctx, input) => {
    const { sessionToken, ...args } = input
    await requireStaff(ctx, sessionToken, ["admin","professional","reception"]);

    if (!args.search || args.search.trim() === "") {
      return await ctx.db
        .query("patients")
        .withIndex("by_name")
        .collect()
    }

    const term = args.search.trim()
    const cleanDigits = term.replace(/\D/g, "")

    // Search normalized identifiers, including legacy formatted records.
    if (cleanDigits.length >= 10) {
      const byCpf = cleanDigits.length === 11 ? await findPatients(ctx, 'cpf', cleanDigits) : []
      const byPhone = await findPatients(ctx, 'phone', normalizePhone(term))
      const found = [...new Map([...byCpf, ...byPhone].map(p => [p._id, p])).values()]
      if (found.length) return found
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
  args: { sessionToken: v.string(),  id: v.id("patients") },
  handler: async (ctx, input) => {
    const { sessionToken, ...args } = input
    await requireStaff(ctx, sessionToken, ["admin","professional","reception"]);

    return await ctx.db.get(args.id)
  },
})

const createPatientArgs = { sessionToken: v.string(),
    name: v.string(),
    documentCpf: v.string(),
    phone: v.string(),
    email: v.optional(v.string()),
    birthDate: v.string(),
    gender: v.optional(v.string()),
    cep: v.optional(v.string()),
    address: v.optional(v.string()),
    emergencyContact: v.optional(v.string()),
    emergencyPhone: v.optional(v.string()),
    healthInsurance: v.optional(v.string()),
    notes: v.optional(v.string()),
  }
export const createPatient = action({
  args: createPatientArgs,
  handler: async (ctx, args): Promise<Id<'patients'>> => {
    await requireStaffAction(ctx, args.sessionToken, ['admin', 'professional', 'reception'])
    if (!isValidCpf(args.documentCpf) || !isValidPhone(args.phone)) throw new ConvexError('CPF ou telefone inválido.')
    const credential = await ctx.runAction(internal.portalAuth.prepareDefault, {})
    return ctx.runMutation(internal.patients.insertPatient, { ...args, credential })
  },
})
export const insertPatient = internalMutation({
  args: { ...createPatientArgs, credential: v.object(credentialFields) },
  handler: async (ctx, input) => {
    const { sessionToken, credential, ...args } = input
    await requireStaff(ctx, sessionToken, ["admin","professional","reception"]);

    if (!args.name.trim() || !isValidCpf(args.documentCpf) || !isValidPhone(args.phone)) throw new ConvexError('Nome, CPF e telefone válidos são obrigatórios.')
    const normalizedCpf = normalizeCpf(args.documentCpf)
    const normalizedPhone = normalizePhone(args.phone)
    if ((await findPatients(ctx, 'cpf', normalizedCpf)).length) throw new ConvexError('Já existe paciente com este CPF.')
    const patientId = await ctx.db.insert("patients", {
      ...args,
      documentCpf: normalizedCpf,
      phone: normalizedPhone,
      normalizedCpf,
      normalizedPhone,
      active: true,
      createdAt: Date.now(),
    })
    await ensurePatientCredential(ctx, patientId, credential)
    return patientId
  },
})

export const updatePatient = mutation({
  args: { sessionToken: v.string(),
    id: v.id("patients"),
    name: v.optional(v.string()),
    documentCpf: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    birthDate: v.optional(v.string()),
    gender: v.optional(v.string()),
    cep: v.optional(v.string()),
    address: v.optional(v.string()),
    emergencyContact: v.optional(v.string()),
    emergencyPhone: v.optional(v.string()),
    healthInsurance: v.optional(v.string()),
    notes: v.optional(v.string()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, input) => {
    const { sessionToken, ...args } = input
    await requireStaff(ctx, sessionToken, ["admin"]);

    const { id, ...data } = args
    for (const key of Object.keys(data)) if (data[key as keyof typeof data] === undefined) delete data[key as keyof typeof data]
    if (data.name !== undefined && !data.name.trim()) throw new ConvexError('Nome obrigatório.')
    if (!await ctx.db.get(id)) throw new ConvexError('Paciente não encontrado.')
    if (data.documentCpf !== undefined) {
      if (!isValidCpf(data.documentCpf)) throw new ConvexError('CPF inválido.')
      data.documentCpf = normalizeCpf(data.documentCpf)
      if ((await findPatients(ctx, 'cpf', data.documentCpf)).some(p => p._id !== id)) throw new ConvexError('Já existe paciente com este CPF.')
    }
    if (data.phone !== undefined) {
      if (!isValidPhone(data.phone)) throw new ConvexError('Telefone inválido.')
      data.phone = normalizePhone(data.phone)
    }
    await ctx.db.patch(id, { ...data, ...(data.documentCpf !== undefined ? { normalizedCpf: data.documentCpf } : {}), ...(data.phone !== undefined ? { normalizedPhone: data.phone } : {}) })
    if (data.active === false || data.documentCpf !== undefined || data.phone !== undefined) await revokePatientSessions(ctx, id)
    return id
  },
})

// Exclusão com cascata completa para manter o banco Convex sem arquivos ou registros órfãos
export const deletePatient = mutation({
  args: { sessionToken: v.string(),
    id: v.id("patients"),
  },
  handler: async (ctx, input) => {
    const { sessionToken, ...args } = input
    await requireStaff(ctx, sessionToken, ["admin"]);

    const patient = await ctx.db.get(args.id)
    if (!patient) throw new ConvexError("Paciente não encontrado")

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
    await revokePatientSessions(ctx, args.id)
    const credentials = await ctx.db.query('patientCredentials').withIndex('by_patient', q => q.eq('patientId', args.id)).collect()
    for (const credential of credentials) await ctx.db.delete(credential._id)
    await ctx.db.delete(args.id)
    return { success: true, id: args.id }
  },
})

