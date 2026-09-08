import { action, query, mutation, internalMutation } from './_generated/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'
import { requireStaff, requireStaffAction, requirePatient, hashToken } from './lib/security'

export const issueLink = action({
  args: { sessionToken: v.string(), patientId: v.id('patients') },
  handler: async (ctx, args): Promise<{token: string; expiresAt: number}> => {
    await requireStaffAction(ctx, args.sessionToken, ['admin', 'reception', 'professional'])
    const bytes = crypto.getRandomValues(new Uint8Array(32))
    const token = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
    const expiresAt = Date.now() + 24 * 60 * 60_000
    await ctx.runMutation(internal.portalAccess.saveLink, { ...args, tokenHash: await hashToken(token), expiresAt })
    return { token, expiresAt }
  },
})
export const saveLink = internalMutation({
  args: { sessionToken: v.string(), patientId: v.id('patients'), tokenHash: v.string(), expiresAt: v.number() },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken, ['admin', 'reception', 'professional'])
    const patient = await ctx.db.get(args.patientId)
    if (!patient?.active) throw new Error('Paciente inativo ou inexistente.')
    const previous = await ctx.db.query('patientSessions').withIndex('by_patient', q => q.eq('patientId', patient._id)).collect()
    for (const session of previous) await ctx.db.delete(session._id)
    await ctx.db.insert('patientSessions', { patientId: patient._id, tokenHash: args.tokenHash, expiresAt: args.expiresAt, createdAt: Date.now() })
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
