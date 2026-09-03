import { query, mutation } from "./_generated/server"
import { v } from "convex/values"

// Listagem de todos os serviços clínicos cadastrados
export const listServices = query({
  handler: async (ctx) => {
    return await ctx.db.query("services").collect()
  },
})

// Listagem de pacotes e planos de tabela enriquecidos com dados do serviço
export const listPackages = query({
  handler: async (ctx) => {
    const packages = await ctx.db.query("packages").collect()

    return await Promise.all(
      packages.map(async (pkg) => {
        const service = await ctx.db.get(pkg.serviceId)
        return {
          ...pkg,
          serviceName: service?.name || "Serviço",
          modality: service?.modality || "turma",
          specialty: service?.specialty || "pilates",
          durationMinutes: service?.durationMinutes || 55,
          pricePerSession: pkg.sessionCount > 0 ? Number((pkg.price / pkg.sessionCount).toFixed(2)) : 0,
        }
      })
    )
  },
})

// Criação de novo pacote comercial
export const createPackage = mutation({
  args: {
    name: v.string(),
    serviceId: v.id("services"),
    sessionCount: v.number(),
    validityDays: v.number(),
    price: v.number(),
    description: v.optional(v.string()),
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("packages", {
      name: args.name,
      serviceId: args.serviceId,
      sessionCount: args.sessionCount,
      validityDays: args.validityDays,
      price: args.price,
      description: args.description,
      active: args.active,
    })
  },
})

// Atualização de pacote comercial
export const updatePackage = mutation({
  args: {
    id: v.id("packages"),
    name: v.optional(v.string()),
    serviceId: v.optional(v.id("services")),
    price: v.optional(v.number()),
    sessionCount: v.optional(v.number()),
    validityDays: v.optional(v.number()),
    description: v.optional(v.string()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...data } = args
    await ctx.db.patch(id, data)
    return id
  },
})

// Exclusão de pacote comercial
export const deletePackage = mutation({
  args: {
    id: v.id("packages"),
  },
  handler: async (ctx, args) => {
    const pkg = await ctx.db.get(args.id)
    if (!pkg) throw new Error("Pacote não encontrado")

    await ctx.db.delete(args.id)
    return { success: true, id: args.id }
  },
})

// Cancelamento / Exclusão de pacote atribuído a paciente
export const deletePatientPackage = mutation({
  args: {
    id: v.id("patientPackages"),
  },
  handler: async (ctx, args) => {
    const pp = await ctx.db.get(args.id)
    if (!pp) throw new Error("Assinatura de pacote não encontrada")

    await ctx.db.delete(args.id)
    return { success: true, id: args.id }
  },
})


// Listagem dos pacotes adquiridos pelos pacientes (com cálculo de expiração e progresso)
export const listPatientPackages = query({
  args: {
    patientId: v.optional(v.id("patients")),
    status: v.optional(v.union(v.literal("active"), v.literal("completed"), v.literal("expired"))),
  },
  handler: async (ctx, args) => {
    let patientPackages
    if (args.patientId) {
      patientPackages = await ctx.db
        .query("patientPackages")
        .withIndex("by_patient", (q) => q.eq("patientId", args.patientId!))
        .collect()
      if (args.status) {
        patientPackages = patientPackages.filter((p) => p.status === args.status)
      }
    } else if (args.status) {
      patientPackages = await ctx.db
        .query("patientPackages")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .collect()
    } else {
      patientPackages = await ctx.db.query("patientPackages").order("desc").take(100)
    }

    const todayStr = new Date().toISOString().split("T")[0]

    const enriched = await Promise.all(
      patientPackages.map(async (item) => {
        const patient = await ctx.db.get(item.patientId)
        const pkg = await ctx.db.get(item.packageId)
        let service = null
        if (pkg?.serviceId) {
          service = await ctx.db.get(pkg.serviceId)
        }

        const isExpired = item.status === "active" && item.expiryDate < todayStr
        const actualStatus = isExpired ? "expired" : item.status

        const expiryDateObj = new Date(`${item.expiryDate}T23:59:59Z`)
        const daysLeft = Math.ceil((expiryDateObj.getTime() - Date.now()) / (1000 * 60 * 60 * 24))

        const usagePercentage =
          item.totalSessions > 0 ? Math.round((item.usedSessions / item.totalSessions) * 100) : 0

        const isLowBalance = actualStatus === "active" && item.remainingSessions <= 2
        const isExpiringSoon = actualStatus === "active" && daysLeft <= 7 && daysLeft >= 0

        return {
          ...item,
          status: actualStatus,
          patientName: patient?.name || "Paciente",
          patientPhone: patient?.phone || "",
          patientCpf: patient?.documentCpf || "",
          packageName: pkg?.name || "Pacote",
          packagePrice: pkg?.price || 0,
          serviceName: service?.name || "Serviço",
          specialty: service?.specialty || "pilates",
          modality: service?.modality || "turma",
          daysLeft: Math.max(0, daysLeft),
          usagePercentage,
          isLowBalance,
          isExpiringSoon,
          needsRenewal: isLowBalance || isExpiringSoon,
        }
      })
    )

    // Ordenar por prioridade de renovação (saldo baixo/expirando) e depois data de expiração
    return enriched.sort((a, b) => {
      if (a.needsRenewal && !b.needsRenewal) return -1
      if (!a.needsRenewal && b.needsRenewal) return 1
      return a.expiryDate.localeCompare(b.expiryDate)
    })
  },
})

// Busca de alertas de renovação (saldo <= 2 ou vence em até 7 dias)
export const listRenewalAlerts = query({
  handler: async (ctx) => {
    const active = await ctx.db
      .query("patientPackages")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect()
    const todayStr = new Date().toISOString().split("T")[0]

    const alerts = []

    for (const item of active) {
      const isExpired = item.expiryDate < todayStr
      const expiryDateObj = new Date(`${item.expiryDate}T23:59:59Z`)
      const daysLeft = Math.ceil((expiryDateObj.getTime() - Date.now()) / (1000 * 60 * 60 * 24))

      const isLowBalance = item.remainingSessions <= 2
      const isExpiringSoon = daysLeft <= 7

      if (isLowBalance || isExpiringSoon || isExpired) {
        const patient = await ctx.db.get(item.patientId)
        const pkg = await ctx.db.get(item.packageId)

        alerts.push({
          ...item,
          patientName: patient?.name || "Paciente",
          patientPhone: patient?.phone || "",
          packageName: pkg?.name || "Pacote",
          packagePrice: pkg?.price || 0,
          daysLeft: Math.max(0, daysLeft),
          isExpired,
          isLowBalance,
          isExpiringSoon,
          reason: isExpired
            ? "Pacote Vencido"
            : item.remainingSessions <= 1
            ? "Última Sessão Restante"
            : item.remainingSessions === 2
            ? "2 Sessões Restantes"
            : `Expira em ${daysLeft} dia(s)`,
        })
      }
    }

    return alerts.sort((a, b) => a.remainingSessions - b.remainingSessions)
  },
})

// Aquisição / Venda de Pacote para Paciente com Integração Financeira
export const assignPackageToPatient = mutation({
  args: {
    patientId: v.id("patients"),
    packageId: v.id("packages"),
    startDate: v.string(), // YYYY-MM-DD
    paymentMethod: v.union(
      v.literal("pix"),
      v.literal("dinheiro"),
      v.literal("cartao_debito"),
      v.literal("cartao_credito"),
      v.literal("transferencia")
    ),
    isPaid: v.boolean(),
  },
  handler: async (ctx, args) => {
    const pkg = await ctx.db.get(args.packageId)
    if (!pkg) throw new Error("Pacote não encontrado")

    const patient = await ctx.db.get(args.patientId)
    if (!patient) throw new Error("Paciente não encontrado")

    // Calcular data de expiração (startDate + validityDays)
    const start = new Date(`${args.startDate}T12:00:00Z`)
    const expiry = new Date(start)
    expiry.setDate(expiry.getDate() + pkg.validityDays)
    const expiryDateStr = expiry.toISOString().split("T")[0]

    // 1. Inserir em patientPackages
    const patientPackageId = await ctx.db.insert("patientPackages", {
      patientId: args.patientId,
      packageId: args.packageId,
      totalSessions: pkg.sessionCount,
      usedSessions: 0,
      remainingSessions: pkg.sessionCount,
      startDate: args.startDate,
      expiryDate: expiryDateStr,
      status: "active",
    })

    // 2. Lançar receita financeira automaticamente
    await ctx.db.insert("financialTransactions", {
      type: "income",
      category: "Pacote / Plano",
      description: `Venda de Pacote: ${pkg.name} - ${patient.name}`,
      amount: pkg.price,
      dueDate: args.startDate,
      paymentDate: args.isPaid ? args.startDate : undefined,
      paymentMethod: args.paymentMethod,
      status: args.isPaid ? "paid" : "pending",
      patientId: args.patientId,
      packageId: args.packageId,
      receiptIssued: false,
      createdAt: Date.now(),
    })

    return {
      patientPackageId,
      expiryDate: expiryDateStr,
      totalSessions: pkg.sessionCount,
      price: pkg.price,
    }
  },
})
