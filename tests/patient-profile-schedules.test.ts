import { expect, test } from 'vitest'
import { convexTest } from 'convex-test'
import schema from '../convex/schema'
import { api } from '../convex/_generated/api'

const modules = import.meta.glob('../convex/**/*.ts')

test('patient profile loads all enrolled classes independently of the agenda period', async () => {
  const now = Date.now()
  const t = convexTest(schema, modules)
  const ids = await t.run(async (ctx) => {
    const userId = await ctx.db.insert('users', { name: 'Admin', email: 'admin@example.invalid', role: 'admin', active: true, salt: 'test', passwordHash: 'test', createdAt: now })
    await ctx.db.insert('userSessions', { userId, token: 'staff', authVersion: 2, expiresAt: now + 86_400_000, createdAt: now })
    const roomId = await ctx.db.insert('rooms', { name: 'Studio Pilates e RPG', type: 'pilates_solo', capacity: 8, color: '#10b981', isActive: true })
    const professionalId = await ctx.db.insert('professionals', { name: 'Dani', email: '', phone: '', crefito: '', specialties: ['pilates'], commissionType: 'fixed', commissionValue: 0, active: true })
    const patientId = await ctx.db.insert('patients', { name: 'Stefanie', phone: '', documentCpf: '', birthDate: '1990-01-01', active: true, createdAt: now })
    const otherPatientId = await ctx.db.insert('patients', { name: 'Outra', phone: '', documentCpf: '', birthDate: '1990-01-01', active: true, createdAt: now })
    const dates = ['2026-09-14', '2026-09-16']
    for (const date of dates) {
      const scheduleId = await ctx.db.insert('schedules', { title: 'Turma 1', type: 'turma', specialty: 'pilates', roomId, professionalId, date, startTime: '08:00', endTime: '08:30', maxCapacity: 8, status: 'scheduled', recurringGroupId: 'series-1' })
      await ctx.db.insert('scheduleParticipants', { scheduleId, patientId, status: 'scheduled' })
      await ctx.db.insert('scheduleParticipants', { scheduleId, patientId: otherPatientId, status: 'scheduled' })
    }
    return { patientId }
  })

  const result = await t.query(api.schedules.listSchedulesForPatient, { sessionToken: 'staff', patientId: ids.patientId })

  expect(result.map((schedule) => schedule.date)).toEqual(['2026-09-14', '2026-09-16'])
  expect(result.every((schedule) => schedule.participants.length === 1)).toBe(true)
  expect(result[0]).toMatchObject({ roomName: 'Studio Pilates e RPG', professionalName: 'Dani' })
})
