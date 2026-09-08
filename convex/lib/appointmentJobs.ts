import type { MutationCtx } from '../_generated/server'
import type { Doc, Id } from '../_generated/dataModel'
import { internal } from '../_generated/api'

export { occupiesSeat } from '../../shared/scheduleOccupancy'
export const sessionTime = (s: { date: string; startTime: string }) => Date.parse(`${s.date}T${s.startTime}:00-03:00`)
export const scheduleFingerprint = (s: Doc<'schedules'>) => [s.date, s.startTime, s.endTime, s.specialty, s.professionalId, s.roomId].join('|')
export const clinicToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(Date.now())

export async function queueAppointmentJob(ctx: MutationCtx, data: Omit<Doc<'appointmentJobs'>, '_id' | '_creationTime' | 'status' | 'scheduledFunctionId'>) {
  const id = await ctx.db.insert('appointmentJobs', { ...data, status: 'queued' })
  const scheduledFunctionId = await ctx.scheduler.runAt(Math.max(Date.now(), data.dueAt), internal.appointmentNotifications.send, { jobId: id })
  await ctx.db.patch(id, { scheduledFunctionId })
  return id
}

export async function cancelParticipantJobs(ctx: MutationCtx, participantId: Id<'scheduleParticipants'>) {
  const jobs = await ctx.db.query('appointmentJobs').withIndex('by_participant', q => q.eq('participantId', participantId)).collect()
  for (const job of jobs) {
    if (!['queued', 'failed', 'uncertain'].includes(job.status)) continue
    if (job.scheduledFunctionId) {
      const scheduled = await ctx.db.system.get(job.scheduledFunctionId)
      if (scheduled?.state.kind === 'pending') await ctx.scheduler.cancel(job.scheduledFunctionId)
    }
    await ctx.db.patch(job._id, { status: 'skipped' })
  }
}

export async function prepareReminders(ctx: MutationCtx, participantId: Id<'scheduleParticipants'>) {
  const p = await ctx.db.get(participantId)
  const s = p && await ctx.db.get(p.scheduleId)
  if (!p || !s || s.status !== 'scheduled' || !['scheduled', 'replacement'].includes(p.status)) {
    await cancelParticipantJobs(ctx, participantId)
    return
  }
  const fingerprint = scheduleFingerprint(s)
  const jobs = await ctx.db.query('appointmentJobs').withIndex('by_participant', q => q.eq('participantId', participantId)).collect()
  if (jobs.some(j => j.status === 'queued' && j.fingerprint !== fingerprint)) await cancelParticipantJobs(ctx, participantId)
  for (const [kind, minutes] of [['reminder_1h', 60], ['reminder_30m', 30]] as const) {
    const dueAt = sessionTime(s) - minutes * 60000
    if (dueAt < Date.now() || jobs.some(j => j.kind === kind && j.fingerprint === fingerprint && j.status !== 'skipped')) continue
    await queueAppointmentJob(ctx, { patientId: p.patientId, scheduleId: s._id, participantId, kind, fingerprint, dueAt })
  }
}
