import { query, mutation } from "./_generated/server"
import { v } from "convex/values"

function checkTimeOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  return startA < endB && startB < endA
}

// Gera slots de tempo a partir de uma faixa (ex: 08:00 às 12:00 fatiado em 50min com 10min de intervalo)
export function sliceTimeWindowIntoSlots(
  startTime: string,
  endTime: string,
  slotDurationMinutes: number = 50,
  breakMinutes: number = 10
): Array<{ start: string; end: string }> {
  const [startHour, startMin] = startTime.split(":").map(Number)
  const [endHour, endMin] = endTime.split(":").map(Number)

  const startTotalMinutes = startHour * 60 + startMin
  const endTotalMinutes = endHour * 60 + endMin

  const slots: Array<{ start: string; end: string }> = []
  let currentStart = startTotalMinutes

  while (currentStart + slotDurationMinutes <= endTotalMinutes) {
    const currentEnd = currentStart + slotDurationMinutes

    const sH = String(Math.floor(currentStart / 60)).padStart(2, "0")
    const sM = String(currentStart % 60).padStart(2, "0")
    const eH = String(Math.floor(currentEnd / 60)).padStart(2, "0")
    const eM = String(currentEnd % 60).padStart(2, "0")

    slots.push({
      start: `${sH}:${sM}`,
      end: `${eH}:${eM}`,
    })

    currentStart = currentEnd + breakMinutes
  }

  return slots
}

// 1. Listar Regras de Disponibilidade
export const listRules = query({
  args: {
    professionalId: v.optional(v.id("professionals")),
    roomId: v.optional(v.id("rooms")),
  },
  handler: async (ctx, args) => {
    let rules = await ctx.db.query("availabilityRules").collect()

    if (args.professionalId) {
      rules = rules.filter((r) => r.professionalId === args.professionalId)
    }
    if (args.roomId) {
      rules = rules.filter((r) => r.roomId === args.roomId)
    }

    const enriched = await Promise.all(
      rules.map(async (rule) => {
        const prof = await ctx.db.get(rule.professionalId)
        const room = await ctx.db.get(rule.roomId)
        return {
          ...rule,
          professionalName: prof?.name || "Profissional",
          professionalSpecialties: prof?.specialties || [],
          roomName: room?.name || "Sala",
          roomColor: room?.color || "#10B981",
          roomCapacity: room?.capacity || 1,
        }
      })
    )

    // Ordena por dia da semana e horário de início
    return enriched.sort((a, b) => {
      if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek
      return a.startTime.localeCompare(b.startTime)
    })
  },
})

// 2. Salvar Regra de Disponibilidade (com validação anti-conflito)
export const saveRule = mutation({
  args: {
    id: v.optional(v.id("availabilityRules")),
    professionalId: v.id("professionals"),
    roomId: v.id("rooms"),
    specialty: v.union(v.literal("fisioterapia"), v.literal("pilates"), v.literal("rpg")),
    dayOfWeek: v.number(), // 0 = Domingo, 1 = Segunda, ... 6 = Sábado
    startTime: v.string(), // "08:00"
    endTime: v.string(), // "12:00"
    slotDurationMinutes: v.optional(v.number()),
    breakMinutes: v.optional(v.number()),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    if (args.startTime >= args.endTime) {
      throw new Error("O horário de início deve ser anterior ao término.")
    }

    // Busca todas as regras do mesmo dia da semana para checar conflitos
    const allRulesInDay = await ctx.db
      .query("availabilityRules")
      .withIndex("by_day_specialty", (q) => q.eq("dayOfWeek", args.dayOfWeek))
      .collect()

    const activeRulesInDay = allRulesInDay.filter(
      (r) => r.isActive && (!args.id || r._id !== args.id)
    )

    // Checar se a mesma sala já está alocada para outro horário sobreposto
    const roomConflict = activeRulesInDay.find(
      (r) =>
        r.roomId === args.roomId &&
        checkTimeOverlap(r.startTime, r.endTime, args.startTime, args.endTime)
    )

    if (roomConflict) {
      const room = await ctx.db.get(args.roomId)
      const prof = await ctx.db.get(roomConflict.professionalId)
      throw new Error(
        `Conflito de Sala: A sala "${room?.name || "Ambiente"}" já está reservada das ${roomConflict.startTime} às ${roomConflict.endTime} para ${prof?.name || "outro profissional"}.`
      )
    }

    // Checar se o mesmo profissional já está alocado em outra sala nesse mesmo horário
    const profConflict = activeRulesInDay.find(
      (r) =>
        r.professionalId === args.professionalId &&
        checkTimeOverlap(r.startTime, r.endTime, args.startTime, args.endTime)
    )

    if (profConflict) {
      const room = await ctx.db.get(profConflict.roomId)
      throw new Error(
        `Conflito de Profissional: O profissional já tem atendimento agendado na sala "${room?.name || "Ambiente"}" das ${profConflict.startTime} às ${profConflict.endTime}.`
      )
    }

    const payload = {
      professionalId: args.professionalId,
      roomId: args.roomId,
      specialty: args.specialty,
      dayOfWeek: args.dayOfWeek,
      startTime: args.startTime,
      endTime: args.endTime,
      slotDurationMinutes: args.slotDurationMinutes ?? 50,
      breakMinutes: args.breakMinutes ?? 10,
      isActive: args.isActive,
    }

    let savedId: string
    if (args.id) {
      await ctx.db.patch(args.id, payload)
      savedId = args.id
    } else {
      savedId = await ctx.db.insert("availabilityRules", payload)
    }

    return { success: true, id: savedId }
  },
})

// 3. Excluir Regra de Disponibilidade
export const deleteRule = mutation({
  args: {
    id: v.id("availabilityRules"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id)
    if (!existing) {
      throw new Error("Regra de disponibilidade não encontrada.")
    }

    await ctx.db.delete(args.id)
    return { success: true }
  },
})

// 4. Listar Exceções (Bloqueios e Plantões Extras)
export const listOverrides = query({
  args: {
    professionalId: v.optional(v.id("professionals")),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let overrides = await ctx.db.query("availabilityOverrides").collect()

    if (args.professionalId) {
      overrides = overrides.filter((o) => o.professionalId === args.professionalId)
    }
    if (args.startDate) {
      overrides = overrides.filter((o) => o.date >= args.startDate!)
    }
    if (args.endDate) {
      overrides = overrides.filter((o) => o.date <= args.endDate!)
    }

    const enriched = await Promise.all(
      overrides.map(async (item) => {
        const prof = await ctx.db.get(item.professionalId)
        const room = item.roomId ? await ctx.db.get(item.roomId) : null
        return {
          ...item,
          professionalName: prof?.name || "Profissional",
          roomName: room?.name || "Todas as salas",
        }
      })
    )

    return enriched.sort((a, b) => a.date.localeCompare(b.date))
  },
})

// 5. Salvar Exceção (Bloqueio ou Plantão Extra)
export const saveOverride = mutation({
  args: {
    id: v.optional(v.id("availabilityOverrides")),
    professionalId: v.id("professionals"),
    roomId: v.optional(v.id("rooms")),
    date: v.string(), // YYYY-MM-DD
    type: v.union(v.literal("block"), v.literal("extra")),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    specialty: v.optional(v.union(v.literal("fisioterapia"), v.literal("pilates"), v.literal("rpg"))),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.startTime && args.endTime && args.startTime >= args.endTime) {
      throw new Error("O horário de início deve ser anterior ao término.")
    }

    const payload = {
      professionalId: args.professionalId,
      roomId: args.roomId,
      date: args.date,
      type: args.type,
      startTime: args.startTime,
      endTime: args.endTime,
      specialty: args.specialty,
      reason: args.reason,
      createdAt: Date.now(),
    }

    if (args.id) {
      await ctx.db.patch(args.id, payload)
      return { success: true, id: args.id }
    } else {
      const id = await ctx.db.insert("availabilityOverrides", payload)
      return { success: true, id }
    }
  },
})

// 6. Excluir Exceção
export const deleteOverride = mutation({
  args: {
    id: v.id("availabilityOverrides"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id)
    return { success: true }
  },
})

// 7. Obter Horários Efetivos Disponíveis em uma Data
export const getAvailableSlotsForDate = query({
  args: {
    date: v.string(), // YYYY-MM-DD
    specialty: v.optional(v.union(v.literal("fisioterapia"), v.literal("pilates"), v.literal("rpg"))),
    professionalId: v.optional(v.id("professionals")),
    roomId: v.optional(v.id("rooms")),
  },
  handler: async (ctx, args) => {
    // Determina o dia da semana no fuso de Brasília (UTC-3)
    const dateObj = new Date(`${args.date}T12:00:00-03:00`)
    const dayOfWeek = dateObj.getDay()

    // Busca regras semanais ativas
    let rules = await ctx.db
      .query("availabilityRules")
      .withIndex("by_day_specialty", (q) => q.eq("dayOfWeek", dayOfWeek))
      .collect()

    rules = rules.filter((r) => r.isActive)

    if (args.professionalId) {
      rules = rules.filter((r) => r.professionalId === args.professionalId)
    }
    if (args.roomId) {
      rules = rules.filter((r) => r.roomId === args.roomId)
    }
    if (args.specialty) {
      rules = rules.filter((r) => r.specialty === args.specialty)
    }

    // Busca exceções cadastradas para esta data
    let overrides = await ctx.db
      .query("availabilityOverrides")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .collect()

    if (args.professionalId) {
      overrides = overrides.filter((o) => o.professionalId === args.professionalId)
    }

    const blocks = overrides.filter((o) => o.type === "block")
    const extras = overrides.filter((o) => o.type === "extra")

    // Busca agendamentos existentes na data
    const existingSchedules = await ctx.db
      .query("schedules")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .collect()

    const activeSchedules = existingSchedules.filter((s) => s.status !== "cancelled")

    // Fatiar slots a partir das regras semanais
    const rawSlots: Array<{
      startTime: string
      endTime: string
      roomId: any
      professionalId: any
      specialty: "fisioterapia" | "pilates" | "rpg"
      ruleId?: any
    }> = []

    for (const rule of rules) {
      // Checa se há bloqueio total do dia para esse profissional
      const hasFullDayBlock = blocks.some(
        (b) =>
          b.professionalId === rule.professionalId &&
          (!b.roomId || b.roomId === rule.roomId) &&
          !b.startTime &&
          !b.endTime
      )

      if (hasFullDayBlock) continue

      const slices = sliceTimeWindowIntoSlots(
        rule.startTime,
        rule.endTime,
        rule.slotDurationMinutes || 50,
        rule.breakMinutes || 10
      )

      for (const slice of slices) {
        // Checa se o slot colide com um bloqueio pontual
        const isBlocked = blocks.some(
          (b) =>
            b.professionalId === rule.professionalId &&
            (!b.roomId || b.roomId === rule.roomId) &&
            b.startTime &&
            b.endTime &&
            checkTimeOverlap(slice.start, slice.end, b.startTime, b.endTime)
        )

        if (!isBlocked) {
          rawSlots.push({
            startTime: slice.start,
            endTime: slice.end,
            roomId: rule.roomId,
            professionalId: rule.professionalId,
            specialty: rule.specialty,
            ruleId: rule._id,
          })
        }
      }
    }

    // Adiciona slots de plantões extras
    for (const extra of extras) {
      if (
        args.specialty &&
        extra.specialty &&
        extra.specialty !== args.specialty
      ) {
        continue
      }
      if (extra.startTime && extra.endTime && extra.roomId) {
        const slices = sliceTimeWindowIntoSlots(extra.startTime, extra.endTime, 50, 10)
        for (const slice of slices) {
          rawSlots.push({
            startTime: slice.start,
            endTime: slice.end,
            roomId: extra.roomId,
            professionalId: extra.professionalId,
            specialty: extra.specialty || "fisioterapia",
          })
        }
      }
    }

    // Enriquece com nomes e verifica se já está ocupado
    const slotsWithAvailability = await Promise.all(
      rawSlots.map(async (slot) => {
        const room: any = await ctx.db.get(slot.roomId)
        const prof: any = await ctx.db.get(slot.professionalId)

        // Verifica se há agendamento colidindo nessa sala ou profissional
        const conflictingSchedule = activeSchedules.find(
          (s) =>
            (s.roomId === slot.roomId || s.professionalId === slot.professionalId) &&
            checkTimeOverlap(s.startTime, s.endTime, slot.startTime, slot.endTime)
        )

        const isOccupied = !!conflictingSchedule

        return {
          startTime: slot.startTime,
          endTime: slot.endTime,
          roomId: slot.roomId,
          roomName: room?.name || "Sala",
          roomColor: room?.color || "#10B981",
          capacity: room?.capacity || 1,
          professionalId: slot.professionalId,
          professionalName: prof?.name || "Profissional",
          specialty: slot.specialty,
          isAvailable: !isOccupied,
          occupiedBy: conflictingSchedule ? conflictingSchedule.title : undefined,
        }
      })
    )

    // Ordena por horário de início
    return slotsWithAvailability.sort((a, b) => a.startTime.localeCompare(b.startTime))
  },
})
