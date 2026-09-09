import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { convexTest } from 'convex-test'
import schema from '../convex/schema'
import { api, internal } from '../convex/_generated/api'
import { hashToken } from '../convex/lib/security'
import { monthDates } from '../shared/monthlySchedule'
import { DEFAULT_PORTAL_MESSAGE, validatePortalMessage } from '../shared/portalMessage'
const modules = import.meta.glob('../convex/**/*.ts')
const now = Date.parse('2026-09-01T09:00:00-03:00')
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(now) })
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers() })

async function fixture(role: 'admin' | 'reception' = 'admin') {
  const t = convexTest(schema, modules)
  const portalToken = 'a'.repeat(64)
  const tokenHash = await hashToken(portalToken)
  const ids = await t.run(async ctx => {
    const userId = await ctx.db.insert('users', { name: 'Admin', email: 'a@example.invalid', role, active: true, salt: '', passwordHash: '', createdAt: now })
    await ctx.db.insert('userSessions', { userId, token: 'staff', authVersion: 2, expiresAt: now + 86400000, createdAt: now })
    const roomId = await ctx.db.insert('rooms', { name: 'Pilates e RPG', type: 'pilates_solo', capacity: 2, color: '', isActive: true })
    const professionalId = await ctx.db.insert('professionals', { name: 'Dani', email: '', phone: '', crefito: '', specialties: ['pilates'], commissionType: 'fixed', commissionValue: 0, active: true })
    const serviceId = await ctx.db.insert('services', { name: 'Pilates e RPG', specialty: 'pilates', modality: 'turma', durationMinutes: 30, maxCapacity: 2, defaultPrice: 50, active: true })
    const packageId = await ctx.db.insert('packages', { name: 'Plano', serviceId, sessionCount: 30, validityDays: 60, price: 300, active: true })
    const patientId = await ctx.db.insert('patients', { name: 'Paciente', documentCpf: '', phone: '11999999999', birthDate: '1990-01-01', active: true, createdAt: now })
    const patientPackageId = await ctx.db.insert('patientPackages', { patientId, packageId, serviceId, totalSessions: 30, remainingSessions: 30, usedSessions: 0, startDate: '2026-09-01', expiryDate: '2026-10-31', status: 'active' })
    await ctx.db.insert('patientSessions', { patientId, tokenHash, authVersion: 2, expiresAt: now + 86400000, createdAt: now })
    return { roomId, professionalId, serviceId, packageId, patientId, patientPackageId }
  })
  const seriesArgs = { sessionToken: 'staff', title: 'Turma 1', type: 'turma' as const, specialty: 'pilates' as const, roomId: ids.roomId, professionalId: ids.professionalId, serviceId: ids.serviceId, startTime: '08:00', endTime: '08:30', maxCapacity: 2, daysOfWeek: [1,2,3,4,5], startDate: '2026-09-01', month: '2026-09' }
  const series = await t.mutation(api.schedules.createRecurringScheduleSeries, seriesArgs)
  const args = { portalToken, patientPackageId: ids.patientPackageId, month: '2026-09' }
  return { t, ...ids, portalToken, seriesArgs, series, args }
}

test.each(['2026-02', '2028-02', '2026-04', '2026-05'])('calendar includes every selected weekday in %s', month => {
  const days = monthDates(month, [0,1,2,3,4,5,6])
  expect(days.length).toBe(new Date(Number(month.slice(0,4)), Number(month.slice(5)), 0).getDate())
  expect(monthDates(month, [1,3,5], `${month}-15`).every(d => d >= `${month}-15`)).toBe(true)
})
test.each([1,2,3,4,5])('reserves %s weekly days, idempotently and without creating more classes', async frequency => {
  const f = await fixture()
  const choices = Array.from({ length: frequency }, (_, i) => ({ recurringGroupId: f.series.recurringGroupId, dayOfWeek: i + 1 }))
  const preview = await f.t.query(api.patientPortal.previewMonthlyBooking, { ...f.args, choices })
  expect(preview.canConfirm).toBe(true)
  const input = { ...f.args, choices, expectedScheduleIds: preview.dates.map(d => d.scheduleId), requestId: 'once' }
  const result = await f.t.mutation(api.patientPortal.bookMonthlyClasses, input)
  expect(result.createdCount).toBe(preview.required)
  await f.t.mutation(api.patientPortal.bookMonthlyClasses, input)
  expect(await f.t.run(ctx => ctx.db.query('scheduleParticipants').collect())).toHaveLength(preview.required)
  expect(await f.t.run(ctx => ctx.db.query('schedules').collect())).toHaveLength(f.series.createdCount)
})
test('insufficient balance and expiry prevent the whole reservation', async () => {
  const f = await fixture()
  await f.t.run(ctx => ctx.db.patch(f.patientPackageId, { remainingSessions: 1, expiryDate: '2026-09-15' }))
  const choices = [{ recurringGroupId: f.series.recurringGroupId, dayOfWeek: 1 }]
  const preview = await f.t.query(api.patientPortal.previewMonthlyBooking, { ...f.args, choices })
  expect(preview.errors.join(' ')).toMatch(/saldo livre/)
  expect(preview.errors.join(' ')).toMatch(/validade/)
  await expect(f.t.mutation(api.patientPortal.bookMonthlyClasses, { ...f.args, choices, expectedScheduleIds: preview.dates.map(d => d.scheduleId), requestId: 'bad' })).rejects.toThrow()
  expect(await f.t.run(ctx => ctx.db.query('scheduleParticipants').collect())).toHaveLength(0)
})
test('a filled date invalidates the whole month without partial enrollment', async () => {
  const f = await fixture()
  const choices = [{ recurringGroupId: f.series.recurringGroupId, dayOfWeek: 1 }]
  const preview = await f.t.query(api.patientPortal.previewMonthlyBooking, { ...f.args, choices })
  await f.t.run(async ctx => {
    const other = await ctx.db.insert('patients', { name: 'Outro', documentCpf: '', phone: '', birthDate: '', active: true, createdAt: now })
    await ctx.db.patch(preview.dates.at(-1)!.scheduleId, { maxCapacity: 1 })
    await ctx.db.insert('scheduleParticipants', { patientId: other, scheduleId: preview.dates.at(-1)!.scheduleId, status: 'scheduled' })
  })
  await expect(f.t.mutation(api.patientPortal.bookMonthlyClasses, { ...f.args, choices, expectedScheduleIds: preview.dates.map(d => d.scheduleId), requestId: 'race' })).rejects.toThrow(/lotada/)
  expect(await f.t.run(ctx => ctx.db.query('scheduleParticipants').withIndex('by_patient', q => q.eq('patientId', f.patientId)).collect())).toHaveLength(0)
})
test('monthly creation rejects conflicts atomically and reports inactive resources', async () => {
  const f = await fixture()
  await expect(f.t.mutation(api.schedules.createRecurringScheduleSeries, f.seriesArgs)).rejects.toThrow(/sala ocupada/)
  expect(await f.t.run(ctx => ctx.db.query('schedules').collect())).toHaveLength(f.series.createdCount)
  await f.t.run(ctx => ctx.db.patch(f.professionalId, { active: false }))
  const preview = await f.t.query(api.schedules.previewRecurringMonth, { sessionToken: 'staff', month: '2026-10', startDate: '2026-10-01', daysOfWeek: [1], roomId: f.roomId, professionalId: f.professionalId, startTime: '08:00', endTime: '08:30', maxCapacity: 2 })
  expect(preview[0].error).toMatch(/Dani.*inativo/)
})
test('administrator closure rejects every portal write while preserving data and admin booking', async () => {
  const f = await fixture()
  const schedule = await f.t.run(ctx => ctx.db.query('schedules').first())
  const { participantId, creditId } = await f.t.run(async ctx => ({ participantId: await ctx.db.insert('scheduleParticipants', { patientId: f.patientId, scheduleId: schedule!._id, status: 'scheduled' }), creditId: await ctx.db.insert('replacementCredits', { patientId: f.patientId, originScheduleId: schedule!._id, status: 'available', generatedAt: now, expiryDate: '2026-10-01' }) }))
  await f.t.mutation(api.clinic.updatePortalBooking, { sessionToken: 'staff', enabled: false, message: DEFAULT_PORTAL_MESSAGE })
  const data = await f.t.query(api.patientPortal.getPatientPortalData, { portalToken: f.portalToken, patientId: f.patientId })
  expect(data?.portalBookingEnabled).toBe(false)
  const writes = [
    f.t.mutation(api.patientPortal.bookMonthlyClasses, { ...f.args, choices: [{ recurringGroupId: f.series.recurringGroupId, dayOfWeek: 1 }], expectedScheduleIds: [], requestId: 'closed' }),
    f.t.mutation(api.patientPortal.rescheduleAppointmentByPatient, { portalToken: f.portalToken, patientId: f.patientId, participantId, targetScheduleId: schedule!._id }),
    f.t.mutation(api.patientPortal.useReplacementCreditToBook, { portalToken: f.portalToken, patientId: f.patientId, creditId, targetScheduleId: schedule!._id }),
    f.t.mutation(api.waitlist.join, { portalToken: f.portalToken, creditId, scheduleId: schedule!._id }),
    f.t.mutation(api.patientPortal.bookAppointmentFromPortal, { portalToken: f.portalToken, patientId: f.patientId, patientPackageId: f.patientPackageId, date: schedule!.date, startTime: '08:00', endTime: '08:30', roomId: f.roomId, professionalId: f.professionalId }),
  ]
  const results = await Promise.allSettled(writes)
  expect(results.every(r => r.status === 'rejected' && String(r.reason).includes('fechados'))).toBe(true)
  await f.t.mutation(api.schedules.createRecurringScheduleSeries, { ...f.seriesArgs, month: '2026-10', startDate: '2026-10-01' })
  expect((await f.t.run(ctx => ctx.db.query('auditLogs').collect())).some(a => a.action === 'update_portal_booking')).toBe(true)
})
test('reception cannot close the portal; blank and unsafe messages are rejected', async () => {
  const f = await fixture('reception')
  await expect(f.t.mutation(api.clinic.updatePortalBooking, { sessionToken: 'staff', enabled: false, message: DEFAULT_PORTAL_MESSAGE })).rejects.toThrow(/permissão/)
  const admin = await fixture()
  await expect(admin.t.mutation(api.clinic.updatePortalBooking, { sessionToken: 'staff', enabled: false, message: [] })).rejects.toThrow(/mensagem/)
  expect(() => validatePortalMessage([{ type: 'paragraph', runs: [{ text: 'Abrir', href: 'javascript:alert(1)' }] }])).toThrow(/Link/)
})

test('legacy and monthly bookings both reserve balance for valid replacement credits', async () => {
  const f = await fixture()
  const { target, creditId } = await f.t.run(async ctx => {
    await ctx.db.patch(f.patientPackageId, { remainingSessions: 1, totalSessions: 1 })
    const sessions = await ctx.db.query('schedules').collect()
    const origin = sessions.find(s => s.date === '2026-09-01')!
    const target = sessions.find(s => s.date === '2026-09-02')!
    await ctx.db.insert('scheduleParticipants', { patientId: f.patientId, scheduleId: origin._id, patientPackageId: f.patientPackageId, packageDebited: false, status: 'justified_absence' })
    const creditId = await ctx.db.insert('replacementCredits', { patientId: f.patientId, originScheduleId: origin._id, generatedAt: now, expiryDate: '2026-09-30', status: 'available' })
    return { target, creditId }
  })
  const booking = { portalToken: f.portalToken, patientId: f.patientId, patientPackageId: f.patientPackageId, date: target.date, startTime: target.startTime, endTime: target.endTime, roomId: target.roomId, professionalId: target.professionalId }
  expect((await f.t.query(api.patientPortal.listMonthlyClasses, f.args)).freeBalance).toBe(0)
  expect((await f.t.query(api.patientPortal.getPatientPortalData, { portalToken: f.portalToken, patientId: f.patientId }))?.packages[0].bookableSessionsCount).toBe(0)
  await expect(f.t.mutation(api.patientPortal.bookAppointmentFromPortal, booking)).rejects.toThrow(/saldo/i)
  expect(await f.t.run(ctx => ctx.db.query('scheduleParticipants').withIndex('by_schedule', q => q.eq('scheduleId', target._id)).collect())).toHaveLength(0)
  await f.t.run(ctx => ctx.db.patch(creditId, { expiryDate: '2026-08-31' }))
  expect((await f.t.query(api.patientPortal.listMonthlyClasses, f.args)).freeBalance).toBe(1)
  await expect(f.t.mutation(api.patientPortal.bookAppointmentFromPortal, booking)).resolves.toMatchObject({ success: true })
})

test.each(['room', 'service'] as const)('replacement and waitlist obey a reduced %s capacity', async limit => {
  const f = await fixture()
  const { target, creditId, otherParticipant } = await f.t.run(async ctx => {
    if (limit === 'room') await ctx.db.patch(f.roomId, { capacity: 1 })
    else await ctx.db.patch(f.serviceId, { maxCapacity: 1 })
    const sessions = await ctx.db.query('schedules').collect()
    const target = sessions.find(s => s.date === '2026-09-02')!
    const other = await ctx.db.insert('patients', { name: 'Outro', documentCpf: '', phone: '', birthDate: '', active: true, createdAt: now })
    const otherParticipant = await ctx.db.insert('scheduleParticipants', { patientId: other, scheduleId: target._id, status: 'scheduled' })
    const creditId = await ctx.db.insert('replacementCredits', { patientId: f.patientId, originScheduleId: sessions[0]._id, generatedAt: now, expiryDate: '2026-09-30', status: 'available' })
    return { target, creditId, otherParticipant }
  })
  const slots = await f.t.query(api.waitlist.slots, { portalToken: f.portalToken, creditId, date: target.date })
  expect(slots.find(s => s.scheduleId === target._id)?.vacanciesLeft).toBe(0)
  await expect(f.t.mutation(api.patientPortal.useReplacementCreditToBook, { portalToken: f.portalToken, patientId: f.patientId, creditId, targetScheduleId: target._id })).rejects.toThrow(/lotado/)
  const entryId = await f.t.mutation(api.waitlist.join, { portalToken: f.portalToken, creditId, scheduleId: target._id })
  expect((await f.t.run(ctx => ctx.db.get(entryId)))?.status).toBe('waiting')
  expect((await f.t.run(ctx => ctx.db.get(creditId)))?.status).toBe('available')
  await f.t.run(ctx => ctx.db.patch(otherParticipant, { status: 'absence' }))
  await f.t.mutation(internal.waitlist.expire, { scheduleId: target._id })
  expect((await f.t.run(ctx => ctx.db.get(entryId)))?.status).toBe('booked')
})

test('monthly review exposes actual time, professional and room of every meeting', async () => {
  const f = await fixture()
  const changedId = await f.t.run(async ctx => {
    const session = (await ctx.db.query('schedules').collect()).find(s => s.date === '2026-09-14')!
    const professionalId = await ctx.db.insert('professionals', { name: 'Substituta', email: '', phone: '', crefito: '', specialties: ['pilates'], commissionType: 'fixed', commissionValue: 0, active: true })
    const roomId = await ctx.db.insert('rooms', { name: 'Sala alternativa', type: 'pilates_solo', capacity: 2, color: '', isActive: true })
    await ctx.db.patch(session._id, { startTime: '10:00', endTime: '10:30', professionalId, roomId })
    return session._id
  })
  const preview = await f.t.query(api.patientPortal.previewMonthlyBooking, { ...f.args, choices: [{ recurringGroupId: f.series.recurringGroupId, dayOfWeek: 1 }] })
  expect(preview.dates.find(d => d.scheduleId === changedId)).toMatchObject({ date: '2026-09-14', startTime: '10:00', endTime: '10:30', professionalName: 'Substituta', roomName: 'Sala alternativa' })
  expect(preview.dates[0]).toMatchObject({ startTime: '08:00', endTime: '08:30', professionalName: 'Dani', roomName: 'Pilates e RPG' })
})
