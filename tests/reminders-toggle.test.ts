import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { convexTest } from 'convex-test'
import schema from '../convex/schema'
import { api, internal } from '../convex/_generated/api'
import { hashToken } from '../convex/lib/security'
import { prepareReminders } from '../convex/lib/appointmentJobs'

const modules = import.meta.glob('../convex/**/*.ts')
const now = Date.parse('2026-09-09T10:00:00Z')

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(now) })
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

async function fixture() {
  const t = convexTest(schema, modules)
  const data = await t.run(async ctx => {
    const settingsId = await ctx.db.insert('clinicSettings', {
      clinicName: 'Clínica de teste',
      clinicSubtitle: '',
      primaryColor: '',
      colorPreset: '',
      mode: 'light',
      cancellationNoticeHours: 2,
      replacementExpiryDays: 30,
    })
    for (const role of ['admin', 'reception'] as const) {
      const userId = await ctx.db.insert('users', { name: role, email: `${role}@example.invalid`, role, active: true, salt: 'test', passwordHash: 'test', createdAt: now })
      await ctx.db.insert('userSessions', { userId, token: role, authVersion: 2, expiresAt: now + 7 * 86400000, createdAt: now })
    }
    const roomId = await ctx.db.insert('rooms', { name: 'Sala de teste', type: 'pilates_solo', capacity: 4, color: '', isActive: true })
    const professionalId = await ctx.db.insert('professionals', { name: 'Profissional teste', email: 'teste@example.invalid', phone: '', crefito: 'TESTE', specialties: ['pilates'], commissionType: 'fixed', commissionValue: 0, active: true })
    const scheduleData = { title: 'Pilates', type: 'turma' as const, specialty: 'pilates' as const, roomId, professionalId, startTime: '14:00', endTime: '15:00', maxCapacity: 1, status: 'scheduled' as const, isRecurring: true, recurringGroupId: 'series' }
    const target = await ctx.db.insert('schedules', { ...scheduleData, date: '2026-09-09' })
    const tomorrow = await ctx.db.insert('schedules', { ...scheduleData, date: '2026-09-10' })
    const patientId = await ctx.db.insert('patients', { name: 'Paciente 1', documentCpf: '12345678901', phone: '11987654321', birthDate: '1990-01-01', active: true, createdAt: now })
    const participantId = await ctx.db.insert('scheduleParticipants', { scheduleId: target, patientId, status: 'scheduled' })
    const tomorrowPartId = await ctx.db.insert('scheduleParticipants', { scheduleId: tomorrow, patientId, status: 'scheduled' })
    return { settingsId, target, tomorrow, patientId, participantId, tomorrowPartId }
  })
  return { t, ...data }
}

test('getNotificationSettings retorna defaults true para todos os lembretes', async () => {
  const f = await fixture()
  const settings = await f.t.query(api.clinic.getNotificationSettings, { sessionToken: 'admin' })
  expect(settings.reminder24hEnabled).toBe(true)
  expect(settings.reminder1hEnabled).toBe(true)
  expect(settings.reminder30mEnabled).toBe(true)
  expect(settings.confirmationEnabled).toBe(true)
  expect(settings.waitlistEnabled).toBe(true)
})

test('prepareReminders respeita reminder1hEnabled desativado e agenda apenas o de 30m', async () => {
  const f = await fixture()
  await f.t.run(async ctx => {
    await ctx.db.patch(f.settingsId, { reminder1hEnabled: false })
    await prepareReminders(ctx, f.participantId)
  })

  const jobs = await f.t.run(ctx => ctx.db.query('appointmentJobs').collect())
  expect(jobs).toHaveLength(1)
  expect(jobs[0].kind).toBe('reminder_30m')
})

test('prepareReminders respeita reminder30mEnabled desativado e agenda apenas o de 1h', async () => {
  const f = await fixture()
  await f.t.run(async ctx => {
    await ctx.db.patch(f.settingsId, { reminder30mEnabled: false })
    await prepareReminders(ctx, f.participantId)
  })

  const jobs = await f.t.run(ctx => ctx.db.query('appointmentJobs').collect())
  expect(jobs).toHaveLength(1)
  expect(jobs[0].kind).toBe('reminder_1h')
})

test('prepareReminders quando ambos estão desativados não agenda nenhum job', async () => {
  const f = await fixture()
  await f.t.run(async ctx => {
    await ctx.db.patch(f.settingsId, { reminder1hEnabled: false, reminder30mEnabled: false })
    await prepareReminders(ctx, f.participantId)
  })

  const jobs = await f.t.run(ctx => ctx.db.query('appointmentJobs').collect())
  expect(jobs).toHaveLength(0)
})

test('toggleReminderEnabled desativa o lembrete e cancela jobs já enfileirados', async () => {
  const f = await fixture()
  // 1. Enfileira os lembretes normais de 1h e 30m
  await f.t.run(async ctx => {
    await prepareReminders(ctx, f.participantId)
  })
  const initialJobs = await f.t.run(ctx => ctx.db.query('appointmentJobs').collect())
  expect(initialJobs.filter(j => j.status === 'queued')).toHaveLength(2)

  // 2. Desativa o lembrete de 1h via mutation
  await f.t.mutation(api.whatsapp.toggleReminderEnabled, {
    sessionToken: 'admin',
    target: 'reminder_1h',
    enabled: false,
  })

  const afterJobs = await f.t.run(ctx => ctx.db.query('appointmentJobs').collect())
  const job1h = afterJobs.find(j => j.kind === 'reminder_1h')
  const job30m = afterJobs.find(j => j.kind === 'reminder_30m')

  expect(job1h?.status).toBe('skipped')
  expect(job30m?.status).toBe('queued')

  const settings = await f.t.query(api.clinic.getNotificationSettings, { sessionToken: 'admin' })
  expect(settings.reminder1hEnabled).toBe(false)
  expect(settings.reminder30mEnabled).toBe(true)
})

test('prepareDaily não enfileira lembrete de 24h se reminder24hEnabled estiver desativado', async () => {
  const f = await fixture()
  await f.t.run(async ctx => {
    await ctx.db.patch(f.settingsId, { reminder24hEnabled: false })
  })

  const result = await f.t.mutation(internal.appointmentNotifications.prepareDaily, { date: '2026-09-10' })
  expect(result.queuedCount).toBe(0)

  const jobs = await f.t.run(ctx => ctx.db.query('appointmentJobs').collect())
  expect(jobs).toHaveLength(0)
})

test('claim descarta jobs caso o lembrete tenha sido desativado', async () => {
  const f = await fixture()
  await f.t.run(async ctx => {
    await prepareReminders(ctx, f.participantId)
  })
  const job = await f.t.run(ctx => ctx.db.query('appointmentJobs').filter(q => q.eq(q.field('kind'), 'reminder_30m')).first())
  expect(job).not.toBeNull()

  // Desativa o lembrete de 30m nas configurações
  await f.t.run(async ctx => {
    await ctx.db.patch(f.settingsId, { reminder30mEnabled: false })
  })

  vi.setSystemTime(job!.dueAt)
  const claimResult = await f.t.mutation(internal.appointmentNotifications.claim, { jobId: job!._id })
  expect(claimResult).toBeNull()

  const updatedJob = await f.t.run(ctx => ctx.db.get(job!._id))
  expect(updatedJob?.status).toBe('skipped')
})
