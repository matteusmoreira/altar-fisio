import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

export const logAction = mutation({
  args: {
    userId: v.optional(v.id("users")),
    userName: v.string(),
    userRole: v.string(),
    action: v.string(),
    patientId: v.optional(v.id("patients")),
    patientName: v.optional(v.string()),
    details: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("auditLogs", {
      ...args,
      timestamp: Date.now(),
    })
  },
})

export const listAuditLogs = query({
  args: {
    limit: v.optional(v.number()),
    patientId: v.optional(v.id("patients")),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100
    if (args.patientId) {
      return await ctx.db
        .query("auditLogs")
        .withIndex("by_patient", (q) => q.eq("patientId", args.patientId))
        .order("desc")
        .take(limit)
    }

    return await ctx.db
      .query("auditLogs")
      .withIndex("by_timestamp")
      .order("desc")
      .take(limit)
  },
})
