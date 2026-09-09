import { ConvexError, v } from 'convex/values'
import type { QueryCtx } from '../_generated/server'
import { requirePatient } from './security'
import { scheduleService, effectiveScheduleCapacity } from './scheduleService'
import { getPackageBookingBalance } from './packageBookingBalance'
import { occupiesSeat, sessionTime } from './appointmentJobs'
import { monthDates } from '../../shared/monthlySchedule'

export const monthlyArgs = { portalToken: v.string(), patientPackageId: v.id('patientPackages'), month: v.string() }
export const choiceValidator = v.array(v.object({ recurringGroupId: v.string(), dayOfWeek: v.number() }))
export type MonthlyArgs = { portalToken: string; patientPackageId: import('../_generated/dataModel').Id<'patientPackages'>; month: string }
export async function monthlyOptions(ctx: QueryCtx, args: MonthlyArgs) {
  const patient = await requirePatient(ctx, args.portalToken)
  const bookingEnabled = (await ctx.db.query('clinicSettings').first())?.portalBookingEnabled !== false
  monthDates(args.month, [1])
  const pkg = await ctx.db.get(args.patientPackageId)
  if (!pkg || pkg.patientId !== patient._id) throw new ConvexError('Plano não encontrado para este paciente.')
  const definition = await ctx.db.get(pkg.packageId)
  const serviceId = pkg.serviceId ?? definition?.serviceId
  const service = serviceId ? await ctx.db.get(serviceId) : null
  if (!service?.active || service.modality !== 'turma') return { patientId: patient._id, serviceId: null, freeBalance: 0, groups: [], bookingEnabled, issue: 'Este plano precisa de um serviço de tratamento em grupo ativo. Fale com a recepção.' }
  const schedules = await ctx.db.query('schedules').withIndex('by_date', q => q.gte('date', `${args.month}-01`).lte('date', `${args.month}-31`)).collect()
  const own = await ctx.db.query('scheduleParticipants').withIndex('by_patient', q => q.eq('patientId', patient._id)).collect()
  const { commitments, freeBalance } = await getPackageBookingBalance(ctx, pkg, own)
  const groups = new Map<string, { key: string; recurringGroupId: string; dayOfWeek: number; title: string; startTime: string; endTime: string; professionalName: string; roomName: string; dates: { scheduleId: typeof schedules[number]['_id']; date: string; startTime: string; endTime: string; professionalName: string; roomName: string; alreadyBooked: boolean; vacancies: number; error: string | null }[] }>()
  for (const s of schedules) {
    if (!s.recurringGroupId || s.type !== 'turma' || sessionTime(s) <= Date.now()) continue
    if ((await scheduleService(ctx, s))?._id !== service._id) continue
    const dayOfWeek = new Date(`${s.date}T12:00:00Z`).getUTCDay()
    const key = `${s.recurringGroupId}:${dayOfWeek}`
    const room = await ctx.db.get(s.roomId), professional = await ctx.db.get(s.professionalId)
    const group = groups.get(key) ?? { key, recurringGroupId: s.recurringGroupId, dayOfWeek, title: s.title, startTime: s.startTime, endTime: s.endTime, roomName: room?.name ?? 'Sala indisponível', professionalName: professional?.name ?? 'Profissional indisponível', dates: [] }
    const parts = await ctx.db.query('scheduleParticipants').withIndex('by_schedule', q => q.eq('scheduleId', s._id)).collect()
    const alreadyBooked = commitments.some(c => c._id === s._id && c.participant.patientPackageId === pkg._id)
    const vacancies = Math.max(0, await effectiveScheduleCapacity(ctx, s) - parts.filter(occupiesSeat).length)
    const conflict = commitments.some(c => c._id !== s._id && c.date === s.date && c.startTime < s.endTime && s.startTime < c.endTime)
    const error = s.status !== 'scheduled' || !room?.isActive || !professional?.active ? 'Turma indisponível' : pkg.status !== 'active' || s.date < pkg.startDate || s.date > pkg.expiryDate ? 'Fora da validade do plano' : conflict ? 'Conflito com outro agendamento' : !alreadyBooked && parts.some(p => p.patientId === patient._id && occupiesSeat(p)) ? 'Já reservado com outro plano' : !alreadyBooked && vacancies === 0 ? 'Turma lotada' : null
    group.dates.push({ scheduleId: s._id, date: s.date, startTime: s.startTime, endTime: s.endTime, professionalName: professional?.name ?? 'Profissional indisponível', roomName: room?.name ?? 'Sala indisponível', alreadyBooked, vacancies, error })
    groups.set(key, group)
  }
  return { patientId: patient._id, serviceId: service._id, freeBalance, bookingEnabled, issue: null, groups: [...groups.values()].sort((a,b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)) }
}
export async function reviewMonthly(ctx: QueryCtx, args: MonthlyArgs & { choices: { recurringGroupId: string; dayOfWeek: number }[] }) {
  const options = await monthlyOptions(ctx, args)
  if (args.choices.length < 1 || args.choices.length > 5 || new Set(args.choices.map(c => c.dayOfWeek)).size !== args.choices.length) throw new ConvexError('Escolha de 1 a 5 dias distintos por semana.')
  const groups = args.choices.map(c => options.groups.find(g => g.recurringGroupId === c.recurringGroupId && g.dayOfWeek === c.dayOfWeek))
  if (groups.some(g => !g)) return { ...options, dates: [], required: 0, errors: ['Uma turma mudou ou não está disponível. Selecione novamente.'], canConfirm: false }
  const dates = groups.flatMap(g => g!.dates).sort((a,b) => a.date.localeCompare(b.date))
  const required = dates.filter(d => !d.alreadyBooked).length
  const errors = dates.filter(d => d.error).map(d => `${d.date}: ${d.error}`)
  if (required > options.freeBalance) errors.push(`São necessárias ${required} sessões, mas seu saldo livre é ${options.freeBalance}. Reduza a frequência ou fale com a recepção.`)
  return { ...options, dates, required, errors, canConfirm: options.bookingEnabled && errors.length === 0 && dates.length > 0 }
}
