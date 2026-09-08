import { query, mutation, internalMutation, internalQuery } from './_generated/server'
import { v, ConvexError } from 'convex/values'
import { requireStaff, requirePatient, hashToken } from './lib/security'
import { credentialFields, ensurePatientCredential, findPatients, revokePatientSessions } from './lib/patientCredentials'
import { normalizeCpf, normalizePhone } from '../shared/patientIdentity'

const loginFields = { type: v.union(v.literal('cpf'), v.literal('phone')), identifier: v.string() }
export const reserveAttempt = internalMutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const now = Date.now()
    const row = await ctx.db.query('authAttempts').withIndex('by_key', q => q.eq('key', key)).unique()
    if (row && row.resetAt > now && row.count >= 5) throw new ConvexError('Muitas tentativas. Aguarde 15 minutos.')
    const data = { key, count: row && row.resetAt > now ? row.count + 1 : 1, resetAt: row && row.resetAt > now ? row.resetAt : now + 15 * 60_000 }
    if (row) await ctx.db.patch(row._id, data)
    else await ctx.db.insert('authAttempts', data)
  },
})
export const lookup = internalQuery({
  args: loginFields,
  handler: async (ctx, args) => {
    const patients = await findPatients(ctx, args.type, args.identifier)
    if (patients.length > 1) return { ambiguous: true as const }
    const patient = patients[0]
    if (!patient?.active) return null
    const credential = await ctx.db.query('patientCredentials').withIndex('by_patient', q => q.eq('patientId', patient._id)).unique()
    return credential ? { ambiguous: false as const, ...credential } : null
  },
})
export const createSession = internalMutation({
  args: { ...loginFields, patientId: v.id('patients'), expectedHash: v.string(), tokenHash: v.string() },
  handler: async (ctx, args) => {
    const patients = await findPatients(ctx, args.type, args.identifier)
    const credential = await ctx.db.query('patientCredentials').withIndex('by_patient', q => q.eq('patientId', args.patientId)).unique()
    if (patients.length !== 1 || patients[0]._id !== args.patientId || !patients[0].active || credential?.passwordHash !== args.expectedHash) throw new ConvexError('Credenciais inválidas.')
    const now = Date.now()
    await ctx.db.insert('patientSessions', { patientId: args.patientId, tokenHash: args.tokenHash, authVersion: 2, createdAt: now, expiresAt: now + 24 * 60 * 60_000 })
  },
})
export const setPassword = internalMutation({
  args: { sessionToken: v.string(), patientId: v.id('patients'), ...credentialFields },
  handler: async (ctx, args) => {
    const user = await requireStaff(ctx, args.sessionToken, ['admin'])
    const patient = await ctx.db.get(args.patientId)
    if (!patient) throw new ConvexError('Paciente não encontrado.')
    const credential = await ctx.db.query('patientCredentials').withIndex('by_patient', q => q.eq('patientId', args.patientId)).unique()
    if (credential) await ctx.db.patch(credential._id, { salt: args.salt, passwordHash: args.passwordHash, updatedAt: Date.now() })
    else await ensurePatientCredential(ctx, args.patientId, { salt: args.salt, passwordHash: args.passwordHash })
    await revokePatientSessions(ctx, args.patientId)
    await ctx.db.insert('auditLogs', { userId: user._id, userName: user.name, userRole: user.role, patientId: patient._id, action: 'patient_portal_password_changed', timestamp: Date.now() })
  },
})
export const migrationPage = internalQuery({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => ctx.db.query('patients').paginate({ cursor: args.cursor, numItems: 25 }),
})
export const migratePatient = internalMutation({
  args: { patientId: v.id('patients'), ...credentialFields },
  handler: async (ctx, args) => {
    const patient = await ctx.db.get(args.patientId)
    if (!patient) return { created: false, duplicateCpf: false }
    const normalizedCpf = normalizeCpf(patient.documentCpf)
    const normalizedPhone = normalizePhone(patient.phone)
    const duplicateCpf = !!normalizedCpf && (await findPatients(ctx, 'cpf', normalizedCpf)).length > 1
    await ctx.db.patch(patient._id, { normalizedCpf, normalizedPhone })
    const created = await ensurePatientCredential(ctx, patient._id, { salt: args.salt, passwordHash: args.passwordHash })
    const sessions = await ctx.db.query('patientSessions').withIndex('by_patient', q => q.eq('patientId', patient._id)).collect()
    for (const session of sessions) if (session.authVersion !== 2) await ctx.db.delete(session._id)
    return { created, duplicateCpf }
  },
})
export const current = query({
  args: { portalToken: v.string() },
  handler: async (ctx, args) => {
    try { const patient = await requirePatient(ctx, args.portalToken); return { _id: patient._id } }
    catch { return null }
  },
})
export const logout = mutation({
  args: { portalToken: v.string() },
  handler: async (ctx, args) => {
    const tokenHash = await hashToken(args.portalToken)
    const session = await ctx.db.query('patientSessions').withIndex('by_tokenHash', q => q.eq('tokenHash', tokenHash)).first()
    if (session) await ctx.db.delete(session._id)
  },
})
