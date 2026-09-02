import { query, mutation } from "./_generated/server"
import { v } from "convex/values"

// Data de referência de hoje para cálculo de atrasos (YYYY-MM-DD)
const getTodayStr = () => new Date().toISOString().split("T")[0]

/**
 * Lista todas as transações financeiras com filtros e status de atraso derivado
 */
export const listTransactions = query({
  args: {
    type: v.optional(v.union(v.literal("income"), v.literal("expense"))),
    status: v.optional(v.union(v.literal("pending"), v.literal("paid"), v.literal("cancelled"))),
    monthYear: v.optional(v.string()), // YYYY-MM
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let transactions = await ctx.db.query("financialTransactions").order("desc").collect()

    const todayStr = getTodayStr()

    if (args.type) {
      transactions = transactions.filter((t) => t.type === args.type)
    }
    if (args.status) {
      transactions = transactions.filter((t) => t.status === args.status)
    }
    if (args.category) {
      transactions = transactions.filter((t) => t.category.toLowerCase().includes(args.category!.toLowerCase()))
    }
    if (args.monthYear) {
      transactions = transactions.filter((t) => {
        const refDate = t.paymentDate || t.dueDate
        return refDate.startsWith(args.monthYear!)
      })
    }

    // Enriquecimento com nomes de pacientes, profissionais e cálculo de atraso
    return await Promise.all(
      transactions.map(async (t) => {
        let patientName = undefined
        let professionalName = undefined

        if (t.patientId) {
          const p = await ctx.db.get(t.patientId)
          patientName = p?.name
        }
        if (t.professionalId) {
          const prof = await ctx.db.get(t.professionalId)
          professionalName = prof?.name
        }

        const isOverdue = t.status === "pending" && t.dueDate < todayStr

        return {
          ...t,
          patientName,
          professionalName,
          isOverdue,
        }
      })
    )
  },
})

/**
 * Resumo consolidado do Fluxo de Caixa (DRE Operacional)
 */
export const getCashFlowSummary = query({
  args: {
    monthYear: v.optional(v.string()), // YYYY-MM
  },
  handler: async (ctx, args) => {
    let transactions = await ctx.db.query("financialTransactions").collect()
    const todayStr = getTodayStr()

    if (args.monthYear) {
      transactions = transactions.filter((t) => {
        const refDate = t.paymentDate || t.dueDate
        return refDate.startsWith(args.monthYear!)
      })
    }

    let totalIncome = 0
    let totalExpense = 0
    let pendingIncome = 0
    let pendingExpense = 0
    let overdueIncome = 0
    let overdueExpense = 0

    for (const t of transactions) {
      if (t.status === "cancelled") continue

      if (t.status === "paid") {
        if (t.type === "income") totalIncome += t.amount
        if (t.type === "expense") totalExpense += t.amount
      } else if (t.status === "pending") {
        const isOverdue = t.dueDate < todayStr
        if (t.type === "income") {
          pendingIncome += t.amount
          if (isOverdue) overdueIncome += t.amount
        }
        if (t.type === "expense") {
          pendingExpense += t.amount
          if (isOverdue) overdueExpense += t.amount
        }
      }
    }

    const currentBalance = totalIncome - totalExpense
    const totalReceivable = pendingIncome
    const totalPayable = pendingExpense
    const projectedBalance = currentBalance + totalReceivable - totalPayable

    return {
      totalIncome,
      totalExpense,
      balance: currentBalance,
      pendingIncome,
      pendingExpense,
      overdueIncome,
      overdueExpense,
      totalReceivable,
      totalPayable,
      projectedBalance,
    }
  },
})

/**
 * Criação de uma transação financeira (Receita ou Despesa)
 */
export const createTransaction = mutation({
  args: {
    type: v.union(v.literal("income"), v.literal("expense")),
    category: v.string(),
    description: v.string(),
    amount: v.number(),
    dueDate: v.string(),
    paymentDate: v.optional(v.string()),
    paymentMethod: v.union(
      v.literal("pix"),
      v.literal("dinheiro"),
      v.literal("cartao_debito"),
      v.literal("cartao_credito"),
      v.literal("transferencia")
    ),
    status: v.union(v.literal("pending"), v.literal("paid"), v.literal("cancelled")),
    patientId: v.optional(v.id("patients")),
    professionalId: v.optional(v.id("professionals")),
    packageId: v.optional(v.id("packages")),
    receiptIssued: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("financialTransactions", {
      ...args,
      receiptIssued: args.receiptIssued ?? false,
      createdAt: Date.now(),
    })
  },
})

/**
 * Atualização dos dados de uma transação
 */
export const updateTransaction = mutation({
  args: {
    id: v.id("financialTransactions"),
    category: v.optional(v.string()),
    description: v.optional(v.string()),
    amount: v.optional(v.number()),
    dueDate: v.optional(v.string()),
    paymentDate: v.optional(v.string()),
    paymentMethod: v.optional(
      v.union(
        v.literal("pix"),
        v.literal("dinheiro"),
        v.literal("cartao_debito"),
        v.literal("cartao_credito"),
        v.literal("transferencia")
      )
    ),
    status: v.optional(v.union(v.literal("pending"), v.literal("paid"), v.literal("cancelled"))),
    receiptIssued: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...data } = args
    await ctx.db.patch(id, data)
  },
})

/**
 * Baixa e conciliação de pagamento
 */
export const markTransactionPaid = mutation({
  args: {
    id: v.id("financialTransactions"),
    paymentDate: v.string(),
    paymentMethod: v.optional(
      v.union(
        v.literal("pix"),
        v.literal("dinheiro"),
        v.literal("cartao_debito"),
        v.literal("cartao_credito"),
        v.literal("transferencia")
      )
    ),
  },
  handler: async (ctx, args) => {
    const patchData: any = {
      status: "paid",
      paymentDate: args.paymentDate,
    }
    if (args.paymentMethod) {
      patchData.paymentMethod = args.paymentMethod
    }
    await ctx.db.patch(args.id, patchData)
  },
})

/**
 * Cancelamento de uma transação
 */
export const cancelTransaction = mutation({
  args: {
    id: v.id("financialTransactions"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "cancelled",
    })
  },
})

/**
 * Exclusão definitiva de uma transação
 */
export const deleteTransaction = mutation({
  args: {
    id: v.id("financialTransactions"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id)
  },
})

/**
 * Motor Automatizado de Apuração de Comissões e Repasses
 * Lê presenças confirmadas (present / replacement), calcula por regra (fixa ou %)
 * e verifica se o período já foi fechado.
 */
export const calculateProfessionalCommissions = query({
  args: { monthYear: v.string() }, // YYYY-MM
  handler: async (ctx, args) => {
    const professionals = await ctx.db.query("professionals").collect()
    const services = await ctx.db.query("services").collect()

    const results = await Promise.all(
      professionals.map(async (prof) => {
        // Verifica se já existe fechamento formal na tabela commissions
        const existingCommission = await ctx.db
          .query("commissions")
          .withIndex("by_professional_period", (q) =>
            q.eq("professionalId", prof._id).eq("periodMonthYear", args.monthYear)
          )
          .first()

        // Busca agendamentos do profissional
        const allSchedules = await ctx.db
          .query("schedules")
          .withIndex("by_professional_date", (q) => q.eq("professionalId", prof._id))
          .collect()

        const monthSchedules = allSchedules.filter((s) => s.date.startsWith(args.monthYear))

        let totalAttendedCount = 0
        let totalGrossRevenue = 0
        let totalCommission = 0

        const attendancesList: Array<{
          scheduleId: string
          date: string
          startTime: string
          title: string
          modality: string
          specialty: string
          patientId: string
          patientName: string
          sessionRevenue: number
          commissionEarned: number
        }> = []

        for (const schedule of monthSchedules) {
          const participants = await ctx.db
            .query("scheduleParticipants")
            .withIndex("by_schedule", (q) => q.eq("scheduleId", schedule._id))
            .collect()

          const confirmedParticipants = participants.filter(
            (p) => p.status === "present" || p.status === "replacement"
          )

          for (const part of confirmedParticipants) {
            totalAttendedCount++

            // Resolução do valor da sessão (Pacote proporcional ou Tabela de Serviço)
            let sessionPrice = schedule.type === "turma" ? 95 : 180

            if (part.patientPackageId) {
              const patientPkg = await ctx.db.get(part.patientPackageId)
              if (patientPkg) {
                const pkgDef = await ctx.db.get(patientPkg.packageId)
                if (pkgDef && pkgDef.sessionCount > 0) {
                  sessionPrice = Math.round(pkgDef.price / pkgDef.sessionCount)
                }
              }
            } else {
              const matchedService = services.find(
                (srv) => srv.specialty === schedule.specialty && srv.modality === schedule.type
              )
              if (matchedService && matchedService.defaultPrice > 0) {
                sessionPrice = matchedService.defaultPrice
              }
            }

            // Cálculo individual da comissão do profissional
            let earned = 0
            if (prof.commissionType === "percentage") {
              earned = (sessionPrice * prof.commissionValue) / 100
            } else {
              earned = prof.commissionValue
            }

            totalGrossRevenue += sessionPrice
            totalCommission += earned

            let patientName = "Paciente Altar Fisio"
            if (part.patientId) {
              const pat = await ctx.db.get(part.patientId)
              if (pat) patientName = pat.name
            }

            attendancesList.push({
              scheduleId: schedule._id,
              date: schedule.date,
              startTime: schedule.startTime,
              title: schedule.title,
              modality: schedule.type === "turma" ? "Studio Pilates (Grupo)" : "Individual / RPG",
              specialty: schedule.specialty.toUpperCase(),
              patientId: part.patientId,
              patientName,
              sessionRevenue: sessionPrice,
              commissionEarned: earned,
            })
          }
        }

        // Ordena atendimentos por data e hora decrescente
        attendancesList.sort((a, b) => {
          const cmp = b.date.localeCompare(a.date)
          return cmp !== 0 ? cmp : b.startTime.localeCompare(a.startTime)
        })

        return {
          professionalId: prof._id,
          professionalName: prof.name,
          crefito: prof.crefito,
          specialties: prof.specialties,
          commissionType: prof.commissionType,
          commissionRate: prof.commissionValue,
          totalAttendedSessions: totalAttendedCount,
          estimatedRevenue: totalGrossRevenue,
          commissionPayable: totalCommission,
          isClosed: !!existingCommission,
          closedStatus: existingCommission?.status,
          closedCommissionId: existingCommission?._id,
          paidAt: existingCommission?.paidAt,
          attendancesList,
        }
      })
    )

    return results
  },
})

/**
 * Fecha e aprova formalmente a comissão mensal de um profissional,
 * gerando a despesa de repasse correspondente no Fluxo de Caixa.
 */
export const closeProfessionalCommission = mutation({
  args: {
    professionalId: v.id("professionals"),
    periodMonthYear: v.string(), // YYYY-MM
    totalAttendances: v.number(),
    totalGrossAmount: v.number(),
    totalCommissionAmount: v.number(),
    status: v.union(v.literal("pending"), v.literal("paid")),
    notes: v.optional(v.string()),
    autoCreateExpense: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const todayStr = getTodayStr()
    const prof = await ctx.db.get(args.professionalId)
    const profName = prof?.name || "Profissional"

    // Verifica se já existe registro na tabela commissions
    const existing = await ctx.db
      .query("commissions")
      .withIndex("by_professional_period", (q) =>
        q.eq("professionalId", args.professionalId).eq("periodMonthYear", args.periodMonthYear)
      )
      .first()

    let commissionId = existing?._id

    if (existing) {
      await ctx.db.patch(existing._id, {
        totalAttendances: args.totalAttendances,
        totalGrossAmount: args.totalGrossAmount,
        totalCommissionAmount: args.totalCommissionAmount,
        status: args.status,
        paidAt: args.status === "paid" ? Date.now() : undefined,
        notes: args.notes,
      })
    } else {
      commissionId = await ctx.db.insert("commissions", {
        professionalId: args.professionalId,
        periodMonthYear: args.periodMonthYear,
        totalAttendances: args.totalAttendances,
        totalGrossAmount: args.totalGrossAmount,
        totalCommissionAmount: args.totalCommissionAmount,
        status: args.status,
        paidAt: args.status === "paid" ? Date.now() : undefined,
        notes: args.notes,
      })
    }

    // Criação automática da despesa na tabela financialTransactions (se solicitada)
    if (args.autoCreateExpense !== false) {
      await ctx.db.insert("financialTransactions", {
        type: "expense",
        category: "Repasse de Comissão",
        description: `Repasse Profissional: ${profName} (${args.periodMonthYear}) - ${args.totalAttendances} atendimentos`,
        amount: args.totalCommissionAmount,
        dueDate: todayStr,
        paymentDate: args.status === "paid" ? todayStr : undefined,
        paymentMethod: "pix",
        status: args.status === "paid" ? "paid" : "pending",
        professionalId: args.professionalId,
        receiptIssued: false,
        createdAt: Date.now(),
      })
    }

    return {
      success: true,
      commissionId,
    }
  },
})

/**
 * Lista o histórico de comissões fechadas
 */
export const listCommissions = query({
  handler: async (ctx) => {
    const items = await ctx.db.query("commissions").order("desc").collect()

    return await Promise.all(
      items.map(async (c) => {
        const prof = await ctx.db.get(c.professionalId)
        return {
          ...c,
          professionalName: prof?.name || "Desconhecido",
          crefito: prof?.crefito || "",
        }
      })
    )
  },
})
