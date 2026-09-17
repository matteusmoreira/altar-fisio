const clinicClock = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})

export function clinicDateTime(now = Date.now()) {
  const parts = Object.fromEntries(clinicClock.formatToParts(now).map(part => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

export function isFutureBooking(date: string, time: string, now = Date.now()) {
  const normalizedTime = time.length === 4 && time[1] === ':' ? `0${time}` : time
  return `${date}T${normalizedTime}` > clinicDateTime(now)
}
