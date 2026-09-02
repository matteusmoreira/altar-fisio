import { query, mutation } from "./_generated/server"
import { v } from "convex/values"

export const getSettings = query({
  handler: async (ctx) => {
    return await ctx.db.query("clinicSettings").first()
  },
})

export const updateSettings = mutation({
  args: {
    clinicName: v.string(),
    clinicSubtitle: v.string(),
    primaryColor: v.string(),
    colorPreset: v.string(),
    mode: v.union(v.literal("light"), v.literal("dark")),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    cancellationNoticeHours: v.number(),
    replacementExpiryDays: v.number(),
    uazapiEndpoint: v.optional(v.string()),
    uazapiToken: v.optional(v.string()),
    uazapiInstanceId: v.optional(v.string()),
    resendApiKey: v.optional(v.string()),
    resendFromEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("clinicSettings").first()
    if (existing) {
      await ctx.db.patch(existing._id, args)
      return existing._id
    } else {
      return await ctx.db.insert("clinicSettings", args)
    }
  },
})
