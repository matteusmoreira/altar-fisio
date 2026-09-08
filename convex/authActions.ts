"use node"
import { action, internalAction } from './_generated/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'
import { randomBytes } from 'node:crypto'
import { hashPassword, verifyPassword } from './lib/password'
export const login = action({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, args): Promise<{token: string; user: any}> => {
    const email = args.email.trim().toLowerCase()
    if (!email || email.length > 254 || args.password.length > 256) throw new Error('Credenciais inválidas.')
    const user = await ctx.runMutation(internal.auth.reserveLoginAttempt, { email })
    if (!user?.active || !user.passwordHash.startsWith('scrypt-v1:')) throw new Error('Credenciais inválidas.')
    if (!await verifyPassword(args.password, user.salt, user.passwordHash)) throw new Error('Credenciais inválidas.')
    const token = randomBytes(32).toString('hex')
    await ctx.runMutation(internal.auth.createSession, { userId: user._id, expectedHash: user.passwordHash, token })
    return { token, user: { id: user._id, name: user.name, email: user.email, role: user.role, professionalId: user.professionalId, avatarUrl: user.avatarUrl } }
  },
})
// Deployment-owner operation. Never exposed to the browser.
export const provisionUser = internalAction({
  args: { email: v.string(), name: v.string(), password: v.string(), role: v.union(v.literal('admin'), v.literal('professional'), v.literal('reception')), professionalId: v.optional(v.id('professionals')) },
  handler: async (ctx, args): Promise<string> => {
    if (args.password.length < 12 || args.password.length > 256) throw new Error('Use senha exclusiva com 12 a 256 caracteres.')
    const email = args.email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !args.name.trim()) throw new Error('Dados de usuário inválidos.')
    const { salt, passwordHash } = await hashPassword(args.password)
    return await ctx.runMutation(internal.auth.persistUser, { email, name: args.name.trim(), role: args.role, professionalId: args.professionalId, salt, passwordHash })
  },
})
