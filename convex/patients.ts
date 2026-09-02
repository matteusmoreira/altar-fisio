import { query, mutation } from "./_generated/server"
import { v } from "convex/values"

export const listPatients = query({
  args: { search: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const patients = await ctx.db.query("patients").collect()
    if (!args.search) return patients

    const term = args.search.toLowerCase()
    return patients.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.documentCpf.includes(term) ||
        p.phone.includes(term)
    )
  },
})

export const getPatient = query({
  args: { id: v.id("patients") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
  },
})

export const createPatient = mutation({
  args: {
    name: v.string(),
    documentCpf: v.string(),
    phone: v.string(),
    email: v.optional(v.string()),
    birthDate: v.string(),
    gender: v.optional(v.string()),
    address: v.optional(v.string()),
    emergencyContact: v.optional(v.string()),
    emergencyPhone: v.optional(v.string()),
    healthInsurance: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("patients", {
      ...args,
      active: true,
      createdAt: Date.now(),
    })
  },
})

export const updatePatient = mutation({
  args: {
    id: v.id("patients"),
    name: v.string(),
    documentCpf: v.string(),
    phone: v.string(),
    email: v.optional(v.string()),
    birthDate: v.string(),
    gender: v.optional(v.string()),
    address: v.optional(v.string()),
    emergencyContact: v.optional(v.string()),
    emergencyPhone: v.optional(v.string()),
    healthInsurance: v.optional(v.string()),
    notes: v.optional(v.string()),
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { id, ...data } = args
    await ctx.db.patch(id, data)
    return id
  },
})
