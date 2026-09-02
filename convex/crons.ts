import { cronJobs } from "convex/server"
import { api } from "./_generated/api"

const crons = cronJobs()

// 1. Diariamente às 08:00 BRT (11:00 UTC) dispara lembretes de 24h para os agendamentos do dia seguinte
crons.daily(
  "disparo-lembretes-24h",
  { hourUTC: 11, minuteUTC: 0 },
  api.notifications.checkAndSendDailyReminders24hAction,
  {}
)

// 2. A cada 30 minutos verifica e dispara lembretes de 2h antes (para turmas e atendimentos do dia)
crons.interval(
  "disparo-lembretes-2h",
  { minutes: 30 },
  api.notifications.checkAndSendUpcomingReminders2hAction,
  {}
)

export default crons
