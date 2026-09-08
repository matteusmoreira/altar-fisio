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
    await ctx.db.insert('clinicSettings', { clinicName: 'Clínica de teste', clinicSubtitle: '', primaryColor: '', colorPreset: '', mode: 'light', cancellationNoticeHours: 2, replacementExpiryDays: 30 })
    for (const role of ['admin', 'reception', 'professional'] as const) {
      const userId = await ctx.db.insert('users', { name: role, email: `${role}@example.invalid`, role, active: true, salt: 'test', passwordHash: 'test', createdAt: now })
      await ctx.db.insert('userSessions', { userId, token: role, authVersion: 2, expiresAt: now + 7 * 86400000, createdAt: now })
    }
    const roomId = await ctx.db.insert('rooms', { name: 'Sala de teste', type: 'pilates_solo', capacity: 4, color: '', isActive: true })
    const professionalId = await ctx.db.insert('professionals', { name: 'Profissional teste', email: 'teste@example.invalid', phone: '', crefito: 'TESTE', specialties: ['pilates'], commissionType: 'fixed', commissionValue: 0, active: true })
    const scheduleData = { title: 'Pilates', type: 'turma' as const, specialty: 'pilates' as const, roomId, professionalId, startTime: '14:00', endTime: '15:00', maxCapacity: 1, status: 'scheduled' as const, isRecurring: true, recurringGroupId: 'series' }
    const origin = await ctx.db.insert('schedules', { ...scheduleData, date: '2026-09-07' })
    const target = await ctx.db.insert('schedules', { ...scheduleData, date: '2026-09-09' })
    const nextWeek = await ctx.db.insert('schedules', { ...scheduleData, date: '2026-09-16' })
    const patients = []
    for (let i = 0; i < 3; i++) {
      const patientId = await ctx.db.insert('patients', { name: `Paciente ${i}`, documentCpf: `fixture-${i}`, phone: '11987654321', birthDate: '1990-01-01', active: true, createdAt: now })
      const token = String(i + 1).repeat(64)
      await ctx.db.insert('patientSessions', { patientId, tokenHash: await hashToken(token), authVersion: 2, expiresAt: now + 7 * 86400000, createdAt: now })
      const creditId = await ctx.db.insert('replacementCredits', { patientId, originScheduleId: origin, generatedAt: now, expiryDate: '2026-09-30', status: 'available' })
      patients.push({ patientId, token, creditId })
    }
    const occupied = await ctx.db.insert('scheduleParticipants', { scheduleId: target, patientId: patients[2].patientId, status: 'scheduled' })
    const fixed = await ctx.db.insert('scheduleParticipants', { scheduleId: nextWeek, patientId: patients[0].patientId, status: 'scheduled' })
    return { origin, target, nextWeek, patients, occupied, fixed, roomId, professionalId }
  })
  return { t, ...data }
}
const join = (f: Awaited<ReturnType<typeof fixture>>, index = 0) => f.t.mutation(api.waitlist.join, { portalToken: f.patients[index].token, creditId: f.patients[index].creditId, scheduleId: f.target })

test('FIFO, duplicate entry and atomic cancellation book exactly one credit without changing the recurring series', async () => {
  const f = await fixture()
  const first = await join(f)
  expect(await join(f)).toBe(first)
  vi.setSystemTime(now + 1)
  const second = await join(f, 1)
  await f.t.mutation(api.patientPortal.cancelAppointmentByPatient, { portalToken: f.patients[2].token, patientId: f.patients[2].patientId, participantId: f.occupied })
  const [a, b, fixed, credit] = await f.t.run(async ctx => Promise.all([ctx.db.get(first), ctx.db.get(second), ctx.db.get(f.fixed), ctx.db.get(f.patients[0].creditId)]))
  expect(a?.status).toBe('booked'); expect(b?.status).toBe('waiting')
  expect(fixed?.status).toBe('scheduled'); expect(credit?.status).toBe('used')
  const jobs = await f.t.run(ctx => ctx.db.query('appointmentJobs').collect())
  expect(jobs.filter(j => j.participantId === a?.participantId).map(j => j.kind).sort()).toEqual(['reminder_1h', 'reminder_30m', 'waitlist_booked'])
  expect((await f.t.query(api.waitlist.mine, { portalToken: f.patients[1].token }))[0].position).toBe(1)
  await expect(f.t.mutation(api.patientPortal.cancelAppointmentByPatient, { portalToken: f.patients[2].token, patientId: f.patients[2].patientId, participantId: f.occupied })).rejects.toThrow(/processado/)
})

test('simultaneous vacancy processors and immediate booking cannot consume a seat or credit twice', async () => {
  const f = await fixture(); await join(f); await join(f, 1)
  await f.t.run(ctx => ctx.db.patch(f.occupied, { status: 'absence' }))
  await Promise.all([f.t.mutation(internal.waitlist.expire, { scheduleId: f.target }), f.t.mutation(internal.waitlist.expire, { scheduleId: f.target })])
  const parts = await f.t.run(ctx => ctx.db.query('scheduleParticipants').withIndex('by_schedule', q => q.eq('scheduleId', f.target)).collect())
  expect(parts.filter(p => p.status === 'replacement')).toHaveLength(1)
  await expect(f.t.mutation(api.patientPortal.useReplacementCreditToBook, { portalToken: f.patients[1].token, patientId: f.patients[1].patientId, creditId: f.patients[1].creditId, targetScheduleId: f.target })).rejects.toThrow(/lotado/)
})

test('invalid candidates are skipped and exactly 90 minutes is eligible; one millisecond later closes the queue', async () => {
  const f = await fixture(); const a = await join(f); const b = await join(f, 1)
  await f.t.run(async ctx => { await ctx.db.patch(f.patients[0].creditId, { status: 'used' }); await ctx.db.patch(f.occupied, { status: 'absence' }) })
  vi.setSystemTime(Date.parse('2026-09-09T15:30:00Z'))
  await f.t.mutation(internal.waitlist.expire, { scheduleId: f.target })
  expect((await f.t.run(ctx => ctx.db.get(a)))?.status).toBe('closed')
  expect((await f.t.run(ctx => ctx.db.get(b)))?.status).toBe('booked')
  const g = await fixture(); const entry = await join(g)
  vi.setSystemTime(Date.parse('2026-09-09T15:30:00.001Z'))
  await g.t.mutation(internal.waitlist.expire, { scheduleId: g.target })
  expect((await g.t.run(ctx => ctx.db.get(entry)))?.status).toBe('closed')
  expect((await g.t.run(ctx => ctx.db.get(g.patients[0].creditId)))?.status).toBe('available')
})

test('patient boundaries, staff permissions, phone, expiry, specialty and time conflicts are enforced', async () => {
  const f = await fixture(); const entry = await join(f)
  await expect(f.t.mutation(api.waitlist.leave, { portalToken: f.patients[1].token, entryId: entry })).rejects.toThrow(/autorizado/)
  await expect(f.t.mutation(api.waitlist.join, { portalToken: f.patients[0].token, creditId: f.patients[1].creditId, scheduleId: f.target })).rejects.toThrow(/Crédito/)
  await expect(f.t.mutation(api.waitlist.staffLeave, { sessionToken: 'professional', entryId: entry })).rejects.toThrow(/permissão/)
  const own = await f.t.query(api.waitlist.mine, { portalToken: f.patients[0].token })
  expect(JSON.stringify(own)).not.toContain(f.patients[1].patientId)
  await f.t.run(ctx => ctx.db.patch(f.patients[1].patientId, { phone: '' }))
  await expect(join(f, 1)).rejects.toThrow(/WhatsApp/)
  await f.t.run(async ctx => { await ctx.db.patch(f.patients[1].patientId, { phone: '11987654321' }); await ctx.db.patch(f.patients[1].creditId, { expiryDate: '2026-09-08' }) })
  await expect(join(f, 1)).rejects.toThrow(/vencido/)
  await f.t.run(async ctx => { await ctx.db.patch(f.patients[1].creditId, { expiryDate: '2026-09-30' }); await ctx.db.patch(f.origin, { specialty: 'rpg' }) })
  await expect(join(f, 1)).rejects.toThrow(/especialidade/)
  await f.t.run(async ctx => { await ctx.db.patch(f.origin, { specialty: 'pilates' }); await ctx.db.insert('scheduleParticipants', { patientId: f.patients[1].patientId, scheduleId: f.target, status: 'scheduled' }) })
  await expect(join(f, 1)).rejects.toThrow(/compromisso/)
})

test('switching and leaving preserve credit; manual use closes its former queue', async () => {
  const f = await fixture(); const entry = await join(f)
  const other = await f.t.run(async ctx => ctx.db.insert('schedules', { ...(await ctx.db.get(f.target))!, _id: undefined, _creationTime: undefined, date: '2026-09-10' } as any))
  const next = await f.t.mutation(api.waitlist.join, { portalToken: f.patients[0].token, creditId: f.patients[0].creditId, scheduleId: other })
  expect((await f.t.run(ctx => ctx.db.get(entry)))?.status).toBe('cancelled')
  expect((await f.t.run(ctx => ctx.db.get(next)))?.status).toBe('booked')
  const second = await join(f, 1)
  await f.t.mutation(api.waitlist.leave, { portalToken: f.patients[1].token, entryId: second })
  expect((await f.t.run(ctx => ctx.db.get(f.patients[1].creditId)))?.status).toBe('available')
})

test('cancelling a replacement restores the same credit and original expiry, then the next patient gets the seat', async () => {
  const f = await fixture(); const a = await join(f); const b = await join(f, 1)
  await f.t.mutation(api.schedules.removeParticipantFromSchedule, { sessionToken: 'reception', scheduleId: f.target, participantRecordId: f.occupied })
  const booked = await f.t.run(ctx => ctx.db.get(a))
  const before = await f.t.run(ctx => ctx.db.query('replacementCredits').collect())
  await f.t.mutation(api.patientPortal.cancelAppointmentByPatient, { portalToken: f.patients[0].token, patientId: f.patients[0].patientId, participantId: booked!.participantId! })
  const credit = await f.t.run(ctx => ctx.db.get(f.patients[0].creditId))
  expect(credit?.status).toBe('available'); expect(credit?.expiryDate).toBe('2026-09-30')
  expect(await f.t.run(ctx => ctx.db.query('replacementCredits').collect())).toHaveLength(before.length)
  expect((await f.t.run(ctx => ctx.db.get(b)))?.status).toBe('booked')
})

test('late replacement cancellation keeps credit consumed; changed schedule closes waiting entries', async () => {
  const f = await fixture(); const a = await join(f); const b = await join(f, 1)
  await f.t.mutation(api.schedules.removeParticipantFromSchedule, { sessionToken: 'reception', scheduleId: f.target, participantRecordId: f.occupied })
  const booked = await f.t.run(ctx => ctx.db.get(a))
  vi.setSystemTime(Date.parse('2026-09-09T15:45:00Z'))
  await f.t.mutation(api.patientPortal.cancelAppointmentByPatient, { portalToken: f.patients[0].token, patientId: f.patients[0].patientId, participantId: booked!.participantId! })
  expect((await f.t.run(ctx => ctx.db.get(f.patients[0].creditId)))?.status).toBe('used')
  expect((await f.t.run(ctx => ctx.db.get(b)))?.status).toBe('closed')
  vi.setSystemTime(now)
  const g = await fixture(); const e = await join(g)
  await g.t.mutation(api.schedules.updateSchedule, { sessionToken: 'admin', id: g.target, startTime: '15:00', endTime: '16:00' })
  expect((await g.t.run(ctx => ctx.db.get(e)))?.status).toBe('closed')
  expect((await g.t.run(ctx => ctx.db.get(g.patients[0].creditId)))?.status).toBe('available')
})

test('reminders are scheduled once at 1h and 30min; cancellation suppresses stale sends', async () => {
  const f = await fixture()
  await f.t.run(async ctx => { await prepareReminders(ctx, f.occupied); await prepareReminders(ctx, f.occupied) })
  const jobs = await f.t.run(ctx => ctx.db.query('appointmentJobs').collect())
  expect(jobs.map(j => j.dueAt).sort()).toEqual([Date.parse('2026-09-09T16:00:00Z'), Date.parse('2026-09-09T16:30:00Z')])
  expect(await f.t.mutation(internal.appointmentNotifications.claim, { jobId: jobs[0]._id })).toBeNull()
  await f.t.mutation(api.patientPortal.cancelAppointmentByPatient, { portalToken: f.patients[2].token, patientId: f.patients[2].patientId, participantId: f.occupied })
  vi.setSystemTime(jobs[0].dueAt)
  expect(await f.t.mutation(internal.appointmentNotifications.claim, { jobId: jobs[0]._id })).toBeNull()
})

test('provider failure does not undo the booking; duplicate send claims are blocked and retry revalidates', async () => {
  const f = await fixture(); const e = await join(f)
  await f.t.mutation(api.schedules.removeParticipantFromSchedule, { sessionToken: 'reception', scheduleId: f.target, participantRecordId: f.occupied })
  const job = await f.t.run(ctx => ctx.db.query('appointmentJobs').filter(q => q.eq(q.field('kind'), 'waitlist_booked')).first())
  await f.t.action(internal.appointmentNotifications.send, { jobId: job!._id })
  expect((await f.t.run(ctx => ctx.db.get(job!._id)))?.status).toBe('failed')
  expect((await f.t.run(ctx => ctx.db.get(e)))?.status).toBe('booked')
  expect(await f.t.mutation(internal.appointmentNotifications.claim, { jobId: job!._id })).toBeNull()
  const entry = await f.t.run(ctx => ctx.db.get(e))
  await f.t.mutation(api.patientPortal.cancelAppointmentByPatient, { portalToken: f.patients[0].token, patientId: f.patients[0].patientId, participantId: entry!.participantId! })
  await expect(f.t.mutation(api.appointmentNotifications.retry, { sessionToken: 'reception', jobId: job!._id })).rejects.toThrow(/repetido|válido/)
})

test('backfill skips elapsed reminders and the old 2h sender is disabled', async () => {
  const f = await fixture(); vi.setSystemTime(Date.parse('2026-09-09T16:15:00Z'))
  await f.t.mutation(internal.appointmentNotifications.backfill, { paginationOpts: { cursor: null, numItems: 10 } })
  const jobs = await f.t.run(ctx => ctx.db.query('appointmentJobs').withIndex('by_participant', q => q.eq('participantId', f.occupied)).collect())
  expect(jobs.map(j => j.kind)).toEqual(['reminder_30m'])
  expect((await f.t.action(internal.notifications.checkAndSendUpcomingReminders2hAction, {})).sentCount).toBe(0)
})

test('manual use of a credit in a different free slot closes its queue without a second booking', async () => {
  const f = await fixture(); const entry = await join(f, 1)
  await f.t.run(ctx => ctx.db.patch(f.nextWeek, { maxCapacity: 2 }))
  await f.t.mutation(api.patientPortal.useReplacementCreditToBook, { portalToken: f.patients[1].token, patientId: f.patients[1].patientId, creditId: f.patients[1].creditId, targetScheduleId: f.nextWeek })
  expect((await f.t.run(ctx => ctx.db.get(entry)))?.status).toBe('closed')
  await f.t.mutation(api.schedules.removeParticipantFromSchedule, { sessionToken: 'reception', scheduleId: f.target, participantRecordId: f.occupied })
  const parts = await f.t.run(ctx => ctx.db.query('scheduleParticipants').withIndex('by_schedule', q => q.eq('scheduleId', f.target)).collect())
  expect(parts).toHaveLength(0)
})

test('replacement rescheduling preserves the original credit and rolls back if the target is full', async () => {
  const f = await fixture(); const entryId = await join(f, 1)
  await f.t.mutation(api.schedules.removeParticipantFromSchedule, { sessionToken: 'reception', scheduleId: f.target, participantRecordId: f.occupied })
  const entry = await f.t.run(ctx => ctx.db.get(entryId))
  const args = { portalToken: f.patients[1].token, patientId: f.patients[1].patientId, participantId: entry!.participantId!, targetScheduleId: f.nextWeek }
  await expect(f.t.mutation(api.patientPortal.rescheduleAppointmentByPatient, args)).rejects.toThrow(/lotado/)
  expect((await f.t.run(ctx => ctx.db.get(entry!.participantId!)))?.status).toBe('replacement')
  await f.t.run(ctx => ctx.db.patch(f.nextWeek, { maxCapacity: 2 }))
  await f.t.mutation(api.patientPortal.rescheduleAppointmentByPatient, args)
  const credit = await f.t.run(ctx => ctx.db.get(f.patients[1].creditId))
  expect(credit?.usedInScheduleId).toBe(f.nextWeek)
  expect(credit?.expiryDate).toBe('2026-09-30')
  expect((await f.t.run(ctx => ctx.db.get(entryId)))?.status).toBe('cancelled')
})

test('increasing capacity fills the queue and an absence cannot be reactivated over capacity', async () => {
  const f = await fixture(); const a = await join(f)
  await f.t.mutation(api.schedules.updateSchedule, { sessionToken: 'admin', id: f.target, maxCapacity: 2 })
  expect((await f.t.run(ctx => ctx.db.get(a)))?.status).toBe('booked')
  const b = await join(f, 1)
  await f.t.mutation(api.schedules.checkInParticipant, { sessionToken: 'reception', participantId: f.occupied, status: 'absence', debitPackageOnAbsence: false })
  expect((await f.t.run(ctx => ctx.db.get(b)))?.status).toBe('booked')
  await expect(f.t.mutation(api.schedules.checkInParticipant, { sessionToken: 'reception', participantId: f.occupied, status: 'scheduled' })).rejects.toThrow(/ocupada/)
})

test('daily notices use the same claim guard and schedule edits replace reminder jobs', async () => {
  const f = await fixture()
  expect(await f.t.mutation(internal.appointmentNotifications.prepareDaily, { date: '2026-09-09' })).toEqual({ queuedCount: 1 })
  expect(await f.t.mutation(internal.appointmentNotifications.prepareDaily, { date: '2026-09-09' })).toEqual({ queuedCount: 0 })
  const daily = await f.t.run(ctx => ctx.db.query('appointmentJobs').first())
  const claimed = await f.t.mutation(internal.appointmentNotifications.claim, { jobId: daily!._id })
  expect(claimed?.job.kind).toBe('reminder_24h')
  expect(await f.t.mutation(internal.appointmentNotifications.claim, { jobId: daily!._id })).toBeNull()
  await f.t.run(ctx => prepareReminders(ctx, f.occupied))
  await f.t.mutation(api.schedules.updateSchedule, { sessionToken: 'admin', id: f.target, startTime: '15:00', endTime: '16:00' })
  const jobs = await f.t.run(ctx => ctx.db.query('appointmentJobs').collect())
  expect(jobs.filter(j => j.status === 'queued').map(j => j.dueAt).sort()).toEqual([Date.parse('2026-09-09T17:00:00Z'), Date.parse('2026-09-09T17:30:00Z')])
  expect(jobs.filter(j => j.status === 'skipped')).toHaveLength(2)
})

test('an uncertain provider response is not retried automatically and never undoes the booking', async () => {
  const f = await fixture(); const e = await join(f)
  await f.t.run(async ctx => {
    const settings = await ctx.db.query('clinicSettings').first()
    await ctx.db.patch(settings!._id, { uazapiEndpoint: 'https://test.uazapi.com', uazapiToken: 'test-only-token' })
  })
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')))
  await f.t.mutation(api.schedules.removeParticipantFromSchedule, { sessionToken: 'reception', scheduleId: f.target, participantRecordId: f.occupied })
  const job = await f.t.run(ctx => ctx.db.query('appointmentJobs').filter(q => q.eq(q.field('kind'), 'waitlist_booked')).first())
  await f.t.action(internal.appointmentNotifications.send, { jobId: job!._id })
  expect((await f.t.run(ctx => ctx.db.get(job!._id)))?.status).toBe('uncertain')
  const calls = vi.mocked(fetch).mock.calls.length
  await f.t.action(internal.appointmentNotifications.send, { jobId: job!._id })
  expect(vi.mocked(fetch).mock.calls).toHaveLength(calls)
  expect((await f.t.run(ctx => ctx.db.get(e)))?.status).toBe('booked')
  vi.unstubAllGlobals()
})
