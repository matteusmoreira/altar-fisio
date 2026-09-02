import { query, mutation } from "./_generated/server"
import { v } from "convex/values"

// Utilitário de hash criptográfico compatível com o runtime isolado do Convex (Web Crypto API)
async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder()
  const data = enc.encode(`${salt}__altar_fisio__${password}`)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

function generateRandomToken(bytesLength = 24): string {
  const array = new Uint8Array(bytesLength)
  crypto.getRandomValues(array)
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("")
}

// 1. Obter usuário autenticado atual a partir do token de sessão
export const getCurrentUser = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!args.token) return null

    const session = await ctx.db
      .query("userSessions")
      .withIndex("by_token", (q) => q.eq("token", args.token!))
      .first()

    if (!session || session.expiresAt < Date.now()) {
      return null
    }

    const user = await ctx.db.get(session.userId)
    if (!user || !user.active) return null

    let professionalInfo = null
    if (user.professionalId) {
      const prof = await ctx.db.get(user.professionalId)
      if (prof) {
        professionalInfo = {
          crefito: prof.crefito,
          specialties: prof.specialties,
          phone: prof.phone,
        }
      }
    }

    return {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
      professionalId: user.professionalId,
      crefito: professionalInfo?.crefito,
      specialties: professionalInfo?.specialties,
    }
  },
})

// 2. Login com E-mail e Senha
export const login = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const cleanEmail = args.email.trim().toLowerCase()
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", cleanEmail))
      .first()

    if (!user || !user.active) {
      throw new Error("Credenciais inválidas ou conta inativa.")
    }

    const expectedHash = await hashPassword(args.password, user.salt)
    if (expectedHash !== user.passwordHash) {
      throw new Error("Credenciais inválidas. Verifique seu e-mail e senha.")
    }

    // Gerar token de sessão com validade de 30 dias
    const token = generateRandomToken()
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000

    await ctx.db.insert("userSessions", {
      userId: user._id,
      token,
      expiresAt,
      createdAt: Date.now(),
    })

    let professionalInfo = null
    if (user.professionalId) {
      const prof = await ctx.db.get(user.professionalId)
      if (prof) {
        professionalInfo = {
          crefito: prof.crefito,
          specialties: prof.specialties,
        }
      }
    }

    return {
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        professionalId: user.professionalId,
        crefito: professionalInfo?.crefito,
        specialties: professionalInfo?.specialties,
      },
    }
  },
})

// 3. Fast Login (Alternância Rápida de Perfil para Demonstração e Tablets de Clínica)
export const fastLogin = mutation({
  args: {
    role: v.union(v.literal("admin"), v.literal("professional"), v.literal("reception")),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", args.role))
      .first()

    if (!user || !user.active) {
      throw new Error(`Nenhum usuário ativo com perfil '${args.role}' foi encontrado.`)
    }

    const token = generateRandomToken()
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000

    await ctx.db.insert("userSessions", {
      userId: user._id,
      token,
      expiresAt,
      createdAt: Date.now(),
    })

    let professionalInfo = null
    if (user.professionalId) {
      const prof = await ctx.db.get(user.professionalId)
      if (prof) {
        professionalInfo = {
          crefito: prof.crefito,
          specialties: prof.specialties,
        }
      }
    }

    return {
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        professionalId: user.professionalId,
        crefito: professionalInfo?.crefito,
        specialties: professionalInfo?.specialties,
      },
    }
  },
})

// 4. Logout (Invalidação da Sessão)
export const logout = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("userSessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first()

    if (session) {
      await ctx.db.delete(session._id)
    }

    return { success: true }
  },
})

// 5. Listar perfis de usuários para seleção rápida de demonstração
export const listPublicProfiles = query({
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect()
    return await Promise.all(
      users.map(async (u) => {
        let crefito = undefined
        if (u.professionalId) {
          const prof = await ctx.db.get(u.professionalId)
          crefito = prof?.crefito
        }
        return {
          id: u._id,
          name: u.name,
          email: u.email,
          role: u.role,
          avatarUrl: u.avatarUrl,
          crefito,
        }
      })
    )
  },
})