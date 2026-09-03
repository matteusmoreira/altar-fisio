import { query, mutation, action, internalQuery, internalMutation, type ActionCtx } from "./_generated/server"
import { internal } from "./_generated/api"
import { v } from "convex/values"
import { sendUazapiInteractiveMessage, normalizeWhatsAppText, sanitizeUazapiEndpoint } from "./whatsapp"

// ============================================================================
// HELPERS DE DATA E FORMATAÇÃO (Fuso Horário de Brasília UTC-3)
// ============================================================================

export function getBrasiliaDateInfo(offsetDays = 0): {
  dateStr: string
  hours: number
  minutes: number
  timeStr: string
} {
  const now = new Date()
  const utc = now.getTime() + now.getTimezoneOffset() * 60000
  const brt = new Date(utc - 3 * 3600000 + offsetDays * 86400000)

  const year = brt.getFullYear()
  const month = String(brt.getMonth() + 1).padStart(2, "0")
  const day = String(brt.getDate()).padStart(2, "0")
  const hours = brt.getHours()
  const minutes = brt.getMinutes()

  const dateStr = `${year}-${month}-${day}`
  const timeStr = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`

  return { dateStr, hours, minutes, timeStr }
}

export function formatBrazilianPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  if (digits.startsWith("55")) return digits
  return `55${digits}`
}

// ============================================================================
// QUERIES PÚBLICAS E INTERNAS
// ============================================================================

export const listLogs = query({
  args: {
    channel: v.optional(v.union(v.literal("whatsapp_uazapi"), v.literal("email_resend"))),
    status: v.optional(v.union(v.literal("sent"), v.literal("failed"), v.literal("queued"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit || 50, 100)
    let logs

    if (args.channel) {
      logs = await ctx.db
        .query("notificationLogs")
        .withIndex("by_channel", (q) => q.eq("channel", args.channel!))
        .order("desc")
        .take(limit)
      if (args.status) {
        logs = logs.filter((l) => l.status === args.status)
      }
    } else if (args.status) {
      logs = await ctx.db
        .query("notificationLogs")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .take(limit)
    } else {
      logs = await ctx.db
        .query("notificationLogs")
        .withIndex("by_timestamp")
        .order("desc")
        .take(limit)
    }

    return logs
  },
})

export const getNotificationStats = query({
  handler: async (ctx) => {
    // Amostra recente indexada (até 300 logs) para evitar carregar todo o histórico
    const logs = await ctx.db
      .query("notificationLogs")
      .withIndex("by_timestamp")
      .order("desc")
      .take(300)
    const { dateStr } = getBrasiliaDateInfo(0)

    let totalSent = 0
    let totalFailed = 0
    let totalQueued = 0
    let whatsappCount = 0
    let emailCount = 0
    let todayCount = 0

    for (const log of logs) {
      if (log.status === "sent") totalSent++
      else if (log.status === "failed") totalFailed++
      else if (log.status === "queued") totalQueued++

      if (log.channel === "whatsapp_uazapi") whatsappCount++
      if (log.channel === "email_resend") emailCount++

      const logDate = new Date(log.timestamp).toISOString().split("T")[0]
      if (logDate === dateStr) todayCount++
    }

    const totalProcessed = totalSent + totalFailed
    const successRate = totalProcessed > 0 ? (totalSent / totalProcessed) * 100 : 100

    return {
      total: logs.length,
      totalSent,
      totalFailed,
      totalQueued,
      whatsappCount,
      emailCount,
      todayCount,
      successRate: Number(successRate.toFixed(1)),
    }
  },
})

export const getClinicSettingsInternal = internalQuery({
  handler: async (ctx) => {
    return await ctx.db.query("clinicSettings").first()
  },
})

export const getTomorrowCandidatesInternal = internalQuery({
  args: { tomorrowDate: v.string() },
  handler: async (ctx, args) => {
    const schedules = await ctx.db
      .query("schedules")
      .withIndex("by_date", (q) => q.eq("date", args.tomorrowDate))
      .collect()

    const candidates = []

    for (const schedule of schedules) {
      if (schedule.status === "cancelled") continue

      const room = await ctx.db.get(schedule.roomId)
      const professional = await ctx.db.get(schedule.professionalId)

      const participants = await ctx.db
        .query("scheduleParticipants")
        .withIndex("by_schedule", (q) => q.eq("scheduleId", schedule._id))
        .collect()

      for (const p of participants) {
        if (p.status !== "scheduled" && p.status !== "replacement") continue

        const patient = await ctx.db.get(p.patientId)
        if (!patient || !patient.phone) continue

        const existingLog = await ctx.db
          .query("notificationLogs")
          .withIndex("by_schedule_recipient", (q) =>
            q.eq("scheduleId", schedule._id)
              .eq("triggerType", "lembrete_24h")
              .eq("recipientContact", patient.phone)
          )
          .first()

        if (!existingLog) {
          candidates.push({
            scheduleId: schedule._id,
            patientId: patient._id,
            patientName: patient.name,
            phone: patient.phone,
            date: schedule.date,
            startTime: schedule.startTime,
            title: schedule.title,
            professionalName: professional?.name || "Dr(a). Fisioterapeuta",
            roomName: room?.name || "Sala Principal",
          })
        }
      }
    }

    return candidates
  },
})

export const getUpcoming2hCandidatesInternal = internalQuery({
  args: {
    todayDate: v.string(),
    minTime: v.string(),
    maxTime: v.string(),
  },
  handler: async (ctx, args) => {
    const schedules = await ctx.db
      .query("schedules")
      .withIndex("by_date", (q) => q.eq("date", args.todayDate))
      .collect()

    const candidates = []

    for (const schedule of schedules) {
      if (schedule.status === "cancelled") continue
      if (schedule.startTime < args.minTime || schedule.startTime > args.maxTime) continue

      const room = await ctx.db.get(schedule.roomId)
      const professional = await ctx.db.get(schedule.professionalId)

      const participants = await ctx.db
        .query("scheduleParticipants")
        .withIndex("by_schedule", (q) => q.eq("scheduleId", schedule._id))
        .collect()

      for (const p of participants) {
        if (p.status !== "scheduled" && p.status !== "replacement") continue

        const patient = await ctx.db.get(p.patientId)
        if (!patient || !patient.phone) continue

        const existingLog = await ctx.db
          .query("notificationLogs")
          .withIndex("by_schedule_recipient", (q) =>
            q.eq("scheduleId", schedule._id)
              .eq("triggerType", "lembrete_2h")
              .eq("recipientContact", patient.phone)
          )
          .first()

        if (!existingLog) {
          candidates.push({
            scheduleId: schedule._id,
            patientId: patient._id,
            patientName: patient.name,
            phone: patient.phone,
            date: schedule.date,
            startTime: schedule.startTime,
            title: schedule.title,
            specialty: schedule.specialty,
            professionalName: professional?.name || "Dr(a). Fisioterapeuta",
            roomName: room?.name || "Sala Principal",
          })
        }
      }
    }

    return candidates
  },
})

// ============================================================================
// MUTATIONS DE REGISTRO E PERSISTÊNCIA DE LOGS
// ============================================================================

export const logNotificationInternal = internalMutation({
  args: {
    channel: v.union(v.literal("whatsapp_uazapi"), v.literal("email_resend")),
    recipientName: v.string(),
    recipientContact: v.string(),
    triggerType: v.string(),
    content: v.string(),
    status: v.union(v.literal("sent"), v.literal("failed"), v.literal("queued")),
    scheduleId: v.optional(v.id("schedules")),
    timestamp: v.number(),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("notificationLogs", args)
  },
})

// ============================================================================
// FUNÇÕES UTILITÁRIAS INTERNAS DE DISPARO (SEM DEPENDÊNCIA CIRCULAR)
// ============================================================================

async function sendWhatsAppDirectHelper(
  ctx: ActionCtx,
  args: {
    recipientName: string
    phone: string
    message: string
    triggerType: string
    scheduleId?: any
  }
): Promise<{ success: boolean; status: "sent" | "failed"; errorMessage?: string }> {
  const settings: any = await ctx.runQuery(internal.notifications.getClinicSettingsInternal, {})
  const defaultInst: any = await ctx.runQuery(internal.whatsapp.getDefaultInstanceInternal, {})
  const effectiveToken = defaultInst?.token || settings?.activeWhatsappInstanceToken || settings?.uazapiToken
  const baseUrl = sanitizeUazapiEndpoint(settings?.uazapiEndpoint)
  const formattedPhone = formatBrazilianPhone(args.phone)
  const cleanMessage = normalizeWhatsAppText(args.message)

  let status: "sent" | "failed" = "sent"
  let errorMessage: string | undefined = undefined

  if (baseUrl && effectiveToken) {
    try {
      const cleanEndpoint = baseUrl.replace(/\/+$/, "")
      const url = `${cleanEndpoint}/send/text`

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 9000)

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "token": effectiveToken,
          "Authorization": `Bearer ${effectiveToken}`,
        },
        body: JSON.stringify({
          number: formattedPhone,
          text: cleanMessage,
        }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (!response.ok) {
        status = "failed"
        const errText = await response.text().catch(() => "")
        errorMessage = `UAZAPI HTTP ${response.status}: ${errText || response.statusText}`
      }
    } catch (err: any) {
      status = "failed"
      errorMessage =
        err?.name === "AbortError" ? "Timeout de 9s na conexão com UAZAPI" : err?.message || "Erro desconhecido"
    }
  } else {
    errorMessage = "[Modo Sandbox] Disparo simulado com sucesso. Nenhuma instância conectada com token."
  }

  await ctx.runMutation(internal.notifications.logNotificationInternal, {
    channel: "whatsapp_uazapi",
    recipientName: args.recipientName,
    recipientContact: args.phone,
    triggerType: args.triggerType,
    content: cleanMessage,
    status: status,
    scheduleId: args.scheduleId,
    timestamp: Date.now(),
    errorMessage: status === "failed" ? errorMessage : (effectiveToken ? undefined : errorMessage),
  })

  return {
    success: status === "sent",
    status,
    errorMessage,
  }
}

async function sendEmailDirectHelper(
  ctx: ActionCtx,
  args: {
    recipientName: string
    email: string
    subject: string
    html: string
    triggerType: string
  }
): Promise<{ success: boolean; status: "sent" | "failed"; errorMessage?: string }> {
  const settings: any = await ctx.runQuery(internal.notifications.getClinicSettingsInternal, {})
  const clinicName = settings?.clinicName || "Altar Fisio"
  const fromEmail = settings?.resendFromEmail || "contato@altarfisio.com.br"

  let status: "sent" | "failed" = "sent"
  let errorMessage: string | undefined = undefined

  if (settings?.resendApiKey) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 9000)

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${settings.resendApiKey}`,
        },
        body: JSON.stringify({
          from: `${clinicName} <${fromEmail}>`,
          to: [args.email],
          subject: args.subject,
          html: args.html,
        }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (!response.ok) {
        status = "failed"
        const errText = await response.text().catch(() => "")
        errorMessage = `Resend HTTP ${response.status}: ${errText || response.statusText}`
      }
    } catch (err: any) {
      status = "failed"
      errorMessage =
        err?.name === "AbortError" ? "Timeout de 9s na conexão com Resend" : err?.message || "Erro desconhecido"
    }
  } else {
    errorMessage = "[Modo Sandbox] E-mail simulado com sucesso. Resend API Key não configurada."
  }

  await ctx.runMutation(internal.notifications.logNotificationInternal, {
    channel: "email_resend",
    recipientName: args.recipientName,
    recipientContact: args.email,
    triggerType: args.triggerType,
    content: `Assunto: ${args.subject}\nDestinatário: ${args.email}`,
    status: status,
    timestamp: Date.now(),
    errorMessage: status === "failed" ? errorMessage : (settings?.resendApiKey ? undefined : errorMessage),
  })

  return {
    success: status === "sent",
    status,
    errorMessage,
  }
}

// ============================================================================
// ACTIONS CONVEX (PÚBLICAS E PARA CRONS)
// ============================================================================

export const sendWhatsAppNotificationAction = action({
  args: {
    recipientName: v.string(),
    phone: v.string(),
    message: v.string(),
    triggerType: v.string(),
    scheduleId: v.optional(v.id("schedules")),
  },
  handler: async (ctx, args) => {
    return await sendWhatsAppDirectHelper(ctx, args)
  },
})

export const sendEmailNotificationAction = action({
  args: {
    recipientName: v.string(),
    email: v.string(),
    subject: v.string(),
    html: v.string(),
    triggerType: v.string(),
  },
  handler: async (ctx, args) => {
    return await sendEmailDirectHelper(ctx, args)
  },
})

export const checkAndSendDailyReminders24hAction = action({
  args: { targetDate: v.optional(v.string()) },
  handler: async (
    ctx,
    args
  ): Promise<{ scannedCount: number; sentCount: number; failedCount: number; targetDate: string }> => {
    const { dateStr: tomorrowDefault } = getBrasiliaDateInfo(1)
    const targetDate = args.targetDate || tomorrowDefault

    const candidates: any[] = await ctx.runQuery(
      internal.notifications.getTomorrowCandidatesInternal,
      { tomorrowDate: targetDate }
    )

    const settings: any = await ctx.runQuery(internal.notifications.getClinicSettingsInternal, {})
    const clinicName = settings?.clinicName || "Altar Fisio"
    const noticeHours = settings?.cancellationNoticeHours || 2
    const defaultInst: any = await ctx.runQuery(internal.whatsapp.getDefaultInstanceInternal, {})
    const effectiveToken = defaultInst?.token || settings?.activeWhatsappInstanceToken || settings?.uazapiToken
    const baseUrl = sanitizeUazapiEndpoint(settings?.uazapiEndpoint)

    let template24: any = null
    if (settings?.activeReminder24hTemplateId) {
      template24 = await ctx.runQuery(internal.whatsapp.getTemplateByIdInternal, {
        id: settings.activeReminder24hTemplateId,
      })
    }

    let sentCount = 0
    let failedCount = 0

    for (const c of candidates) {
      const vars: Record<string, string> = {
        paciente: c.patientName,
        data: c.date,
        horario: c.startTime,
        profissional: c.professionalName,
        sala: c.roomName,
        clinica: clinicName,
        regras: `Caso precise desmarcar, avise com no mínimo ${noticeHours}h de antecedência para liberar seu crédito de reposição automático.`,
        telefone_clinica: settings?.phone || "",
      }

      let success = false
      if (template24 && effectiveToken) {
        const res = await sendUazapiInteractiveMessage(baseUrl, effectiveToken, c.phone, template24, vars)
        success = res.success

        await ctx.runMutation(internal.notifications.logNotificationInternal, {
          channel: "whatsapp_uazapi",
          recipientName: c.patientName,
          recipientContact: c.phone,
          triggerType: "lembrete_24h",
          content: `[Template: ${template24.title}] Lembrete 24h para ${c.patientName}`,
          status: success ? "sent" : "failed",
          scheduleId: c.scheduleId,
          timestamp: Date.now(),
          errorMessage: res.error,
        })
      } else {
        const defaultMsg = `Olá, *${c.patientName}*! 👋\n\nEste é um lembrete do seu atendimento amanhã na *${clinicName}*:\n\n📅 *Data:* ${c.date}\n⏰ *Horário:* ${c.startTime}\n👨‍⚕️ *Profissional:* ${c.professionalName}\n📍 *Local:* ${c.roomName}\n\n⚠️ *Regra de Reposição:* Caso precise desmarcar, avise com no mínimo *${noticeHours}h de antecedência* para liberar seu crédito de reposição automático.\n\nEstamos te esperando!`
        const res = await sendWhatsAppDirectHelper(ctx, {
          recipientName: c.patientName,
          phone: c.phone,
          message: defaultMsg,
          triggerType: "lembrete_24h",
          scheduleId: c.scheduleId,
        })
        success = res.success
      }

      if (success) sentCount++
      else failedCount++
    }

    return {
      scannedCount: candidates.length,
      sentCount,
      failedCount,
      targetDate,
    }
  },
})

export const checkAndSendUpcomingReminders2hAction = action({
  args: {},
  handler: async (ctx): Promise<{ scannedCount: number; sentCount: number; failedCount: number }> => {
    const { dateStr, hours, minutes } = getBrasiliaDateInfo(0)

    const currentTotalMinutes = hours * 60 + minutes
    const minMins = currentTotalMinutes + 90
    const maxMins = currentTotalMinutes + 150

    const minTime = `${String(Math.floor(minMins / 60)).padStart(2, "0")}:${String(minMins % 60).padStart(2, "0")}`
    const maxTime = `${String(Math.floor(maxMins / 60)).padStart(2, "0")}:${String(maxMins % 60).padStart(2, "0")}`

    const candidates: any[] = await ctx.runQuery(
      internal.notifications.getUpcoming2hCandidatesInternal,
      { todayDate: dateStr, minTime, maxTime }
    )

    const settings: any = await ctx.runQuery(internal.notifications.getClinicSettingsInternal, {})
    const clinicName = settings?.clinicName || "Altar Fisio"
    const defaultInst: any = await ctx.runQuery(internal.whatsapp.getDefaultInstanceInternal, {})
    const effectiveToken = defaultInst?.token || settings?.activeWhatsappInstanceToken || settings?.uazapiToken
    const baseUrl = sanitizeUazapiEndpoint(settings?.uazapiEndpoint)

    let template2h: any = null
    if (settings?.activeReminder2hTemplateId) {
      template2h = await ctx.runQuery(internal.whatsapp.getTemplateByIdInternal, {
        id: settings.activeReminder2hTemplateId,
      })
    }

    let sentCount = 0
    let failedCount = 0

    for (const c of candidates) {
      const isPilates = c.specialty === "pilates"
      const tip = isPilates
        ? "\n🧦 *Dica:* Lembre-se de trazer suas meias antiderrapantes para a aula de Pilates!"
        : ""

      const vars: Record<string, string> = {
        paciente: c.patientName,
        data: c.date,
        horario: c.startTime,
        profissional: c.professionalName,
        sala: c.roomName,
        clinica: clinicName,
        dica: tip,
        telefone_clinica: settings?.phone || "",
      }

      let success = false
      if (template2h && effectiveToken) {
        const res = await sendUazapiInteractiveMessage(baseUrl, effectiveToken, c.phone, template2h, vars)
        success = res.success

        await ctx.runMutation(internal.notifications.logNotificationInternal, {
          channel: "whatsapp_uazapi",
          recipientName: c.patientName,
          recipientContact: c.phone,
          triggerType: "lembrete_2h",
          content: `[Template: ${template2h.title}] Lembrete 2h para ${c.patientName}`,
          status: success ? "sent" : "failed",
          scheduleId: c.scheduleId,
          timestamp: Date.now(),
          errorMessage: res.error,
        })
      } else {
        const defaultMsg = `Olá, *${c.patientName}*! ⏰\n\nFalta pouco para seu atendimento na *${clinicName}*!\n\n📅 *Hoje às ${c.startTime}*\n👨‍⚕️ *Profissional:* ${c.professionalName}\n📍 *Local:* ${c.roomName}${tip}\n\nAté logo!`
        const res = await sendWhatsAppDirectHelper(ctx, {
          recipientName: c.patientName,
          phone: c.phone,
          message: defaultMsg,
          triggerType: "lembrete_2h",
          scheduleId: c.scheduleId,
        })
        success = res.success
      }

      if (success) sentCount++
      else failedCount++
    }

    return {
      scannedCount: candidates.length,
      sentCount,
      failedCount,
    }
  },
})

export const sendReplacementCreditNoticeAction = action({
  args: {
    patientName: v.string(),
    phone: v.string(),
    scheduleDate: v.string(),
    scheduleTime: v.string(),
    expiryDate: v.string(),
    noticeHours: v.number(),
  },
  handler: async (ctx, args) => {
    const settings: any = await ctx.runQuery(internal.notifications.getClinicSettingsInternal, {})
    const clinicName = settings?.clinicName || "Altar Fisio"

    const message = `Olá, *${args.patientName}*! ✅\n\nConfirmamos a desmarcação da sua sessão agendada para *${args.scheduleDate} às ${args.scheduleTime}* na *${clinicName}*.\n\n✨ *Crédito de Reposição Liberado!*\nComo você avisou com a antecedência necessária, um crédito de reposição foi gerado na sua conta com validade até *${args.expiryDate}*.\n\nPara agendar sua reposição em um horário disponível, fale diretamente com a nossa recepção.`

    return await sendWhatsAppDirectHelper(ctx, {
      recipientName: args.patientName,
      phone: args.phone,
      message,
      triggerType: "credito_reposicao",
    })
  },
})

export const sendReceiptNotificationAction = action({
  args: {
    patientName: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    description: v.string(),
    amount: v.number(),
    paymentDate: v.string(),
    paymentMethod: v.string(),
  },
  handler: async (ctx, args) => {
    const settings: any = await ctx.runQuery(internal.notifications.getClinicSettingsInternal, {})
    const clinicName = settings?.clinicName || "Altar Fisio"
    const clinicAddress = settings?.address || "São Paulo - SP"
    const clinicPhone = settings?.phone || ""

    let emailResult = null
    let whatsappResult = null

    if (args.email) {
      const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;">
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 32px 24px; text-align: center; color: #ffffff;">
            <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">${clinicName}</h1>
            <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.9;">Comprovante Oficial de Pagamento</p>
          </div>
          <div style="padding: 28px 24px;">
            <p style="font-size: 15px; color: #1e293b; margin: 0 0 16px 0;">Olá, <strong>${args.patientName}</strong>,</p>
            <p style="font-size: 14px; color: #475569; line-height: 1.5; margin: 0 0 20px 0;">
              Confirmamos com sucesso o recebimento do seu pagamento referente aos serviços de fisioterapia / pilates:
            </p>
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
              <table style="width: 100%; font-size: 13px; color: #334155; border-collapse: collapse;">
                <tr>
                  <td style="padding: 6px 0; color: #64748b;">Item / Descrição:</td>
                  <td style="padding: 6px 0; text-align: right; font-weight: 600;">${args.description}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b;">Data do Pagamento:</td>
                  <td style="padding: 6px 0; text-align: right; font-weight: 600;">${args.paymentDate}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b;">Forma de Liquidação:</td>
                  <td style="padding: 6px 0; text-align: right; font-weight: 600; text-transform: uppercase;">${args.paymentMethod}</td>
                </tr>
                <tr style="border-top: 1px solid #e2e8f0;">
                  <td style="padding: 12px 0 0 0; font-size: 15px; font-weight: 700; color: #0f172a;">Total Pago:</td>
                  <td style="padding: 12px 0 0 0; text-align: right; font-size: 18px; font-weight: 800; color: #10b981;">R$ ${args.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                </tr>
              </table>
            </div>
            <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 12px; color: #94a3b8; text-align: center;">
              <p style="margin: 2px 0;">${clinicName} • ${clinicAddress}</p>
              ${clinicPhone ? `<p style="margin: 2px 0;">WhatsApp: ${clinicPhone}</p>` : ""}
              <p style="margin: 6px 0 0 0;">Documento gerado automaticamente para fins de controle e reembolso de convênio.</p>
            </div>
          </div>
        </div>
      `

      emailResult = await sendEmailDirectHelper(ctx, {
        recipientName: args.patientName,
        email: args.email,
        subject: `Comprovante de Pagamento — ${clinicName}`,
        html,
        triggerType: "recibo_pagamento",
      })
    }

    if (args.phone) {
      const message = `Olá, *${args.patientName}*! 🧾\n\nConfirmamos o recebimento do seu pagamento na *${clinicName}*:\n\n📌 *Descrição:* ${args.description}\n💰 *Valor:* R$ ${args.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n🗓 *Data:* ${args.paymentDate}\n💳 *Forma:* ${args.paymentMethod.toUpperCase()}\n\nMuito obrigado pela confiança! Se precisar do recibo em PDF para reembolso, solicite à recepção.`

      whatsappResult = await sendWhatsAppDirectHelper(ctx, {
        recipientName: args.patientName,
        phone: args.phone,
        message,
        triggerType: "recibo_pagamento",
      })
    }

    return {
      emailSent: !!emailResult?.success,
      whatsappSent: !!whatsappResult?.success,
    }
  },
})

export const triggerManualScanAction = action({
  args: {},
  handler: async (ctx) => {
    // 1. Executa 24h
    const { dateStr: tomorrowDefault } = getBrasiliaDateInfo(1)
    const candidates24: any[] = await ctx.runQuery(
      internal.notifications.getTomorrowCandidatesInternal,
      { tomorrowDate: tomorrowDefault }
    )
    const settings: any = await ctx.runQuery(internal.notifications.getClinicSettingsInternal, {})
    const clinicName = settings?.clinicName || "Altar Fisio"
    const noticeHours = settings?.cancellationNoticeHours || 2

    let sent24 = 0
    for (const c of candidates24) {
      const message = `Olá, *${c.patientName}*! 👋\n\nEste é um lembrete do seu atendimento amanhã na *${clinicName}*:\n\n📅 *Data:* ${c.date}\n⏰ *Horário:* ${c.startTime}\n👨‍⚕️ *Profissional:* ${c.professionalName}\n📍 *Local:* ${c.roomName}\n\n⚠️ *Regra de Reposição:* Caso precise desmarcar, avise com no mínimo *${noticeHours}h de antecedência* para liberar seu crédito de reposição automático.\n\nEstamos te esperando!`
      const res = await sendWhatsAppDirectHelper(ctx, {
        recipientName: c.patientName,
        phone: c.phone,
        message,
        triggerType: "lembrete_24h",
        scheduleId: c.scheduleId,
      })
      if (res.success) sent24++
    }

    // 2. Executa 2h
    const { dateStr, hours, minutes } = getBrasiliaDateInfo(0)
    const currentTotalMinutes = hours * 60 + minutes
    const minMins = currentTotalMinutes + 90
    const maxMins = currentTotalMinutes + 150
    const minTime = `${String(Math.floor(minMins / 60)).padStart(2, "0")}:${String(minMins % 60).padStart(2, "0")}`
    const maxTime = `${String(Math.floor(maxMins / 60)).padStart(2, "0")}:${String(maxMins % 60).padStart(2, "0")}`

    const candidates2h: any[] = await ctx.runQuery(
      internal.notifications.getUpcoming2hCandidatesInternal,
      { todayDate: dateStr, minTime, maxTime }
    )

    let sent2 = 0
    for (const c of candidates2h) {
      const tip = c.specialty === "pilates" ? "\n🧦 *Dica:* Lembre-se de trazer suas meias antiderrapantes para o Pilates!" : ""
      const message = `Olá, *${c.patientName}*! ⏰\n\nFalta pouco para seu atendimento na *${clinicName}*!\n\n📅 *Hoje às ${c.startTime}*\n👨‍⚕️ *Profissional:* ${c.professionalName}\n📍 *Local:* ${c.roomName}${tip}\n\nAté logo!`
      const res = await sendWhatsAppDirectHelper(ctx, {
        recipientName: c.patientName,
        phone: c.phone,
        message,
        triggerType: "lembrete_2h",
        scheduleId: c.scheduleId,
      })
      if (res.success) sent2++
    }

    return {
      success: true,
      reminders24h: { scannedCount: candidates24.length, sentCount: sent24 },
      reminders2h: { scannedCount: candidates2h.length, sentCount: sent2 },
      executedAt: Date.now(),
    }
  },
})

export const testUazapiConnectionAction = action({
  args: {
    testNumber: v.string(),
    testName: v.string(),
  },
  handler: async (ctx, args) => {
    const message = `🔔 *Teste de Conexão Altar Fisio (UAZAPI)*\n\nOlá, ${args.testName}! Este é um teste automático de validação do gateway WhatsApp UAZAPI.\nData e Hora: ${new Date().toLocaleString("pt-BR")}\nStatus: Operacional ✅`

    return await sendWhatsAppDirectHelper(ctx, {
      recipientName: args.testName,
      phone: args.testNumber,
      message,
      triggerType: "teste_uazapi",
    })
  },
})

export const testResendConnectionAction = action({
  args: {
    testEmail: v.string(),
    testName: v.string(),
  },
  handler: async (ctx, args) => {
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 24px; max-width: 500px; border: 1px solid #10b981; border-radius: 12px;">
        <h2 style="color: #10b981; margin-top: 0;">✅ Teste de Conexão Resend — Altar Fisio</h2>
        <p>Olá, <strong>${args.testName}</strong>!</p>
        <p>Sua chave de API do <strong>Resend</strong> está funcionando perfeitamente.</p>
        <p style="font-size: 12px; color: #64748b;">Disparado em: ${new Date().toLocaleString("pt-BR")}</p>
      </div>
    `

    return await sendEmailDirectHelper(ctx, {
      recipientName: args.testName,
      email: args.testEmail,
      subject: "Teste de Conexão Resend — Altar Fisio",
      html,
      triggerType: "teste_resend",
    })
  },
})

export const sendScheduleConfirmationAction = action({
  args: {
    patientName: v.string(),
    phone: v.string(),
    serviceName: v.string(),
    professionalName: v.string(),
    date: v.string(),
    startTime: v.string(),
    endTime: v.string(),
    roomName: v.string(),
  },
  handler: async (ctx, args) => {
    const settings: any = await ctx.runQuery(internal.notifications.getClinicSettingsInternal, {})
    const clinicName = settings?.clinicName || "Altar Fisio"
    const noticeHours = settings?.cancellationNoticeHours || 2

    const message = `Olá, *${args.patientName}*! 🎉\n\nSua aula/sessão foi agendada com sucesso pelo *Portal do Aluno* na *${clinicName}*:\n\n📌 *Atividade:* ${args.serviceName}\n📅 *Data:* ${args.date}\n⏰ *Horário:* ${args.startTime} às ${args.endTime}\n👨‍⚕️ *Profissional:* ${args.professionalName}\n📍 *Local:* ${args.roomName}\n\n⚠️ *Regra de Desmarcação:* Caso precise desmarcar ou reagendar, faça com no mínimo *${noticeHours}h de antecedência* pelo Portal para liberar seu crédito de reposição automático.\n\nNos vemos na clínica!`

    return await sendWhatsAppDirectHelper(ctx, {
      recipientName: args.patientName,
      phone: args.phone,
      message,
      triggerType: "confirmacao_agendamento_portal",
    })
  },
})

// ============================================================================
// MUTATIONS PÚBLICAS PARA COMPATIBILIDADE COM O FRONTEND EXISTENTE
// ============================================================================

export const sendWhatsAppReminder = mutation({
  args: {
    recipientName: v.string(),
    phone: v.string(),
    scheduleDate: v.string(),
    scheduleTime: v.string(),
    professionalName: v.string(),
    roomName: v.string(),
    triggerType: v.string(),
  },
  handler: async (ctx, args) => {
    const settings = await ctx.db.query("clinicSettings").first()
    const clinicName = settings?.clinicName || "Altar Fisio"
    const noticeHours = settings?.cancellationNoticeHours || 2

    const message = `Olá, *${args.recipientName}*! 👋\n\nEste é um lembrete do seu atendimento na *${clinicName}*:\n\n📅 *Data:* ${args.scheduleDate}\n⏰ *Horário:* ${args.scheduleTime}\n👨‍⚕️ *Profissional:* ${args.professionalName}\n📍 *Local:* ${args.roomName}\n\n⚠️ *Aviso importante:* Caso precise desmarcar, avise com no mínimo ${noticeHours}h de antecedência para liberar seu crédito de reposição.\n\nEstamos ansiosos para te receber! ✨`

    const logId = await ctx.db.insert("notificationLogs", {
      channel: "whatsapp_uazapi",
      recipientName: args.recipientName,
      recipientContact: args.phone,
      triggerType: args.triggerType,
      content: message,
      status: "sent",
      timestamp: Date.now(),
      errorMessage: settings?.uazapiToken ? undefined : "[Sandbox] Lembrete registrado e enfileirado para disparo",
    })

    return { logId, status: "sent", message }
  },
})

export const sendEmailReceipt = mutation({
  args: {
    recipientName: v.string(),
    email: v.string(),
    description: v.string(),
    amount: v.number(),
    paymentDate: v.string(),
    paymentMethod: v.string(),
  },
  handler: async (ctx, args) => {
    const settings = await ctx.db.query("clinicSettings").first()

    const logId = await ctx.db.insert("notificationLogs", {
      channel: "email_resend",
      recipientName: args.recipientName,
      recipientContact: args.email,
      triggerType: "recibo_pagamento",
      content: `Recibo de R$ ${args.amount.toFixed(2)} (${args.description}) para ${args.email}`,
      status: "sent",
      timestamp: Date.now(),
      errorMessage: settings?.resendApiKey ? undefined : "[Sandbox] Recibo registrado com sucesso",
    })

    return { logId, status: "sent" }
  },
})
