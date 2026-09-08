import React, { useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { useTheme } from "@/contexts/ThemeContext"
import {
  HeartPulse,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  Stethoscope,
  Sparkles,
  AlertCircle,
  Loader2,
} from "lucide-react"

export const LoginPage: React.FC = () => {
  const { login, isLoading } = useAuth()
  const { theme } = useTheme()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!email.trim() || !password.trim()) {
      setErrorMessage("Por favor, preencha o e-mail e a senha.")
      return
    }

    setIsSubmitting(true)
    try {
      await login(email, password)
    } catch (err: any) {
      setErrorMessage(err?.message || "E-mail ou senha incorretos. Tente novamente.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-primary/5 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 antialiased">
      {/* Container Central */}
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">

        {/* Painel Esquerdo: Identidade & Apresentação */}
        <div className="lg:col-span-6 space-y-6 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold shadow-xs">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Ecossistema Clínico & Studio Integrado</span>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-center lg:justify-start gap-3">
              <div className="h-12 w-12 rounded-2xl bg-primary/15 text-primary flex items-center justify-center shadow-md border border-primary/20 overflow-hidden">
                {theme.logoUrl ? (
                  <img
                    src={theme.logoUrl}
                    alt={theme.clinicName}
                    className="h-full w-full object-contain p-1"
                  />
                ) : (
                  <HeartPulse className="h-7 w-7 text-primary" />
                )}
              </div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground">
                {theme.clinicName}
              </h1>
            </div>
            <p className="text-sm sm:text-base text-muted-foreground font-medium leading-relaxed max-w-lg mx-auto lg:mx-0">
              {theme.clinicSubtitle} — Gestão integrada de capacidade de salas, prontuário SOAP digital e controle de turmas de Pilates.
            </p>
          </div>

          <div className="flex items-center justify-center lg:justify-start gap-2 text-xs text-muted-foreground/80 pt-2">
            <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
            <span>Acesso exclusivo à equipe. Use sua conta individual.</span>
          </div>
        </div>

        {/* Painel Direito: Formulário de Login Tradicional */}
        <div className="lg:col-span-6 flex justify-center">
          <div className="w-full max-w-md bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-xl shadow-primary/5 relative">
            <div className="space-y-2 text-center mb-6">
              <h2 className="text-xl font-bold text-foreground tracking-tight">
                Acesse sua Conta
              </h2>
              <p className="text-xs text-muted-foreground">
                Informe suas credenciais para acessar o painel de atendimento.
              </p>
            </div>

            {errorMessage && (
              <div className="mb-5 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2.5 animate-shake">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Campo E-mail */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  E-mail Profissional
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="marcelo@altarfisio.com.br"
                    required
                    className="w-full h-10 px-3.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>
              </div>

              {/* Campo Senha */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                    Senha
                  </label>
                  <span className="text-[11px] text-muted-foreground">
                    Ex: admin123
                  </span>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full h-10 px-3.5 pr-10 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Botão de Enviar */}
              <button
                type="submit"
                disabled={isSubmitting || isLoading}
                className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow-md hover:shadow-lg hover:bg-primary/90 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Autenticando...</span>
                  </>
                ) : (
                  <>
                    <span>Entrar no Sistema</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-4 border-t border-border text-center">
              <p className="text-[11px] text-muted-foreground">
                Precisa de suporte ou redefinição de acesso? Contate a administração da clínica.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}