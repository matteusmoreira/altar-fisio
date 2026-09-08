import type { QueryCtx, MutationCtx, ActionCtx } from '../_generated/server'
import type { Doc } from '../_generated/dataModel'
import { internal } from '../_generated/api'

export type StaffRole = 'admin' | 'professional' | 'reception'
export async function sessionUser(ctx: QueryCtx | MutationCtx, token?: string): Promise<Doc<'users'> | null> {
  if (!token || token.length > 128) return null
  const session = await ctx.db.query('userSessions').withIndex('by_token', q => q.eq('token', token)).first()
  if (!session || session.authVersion !== 2 || session.expiresAt <= Date.now()) return null
  const user = await ctx.db.get(session.userId)
  return user?.active ? user : null
}
export async function requireStaff(ctx: QueryCtx | MutationCtx, token: string, roles: readonly StaffRole[]): Promise<Doc<'users'>> {
  const user = await sessionUser(ctx, token)
  if (!user) throw new Error('Sessão inválida ou expirada. Entre novamente.')
  if (!roles.includes(user.role)) throw new Error('Você não tem permissão para esta operação.')
  return user
}
export async function requireStaffAction(ctx: ActionCtx, token: string, roles: readonly StaffRole[]): Promise<Doc<'users'>> {
  const user: Doc<'users'> | null = await ctx.runQuery(internal.security.getSessionUser, { token })
  if (!user) throw new Error('Sessão inválida ou expirada. Entre novamente.')
  if (!roles.includes(user.role)) throw new Error('Você não tem permissão para esta operação.')
  return user
}
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}
export async function requirePatient(ctx: QueryCtx | MutationCtx, token: string, patientId?: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('Acesso ao portal inválido ou expirado.')
  const digest = await hashToken(token)
  const session = await ctx.db.query('patientSessions').withIndex('by_tokenHash', q => q.eq('tokenHash', digest)).first()
  if (!session || session.expiresAt <= Date.now() || (patientId && patientId !== session.patientId)) {
    throw new Error('Acesso ao portal inválido ou expirado.')
  }
  const patient = await ctx.db.get(session.patientId)
  if (!patient?.active) throw new Error('Acesso ao portal inválido ou expirado.')
  return patient
}
