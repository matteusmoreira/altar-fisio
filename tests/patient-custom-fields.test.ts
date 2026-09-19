import { expect, test } from 'vitest'
import { convexTest } from 'convex-test'
import schema from '../convex/schema'
import { api } from '../convex/_generated/api'
import type { PatientCustomFieldDefinition, PatientCustomFieldValue } from '../src/types'

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

test('permite criar paciente sem CPF, sem gênero e sem email, persistindo campos livres', async () => {
  const t = await fixture()

  const customFields: PatientCustomFieldValue[] = [
    { label: 'Profissão', type: 'text', value: 'Engenheiro' },
    { label: 'Indicação', type: 'select', value: 'Instagram' },
    { label: 'Altura (cm)', type: 'number', value: '182' },
  ]

  const patientId = await t.action(api.patients.createPatient, {
    sessionToken: 'reception',
    name: 'Paciente Sem Documentos Legados',
    phone: '11987654321',
    birthDate: '1985-05-15',
    customFields,
  })

  const fetched = await t.query(api.patients.getPatient, {
    sessionToken: 'admin',
    id: patientId,
  })

  expect(fetched).toBeTruthy()
  expect(fetched?.name).toBe('Paciente Sem Documentos Legados')
  expect(fetched?.phone).toBe('11987654321')
  expect(fetched?.documentCpf).toBeUndefined()
  expect(fetched?.email).toBeUndefined()
  expect(fetched?.gender).toBeUndefined()
  expect(fetched?.customFields).toEqual(customFields)
})

test('gerenciamento de campos livres da clínica com permissões e sanitização', async () => {
  const t = await fixture()

  // Inicialmente vazio
  const initial = await t.query(api.clinic.getPatientCustomFields, {
    sessionToken: 'professional',
  })
  expect(initial).toEqual([])

  // Reception ou Admin pode atualizar
  const newDefinitions: PatientCustomFieldDefinition[] = [
    { id: 'f1', label: 'Profissão', type: 'text' },
    { id: 'f2', label: 'Como nos conheceu', type: 'select', options: ['Instagram', 'Google', 'Amigo'] },
    { id: 'f3', label: 'Peso (kg)', type: 'number' },
  ]

  const saved = await t.mutation(api.clinic.updatePatientCustomFields, {
    sessionToken: 'reception',
    fields: newDefinitions,
  })
  expect(saved).toHaveLength(3)
  expect(saved[1].options).toEqual(['Instagram', 'Google', 'Amigo'])

  // Professional pode ler mas não pode mutar
  const readByProf = await t.query(api.clinic.getPatientCustomFields, {
    sessionToken: 'professional',
  })
  expect(readByProf).toEqual(saved)

  await expect(
    t.mutation(api.clinic.updatePatientCustomFields, {
      sessionToken: 'professional',
      fields: [],
    })
  ).rejects.toThrow()
})
