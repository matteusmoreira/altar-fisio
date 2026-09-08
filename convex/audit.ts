import { requireStaff } from './lib/security'
import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

export const logAction = mutation({
  args: { sessionToken: v.string(),
    userId: v.optional(v.id("users")),
    userName: v.string(),
    userRole: v.string(),
    action: v.string(),
    patientId: v.optional(v.id("patients")),
    patientName: v.optional(v.string()),
    details: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
  },
  handler: async (ctx, input) => {
    const { sessionToken, ...args } = input
    const actor = await requireStaff(ctx, sessionToken, ["admin","professional","reception"]);

    return await ctx.db.insert("auditLogs", {
      ...args, userId: actor._id, userName: actor.name, userRole: actor.role, ipAddress: undefined,
      timestamp: Date.now(),
    })
  },
})

export const listAuditLogs = query({
  args: { sessionToken: v.string(),
    limit: v.optional(v.number()),
    patientId: v.optional(v.id("patients")),
  },
  handler: async (ctx, input) => {
    const { sessionToken, ...args } = input
    await requireStaff(ctx, sessionToken, ["admin","professional"]);

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
