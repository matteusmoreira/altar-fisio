import React, { createContext, useContext, useState, useEffect } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@convex/_generated/api"

export type UserRole = "admin" | "professional" | "reception"

export interface AuthUser {
  id: string
  name: string
  email: string
  role: UserRole
  avatarUrl?: string
  professionalId?: string
  crefito?: string
  specialties?: string[]
}

interface AuthContextType {
  user: AuthUser | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  role: UserRole | null
  isAdmin: boolean
  isProfessional: boolean
  isReception: boolean
  canAccessSection: (section: string) => boolean
  canAccessClinical: boolean
  canAccessFinance: boolean
  canAccessSettings: boolean
  canAccessNotifications: boolean
  login: (email: string, password: string) => Promise<void>
  fastLogin: (role: UserRole) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const TOKEN_KEY = "altar_auth_session_token"

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem(TOKEN_KEY) || null
  })

  // Query reativa ao Convex pelo usuário atual usando o token
  const convexUser = useQuery(
    api.auth.getCurrentUser,
    token ? { token } : "skip"
  )

  const loginMutation = useMutation(api.auth.login)
  const fastLoginMutation = useMutation(api.auth.fastLogin)
  const logoutMutation = useMutation(api.auth.logout)

  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [user, setUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    if (!token) {
      setUser(null)
      setIsLoading(false)
      return
    }

    if (convexUser !== undefined) {
      if (convexUser === null) {
        // Token inválido ou expirado no backend
        localStorage.removeItem(TOKEN_KEY)
        setToken(null)
        setUser(null)
      } else {
        setUser(convexUser as AuthUser)
      }
      setIsLoading(false)
    }
  }, [token, convexUser])

  const login = async (email: string, password: string) => {
    setIsLoading(true)
    try {
      const res = await loginMutation({ email, password })
      localStorage.setItem(TOKEN_KEY, res.token)
      setToken(res.token)
      setUser(res.user as AuthUser)
    } finally {
      setIsLoading(false)
    }
  }

  const fastLogin = async (targetRole: UserRole) => {
    setIsLoading(true)
    try {
      const res = await fastLoginMutation({ role: targetRole })
      localStorage.setItem(TOKEN_KEY, res.token)
      setToken(res.token)
      setUser(res.user as AuthUser)
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async () => {
    if (token) {
      try {
        await logoutMutation({ token })
      } catch (err) {
        console.warn("Erro ao invalidar sessão no backend:", err)
      }
    }
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
  }

  const role = user?.role || null
  const isAdmin = role === "admin"
  const isProfessional = role === "professional"
  const isReception = role === "reception"

  const canAccessClinical = isAdmin || isProfessional
  const canAccessFinance = isAdmin
  const canAccessSettings = isAdmin
  const canAccessNotifications = isAdmin || isReception

  const canAccessSection = (section: string): boolean => {
    if (!user) return false
    if (isAdmin) return true

    switch (section) {
      case "dashboard":
      case "schedule":
      case "classes":
      case "patients":
      case "packages":
        return true
      case "clinical":
        return canAccessClinical // Apenas Admin e Fisioterapeuta com CREFITO
      case "finance":
        return canAccessFinance // Apenas Administrador
      case "settings":
        return canAccessSettings // Apenas Administrador
      case "notifications":
        return canAccessNotifications // Admin e Recepção
      default:
        return false
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        role,
        isAdmin,
        isProfessional,
        isReception,
        canAccessSection,
        canAccessClinical,
        canAccessFinance,
        canAccessSettings,
        canAccessNotifications,
        login,
        fastLogin,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth deve ser utilizado dentro de um AuthProvider")
  }
  return ctx
}