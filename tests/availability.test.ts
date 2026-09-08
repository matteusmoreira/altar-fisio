import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { convexTest } from 'convex-test'
import schema from '../convex/schema'
import { api } from '../convex/_generated/api'

const modules = import.meta.glob('../convex/**/*.ts')
const now = Date.parse('2026-09-12T12:00:00Z')

beforeEach(() => vi.useFakeTimers({ now }))
afterEach(() => vi.useRealTimers())

async function fixture() {
  const t = convexTest(schema, modules)
  const ids = await t.run(async ctx => {
    const admin = await ctx.db.insert('users', { name: 'Admin', email: 'admin@example.invalid', role: 'admin', passwordHash: 'test', salt: 'test', active: true, createdAt: now })
    const professional = await ctx.db.insert('users', { name: 'Profissional', email: 'prof@example.invalid', role: 'professional', passwordHash: 'test', salt: 'test', active: true, createdAt: now })
    await ctx.db.insert('userSessions', { userId: admin, token: 'admin-token', authVersion: 2, expiresAt: now + 86_400_000, createdAt: now })
    await ctx.db.insert('userSessions', { userId: professional, token: 'professional-token', authVersion: 2, expiresAt: now + 86_400_000, createdAt: now })
    const roomId = await ctx.db.insert('rooms', { name: 'Sala', type: 'pilates_solo', capacity: 8, color: '#10B981', isActive: true })
    const professionalId = await ctx.db.insert('professionals', { name: 'Profissional', email: 'clinic@example.invalid', phone: '', crefito: 'TEST', specialties: ['pilates'], commissionType: 'fixed', commissionValue: 0, active: true })
    return { roomId, professionalId }
  })
  return { t, ...ids }
}

const rule = (f: Awaited<ReturnType<typeof fixture>>, sessionToken: string, extra = {}) => f.t.mutation(api.availability.saveRule, {
  sessionToken,
  professionalId: f.professionalId,
  roomId: f.roomId,
  specialty: 'pilates',
  dayOfWeek: 5,
  startTime: '08:00',
  endTime: '12:00',
  slotDurationMinutes: 30,
  breakMinutes: 0,
  isActive: true,
  ...extra,
})

test('non-admin receives an actionable permission error instead of generic server error', async () => {
  const f = await fixture()
  await expect(rule(f, 'professional-token')).rejects.toThrow('Somente administradores')
})

test('admin can save consecutive half-hour sessions with no break', async () => {
  const f = await fixture()
  await expect(rule(f, 'admin-token')).resolves.toMatchObject({ success: true })
})

test('admin receives the room conflict that blocks a duplicate weekly rule', async () => {
  const f = await fixture()
  await rule(f, 'admin-token')
  await expect(rule(f, 'admin-token')).rejects.toThrow('Conflito de Sala')
})

test('invalid time and interval values are rejected with actionable errors', async () => {
  const f = await fixture()
  await expect(rule(f, 'admin-token', { startTime: '12:00', endTime: '08:00' })).rejects.toThrow('horário de início')
  await expect(rule(f, 'admin-token', { breakMinutes: -5 })).rejects.toThrow('intervalo inteiro')
})
