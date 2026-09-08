import type { MutationCtx, QueryCtx } from '../_generated/server'
import type { Id } from '../_generated/dataModel'
import { normalizeCpf, normalizePhone, type PatientLoginType } from '../../shared/patientIdentity'
import { v } from 'convex/values'

export const credentialFields = { salt: v.string(), passwordHash: v.string() }
export async function findPatients(ctx: QueryCtx | MutationCtx, type: PatientLoginType, identifier: string) {
  const rows = type === 'cpf'
    ? await ctx.db.query('patients').withIndex('by_normalizedCpf', q => q.eq('normalizedCpf', identifier)).collect()
    : await ctx.db.query('patients').withIndex('by_normalizedPhone', q => q.eq('normalizedPhone', identifier)).collect()
  // Compatibility until migration processes every legacy row.
  const legacy = type === 'cpf'
    ? await ctx.db.query('patients').withIndex('by_normalizedCpf', q => q.eq('normalizedCpf', undefined)).collect()
    : await ctx.db.query('patients').withIndex('by_normalizedPhone', q => q.eq('normalizedPhone', undefined)).collect()
  return [...rows, ...legacy.filter(p => (type === 'cpf' ? normalizeCpf(p.documentCpf) : normalizePhone(p.phone)) === identifier)]
}
export async function ensurePatientCredential(ctx: MutationCtx, patientId: Id<'patients'>, credential: { salt: string; passwordHash: string }) {
  const existing = await ctx.db.query('patientCredentials').withIndex('by_patient', q => q.eq('patientId', patientId)).unique()
  if (existing) return false
  await ctx.db.insert('patientCredentials', { patientId, ...credential, updatedAt: Date.now() })
  return true
}
export async function revokePatientSessions(ctx: MutationCtx, patientId: Id<'patients'>) {
  const sessions = await ctx.db.query('patientSessions').withIndex('by_patient', q => q.eq('patientId', patientId)).collect()
  for (const session of sessions) await ctx.db.delete(session._id)
}
