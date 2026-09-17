import { expect, test } from 'vitest'
import { convexTest } from 'convex-test'
import schema from '../convex/schema'
import { api, internal } from '../convex/_generated/api'

const modules = import.meta.glob('../convex/**/*.ts')

async function fixture(role: 'admin' | 'reception' | 'professional' = 'admin') {
  const t = convexTest(schema, modules)
  const ids = await t.run(async (ctx) => {
    const userId = await ctx.db.insert('users', {
      name: 'Operador Teste',
      email: 'operador@example.invalid',
      role,
      active: true,
      salt: 'salt',
      passwordHash: 'hash',
      createdAt: Date.now(),
    })
    await ctx.db.insert('userSessions', {
      userId,
      token: 'staff_token',
      authVersion: 2,
      expiresAt: Date.now() + 86400000,
      createdAt: Date.now(),
    })
    const patientId = await ctx.db.insert('patients', {
      name: 'Paciente Teste',
      phone: '22999021889',
      active: true,
      birthDate: '1990-01-01',
      documentCpf: '12345678901',
      createdAt: Date.now(),
    })
    const profId = await ctx.db.insert('professionals', {
      name: 'Dr. Teste',
      email: 'dr@example.invalid',
      phone: '22999021889',
      crefito: '12345-F',
      specialties: ['fisioterapia'],
      commissionType: 'percentage',
      commissionValue: 50,
      active: true,
    })
    const roomId = await ctx.db.insert('rooms', {
      name: 'Sala 1',
      type: 'fisioterapia',
      capacity: 5,
      isActive: true,
      color: '#10b981',
    })
    const scheduleId = await ctx.db.insert('schedules', {
      date: '2026-09-20',
      startTime: '08:00',
      endTime: '09:00',
      roomId,
      professionalId: profId,
      status: 'scheduled',
      type: 'individual',
      maxCapacity: 1,
      specialty: 'fisioterapia',
      title: 'Fisioterapia 08:00',
    })

    const jobUncertain = await ctx.db.insert('appointmentJobs', {
      patientId,
      scheduleId,
      kind: 'reminder_24h',
      status: 'uncertain',
      dueAt: Date.now() - 1000,
      fingerprint: 'fp1',
      error: 'Envio não confirmado pelo provedor. Confira o WhatsApp antes de reenviar.',
    })

    const jobFailed = await ctx.db.insert('appointmentJobs', {
      patientId,
      scheduleId,
      kind: 'reminder_1h',
      status: 'failed',
      dueAt: Date.now() - 500,
      fingerprint: 'fp2',
      error: 'WhatsApp ausente ou inválido.',
    })

    const jobSent = await ctx.db.insert('appointmentJobs', {
      patientId,
      scheduleId,
      kind: 'reminder_30m',
      status: 'sent',
      dueAt: Date.now() - 2000,
      fingerprint: 'fp3',
    })

    return { userId, patientId, scheduleId, jobUncertain, jobFailed, jobSent }
  })
  return { t, ...ids }
}

test('admin can clear all problem jobs (failed, uncertain, sending) via clearProblems mutation', async () => {
  const f = await fixture('admin')

  // Verifica que os problemas existem na query problems
  const beforeProblems = await f.t.query(api.appointmentNotifications.problems, { sessionToken: 'staff_token' })
  expect(beforeProblems.length).toBe(2)

  // Executa clearProblems
  const result = await f.t.mutation(api.appointmentNotifications.clearProblems, { sessionToken: 'staff_token' })
  expect(result).toEqual({ count: 2 })

  // Verifica que a query problems agora retorna vazia
  const afterProblems = await f.t.query(api.appointmentNotifications.problems, { sessionToken: 'staff_token' })
  expect(afterProblems.length).toBe(0)

  // Verifica que o job com status 'sent' foi preservado intacto
  const sentJob = await f.t.run(async (ctx) => ctx.db.get(f.jobSent))
  expect(sentJob).not.toBeNull()
  expect(sentJob?.status).toBe('sent')
})

test('clearProblemsInternal cleans up problem jobs without requiring a session token', async () => {
  const f = await fixture('admin')

  const result = await f.t.mutation(internal.appointmentNotifications.clearProblemsInternal, {})
  expect(result).toEqual({ count: 2 })

  const afterProblems = await f.t.query(api.appointmentNotifications.problems, { sessionToken: 'staff_token' })
  expect(afterProblems.length).toBe(0)
})

test('professional role is rejected from calling clearProblems', async () => {
  const f = await fixture('professional')

  await expect(
    f.t.mutation(api.appointmentNotifications.clearProblems, { sessionToken: 'staff_token' })
  ).rejects.toThrow()
})
