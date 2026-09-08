"use node"
import { action, internalAction } from './_generated/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password, salt, 64,
    { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 },
    (error, key) => error ? reject(error) : resolve(key)))
}
export const login = action({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, args): Promise<{token: string; user: any}> => {
    const email = args.email.trim().toLowerCase()
    if (!email || email.length > 254 || args.password.length > 256) throw new Error('Credenciais inválidas.')
    const user = await ctx.runMutation(internal.auth.reserveLoginAttempt, { email })
    if (!user?.active || !user.passwordHash.startsWith('scrypt-v1:')) throw new Error('Credenciais inválidas.')
    const expected = Buffer.from(user.passwordHash.slice('scrypt-v1:'.length), 'hex')
    const actual = await derive(args.password, user.salt)
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new Error('Credenciais inválidas.')
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
    const salt = randomBytes(32).toString('hex')
    const passwordHash = `scrypt-v1:${(await derive(args.password, salt)).toString('hex')}`
    return await ctx.runMutation(internal.auth.persistUser, { email, name: args.name.trim(), role: args.role, professionalId: args.professionalId, salt, passwordHash })
  },
})
