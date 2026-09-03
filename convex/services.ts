import { query, mutation } from "./_generated/server"
import { v } from "convex/values"

// Listagem de todos os serviços clínicos com enriquecimento de pacotes vinculados
export const listServices = query({
  handler: async (ctx) => {
    const services = await ctx.db.query("services").collect()
    const packages = await ctx.db.query("packages").collect()

    return services.map((service) => {
      const associatedPackages = packages.filter((pkg) => pkg.serviceId === service._id)
      return {
        ...service,
        packageCount: associatedPackages.length,
      }
    })
  },
})

// Obter serviço por ID
export const getService = query({
  args: {
    id: v.id("services"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
  },
})

// Criação de novo serviço clínico
export const createService = mutation({
  args: {
    name: v.string(),
    modality: v.union(v.literal("individual"), v.literal("turma")),
    specialty: v.union(v.literal("fisioterapia"), v.literal("pilates"), v.literal("rpg")),
    durationMinutes: v.number(),
    defaultPrice: v.number(),
    description: v.optional(v.string()),
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    const trimmedName = args.name.trim()
    if (!trimmedName) {
      throw new Error("O nome do serviço é obrigatório.")
    }
    if (args.durationMinutes <= 0) {
      throw new Error("A duração do serviço deve ser maior que zero.")
    }
    if (args.defaultPrice < 0) {
      throw new Error("O valor padrão não pode ser negativo.")
    }

    return await ctx.db.insert("services", {
      name: trimmedName,
      modality: args.modality,
      specialty: args.specialty,
      durationMinutes: args.durationMinutes,
      defaultPrice: args.defaultPrice,
      description: args.description?.trim() || undefined,
      active: args.active,
    })
  },
})

// Atualização de serviço clínico existente
export const updateService = mutation({
  args: {
    id: v.id("services"),
    name: v.optional(v.string()),
    modality: v.optional(v.union(v.literal("individual"), v.literal("turma"))),
    specialty: v.optional(v.union(v.literal("fisioterapia"), v.literal("pilates"), v.literal("rpg"))),
    durationMinutes: v.optional(v.number()),
    defaultPrice: v.optional(v.number()),
    description: v.optional(v.string()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...data } = args
    const service = await ctx.db.get(id)
    if (!service) {
      throw new Error("Serviço clínico não encontrado.")
    }

    const patchData: Record<string, any> = {}
    if (data.name !== undefined) {
      const trimmed = data.name.trim()
      if (!trimmed) throw new Error("O nome do serviço não pode ser vazio.")
      patchData.name = trimmed
    }
    if (data.modality !== undefined) patchData.modality = data.modality
    if (data.specialty !== undefined) patchData.specialty = data.specialty
    if (data.durationMinutes !== undefined) {
      if (data.durationMinutes <= 0) throw new Error("A duração deve ser maior que zero.")
      patchData.durationMinutes = data.durationMinutes
    }
    if (data.defaultPrice !== undefined) {
      if (data.defaultPrice < 0) throw new Error("O valor padrão não pode ser negativo.")
      patchData.defaultPrice = data.defaultPrice
    }
    if (data.description !== undefined) {
      patchData.description = data.description.trim() || undefined
    }
    if (data.active !== undefined) {
      patchData.active = data.active
    }

    await ctx.db.patch(id, patchData)
    return id
  },
})

// Exclusão de serviço clínico com proteção de integridade referencial
export const deleteService = mutation({
  args: {
    id: v.id("services"),
  },
  handler: async (ctx, args) => {
    const service = await ctx.db.get(args.id)
    if (!service) {
      throw new Error("Serviço clínico não encontrado.")
    }

    // Verificar se existem planos comerciais vinculados a este serviço
    const packages = await ctx.db.query("packages").collect()
    const linkedPackages = packages.filter((pkg) => pkg.serviceId === args.id)

    if (linkedPackages.length > 0) {
      const packageNames = linkedPackages.map((p) => p.name).join(", ")
      throw new Error(
        `Não é possível excluir o serviço "${service.name}" pois ele está vinculado a ${linkedPackages.length} plano(s) comercial(is): ${packageNames}. Desative o serviço em vez de excluí-lo para preservar a integridade histórica.`
      )
    }

    await ctx.db.delete(args.id)
    return { success: true, id: args.id }
  },
})
