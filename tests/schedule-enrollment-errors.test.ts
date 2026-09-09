import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { convexTest } from 'convex-test'
import schema from '../convex/schema'
import { api } from '../convex/_generated/api'

const modules = import.meta.glob('../convex/**/*.ts')
const now = Date.parse('2026-09-09T15:00:00Z')
beforeEach(() => vi.useFakeTimers({ now }))
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers() })
async function fixture() {
  const t = convexTest(schema, modules)
  const ids = await t.run(async ctx => {
    const userId = await ctx.db.insert('users', { name: 'Admin', email: 'admin@example.invalid', role: 'admin', active: true, salt: 'test', passwordHash: 'test', createdAt: now })
    await ctx.db.insert('userSessions', { userId, token: 'staff', authVersion: 2, expiresAt: now + 86400000, createdAt: now })
    const roomId = await ctx.db.insert('rooms', { name: 'Sala', type: 'pilates_solo', capacity: 8, color: '', isActive: true })
    const professionalId = await ctx.db.insert('professionals', { name: 'Profissional', email: 'prof@example.invalid', phone: '', crefito: 'test', specialties: ['pilates'], commissionType: 'fixed', commissionValue: 0, active: true })
    const patientId = await ctx.db.insert('patients', { name: 'Paciente', phone: '', documentCpf: '00000000000', birthDate: '1990-01-01', active: true, createdAt: now })
    const scheduleId = await ctx.db.insert('schedules', { title: 'Turma', type: 'turma', specialty: 'pilates', roomId, professionalId, date: '2026-09-10', startTime: '08:00', endTime: '08:30', maxCapacity: 1, status: 'scheduled' })
    return { patientId, scheduleId }
  })
  const enroll = (extra = {}) => t.mutation(api.schedules.addParticipantToSchedule, { sessionToken: 'staff', ...ids, isReplacement: false, ...extra })
  return { t, ...ids, enroll }
}

test('reproduces the screenshot time and returns the reason as public error data', async () => {
  const f = await fixture()
  await f.t.run(ctx => ctx.db.patch(f.scheduleId, { date: '2026-09-09' }))
  await expect(f.enroll()).rejects.toMatchObject({ data: expect.stringContaining('horário já começou ou passou') })
  expect(await f.t.run(ctx => ctx.db.query('scheduleParticipants').collect())).toHaveLength(0)
})

test('future enrollment persists once and explains duplicate before capacity', async () => {
  const f = await fixture()
  const id = await f.enroll()
  expect(await f.t.run(ctx => ctx.db.get(id))).toMatchObject({ patientId: f.patientId, status: 'scheduled' })
  await expect(f.enroll()).rejects.toMatchObject({ data: expect.stringContaining('já está agendado') })
  const second = await f.t.run(ctx => ctx.db.insert('patients', { name: 'Outro', phone: '', documentCpf: '00000000000', birthDate: '1990-01-01', active: true, createdAt: now }))
  await expect(f.enroll({ patientId: second })).rejects.toMatchObject({ data: expect.stringContaining('lotada') })
  expect(await f.t.run(ctx => ctx.db.query('scheduleParticipants').collect())).toHaveLength(1)
})

test('session expiration, inactive patient and missing replacement credit are explained', async () => {
  const f = await fixture()
  await expect(f.enroll({ sessionToken: 'expired' })).rejects.toMatchObject({ data: expect.stringContaining('Sessão inválida ou expirada') })
  await expect(f.enroll({ isReplacement: true })).rejects.toMatchObject({ data: expect.stringContaining('Selecione um crédito') })
  await f.t.run(ctx => ctx.db.patch(f.patientId, { active: false }))
  await expect(f.enroll()).rejects.toMatchObject({ data: expect.stringContaining('paciente está inativo') })
})

test.each(['cancelled', 'completed'] as const)('explains unavailable session status: %s', async status => {
  const f = await fixture()
  await f.t.run(ctx => ctx.db.patch(f.scheduleId, { status }))
  await expect(f.enroll()).rejects.toMatchObject({ data: expect.stringContaining('cancelada ou concluída') })
})
