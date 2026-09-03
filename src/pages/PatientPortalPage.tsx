import React, { useState, useMemo, useEffect } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@convex/_generated/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Calendar,
  Clock,
  User,
  HeartPulse,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  LogOut,
  ChevronRight,
  ShieldCheck,
  CalendarDays,
  Layers,
  History,
  MapPin,
  X,
  ArrowRight,
  Check,
  RefreshCw,
  Info,
} from "lucide-react"
import { formatDateBR, getTodayDateString, addDaysSafe } from "@/lib/dateUtils"

const STORAGE_PATIENT_KEY = "altar_patient_portal_id"

type PortalTab = "schedule" | "replacements" | "packages" | "history"

// Error Boundary para capturar falhas de sincronização e permitir auto-recuperação
class PortalErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error) {
    console.warn("Portal Error Boundary intercepted:", error)
    try {
      localStorage.removeItem(STORAGE_PATIENT_KEY)
    } catch {}
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 text-foreground flex flex-col items-center justify-center p-6 text-center select-none font-sans">
          <div className="max-w-md w-full p-6 rounded-3xl bg-card border border-border/80 shadow-2xl space-y-4">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <HeartPulse className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-xl font-bold">Portal Altar Fisio</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Detectamos uma alteração de dados do sistema no seu navegador. Os dados temporários foram limpos para garantir seu acesso seguro.
            </p>
            <Button
              onClick={() => {
                try {
                  localStorage.removeItem(STORAGE_PATIENT_KEY)
                } catch {}
                window.location.reload()
              }}
              className="w-full rounded-2xl h-12 font-bold shadow-lg shadow-primary/20"
            >
              Recarregar e Acessar
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

const PatientPortalContent: React.FC = () => {
  // Estado de Autenticação / Identificação do Aluno
  const [patientId, setPatientId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(STORAGE_PATIENT_KEY) || null
    }
    return null
  })

  const [identifierInput, setIdentifierInput] = useState("")
  const [rememberDevice, setRememberDevice] = useState(true)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)

  // Aba Ativa (Navegação em Abas estilo App Nativo)
  const [activeTab, setActiveTab] = useState<PortalTab>("schedule")

  // Modais de Ação
  const [cancelModalItem, setCancelModalItem] = useState<any | null>(null)
  const [cancelReason, setCancelReason] = useState("")
  const [isCancelling, setIsCancelling] = useState(false)

  const [rescheduleItem, setRescheduleItem] = useState<any | null>(null)
  const [rescheduleTargetSlot, setRescheduleTargetSlot] = useState<any | null>(null)
  const [rescheduleDate, setRescheduleDate] = useState<string>(() => addDaysSafe(getTodayDateString(), 1))
  const [isRescheduling, setIsRescheduling] = useState(false)

  const [replacementBookingCredit, setReplacementBookingCredit] = useState<any | null>(null)
  const [replacementTargetSlot, setReplacementTargetSlot] = useState<any | null>(null)
  const [replacementDate, setReplacementDate] = useState<string>(() => addDaysSafe(getTodayDateString(), 1))
  const [isBookingReplacement, setIsBookingReplacement] = useState(false)

  // Toast Feedback
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null)
  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type })
    setTimeout(() => setToastMessage(null), 4000)
  }

  // Queries e Mutations Convex
  const identifiedPatient = useQuery(
    api.patientPortal.identifyPatient,
    identifierInput.trim().length >= 8 ? { identifier: identifierInput } : "skip"
  )

  const demoPatients = useQuery(api.patientPortal.getDemoPatients)

  const portalData = useQuery(
    api.patientPortal.getPatientPortalData,
    patientId ? { patientId: patientId as any } : "skip"
  )

  // Auto-recuperação: se o ID armazenado no localStorage não existir no banco atual, limpa a sessão
  useEffect(() => {
    if (patientId && portalData === null) {
      localStorage.removeItem(STORAGE_PATIENT_KEY)
      setPatientId(null)
      showToast("Sessão anterior não localizada neste ambiente. Por favor, acesse com seus dados.", "error")
    }
  }, [patientId, portalData])

  const cancelAppointmentMutation = useMutation(api.patientPortal.cancelAppointmentByPatient)
  const rescheduleAppointmentMutation = useMutation(api.patientPortal.rescheduleAppointmentByPatient)
  const bookReplacementCreditMutation = useMutation(api.patientPortal.useReplacementCreditToBook)
  const ensureDemoMutation = useMutation(api.patientPortal.ensurePatientDemoSchedules)

  // Vagas Livres para o Modal de Remarcação
  const availableSlotsReschedule = useQuery(
    api.patientPortal.listAvailableSlotsForBooking,
    rescheduleItem
      ? {
          specialty: rescheduleItem.specialty || "pilates",
          startDate: rescheduleDate,
          daysCount: 1,
        }
      : "skip"
  )

  // Vagas Livres para o Modal de Agendamento de Reposição
  const availableSlotsReplacement = useQuery(
    api.patientPortal.listAvailableSlotsForBooking,
    replacementBookingCredit
      ? {
          specialty: replacementBookingCredit.originSpecialty || "pilates",
          startDate: replacementDate,
          daysCount: 1,
        }
      : "skip"
  )

  // Máscara de CPF ou Celular
  const formatIdentifier = (val: string) => {
    const clean = val.replace(/\D/g, "")
    if (clean.length <= 11) {
      if (clean.length <= 10) {
        return clean.replace(/^(\d{3})(\d{3})?(\d{0,3})?(\d{0,2})?/, (_, a, b, c, d) => {
          let res = a
          if (b) res += "." + b
          if (c) res += "." + c
          if (d) res += "-" + d
          return res
        })
      }
      return clean.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
    }
    return val.slice(0, 15)
  }

  // Login / Identificação
  const handleLogin = async (idToSet?: string) => {
    setLoginError(null)
    if (idToSet) {
      if (rememberDevice) localStorage.setItem(STORAGE_PATIENT_KEY, idToSet)
      setPatientId(idToSet)
      try {
        await ensureDemoMutation({ patientId: idToSet as any })
      } catch (e) {}
      return
    }

    if (!identifierInput.trim()) {
      setLoginError("Por favor, digite seu CPF ou Celular cadastrado.")
      return
    }

    setIsLoggingIn(true)
    try {
      if (identifiedPatient) {
        if (rememberDevice) localStorage.setItem(STORAGE_PATIENT_KEY, identifiedPatient._id)
        setPatientId(identifiedPatient._id)
        try {
          await ensureDemoMutation({ patientId: identifiedPatient._id as any })
        } catch (e) {}
        showToast(`Bem-vindo(a), ${identifiedPatient.name.split(" ")[0]}!`)
      } else {
        setLoginError("Não encontramos nenhum cadastro com este documento ou celular. Verifique os dígitos ou fale com a nossa recepção.")
      }
    } finally {
      setIsLoggingIn(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_PATIENT_KEY)
    setPatientId(null)
    setIdentifierInput("")
    setActiveTab("schedule")
  }

  // Executar Cancelamento de Aula
  const handleConfirmCancel = async () => {
    if (!cancelModalItem || !patientId) return
    setIsCancelling(true)
    try {
      const res = await cancelAppointmentMutation({
        participantId: cancelModalItem.participantId,
        patientId: patientId as any,
        reason: cancelReason.trim() || undefined,
      })
      showToast(res.message, res.generatedCredit ? "success" : "error")
      setCancelModalItem(null)
      setCancelReason("")
    } catch (err: any) {
      showToast(err?.message || "Erro ao desmarcar sessão.", "error")
    } finally {
      setIsCancelling(false)
    }
  }

  // Executar Remarcação de Aula
  const handleConfirmReschedule = async () => {
    if (!rescheduleItem || !rescheduleTargetSlot || !patientId) return
    setIsRescheduling(true)
    try {
      const res = await rescheduleAppointmentMutation({
        participantId: rescheduleItem.participantId,
        targetScheduleId: rescheduleTargetSlot.scheduleId,
        patientId: patientId as any,
      })
      showToast(res.message)
      setRescheduleItem(null)
      setRescheduleTargetSlot(null)
    } catch (err: any) {
      showToast(err?.message || "Erro ao remarcar.", "error")
    } finally {
      setIsRescheduling(false)
    }
  }

  // Executar Agendamento de Reposição
  const handleConfirmReplacementBooking = async () => {
    if (!replacementBookingCredit || !replacementTargetSlot || !patientId) return
    setIsBookingReplacement(true)
    try {
      const res = await bookReplacementCreditMutation({
        creditId: replacementBookingCredit._id,
        targetScheduleId: replacementTargetSlot.scheduleId,
        patientId: patientId as any,
      })
      showToast(res.message)
      setReplacementBookingCredit(null)
      setReplacementTargetSlot(null)
      setActiveTab("schedule")
    } catch (err: any) {
      showToast(err?.message || "Erro ao agendar reposição.", "error")
    } finally {
      setIsBookingReplacement(false)
    }
  }

  // Próximos 14 dias para seleção rápida de data
  const datePills = useMemo(() => {
    const list = []
    const base = getTodayDateString()
    for (let i = 1; i <= 14; i++) {
      const dStr = addDaysSafe(base, i)
      const parts = dStr.split("-")
      const dObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
      if (dObj.getDay() !== 0) {
        const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
        list.push({
          dateStr: dStr,
          weekday: weekdays[dObj.getDay()],
          dayMonth: `${parts[2]}/${parts[1]}`,
        })
      }
    }
    return list
  }, [])

  // =========================================================================
  // TELA 1: IDENTIFICAÇÃO / LOGIN RÁPIDO (ESTILO APP NATIVO)
  // =========================================================================
  if (!patientId || !portalData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30 text-foreground flex flex-col justify-between p-4 sm:p-6 select-none font-sans">
        {/* Toast */}
        {toastMessage && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-foreground text-background text-xs font-bold shadow-2xl flex items-center gap-2 animate-scale-in">
            {toastMessage.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 text-amber-400" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        )}

        <div className="max-w-md w-full mx-auto my-auto space-y-6 animate-fade-in pt-4 pb-8">
          {/* Header Marca */}
          <div className="text-center space-y-3">
            <div className="inline-flex h-16 w-16 rounded-3xl bg-primary/10 text-primary items-center justify-center shadow-lg shadow-primary/15 border border-primary/20">
              <HeartPulse className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-foreground">
                Altar Fisio
              </h1>
              <p className="text-xs font-semibold text-primary uppercase tracking-wider mt-0.5">
                Área Exclusiva do Aluno & Paciente
              </p>
            </div>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
              Consulte seus horários, remarcações de aulas, créditos de reposição e saldo de sessões em tempo real.
            </p>
          </div>

          {/* Formulário de Entrada */}
          <Card className="border-border/70 shadow-xl rounded-3xl overflow-hidden bg-card/90 backdrop-blur-xl">
            <CardContent className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground block">
                  Informe seu CPF ou Celular (WhatsApp)
                </label>
                <div className="relative">
                  <Input
                    value={identifierInput}
                    onChange={(e) => {
                      setIdentifierInput(formatIdentifier(e.target.value))
                      setLoginError(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleLogin()
                    }}
                    placeholder="Ex: 234.567.890-12 ou (11) 98877-6655"
                    className="h-12 rounded-2xl text-sm font-medium pr-10 pl-4 bg-muted/20 border-border/70 focus:border-primary focus:ring-primary/20"
                    autoFocus
                  />
                  {identifierInput && (
                    <button
                      onClick={() => setIdentifierInput("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {loginError && (
                <div className="p-3 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-start gap-2 animate-shake">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span className="leading-snug">{loginError}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={rememberDevice}
                    onChange={(e) => setRememberDevice(e.target.checked)}
                    className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                  />
                  <span>Lembrar neste aparelho</span>
                </label>
              </div>

              <Button
                onClick={() => handleLogin()}
                disabled={isLoggingIn}
                className="w-full h-12 rounded-2xl text-sm font-bold shadow-lg shadow-primary/25 gap-2 transition-all active:scale-[0.98]"
              >
                {isLoggingIn ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Acessando...</span>
                  </>
                ) : (
                  <>
                    <span>Acessar Meu Painel</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Atalhos de Demonstração para Testes Imediatos */}
          <div className="p-4 rounded-3xl bg-muted/20 border border-border/60 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-primary" />
                <span>Testar com Aluno Cadastrado</span>
              </span>
              <Badge variant="secondary" className="text-[9px]">1 Toque</Badge>
            </div>

            <div className="grid grid-cols-1 gap-1.5">
              {demoPatients && demoPatients.length > 0 ? (
                demoPatients.map((dp, idx) => {
                  const colorClasses = [
                    "bg-emerald-500/10 text-emerald-600",
                    "bg-blue-500/10 text-blue-600",
                    "bg-purple-500/10 text-purple-600",
                    "bg-amber-500/10 text-amber-600",
                  ]
                  const color = colorClasses[idx % colorClasses.length]
                  return (
                    <button
                      key={dp._id}
                      onClick={() => handleLogin(dp._id)}
                      className="w-full p-2.5 rounded-2xl bg-card border border-border/70 hover:border-primary/50 text-left flex items-center justify-between group transition-all"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`h-8 w-8 rounded-xl ${color} flex items-center justify-center font-bold text-xs`}>
                          {dp.initials}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                            {dp.name}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {dp.planDesc}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                    </button>
                  )
                })
              ) : (
                <div className="py-2.5 text-center text-xs text-muted-foreground">
                  Carregando alunos disponíveis...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-[11px] text-muted-foreground">
          Altar Fisio • Dr. Marcelo Henrique CREFITO-3 • São Paulo
        </div>
      </div>
    )
  }

  // =========================================================================
  // TELA 2: PAINEL PRINCIPAL DO ALUNO (ESTILO APP NATIVO COM BOTTOM BAR)
  // =========================================================================
  const { patient, upcomingSchedules, packages, replacementCredits, historySchedules, policy } = portalData

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20 text-foreground flex flex-col font-sans pb-24 select-none">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-foreground text-background text-xs font-bold shadow-2xl flex items-center gap-2 animate-scale-in max-w-sm w-full mx-4">
          {toastMessage.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
          )}
          <span className="leading-tight">{toastMessage.text}</span>
        </div>
      )}

      {/* Header Fixo Tipo App Nativo com Blur */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50 px-4 sm:px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-sm">
            <HeartPulse className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-black text-foreground">
                Olá, {patient.name.split(" ")[0]}
              </h2>
              <Badge variant="secondary" className="text-[9px] font-semibold">
                Aluno
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground font-medium">
              Altar Fisio • Dr. Marcelo
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="h-8 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground gap-1"
            title="Trocar de Aluno / Sair"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>
      </header>

      {/* Conteúdo Central do Aplicativo */}
      <main className="max-w-md w-full mx-auto p-4 space-y-4 flex-1">
        {/* ================================================================= */}
        {/* ABA 1: MINHA AGENDA (PRÓXIMAS AULAS)                               */}
        {/* ================================================================= */}
        {activeTab === "schedule" && (
          <div className="space-y-4 animate-fade-in">
            {/* Banner de Aviso das Reposições (se houver) */}
            {replacementCredits && replacementCredits.length > 0 && (
              <div
                onClick={() => setActiveTab("replacements")}
                className="p-3.5 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-between cursor-pointer hover:bg-primary/15 transition-all shadow-sm"
              >
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-xl bg-primary/20 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                    <RotateCcw className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-foreground">
                      Você tem {replacementCredits.length} reposição disponível!
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Toque para escolher um dia e agendar sua vaga.
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-primary" />
              </div>
            )}

            {/* Título da Seção */}
            <div className="flex items-center justify-between pt-1">
              <div>
                <h3 className="text-base font-black text-foreground">Minhas Próximas Sessões</h3>
                <p className="text-[11px] text-muted-foreground">
                  Aulas e atendimentos agendados na clínica
                </p>
              </div>
              <Badge variant="outline" className="text-xs font-bold">
                {upcomingSchedules.length} agendada(s)
              </Badge>
            </div>

            {/* Lista de Sessões Futuras */}
            {upcomingSchedules.length === 0 ? (
              <Card className="border-dashed border-border/80 rounded-3xl p-8 text-center space-y-3 bg-muted/10">
                <div className="h-12 w-12 rounded-2xl bg-muted text-muted-foreground flex items-center justify-center mx-auto">
                  <CalendarDays className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">Nenhuma aula futura agendada</h4>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                    Você não possui atendimentos marcados para os próximos dias.
                  </p>
                </div>
                <Button
                  onClick={() => setActiveTab("replacements")}
                  className="rounded-2xl text-xs font-bold h-9 gap-1.5"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Ver Reposições Disponíveis</span>
                </Button>
              </Card>
            ) : (
              <div className="space-y-3">
                {upcomingSchedules.map((item: any) => {
                  const isPilates = item.specialty === "pilates"
                  const isRpg = item.specialty === "rpg"

                  return (
                    <Card
                      key={item.participantId}
                      className="border-border/70 rounded-3xl shadow-sm hover:shadow-md transition-all overflow-hidden bg-card"
                    >
                      <CardContent className="p-4 space-y-3.5">
                        {/* Topo do Card: Especialidade & Status */}
                        <div className="flex items-center justify-between">
                          <Badge
                            variant="outline"
                            className={
                              isPilates
                                ? "text-emerald-600 border-emerald-300 bg-emerald-500/10 font-bold text-[10px]"
                                : isRpg
                                ? "text-indigo-600 border-indigo-300 bg-indigo-500/10 font-bold text-[10px]"
                                : "text-blue-600 border-blue-300 bg-blue-500/10 font-bold text-[10px]"
                            }
                          >
                            {isPilates ? "Studio Pilates" : isRpg ? "RPG Postural" : "Fisioterapia"}
                          </Badge>

                          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                            <Clock className="h-3 w-3 text-primary" />
                            <span>
                              {item.startTime} - {item.endTime}
                            </span>
                          </div>
                        </div>

                        {/* Data e Horário em Destaque */}
                        <div>
                          <div className="text-base font-black text-foreground">
                            {formatDateBR(item.date)}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                            <MapPin className="h-3 w-3 text-primary shrink-0" />
                            <span className="truncate">{item.roomName}</span>
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                            <User className="h-3 w-3 text-primary shrink-0" />
                            <span>{item.professionalName}</span>
                          </div>
                        </div>

                        {/* Tag Informativa da Regra de 2 Horas */}
                        <div
                          className={`p-2.5 rounded-2xl text-[11px] flex items-center gap-2 border ${
                            item.canCancelWithCredit
                              ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
                              : "bg-amber-500/10 text-amber-700 border-amber-500/20"
                          }`}
                        >
                          {item.canCancelWithCredit ? (
                            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                          ) : (
                            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                          )}
                          <span className="leading-tight">
                            {item.canCancelWithCredit
                              ? "Desmarcar agora gera crédito automático de reposição (30 dias)."
                              : "Menos de 2h para o início: desmarcação sem crédito automático."}
                          </span>
                        </div>

                        {/* Botões de Ação (Remarcar e Desmarcar) */}
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setCancelModalItem(item)
                              setCancelReason("")
                            }}
                            className="rounded-2xl text-xs font-bold h-10 border-border/80 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-all active:scale-[0.98]"
                          >
                            Desmarcar
                          </Button>

                          <Button
                            size="sm"
                            onClick={() => {
                              setRescheduleItem(item)
                              setRescheduleTargetSlot(null)
                            }}
                            className="rounded-2xl text-xs font-bold h-10 shadow-sm shadow-primary/20 transition-all active:scale-[0.98]"
                          >
                            Remarcar Horário
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* ABA 2: REPOSIÇÕES (BANCO DE HORÁRIOS DISPONÍVEIS)                  */}
        {/* ================================================================= */}
        {activeTab === "replacements" && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <h3 className="text-base font-black text-foreground">Créditos de Reposição</h3>
              <p className="text-[11px] text-muted-foreground">
                Sessões que você desmarcou no prazo e pode repor na clínica
              </p>
            </div>

            {/* Card Informativo da Política */}
            <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/70 flex items-start gap-3">
              <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
                <Info className="h-4 w-4" />
              </div>
              <div className="space-y-1 text-xs leading-relaxed text-muted-foreground">
                <span className="font-bold text-foreground block">Como funcionam as reposições?</span>
                Toda desmarcação feita com pelo menos {policy.cancellationNoticeHours}h de antecedência gera 1 crédito válido por {policy.replacementExpiryDays} dias. Você pode encaixar em qualquer turma com vaga livre.
              </div>
            </div>

            {replacementCredits.length === 0 ? (
              <Card className="border-dashed border-border/80 rounded-3xl p-8 text-center space-y-3 bg-muted/10">
                <div className="h-12 w-12 rounded-2xl bg-muted text-muted-foreground flex items-center justify-center mx-auto">
                  <RotateCcw className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">Nenhum crédito disponível</h4>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                    Você não possui créditos de reposição pendentes no momento.
                  </p>
                </div>
              </Card>
            ) : (
              <div className="space-y-3">
                {replacementCredits.map((credit: any) => (
                  <Card
                    key={credit._id}
                    className="border-border/70 rounded-3xl shadow-sm bg-card overflow-hidden"
                  >
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-emerald-600 bg-emerald-500/10 border-emerald-300 text-[10px] font-bold">
                          Crédito Ativo
                        </Badge>
                        <span className="text-[11px] font-semibold text-muted-foreground">
                          Válido até: <strong>{formatDateBR(credit.expiryDate)}</strong>
                        </span>
                      </div>

                      <div>
                        <div className="text-sm font-bold text-foreground">
                          {credit.originTitle}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Desmarcado da sessão de {formatDateBR(credit.originDate)}
                        </div>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => {
                          setReplacementBookingCredit(credit)
                          setReplacementTargetSlot(null)
                        }}
                        className="w-full rounded-2xl text-xs font-bold h-10 shadow-sm gap-1.5"
                      >
                        <Calendar className="h-3.5 w-3.5" />
                        <span>Agendar Esta Reposição</span>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* ABA 3: MEUS PLANOS & SALDO                                        */}
        {/* ================================================================= */}
        {activeTab === "packages" && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <h3 className="text-base font-black text-foreground">Meus Planos & Sessões</h3>
              <p className="text-[11px] text-muted-foreground">
                Consumo e validade das suas mensalidades e pacotes
              </p>
            </div>

            {packages.length === 0 ? (
              <Card className="border-dashed border-border/80 rounded-3xl p-8 text-center space-y-3 bg-muted/10">
                <div className="h-12 w-12 rounded-2xl bg-muted text-muted-foreground flex items-center justify-center mx-auto">
                  <Layers className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">Nenhum plano contratado</h4>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                    Fale com a nossa recepção para conhecer os planos de Pilates e Fisioterapia.
                  </p>
                </div>
              </Card>
            ) : (
              <div className="space-y-3">
                {packages.map((pkg: any) => (
                  <Card
                    key={pkg._id}
                    className="border-border/70 rounded-3xl shadow-sm bg-card overflow-hidden"
                  >
                    <CardContent className="p-4 space-y-3.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-black text-foreground">
                          {pkg.packageName}
                        </span>
                        <Badge
                          variant="outline"
                          className={
                            pkg.isLowBalance
                              ? "text-amber-600 border-amber-300 bg-amber-500/10 font-bold text-[10px]"
                              : "text-emerald-600 border-emerald-300 bg-emerald-500/10 font-bold text-[10px]"
                          }
                        >
                          {pkg.status === "active" ? "Ativo" : "Concluído"}
                        </Badge>
                      </div>

                      {/* Barra de Progresso Visual */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="text-muted-foreground">Saldo Restante:</span>
                          <span className="text-foreground font-bold">
                            {pkg.remainingSessions} de {pkg.totalSessions} sessões
                          </span>
                        </div>

                        <div className="h-2.5 w-full rounded-full bg-muted/50 overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.min(
                                100,
                                Math.max(0, (pkg.remainingSessions / pkg.totalSessions) * 100)
                              )}%`,
                            }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                        <span>Início: {formatDateBR(pkg.startDate)}</span>
                        <span>Vence em: {formatDateBR(pkg.expiryDate)}</span>
                      </div>

                      {pkg.isLowBalance && (
                        <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 text-[11px] flex items-center justify-between">
                          <span>Restam poucas sessões. Deseja renovar?</span>
                          <a
                            href={`https://wa.me/55${policy.clinicPhone.replace(/\D/g, "")}?text=Olá,%20gostaria%20de%20renovar%20meu%20plano%20na%20Altar%20Fisio`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-bold underline ml-2 shrink-0"
                          >
                            Falar no WhatsApp
                          </a>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* ABA 4: HISTÓRICO DE SESSÕES                                       */}
        {/* ================================================================= */}
        {activeTab === "history" && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <h3 className="text-base font-black text-foreground">Histórico de Frequência</h3>
              <p className="text-[11px] text-muted-foreground">
                Aulas realizadas e registros passados
              </p>
            </div>

            {historySchedules.length === 0 ? (
              <Card className="border-dashed border-border/80 rounded-3xl p-8 text-center space-y-3 bg-muted/10">
                <div className="h-12 w-12 rounded-2xl bg-muted text-muted-foreground flex items-center justify-center mx-auto">
                  <History className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">Sem registros no histórico</h4>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                    Conforme suas aulas forem confirmadas pela recepção, elas aparecerão aqui.
                  </p>
                </div>
              </Card>
            ) : (
              <div className="space-y-2">
                {historySchedules.map((item: any) => (
                  <div
                    key={item.participantId}
                    className="p-3.5 rounded-2xl bg-card border border-border/60 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-bold text-foreground">
                        {item.title}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {formatDateBR(item.date)} às {item.startTime} • {item.professionalName}
                      </div>
                    </div>

                    <Badge
                      variant="secondary"
                      className="text-[10px] font-semibold"
                    >
                      {item.participantStatus === "present"
                        ? "Presente"
                        : item.participantStatus === "justified_absence"
                        ? "Desmarcado"
                        : item.participantStatus === "replacement"
                        ? "Reposição"
                        : "Concluído"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ===================================================================== */}
      {/* NAVEGAÇÃO INFERIOR FIXA (BOTTOM BAR ESTILO APLICATIVO NATIVO)          */}
      {/* ===================================================================== */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-background/90 backdrop-blur-xl border-t border-border/60 py-2 px-4 shadow-lg">
        <div className="max-w-md mx-auto grid grid-cols-4 gap-1">
          <button
            onClick={() => setActiveTab("schedule")}
            className={`flex flex-col items-center justify-center py-1 rounded-2xl transition-all active:scale-95 ${
              activeTab === "schedule"
                ? "text-primary font-bold"
                : "text-muted-foreground hover:text-foreground font-medium"
            }`}
          >
            <CalendarDays className="h-5 w-5 mb-0.5" />
            <span className="text-[10px]">Agenda</span>
          </button>

          <button
            onClick={() => setActiveTab("replacements")}
            className={`relative flex flex-col items-center justify-center py-1 rounded-2xl transition-all active:scale-95 ${
              activeTab === "replacements"
                ? "text-primary font-bold"
                : "text-muted-foreground hover:text-foreground font-medium"
            }`}
          >
            <RotateCcw className="h-5 w-5 mb-0.5" />
            <span className="text-[10px]">Reposições</span>
            {replacementCredits.length > 0 && (
              <span className="absolute top-0 right-5 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
            )}
          </button>

          <button
            onClick={() => setActiveTab("packages")}
            className={`flex flex-col items-center justify-center py-1 rounded-2xl transition-all active:scale-95 ${
              activeTab === "packages"
                ? "text-primary font-bold"
                : "text-muted-foreground hover:text-foreground font-medium"
            }`}
          >
            <Layers className="h-5 w-5 mb-0.5" />
            <span className="text-[10px]">Planos</span>
          </button>

          <button
            onClick={() => setActiveTab("history")}
            className={`flex flex-col items-center justify-center py-1 rounded-2xl transition-all active:scale-95 ${
              activeTab === "history"
                ? "text-primary font-bold"
                : "text-muted-foreground hover:text-foreground font-medium"
            }`}
          >
            <History className="h-5 w-5 mb-0.5" />
            <span className="text-[10px]">Histórico</span>
          </button>
        </div>
      </nav>

      {/* ===================================================================== */}
      {/* MODAL 1: DESMARCAR SESSÃO (BOTTOM SHEET NATIVO)                        */}
      {/* ===================================================================== */}
      {cancelModalItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="w-full max-w-md bg-card border border-border/80 rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-1 border-b border-border/50">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-destructive/10 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                </div>
                <h4 className="text-sm font-black text-foreground">Confirmar Desmarcação</h4>
              </div>
              <button
                onClick={() => setCancelModalItem(null)}
                className="p-1 rounded-xl text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-muted/20 border border-border/60 space-y-1">
              <div className="text-xs font-bold text-foreground">
                {cancelModalItem.title}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {formatDateBR(cancelModalItem.date)} às {cancelModalItem.startTime} • {cancelModalItem.professionalName}
              </div>
            </div>

            {/* Explicativo da Regra de 2 Horas */}
            <div
              className={`p-3.5 rounded-2xl text-xs flex items-start gap-2.5 border leading-relaxed ${
                cancelModalItem.canCancelWithCredit
                  ? "bg-emerald-500/10 text-emerald-800 border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-800 border-amber-500/20"
              }`}
            >
              {cancelModalItem.canCancelWithCredit ? (
                <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div>
                <span className="font-bold block">
                  {cancelModalItem.canCancelWithCredit
                    ? "Você receberá 1 crédito de reposição!"
                    : "Atenção à regra de antecedência"}
                </span>
                {cancelModalItem.canCancelWithCredit
                  ? `Faltam ${cancelModalItem.hoursUntilSession}h para a sessão. Como você está desmarcando com mais de ${policy.cancellationNoticeHours}h de antecedência, seu crédito terá validade de ${policy.replacementExpiryDays} dias.`
                  : `Faltam apenas ${cancelModalItem.hoursUntilSession}h para a sessão. Como a antecedência mínima da clínica é de ${policy.cancellationNoticeHours}h, esta desmarcação não gerará crédito automático de reposição.`}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Motivo (opcional):</label>
              <textarea
                rows={2}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Ex: Imprevisto de trabalho, consulta médica..."
                className="w-full p-2.5 rounded-2xl border border-border/80 bg-muted/20 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCancelModalItem(null)}
                className="h-11 rounded-2xl text-xs font-bold"
              >
                Voltar / Manter Aula
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={isCancelling}
                onClick={handleConfirmCancel}
                className="h-11 rounded-2xl text-xs font-bold shadow-md"
              >
                {isCancelling ? "Cancelando..." : "Confirmar Desmarcação"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: REMARCAR HORÁRIO (SELEÇÃO DE VAGAS EM TEMPO REAL)            */}
      {/* ===================================================================== */}
      {rescheduleItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="w-full max-w-md bg-card border border-border/80 rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-1 border-b border-border/50">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <RotateCcw className="h-4 w-4" />
                </div>
                <h4 className="text-sm font-black text-foreground">Remarcar Horário</h4>
              </div>
              <button
                onClick={() => {
                  setRescheduleItem(null)
                  setRescheduleTargetSlot(null)
                }}
                className="p-1 rounded-xl text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="text-xs text-muted-foreground">
              Trocar aula atual ({formatDateBR(rescheduleItem.date)} às {rescheduleItem.startTime}) por um novo horário:
            </div>

            {/* Seletor de Datas (Carrossel Horizontal) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Escolha o Novo Dia:</label>
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                {datePills.map((d) => (
                  <button
                    key={d.dateStr}
                    onClick={() => {
                      setRescheduleDate(d.dateStr)
                      setRescheduleTargetSlot(null)
                    }}
                    className={`px-3 py-2 rounded-2xl flex flex-col items-center justify-center shrink-0 border transition-all text-xs ${
                      rescheduleDate === d.dateStr
                        ? "bg-primary text-primary-foreground border-primary font-bold shadow-md shadow-primary/25"
                        : "bg-muted/20 border-border/70 text-muted-foreground hover:text-foreground font-medium"
                    }`}
                  >
                    <span className="text-[10px] uppercase">{d.weekday}</span>
                    <span className="text-sm font-black mt-0.5">{d.dayMonth}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Lista de Horários com Vagas */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground">Horários com Vagas Livres:</label>

              {!availableSlotsReschedule || availableSlotsReschedule.length === 0 ? (
                <div className="p-4 rounded-2xl bg-muted/20 text-center text-xs text-muted-foreground">
                  Nenhum horário com vaga disponível para este dia. Tente outra data no carrossel acima.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                  {availableSlotsReschedule.map((slot: any) => {
                    const isSelected = rescheduleTargetSlot?.scheduleId === slot.scheduleId

                    return (
                      <div
                        key={slot.scheduleId}
                        onClick={() => setRescheduleTargetSlot(slot)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? "border-primary bg-primary/10 shadow-sm"
                            : "border-border/70 bg-card hover:border-primary/40"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                              isSelected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground"
                            }`}
                          >
                            {isSelected && <Check className="h-3 w-3" />}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-foreground">
                              {slot.startTime} às {slot.endTime} • {slot.title}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {slot.professionalName} • {slot.roomName}
                            </div>
                          </div>
                        </div>

                        <Badge variant="secondary" className="text-[10px]">
                          {slot.vacanciesLeft} vaga(s)
                        </Badge>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setRescheduleItem(null)
                  setRescheduleTargetSlot(null)
                }}
                className="h-11 rounded-2xl text-xs font-bold"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={!rescheduleTargetSlot || isRescheduling}
                onClick={handleConfirmReschedule}
                className="h-11 rounded-2xl text-xs font-bold shadow-md shadow-primary/25"
              >
                {isRescheduling ? "Remarcando..." : "Confirmar Troca"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 3: AGENDAR REPOSIÇÃO                                            */}
      {/* ===================================================================== */}
      {replacementBookingCredit && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="w-full max-w-md bg-card border border-border/80 rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-1 border-b border-border/50">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                  <Calendar className="h-4 w-4" />
                </div>
                <h4 className="text-sm font-black text-foreground">Agendar Reposição</h4>
              </div>
              <button
                onClick={() => {
                  setReplacementBookingCredit(null)
                  setReplacementTargetSlot(null)
                }}
                className="p-1 rounded-xl text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800">
              Você está utilizando seu crédito de reposição de <strong>{replacementBookingCredit.originTitle}</strong> (Válido até {formatDateBR(replacementBookingCredit.expiryDate)}).
            </div>

            {/* Seletor de Datas */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Escolha a Data da Reposição:</label>
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                {datePills.map((d) => (
                  <button
                    key={d.dateStr}
                    onClick={() => {
                      setReplacementDate(d.dateStr)
                      setReplacementTargetSlot(null)
                    }}
                    className={`px-3 py-2 rounded-2xl flex flex-col items-center justify-center shrink-0 border transition-all text-xs ${
                      replacementDate === d.dateStr
                        ? "bg-primary text-primary-foreground border-primary font-bold shadow-md shadow-primary/25"
                        : "bg-muted/20 border-border/70 text-muted-foreground hover:text-foreground font-medium"
                    }`}
                  >
                    <span className="text-[10px] uppercase">{d.weekday}</span>
                    <span className="text-sm font-black mt-0.5">{d.dayMonth}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Lista de Vagas */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground">Horários com Vagas Livres:</label>

              {!availableSlotsReplacement || availableSlotsReplacement.length === 0 ? (
                <div className="p-4 rounded-2xl bg-muted/20 text-center text-xs text-muted-foreground">
                  Nenhuma vaga livre encontrada nesta data. Tente outro dia acima.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                  {availableSlotsReplacement.map((slot: any) => {
                    const isSelected = replacementTargetSlot?.scheduleId === slot.scheduleId

                    return (
                      <div
                        key={slot.scheduleId}
                        onClick={() => setReplacementTargetSlot(slot)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? "border-primary bg-primary/10 shadow-sm"
                            : "border-border/70 bg-card hover:border-primary/40"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                              isSelected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground"
                            }`}
                          >
                            {isSelected && <Check className="h-3 w-3" />}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-foreground">
                              {slot.startTime} às {slot.endTime} • {slot.title}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {slot.professionalName} • {slot.roomName}
                            </div>
                          </div>
                        </div>

                        <Badge variant="secondary" className="text-[10px]">
                          {slot.vacanciesLeft} vaga(s)
                        </Badge>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setReplacementBookingCredit(null)
                  setReplacementTargetSlot(null)
                }}
                className="h-11 rounded-2xl text-xs font-bold"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={!replacementTargetSlot || isBookingReplacement}
                onClick={handleConfirmReplacementBooking}
                className="h-11 rounded-2xl text-xs font-bold shadow-md shadow-primary/25"
              >
                {isBookingReplacement ? "Agendando..." : "Confirmar Reposição"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export const PatientPortalPage: React.FC = () => {
  return (
    <PortalErrorBoundary>
      <PatientPortalContent />
    </PortalErrorBoundary>
  )
}
