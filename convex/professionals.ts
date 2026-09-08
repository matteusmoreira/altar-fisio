import { requireStaff } from './lib/security'
import { query, mutation } from "./_generated/server"
import { v } from "convex/values"

export const listProfessionals = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, input) => {
    const { sessionToken, ...args } = input
    await requireStaff(ctx, sessionToken, ["admin","professional","reception"]);

    return await ctx.db.query("professionals").collect()
  },
})

export const createProfessional = mutation({
  args: { sessionToken: v.string(),
    name: v.string(),
    email: v.string(),
    phone: v.string(),
    crefito: v.string(),
    specialties: v.array(v.string()),
    commissionType: v.union(v.literal("percentage"), v.literal("fixed")),
    commissionValue: v.number(),
    active: v.boolean(),
  },
  handler: async (ctx, input) => {
    const { sessionToken, ...args } = input
    await requireStaff(ctx, sessionToken, ["admin"]);

    return await ctx.db.insert("professionals", args)
  },
})

export const updateProfessional = mutation({
  args: { sessionToken: v.string(),
    id: v.id("professionals"),
    name: v.string(),
    email: v.string(),
    phone: v.string(),
    crefito: v.string(),
    specialties: v.array(v.string()),
    commissionType: v.union(v.literal("percentage"), v.literal("fixed")),
    commissionValue: v.number(),
    active: v.boolean(),
  },
  handler: async (ctx, input) => {
    const { sessionToken, ...args } = input
    await requireStaff(ctx, sessionToken, ["admin"]);

    const { id, ...data } = args
    await ctx.db.patch(id, data)
    return id
  },
})

export const deleteProfessional = mutation({
  args: { sessionToken: v.string(),
    id: v.id("professionals"),
  },
  handler: async (ctx, input) => {
    const { sessionToken, ...args } = input
    await requireStaff(ctx, sessionToken, ["admin"]);

    const prof = await ctx.db.get(args.id)
    if (!prof) throw new Error("Profissional não encontrado")

    await ctx.db.delete(args.id)
    return { success: true, id: args.id }
  },
})

