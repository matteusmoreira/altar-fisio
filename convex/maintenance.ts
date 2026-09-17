import { internalMutation } from "./_generated/server"

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

    // 4. Limpeza de jobs de lembretes concluídos ou pulados com mais de 15 dias (lote de até 250)
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

    return {
      success: true,
      clearedSessions: expiredSessions.length + expiredPatientSessions.length,
      clearedNotificationLogs: oldLogs.length,
      clearedAuditLogs: oldAuditLogs.length,
      clearedAppointmentJobs: oldSentJobs.length + oldSkippedJobs.length,
      expiredCredits: expiredCreditsCount,
      executedAt: now,
    }
  },
})
