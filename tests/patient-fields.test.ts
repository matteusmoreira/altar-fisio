import { expect, test } from 'vitest'
import { convexTest } from 'convex-test'
import schema from '../convex/schema'
import { api } from '../convex/_generated/api'
import { formatCep, normalizeCep } from '../shared/patientIdentity'
import { DEFAULT_HEALTH_INSURANCE_OPTIONS } from '../shared/healthInsurance'

const modules = import.meta.glob('../convex/**/*.ts')

async function fixture() {
  const t = convexTest(schema, modules)
  await t.run(async (ctx) => {
    for (const role of ['admin', 'reception', 'professional'] as const) {
      const userId = await ctx.db.insert('users', {
        name: role,
        email: `${role}@example.invalid`,
        role,
        salt: 'fixture',
        passwordHash: 'fixture',
        active: true,
        createdAt: 1,
      })
      await ctx.db.insert('userSessions', {
        userId,
        token: role,
        authVersion: 2,
        expiresAt: Date.now() + 3600000,
        createdAt: 1,
      })
    }
  })
  return t
}

test('CEP formatting keeps only eight digits', () => {
  expect(normalizeCep('22790-702')).toBe('22790702')
  expect(formatCep('22790-702')).toBe('22790-702')
  expect(formatCep('22790702abc')).toBe('22790-702')
})

test('health insurance options have defaults and only admin can update them', async () => {
  const t = await fixture()

  await expect(t.query(api.clinic.getHealthInsuranceOptions, { sessionToken: 'reception' }))
    .resolves.toEqual([...DEFAULT_HEALTH_INSURANCE_OPTIONS])
  await expect(t.mutation(api.clinic.updateHealthInsuranceOptions, {
    sessionToken: 'reception',
    options: ['Unimed'],
  })).rejects.toThrow()

  await expect(t.mutation(api.clinic.updateHealthInsuranceOptions, {
    sessionToken: 'admin',
    options: [' Unimed ', 'unimed', 'Bradesco'],
  })).resolves.toEqual(['Unimed', 'Bradesco'])
  await expect(t.query(api.clinic.getHealthInsuranceOptions, { sessionToken: 'professional' }))
    .resolves.toEqual(['Unimed', 'Bradesco'])
})

test('patient CEP is persisted and removing an option does not change old patient data', async () => {
  const t = await fixture()
  const patientId = await t.action(api.patients.createPatient, {
    sessionToken: 'admin',
    name: 'Paciente CEP',
    documentCpf: '52998224725',
    phone: '11987654321',
    birthDate: '1990-01-01',
    cep: '22790-702',
    address: 'Rua Rio Grande do Norte, 149, Rio das Ostras - RJ',
    healthInsurance: 'Bradesco',
  })

  await expect(t.query(api.patients.getPatient, { sessionToken: 'admin', id: patientId }))
    .resolves.toMatchObject({ cep: '22790-702', healthInsurance: 'Bradesco' })

  await t.mutation(api.clinic.updateHealthInsuranceOptions, {
    sessionToken: 'admin',
    options: ['Unimed'],
  })
  await expect(t.query(api.patients.getPatient, { sessionToken: 'admin', id: patientId }))
    .resolves.toMatchObject({ healthInsurance: 'Bradesco' })
})
