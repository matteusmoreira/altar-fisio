import { v, ConvexError } from 'convex/values'
import { query, mutation } from './_generated/server'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { requireStaff } from './lib/security'
import { occupiesSeat } from '../shared/scheduleOccupancy'
import { checkTimeOverlap } from './schedules'
import { sliceTimeWindowIntoSlots } from './availability'
import { getPackageBookingBalance } from './lib/packageBookingBalance'
import { cancelParticipantJobs, prepareReminders } from './lib/appointmentJobs'
import { enterWaitlist, processWaitlist } from './lib/waitlist'
import { monthDates } from '../shared/monthlySchedule'

// ─── Queries ────────────────────────────────────────────────────────────────

/** Grade semanal: slots por sala/horário com ocupação e profissionais */
export const getWeeklyGridData = query({
  args: {
    sessionToken: v.string(),
    weekStart: v.string(),
    specialtyFilter: v.optional(v.string()),
  },
  handler: async (ctx, input) => {
    const { sessionToken, ...args } = input
    await requireStaff(ctx, sessionToken, ['admin', 'reception'])

    // Calcula os 6 dias (seg-sáb) a partir do weekStart (YYYY-MM-DD)
    const [year, month, day] = args.weekStart.split('-').map(Number)
    const dates: string[] = []
    for (let i = 0; i < 6; i++) {
      const d = new Date(Date.UTC(year, month - 1, day + i, 12, 0, 0))
      dates.push(d.toISOString().split('T')[0])
    }

    const rooms = await ctx.db.query('rooms').withIndex('by_active', q => q.eq('isActive', true)).collect()
    const professionals = await ctx.db.query('professionals').withIndex('by_active', q => q.eq('active', true)).collect()
    const profMap = Object.fromEntries(professionals.map(p => [p._id, p.name]))

    // Busca todas as regras de disponibilidade ativas via índice
    const allRules = await ctx.db.query('availabilityRules').withIndex('by_active', q => q.eq('isActive', true)).collect()

    // Busca todos os schedules da semana em paralelo
    const daySchedulesArray = await Promise.all(
      dates.map(date => ctx.db.query('schedules').withIndex('by_date', q => q.eq('date', date)).collect())
    )
    const allSchedules = daySchedulesArray.flat().filter(s => s.status !== 'cancelled')

    // Busca participantes de todos os schedules da semana em paralelo (elimina N+1 sequencial)
    const scheduleIds = allSchedules.map(s => s._id)
    const participantsNested = await Promise.all(
      scheduleIds.map(sid =>
        ctx.db.query('scheduleParticipants').withIndex('by_schedule', q => q.eq('scheduleId', sid)).collect()
      )
    )
    const allParticipants = participantsNested.flat()

    // Busca overrides (bloqueios/extras) da semana em paralelo
    const overridesArray = await Promise.all(
      dates.map(date => ctx.db.query('availabilityOverrides').withIndex('by_date', q => q.eq('date', date)).collect())
    )
    const allOverrides = overridesArray.flat()

    // Busca pacientes referenciados em paralelo
    const patientIds = [...new Set(allParticipants.map(p => p.patientId))]
    const patientDocs = await Promise.all(patientIds.map(pid => ctx.db.get(pid)))
    const patientMap: Record<string, string> = {}
    for (let i = 0; i < patientIds.length; i++) {
      if (patientDocs[i]) patientMap[patientIds[i]] = patientDocs[i]!.name
    }

    // Monta os slots por dia/sala
    const gridSlots: Array<{
      day: string
      dayOfWeek: number
      startTime: string
      endTime: string
      roomId: string
      roomName: string
      roomCapacity: number
      roomColor: string
      professionalId: string
      professionalName: string
      specialty: string
      scheduleId: string | null
      scheduleTitle: string | null
      scheduleType: string | null
      occupiedSeats: number
      totalCapacity: number
      participants: Array<{
        participantId: string
        patientId: string
        patientName: string
        status: string
      }>
    }> = []

    for (const date of dates) {
      const [y, m, dNum] = date.split('-').map(Number)
      const dayOfWeek = new Date(Date.UTC(y, m - 1, dNum, 12, 0, 0)).getUTCDay()

      const dayRules = allRules.filter(r => r.dayOfWeek === dayOfWeek)
      const dayBlocks = allOverrides.filter(o => o.type === 'block' && o.date === date)
      const daySchedules = allSchedules.filter(s => s.date === date)

      // Filtra por especialidade se solicitado
      const filteredRules = args.specialtyFilter
        ? dayRules.filter(r => r.specialty === args.specialtyFilter)
        : dayRules

      for (const rule of filteredRules) {
        const room = rooms.find(r => r._id === rule.roomId)
        if (!room) continue

        // Verifica bloqueio de dia inteiro
        const hasFullBlock = dayBlocks.some(b =>
          b.professionalId === rule.professionalId &&
          (!b.roomId || b.roomId === rule.roomId) &&
          !b.startTime && !b.endTime
        )
        if (hasFullBlock) continue

        const slices = sliceTimeWindowIntoSlots(
          rule.startTime,
          rule.endTime,
          rule.slotDurationMinutes || 50,
          rule.breakMinutes ?? 10
        )

        for (const slice of slices) {
          // Verifica bloqueio pontual
          const isBlocked = dayBlocks.some(b =>
            b.professionalId === rule.professionalId &&
            (!b.roomId || b.roomId === rule.roomId) &&
            b.startTime && b.endTime &&
            checkTimeOverlap(slice.start, slice.end, b.startTime!, b.endTime!)
          )
          if (isBlocked) continue

          // Busca schedule existente nesse slot
          const existingSchedule = daySchedules.find(s =>
            s.roomId === rule.roomId &&
            checkTimeOverlap(s.startTime, s.endTime, slice.start, slice.end)
          )

          const scheduleParticipants = existingSchedule
            ? allParticipants.filter(p => p.scheduleId === existingSchedule._id)
            : []

          const activeParticipants = scheduleParticipants.filter(occupiesSeat)
          const capacity = existingSchedule
            ? Math.min(existingSchedule.maxCapacity, room.capacity)
            : room.capacity

          gridSlots.push({
            day: date,
            dayOfWeek,
            startTime: slice.start,
            endTime: slice.end,
            roomId: rule.roomId,
            roomName: room.name,
            roomCapacity: room.capacity,
            roomColor: room.color,
            professionalId: rule.professionalId,
            professionalName: profMap[rule.professionalId] || 'Profissional',
            specialty: rule.specialty,
            scheduleId: existingSchedule?._id ?? null,
            scheduleTitle: existingSchedule?.title ?? null,
            scheduleType: existingSchedule?.type ?? null,
            occupiedSeats: activeParticipants.length,
            totalCapacity: capacity,
            participants: activeParticipants.map(p => ({
              participantId: p._id,
              patientId: p.patientId,
              patientName: patientMap[p.patientId] || 'Paciente',
              status: p.status,
            })),
          })
        }
      }
    }

    return {
      dates,
      rooms: rooms.map(r => ({ id: r._id, name: r.name, color: r.color, capacity: r.capacity, type: r.type })),
      slots: gridSlots,
    }
  },
})

/** Contexto do paciente: pacotes ativos, saldo livre, créditos */
export const getPatientBookingContext = query({
  args: {
    sessionToken: v.string(),
    patientId: v.id('patients'),
  },
  handler: async (ctx, input) => {
    const { sessionToken, ...args } = input
    await requireStaff(ctx, sessionToken, ['admin', 'reception'])

    const patient = await ctx.db.get(args.patientId)
    if (!patient) return null

    const packages = await ctx.db.query('patientPackages')
      .withIndex('by_patient', q => q.eq('patientId', args.patientId))
      .collect()

    const activePackages = packages.filter(p => p.status === 'active')

    const packagesWithBalance = await Promise.all(
      activePackages.map(async pkg => {
        const balance = await getPackageBookingBalance(ctx, pkg)
        const service = pkg.serviceId ? await ctx.db.get(pkg.serviceId) : null
        const packDef = pkg.packageId ? await ctx.db.get(pkg.packageId) : null
        return {
          id: pkg._id,
          serviceName: service?.name || packDef?.name || 'Pacote',
          specialty: service?.specialty || '',
          totalSessions: pkg.totalSessions,
          usedSessions: pkg.usedSessions,
          remainingSessions: pkg.remainingSessions,
          freeBalance: balance.freeBalance,
          expiryDate: pkg.expiryDate,
        }
      })
    )

    const credits = await ctx.db.query('replacementCredits')
      .withIndex('by_patient_status', q => q.eq('patientId', args.patientId).eq('status', 'available'))
      .collect()

    return {
      patient: { id: patient._id, name: patient.name, phone: patient.phone, cpf: patient.documentCpf },
      packages: packagesWithBalance,
      availableCredits: credits.length,
    }
  },
})

// ─── Mutations ──────────────────────────────────────────────────────────────

/** Confirmar agendamento rápido: único ou recorrente mensal */
export const confirmQuickBooking = mutation({
  args: {
    sessionToken: v.string(),
    patientId: v.id('patients'),
    patientPackageId: v.optional(v.id('patientPackages')),
    slots: v.array(v.object({
      day: v.string(),
      dayOfWeek: v.number(),
      startTime: v.string(),
      endTime: v.string(),
      roomId: v.id('rooms'),
      professionalId: v.id('professionals'),
      specialty: v.string(),
      scheduleId: v.optional(v.id('schedules')),
    })),
    isRecurring: v.boolean(),
    month: v.optional(v.string()), // YYYY-MM para recorrência mensal
  },
  handler: async (ctx, input) => {
    const { sessionToken, ...args } = input
    await requireStaff(ctx, sessionToken, ['admin', 'reception'])

    const patient = await ctx.db.get(args.patientId)
    if (!patient) throw new ConvexError('Paciente não encontrado.')

    const createdScheduleIds: string[] = []
    const errors: string[] = []

    if (args.isRecurring && args.month) {
      // Recorrência mensal: gera um identificador único de série recorrente
      const recurringGroupId = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`

      for (const slot of args.slots) {
        const dates = monthDates(args.month, [slot.dayOfWeek])

        for (const date of dates) {
          try {
            const sid = await enrollInSlot(ctx, {
              patientId: args.patientId,
              patientPackageId: args.patientPackageId,
              date,
              startTime: slot.startTime,
              endTime: slot.endTime,
              roomId: slot.roomId,
              professionalId: slot.professionalId,
              specialty: slot.specialty,
              recurringGroupId,
              isRecurring: true,
            })
            createdScheduleIds.push(sid)
          } catch (e: any) {
            errors.push(`${date} ${slot.startTime}: ${e.message}`)
          }
        }
      }
    } else {
      // Agendamento único para cada slot selecionado
      for (const slot of args.slots) {
        try {
          const sid = await enrollInSlot(ctx, {
            patientId: args.patientId,
            patientPackageId: args.patientPackageId,
            date: slot.day,
            startTime: slot.startTime,
            endTime: slot.endTime,
            roomId: slot.roomId,
            professionalId: slot.professionalId,
            specialty: slot.specialty,
          })
          createdScheduleIds.push(sid)
        } catch (e: any) {
          errors.push(`${slot.day} ${slot.startTime}: ${e.message}`)
        }
      }
    }

    return { createdCount: createdScheduleIds.length, scheduleIds: createdScheduleIds, errors }
  },
})

/** Lógica interna: matricula paciente em um slot (cria schedule se necessário) */
async function enrollInSlot(ctx: any, args: {
  patientId: Id<'patients'>
  patientPackageId?: Id<'patientPackages'>
  date: string
  startTime: string
  endTime: string
  roomId: Id<'rooms'>
  professionalId: Id<'professionals'>
  specialty: string
  recurringGroupId?: string
  isRecurring?: boolean
}) {
  const room = await ctx.db.get(args.roomId)
  if (!room) throw new ConvexError('Sala não encontrada.')

  // Busca schedule existente nesse slot
  const daySchedules = await ctx.db.query('schedules')
    .withIndex('by_room_date', (q: any) => q.eq('roomId', args.roomId).eq('date', args.date))
    .collect()

  let schedule = daySchedules.find((s: any) =>
    s.status !== 'cancelled' &&
    checkTimeOverlap(s.startTime, s.endTime, args.startTime, args.endTime)
  )

  if (schedule) {
    // Verifica capacidade e duplicata
    const participants = await ctx.db.query('scheduleParticipants')
      .withIndex('by_schedule', (q: any) => q.eq('scheduleId', schedule!._id))
      .collect()

    const active = participants.filter(occupiesSeat)
    if (active.some((p: any) => p.patientId === args.patientId)) {
      throw new ConvexError('Paciente já está neste horário.')
    }
    const capacity = Math.min(schedule.maxCapacity, room.capacity)
    if (active.length >= capacity) {
      throw new ConvexError('Horário lotado.')
    }
  } else {
    // Cria novo schedule com vínculo correto
    const scheduleId = await ctx.db.insert('schedules', {
      title: `${args.specialty.charAt(0).toUpperCase() + args.specialty.slice(1)} ${args.startTime}`,
      type: room.capacity > 1 ? 'turma' as const : 'individual' as const,
      specialty: args.specialty,
      roomId: args.roomId,
      professionalId: args.professionalId,
      date: args.date,
      startTime: args.startTime,
      endTime: args.endTime,
      maxCapacity: room.capacity,
      status: 'scheduled' as const,
      recurringGroupId: args.recurringGroupId,
      isRecurring: args.isRecurring,
    })
    schedule = await ctx.db.get(scheduleId)
  }

  // Matricula o paciente
  const participantId = await ctx.db.insert('scheduleParticipants', {
    scheduleId: schedule!._id,
    patientId: args.patientId,
    status: 'scheduled' as const,
    patientPackageId: args.patientPackageId,
    notes: 'Agendamento rápido (balcão)',
  })

  await prepareReminders(ctx, participantId)
  return schedule!._id
}

/** Remarcar participante de um horário para outro com cancelamento limpo do anterior */
export const rescheduleParticipant = mutation({
  args: {
    sessionToken: v.string(),
    participantId: v.id('scheduleParticipants'),
    newDate: v.string(),
    newStartTime: v.string(),
    newEndTime: v.string(),
    newRoomId: v.id('rooms'),
    newProfessionalId: v.id('professionals'),
    specialty: v.string(),
  },
  handler: async (ctx, input) => {
    const { sessionToken, ...args } = input
    await requireStaff(ctx, sessionToken, ['admin', 'reception'])

    const participant = await ctx.db.get(args.participantId)
    if (!participant) throw new ConvexError('Participante não encontrado.')

    const oldScheduleId = participant.scheduleId

    // 1. Cancela jobs agendados de lembrete do horário antigo
    await cancelParticipantJobs(ctx, participant._id)

    // 2. Remove o registro do horário anterior (NÃO marca como absence para não imputar falta indevida)
    await ctx.db.delete(args.participantId)

    // 3. Processa fila de espera no horário antigo desocupado
    await processWaitlist(ctx, oldScheduleId)

    // 4. Matricula no novo horário
    const newScheduleId = await enrollInSlot(ctx, {
      patientId: participant.patientId,
      patientPackageId: participant.patientPackageId ?? undefined,
      date: args.newDate,
      startTime: args.newStartTime,
      endTime: args.newEndTime,
      roomId: args.newRoomId,
      professionalId: args.newProfessionalId,
      specialty: args.specialty,
    })

    return { newScheduleId }
  },
})

/** Adicionar à fila de espera utilizando crédito de reposição disponível */
export const addToWaitlistQuick = mutation({
  args: {
    sessionToken: v.string(),
    patientId: v.id('patients'),
    scheduleId: v.optional(v.id('schedules')),
    date: v.optional(v.string()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    roomId: v.optional(v.id('rooms')),
    professionalId: v.optional(v.id('professionals')),
    specialty: v.optional(v.string()),
  },
  handler: async (ctx, input) => {
    const { sessionToken, ...args } = input
    await requireStaff(ctx, sessionToken, ['admin', 'reception'])

    let targetScheduleId = args.scheduleId

    // Se o slot ainda não tiver um schedule materializado, cria agora para receber a fila de espera
    if (!targetScheduleId && args.roomId && args.professionalId && args.date && args.startTime && args.endTime && args.specialty) {
      const room = await ctx.db.get(args.roomId)
      targetScheduleId = await ctx.db.insert('schedules', {
        title: `${args.specialty.charAt(0).toUpperCase() + args.specialty.slice(1)} ${args.startTime}`,
        type: (room?.capacity ?? 1) > 1 ? 'turma' as const : 'individual' as const,
        specialty: args.specialty,
        roomId: args.roomId,
        professionalId: args.professionalId,
        date: args.date,
        startTime: args.startTime,
        endTime: args.endTime,
        maxCapacity: room?.capacity ?? 1,
        status: 'scheduled' as const,
      })
    }

    if (!targetScheduleId) {
      throw new ConvexError('Identificador da sessão não encontrado para a fila de espera.')
    }

    // Busca crédito de reposição ativo do paciente
    const credit = await ctx.db.query('replacementCredits')
      .withIndex('by_patient_status', q => q.eq('patientId', args.patientId).eq('status', 'available'))
      .first()

    if (!credit) {
      throw new ConvexError('Para entrar na fila de espera automática, o paciente precisa ter um crédito de reposição disponível.')
    }

    const waitlistId = await enterWaitlist(ctx, args.patientId, credit._id, targetScheduleId)
    return { success: true, scheduleId: targetScheduleId, waitlistId }
  },
})

/** Enviar confirmação WhatsApp consolidada com resumo de todos os horários via Scheduler interno */
export const sendQuickBookingWhatsApp = mutation({
  args: {
    sessionToken: v.string(),
    patientId: v.id('patients'),
    scheduleIds: v.array(v.id('schedules')),
    customMessage: v.optional(v.string()),
  },
  handler: async (ctx, input) => {
    const { sessionToken, ...args } = input
    await requireStaff(ctx, sessionToken, ['admin', 'reception'])

    const patient = await ctx.db.get(args.patientId)
    if (!patient?.phone) return { success: false, error: 'Paciente sem telefone cadastrado.' }

    let messageToSend = args.customMessage?.trim()

    if (!messageToSend) {
      const schedules = []
      for (const scheduleId of args.scheduleIds) {
        const schedule = await ctx.db.get(scheduleId)
        if (schedule) schedules.push(schedule)
      }
      schedules.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))

      const settings = await ctx.db.query('clinicSettings').first()
      const clinicName = settings?.clinicName || 'Altar Fisio'
      const noticeHours = settings?.cancellationNoticeHours ?? 2

      const firstSchedule = schedules[0]
      const prof = firstSchedule ? await ctx.db.get(firstSchedule.professionalId) : null
      const room = firstSchedule ? await ctx.db.get(firstSchedule.roomId) : null

      const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
      const datesList = schedules.map(s => {
        const [y, m, d] = s.date.split('-').map(Number)
        const dateObj = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
        const dayName = DAY_NAMES[dateObj.getUTCDay()]
        const formattedDate = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`
        return `• ${dayName}, ${formattedDate} às ${s.startTime}`
      }).join('\n')

      messageToSend = `Olá, *${patient.name}*! 🎉\n\nConfirmamos seus agendamentos na *${clinicName}*:\n\n📌 *Atividade:* ${firstSchedule?.title || 'Sessão'}\n👨‍⚕️ *Profissional:* ${prof?.name || 'Profissional'}\n📍 *Local:* ${room?.name || 'Sala Clínica'}\n\n🗓 *Datas e Horários Marcados:* (${schedules.length} sessões)\n${datesList}\n\n⚠️ *Regra de Desmarcação:* Caso precise desmarcar ou reagendar, faça com no mínimo *${noticeHours}h de antecedência* pelo Portal para liberar seu crédito de reposição automático.\n\nNos vemos na clínica!`
    }

    // Dispara APENAS 1 mensagem de WhatsApp com o resumo consolidado
    await ctx.scheduler.runAfter(0, internal.notifications.sendQuickBookingSummaryAction, {
      patientName: patient.name,
      phone: patient.phone,
      message: messageToSend,
    })

    return { success: true }
  },
})

