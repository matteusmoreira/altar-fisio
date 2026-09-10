import type { MutationCtx, QueryCtx } from '../_generated/server'
import type { Doc, Id } from '../_generated/dataModel'
import { sliceTimeWindowIntoSlots } from '../availability'
import { occupiesSeat } from '../../shared/scheduleOccupancy'
import { isFutureBooking } from '../../shared/bookingTime'

type Specialty = Doc<'services'>['specialty']
export type BookingSelection = {
  date: string
  specialty?: Specialty
  professionalId?: Id<'professionals'>
  serviceId?: Id<'services'>
  packageId?: Id<'packages'>
}

export async function resolveBookingService(ctx: QueryCtx | MutationCtx, args: Pick<BookingSelection, 'serviceId' | 'packageId'>) {
  let serviceId = args.serviceId
  if (args.packageId) {
    const pkg = await ctx.db.get(args.packageId)
    if (!pkg?.active || pkg.showInPublicBooking === false) return null
    serviceId = pkg.serviceId
  }
  const service = serviceId ? await ctx.db.get(serviceId) : null
  if (serviceId && !service?.active) return null
  return service
}

export async function getPublicSlots(ctx: QueryCtx | MutationCtx, args: BookingSelection) {
  const now = Date.now()
  const service = await resolveBookingService(ctx, args)
  if ((args.packageId || args.serviceId) && !service) return []
  const specialty = service?.specialty ?? args.specialty
  const rooms = await ctx.db.query('rooms').withIndex('by_active', q => q.eq('isActive', true)).collect()
  const professionals = await ctx.db.query('professionals').withIndex('by_active', q => q.eq('active', true)).collect()
  const schedules = (await ctx.db.query('schedules').withIndex('by_date', q => q.eq('date', args.date)).collect()).filter(s => s.status !== 'cancelled')
  const occupancy = new Map(await Promise.all(schedules.map(async s => {
    const participants = await ctx.db.query('scheduleParticipants').withIndex('by_schedule', q => q.eq('scheduleId', s._id)).collect()
    return [s._id, participants.filter(occupiesSeat).length] as const
  })))
  const configuredRules = await ctx.db.query('availabilityRules').collect()
  const overrides = await ctx.db.query('availabilityOverrides').withIndex('by_date', q => q.eq('date', args.date)).collect()
  const day = new Date(`${args.date}T12:00:00-03:00`).getUTCDay()
  type Candidate = { start: string; end: string; roomId: Id<'rooms'>; professionalId: Id<'professionals'>; specialty: Specialty }
  const candidates: Candidate[] = []
  for (const rule of configuredRules.filter(r => r.isActive && r.dayOfWeek === day)) {
    for (const slice of sliceTimeWindowIntoSlots(rule.startTime, rule.endTime, rule.slotDurationMinutes ?? 50, rule.breakMinutes ?? 10)) {
      candidates.push({ ...slice, roomId: rule.roomId, professionalId: rule.professionalId, specialty: rule.specialty })
    }
  }
  for (const extra of overrides.filter(o => o.type === 'extra')) {
    if (!extra.roomId || !extra.startTime || !extra.endTime) continue
    for (const slice of sliceTimeWindowIntoSlots(extra.startTime, extra.endTime, 50, 10)) {
      candidates.push({ ...slice, roomId: extra.roomId, professionalId: extra.professionalId, specialty: extra.specialty ?? 'fisioterapia' })
    }
  }
  // Compatibility for clinics that have never configured a weekly schedule.
  if (configuredRules.length === 0) {
    for (const room of rooms) {
      const roomSpecialty = room.type.startsWith('pilates') ? 'pilates' : room.type === 'rpg' ? 'rpg' : 'fisioterapia'
      for (const professional of professionals) {
        for (const hour of [7, 8, 9, 10, 11, 14, 15, 16, 17, 18, 19]) {
          const start = `${String(hour).padStart(2, '0')}:00`
          candidates.push({ start, end: `${start.slice(0, 2)}:55`, roomId: room._id, professionalId: professional._id, specialty: roomSpecialty })
        }
      }
    }
  }
  type RoomOption = { roomId: Id<'rooms'>; roomName: string; professionalId: Id<'professionals'>; specialty: Specialty; capacity: number; occupied: number; availableSpots: number; existingScheduleId: Id<'schedules'> | null; modality: 'individual' | 'turma' }
  const grouped = new Map<string, { startTime: string; endTime: string; rooms: RoomOption[] }>()
  for (const candidate of candidates) {
    if (!isFutureBooking(args.date, candidate.start, now)) continue
    if (specialty && candidate.specialty !== specialty) continue
    if (args.professionalId && candidate.professionalId !== args.professionalId) continue
    const room = rooms.find(r => r._id === candidate.roomId)
    const professional = professionals.find(p => p._id === candidate.professionalId)
    if (!room || !professional || !professional.specialties.some(s => s.toLowerCase().includes(candidate.specialty))) continue
    if (overrides.some(b => b.type === 'block' && b.professionalId === professional._id && (!b.roomId || b.roomId === room._id) && (!b.startTime || !b.endTime || (b.startTime < candidate.end && candidate.start < b.endTime)))) continue
    const key = `${candidate.start}-${candidate.end}`
    let slot = grouped.get(key)
    if (!slot) { slot = { startTime: candidate.start, endTime: candidate.end, rooms: [] }; grouped.set(key, slot) }
    const overlaps = schedules.filter(s => (s.roomId === room._id || s.professionalId === professional._id) && s.startTime < candidate.end && candidate.start < s.endTime)
    const existing = overlaps.find(s => s.roomId === room._id && s.professionalId === professional._id && s.specialty === candidate.specialty && s.startTime === candidate.start && s.endTime === candidate.end && (!service || (s.type === service.modality && (!s.serviceId || s.serviceId === service._id))))
    if (overlaps.some(s => s._id !== existing?._id)) continue
    const modality = service?.modality ?? existing?.type ?? (room.capacity > 1 ? 'turma' : 'individual')
    const capacity = Math.min(room.capacity, modality === 'individual' ? 1 : service?.maxCapacity ?? room.capacity, existing?.maxCapacity ?? room.capacity)
    const occupied = existing ? occupancy.get(existing._id) ?? 0 : 0
    const availableSpots = Math.max(0, capacity - occupied)
    if (availableSpots > 0 && !slot.rooms.some(r => r.roomId === room._id && r.professionalId === professional._id)) {
      slot.rooms.push({ roomId: room._id, roomName: room.name, professionalId: professional._id, specialty: candidate.specialty, capacity, occupied, availableSpots, existingScheduleId: existing?._id ?? null, modality })
    }
  }
  return Array.from(grouped.values()).sort((a, b) => a.startTime.localeCompare(b.startTime) || a.endTime.localeCompare(b.endTime)).map(slot => {
    const roomSpots = new Map(slot.rooms.map(r => [r.roomId, r.availableSpots]))
    return { ...slot, isAvailable: slot.rooms.length > 0, totalAvailableSpots: [...roomSpots.values()].reduce((a, b) => a + b, 0), availableProfessionals: professionals.filter(p => slot.rooms.some(r => r.professionalId === p._id)).map(p => ({ id: p._id, name: p.name, specialties: p.specialties })) }
  })
}
