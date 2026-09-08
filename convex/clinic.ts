import { requireStaff } from './lib/security'
import { query, mutation } from "./_generated/server"
import { v } from "convex/values"

export const getSettings = query({
  handler: async (ctx) => {
    const settings = await ctx.db.query("clinicSettings").first()
    if (!settings) return null

    let logoUrl = settings.logoUrl
    if (settings.logoStorageId) {
      const storageUrl = await ctx.storage.getUrl(settings.logoStorageId)
      if (storageUrl) {
        logoUrl = storageUrl
      }
    }

    return {
      clinicName: settings.clinicName,
      clinicSubtitle: settings.clinicSubtitle,
      primaryColor: settings.primaryColor,
      colorPreset: settings.colorPreset,
      mode: settings.mode,
      phone: settings.phone,
      address: settings.address,
      cancellationNoticeHours: settings.cancellationNoticeHours,
      replacementExpiryDays: settings.replacementExpiryDays,
      logoUrl,
    }
  },
})

export const getAdminSettings = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken, ['admin'])
    const settings = await ctx.db.query('clinicSettings').first()
    if (!settings) return null
    const { uazapiToken, uazapiAdminToken, activeWhatsappInstanceToken, resendApiKey, ...safe } = settings
    return { ...safe,
      logoUrl: settings.logoStorageId ? await ctx.storage.getUrl(settings.logoStorageId) ?? undefined : settings.logoUrl,
      uazapiConfigured: Boolean(uazapiToken || activeWhatsappInstanceToken),
      uazapiAdminConfigured: Boolean(uazapiAdminToken), resendConfigured: Boolean(resendApiKey),
    }
  },
})

export const getNotificationSettings = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken, ['admin', 'reception'])
    const settings = await ctx.db.query('clinicSettings').first()
    return { activeConfirmationTemplateId: settings?.activeConfirmationTemplateId, activeReminder24hTemplateId: settings?.activeReminder24hTemplateId, activeReminder2hTemplateId: settings?.activeReminder2hTemplateId }
  },
})

// Gera URL segura e temporária para upload direto no Convex File Storage
export const generateUploadUrl = mutation({
  args: { sessionToken: v.string(), },
  handler: async (ctx, input) => {
    const { sessionToken, ...args } = input
    await requireStaff(ctx, sessionToken, ["admin"]);

    return await ctx.storage.generateUploadUrl()
  },
})

export const updateSettings = mutation({
  args: { sessionToken: v.string(),
    clinicName: v.string(),
    clinicSubtitle: v.string(),
    primaryColor: v.string(),
    colorPreset: v.string(),
    mode: v.union(v.literal("light"), v.literal("dark")),
    logoUrl: v.optional(v.string()),
    logoStorageId: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    cancellationNoticeHours: v.number(),
    replacementExpiryDays: v.number(),
    uazapiEndpoint: v.optional(v.string()),
    uazapiToken: v.optional(v.string()),
    uazapiAdminToken: v.optional(v.string()),
    uazapiInstanceId: v.optional(v.string()),
    activeWhatsappInstanceToken: v.optional(v.string()),
    resendApiKey: v.optional(v.string()),
    resendFromEmail: v.optional(v.string()),
  },
  handler: async (ctx, input) => {
    const { sessionToken, ...args } = input
    await requireStaff(ctx, sessionToken, ["admin"]);

    for (const key of ['uazapiToken', 'uazapiAdminToken', 'activeWhatsappInstanceToken', 'resendApiKey'] as const) {
      if (!args[key]?.trim()) delete args[key]
    }
    if (args.uazapiEndpoint) {
      const url = new URL(args.uazapiEndpoint)
      if (url.protocol !== 'https:' || !url.hostname.endsWith('.uazapi.com') || url.username || url.password || url.port || url.search || url.hash) throw new Error('Use um endpoint HTTPS oficial da UAZAPI.')
      args.uazapiEndpoint = url.origin
    }
    if (!Number.isFinite(args.cancellationNoticeHours) || args.cancellationNoticeHours < 0 || !Number.isInteger(args.replacementExpiryDays) || args.replacementExpiryDays < 1) throw new Error('Regras de cancelamento inválidas.')
    const existing = await ctx.db.query("clinicSettings").first()
    if (existing) {
      // Se a logoStorageId mudou ou foi limpa, deletar o arquivo antigo do storage
      if (
        existing.logoStorageId &&
        args.logoStorageId !== undefined &&
        existing.logoStorageId !== args.logoStorageId
      ) {
        await ctx.storage.delete(existing.logoStorageId).catch(() => {})
      }

      await ctx.db.patch(existing._id, args)
      return existing._id
    } else {
      return await ctx.db.insert("clinicSettings", args)
    }
  },
})

// Remove logotipo e limpa o arquivo do Convex Storage
export const removeLogo = mutation({
  args: { sessionToken: v.string(), },
  handler: async (ctx, input) => {
    const { sessionToken, ...args } = input
    await requireStaff(ctx, sessionToken, ["admin"]);

    const existing = await ctx.db.query("clinicSettings").first()
    if (!existing) return false

    if (existing.logoStorageId) {
      await ctx.storage.delete(existing.logoStorageId).catch(() => {})
    }

    await ctx.db.patch(existing._id, {
      logoUrl: undefined,
      logoStorageId: undefined,
    })
    return true
  },
})
