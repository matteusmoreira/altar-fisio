import { requireStaff } from './lib/security'
import { query, mutation, internalMutation } from "./_generated/server"
import { ConvexError, v } from "convex/values"
import { DEFAULT_HEALTH_INSURANCE_OPTIONS } from '../shared/healthInsurance'
import { DEFAULT_CLINICAL_SPECIALTIES, slugifySpecialtyId } from '../shared/clinicalSpecialties'
import { validatePortalMessage, messageText } from '../shared/portalMessage'
import { internal } from './_generated/api'

export const updatePortalBooking = mutation({
  args: { sessionToken: v.string(), enabled: v.boolean(), message: v.array(v.object({ type: v.union(v.literal('paragraph'), v.literal('bullet')), runs: v.array(v.object({ text: v.string(), bold: v.optional(v.boolean()), italic: v.optional(v.boolean()), href: v.optional(v.string()) })) })) },
  handler: async (ctx, args) => {
    const actor = await requireStaff(ctx, args.sessionToken, ['admin'])
    const message = validatePortalMessage(args.message)
    if (!args.enabled && !messageText(message)) throw new Error('Informe a mensagem que os pacientes verão.')
    const settings = await ctx.db.query('clinicSettings').first()
    const patch = { portalBookingEnabled: args.enabled, portalBookingMessage: message }
    if (settings) await ctx.db.patch(settings._id, patch)
    else await ctx.db.insert('clinicSettings', { clinicName: 'Clinica Dr Marcelo', clinicSubtitle: '', primaryColor: '#10b981', colorPreset: 'emerald', mode: 'light', cancellationNoticeHours: 2, replacementExpiryDays: 30, ...patch })
    await ctx.db.insert('auditLogs', { action: 'update_portal_booking', userName: actor.name, userRole: actor.role, details: `Reservas no portal: ${args.enabled ? 'abertas' : 'fechadas'}. Mensagem atualizada.`, timestamp: Date.now() })
    if (args.enabled && settings?.portalBookingEnabled === false) await ctx.scheduler.runAfter(0, internal.waitlist.resume, { cursor: null })
  },
})

export const getSettings = query({
  handler: async (ctx) => {
    const settings = await ctx.db.query("clinicSettings").first()
    if (!settings) return null

    let logoUrl = settings.logoUrl
    if (settings.logoStorageId) {
      const storageUrl = await ctx.storage.getUrl(settings.logoStorageId)
      if (storageUrl) {
        logoUrl = storageUrl
      }
    } else if (logoUrl?.startsWith("blob:")) {
      logoUrl = undefined
    }

    return {
      clinicName: settings.clinicName,
      clinicSubtitle: settings.clinicSubtitle,
      primaryColor: settings.primaryColor,
      colorPreset: settings.colorPreset,
      mode: settings.mode,
      phone: settings.phone,
      address: settings.address,
      cnpj: settings.cnpj,
      cancellationNoticeHours: settings.cancellationNoticeHours,
      replacementExpiryDays: settings.replacementExpiryDays,
      logoUrl,
    }
  },
})

export const getAdminSettings = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken, ['admin'])
    const settings = await ctx.db.query('clinicSettings').first()
    if (!settings) return null
    const { uazapiToken, uazapiAdminToken, activeWhatsappInstanceToken, resendApiKey, ...safe } = settings
    return { ...safe,
      logoUrl: settings.logoStorageId
        ? (await ctx.storage.getUrl(settings.logoStorageId)) ?? undefined
        : (settings.logoUrl?.startsWith("blob:") ? undefined : settings.logoUrl),
      uazapiConfigured: Boolean(uazapiToken || activeWhatsappInstanceToken),
      uazapiAdminConfigured: Boolean(uazapiAdminToken), resendConfigured: Boolean(resendApiKey),
    }
  },
})

export const getNotificationSettings = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken, ['admin', 'reception'])
    const settings = await ctx.db.query('clinicSettings').first()
    return { activeConfirmationTemplateId: settings?.activeConfirmationTemplateId, activeReminder24hTemplateId: settings?.activeReminder24hTemplateId, activeReminder2hTemplateId: settings?.activeReminder2hTemplateId, activeReminder1hTemplateId: settings?.activeReminder1hTemplateId, activeReminder30mTemplateId: settings?.activeReminder30mTemplateId, activeWaitlistTemplateId: settings?.activeWaitlistTemplateId }
  },
})

export const getHealthInsuranceOptions = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken, ['admin', 'professional', 'reception'])
    const settings = await ctx.db.query('clinicSettings').first()
    return settings?.healthInsuranceOptions ?? [...DEFAULT_HEALTH_INSURANCE_OPTIONS]
  },
})

export const updateHealthInsuranceOptions = mutation({
  args: { sessionToken: v.string(), options: v.array(v.string()) },
  handler: async (ctx, input) => {
    await requireStaff(ctx, input.sessionToken, ['admin'])

    const options = input.options
      .map((option) => option.trim())
      .filter(Boolean)
      .filter((option, index, all) =>
        all.findIndex((item) => item.toLowerCase() === option.toLowerCase()) === index
      )

    const settings = await ctx.db.query('clinicSettings').first()
    if (settings) {
      await ctx.db.patch(settings._id, { healthInsuranceOptions: options })
      return options
    }

    await ctx.db.insert('clinicSettings', {
      clinicName: 'Clinica Dr Marcelo',
      clinicSubtitle: 'Dr. Marcelo - Fisio, Pilates & RPG',
      primaryColor: '#10b981',
      colorPreset: 'emerald',
      mode: 'light',
      cancellationNoticeHours: 2,
      replacementExpiryDays: 30,
      healthInsuranceOptions: options,
    })
    return options
  },
})

export const getPatientCustomFields = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken, ['admin', 'professional', 'reception'])
    const settings = await ctx.db.query('clinicSettings').first()
    return settings?.patientCustomFields ?? []
  },
})

export const updatePatientCustomFields = mutation({
  args: {
    sessionToken: v.string(),
    fields: v.array(
      v.object({
        id: v.string(),
        label: v.string(),
        type: v.union(
          v.literal("text"),
          v.literal("number"),
          v.literal("date"),
          v.literal("select")
        ),
        options: v.optional(v.array(v.string())),
      })
    ),
  },
  handler: async (ctx, input) => {
    await requireStaff(ctx, input.sessionToken, ['admin', 'reception'])

    const sanitized = input.fields
      .map((f) => ({
        id: f.id.trim() || `field_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        label: f.label.trim(),
        type: f.type,
        options: f.type === 'select' && f.options
          ? f.options.map((o) => o.trim()).filter(Boolean)
          : undefined,
      }))
      .filter((f) => Boolean(f.label))

    const settings = await ctx.db.query('clinicSettings').first()
    if (settings) {
      await ctx.db.patch(settings._id, { patientCustomFields: sanitized })
      return sanitized
    }

    await ctx.db.insert('clinicSettings', {
      clinicName: 'Clinica Dr Marcelo',
      clinicSubtitle: 'Dr. Marcelo - Fisio, Pilates & RPG',
      primaryColor: '#10b981',
      colorPreset: 'emerald',
      mode: 'light',
      cancellationNoticeHours: 2,
      replacementExpiryDays: 30,
      patientCustomFields: sanitized,
    })
    return sanitized
  },
})

export const getClinicalSpecialties = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.sessionToken) {
      await requireStaff(ctx, args.sessionToken, ['admin', 'professional', 'reception'])
    }
    const settings = await ctx.db.query('clinicSettings').first()
    return settings?.clinicalSpecialties ?? [...DEFAULT_CLINICAL_SPECIALTIES]
  },
})

export const updateClinicalSpecialties = mutation({
  args: {
    sessionToken: v.string(),
    specialties: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        description: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, input) => {
    const actor = await requireStaff(ctx, input.sessionToken, ['admin'])

    const seenIds = new Set<string>()
    const sanitized: Array<{ id: string; name: string; description?: string }> = []

    for (const item of input.specialties) {
      const name = item.name.trim()
      if (!name) continue
      let id = item.id.trim() || slugifySpecialtyId(name)
      if (seenIds.has(id.toLowerCase())) {
        let counter = 2
        while (seenIds.has(`${id.toLowerCase()}_${counter}`)) {
          counter++
        }
        id = `${id}_${counter}`
      }
      seenIds.add(id.toLowerCase())
      sanitized.push({
        id,
        name,
        ...(item.description?.trim() ? { description: item.description.trim() } : {}),
      })
    }

    if (sanitized.length === 0) {
      throw new ConvexError('A clínica deve possuir pelo menos uma especialidade clínica cadastrada.')
    }

    const settings = await ctx.db.query('clinicSettings').first()
    if (settings) {
      await ctx.db.patch(settings._id, { clinicalSpecialties: sanitized })
    } else {
      await ctx.db.insert('clinicSettings', {
        clinicName: 'Clinica Dr Marcelo',
        clinicSubtitle: 'Dr. Marcelo - Fisio, Pilates & RPG',
        primaryColor: '#10b981',
        colorPreset: 'emerald',
        mode: 'light',
        cancellationNoticeHours: 2,
        replacementExpiryDays: 30,
        clinicalSpecialties: sanitized,
      })
    }

    await ctx.db.insert('auditLogs', {
      action: 'update_clinical_specialties',
      userName: actor.name,
      userRole: actor.role,
      details: `Especialidades clínicas atualizadas (${sanitized.length} cadastradas).`,
      timestamp: Date.now(),
    })

    return sanitized
  },
})

// Gera URL segura e temporária para upload direto no Convex File Storage
export const generateUploadUrl = mutation({
  args: { sessionToken: v.string(), },
  handler: async (ctx, input) => {
    const { sessionToken, ...args } = input
    await requireStaff(ctx, sessionToken, ["admin"]);

    return await ctx.storage.generateUploadUrl()
  },
})

export const updateSettings = mutation({
  args: { sessionToken: v.string(),
    clinicName: v.string(),
    clinicSubtitle: v.string(),
    primaryColor: v.string(),
    colorPreset: v.string(),
    mode: v.union(v.literal("light"), v.literal("dark")),
    logoUrl: v.optional(v.string()),
    logoStorageId: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    cnpj: v.optional(v.string()),
    cancellationNoticeHours: v.number(),
    replacementExpiryDays: v.number(),
    uazapiEndpoint: v.optional(v.string()),
    uazapiToken: v.optional(v.string()),
    uazapiAdminToken: v.optional(v.string()),
    uazapiInstanceId: v.optional(v.string()),
    activeWhatsappInstanceToken: v.optional(v.string()),
    resendApiKey: v.optional(v.string()),
    resendFromEmail: v.optional(v.string()),
  },
  handler: async (ctx, input) => {
    const { sessionToken, ...args } = input
    await requireStaff(ctx, sessionToken, ["admin"]);

    for (const key of ['uazapiToken', 'uazapiAdminToken', 'activeWhatsappInstanceToken', 'resendApiKey'] as const) {
      if (!args[key]?.trim()) delete args[key]
    }
    if (args.uazapiEndpoint) {
      const url = new URL(args.uazapiEndpoint)
      if (url.protocol !== 'https:' || !url.hostname.endsWith('.uazapi.com') || url.username || url.password || url.port || url.search || url.hash) throw new Error('Use um endpoint HTTPS oficial da UAZAPI.')
      args.uazapiEndpoint = url.origin
    }
    if (!Number.isFinite(args.cancellationNoticeHours) || args.cancellationNoticeHours < 0 || !Number.isInteger(args.replacementExpiryDays) || args.replacementExpiryDays < 1) throw new Error('Regras de cancelamento inválidas.')
    if (args.logoUrl?.startsWith("blob:")) {
      delete args.logoUrl
    }
    if (args.logoStorageId) {
      delete args.logoUrl
    }

    const existing = await ctx.db.query("clinicSettings").first()
    if (existing) {
      // Se a logoStorageId mudou ou foi limpa, deletar o arquivo antigo do storage
      if (
        existing.logoStorageId &&
        args.logoStorageId !== undefined &&
        existing.logoStorageId !== args.logoStorageId
      ) {
        await ctx.storage.delete(existing.logoStorageId).catch(() => {})
      }

      const patchData: any = { ...args }
      // Se temos logoStorageId ou o logoUrl anterior era um blob temporário, limpa no banco
      if (args.logoStorageId || (args.logoStorageId === undefined && existing.logoStorageId)) {
        if (existing.logoUrl?.startsWith("blob:") || args.logoUrl?.startsWith("blob:")) {
          patchData.logoUrl = undefined
        }
      }

      await ctx.db.patch(existing._id, patchData)
      return existing._id
    } else {
      return await ctx.db.insert("clinicSettings", args)
    }
  },
})

// Remove logotipo e limpa o arquivo do Convex Storage
export const removeLogo = mutation({
  args: { sessionToken: v.string(), },
  handler: async (ctx, input) => {
    const { sessionToken, ...args } = input
    await requireStaff(ctx, sessionToken, ["admin"]);

    const existing = await ctx.db.query("clinicSettings").first()
    if (!existing) return false

    if (existing.logoStorageId) {
      await ctx.storage.delete(existing.logoStorageId).catch(() => {})
    }

    await ctx.db.patch(existing._id, {
      logoUrl: undefined,
      logoStorageId: undefined,
    })
    return true
  },
})

export const updateClinicNameInternal = internalMutation({
  args: { clinicName: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("clinicSettings").first()
    if (existing) {
      await ctx.db.patch(existing._id, { clinicName: args.clinicName })
      return existing._id
    } else {
      return await ctx.db.insert("clinicSettings", {
        clinicName: args.clinicName,
        clinicSubtitle: "Dr. Marcelo - Fisioterapia, Pilates & RPG",
        primaryColor: "#10b981",
        colorPreset: "emerald",
        mode: "light",
        cancellationNoticeHours: 2,
        replacementExpiryDays: 30,
      })
    }
  },
})

