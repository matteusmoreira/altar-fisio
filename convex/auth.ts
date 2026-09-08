import { query, mutation, internalMutation } from './_generated/server'
import { v } from 'convex/values'
import { sessionUser } from './lib/security'

export const getCurrentUser = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await sessionUser(ctx, args.token)
    if (!user) return null
    const prof = user.professionalId ? await ctx.db.get(user.professionalId) : null
    return { id: user._id, name: user.name, email: user.email, role: user.role, avatarUrl: user.avatarUrl, professionalId: user.professionalId, crefito: prof?.crefito, specialties: prof?.specialties }
  },
})
export const logout = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db.query('userSessions').withIndex('by_token', q => q.eq('token', args.token)).first()
    if (session) await ctx.db.delete(session._id)
    return { success: true }
  },
})
export const reserveLoginAttempt = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const now = Date.now()
    const global = await ctx.db.query('authAttempts').withIndex('by_key', q => q.eq('key', 'login:global')).first()
    const account = await ctx.db.query('authAttempts').withIndex('by_key', q => q.eq('key', `login:${email}`)).first()
    if ((global && global.resetAt > now && global.count >= 100) || (account && account.resetAt > now && account.count >= 5)) throw new Error('Muitas tentativas. Aguarde 15 minutos.')
    for (const [key, row] of [['login:global', global], [`login:${email}`, account]] as const) {
      const data = { key, count: row && row.resetAt > now ? row.count + 1 : 1, resetAt: row && row.resetAt > now ? row.resetAt : now + 15 * 60_000 }
      if (row) await ctx.db.patch(row._id, data)
      else await ctx.db.insert('authAttempts', data)
    }
    return await ctx.db.query('users').withIndex('by_email', q => q.eq('email', email)).first()
  },
})
export const createSession = internalMutation({
  args: { userId: v.id('users'), expectedHash: v.string(), token: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId)
    if (!user?.active || user.passwordHash !== args.expectedHash) throw new Error('Credenciais inválidas.')
    await ctx.db.insert('userSessions', { userId: user._id, token: args.token, expiresAt: Date.now() + 8 * 60 * 60_000, createdAt: Date.now(), authVersion: 2 })
    const attempts = await ctx.db.query('authAttempts').withIndex('by_key', q => q.eq('key', `login:${user.email}`)).first()
    if (attempts) await ctx.db.delete(attempts._id)
  },
})
export const persistUser = internalMutation({
  args: { email: v.string(), name: v.string(), role: v.union(v.literal('admin'), v.literal('professional'), v.literal('reception')), professionalId: v.optional(v.id('professionals')), salt: v.string(), passwordHash: v.string() },
  handler: async (ctx, args) => {
    if (args.professionalId && !await ctx.db.get(args.professionalId)) throw new Error('Profissional inválido.')
    const user = await ctx.db.query('users').withIndex('by_email', q => q.eq('email', args.email)).first()
    if (!user) return await ctx.db.insert('users', { ...args, active: true, createdAt: Date.now() })
    await ctx.db.patch(user._id, { ...args, active: true })
    const sessions = await ctx.db.query('userSessions').withIndex('by_user', q => q.eq('userId', user._id)).collect()
    for (const session of sessions) await ctx.db.delete(session._id)
    return user._id
  },
})
