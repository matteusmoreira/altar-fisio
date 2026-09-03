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
      ...settings,
      logoUrl,
    }
  },
})

// Gera URL segura e temporária para upload direto no Convex File Storage
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl()
  },
})

export const updateSettings = mutation({
  args: {
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
  handler: async (ctx, args) => {
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
  args: {},
  handler: async (ctx) => {
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
