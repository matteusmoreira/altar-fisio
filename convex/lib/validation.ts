import { ConvexError } from 'convex/values'
import type { QueryCtx } from '../_generated/server'
import type { Id } from '../_generated/dataModel'

export function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(`${value}T12:00:00Z`)) || new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) !== value) throw new ConvexError('Data inválida.')
}
export function validAmount(value: number) {
  if (!Number.isFinite(value) || value <= 0 || value > 100_000_000 || Math.abs(value * 100 - Math.round(value * 100)) > 0.000001) throw new ConvexError('Informe valor positivo com até duas casas decimais.')
}
export async function validateSchedule(ctx: QueryCtx, data: {
  roomId: Id<'rooms'>; professionalId: Id<'professionals'>; date: string;
  startTime: string; endTime: string; maxCapacity: number; status?: string;
}, excludeId?: Id<'schedules'>) {
  validDate(data.date)
  if (![data.startTime, data.endTime].every(v => /^([01]\d|2[0-3]):[0-5]\d$/.test(v)) || data.startTime >= data.endTime) throw new ConvexError('Intervalo de horário inválido.')
  if (!Number.isInteger(data.maxCapacity) || data.maxCapacity < 1) throw new ConvexError('Capacidade inválida.')
  const room = await ctx.db.get(data.roomId)
  const professional = await ctx.db.get(data.professionalId)
  if (!room) throw new ConvexError('Sala não encontrada. Selecione uma sala cadastrada.')
  if (!room.isActive) throw new ConvexError(`A sala ${room.name} está inativa. Ative-a no cadastro de salas.`)
  if (!professional) throw new ConvexError('Profissional não encontrado. Selecione novamente.')
  if (!professional.active) throw new ConvexError(`O profissional ${professional.name} está inativo. Ative-o no cadastro de profissionais.`)
  if (data.maxCapacity > room.capacity) throw new ConvexError('Capacidade excede o limite da sala.')
  if (excludeId) {
    const participants = await ctx.db.query('scheduleParticipants').withIndex('by_schedule', q => q.eq('scheduleId', excludeId)).collect()
    if (participants.filter(p => !['absence', 'justified_absence'].includes(p.status)).length > data.maxCapacity) throw new ConvexError('Capacidade menor que o número de participantes.')
  }
  if (data.status === 'cancelled') return
  const sameDay = await ctx.db.query('schedules').withIndex('by_date', q => q.eq('date', data.date)).collect()
  if (sameDay.some(s => s._id !== excludeId && s.status !== 'cancelled' && (s.roomId === data.roomId || s.professionalId === data.professionalId) && s.startTime < data.endTime && data.startTime < s.endTime)) throw new ConvexError('Conflito de horário da sala ou do profissional.')
}
