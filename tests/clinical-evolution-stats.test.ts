import { expect, test } from 'vitest'
import { convexTest } from 'convex-test'
import schema from '../convex/schema'
import { api, internal } from '../convex/_generated/api'

const modules = import.meta.glob('../convex/**/*.ts')

async function setup() {
  const t = convexTest(schema, modules)
  const ids = await t.run(async (ctx) => {
    const professionalId = await ctx.db.insert('professionals', {
      name: 'Dr. Marcelo',
      email: 'marcelo@example.com',
      phone: '11999990001',
      crefito: '12345-F',
      specialties: ['Pilates'],
      commissionType: 'percentage',
      commissionValue: 50,
      active: true,
    })
    const userId = await ctx.db.insert('users', {
      name: 'Admin',
      email: 'admin@example.com',
      role: 'admin',
      salt: 'fixture',
      passwordHash: 'fixture',
      active: true,
      createdAt: 1,
    })
    await ctx.db.insert('userSessions', {
      userId,
      token: 'token-admin',
      authVersion: 2,
      expiresAt: Date.now() + 3600000,
      createdAt: 1,
    })
    const patient = (name: string, cpf: string) =>
      ctx.db.insert('patients', { name, documentCpf: cpf, phone: '11911111111', birthDate: '1990-01-01', active: true, createdAt: 1 })
    const withRecordId = await patient('Com ficha', '11111111111')
    const legacyId = await patient('Histórico antigo', '22222222222')
    await ctx.db.insert('clinicalRecords', {
      patientId: withRecordId,
      chiefComplaint: 'Dor lombar',
      hpi: '',
      medicalHistory: '',
      medications: '',
      painScaleEva: 5,
      painLocation: '',
      clinicalGoals: '',
      updatedAt: 1,
    })
    // Evoluções gravadas antes do contador existir
    for (let i = 0; i < 3; i++) {
      await ctx.db.insert('clinicalEvolutions', {
        patientId: legacyId,
        professionalId,
        date: '2026-10-01',
        timestamp: i,
        subjective: 's',
        objective: 'o',
        assessment: 'a',
        plan: 'p',
        signedProfessionalName: 'Dr. Marcelo',
        crefito: '12345-F',
      })
    }
    return { professionalId, withRecordId, legacyId }
  })
  return { t, ...ids }
}

const countFor = async (t: any, patientId: string) => {
  const overview = await t.query(api.clinical.listAllClinicalOverview, { sessionToken: 'token-admin' })
  return overview.find((item: any) => item.patientId === patientId)?.evolutionsCount
}

const evolution = (patientId: any, professionalId: any) => ({
  sessionToken: 'token-admin',
  patientId,
  professionalId,
  date: '2026-11-19',
  subjective: 's',
  objective: 'o',
  assessment: 'a',
  plan: 'p',
})

test('contador de evoluções acompanha inclusão e exclusão', async () => {
  const { t, withRecordId, professionalId } = await setup()

  const firstId = await t.mutation(api.clinical.addSoapEvolution, evolution(withRecordId, professionalId))
  await t.mutation(api.clinical.addSoapEvolution, evolution(withRecordId, professionalId))
  expect(await countFor(t, withRecordId)).toBe(2)

  await t.mutation(api.clinical.deleteSoapEvolution, { sessionToken: 'token-admin', id: firstId })
  expect(await countFor(t, withRecordId)).toBe(1)
})

test('pacientes antigos são contados sem contador e o backfill cria o contador exato', async () => {
  const { t, legacyId, professionalId } = await setup()

  expect(await countFor(t, legacyId)).toBe(3)

  await t.mutation(internal.clinical.backfillEvolutionStats, {})
  const stats = await t.run((ctx) =>
    ctx.db.query('clinicalEvolutionStats').withIndex('by_patient', (q) => q.eq('patientId', legacyId)).first()
  )
  expect(stats?.count).toBe(3)

  // Primeira evolução nova de paciente antigo continua a contagem real
  await t.mutation(api.clinical.addSoapEvolution, evolution(legacyId, professionalId))
  expect(await countFor(t, legacyId)).toBe(4)
})

test('tela de Pacientes recebe só os IDs com ficha clínica', async () => {
  const { t, withRecordId, legacyId } = await setup()

  const ids = await t.query(api.clinical.listPatientIdsWithRecord, { sessionToken: 'token-admin' })
  expect(ids).toEqual([withRecordId])
  expect(ids).not.toContain(legacyId)
})

test('excluir paciente remove o contador de evoluções', async () => {
  const { t, legacyId, professionalId } = await setup()
  await t.mutation(api.clinical.addSoapEvolution, evolution(legacyId, professionalId))

  await t.mutation(api.patients.deletePatient, { sessionToken: 'token-admin', id: legacyId })
  const stats = await t.run((ctx) => ctx.db.query('clinicalEvolutionStats').collect())
  expect(stats).toEqual([])
})
