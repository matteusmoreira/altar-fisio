import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { convexTest } from 'convex-test'
import schema from '../convex/schema'
import { api, internal } from '../convex/_generated/api'
import { hashToken } from '../convex/lib/security'
import { DEFAULT_PATIENT_PASSWORD, isValidCpf, normalizePhone, formatCpf, formatPhone } from '../shared/patientIdentity'

const modules = import.meta.glob('../convex/**/*.ts')
beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }))
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers() })
const patient = { name: 'Paciente de teste', documentCpf: '52998224725', phone: '11987654321', birthDate: '1990-01-01' }
async function fixture() {
  const t = convexTest(schema, modules)
  await t.run(async ctx => {
    for (const role of ['admin', 'reception', 'professional'] as const) {
      const userId = await ctx.db.insert('users', { name: role, email: `${role}@example.invalid`, role, salt: 'fixture', passwordHash: 'fixture', active: true, createdAt: 1 })
      await ctx.db.insert('userSessions', { userId, token: role, authVersion: 2, expiresAt: Date.now() + 3600000, createdAt: 1 })
    }
  })
  return t
}
const login = (t: ReturnType<typeof convexTest>, identifier = patient.documentCpf, password = DEFAULT_PATIENT_PASSWORD, type: 'cpf' | 'phone' = 'cpf') => t.action(api.portalAuth.login, { type, identifier, password })

test('CPF checksum, repeated digits and formatting; Brazilian phone with country prefix', () => {
  for (const value of ['', '123', '00000000000', '11111111111', '52998224724', '12345678900']) expect(isValidCpf(value)).toBe(false)
  expect(isValidCpf('529.982.247-25')).toBe(true)
  expect(formatCpf(patient.documentCpf)).toBe('529.982.247-25')
  expect(normalizePhone('+55 (11) 98765-4321')).toBe(patient.phone)
  expect(formatPhone('+55 (11) 98765-4321')).toBe('(11) 98765-4321')
})

test('staff creation atomically enables default login, salted credentials stay private and sessions are scoped', async () => {
  const t = await fixture()
  const patientId = await t.action(api.patients.createPatient, { sessionToken: 'reception', ...patient, documentCpf: '529.982.247-25', phone: '+55 (11) 98765-4321' })
  const otherId = await t.action(api.patients.createPatient, { sessionToken: 'professional', ...patient, documentCpf: '11144477735', phone: '21987654321' })
  const credentials = await t.run(ctx => ctx.db.query('patientCredentials').collect())
  expect(credentials).toHaveLength(2)
  expect(credentials[0].salt).not.toBe(credentials[1].salt)
  expect(credentials[0].passwordHash).not.toBe(credentials[1].passwordHash)
  const publicPatient = await t.query(api.patients.getPatient, { sessionToken: 'admin', id: patientId })
  expect(publicPatient).not.toHaveProperty('passwordHash')
  expect(JSON.stringify(publicPatient)).not.toContain(DEFAULT_PATIENT_PASSWORD)
  const cpfLogin = await login(t, '529.982.247-25')
  const phoneLogin = await login(t, '+55 (11) 98765-4321', DEFAULT_PATIENT_PASSWORD, 'phone')
  expect(await t.query(api.portalAccess.current, { portalToken: phoneLogin.token })).toEqual({ _id: patientId })
  await expect(t.query(api.patientPortal.getPatientPortalData, { portalToken: cpfLogin.token, patientId: otherId })).rejects.toThrow(/Acesso/)
  const sessions = await t.run(ctx => ctx.db.query('patientSessions').collect())
  expect(sessions[0].expiresAt - sessions[0].createdAt).toBe(86400000)
  expect(JSON.stringify(sessions)).not.toContain(cpfLogin.token)
  await t.mutation(api.portalAccess.logout, { portalToken: cpfLogin.token })
  expect(await t.query(api.portalAccess.current, { portalToken: cpfLogin.token })).toBeNull()
  await t.run(ctx => ctx.db.patch(sessions[1]._id, { expiresAt: 1 }))
  expect(await t.query(api.portalAccess.current, { portalToken: phoneLogin.token })).toBeNull()
})

test('non-admins cannot edit, deactivate, delete or change passwords, including direct internal guard', async () => {
  const t = await fixture()
  const patientId = await t.action(api.patients.createPatient, { sessionToken: 'admin', ...patient })
  const { token } = await login(t)
  for (const sessionToken of ['reception', 'professional', token, 'invalid']) {
    await expect(t.mutation(api.patients.updatePatient, { sessionToken, id: patientId, name: 'Alterado' })).rejects.toThrow()
    await expect(t.mutation(api.patients.updatePatient, { sessionToken, id: patientId, active: false })).rejects.toThrow()
    await expect(t.mutation(api.patients.deletePatient, { sessionToken, id: patientId })).rejects.toThrow()
    await expect(t.action(api.portalAuth.changePassword, { sessionToken, patientId, password: 'SenhaNova123' })).rejects.toThrow()
    await expect(t.mutation(internal.portalAccess.setPassword, { sessionToken, patientId, salt: 'fake', passwordHash: 'fake' })).rejects.toThrow()
  }
  expect((await t.run(ctx => ctx.db.get(patientId)))?.name).toBe(patient.name)
})

test('reset invalidates sessions, validates length, prevents stale authentication, inactivation and deletion remove access', async () => {
  const t = await fixture()
  const patientId = await t.action(api.patients.createPatient, { sessionToken: 'admin', ...patient })
  const first = await login(t)
  const old = await t.run(ctx => ctx.db.query('patientCredentials').first())
  for (const password of ['12345678', 'a'.repeat(257)]) await expect(t.action(api.portalAuth.changePassword, { sessionToken: 'admin', patientId, password })).rejects.toThrow(/9 a 256/)
  await t.action(api.portalAuth.changePassword, { sessionToken: 'admin', patientId, password: 'NovaSenha123' })
  expect(await t.query(api.portalAccess.current, { portalToken: first.token })).toBeNull()
  await expect(login(t)).rejects.toThrow(/Credenciais/)
  await expect(t.mutation(internal.portalAccess.createSession, { type: 'cpf', identifier: patient.documentCpf, patientId, expectedHash: old!.passwordHash, tokenHash: 'stale' })).rejects.toThrow(/Credenciais/)
  await t.action(api.portalAuth.changePassword, { sessionToken: 'admin', patientId, password: DEFAULT_PATIENT_PASSWORD })
  const second = await login(t)
  await t.mutation(api.patients.updatePatient, { sessionToken: 'admin', id: patientId, active: false })
  expect(await t.query(api.portalAccess.current, { portalToken: second.token })).toBeNull()
  await expect(login(t)).rejects.toThrow(/Credenciais/)
  await t.mutation(api.patients.deletePatient, { sessionToken: 'admin', id: patientId })
  expect(await t.run(ctx => ctx.db.query('patientCredentials').collect())).toEqual([])
  expect(await t.run(ctx => ctx.db.query('patientSessions').collect())).toEqual([])
})

test('shared phone requires CPF; normalized legacy duplicates cannot pick an arbitrary patient', async () => {
  const t = await fixture()
  await t.action(api.patients.createPatient, { sessionToken: 'admin', ...patient })
  await t.action(api.patients.createPatient, { sessionToken: 'admin', ...patient, documentCpf: '11144477735' })
  await expect(login(t, patient.phone, DEFAULT_PATIENT_PASSWORD, 'phone')).rejects.toThrow(/compartilhado/)
  expect((await login(t)).token).toBeTruthy()
  await t.run(ctx => ctx.db.insert('patients', { ...patient, documentCpf: '529.982.247-25', active: true, createdAt: 1 }))
  await expect(login(t)).rejects.toThrow(/conferir seu cadastro/)
  await expect(t.action(api.patients.createPatient, { sessionToken: 'admin', ...patient })).rejects.toThrow(/Já existe/)
})

test('migration is idempotent, keeps custom password, normalizes legacy records and revokes legacy links', async () => {
  const t = await fixture()
  const patientId = await t.run(ctx => ctx.db.insert('patients', { ...patient, documentCpf: '529.982.247-25', active: true, createdAt: 1 }))
  const legacyToken = 'f'.repeat(64)
  await t.run(async ctx => ctx.db.insert('patientSessions', { patientId, tokenHash: await hashToken(legacyToken), expiresAt: Date.now() + 60000, createdAt: 1 }))
  expect(await t.query(api.portalAccess.current, { portalToken: legacyToken })).toBeNull()
  expect(await t.action(internal.portalAuth.migrateExisting, {})).toMatchObject({ done: true, created: 1 })
  expect((await login(t)).token).toBeTruthy()
  await t.action(api.portalAuth.changePassword, { sessionToken: 'admin', patientId, password: 'Personal123' })
  expect(await t.action(internal.portalAuth.migrateExisting, {})).toMatchObject({ created: 0 })
  expect((await login(t, patient.documentCpf, 'Personal123')).token).toBeTruthy()
  expect((await t.run(ctx => ctx.db.get(patientId)))?.normalizedCpf).toBe(patient.documentCpf)
})

test('five failed attempts persist and block the sixth, formatting cannot bypass the window', async () => {
  const t = await fixture()
  for (let i = 0; i < 5; i++) await expect(login(t, i % 2 ? '529.982.247-25' : patient.documentCpf, 'incorrect')).rejects.toThrow(/Credenciais/)
  await expect(login(t)).rejects.toThrow(/Muitas tentativas/)
  await t.run(async ctx => { const row = await ctx.db.query('authAttempts').first(); await ctx.db.patch(row!._id, { resetAt: 1 }) })
  await expect(login(t)).rejects.toThrow(/Credenciais/)
})

test('invalid CPF rejects staff creation, update and public booking with no patient writes', async () => {
  const t = await fixture()
  for (const documentCpf of ['', '00000000000', '52998224724']) {
    await expect(t.action(api.patients.createPatient, { sessionToken: 'admin', ...patient, documentCpf })).rejects.toThrow(/CPF/)
    await expect(t.action(api.bookingBuilder.submitPublicBooking, { ...patient, documentCpf, date: '2099-09-09', startTime: '09:00', endTime: '09:55', answers: [] })).rejects.toThrow(/CPF/)
  }
  expect(await t.run(ctx => ctx.db.query('patients').collect())).toEqual([])
  const id = await t.action(api.patients.createPatient, { sessionToken: 'admin', ...patient })
  await expect(t.mutation(api.patients.updatePatient, { sessionToken: 'admin', id, documentCpf: '11111111111' })).rejects.toThrow(/CPF/)
})

test.each([true, false])('online booking (approval=%s) creates access atomically and preserves custom password/profile', async requireApproval => {
  const t = await fixture()
  await t.run(async ctx => {
    await ctx.db.insert('rooms', { name: 'Sala teste', type: 'fisioterapia', capacity: 2, color: 'green', isActive: true })
    await ctx.db.insert('professionals', { name: 'Profissional teste', email: 'teste@example.invalid', phone: '', crefito: 'test', specialties: ['fisioterapia'], commissionType: 'fixed', commissionValue: 0, active: true })
    await ctx.db.insert('bookingFormConfig', { requireApproval, steps: [], fields: [], updatedAt: 1 })
  })
  const serviceId = await t.run(ctx => ctx.db.insert('services', { name: 'Avaliação', specialty: 'fisioterapia', modality: 'individual', durationMinutes: 55, defaultPrice: 100, active: true, isEvaluation: true }))
  const args = { ...patient, requestId: crypto.randomUUID(), serviceId, date: '2099-09-09', startTime: '09:00', endTime: '09:55', specialty: 'fisioterapia' as const, answers: [] }
  const booking = await t.action(api.bookingBuilder.submitPublicBooking, args)
  expect(booking).toMatchObject({ success: true, portalAccessCreated: true, requireApproval })
  // The first response may have been lost after committing the reservation.
  const retries = await Promise.all([t.action(api.bookingBuilder.submitPublicBooking, args), t.action(api.bookingBuilder.submitPublicBooking, args)])
  expect(retries).toEqual([booking, booking])
  expect(await t.run(ctx => ctx.db.query('publicBookings').collect())).toHaveLength(1)
  expect(await t.run(ctx => ctx.db.query('auditLogs').filter(q => q.eq(q.field('action'), 'public_booking_created')).collect())).toHaveLength(1)
  expect(await t.run(ctx => ctx.db.query('notificationLogs').collect())).toHaveLength(1)
  await expect(t.action(api.bookingBuilder.submitPublicBooking, { ...args, name: 'Outro nome' })).rejects.toThrow(/solicitação já foi utilizada/)
  expect((await login(t)).token).toBeTruthy()
  await t.action(api.portalAuth.changePassword, { sessionToken: 'admin', patientId: booking.patientId, password: 'CustomPass123' })
  const repeat = await t.action(api.bookingBuilder.submitPublicBooking, { ...args, requestId: crypto.randomUUID(), name: 'Não sobrescrever', phone: '21987654321', startTime: '10:00', endTime: '10:55' })
  expect(repeat).toMatchObject({ patientId: booking.patientId, portalAccessCreated: false })
  expect(await t.run(ctx => ctx.db.query('patients').collect())).toHaveLength(1)
  expect(await t.run(ctx => ctx.db.get(booking.patientId))).toMatchObject({ name: patient.name, phone: patient.phone })
  expect((await login(t, patient.documentCpf, 'CustomPass123')).token).toBeTruthy()
})

test('concurrent staff creation with one CPF produces a single patient and credential', async () => {
  const t = await fixture()
  const result = await Promise.allSettled([1, 2].map(() => t.action(api.patients.createPatient, { sessionToken: 'admin', ...patient })))
  expect(result.filter(r => r.status === 'fulfilled')).toHaveLength(1)
  expect(await t.run(ctx => ctx.db.query('patients').collect())).toHaveLength(1)
  expect(await t.run(ctx => ctx.db.query('patientCredentials').collect())).toHaveLength(1)
})
