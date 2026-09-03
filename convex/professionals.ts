import { query, mutation } from "./_generated/server"
import { v } from "convex/values"

export const listProfessionals = query({
  handler: async (ctx) => {
    return await ctx.db.query("professionals").collect()
  },
})

export const createProfessional = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    phone: v.string(),
    crefito: v.string(),
    specialties: v.array(v.string()),
    commissionType: v.union(v.literal("percentage"), v.literal("fixed")),
    commissionValue: v.number(),
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("professionals", args)
  },
})

export const updateProfessional = mutation({
  args: {
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
  handler: async (ctx, args) => {
    const { id, ...data } = args
    await ctx.db.patch(id, data)
    return id
  },
})

export const deleteProfessional = mutation({
  args: {
    id: v.id("professionals"),
  },
  handler: async (ctx, args) => {
    const prof = await ctx.db.get(args.id)
    if (!prof) throw new Error("Profissional não encontrado")

    await ctx.db.delete(args.id)
    return { success: true, id: args.id }
  },
})

