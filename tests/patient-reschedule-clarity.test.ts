import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'
import { convexTest } from 'convex-test'
import schema from '../convex/schema'
import { api } from '../convex/_generated/api'
import { hashToken } from '../convex/lib/security'
import { portalErrorMessage } from '../src/lib/portalErrors'

const modules = import.meta.glob('../convex/**/*.ts')

describe('portalErrorMessage', () => {
  test('extrai data string de ConvexError', () => {
    expect(portalErrorMessage({ data: 'Você já possui um agendamento neste horário.' })).toBe(
      'Você já possui um agendamento neste horário.'
    )
  })

  test('extrai data object com message', () => {
    expect(portalErrorMessage({ data: { message: 'Erro com objeto' } })).toBe('Erro com objeto')
  })

  test('oculta Server Error interno e prefixos do Convex', () => {
    const rawError = new Error(
      '[CONVEX M(patientPortal:rescheduleAppointmentByPatient)] [Request ID: 84dfd16719d16563] Server Error Called by client'
    )
    const result = portalErrorMessage(rawError)
    expect(result).not.toContain('[CONVEX')
    expect(result).not.toContain('Server Error')
    expect(result).toBe('Não foi possível concluir a solicitação. Verifique os dados ou contate a recepção.')
  })

  test('extrai mensagem de ConvexError quando serializada no Error.message', () => {
    const serialized = new Error(
      '[CONVEX M(patientPortal:rescheduleAppointmentByPatient)] Server Error\nConvexError: Horário indisponível para este tratamento.'
    )
    expect(portalErrorMessage(serialized)).toBe('Horário indisponível para este tratamento.')
  })

  test('preserva mensagens amigáveis de validações normais', () => {
    expect(portalErrorMessage(new Error('Confirme que aceita o encaixe automático.'))).toBe(
      'Confirme que aceita o encaixe automático.'
    )
  })
})

describe('patientPortal rescheduling and slot conflicts', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }))
  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  test('detecta conflito no listAvailableSlotsForBooking e rejeita remarcação conflitante com ConvexError claro', async () => {
    const t = convexTest(schema, modules)
    const { patientId, token, packageId, roomId, professionalId, serviceId } = await t.run(async ctx => {
      const pId = await ctx.db.insert('patients', {
        name: 'Aluno Teste',
        documentCpf: '11122233344',
        phone: '11988887777',
        birthDate: '1995-01-01',
        active: true,
        createdAt: 1,
      })
      const rawToken = 'a'.repeat(64)
      const tokenHash = await hashToken(rawToken)
      await ctx.db.insert('patientSessions', {
        patientId: pId,
        tokenHash,
        authVersion: 2,
        expiresAt: Date.now() + 86400000,
        createdAt: Date.now(),
      })
      const rId = await ctx.db.insert('rooms', { name: 'Studio', type: 'pilates_solo', capacity: 5, color: 'blue', isActive: true })
      const profId = await ctx.db.insert('professionals', {
        name: 'Instrutora',
        email: 'prof@test.com',
        phone: '11999999999',
        crefito: '12345-F',
        specialties: ['pilates'],
        commissionType: 'fixed',
        commissionValue: 10,
        active: true,
      })
      const sId = await ctx.db.insert('services', {
        name: 'Studio Pilates',
        specialty: 'pilates',
        modality: 'turma',
        durationMinutes: 30,
        maxCapacity: 5,
        defaultPrice: 50,
        active: true,
      })
      const pkgDefId = await ctx.db.insert('packages', {
        name: 'Plano Mensal',
        serviceId: sId,
        sessionCount: 8,
        price: 300,
        validityDays: 30,
        active: true,
      })
      // Pacote com remainingSessions: 0 (todas as aulas do mês já estão alocadas)
      const patientPkgId = await ctx.db.insert('patientPackages', {
        patientId: pId,
        packageId: pkgDefId,
        serviceId: sId,
        totalSessions: 8,
        usedSessions: 0,
        remainingSessions: 0,
        startDate: '2099-09-01',
        expiryDate: '2099-09-30',
        status: 'active',
      })
      await ctx.db.insert('clinicSettings', {
        clinicName: 'Altar Fisio',
        clinicSubtitle: 'Fisioterapia e Pilates',
        primaryColor: 'green',
        colorPreset: 'emerald',
        mode: 'light',
        cancellationNoticeHours: 2,
        replacementExpiryDays: 30,
        portalBookingEnabled: true,
      })
      return { patientId: pId, token: rawToken, packageId: patientPkgId, roomId: rId, professionalId: profId, serviceId: sId }
    })

    const baseSched = {
      title: 'Turma Pilates',
      type: 'turma' as const,
      specialty: 'pilates' as const,
      roomId,
      professionalId,
      serviceId,
      maxCapacity: 5,
      status: 'scheduled' as const,
    }

    // Aula atual que o aluno quer remarcar (segunda 14/09/2099 08:00)
    const { currentPartId, conflictScheduleId, freeScheduleId } = await t.run(async ctx => {
      const sourceSched = await ctx.db.insert('schedules', {
        ...baseSched,
        date: '2099-09-14',
        startTime: '08:00',
        endTime: '08:30',
      })
      const currentPart = await ctx.db.insert('scheduleParticipants', {
        scheduleId: sourceSched,
        patientId,
        patientPackageId: packageId,
        status: 'scheduled',
      })

      // Outra aula que o paciente JÁ TEM na quarta 23/09/2099 08:00
      const wedSched = await ctx.db.insert('schedules', {
        ...baseSched,
        date: '2099-09-23',
        startTime: '08:00',
        endTime: '08:30',
      })
      await ctx.db.insert('scheduleParticipants', {
        scheduleId: wedSched,
        patientId,
        patientPackageId: packageId,
        status: 'scheduled',
      })

      // Horário livre na quarta 23/09/2099 10:00
      const openSched = await ctx.db.insert('schedules', {
        ...baseSched,
        date: '2099-09-23',
        startTime: '10:00',
        endTime: '10:30',
      })

      return { currentPartId: currentPart, conflictScheduleId: wedSched, freeScheduleId: openSched }
    })

    // 1. Consultar listAvailableSlotsForBooking para o dia 23/09/2099
    const slots = await t.query(api.patientPortal.listAvailableSlotsForBooking, {
      portalToken: token,
      patientId,
      specialty: 'pilates',
      startDate: '2099-09-23',
      daysCount: 1,
      serviceId,
      excludeParticipantId: currentPartId,
    })

    expect(slots.length).toBeGreaterThanOrEqual(2)
    const conflictSlot = slots.find(s => s.scheduleId === conflictScheduleId)
    const freeSlot = slots.find(s => s.scheduleId === freeScheduleId)

    expect(conflictSlot).toBeDefined()
    expect(conflictSlot?.isAlreadyEnrolled).toBe(true)
    expect(conflictSlot?.canSelect).toBe(false)

    expect(freeSlot).toBeDefined()
    expect(freeSlot?.isAlreadyEnrolled).toBe(false)
    expect(freeSlot?.hasConflict).toBe(false)
    expect(freeSlot?.canSelect).toBe(true)

    // 2. Tentar remarcar para o horário conflitante deve falhar com mensagem explicativa em ConvexError
    await expect(
      t.mutation(api.patientPortal.rescheduleAppointmentByPatient, {
        portalToken: token,
        patientId,
        participantId: currentPartId,
        targetScheduleId: conflictScheduleId,
      })
    ).rejects.toThrow(/Você já possui um agendamento conflitante/i)

    // 3. Remarcar para o horário livre deve ter sucesso mesmo com remainingSessions = 0 no pacote
    const res = await t.mutation(api.patientPortal.rescheduleAppointmentByPatient, {
      portalToken: token,
      patientId,
      participantId: currentPartId,
      targetScheduleId: freeScheduleId,
    })

    expect(res.success).toBe(true)
    expect(res.newDate).toBe('2099-09-23')
    expect(res.newStartTime).toBe('10:00')

    // Verificar que a participação antiga ficou como 'justified_absence' e a nova como 'scheduled'
    const parts = await t.run(ctx => ctx.db.query('scheduleParticipants').collect())
    const oldPart = parts.find(p => p._id === currentPartId)
    const newPart = parts.find(p => p.scheduleId === freeScheduleId && p.patientId === patientId)

    expect(oldPart?.status).toBe('justified_absence')
    expect(newPart?.status).toBe('scheduled')
    expect(newPart?.patientPackageId).toBe(packageId)
  })
})
