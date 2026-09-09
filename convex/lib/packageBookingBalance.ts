import type { QueryCtx } from '../_generated/server'
import type { Doc } from '../_generated/dataModel'
import { clinicToday, occupiesSeat, sessionTime } from './appointmentJobs'

export async function getPackageBookingBalance(ctx: QueryCtx, pkg: Doc<'patientPackages'>, participations?: Doc<'scheduleParticipants'>[]) {
  const own = participations ?? await ctx.db.query('scheduleParticipants').withIndex('by_patient', q => q.eq('patientId', pkg.patientId)).collect()
  const commitments = []
  for (const participant of own.filter(occupiesSeat)) {
    const schedule = await ctx.db.get(participant.scheduleId)
    if (schedule && schedule.status !== 'cancelled' && sessionTime(schedule) > Date.now()) commitments.push({ ...schedule, participant })
  }
  const credits = await ctx.db.query('replacementCredits').withIndex('by_patient_status', q => q.eq('patientId', pkg.patientId).eq('status', 'available')).collect()
  const creditCount = credits.filter(c => c.expiryDate >= clinicToday() && own.some(p => p.scheduleId === c.originScheduleId && p.patientPackageId === pkg._id)).length
  const bookedCount = commitments.filter(s => s.participant.patientPackageId === pkg._id).length
  return { commitments, bookedCount, creditCount, freeBalance: Math.max(0, pkg.remainingSessions - bookedCount - creditCount) }
}
