import type { MutationCtx } from '../_generated/server'
import type { Id } from '../_generated/dataModel'
import { ConvexError } from 'convex/values'
import { getPublicSlots, resolveBookingService, type BookingSelection } from './bookingSlots'
import { validateSchedule } from './validation'
import { processWaitlist } from './waitlist'
import { prepareReminders } from './appointmentJobs'
import { occupiesSeat } from '../../shared/scheduleOccupancy'

export async function bookGroupSession(ctx: MutationCtx, args: BookingSelection & {
  patientId: Id<'patients'>
  patientPackageId?: Id<'patientPackages'>
  roomId?: Id<'rooms'>
  startTime: string
  endTime: string
  packageName?: string
  notes?: string
}) {
  if (new Date(`${args.date}T${args.startTime}:00-03:00`).getTime() <= Date.now()) throw new ConvexError('Selecione um horário futuro.')
  const slots = await getPublicSlots(ctx, args)
  const slot = slots.find(s => s.startTime === args.startTime && s.endTime === args.endTime)
  const selected = slot?.rooms.find(r => (!args.roomId || r.roomId === args.roomId) && (!args.professionalId || r.professionalId === args.professionalId))
  if (!selected) throw new ConvexError('Horário indisponível ou lotado. Atualize a agenda.')
  let scheduleId = selected.existingScheduleId
  if (scheduleId) {
    await processWaitlist(ctx, scheduleId)
    const participants = await ctx.db.query('scheduleParticipants').withIndex('by_schedule', q => q.eq('scheduleId', scheduleId!)).collect()
    const active = participants.filter(occupiesSeat)
    if (active.length >= selected.capacity || active.some(p => p.patientId === args.patientId)) throw new ConvexError('Horário lotado ou já reservado para este paciente.')
  } else {
    const data = { roomId: selected.roomId, professionalId: selected.professionalId, date: args.date, startTime: args.startTime, endTime: args.endTime, maxCapacity: selected.capacity }
    await validateSchedule(ctx, data)
    scheduleId = await ctx.db.insert('schedules', { ...data, serviceId: (await resolveBookingService(ctx, args))?._id, title: `${args.packageName || selected.specialty.toUpperCase()} (Online)`, type: selected.modality, specialty: selected.specialty, status: 'scheduled' })
  }
  const participantId = await ctx.db.insert('scheduleParticipants', {
    scheduleId,
    patientId: args.patientId,
    status: 'scheduled',
    patientPackageId: args.patientPackageId,
    notes: args.notes || 'Agendamento online',
  })
  await prepareReminders(ctx, participantId)
  return { scheduleId, participantId }
}
