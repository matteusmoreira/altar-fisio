import { expect, test } from 'vitest'
import { convexTest } from 'convex-test'
import schema from '../convex/schema'
import { api } from '../convex/_generated/api'
const modules = import.meta.glob('../convex/**/*.ts')

async function fixture(role: 'admin' | 'reception' | 'professional' = 'admin') {
  const t = convexTest(schema, modules)
  const ids = await t.run(async ctx => {
    const userId = await ctx.db.insert('users', { name: 'Teste', email: 'test@example.invalid', role, active: true, salt: 'test', passwordHash: 'test', createdAt: Date.now() })
    await ctx.db.insert('userSessions', { userId, token: 'staff', authVersion: 2, expiresAt: Date.now() + 86400000, createdAt: Date.now() })
    const patientId = await ctx.db.insert('patients', { name: 'Paciente', documentCpf: '', phone: '', birthDate: '', active: true, createdAt: Date.now() })
    const roomId = await ctx.db.insert('rooms', { name: 'Sala', type: 'fisioterapia', capacity: 2, color: '', isActive: true })
    const professionalId = await ctx.db.insert('professionals', { name: 'Profissional', email: '', phone: '', crefito: '', specialties: ['fisioterapia'], commissionType: 'fixed', commissionValue: 0, active: true })
    const schedule = { title: 'Sessão', type: 'turma' as const, specialty: 'fisioterapia' as const, roomId, professionalId, date: '2026-09-14', startTime: '08:00', endTime: '08:30', maxCapacity: 2, status: 'scheduled' as const, recurringGroupId: 'series' }
    const scheduleId = await ctx.db.insert('schedules', schedule)
    const otherScheduleId = await ctx.db.insert('schedules', { ...schedule, date: '2026-09-15' })
    const participantId = await ctx.db.insert('scheduleParticipants', { patientId, scheduleId, status: 'scheduled' })
    const bookingId = await ctx.db.insert('publicBookings', { patientId, scheduleId, status: 'confirmed', date: schedule.date, startTime: schedule.startTime, endTime: schedule.endTime, answers: [], createdAt: Date.now() })
    return { patientId, scheduleId, otherScheduleId, participantId, bookingId }
  })
  return { t, ...ids }
}

test.each(['pending_approval', 'confirmed', 'rejected'] as const)('admin deletes %s request while preserving the appointment and patient', async status => {
  const f = await fixture()
  await f.t.run(ctx => ctx.db.patch(f.bookingId, { status }))
  await f.t.mutation(api.bookingBuilder.deletePublicBooking, { sessionToken: 'staff', bookingId: f.bookingId })
  await f.t.run(async ctx => {
    expect(await ctx.db.get(f.bookingId)).toBeNull()
    for (const id of [f.patientId, f.scheduleId, f.participantId]) expect(await ctx.db.get(id)).not.toBeNull()
    expect((await ctx.db.query('auditLogs').collect())[0].action).toBe('public_booking_deleted')
  })
})

test.each(['reception', 'professional'] as const)('rejects request deletion by %s', async role => {
  const f = await fixture(role)
  await expect(f.t.mutation(api.bookingBuilder.deletePublicBooking, { sessionToken: 'staff', bookingId: f.bookingId })).rejects.toThrow(/permissão/)
  expect(await f.t.run(ctx => ctx.db.get(f.bookingId))).not.toBeNull()
})

test('rejects unauthenticated deletion and allows admin to remove only the selected schedule', async () => {
  const f = await fixture()
  await expect(f.t.mutation(api.bookingBuilder.deletePublicBooking, { sessionToken: 'invalid', bookingId: f.bookingId })).rejects.toThrow(/Sessão/)
  await f.t.mutation(api.schedules.deleteSchedule, { sessionToken: 'staff', id: f.scheduleId })
  await f.t.run(async ctx => {
    expect(await ctx.db.get(f.scheduleId)).toBeNull()
    expect(await ctx.db.get(f.participantId)).toBeNull()
    for (const id of [f.otherScheduleId, f.patientId, f.bookingId]) expect(await ctx.db.get(id)).not.toBeNull()
  })
})
