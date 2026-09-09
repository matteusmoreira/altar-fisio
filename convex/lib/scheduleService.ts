import type { QueryCtx } from '../_generated/server'
import type { Doc } from '../_generated/dataModel'

// Legacy sessions are eligible only when their service can be resolved unambiguously.
export async function scheduleService(ctx: QueryCtx, schedule: Doc<'schedules'>) {
  if (schedule.serviceId) return ctx.db.get(schedule.serviceId)
  const services = (await ctx.db.query('services').collect()).filter(s => s.active && s.specialty === schedule.specialty && s.modality === schedule.type && s.durationMinutes === minutes(schedule.endTime) - minutes(schedule.startTime))
  return services.length === 1 ? services[0] : null
}

export async function effectiveScheduleCapacity(ctx: QueryCtx, schedule: Doc<'schedules'>) {
  const [room, service] = await Promise.all([ctx.db.get(schedule.roomId), scheduleService(ctx, schedule)])
  if (!room?.isActive || (schedule.serviceId && !service?.active)) return 0
  return Math.max(0, Math.min(schedule.maxCapacity, room.capacity, service?.maxCapacity ?? schedule.maxCapacity, schedule.type === 'individual' ? 1 : schedule.maxCapacity))
}
function minutes(time: string) { const [h, m] = time.split(':').map(Number); return h * 60 + m }
