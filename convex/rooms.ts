import { requireStaff } from './lib/security'
import { query, mutation } from "./_generated/server"
import { v } from "convex/values"

export const listRooms = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, input) => {
    const { sessionToken, ...args } = input
    await requireStaff(ctx, sessionToken, ["admin","professional","reception"]);

    return await ctx.db.query("rooms").collect()
  },
})

export const createRoom = mutation({
  args: { sessionToken: v.string(),
    name: v.string(),
    type: v.union(
      v.literal("pilates_aparelhos"),
      v.literal("pilates_solo"),
      v.literal("rpg"),
      v.literal("fisioterapia"),
      v.literal("consultorio")
    ),
    capacity: v.number(),
    color: v.string(),
    description: v.optional(v.string()),
    isActive: v.boolean(),
  },
  handler: async (ctx, input) => {
    const { sessionToken, ...args } = input
    await requireStaff(ctx, sessionToken, ["admin"]);

    return await ctx.db.insert("rooms", args)
  },
})

export const updateRoom = mutation({
  args: { sessionToken: v.string(),
    id: v.id("rooms"),
    name: v.string(),
    type: v.union(
      v.literal("pilates_aparelhos"),
      v.literal("pilates_solo"),
      v.literal("rpg"),
      v.literal("fisioterapia"),
      v.literal("consultorio")
    ),
    capacity: v.number(),
    color: v.string(),
    isActive: v.boolean(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, input) => {
    const { sessionToken, ...args } = input
    await requireStaff(ctx, sessionToken, ["admin"]);

    const { id, ...data } = args
    await ctx.db.patch(id, data)
    return id
  },
})

export const deleteRoom = mutation({
  args: { sessionToken: v.string(),
    id: v.id("rooms"),
  },
  handler: async (ctx, input) => {
    const { sessionToken, ...args } = input
    await requireStaff(ctx, sessionToken, ["admin"]);

    const room = await ctx.db.get(args.id)
    if (!room) throw new Error("Sala não encontrada")

    // Remove a sala do banco
    await ctx.db.delete(args.id)
    return { success: true, id: args.id }
  },
})

