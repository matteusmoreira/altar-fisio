import { expect, test } from 'vitest'
import { convexTest } from 'convex-test'
import schema from '../convex/schema'
import { api } from '../convex/_generated/api'

const modules = import.meta.glob('../convex/**/*.ts')

test('listAssignedPatientIds returns patients linked via schedules or clinical evolutions', async () => {
  const t = convexTest(schema, modules)

  const { prof1Id, prof2Id, patient1Id, patient2Id, patient3Id } = await t.run(async (ctx) => {
    const prof1 = await ctx.db.insert('professionals', {
      name: 'Dr. Marcelo',
      email: 'marcelo@altarfisio.com.br',
      phone: '11999990001',
      crefito: '12345-F',
      specialties: ['Fisioterapia', 'Pilates'],
      commissionType: 'percentage',
      commissionValue: 50,
      active: true,
    })
    const prof2 = await ctx.db.insert('professionals', {
      name: 'Dra. Stefanie',
      email: 'stefanie@altarfisio.com.br',
      phone: '11999990002',
      crefito: '54321-F',
      specialties: ['Pilates'],
      commissionType: 'percentage',
      commissionValue: 50,
      active: true,
    })

    const userProf1 = await ctx.db.insert('users', {
      name: 'Dr. Marcelo',
      email: 'marcelo@altarfisio.com.br',
      role: 'professional',
      professionalId: prof1,
      salt: 'fixture',
      passwordHash: 'fixture',
      active: true,
      createdAt: 1,
    })
    await ctx.db.insert('userSessions', {
      userId: userProf1,
      token: 'token-marcelo',
      authVersion: 2,
      expiresAt: Date.now() + 3600000,
      createdAt: 1,
    })

    const userAdmin = await ctx.db.insert('users', {
      name: 'Admin',
      email: 'admin@altarfisio.com.br',
      role: 'admin',
      salt: 'fixture',
      passwordHash: 'fixture',
      active: true,
      createdAt: 1,
    })
    await ctx.db.insert('userSessions', {
      userId: userAdmin,
      token: 'token-admin',
      authVersion: 2,
      expiresAt: Date.now() + 3600000,
      createdAt: 1,
    })

    const p1 = await ctx.db.insert('patients', {
      name: 'Paciente 1 (Agenda Dr. Marcelo)',
      documentCpf: '11111111111',
      phone: '11911111111',
      birthDate: '1990-01-01',
      active: true,
      createdAt: 1,
    })
    const p2 = await ctx.db.insert('patients', {
      name: 'Paciente 2 (Evolucao Dra. Stefanie)',
      documentCpf: '22222222222',
      phone: '11922222222',
      birthDate: '1991-01-01',
      active: true,
      createdAt: 1,
    })
    const p3 = await ctx.db.insert('patients', {
      name: 'Paciente 3 (Sem vinculo)',
      documentCpf: '33333333333',
      phone: '11933333333',
      birthDate: '1992-01-01',
      active: true,
      createdAt: 1,
    })

    const room = await ctx.db.insert('rooms', {
      name: 'Sala Pilates',
      type: 'pilates_aparelhos',
      capacity: 3,
      color: '#10b981',
      isActive: true,
    })

    // Schedule com Dr. Marcelo
    const schedule = await ctx.db.insert('schedules', {
      title: 'Pilates Solo',
      type: 'turma',
      specialty: 'pilates',
      roomId: room,
      professionalId: prof1,
      date: '2026-09-10',
      startTime: '08:00',
      endTime: '08:50',
      maxCapacity: 3,
      status: 'scheduled',
    })

    await ctx.db.insert('scheduleParticipants', {
      scheduleId: schedule,
      patientId: p1,
      status: 'scheduled',
    })

    // Evolucao clinica com Dra. Stefanie
    await ctx.db.insert('clinicalEvolutions', {
      patientId: p2,
      professionalId: prof2,
      date: '2026-09-10',
      timestamp: Date.now(),
      subjective: 'Relata melhora na lombar.',
      objective: 'Exercicios no reformer com carga leve.',
      assessment: 'Boa estabilidade articular.',
      plan: 'Progredir para ponte unilateral.',
      signedProfessionalName: 'Dra. Stefanie',
      crefito: '54321-F',
    })

    return { prof1Id: prof1, prof2Id: prof2, patient1Id: p1, patient2Id: p2, patient3Id: p3 }
  })

  // Consulta por Dr. Marcelo explicitamente via token admin
  const assignedMarcelo = await t.query(api.patients.listAssignedPatientIds, {
    sessionToken: 'token-admin',
    professionalId: prof1Id,
  })
  expect(assignedMarcelo).toContain(patient1Id)
  expect(assignedMarcelo).not.toContain(patient2Id)
  expect(assignedMarcelo).not.toContain(patient3Id)

  // Consulta por Dra. Stefanie explicitamente
  const assignedStefanie = await t.query(api.patients.listAssignedPatientIds, {
    sessionToken: 'token-admin',
    professionalId: prof2Id,
  })
  expect(assignedStefanie).toContain(patient2Id)
  expect(assignedStefanie).not.toContain(patient1Id)
  expect(assignedStefanie).not.toContain(patient3Id)

  // Consulta implicita usando token do usuario profissional logado (sem passar professionalId)
  const assignedSelf = await t.query(api.patients.listAssignedPatientIds, {
    sessionToken: 'token-marcelo',
  })
  expect(assignedSelf).toEqual([patient1Id])

  // Rejeita sessao invalida
  await expect(
    t.query(api.patients.listAssignedPatientIds, {
      sessionToken: 'token-invalido',
      professionalId: prof1Id,
    })
  ).rejects.toThrow()
})
