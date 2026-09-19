import { internalMutation } from "./_generated/server"
import { formatScheduleTitle } from "../shared/clinicalSpecialties"

/**
 * Rotina diária de manutenção do banco de dados Convex
 * Executa tarefas essenciais para manter o uso dentro do limite de 1 GB do plano gratuito:
 * 1. Exclui sessões de login expiradas
 * 2. Purga logs de notificação com mais de 60 dias
 * 3. Marca créditos de reposição vencidos como expirados
 */
export const runDailyMaintenance = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(now)
    const fifteenDaysAgoMs = now - 15 * 24 * 60 * 60 * 1000
    const thirtyDaysAgoMs = now - 30 * 24 * 60 * 60 * 1000
    const sixtyDaysAgoMs = now - 60 * 24 * 60 * 60 * 1000

    // 1. Limpeza de sessões expiradas de staff e pacientes (lote de até 250 por execução)
    const expiredSessions = await ctx.db
      .query("userSessions")
      .withIndex("by_expiresAt", (q) => q.lte("expiresAt", now))
      .take(250)
    for (const session of expiredSessions) await ctx.db.delete(session._id)

    const expiredPatientSessions = await ctx.db
      .query("patientSessions")
      .withIndex("by_expiresAt", (q) => q.lte("expiresAt", now))
      .take(250)
    for (const session of expiredPatientSessions) await ctx.db.delete(session._id)

    const oldAttempts = await ctx.db
      .query("authAttempts")
      .withIndex("by_resetAt", (q) => q.lte("resetAt", now))
      .take(250)
    for (const attempt of oldAttempts) await ctx.db.delete(attempt._id)

    // 2. Limpeza de logs de notificação com mais de 30 dias (lote de até 300)
    const oldLogs = await ctx.db
      .query("notificationLogs")
      .withIndex("by_timestamp", (q) => q.lte("timestamp", thirtyDaysAgoMs))
      .take(300)
    for (const log of oldLogs) await ctx.db.delete(log._id)

    // 3. Limpeza de logs de auditoria LGPD/COFFITO com mais de 60 dias (lote de até 300)
    const oldAuditLogs = await ctx.db
      .query("auditLogs")
      .withIndex("by_timestamp", (q) => q.lte("timestamp", sixtyDaysAgoMs))
      .take(300)
    for (const audit of oldAuditLogs) await ctx.db.delete(audit._id)

    // 4. Limpeza de jobs de lembretes concluídos, pulados ou com falha com mais de 15 dias (lote de até 300)
    const oldSentJobs = await ctx.db
      .query("appointmentJobs")
      .withIndex("by_status_due", (q) => q.eq("status", "sent").lte("dueAt", fifteenDaysAgoMs))
      .take(150)
    for (const job of oldSentJobs) await ctx.db.delete(job._id)

    const oldSkippedJobs = await ctx.db
      .query("appointmentJobs")
      .withIndex("by_status_due", (q) => q.eq("status", "skipped").lte("dueAt", fifteenDaysAgoMs))
      .take(150)
    for (const job of oldSkippedJobs) await ctx.db.delete(job._id)

    const oldFailedJobs = await ctx.db
      .query("appointmentJobs")
      .withIndex("by_status_due", (q) => q.eq("status", "failed").lte("dueAt", fifteenDaysAgoMs))
      .take(100)
    for (const job of oldFailedJobs) await ctx.db.delete(job._id)

    const oldUncertainJobs = await ctx.db
      .query("appointmentJobs")
      .withIndex("by_status_due", (q) => q.eq("status", "uncertain").lte("dueAt", fifteenDaysAgoMs))
      .take(100)
    for (const job of oldUncertainJobs) await ctx.db.delete(job._id)

    // 5. Expiração de créditos de reposição vencidos
    const availableCredits = await ctx.db
      .query("replacementCredits")
      .withIndex("by_status", (q) => q.eq("status", "available"))
      .take(150)

    let expiredCreditsCount = 0
    for (const credit of availableCredits) {
      if (credit.expiryDate < todayStr) {
        await ctx.db.patch(credit._id, { status: "expired" })
        expiredCreditsCount++
      }
    }

    // 6. Higienização de títulos de turmas/agendamentos futuros com underscores
    const futureSchedules = await ctx.db
      .query("schedules")
      .withIndex("by_date", (q) => q.gte("date", todayStr))
      .take(100)
    let sanitizedSchedulesCount = 0
    for (const sched of futureSchedules) {
      if (sched.title && sched.title.includes("_")) {
        const room = await ctx.db.get(sched.roomId)
        const clean = formatScheduleTitle(sched.title, {
          roomName: room?.name,
          specialty: sched.specialty,
          startTime: sched.startTime,
        })
        if (clean !== sched.title) {
          await ctx.db.patch(sched._id, { title: clean })
          sanitizedSchedulesCount++
        }
      }
    }

    // 7. Atualização preventiva do nome institucional da clínica para Clinica Dr Marcelo
    const clinicSettings = await ctx.db.query("clinicSettings").first()
    if (clinicSettings && clinicSettings.clinicName === "Altar Fisio") {
      await ctx.db.patch(clinicSettings._id, { clinicName: "Clinica Dr Marcelo" })
    }

    return {
      success: true,
      clearedSessions: expiredSessions.length + expiredPatientSessions.length,
      clearedNotificationLogs: oldLogs.length,
      clearedAppointmentJobs:
        oldSentJobs.length +
        oldSkippedJobs.length +
        oldFailedJobs.length +
        oldUncertainJobs.length,
      sanitizedSchedules: sanitizedSchedulesCount,
      executedAt: now,
    }
  },
})
