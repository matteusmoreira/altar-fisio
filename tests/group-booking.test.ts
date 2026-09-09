import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { convexTest } from 'convex-test'
import schema from '../convex/schema'
import { api, internal } from '../convex/_generated/api'
import { sliceTimeWindowIntoSlots } from '../convex/availability'
import { hashToken } from '../convex/lib/security'

const modules = import.meta.glob('../convex/**/*.ts')
const now = Date.parse('2026-09-13T12:00:00Z')
const date = '2026-09-14'
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(now) })
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers() })

function cpf(index: number) {
  const digits = String(100000000 + index).split('').map(Number)
  for (const length of [9, 10]) {
    const rest = digits.reduce((sum, n, i) => sum + n * (length + 1 - i), 0) % 11
    digits.push(rest < 2 ? 0 : 11 - rest)
  }
  return digits.join('')
}

async function fixture(requireApproval = false) {
  const t = convexTest(schema, modules)
  const ids = await t.run(async ctx => {
    const userId = await ctx.db.insert('users', { name: 'Reception', email: 'test@example.invalid', role: 'reception', active: true, salt: 'test', passwordHash: 'test', createdAt: now })
    await ctx.db.insert('userSessions', { userId, token: 'staff', authVersion: 2, expiresAt: now + 86400000, createdAt: now })
    await ctx.db.insert('bookingFormConfig', { requireApproval, steps: [], fields: [], updatedAt: now })
    const roomIds = []
    const professionalIds = []
    for (let i = 0; i < 2; i++) {
      roomIds.push(await ctx.db.insert('rooms', { name: `Sala ${i}`, type: 'fisioterapia', capacity: 8, color: '', isActive: true }))
      professionalIds.push(await ctx.db.insert('professionals', { name: `Profissional ${i}`, email: `${i}@example.invalid`, phone: '', crefito: 'test', specialties: ['fisioterapia', 'rpg'], commissionType: 'fixed', commissionValue: 0, active: true }))
    }
    const ruleIds = []
    for (let i = 0; i < 2; i++) ruleIds.push(await ctx.db.insert('availabilityRules', { roomId: roomIds[i], professionalId: professionalIds[i], dayOfWeek: 1, specialty: 'fisioterapia', startTime: '08:00', endTime: '10:00', slotDurationMinutes: 30, breakMinutes: 0, isActive: true }))
    const serviceId = await ctx.db.insert('services', { name: 'Fisioterapia em grupo', specialty: 'fisioterapia', modality: 'turma', maxCapacity: 8, durationMinutes: 30, defaultPrice: 50, active: true })
    return { roomIds, professionalIds, ruleIds, serviceId }
  })
  return { t, ...ids }
}
type Fixture = Awaited<ReturnType<typeof fixture>>
const query = (f: Fixture, extra = {}) => f.t.query(api.bookingBuilder.listPublicAvailableSlots, { date, serviceId: f.serviceId, ...extra })
const reserve = (f: Fixture, index: number, extra = {}) => f.t.mutation(internal.bookingBuilder.persistPublicBooking, {
  name: `Paciente ${index}`, documentCpf: cpf(index), phone: '11987654321', birthDate: '1990-01-01', date, startTime: '08:00', endTime: '08:30', roomId: f.roomIds[0], professionalId: f.professionalIds[0], serviceId: f.serviceId, answers: [], credential: { salt: 'test', passwordHash: 'test' }, ...extra,
})

async function portalFixture() {
  const f = await fixture()
  const packageId = await f.t.run(ctx => ctx.db.insert('packages', {
    name: 'Plano Fisioterapia', serviceId: f.serviceId, sessionCount: 8, validityDays: 30, price: 400, active: true,
  }))
  const addPatient = async (index: number) => {
    const portalToken = String(index % 10).repeat(64)
    const tokenHash = await hashToken(portalToken)
    const ids = await f.t.run(async ctx => {
      const patientId = await ctx.db.insert('patients', { name: `Paciente portal ${index}`, documentCpf: cpf(100 + index), phone: `1199999${String(index).padStart(4, '0')}`, birthDate: '1990-01-01', active: true, createdAt: now })
      const patientPackageId = await ctx.db.insert('patientPackages', { patientId, packageId, serviceId: f.serviceId, totalSessions: 8, usedSessions: 0, remainingSessions: 8, startDate: '2026-09-01', expiryDate: '2026-10-01', status: 'active' })
      await ctx.db.insert('patientSessions', { patientId, tokenHash, authVersion: 2, createdAt: now, expiresAt: now + 86400000 })
      return { patientId, patientPackageId }
    })
    return { portalToken, ...ids }
  }
  return { ...f, packageId, addPatient }
}

test('zero break generates consecutive half-hour slots and preserves room/professional pairs', async () => {
  const f = await fixture()
  const slots = await query(f)
  expect(slots.map(s => s.startTime)).toEqual(['08:00', '08:30', '09:00', '09:30'])
  expect(slots[0].rooms.map(r => [r.roomId, r.professionalId, r.availableSpots])).toEqual(f.roomIds.map((id, i) => [id, f.professionalIds[i], 8]))
  await expect(reserve(f, 1, { professionalId: f.professionalIds[1] })).rejects.toThrow(/indisponível/)
})

test('portal derives 30-minute slots from the weekly grid and keeps the contracted service', async () => {
  const f = await portalFixture()
  const patient = await f.addPatient(1)
  await f.t.run(async ctx => {
    await ctx.db.patch(f.ruleIds[0], { endTime: '17:00' })
    await ctx.db.patch(f.ruleIds[1], { isActive: false })
    await ctx.db.insert('availabilityRules', { roomId: f.roomIds[0], professionalId: f.professionalIds[0], dayOfWeek: 5, specialty: 'fisioterapia', startTime: '08:00', endTime: '12:00', slotDurationMinutes: 30, breakMinutes: 0, isActive: true })
  })

  const monday = await f.t.query(api.patientPortal.listAvailabilitySlotsForPatientBooking, { portalToken: patient.portalToken, patientPackageId: patient.patientPackageId, date })
  const friday = await f.t.query(api.patientPortal.listAvailabilitySlotsForPatientBooking, { portalToken: patient.portalToken, patientPackageId: patient.patientPackageId, date: '2026-09-18' })
  expect(monday).toHaveLength(18)
  expect(monday.slice(0, 3).map(slot => `${slot.startTime}-${slot.endTime}`)).toEqual(['08:00-08:30', '08:30-09:00', '09:00-09:30'])
  expect(friday).toHaveLength(8)
  expect(friday.at(-1)).toMatchObject({ startTime: '11:30', endTime: '12:00', maxCapacity: 8 })
})

test('portal materializes one group session on demand and never exceeds eight places', async () => {
  const f = await portalFixture()
  await f.t.run(ctx => ctx.db.patch(f.ruleIds[1], { isActive: false }))
  const patients = await Promise.all(Array.from({ length: 9 }, (_, index) => f.addPatient(index + 1)))
  const slot = (await f.t.query(api.patientPortal.listAvailabilitySlotsForPatientBooking, { portalToken: patients[0].portalToken, patientPackageId: patients[0].patientPackageId, date }))[0]
  const results = await Promise.allSettled(patients.map(patient => f.t.mutation(api.patientPortal.bookAppointmentFromPortal, {
    portalToken: patient.portalToken,
    patientId: patient.patientId,
    patientPackageId: patient.patientPackageId,
    date,
    startTime: slot.startTime,
    endTime: slot.endTime,
    roomId: slot.roomId,
    professionalId: slot.professionalId,
  })))

  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(8)
  expect(await f.t.run(ctx => ctx.db.query('schedules').collect())).toHaveLength(1)
  const participants = await f.t.run(ctx => ctx.db.query('scheduleParticipants').collect())
  expect(participants).toHaveLength(8)
  expect(participants.every(participant => participant.patientPackageId)).toBe(true)
})

test('assigned package definitions cannot be deleted', async () => {
  const f = await portalFixture()
  await f.addPatient(1)
  await expect(f.t.mutation(api.packages.deletePackage, { sessionToken: 'staff', id: f.packageId })).rejects.toThrow(/Desative-o/)
})

test('nine concurrent reservations accept eight, share one session, and leave the other room available', async () => {
  const f = await fixture()
  const results = await Promise.allSettled(Array.from({ length: 9 }, (_, i) => reserve(f, i)))
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(8)
  const schedules = await f.t.run(ctx => ctx.db.query('schedules').collect())
  expect(schedules).toHaveLength(1)
  expect(schedules[0]).toMatchObject({ type: 'turma', maxCapacity: 8, specialty: 'fisioterapia' })
  const slots = await query(f)
  expect(slots[0].rooms).toHaveLength(1)
  expect(slots[0].rooms[0]).toMatchObject({ roomId: f.roomIds[1], availableSpots: 8 })
  expect(slots[1].totalAvailableSpots).toBe(16)
  await reserve(f, 20, { roomId: f.roomIds[1], professionalId: f.professionalIds[1] })
  expect((await query(f))[0].totalAvailableSpots).toBe(7)
})

test('reception approvals join the same session, enforce capacity, and are idempotent', async () => {
  const f = await fixture(true)
  const bookings = []
  for (let i = 0; i < 9; i++) bookings.push(await reserve(f, i))
  const results = await Promise.allSettled(bookings.map(b => f.t.mutation(api.bookingBuilder.updatePublicBookingStatus, { sessionToken: 'staff', bookingId: b.bookingId, status: 'confirmed' })))
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(8)
  expect(await f.t.run(ctx => ctx.db.query('schedules').collect())).toHaveLength(1)
  const approved = await f.t.run(ctx => ctx.db.query('publicBookings').filter(q => q.eq(q.field('status'), 'confirmed')).first())
  await f.t.mutation(api.bookingBuilder.updatePublicBookingStatus, { sessionToken: 'staff', bookingId: approved!._id, status: 'confirmed' })
  expect(await f.t.run(ctx => ctx.db.query('scheduleParticipants').collect())).toHaveLength(8)
})

test.each(['absence', 'justified_absence'] as const)('status %s releases a place consistently for listing and confirmation', async status => {
  const f = await fixture()
  for (let i = 0; i < 8; i++) await reserve(f, i)
  await f.t.run(async ctx => { const p = await ctx.db.query('scheduleParticipants').first(); await ctx.db.patch(p!._id, { status }) })
  expect((await query(f))[0].rooms.find(r => r.roomId === f.roomIds[0])?.availableSpots).toBe(1)
  await reserve(f, 10)
  expect((await query(f))[0].rooms.some(r => r.roomId === f.roomIds[0])).toBe(false)
})

test('individual service allows exactly one patient even in a room for eight', async () => {
  const f = await fixture()
  await f.t.run(ctx => ctx.db.patch(f.serviceId, { modality: 'individual', maxCapacity: 8 }))
  expect((await query(f))[0].rooms[0].capacity).toBe(1)
  await reserve(f, 1)
  await expect(reserve(f, 2)).rejects.toThrow(/indisponível|lotado/)
  expect((await f.t.run(ctx => ctx.db.query('schedules').first()))?.type).toBe('individual')
})

test('effective capacity respects both service and existing session limits', async () => {
  const f = await fixture()
  await f.t.run(ctx => ctx.db.patch(f.serviceId, { maxCapacity: 5 }))
  expect((await query(f))[0].rooms[0].capacity).toBe(5)
  await reserve(f, 1)
  await f.t.run(async ctx => { const s = await ctx.db.query('schedules').first(); await ctx.db.patch(s!._id, { maxCapacity: 2 }) })
  expect((await query(f))[0].rooms[0].availableSpots).toBe(1)
  await reserve(f, 2)
  await expect(reserve(f, 3)).rejects.toThrow(/indisponível|lotado/)
})

test('overlapping times and professional occupied in another room are unavailable', async () => {
  const f = await fixture()
  await reserve(f, 1)
  await f.t.run(ctx => ctx.db.patch(f.ruleIds[1], { professionalId: f.professionalIds[0] }))
  expect((await query(f))[0].rooms.map(r => r.roomId)).toEqual([f.roomIds[0]])
  await f.t.run(async ctx => { const s = await ctx.db.query('schedules').first(); await ctx.db.patch(s!._id, { startTime: '07:45', endTime: '08:15' }) })
  expect((await query(f))[0].isAvailable).toBe(false)
  expect((await query(f))[1].isAvailable).toBe(true)
})

test('weekday rules select the right professional and inactive rules do not enable fallback hours', async () => {
  const f = await fixture()
  await f.t.run(async ctx => {
    await ctx.db.insert('availabilityRules', { roomId: f.roomIds[0], professionalId: f.professionalIds[1], dayOfWeek: 2, specialty: 'fisioterapia', startTime: '08:00', endTime: '09:00', slotDurationMinutes: 30, breakMinutes: 0, isActive: true })
  })
  expect((await query(f, { date: '2026-09-15' }))[0].rooms[0].professionalId).toBe(f.professionalIds[1])
  expect(await query(f, { date: '2026-09-16' })).toEqual([])
  await f.t.run(async ctx => { for (const rule of await ctx.db.query('availabilityRules').collect()) await ctx.db.patch(rule._id, { isActive: false }) })
  expect(await query(f)).toEqual([])
})

test('RPG group uses configured modality and submitted specialty cannot override the service', async () => {
  const f = await fixture()
  await f.t.run(async ctx => { await ctx.db.patch(f.serviceId, { specialty: 'rpg' }); await ctx.db.patch(f.ruleIds[0], { specialty: 'rpg' }) })
  const b = await reserve(f, 1, { specialty: 'pilates' })
  const booking = await f.t.run(ctx => ctx.db.get(b.bookingId))
  const schedule = await f.t.run(ctx => ctx.db.get(booking!.scheduleId!))
  expect(schedule).toMatchObject({ specialty: 'rpg', type: 'turma', maxCapacity: 8 })
})

test('blocked periods, inactive professionals and mismatched existing modalities are excluded', async () => {
  const f = await fixture()
  await reserve(f, 1)
  await f.t.run(async ctx => {
    await ctx.db.patch(f.serviceId, { modality: 'individual' })
    await ctx.db.patch(f.professionalIds[1], { active: false })
    await ctx.db.insert('availabilityOverrides', { professionalId: f.professionalIds[0], date, type: 'block', startTime: '08:30', endTime: '09:00', reason: 'Pausa', createdAt: now })
  })
  const slots = await query(f)
  expect(slots.find(s => s.startTime === '08:00')?.isAvailable).toBe(false)
  expect(slots.find(s => s.startTime === '08:30')).toBeUndefined()
  expect(slots.find(s => s.startTime === '09:00')?.rooms).toHaveLength(1)
})

test('package capacity is used for listing and booking, regardless of client service fields', async () => {
  const f = await fixture()
  const packageId = await f.t.run(async ctx => {
    const individual = await ctx.db.insert('services', { name: 'Individual', specialty: 'fisioterapia', modality: 'individual', durationMinutes: 30, defaultPrice: 100, active: true })
    return ctx.db.insert('packages', { name: 'Plano individual', serviceId: individual, sessionCount: 1, validityDays: 30, price: 100, active: true })
  })
  expect((await query(f, { packageId }))[0].rooms[0].capacity).toBe(1)
  await reserve(f, 1, { packageId })
  await expect(reserve(f, 2, { packageId })).rejects.toThrow(/indisponível|lotado/)
})

test('different end times remain distinct and duplicate patients cannot occupy two seats', async () => {
  const f = await fixture()
  await f.t.run(ctx => ctx.db.patch(f.ruleIds[1], { slotDurationMinutes: 60 }))
  expect((await query(f)).filter(s => s.startTime === '08:00').map(s => s.endTime)).toEqual(['08:30', '09:00'])
  await reserve(f, 1)
  await expect(reserve(f, 1)).rejects.toThrow(/já reservado/)
})

test('invalid legacy durations cannot hang slot generation', () => {
  expect(sliceTimeWindowIntoSlots('08:00', '10:00', 0, 0)).toEqual([])
  expect(sliceTimeWindowIntoSlots('08:00', '10:00', 30, -30)).toEqual([])
})

test.each(['inactive service', 'deleted service', 'inactive package', 'hidden package', 'deleted package'])('unavailable selection (%s) returns no slots and cannot be booked', async state => {
  const f = await fixture()
  const packageId = await f.t.run(ctx => ctx.db.insert('packages', { name: 'Plano', serviceId: f.serviceId, sessionCount: 1, validityDays: 30, price: 100, active: true }))
  expect(await f.t.query(api.bookingBuilder.listPublicPackages, {})).toHaveLength(1)
  expect((await query(f, { packageId })).length).toBeGreaterThan(0)
  await f.t.run(async ctx => {
    if (state === 'inactive service') await ctx.db.patch(f.serviceId, { active: false })
    if (state === 'deleted service') await ctx.db.delete(f.serviceId)
    if (state === 'inactive package') await ctx.db.patch(packageId, { active: false })
    if (state === 'hidden package') await ctx.db.patch(packageId, { showInPublicBooking: false })
    if (state === 'deleted package') await ctx.db.delete(packageId)
  })
  expect(await f.t.query(api.bookingBuilder.listPublicPackages, {})).toEqual([])
  expect(await query(f, { packageId })).toEqual([])
  if (state.endsWith('service')) expect(await query(f)).toEqual([])
  await expect(reserve(f, 1, { packageId })).rejects.toThrow(/indisponível/)
  expect(await f.t.run(ctx => ctx.db.query('schedules').collect())).toEqual([])
})
