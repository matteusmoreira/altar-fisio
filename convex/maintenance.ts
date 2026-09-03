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
    const todayStr = new Date().toISOString().split("T")[0]
    const sixtyDaysAgoMs = now - 60 * 24 * 60 * 60 * 1000

    // 1. Limpeza de sessões expiradas (lote de até 100 por execução)
    const expiredSessions = await ctx.db
      .query("userSessions")
      .withIndex("by_expiresAt", (q) => q.lte("expiresAt", now))
      .take(100)

    for (const session of expiredSessions) {
      await ctx.db.delete(session._id)
    }

    // 2. Limpeza de logs de notificação com mais de 60 dias (lote de até 100 por execução)
    const oldLogs = await ctx.db
      .query("notificationLogs")
      .withIndex("by_timestamp", (q) => q.lte("timestamp", sixtyDaysAgoMs))
      .take(100)

    for (const log of oldLogs) {
      await ctx.db.delete(log._id)
    }

    // 3. Expiração de créditos de reposição vencidos
    const availableCredits = await ctx.db
      .query("replacementCredits")
      .withIndex("by_status", (q) => q.eq("status", "available"))
      .take(100)

    let expiredCreditsCount = 0
    for (const credit of availableCredits) {
      if (credit.expiryDate < todayStr) {
        await ctx.db.patch(credit._id, { status: "expired" })
        expiredCreditsCount++
      }
    }

    return {
      success: true,
      clearedSessions: expiredSessions.length,
      clearedLogs: oldLogs.length,
      expiredCredits: expiredCreditsCount,
      executedAt: now,
    }
  },
})
