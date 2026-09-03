import { query, mutation, action, internalQuery, internalMutation, type ActionCtx } from "./_generated/server"
import { internal } from "./_generated/api"
import { v } from "convex/values"

// ============================================================================
// HELPERS DE CONFIGURAÇÃO E FORMATAÇÃO
// ============================================================================

const DEFAULT_SERVER_URL = "https://whatpress.uazapi.com"
const DEFAULT_ADMIN_TOKEN = "jJRMdT508DTwShzdWcuxSHvIEiSDdyuIQXwj3j6XRqr5uktfV7"

export function sanitizeUazapiEndpoint(rawUrl?: string): string {
  if (!rawUrl || typeof rawUrl !== "string") return DEFAULT_SERVER_URL
  let clean = rawUrl.trim()
  if (!clean) return DEFAULT_SERVER_URL

  // Se o endpoint legado ou placeholder api.uazapi.com foi informado, substitui pelo servidor oficial
  if (clean.includes("api.uazapi.com")) {
    return DEFAULT_SERVER_URL
  }

  // Remove barras e sufixos de rota como /v1, /api, /instance etc.
  clean = clean.replace(/\/+$/, "")
  clean = clean.replace(/\/(v1|api|instance(\/.*)?)$/i, "")
  clean = clean.replace(/\/+$/, "")

  if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
    clean = `https://${clean}`
  }

  return clean
}

export function sanitizeAdminToken(rawToken?: string): string {
  if (!rawToken || typeof rawToken !== "string" || !rawToken.trim()) {
    return DEFAULT_ADMIN_TOKEN
  }
  return rawToken.trim()
}

export function formatBrazilianPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    return digits
  }
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`
  }
  return digits.startsWith("55") ? digits : `55${digits}`
}

export function normalizeWhatsAppText(text: string): string {
  if (!text) return ""
  return text
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
}

export function interpolateText(text: string, vars: Record<string, string>): string {
  let result = normalizeWhatsAppText(text)
  for (const [key, val] of Object.entries(vars)) {
    const reg = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "gi")
    result = result.replace(reg, val ? normalizeWhatsAppText(val) : "")
  }
  return normalizeWhatsAppText(result)
}

// ============================================================================
// CLIENTE HTTP UAZAPI (SEGURO E COM TRATAMENTO DE ERROS)
// ============================================================================

async function fetchUazapi(
  url: string,
  options: {
    method?: string
    headers?: Record<string, string>
    body?: any
    timeoutMs?: number
  } = {}
) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs || 12000)

  try {
    const res = await fetch(url, {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    const text = await res.text()
    let data: any = null
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }

    return {
      ok: res.ok,
      status: res.status,
      data,
    }
  } catch (err: any) {
    clearTimeout(timeoutId)
    return {
      ok: false,
      status: 0,
      data: null,
      error: err?.name === "AbortError" ? "Timeout de conexão com o servidor UAZAPI" : err?.message || "Erro desconhecido",
    }
  }
}

// ============================================================================
// QUERIES E INTERNAL MUTATIONS DE APOIO
// ============================================================================

export const getClinicSettingsInternal = internalQuery({
  handler: async (ctx) => {
    return await ctx.db.query("clinicSettings").first()
  },
})

export const getInstancesInternal = internalQuery({
  handler: async (ctx) => {
    return await ctx.db.query("whatsappInstances").collect()
  },
})

export const getInstanceByTokenInternal = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("whatsappInstances")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first()
  },
})

export const getDefaultInstanceInternal = internalQuery({
  handler: async (ctx) => {
    // 1. Instância default QUE ESTEJA conectada
    const defaultConnected = await ctx.db
      .query("whatsappInstances")
      .withIndex("by_default", (q) => q.eq("isDefault", true))
      .filter((q) => q.eq(q.field("status"), "connected"))
      .first()
    if (defaultConnected) return defaultConnected

    // 2. Qualquer outra instância conectada
    const anyConnected = await ctx.db
      .query("whatsappInstances")
      .withIndex("by_status", (q) => q.eq("status", "connected"))
      .first()
    if (anyConnected) return anyConnected

    // 3. Fallback: instância marcada como default mesmo que desconectada
    const defaultInst = await ctx.db
      .query("whatsappInstances")
      .withIndex("by_default", (q) => q.eq("isDefault", true))
      .first()
    if (defaultInst) return defaultInst

    // 4. Último fallback: qualquer instância cadastrada
    return await ctx.db.query("whatsappInstances").first()
  },
})

export const upsertInstanceInternal = internalMutation({
  args: {
    name: v.string(),
    instanceId: v.string(),
    token: v.string(),
    status: v.union(v.literal("connected"), v.literal("disconnected"), v.literal("connecting")),
    profileName: v.optional(v.string()),
    profilePicUrl: v.optional(v.string()),
    ownerNumber: v.optional(v.string()),
    qrcode: v.optional(v.string()),
    isDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("whatsappInstances")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first()

    const all = await ctx.db.query("whatsappInstances").collect()
    const isFirst = all.length === 0
    const shouldBeDefault = args.isDefault ?? (existing ? existing.isDefault : isFirst)

    if (shouldBeDefault) {
      for (const inst of all) {
        if (!existing || inst._id !== existing._id) {
          await ctx.db.patch(inst._id, { isDefault: false })
        }
      }
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name || existing.name,
        instanceId: args.instanceId || existing.instanceId,
        status: args.status,
        profileName: args.profileName ?? existing.profileName,
        profilePicUrl: args.profilePicUrl ?? existing.profilePicUrl,
        ownerNumber: args.ownerNumber ?? existing.ownerNumber,
        qrcode: args.qrcode ?? existing.qrcode,
        isDefault: shouldBeDefault,
        updatedAt: Date.now(),
      })
      return existing._id
    }

    return await ctx.db.insert("whatsappInstances", {
      name: args.name,
      instanceId: args.instanceId,
      token: args.token,
      status: args.status,
      profileName: args.profileName,
      profilePicUrl: args.profilePicUrl,
      ownerNumber: args.ownerNumber,
      qrcode: args.qrcode,
      isDefault: shouldBeDefault,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  },
})

export const updateInstanceStatusInternal = internalMutation({
  args: {
    token: v.string(),
    status: v.union(v.literal("connected"), v.literal("disconnected"), v.literal("connecting")),
    qrcode: v.optional(v.string()),
    profileName: v.optional(v.string()),
    profilePicUrl: v.optional(v.string()),
    ownerNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const inst = await ctx.db
      .query("whatsappInstances")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first()

    if (inst) {
      await ctx.db.patch(inst._id, {
        status: args.status,
        qrcode: args.qrcode !== undefined ? args.qrcode : inst.qrcode,
        profileName: args.profileName ?? inst.profileName,
        profilePicUrl: args.profilePicUrl ?? inst.profilePicUrl,
        ownerNumber: args.ownerNumber ?? inst.ownerNumber,
        updatedAt: Date.now(),
      })
    }
  },
})

export const removeInstanceInternal = internalMutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const inst = await ctx.db
      .query("whatsappInstances")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first()

    if (inst) {
      await ctx.db.delete(inst._id)
      // Se era a padrão, torna a próxima conectada em padrão
      if (inst.isDefault) {
        const remaining = await ctx.db.query("whatsappInstances").first()
        if (remaining) {
          await ctx.db.patch(remaining._id, { isDefault: true })
        }
      }
    }
  },
})

// ============================================================================
// QUERIES PÚBLICAS DE INSTÂNCIAS
// ============================================================================

export const listInstances = query({
  handler: async (ctx) => {
    return await ctx.db.query("whatsappInstances").order("desc").collect()
  },
})

export const setDefaultInstance = mutation({
  args: { instanceId: v.id("whatsappInstances") },
  handler: async (ctx, args) => {
    const target = await ctx.db.get(args.instanceId)
    if (!target) throw new Error("Instância não encontrada")

    const all = await ctx.db.query("whatsappInstances").collect()
    for (const inst of all) {
      await ctx.db.patch(inst._id, { isDefault: inst._id === args.instanceId })
    }

    const settings = await ctx.db.query("clinicSettings").first()
    if (settings) {
      await ctx.db.patch(settings._id, {
        activeWhatsappInstanceToken: target.token,
        uazapiInstanceId: target.name,
      })
    }

    return { success: true }
  },
})

// ============================================================================
// ACTIONS DE GERENCIAMENTO DE INSTÂNCIAS (UAZAPI GO)
// ============================================================================

export const createInstanceAction = action({
  args: { name: v.string() },
  handler: async (ctx, args): Promise<{ success: boolean; instance?: any; error?: string }> => {
    const settings: any = await ctx.runQuery(internal.whatsapp.getClinicSettingsInternal, {})
    const baseUrl = sanitizeUazapiEndpoint(settings?.uazapiEndpoint)
    const adminToken = sanitizeAdminToken(settings?.uazapiAdminToken)

    // 1. Cria a instância via POST /instance/create
    const createRes = await fetchUazapi(`${baseUrl}/instance/create`, {
      method: "POST",
      headers: { admintoken: adminToken },
      body: { name: args.name.trim() },
    })

    if (!createRes.ok || !createRes.data) {
      return {
        success: false,
        error: typeof createRes.data === "object" ? createRes.data?.error || "Erro ao criar instância na Uazapi" : createRes.error || "Erro desconhecido na Uazapi",
      }
    }

    const created = createRes.data
    const token = created.token || created.instance?.token
    const id = created.id || created.instance?.id || created.name || args.name

    if (!token) {
      return { success: false, error: "Token não retornado pela API da Uazapi." }
    }

    // 2. Tenta conectar imediatamente para gerar QR Code
    let qrcode: string | undefined = undefined
    let status: "connected" | "disconnected" | "connecting" = "connecting"

    const connectRes = await fetchUazapi(`${baseUrl}/instance/connect`, {
      method: "POST",
      headers: { token },
      body: {},
    })

    if (connectRes.ok && connectRes.data) {
      qrcode = connectRes.data.qrcode || connectRes.data.base64 || connectRes.data.instance?.qrcode
      if (connectRes.data.status === "connected" || connectRes.data.loggedIn) {
        status = "connected"
      }
    }

    // 3. Salva no banco Convex
    await ctx.runMutation(internal.whatsapp.upsertInstanceInternal, {
      name: args.name.trim(),
      instanceId: id,
      token,
      status,
      qrcode,
    })

    return {
      success: true,
      instance: {
        id,
        name: args.name,
        token,
        status,
        qrcode,
      },
    }
  },
})

export const listServerInstancesAction = action({
  args: {},
  handler: async (ctx): Promise<{ success: boolean; instances?: any[]; error?: string }> => {
    const settings: any = await ctx.runQuery(internal.whatsapp.getClinicSettingsInternal, {})
    const baseUrl = sanitizeUazapiEndpoint(settings?.uazapiEndpoint)
    const adminToken = sanitizeAdminToken(settings?.uazapiAdminToken)

    const res = await fetchUazapi(`${baseUrl}/instance/all`, {
      headers: { admintoken: adminToken },
    })

    if (!res.ok || !Array.isArray(res.data)) {
      return {
        success: false,
        error: res.error || "Falha ao listar instâncias do servidor UAZAPI",
      }
    }

    // Identifica quais já estão cadastradas localmente
    const localInstances: any[] = await ctx.runQuery(internal.whatsapp.getInstancesInternal, {})
    const localTokenSet = new Set(localInstances.map((i) => i.token))

    const mapped = res.data.map((inst: any) => ({
      id: inst.id,
      name: inst.name,
      token: inst.token,
      status: inst.status === "connected" ? "connected" : inst.status === "connecting" ? "connecting" : "disconnected",
      owner: inst.owner,
      profileName: inst.profileName,
      profilePicUrl: inst.profilePicUrl,
      isLinkedLocally: localTokenSet.has(inst.token),
    }))

    return {
      success: true,
      instances: mapped,
    }
  },
})

export const connectExistingTokenAction = action({
  args: {
    name: v.optional(v.string()),
    token: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; instance?: any; error?: string }> => {
    const settings: any = await ctx.runQuery(internal.whatsapp.getClinicSettingsInternal, {})
    const baseUrl = sanitizeUazapiEndpoint(settings?.uazapiEndpoint)
    const adminToken = sanitizeAdminToken(settings?.uazapiAdminToken)
    const rawInput = args.token.trim()

    let effectiveToken = rawInput
    let instanceName = args.name?.trim()

    // 1. Tenta validar diretamente como token via GET /instance/status
    let statusRes = await fetchUazapi(`${baseUrl}/instance/status`, {
      headers: { token: effectiveToken },
    })

    // 2. Se falhar (ex: usuário digitou nome da instância "drmarcelo", ID "raf314..." ou token com divergência),
    // consulta a lista oficial de instâncias do servidor via admintoken para encontrar a instância correspondente
    if (!statusRes.ok) {
      const allRes = await fetchUazapi(`${baseUrl}/instance/all`, {
        headers: { admintoken: adminToken },
      })

      if (allRes.ok && Array.isArray(allRes.data)) {
        const found = allRes.data.find(
          (inst: any) =>
            inst.token === rawInput ||
            inst.id === rawInput ||
            inst.name?.toLowerCase() === rawInput.toLowerCase() ||
            (inst.token && rawInput.length >= 8 && inst.token.includes(rawInput)) ||
            (inst.name && rawInput.length >= 3 && inst.name.toLowerCase().includes(rawInput.toLowerCase()))
        )

        if (found && found.token) {
          effectiveToken = found.token
          if (!instanceName) instanceName = found.name
          statusRes = await fetchUazapi(`${baseUrl}/instance/status`, {
            headers: { token: effectiveToken },
          })
        }
      }
    }

    if (!statusRes.ok) {
      return {
        success: false,
        error: `Não foi possível localizar ou autenticar a instância na UAZAPI (HTTP ${statusRes.status}). Verifique o token ou selecione diretamente na lista de instâncias disponíveis do servidor.`,
      }
    }

    const info = statusRes.data?.instance || {}
    const conn = statusRes.data?.status || {}

    const resolvedName = instanceName || info.name || "Instância WhatsApp"
    const instanceId = info.id || "inst_" + effectiveToken.slice(0, 8)
    const isConnected = conn.connected === true || conn.loggedIn === true || info.status === "connected"
    let status: "connected" | "disconnected" | "connecting" = isConnected ? "connected" : "disconnected"
    let qrcode = info.qrcode || ""

    // Se estiver desconectado, chama POST /instance/connect para tentar puxar o QR code
    if (!isConnected) {
      const connRes = await fetchUazapi(`${baseUrl}/instance/connect`, {
        method: "POST",
        headers: { token: effectiveToken },
        body: {},
      })
      if (connRes.ok && connRes.data) {
        qrcode = connRes.data.qrcode || connRes.data.base64 || connRes.data.instance?.qrcode || qrcode
        status = "connecting"
      }
    }

    // Salva ou atualiza no banco
    await ctx.runMutation(internal.whatsapp.upsertInstanceInternal, {
      name: resolvedName,
      instanceId,
      token: effectiveToken,
      status,
      profileName: info.profileName,
      profilePicUrl: info.profilePicUrl,
      ownerNumber: info.owner,
      qrcode: qrcode || undefined,
    })

    return {
      success: true,
      instance: {
        name: resolvedName,
        token: effectiveToken,
        status,
        profileName: info.profileName,
        profilePicUrl: info.profilePicUrl,
        ownerNumber: info.owner,
        qrcode,
      },
    }
  },
})

export const checkInstanceStatusAction = action({
  args: { token: v.string() },
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean
    connected: boolean
    status: string
    profileName?: string
    profilePicUrl?: string
    owner?: string
  }> => {
    const settings: any = await ctx.runQuery(internal.whatsapp.getClinicSettingsInternal, {})
    const baseUrl = sanitizeUazapiEndpoint(settings?.uazapiEndpoint)

    const res = await fetchUazapi(`${baseUrl}/instance/status`, {
      headers: { token: args.token },
    })

    if (!res.ok || !res.data) {
      return { success: false, connected: false, status: "error" }
    }

    const info = res.data.instance || {}
    const conn = res.data.status || {}
    const isConnected = conn.connected === true || conn.loggedIn === true || info.status === "connected"
    const status = isConnected ? "connected" : "disconnected"

    await ctx.runMutation(internal.whatsapp.updateInstanceStatusInternal, {
      token: args.token,
      status,
      qrcode: isConnected ? "" : info.qrcode,
      profileName: info.profileName,
      profilePicUrl: info.profilePicUrl,
      ownerNumber: info.owner,
    })

    return {
      success: true,
      connected: isConnected,
      status,
      profileName: info.profileName,
      profilePicUrl: info.profilePicUrl,
      owner: info.owner,
    }
  },
})

export const getQrCodeAction = action({
  args: { token: v.string() },
  handler: async (ctx, args): Promise<{ success: boolean; qrcode?: string; status?: string; error?: string }> => {
    const settings: any = await ctx.runQuery(internal.whatsapp.getClinicSettingsInternal, {})
    const baseUrl = sanitizeUazapiEndpoint(settings?.uazapiEndpoint)

    // 1. Primeiro verifica se já conectou
    const statusCheck = await fetchUazapi(`${baseUrl}/instance/status`, {
      headers: { token: args.token },
    })
    if (statusCheck.ok && statusCheck.data) {
      const conn = statusCheck.data.status || {}
      const info = statusCheck.data.instance || {}
      if (conn.connected === true || conn.loggedIn === true || info.status === "connected") {
        await ctx.runMutation(internal.whatsapp.updateInstanceStatusInternal, {
          token: args.token,
          status: "connected",
          qrcode: "",
          profileName: info.profileName,
          profilePicUrl: info.profilePicUrl,
          ownerNumber: info.owner,
        })
        return {
          success: true,
          status: "connected",
          qrcode: "",
        }
      }
    }

    // 2. Dispara conexão para gerar novo QR Code
    const connRes = await fetchUazapi(`${baseUrl}/instance/connect`, {
      method: "POST",
      headers: { token: args.token },
      body: {},
    })

    if (!connRes.ok || !connRes.data) {
      return { success: false, error: connRes.error || "Falha ao gerar QR Code" }
    }

    const qrcode = connRes.data.qrcode || connRes.data.base64 || connRes.data.instance?.qrcode
    const isConn = connRes.data.status === "connected" || connRes.data.loggedIn === true
    const status = isConn ? "connected" : "connecting"

    await ctx.runMutation(internal.whatsapp.updateInstanceStatusInternal, {
      token: args.token,
      status: status as any,
      qrcode: qrcode || undefined,
    })

    return {
      success: true,
      qrcode,
      status,
    }
  },
})

export const syncAllInstancesStatusAction = action({
  args: {},
  handler: async (ctx): Promise<{ count: number }> => {
    const settings: any = await ctx.runQuery(internal.whatsapp.getClinicSettingsInternal, {})
    const baseUrl = sanitizeUazapiEndpoint(settings?.uazapiEndpoint)
    const instances: any[] = await ctx.runQuery(internal.whatsapp.getInstancesInternal, {})

    let count = 0
    for (const inst of instances) {
      const res = await fetchUazapi(`${baseUrl}/instance/status`, {
        headers: { token: inst.token },
      })
      if (res.ok && res.data) {
        const info = res.data.instance || {}
        const conn = res.data.status || {}
        const isConnected = conn.connected === true || conn.loggedIn === true || info.status === "connected"
        const status = isConnected ? "connected" : "disconnected"

        await ctx.runMutation(internal.whatsapp.updateInstanceStatusInternal, {
          token: inst.token,
          status,
          qrcode: isConnected ? "" : info.qrcode,
          profileName: info.profileName,
          profilePicUrl: info.profilePicUrl,
          ownerNumber: info.owner,
        })
        count++
      }
    }

    return { count }
  },
})

export const disconnectInstanceAction = action({
  args: { token: v.string() },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    const settings: any = await ctx.runQuery(internal.whatsapp.getClinicSettingsInternal, {})
    const baseUrl = sanitizeUazapiEndpoint(settings?.uazapiEndpoint)

    const res = await fetchUazapi(`${baseUrl}/instance/disconnect`, {
      method: "POST",
      headers: { token: args.token },
      body: {},
    })

    await ctx.runMutation(internal.whatsapp.updateInstanceStatusInternal, {
      token: args.token,
      status: "disconnected",
      qrcode: "",
    })

    return { success: res.ok, error: res.ok ? undefined : res.error }
  },
})

export const deleteInstanceAction = action({
  args: { token: v.string() },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    const settings: any = await ctx.runQuery(internal.whatsapp.getClinicSettingsInternal, {})
    const baseUrl = sanitizeUazapiEndpoint(settings?.uazapiEndpoint)

    // 1. Deleta na Uazapi
    const res = await fetchUazapi(`${baseUrl}/instance`, {
      method: "DELETE",
      headers: { token: args.token },
    })

    // 2. Remove do banco independente do resultado da API externa
    await ctx.runMutation(internal.whatsapp.removeInstanceInternal, { token: args.token })

    return { success: true }
  },
})

// ============================================================================
// TEMPLATES INTERATIVOS (CRUD & ASSOCIAÇÃO)
// ============================================================================

export const listTemplates = query({
  args: {
    category: v.optional(
      v.union(
        v.literal("reminder_24h"),
        v.literal("reminder_2h"),
        v.literal("booking_confirmation"),
        v.literal("broadcast"),
        v.literal("custom")
      )
    ),
  },
  handler: async (ctx, args) => {
    let templates = await ctx.db.query("messageTemplates").order("desc").collect()
    if (args.category) {
      templates = templates.filter((t) => t.category === args.category)
    }
    return templates
  },
})

export const getTemplateByIdInternal = internalQuery({
  args: { id: v.id("messageTemplates") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
  },
})

export const saveTemplate = mutation({
  args: {
    id: v.optional(v.id("messageTemplates")),
    title: v.string(),
    type: v.union(v.literal("text"), v.literal("button"), v.literal("list"), v.literal("carousel")),
    content: v.string(),
    footerText: v.optional(v.string()),
    buttons: v.optional(
      v.array(
        v.object({
          text: v.string(),
          actionType: v.union(v.literal("reply"), v.literal("url")),
          payload: v.string(),
        })
      )
    ),
    listButtonText: v.optional(v.string()),
    listSections: v.optional(
      v.array(
        v.object({
          title: v.string(),
          rows: v.array(
            v.object({
              title: v.string(),
              description: v.optional(v.string()),
              rowId: v.string(),
            })
          ),
        })
      )
    ),
    carouselCards: v.optional(
      v.array(
        v.object({
          title: v.string(),
          description: v.string(),
          imageUrl: v.string(),
          buttonText: v.string(),
          buttonType: v.union(v.literal("reply"), v.literal("url")),
          buttonPayload: v.string(),
        })
      )
    ),
    category: v.union(
      v.literal("reminder_24h"),
      v.literal("reminder_2h"),
      v.literal("booking_confirmation"),
      v.literal("broadcast"),
      v.literal("custom")
    ),
    isSystemDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...data } = args
    const cleanContent = normalizeWhatsAppText(data.content)
    const cleanFooter = data.footerText ? normalizeWhatsAppText(data.footerText) : undefined

    if (id) {
      await ctx.db.patch(id, {
        ...data,
        content: cleanContent,
        footerText: cleanFooter,
        updatedAt: Date.now(),
      })
      return id
    }

    return await ctx.db.insert("messageTemplates", {
      ...data,
      content: cleanContent,
      footerText: cleanFooter,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  },
})

export const deleteTemplate = mutation({
  args: { id: v.id("messageTemplates") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id)
  },
})

export const assignReminderTemplate = mutation({
  args: {
    target: v.union(v.literal("reminder_24h"), v.literal("reminder_2h"), v.literal("booking_confirmation")),
    templateId: v.optional(v.id("messageTemplates")),
  },
  handler: async (ctx, args) => {
    const settings = await ctx.db.query("clinicSettings").first()
    if (!settings) throw new Error("Configurações não encontradas")

    if (args.target === "reminder_24h") {
      await ctx.db.patch(settings._id, { activeReminder24hTemplateId: args.templateId })
    } else if (args.target === "reminder_2h") {
      await ctx.db.patch(settings._id, { activeReminder2hTemplateId: args.templateId })
    } else if (args.target === "booking_confirmation") {
      await ctx.db.patch(settings._id, { activeConfirmationTemplateId: args.templateId })
    }
    return { success: true }
  },
})

// ============================================================================
// HELPER PARA DISPARO DE MENSAGEM VIA UAZAPI (TEXTO, BOTÃO, LISTA OU CARROSSEL)
// ============================================================================

export async function sendUazapiInteractiveMessage(
  baseUrl: string,
  token: string,
  phone: string,
  template: {
    type: "text" | "button" | "list" | "carousel"
    content: string
    footerText?: string
    buttons?: Array<{ text: string; actionType: "reply" | "url"; payload: string }>
    listButtonText?: string
    listSections?: Array<{ title: string; rows: Array<{ title: string; description?: string; rowId: string }> }>
    carouselCards?: Array<{ title: string; description: string; imageUrl: string; buttonText: string; buttonType: "reply" | "url"; buttonPayload: string }>
  },
  variables: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
  const formattedPhone = formatBrazilianPhone(phone)
  const interpolatedContent = interpolateText(template.content, variables)
  const footer = template.footerText ? interpolateText(template.footerText, variables) : undefined

  // 1. Texto Puro
  if (template.type === "text" || (!template.buttons?.length && !template.carouselCards?.length && !template.listSections?.length)) {
    const res = await fetchUazapi(`${baseUrl}/send/text`, {
      method: "POST",
      headers: { token },
      body: {
        number: formattedPhone,
        text: interpolatedContent,
      },
    })
    return { success: res.ok, error: res.ok ? undefined : res.error || "Falha no envio de texto" }
  }

  // 2. Botões Interativos (POST /send/menu type: "button")
  if (template.type === "button" && template.buttons?.length) {
    const choices = template.buttons.map((b) => {
      const btnText = interpolateText(b.text, variables)
      if (b.actionType === "url") {
        return `${btnText}|${b.payload}`
      }
      return `${btnText}|reply:${b.payload || btnText}`
    })

    const res = await fetchUazapi(`${baseUrl}/send/menu`, {
      method: "POST",
      headers: { token },
      body: {
        number: formattedPhone,
        type: "button",
        text: interpolatedContent,
        footerText: footer,
        choices,
      },
    })
    return { success: res.ok, error: res.ok ? undefined : res.error || "Falha no envio de botões" }
  }

  // 3. Menu de Lista (POST /send/menu type: "list")
  if (template.type === "list" && template.listSections?.length) {
    const choices: string[] = []
    for (const sec of template.listSections) {
      choices.push(`[${sec.title}]`)
      for (const row of sec.rows) {
        const rowTitle = interpolateText(row.title, variables)
        const rowDesc = row.description ? interpolateText(row.description, variables) : ""
        choices.push(rowDesc ? `${rowTitle}|${row.rowId}|${rowDesc}` : `${rowTitle}|${row.rowId}`)
      }
    }

    const res = await fetchUazapi(`${baseUrl}/send/menu`, {
      method: "POST",
      headers: { token },
      body: {
        number: formattedPhone,
        type: "list",
        text: interpolatedContent,
        footerText: footer,
        listButton: template.listButtonText || "Ver Opções",
        choices,
      },
    })
    return { success: res.ok, error: res.ok ? undefined : res.error || "Falha no envio de lista" }
  }

  // 4. Carrossel de Mídia (POST /send/carousel ou /send/menu)
  if (template.type === "carousel" && template.carouselCards?.length) {
    const choices: string[] = []
    for (const card of template.carouselCards) {
      const cardTitle = interpolateText(card.title, variables)
      const cardDesc = interpolateText(card.description, variables)
      choices.push(`[${cardTitle}\\n${cardDesc}]`)
      if (card.imageUrl) {
        choices.push(`{${card.imageUrl}}`)
      }
      const btnText = interpolateText(card.buttonText, variables)
      if (card.buttonType === "url") {
        choices.push(`${btnText}|${card.buttonPayload}`)
      } else {
        choices.push(`${btnText}|reply:${card.buttonPayload || btnText}`)
      }
    }

    const res = await fetchUazapi(`${baseUrl}/send/menu`, {
      method: "POST",
      headers: { token },
      body: {
        number: formattedPhone,
        type: "carousel",
        text: interpolatedContent,
        footerText: footer,
        choices,
      },
    })
    return { success: res.ok, error: res.ok ? undefined : res.error || "Falha no envio de carrossel" }
  }

  // Fallback para texto simples
  const fallbackRes = await fetchUazapi(`${baseUrl}/send/text`, {
    method: "POST",
    headers: { token },
    body: {
      number: formattedPhone,
      text: interpolatedContent,
    },
  })
  return { success: fallbackRes.ok, error: fallbackRes.ok ? undefined : fallbackRes.error }
}

// ============================================================================
// DISPARADOR EM MASSA & CAMPANHAS RECORRENTES
// ============================================================================

export const listBroadcastCampaigns = query({
  handler: async (ctx) => {
    return await ctx.db.query("broadcastCampaigns").order("desc").take(50)
  },
})

export const createBroadcastCampaign = mutation({
  args: {
    name: v.string(),
    templateId: v.optional(v.id("messageTemplates")),
    customText: v.string(),
    messageType: v.union(v.literal("text"), v.literal("button"), v.literal("list"), v.literal("carousel")),
    targetPatientIds: v.array(v.id("patients")),
    recurrence: v.union(
      v.literal("none"),
      v.literal("daily"),
      v.literal("weekly"),
      v.literal("biweekly"),
      v.literal("monthly")
    ),
    scheduledHour: v.string(),
    scheduledDaysOfWeek: v.optional(v.array(v.number())),
  },
  handler: async (ctx, args) => {
    const isImmediate = args.recurrence === "none"
    const nextRunAt = isImmediate ? Date.now() : calculateNextRun(args.recurrence, args.scheduledHour, args.scheduledDaysOfWeek)

    const campaignId = await ctx.db.insert("broadcastCampaigns", {
      name: args.name,
      templateId: args.templateId,
      customText: args.customText,
      messageType: args.messageType,
      targetPatientIds: args.targetPatientIds,
      recurrence: args.recurrence,
      scheduledHour: args.scheduledHour,
      scheduledDaysOfWeek: args.scheduledDaysOfWeek,
      status: "active",
      nextRunAt,
      totalRecipients: args.targetPatientIds.length,
      sentCount: 0,
      failedCount: 0,
      createdAt: Date.now(),
    })

    return campaignId
  },
})

export const toggleCampaignStatus = mutation({
  args: {
    campaignId: v.id("broadcastCampaigns"),
    newStatus: v.union(v.literal("active"), v.literal("paused"), v.literal("cancelled")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.campaignId, { status: args.newStatus })
  },
})

export const deleteCampaign = mutation({
  args: { campaignId: v.id("broadcastCampaigns") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.campaignId)
  },
})

function calculateNextRun(
  recurrence: "none" | "daily" | "weekly" | "biweekly" | "monthly",
  scheduledHour: string,
  daysOfWeek?: number[]
): number {
  const [hour, minute] = scheduledHour.split(":").map(Number)
  const now = new Date()

  // Base em UTC-3
  const target = new Date()
  target.setHours(hour || 9, minute || 0, 0, 0)

  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1)
  }

  if (recurrence === "daily") {
    return target.getTime()
  }

  if (recurrence === "weekly" && daysOfWeek && daysOfWeek.length > 0) {
    while (!daysOfWeek.includes(target.getDay())) {
      target.setDate(target.getDate() + 1)
    }
    return target.getTime()
  }

  if (recurrence === "biweekly") {
    target.setDate(target.getDate() + 14)
    return target.getTime()
  }

  if (recurrence === "monthly") {
    target.setMonth(target.getMonth() + 1)
    return target.getTime()
  }

  return target.getTime()
}

export const updateCampaignProgressInternal = internalMutation({
  args: {
    campaignId: v.id("broadcastCampaigns"),
    sentCount: v.number(),
    failedCount: v.number(),
    lastExecutedAt: v.number(),
    nextRunAt: v.optional(v.number()),
    status: v.optional(v.union(v.literal("active"), v.literal("paused"), v.literal("completed"), v.literal("cancelled"))),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.campaignId, {
      sentCount: args.sentCount,
      failedCount: args.failedCount,
      lastExecutedAt: args.lastExecutedAt,
      nextRunAt: args.nextRunAt,
      status: args.status,
    })
  },
})

export const getPatientsByIdsInternal = internalQuery({
  args: { patientIds: v.array(v.id("patients")) },
  handler: async (ctx, args) => {
    const list = []
    for (const id of args.patientIds) {
      const p = await ctx.db.get(id)
      if (p) list.push(p)
    }
    return list
  },
})

export const getCampaignByIdInternal = internalQuery({
  args: { campaignId: v.id("broadcastCampaigns") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.campaignId)
  },
})

export const dispatchBroadcastCampaignAction = action({
  args: { campaignId: v.id("broadcastCampaigns") },
  handler: async (
    ctx,
    args
  ): Promise<{ success: boolean; sent: number; failed: number; error?: string }> => {
    const campaign: any = await ctx.runQuery(internal.whatsapp.getCampaignByIdInternal, {
      campaignId: args.campaignId,
    })
    if (!campaign) return { success: false, sent: 0, failed: 0, error: "Campanha não encontrada" }

    const settings: any = await ctx.runQuery(internal.whatsapp.getClinicSettingsInternal, {})
    const baseUrl = sanitizeUazapiEndpoint(settings?.uazapiEndpoint)
    const defaultInstance: any = await ctx.runQuery(internal.whatsapp.getDefaultInstanceInternal, {})

    if (!defaultInstance || !defaultInstance.token) {
      return {
        success: false,
        sent: 0,
        failed: 0,
        error: "Nenhuma instância do WhatsApp conectada como padrão.",
      }
    }

    const token = defaultInstance.token
    const clinicName = settings?.clinicName || "Altar Fisio"

    // Busca template caso haja
    let templateData: any = null
    if (campaign.templateId) {
      templateData = await ctx.runQuery(internal.whatsapp.getTemplateByIdInternal, {
        id: campaign.templateId,
      })
    }

    if (!templateData) {
      templateData = {
        type: campaign.messageType || "text",
        content: campaign.customText,
      }
    }

    const patients: any[] = await ctx.runQuery(internal.whatsapp.getPatientsByIdsInternal, {
      patientIds: campaign.targetPatientIds,
    })

    let sent = 0
    let failed = 0

    for (let i = 0; i < patients.length; i++) {
      const p = patients[i]
      if (!p.phone) {
        failed++
        continue
      }

      const variables: Record<string, string> = {
        paciente: p.name,
        clinica: clinicName,
        telefone_clinica: settings?.phone || "",
        data: new Date().toLocaleDateString("pt-BR"),
        horario: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        profissional: "Equipe Altar Fisio",
        sala: "Recepção",
      }

      const sendRes = await sendUazapiInteractiveMessage(
        baseUrl,
        token,
        p.phone,
        templateData,
        variables
      )

      if (sendRes.success) {
        sent++
      } else {
        failed++
      }

      // Registra log no sistema
      await ctx.runMutation(internal.notifications.logNotificationInternal, {
        channel: "whatsapp_uazapi",
        recipientName: p.name,
        recipientContact: p.phone,
        triggerType: `disparador_${campaign.name}`,
        content: interpolateText(templateData.content, variables),
        status: sendRes.success ? "sent" : "failed",
        timestamp: Date.now(),
        errorMessage: sendRes.error,
      })

      // Intervalo anti-bloqueio seguro (3.5 segundos entre disparos)
      if (i < patients.length - 1) {
        await new Promise((res) => setTimeout(res, 3500))
      }
    }

    // Atualiza campanha
    const isOneOff = campaign.recurrence === "none"
    const nextRun = isOneOff
      ? undefined
      : calculateNextRun(campaign.recurrence, campaign.scheduledHour, campaign.scheduledDaysOfWeek)

    await ctx.runMutation(internal.whatsapp.updateCampaignProgressInternal, {
      campaignId: args.campaignId,
      sentCount: campaign.sentCount + sent,
      failedCount: campaign.failedCount + failed,
      lastExecutedAt: Date.now(),
      nextRunAt: nextRun,
      status: isOneOff ? "completed" : "active",
    })

    return {
      success: true,
      sent,
      failed,
    }
  },
})

export const getDueCampaignsInternal = internalQuery({
  args: { now: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("broadcastCampaigns")
      .withIndex("by_next_run", (q) =>
        q.eq("status", "active").lte("nextRunAt", args.now)
      )
      .collect()
  },
})

export const processRecurringCampaignsAction = action({
  args: {},
  handler: async (ctx): Promise<{ processed: number }> => {
    const now = Date.now()
    const dueCampaigns: any[] = await ctx.runQuery(internal.whatsapp.getDueCampaignsInternal, { now })

    for (const c of dueCampaigns) {
      // Dispara helper diretamente sem recursão
      const settings: any = await ctx.runQuery(internal.whatsapp.getClinicSettingsInternal, {})
      const baseUrl = sanitizeUazapiEndpoint(settings?.uazapiEndpoint)
      const defaultInstance: any = await ctx.runQuery(internal.whatsapp.getDefaultInstanceInternal, {})

      if (!defaultInstance || !defaultInstance.token) continue

      const token = defaultInstance.token
      const clinicName = settings?.clinicName || "Altar Fisio"

      let templateData: any = null
      if (c.templateId) {
        templateData = await ctx.runQuery(internal.whatsapp.getTemplateByIdInternal, {
          id: c.templateId,
        })
      }
      if (!templateData) {
        templateData = { type: c.messageType || "text", content: c.customText }
      }

      const patients: any[] = await ctx.runQuery(internal.whatsapp.getPatientsByIdsInternal, {
        patientIds: c.targetPatientIds,
      })

      let sent = 0
      let failed = 0

      for (let i = 0; i < patients.length; i++) {
        const p = patients[i]
        if (!p.phone) {
          failed++
          continue
        }

        const variables: Record<string, string> = {
          paciente: p.name,
          clinica: clinicName,
          telefone_clinica: settings?.phone || "",
          data: new Date().toLocaleDateString("pt-BR"),
          horario: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
          profissional: "Equipe Altar Fisio",
          sala: "Recepção",
        }

        const sendRes = await sendUazapiInteractiveMessage(
          baseUrl,
          token,
          p.phone,
          templateData,
          variables
        )

        if (sendRes.success) sent++
        else failed++

        await ctx.runMutation(internal.notifications.logNotificationInternal, {
          channel: "whatsapp_uazapi",
          recipientName: p.name,
          recipientContact: p.phone,
          triggerType: `recorrente_${c.name}`,
          content: interpolateText(templateData.content, variables),
          status: sendRes.success ? "sent" : "failed",
          timestamp: Date.now(),
          errorMessage: sendRes.error,
        })

        if (i < patients.length - 1) {
          await new Promise((res) => setTimeout(res, 3500))
        }
      }

      const nextRun = calculateNextRun(c.recurrence, c.scheduledHour, c.scheduledDaysOfWeek)
      await ctx.runMutation(internal.whatsapp.updateCampaignProgressInternal, {
        campaignId: c._id,
        sentCount: c.sentCount + sent,
        failedCount: c.failedCount + failed,
        lastExecutedAt: Date.now(),
        nextRunAt: nextRun,
        status: "active",
      })
    }

    return { processed: dueCampaigns.length }
  },
})

export const seedWhatsAppDefaults = mutation({
  args: {},
  handler: async (ctx) => {
    // 1. Atualiza Clinic Settings
    const settings = await ctx.db.query("clinicSettings").first()
    if (settings) {
      await ctx.db.patch(settings._id, {
        uazapiEndpoint: "https://whatpress.uazapi.com",
        uazapiAdminToken: DEFAULT_ADMIN_TOKEN,
      })
    }

    // 2. Se não houver templates, cria os modelos padrões interativos
    const existingTemplates = await ctx.db.query("messageTemplates").collect()
    let t24Id = existingTemplates.find((t) => t.category === "reminder_24h")?._id
    let t2hId = existingTemplates.find((t) => t.category === "reminder_2h")?._id

    if (existingTemplates.length === 0) {
      t24Id = await ctx.db.insert("messageTemplates", {
        title: "Lembrete 24h Interativo (Botões de Ação)",
        type: "button",
        category: "reminder_24h",
        content:
          "Olá, *{{paciente}}*! 👋\n\nEste é um lembrete do seu atendimento amanhã na *{{clinica}}*:\n\n📅 *Data:* {{data}}\n⏰ *Horário:* {{horario}}\n👨‍⚕️ *Profissional:* {{profissional}}\n📍 *Local:* {{sala}}\n\n{{regras}}",
        footerText: "Altar Fisio • Cuidado e Movimento",
        buttons: [
          { text: "Confirmar Presença", actionType: "reply", payload: "confirmar" },
          { text: "Solicitar Remarcação", actionType: "reply", payload: "remarcar" },
          { text: "Ver Localização Maps", actionType: "url", payload: "https://maps.google.com" },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })

      t2hId = await ctx.db.insert("messageTemplates", {
        title: "Lembrete 2h com Orientações (Botões Rápidos)",
        type: "button",
        category: "reminder_2h",
        content:
          "Olá, *{{paciente}}*! ⏰\n\nFalta pouco para seu atendimento na *{{clinica}}*!\n\n📅 *Hoje às {{horario}}*\n👨‍⚕️ *Profissional:* {{profissional}}\n📍 *Local:* {{sala}}{{dica}}\n\nEstamos prontos para te receber!",
        footerText: "Altar Fisio",
        buttons: [
          { text: "Estou a Caminho", actionType: "reply", payload: "a_caminho" },
          { text: "Falar na Recepção", actionType: "url", payload: "https://wa.me/5511987654321" },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })

      await ctx.db.insert("messageTemplates", {
        title: "Informativo de Saúde (Carrossel Interativo)",
        type: "carousel",
        category: "broadcast",
        content:
          "Olá, *{{paciente}}*! Confira as novidades e orientações exclusivas da equipe *{{clinica}}* para sua qualidade de vida:",
        footerText: "Altar Fisio • Movimento é Vida",
        carouselCards: [
          {
            title: "Dicas de Ergonomia no Trabalho",
            description: "Alongamentos fáceis para fazer a cada 2 horas no computador.",
            imageUrl: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600",
            buttonText: "Ver Exercícios",
            buttonType: "url",
            buttonPayload: "https://altarfisio.com.br",
          },
          {
            title: "Studio de Pilates Avançado",
            description: "Aparelhos novos e turmas de até 4 alunos para atenção individualizada.",
            imageUrl: "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=600",
            buttonText: "Conhecer Studio",
            buttonType: "url",
            buttonPayload: "https://altarfisio.com.br",
          },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    }

    // Vincula templates aos lembretes se não tiver
    if (settings && t24Id && !settings.activeReminder24hTemplateId) {
      await ctx.db.patch(settings._id, { activeReminder24hTemplateId: t24Id })
    }
    if (settings && t2hId && !settings.activeReminder2hTemplateId) {
      await ctx.db.patch(settings._id, { activeReminder2hTemplateId: t2hId })
    }

    // 3. Se não houver instâncias, importa a instância padrão Altar Tech
    const existingInstances = await ctx.db.query("whatsappInstances").collect()
    if (existingInstances.length === 0) {
      await ctx.db.insert("whatsappInstances", {
        name: "Altar Tech",
        instanceId: "r510d7d5dfe8909",
        token: "6aab1350-93cb-4e92-93cb-a9c51a99a803",
        status: "connected",
        profileName: "Altar Tech",
        ownerNumber: "554192227793",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      if (settings) {
        await ctx.db.patch(settings._id, {
          activeWhatsappInstanceToken: "6aab1350-93cb-4e92-93cb-a9c51a99a803",
        })
      }
    }

    return { success: true }
  },
})

export const migrateTemplatesLineBreaks = mutation({
  args: {},
  handler: async (ctx) => {
    const templates = await ctx.db.query("messageTemplates").collect()
    let updatedCount = 0

    for (const t of templates) {
      const needsContentFix = t.content.includes("\\n") || t.content.includes("\r")
      const needsFooterFix = t.footerText ? t.footerText.includes("\\n") || t.footerText.includes("\r") : false

      if (needsContentFix || needsFooterFix) {
        await ctx.db.patch(t._id, {
          content: normalizeWhatsAppText(t.content),
          footerText: t.footerText ? normalizeWhatsAppText(t.footerText) : undefined,
          updatedAt: Date.now(),
        })
        updatedCount++
      }
    }

    return { total: templates.length, updatedCount }
  },
})
