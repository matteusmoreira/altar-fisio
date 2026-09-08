"use node"
import { action, internalAction } from './_generated/server'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { v, ConvexError } from 'convex/values'
import { randomBytes } from 'node:crypto'
import { hashPassword, verifyPassword } from './lib/password'
import { hashToken, requireStaffAction } from './lib/security'
import { DEFAULT_PATIENT_PASSWORD, isValidCpf, isValidPhone, normalizeCpf, normalizePhone } from '../shared/patientIdentity'

export const prepareDefault = internalAction({ args: {}, handler: async () => hashPassword(DEFAULT_PATIENT_PASSWORD) })
export const login = action({
  args: { type: v.union(v.literal('cpf'), v.literal('phone')), identifier: v.string(), password: v.string() },
  handler: async (ctx, args): Promise<{ token: string }> => {
    if (args.identifier.length > 32 || args.password.length > 256) throw new ConvexError('Credenciais inválidas.')
    const identifier = args.type === 'cpf' ? normalizeCpf(args.identifier) : normalizePhone(args.identifier)
    await ctx.runMutation(internal.portalAccess.reserveAttempt, { key: `patient-login:${args.type}:${identifier}` })
    if (!(args.type === 'cpf' ? isValidCpf(identifier) : isValidPhone(identifier))) throw new ConvexError('Credenciais inválidas.')
    const credential = await ctx.runQuery(internal.portalAccess.lookup, { type: args.type, identifier })
    if (credential?.ambiguous) throw new ConvexError(args.type === 'phone' ? 'Este telefone é compartilhado. Entre usando seu CPF.' : 'Não foi possível entrar. Procure a clínica para conferir seu cadastro.')
    const valid = await verifyPassword(args.password, credential?.salt ?? 'patient-portal-invalid', credential?.passwordHash ?? '')
    if (!credential || !valid) throw new ConvexError('Credenciais inválidas.')
    const token = randomBytes(32).toString('hex')
    await ctx.runMutation(internal.portalAccess.createSession, { type: args.type, identifier, patientId: credential.patientId, expectedHash: credential.passwordHash, tokenHash: await hashToken(token) })
    return { token }
  },
})
export const changePassword = action({
  args: { sessionToken: v.string(), patientId: v.id('patients'), password: v.string() },
  handler: async (ctx, args): Promise<void> => {
    await requireStaffAction(ctx, args.sessionToken, ['admin'])
    if (args.password.length < 9 || args.password.length > 256) throw new ConvexError('Use uma senha de 9 a 256 caracteres.')
    const credential = await hashPassword(args.password)
    await ctx.runMutation(internal.portalAccess.setPassword, { sessionToken: args.sessionToken, patientId: args.patientId, ...credential })
  },
})
export const migrateExisting = internalAction({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, args): Promise<{ cursor: string; done: boolean; created: number; duplicatePatientIds: Id<'patients'>[] }> => {
    const page = await ctx.runQuery(internal.portalAccess.migrationPage, { cursor: args.cursor ?? null })
    let created = 0
    const duplicatePatientIds: Id<'patients'>[] = []
    for (const patient of page.page) {
      const credential = await hashPassword(DEFAULT_PATIENT_PASSWORD)
      const result = await ctx.runMutation(internal.portalAccess.migratePatient, { patientId: patient._id, ...credential })
      if (result.created) created++
      if (result.duplicateCpf) duplicatePatientIds.push(patient._id)
    }
    return { cursor: page.continueCursor, done: page.isDone, created, duplicatePatientIds }
  },
})
