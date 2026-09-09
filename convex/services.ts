import { requireStaff } from './lib/security'
import { query, mutation } from "./_generated/server"
import { v } from "convex/values"

const normalizeCapacity = (modality: "individual" | "turma", requestedCapacity?: number) => {
  if (modality === "individual") return 1

  const capacity = requestedCapacity ?? 4
  if (!Number.isInteger(capacity) || capacity < 2 || capacity > 100) {
    throw new Error("A capacidade da turma deve ser um número inteiro entre 2 e 100 alunos.")
  }
  return capacity
}

const validatePrice = (price: number, label: string) => {
  if (!Number.isFinite(price) || price < 0) {
    throw new Error(`O ${label} não pode ser negativo.`)
  }
}

// Listagem de todos os serviços clínicos com enriquecimento de pacotes vinculados
export const listServices = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, input) => {
    const { sessionToken } = input
    await requireStaff(ctx, sessionToken, ["admin","professional","reception"]);

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
  args: { sessionToken: v.string(),
    id: v.id("services"),
  },
  handler: async (ctx, input) => {
    const { sessionToken, id } = input
    await requireStaff(ctx, sessionToken, ["admin","professional","reception"]);

    return await ctx.db.get(id)
  },
})

// Criação de novo serviço clínico
export const createService = mutation({
  args: { sessionToken: v.string(),
    name: v.string(),
    modality: v.union(v.literal("individual"), v.literal("turma")),
    specialty: v.union(v.literal("fisioterapia"), v.literal("pilates"), v.literal("rpg")),
    maxCapacity: v.optional(v.number()),
    durationMinutes: v.number(),
    defaultPrice: v.number(),
    packagePricePerSession: v.optional(v.number()),
    description: v.optional(v.string()),
    active: v.boolean(),
    isEvaluation: v.optional(v.boolean()),
  },
  handler: async (ctx, input) => {
    const { sessionToken, ...args } = input
    await requireStaff(ctx, sessionToken, ["admin"]);

    const trimmedName = args.name.trim()
    if (!trimmedName) {
      throw new Error("O nome do serviço é obrigatório.")
    }
    if (args.durationMinutes <= 0) {
      throw new Error("A duração do serviço deve ser maior que zero.")
    }
    validatePrice(args.defaultPrice, "valor padrão")
    if (args.packagePricePerSession !== undefined) {
      validatePrice(args.packagePricePerSession, "preço por sessão em pacote")
    }

    return await ctx.db.insert("services", {
      name: trimmedName,
      modality: args.modality,
      specialty: args.specialty,
      maxCapacity: normalizeCapacity(args.modality, args.maxCapacity),
      durationMinutes: args.durationMinutes,
      defaultPrice: args.defaultPrice,
      packagePricePerSession: args.packagePricePerSession,
      description: args.description?.trim() || undefined,
      active: args.active,
      isEvaluation: args.isEvaluation === true && args.modality === "individual",
    })
  },
})

// Atualização de serviço clínico existente
export const updateService = mutation({
  args: { sessionToken: v.string(),
    id: v.id("services"),
    name: v.optional(v.string()),
    modality: v.optional(v.union(v.literal("individual"), v.literal("turma"))),
    specialty: v.optional(v.union(v.literal("fisioterapia"), v.literal("pilates"), v.literal("rpg"))),
    maxCapacity: v.optional(v.number()),
    durationMinutes: v.optional(v.number()),
    defaultPrice: v.optional(v.number()),
    packagePricePerSession: v.optional(v.union(v.number(), v.null())),
    description: v.optional(v.string()),
    active: v.optional(v.boolean()),
    isEvaluation: v.optional(v.boolean()),
  },
  handler: async (ctx, input) => {
    const { sessionToken, ...args } = input
    await requireStaff(ctx, sessionToken, ["admin"]);

    const { id, ...data } = args
    const service = await ctx.db.get(id)
    if (!service) {
      throw new Error("Serviço clínico não encontrado.")
    }

    const patchData: Record<string, any> = {}
    const effectiveModality = data.modality ?? service.modality
    if (data.isEvaluation !== undefined || effectiveModality !== "individual") patchData.isEvaluation = effectiveModality === "individual" && data.isEvaluation === true
    if (data.name !== undefined) {
      const trimmed = data.name.trim()
      if (!trimmed) throw new Error("O nome do serviço não pode ser vazio.")
      patchData.name = trimmed
    }
    if (data.modality !== undefined) patchData.modality = data.modality
    if (data.specialty !== undefined) patchData.specialty = data.specialty
    if (
      data.modality !== undefined ||
      data.maxCapacity !== undefined ||
      service.maxCapacity === undefined ||
      service.modality === "individual"
    ) {
      patchData.maxCapacity = normalizeCapacity(effectiveModality, data.maxCapacity ?? service.maxCapacity)
    }
    if (data.durationMinutes !== undefined) {
      if (data.durationMinutes <= 0) throw new Error("A duração deve ser maior que zero.")
      patchData.durationMinutes = data.durationMinutes
    }
    if (data.defaultPrice !== undefined) {
      validatePrice(data.defaultPrice, "valor padrão")
      patchData.defaultPrice = data.defaultPrice
    }
    if (data.packagePricePerSession !== undefined) {
      if (data.packagePricePerSession === null) {
        patchData.packagePricePerSession = undefined
      } else {
        validatePrice(data.packagePricePerSession, "preço por sessão em pacote")
        patchData.packagePricePerSession = data.packagePricePerSession
      }
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
  args: { sessionToken: v.string(),
    id: v.id("services"),
  },
  handler: async (ctx, input) => {
    const { sessionToken, ...args } = input
    await requireStaff(ctx, sessionToken, ["admin"]);

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
