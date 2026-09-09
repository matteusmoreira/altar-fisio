import { effectiveScheduleCapacity } from './lib/scheduleService'
import { assertPortalBookingOpen } from './lib/portalBooking'
import { v } from 'convex/values'
import { mutation, query, internalMutation } from './_generated/server'
import { requirePatient, requireStaff } from './lib/security'
import { creditBookingError, enterWaitlist, processWaitlist, WAITLIST_NOTICE_MS } from './lib/waitlist'
import { occupiesSeat, sessionTime, clinicToday } from './lib/appointmentJobs'
import { validDate } from './lib/validation'
import { internal } from './_generated/api'

export const resume = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    if ((await ctx.db.query('clinicSettings').first())?.portalBookingEnabled === false) return
    const page = await ctx.db.query('waitlistEntries').paginate({ cursor: args.cursor, numItems: 50 })
    for (const id of new Set(page.page.filter(e => e.status === 'waiting').map(e => e.scheduleId))) await processWaitlist(ctx, id)
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.waitlist.resume, { cursor: page.continueCursor })
  },
})

export const join = mutation({
  args: { portalToken: v.string(), creditId: v.id('replacementCredits'), scheduleId: v.id('schedules') },
  handler: async (ctx, args) => {
    const patient = await requirePatient(ctx, args.portalToken)
    await assertPortalBookingOpen(ctx)
    return enterWaitlist(ctx, patient._id, args.creditId, args.scheduleId)
  },
})
export const leave = mutation({
  args: { portalToken: v.string(), entryId: v.id('waitlistEntries') },
  handler: async (ctx, args) => {
    const p = await requirePatient(ctx, args.portalToken)
    const e = await ctx.db.get(args.entryId)
    if (!e || e.patientId !== p._id) throw new Error('Acesso não autorizado.')
    if (e.status !== 'waiting') throw new Error('A fila já foi processada. Confira seus compromissos.')
    await ctx.db.patch(e._id, { status: 'cancelled', reason: 'Paciente saiu da fila.' })
  },
})
export const mine = query({
  args: { portalToken: v.string() },
  handler: async (ctx, args) => {
    const p = await requirePatient(ctx, args.portalToken)
    const entries = await ctx.db.query('waitlistEntries').withIndex('by_patient', q => q.eq('patientId', p._id)).order('desc').take(50)
    return Promise.all(entries.map(async e => {
      const s = await ctx.db.get(e.scheduleId)
      const credit = await ctx.db.get(e.creditId)
      const waiting = await ctx.db.query('waitlistEntries').withIndex('by_schedule_status', q => q.eq('scheduleId', e.scheduleId).eq('status', 'waiting')).collect()
      return { ...e, schedule: s ? { date: s.date, startTime: s.startTime, endTime: s.endTime, title: s.title } : null, expiryDate: credit?.expiryDate, position: e.status === 'waiting' ? waiting.findIndex(row => row._id === e._id) + 1 : null }
    }))
  },
})
export const slots = query({
  args: { portalToken: v.string(), creditId: v.id('replacementCredits'), date: v.string() },
  handler: async (ctx, args) => {
    const p = await requirePatient(ctx, args.portalToken)
    validDate(args.date)
    const schedules = await ctx.db.query('schedules').withIndex('by_date', q => q.eq('date', args.date)).collect()
    const slots = []
    for (const s of schedules) {
      if (await creditBookingError(ctx, p._id, args.creditId, s)) continue
      const parts = await ctx.db.query('scheduleParticipants').withIndex('by_schedule', q => q.eq('scheduleId', s._id)).collect()
      const vacanciesLeft = Math.max(0, await effectiveScheduleCapacity(ctx, s) - parts.filter(occupiesSeat).length)
      const canWait = sessionTime(s) - Date.now() >= WAITLIST_NOTICE_MS
      if (!vacanciesLeft && !canWait) continue
      slots.push({ scheduleId: s._id, title: s.title, date: s.date, startTime: s.startTime, endTime: s.endTime, vacanciesLeft, canWait, professionalName: (await ctx.db.get(s.professionalId))?.name, roomName: (await ctx.db.get(s.roomId))?.name })
    }
    return slots.sort((a, b) => a.startTime.localeCompare(b.startTime))
  },
})
export const forStaff = query({
  args: { sessionToken: v.string(), scheduleId: v.id('schedules') },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken, ['admin', 'reception', 'professional'])
    const entries = await ctx.db.query('waitlistEntries').withIndex('by_schedule_status', q => q.eq('scheduleId', args.scheduleId)).collect()
    const jobs = await ctx.db.query('appointmentJobs').withIndex('by_schedule', q => q.eq('scheduleId', args.scheduleId)).collect()
    return Promise.all(entries.map(async e => ({ ...e, patientName: (await ctx.db.get(e.patientId))?.name || 'Paciente', jobs: jobs.filter(j => j.entryId === e._id && ['failed', 'uncertain', 'sending'].includes(j.status)) })))
  },
})
export const staffCredits = query({
  args: { sessionToken: v.string(), patientId: v.id('patients') },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken, ['admin', 'reception', 'professional'])
    const credits = await ctx.db.query('replacementCredits').withIndex('by_patient_status', q => q.eq('patientId', args.patientId).eq('status', 'available')).collect()
    return credits.filter(c => c.expiryDate >= clinicToday())
  },
})
export const staffJoin = mutation({
  args: { sessionToken: v.string(), patientId: v.id('patients'), creditId: v.id('replacementCredits'), scheduleId: v.id('schedules') },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken, ['admin', 'reception'])
    return enterWaitlist(ctx, args.patientId, args.creditId, args.scheduleId)
  },
})
export const staffLeave = mutation({
  args: { sessionToken: v.string(), entryId: v.id('waitlistEntries') },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken, ['admin', 'reception'])
    const e = await ctx.db.get(args.entryId)
    if (!e || e.status !== 'waiting') throw new Error('Inscrição não está aguardando.')
    await ctx.db.patch(e._id, { status: 'cancelled', reason: 'Retirada pela recepção.' })
  },
})
export const expire = internalMutation({ args: { scheduleId: v.id('schedules') }, handler: async (ctx, args) => { await processWaitlist(ctx, args.scheduleId) } })
