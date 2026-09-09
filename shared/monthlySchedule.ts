export function monthDates(month: string, days: number[], startDate = `${month}-01`) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !days.length || days.some(d => !Number.isInteger(d) || d < 0 || d > 6)) throw new Error('Selecione um mês e dias da semana válidos.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || startDate.slice(0, 7) !== month) throw new Error('A data inicial deve pertencer ao mês escolhido.')
  const count = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).getUTCDate()
  if (Number(startDate.slice(8)) < 1 || Number(startDate.slice(8)) > count) throw new Error('Data inicial inválida.')
  return Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`).filter(date => date >= startDate && days.includes(new Date(`${date}T12:00:00Z`).getUTCDay()))
}
