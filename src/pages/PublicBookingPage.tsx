import React, { useState, useMemo, useRef } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@convex/_generated/api"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select } from "@/components/ui/select-native"
import {
  Calendar,
  Clock,
  CheckCircle2,
  HeartPulse,
  User,
  Phone,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  MapPin,
  AlertCircle,
  CalendarCheck,
  Sunrise,
  Sun,
  Moon,
  Users,
  Activity,
  Compass,
  Layers,
  CreditCard,
  Mail,
  MessageSquare,
  CalendarDays,
  Flame,
  Check,
  Award,
} from "lucide-react"
import { formatDateBR, formatDateWithWeekdayBR, addDaysSafe, getTodayDateString } from "@/lib/dateUtils"

interface AnswerMap {
  [key: string]: string
}

const MONTHS_SHORT = [
  "JAN", "FEV", "MAR", "ABR", "MAI", "JUN",
  "JUL", "AGO", "SET", "OUT", "NOV", "DEZ",
]

export const PublicBookingPage: React.FC = () => {
  const config = useQuery(api.bookingBuilder.getBookingConfig)
  const clinicSettings = useQuery(api.clinic.getSettings)
  const submitBooking = useMutation(api.bookingBuilder.submitPublicBooking)

  // Rastreia especialidade da URL se houver (ex: ?servico=pilates)
  const urlParams = new URLSearchParams(window.location.search)
  const initialSpecialty = (urlParams.get("especialidade") || urlParams.get("servico") || "pilates") as
    | "pilates"
    | "fisioterapia"
    | "rpg"

  // Estado do Fluxo
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [answers, setAnswers] = useState<AnswerMap>({})
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({})

  // Estado da Escolha da Sessão
  const [selectedSpecialty, setSelectedSpecialty] = useState<"pilates" | "fisioterapia" | "rpg">(
    initialSpecialty
  )
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = getTodayDateString()
    // Se for domingo, pula para segunda
    const d = new Date()
    if (d.getDay() === 0) return addDaysSafe(today, 1)
    return today
  })
  const [selectedSlot, setSelectedSlot] = useState<{
    startTime: string
    endTime: string
    roomId?: string
    professionalId?: string
    roomName?: string
  } | null>(null)

  // Filtro de Turno nos Horários
  const [selectedPeriodFilter, setSelectedPeriodFilter] = useState<"all" | "morning" | "afternoon" | "evening">("all")

  // Ref para scroll horizontal elegante das datas
  const dateScrollContainerRef = useRef<HTMLDivElement>(null)

  const scrollDates = (direction: "left" | "right") => {
    if (dateScrollContainerRef.current) {
      const scrollAmount = direction === "left" ? -260 : 260
      dateScrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" })
    }
  }

  // Estado dos Dados do Paciente
  const [patientName, setPatientName] = useState("")
  const [patientPhone, setPatientPhone] = useState("")
  const [patientCpf, setPatientCpf] = useState("")
  const [patientBirthDate, setPatientBirthDate] = useState("")
  const [patientEmail, setPatientEmail] = useState("")
  const [patientNotes, setPatientNotes] = useState("")

  // Estado de Submissão e Sucesso
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [bookingSuccessData, setBookingSuccessData] = useState<any>(null)

  // Consulta de Horários Disponíveis
  const availableSlots = useQuery(api.bookingBuilder.listPublicAvailableSlots, {
    date: selectedDate,
    specialty: selectedSpecialty,
  })

  // Lista de etapas ordenadas
  const steps = useMemo(() => {
    if (!config?.steps) return []
    return [...config.steps].sort((a, b) => a.order - b.order)
  }, [config])

  const currentStep = steps[currentStepIndex]

  // Máscaras de formulário
  const formatPhone = (val: string) => {
    const clean = val.replace(/\D/g, "").slice(0, 11)
    if (clean.length <= 10) {
      return clean.replace(/^(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").trim()
    }
    return clean.replace(/^(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").trim()
  }

  const formatCpf = (val: string) => {
    const clean = val.replace(/\D/g, "").slice(0, 11)
    return clean
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1-$2")
      .trim()
  }

  // Avaliação de Regra Condicional
  const isFieldVisible = (field: any): boolean => {
    if (!field.conditional) return true
    const parentAnswer = answers[field.conditional.dependsOnFieldId]
    return parentAnswer === field.conditional.equalsValue
  }

  // Próximos dias para seleção no carrossel de calendário
  const dateOptions = useMemo(() => {
    const dates = []
    const base = getTodayDateString()
    for (let i = 0; i < 14; i++) {
      const dStr = addDaysSafe(base, i)
      const parts = dStr.split("-")
      const year = parseInt(parts[0], 10)
      const monthIdx = parseInt(parts[1], 10) - 1
      const dayNum = parseInt(parts[2], 10)
      const dObj = new Date(year, monthIdx, dayNum)

      // Exclui domingos
      if (dObj.getDay() !== 0) {
        const weekdayRaw = formatDateWithWeekdayBR(dStr).split(",")[0]
        const weekdayClean = weekdayRaw.replace("-feira", "").trim()
        dates.push({
          dateStr: dStr,
          dayNumber: parts[2],
          monthName: MONTHS_SHORT[monthIdx] || "SET",
          weekday: weekdayClean,
          fullWeekday: weekdayRaw,
          isToday: i === 0,
          isTomorrow: i === 1,
        })
      }
    }
    return dates
  }, [])

  // Classificador de período do slot
  const getSlotPeriod = (timeStr: string): "morning" | "afternoon" | "evening" => {
    const hour = parseInt(timeStr.split(":")[0], 10)
    if (hour < 12) return "morning"
    if (hour < 18) return "afternoon"
    return "evening"
  }

  // Slots filtrados por período
  const filteredSlots = useMemo(() => {
    if (!availableSlots) return []
    if (selectedPeriodFilter === "all") return availableSlots
    return availableSlots.filter((slot) => getSlotPeriod(slot.startTime) === selectedPeriodFilter)
  }, [availableSlots, selectedPeriodFilter])

  // Contadores por turno
  const slotCounts = useMemo(() => {
    if (!availableSlots) return { all: 0, morning: 0, afternoon: 0, evening: 0 }
    let morning = 0
    let afternoon = 0
    let evening = 0
    availableSlots.forEach((slot) => {
      if (slot.isAvailable) {
        const p = getSlotPeriod(slot.startTime)
        if (p === "morning") morning++
        else if (p === "afternoon") afternoon++
        else if (p === "evening") evening++
      }
    })
    return {
      all: morning + afternoon + evening,
      morning,
      afternoon,
      evening,
    }
  }, [availableSlots])

  // Validação do Step Atual
  const validateCurrentStep = (): boolean => {
    const errors: { [key: string]: string } = {}

    if (!currentStep) return true

    if (currentStep.type === "intake_form") {
      const stepFields = config?.fields?.filter((f) => f.stepId === currentStep.id) || []
      stepFields.forEach((field) => {
        if (isFieldVisible(field) && field.required) {
          const val = answers[field.id]?.trim()
          if (!val) {
            errors[field.id] = "Este campo é obrigatório."
          }
        }
      })
    } else if (currentStep.type === "slot_picker") {
      if (!selectedSlot) {
        errors.slot = "Por favor, escolha um horário na grade abaixo para continuar."
      }
    } else if (currentStep.type === "patient_info") {
      if (!patientName.trim()) errors.name = "Nome completo é obrigatório."
      if (!patientPhone.trim() || patientPhone.replace(/\D/g, "").length < 10) {
        errors.phone = "WhatsApp ou telefone celular válido com DDD é obrigatório."
      }
      if (!patientCpf.trim() || patientCpf.replace(/\D/g, "").length !== 11) {
        errors.cpf = "CPF válido com 11 dígitos é obrigatório."
      }
      if (!patientBirthDate) {
        errors.birthDate = "Data de nascimento é obrigatória."
      }
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Avançar Etapa
  const handleNextStep = () => {
    if (!validateCurrentStep()) return
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1)
      window.scrollTo({ top: 0, behavior: "smooth" })
    } else {
      handleSubmitBooking()
    }
  }

  // Voltar Etapa
  const handlePrevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1)
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  // Submissão Final
  const handleSubmitBooking = async () => {
    setIsSubmitting(true)
    setFormErrors({})

    try {
      const answersArray = Object.entries(answers).map(([qId, answer]) => {
        const fieldDef = config?.fields?.find((f) => f.id === qId)
        return {
          questionId: qId,
          questionLabel: fieldDef?.label || qId,
          answer: String(answer),
        }
      })

      const res = await submitBooking({
        name: patientName,
        documentCpf: patientCpf,
        phone: patientPhone,
        email: patientEmail || undefined,
        birthDate: patientBirthDate,
        date: selectedDate,
        startTime: selectedSlot?.startTime || "08:00",
        endTime: selectedSlot?.endTime || "08:55",
        specialty: selectedSpecialty,
        roomId: selectedSlot?.roomId as any,
        professionalId: selectedSlot?.professionalId as any,
        answers: answersArray,
        notes: patientNotes,
      })

      setBookingSuccessData({
        ...res,
        specialty: selectedSpecialty,
        roomName: selectedSlot?.roomName,
      })
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch (err: any) {
      setFormErrors({
        submit: err?.message || "Erro ao registrar o agendamento. Por favor, tente novamente.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Gerador de link do Google Calendar
  const getGoogleCalendarUrl = () => {
    if (!bookingSuccessData) return "#"
    const title = encodeURIComponent(`Sessão de ${selectedSpecialty.toUpperCase()} - Altar Fisio`)
    const details = encodeURIComponent(
      `Atendimento de Fisioterapia/Pilates na Altar Fisio (Dr. Marcelo).\nEndereço: ${
        clinicSettings?.address || "Av. Paulista, 1000 - Bela Vista, São Paulo - SP"
      }\nTelefone: ${clinicSettings?.phone || "(11) 98765-4321"}\nRecomendações: Roupas confortáveis e meias antiderrapantes para Studio Pilates.`
    )
    const location = encodeURIComponent(clinicSettings?.address || "Altar Fisio")
    const dateFormatted = selectedDate.replace(/-/g, "")
    const startHour = selectedSlot?.startTime.replace(":", "") || "0800"
    const endHour = selectedSlot?.endTime.replace(":", "") || "0855"
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dateFormatted}T${startHour}00/${dateFormatted}T${endHour}00&details=${details}&location=${location}`
  }

  // Link direto de WhatsApp da Clínica
  const clinicWhatsAppUrl = useMemo(() => {
    const rawPhone = (clinicSettings?.phone || "11987654321").replace(/\D/g, "")
    const msg = encodeURIComponent(
      `Olá Dr. Marcelo / Altar Fisio! Acabei de realizar meu agendamento online de ${selectedSpecialty.toUpperCase()} para o dia ${formatDateBR(
        selectedDate
      )} às ${selectedSlot?.startTime || ""}. Meu nome é ${patientName}. Poderiam me confirmar as orientações?`
    )
    return `https://wa.me/55${rawPhone}?text=${msg}`
  }, [clinicSettings?.phone, selectedSpecialty, selectedDate, selectedSlot, patientName])

  // ================= RENDER TELA DE SUCESSO =================
  if (bookingSuccessData) {
    const isPending = bookingSuccessData.requireApproval || bookingSuccessData.status === "pending_approval"
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/10 via-background to-muted/30 py-12 px-4 sm:px-6 flex flex-col items-center justify-center selection:bg-primary/20">
        <div className="w-full max-w-xl animate-fade-in">
          <Card className="border border-border/80 shadow-2xl overflow-hidden rounded-[2rem] bg-card backdrop-blur-md">
            {/* Header da Confirmação com Gradiente Luxuoso */}
            <div className="relative overflow-hidden bg-gradient-to-br from-primary via-emerald-700 to-emerald-900 text-white p-8 sm:p-10 text-center">
              <div className="absolute top-0 right-0 -mt-8 -mr-8 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-40 h-40 bg-emerald-400/10 rounded-full blur-2xl pointer-events-none" />

              <div className="relative z-10">
                <div className="h-16 w-16 mx-auto rounded-2xl bg-white/15 backdrop-blur-md text-white flex items-center justify-center shadow-xl shadow-black/10 mb-4 border border-white/20">
                  <CheckCircle2 className="h-9 w-9 text-white" />
                </div>
                
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-xs font-semibold uppercase tracking-wider text-white mb-2">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
                  {isPending ? "Solicitação em Análise" : "Agendamento Confirmado"}
                </div>

                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-1">
                  {isPending ? "Recebemos sua Solicitação!" : "Sua Sessão está Confirmada!"}
                </h1>
                
                <p className="text-xs sm:text-sm text-emerald-100/90 mt-2 max-w-md mx-auto leading-relaxed">
                  {config?.successMessage ||
                    "Seu horário foi reservado no sistema da Altar Fisio. Enviamos o comprovante completo para o seu WhatsApp."}
                </p>
              </div>
            </div>

            <CardContent className="p-6 sm:p-8 space-y-6">
              {/* Voucher Ticket de Confirmação */}
              <div className="rounded-2xl bg-muted/40 border border-border p-5 relative overflow-hidden">
                <div className="flex items-center justify-between border-b border-border/70 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <HeartPulse className="h-4 w-4 text-primary" />
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Comprovante de Reserva
                    </span>
                  </div>
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px] font-bold">
                    Vaga Garantida
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-[11px] font-medium text-muted-foreground block uppercase tracking-wider">
                      Paciente
                    </span>
                    <span className="font-bold text-foreground truncate block">
                      {bookingSuccessData.patientName || patientName}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] font-medium text-muted-foreground block uppercase tracking-wider">
                      Especialidade
                    </span>
                    <span className="font-bold text-primary capitalize flex items-center gap-1">
                      <Activity className="h-3.5 w-3.5" />
                      {selectedSpecialty === "pilates"
                        ? "Studio Pilates"
                        : selectedSpecialty === "fisioterapia"
                        ? "Fisioterapia Clínica"
                        : "RPG Souchard"}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] font-medium text-muted-foreground block uppercase tracking-wider">
                      Data da Sessão
                    </span>
                    <span className="font-bold text-foreground flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-primary" />
                      {formatDateBR(selectedDate)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] font-medium text-muted-foreground block uppercase tracking-wider">
                      Horário
                    </span>
                    <span className="font-bold text-foreground flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-primary" />
                      {selectedSlot?.startTime} às {selectedSlot?.endTime}
                    </span>
                  </div>
                </div>
              </div>

              {/* Informações da Clínica & Dicas Importantes */}
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-card border border-border shadow-sm">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-bold text-foreground text-xs uppercase tracking-wider">
                      Local de Atendimento
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {clinicSettings?.address || "Av. Paulista, 1000 - Bela Vista, São Paulo - SP"}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/15">
                  <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div className="text-xs text-muted-foreground leading-relaxed">
                    <strong className="text-foreground block font-semibold mb-0.5">Orientações para o Atendimento:</strong>
                    Para sessões de Pilates ou RPG, utilize roupas leves e meias antiderrapantes.
                    Recomendamos chegar com 10 minutos de antecedência.
                  </div>
                </div>
              </div>

              {/* Ações Rápidas */}
              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <a
                  href={getGoogleCalendarUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-card hover:bg-muted border border-border font-bold text-xs text-foreground transition-all shadow-sm hover:shadow"
                >
                  <CalendarCheck className="h-4 w-4 text-primary" />
                  <span>Salvar no Google Agenda</span>
                </a>

                <a
                  href={clinicWhatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-md shadow-emerald-600/20 hover:shadow-lg"
                >
                  <Phone className="h-4 w-4" />
                  <span>Falar no WhatsApp da Clínica</span>
                </a>
              </div>

              <div className="text-center pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setBookingSuccessData(null)
                    setCurrentStepIndex(0)
                    setAnswers({})
                    setSelectedSlot(null)
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground font-medium"
                >
                  Fazer outro agendamento
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // ================= RENDER PRINCIPAL DO FLUXO =================
  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/40 via-background to-muted/20 text-foreground selection:bg-primary/20 pb-16">
      {/* Navbar Premium com Identidade da Clínica */}
      <header className="border-b border-border/70 bg-card/90 backdrop-blur-md sticky top-0 z-40 transition-all shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent text-primary flex items-center justify-center shadow-inner border border-primary/20 overflow-hidden">
              {clinicSettings?.logoUrl ? (
                <img
                  src={clinicSettings.logoUrl}
                  alt={clinicSettings.clinicName || "Logo"}
                  className="h-full w-full object-contain p-1"
                />
              ) : (
                <HeartPulse className="h-6 w-6 text-primary animate-pulse" />
              )}
            </div>
            <div>
              <div className="font-extrabold text-base tracking-tight text-foreground flex items-center gap-2">
                <span>{clinicSettings?.clinicName || "Altar Fisio"}</span>
                <span className="text-[11px] font-medium text-muted-foreground hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/60 border border-border/60">
                  <Award className="h-3 w-3 text-primary" />
                  {clinicSettings?.clinicSubtitle || "Dr. Marcelo"}
                </span>
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <MapPin className="h-3.5 w-3.5 text-primary/80 shrink-0" />
                <span className="truncate max-w-[220px] sm:max-w-none">
                  {clinicSettings?.address || "Av. Paulista, 1000 - Bela Vista, São Paulo - SP"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-300/60 dark:border-emerald-700/60 shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                Online 24h
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Container Central */}
      <main className="max-w-3xl mx-auto px-4 py-8 sm:py-10">
        {/* Banner de Apresentação */}
        <div className="text-center space-y-2.5 mb-8">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-bold text-primary uppercase tracking-wider shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Agendamento Online Instantâneo
          </div>

          <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-foreground">
            {config?.welcomeTitle || "Agende sua Sessão ou Consulta"}
          </h1>

          <p className="text-xs sm:text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
            {config?.welcomeMessage ||
              "Escolha a especialidade desejada, selecione o dia e horário que melhor se adaptam à sua rotina e reserve sua vaga em segundos."}
          </p>
        </div>

        {/* Barra de Progresso com Stepper */}
        {steps.length > 0 && (
          <div className="mb-8 p-4 rounded-2xl bg-card border border-border/70 shadow-sm">
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center">
                  {currentStepIndex + 1}
                </span>
                <span className="text-xs font-bold text-foreground">
                  {currentStep?.title || `Etapa ${currentStepIndex + 1}`}
                </span>
              </div>
              <span className="text-xs font-semibold text-muted-foreground">
                Etapa {currentStepIndex + 1} de {steps.length}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {steps.map((s, idx) => {
                const isPassed = idx < currentStepIndex
                const isCurrent = idx === currentStepIndex
                return (
                  <div
                    key={s.id}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      isPassed
                        ? "bg-primary"
                        : isCurrent
                        ? "bg-primary ring-4 ring-primary/20 shadow-sm"
                        : "bg-muted"
                    }`}
                  />
                )
              })}
            </div>
          </div>
        )}

        {/* Card Principal do Passo */}
        <Card className="border border-border/80 shadow-xl rounded-[2rem] overflow-hidden bg-card backdrop-blur-sm">
          <CardHeader className="p-6 sm:p-8 border-b border-border/60 bg-gradient-to-b from-muted/30 to-card">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-primary mb-1">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Etapa {currentStepIndex + 1} de {steps.length || 3}</span>
            </div>

            <CardTitle className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
              {currentStep?.title}
            </CardTitle>

            {currentStep?.description && (
              <CardDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed mt-1">
                {currentStep.description}
              </CardDescription>
            )}
          </CardHeader>

          <CardContent className="p-6 sm:p-8 space-y-8">
            {/* ================= ETAPA: TRIAGEM DINÂMICA ================= */}
            {currentStep?.type === "intake_form" && (
              <div className="space-y-6">
                {config?.fields
                  ?.filter((f) => f.stepId === currentStep.id)
                  .sort((a, b) => a.order - b.order)
                  .map((field) => {
                    if (!isFieldVisible(field)) return null
                    const err = formErrors[field.id]

                    return (
                      <div
                        key={field.id}
                        className="space-y-2.5 p-5 rounded-2xl bg-muted/20 border border-border/60 hover:border-border transition-all"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <label className="text-sm font-bold text-foreground flex items-center gap-1.5">
                            {field.label}
                            {field.required && <span className="text-destructive font-bold">*</span>}
                          </label>
                        </div>

                        {field.helpText && (
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {field.helpText}
                          </p>
                        )}

                        {/* Campo Tipo: Sim / Não */}
                        {field.type === "yes_no" && (
                          <div className="grid grid-cols-2 gap-3 pt-1">
                            {["Sim", "Não"].map((opt) => (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => {
                                  setAnswers((prev) => ({ ...prev, [field.id]: opt }))
                                  if (formErrors[field.id]) {
                                    setFormErrors((prev) => {
                                      const n = { ...prev }
                                      delete n[field.id]
                                      return n
                                    })
                                  }
                                }}
                                className={`py-3.5 px-4 rounded-xl border text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                                  answers[field.id] === opt
                                    ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/25 scale-[1.01]"
                                    : "bg-card hover:bg-muted border-border text-foreground hover:border-border/80"
                                }`}
                              >
                                {opt === "Sim" ? (
                                  <>
                                    <Check className="h-4 w-4" />
                                    <span>Sim</span>
                                  </>
                                ) : (
                                  <>
                                    <span>Não</span>
                                  </>
                                )}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Campo Tipo: Select */}
                        {field.type === "select" && (
                          <div className="pt-1">
                            <Select
                              value={answers[field.id] || ""}
                              onChange={(e) => {
                                const val = e.target.value
                                setAnswers((prev) => ({ ...prev, [field.id]: val }))
                                if (formErrors[field.id]) {
                                  setFormErrors((prev) => {
                                    const n = { ...prev }
                                    delete n[field.id]
                                    return n
                                  })
                                }
                              }}
                              className="h-12 rounded-xl bg-card text-sm border-border"
                            >
                              <option value="">{field.placeholder || "Selecione uma opção..."}</option>
                              {field.options?.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </Select>
                          </div>
                        )}

                        {/* Campo Tipo: Texto Curto */}
                        {field.type === "text" && (
                          <div className="pt-1">
                            <Input
                              value={answers[field.id] || ""}
                              onChange={(e) => {
                                const val = e.target.value
                                setAnswers((prev) => ({ ...prev, [field.id]: val }))
                                if (formErrors[field.id]) {
                                  setFormErrors((prev) => {
                                    const n = { ...prev }
                                    delete n[field.id]
                                    return n
                                  })
                                }
                              }}
                              placeholder={field.placeholder || "Digite sua resposta..."}
                              className="h-12 rounded-xl bg-card text-sm border-border"
                            />
                          </div>
                        )}

                        {/* Campo Tipo: Textarea */}
                        {field.type === "textarea" && (
                          <div className="pt-1">
                            <textarea
                              rows={3}
                              value={answers[field.id] || ""}
                              onChange={(e) => {
                                const val = e.target.value
                                setAnswers((prev) => ({ ...prev, [field.id]: val }))
                                if (formErrors[field.id]) {
                                  setFormErrors((prev) => {
                                    const n = { ...prev }
                                    delete n[field.id]
                                    return n
                                  })
                                }
                              }}
                              placeholder={field.placeholder || "Descreva com detalhes..."}
                              className="w-full p-4 rounded-xl border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 leading-relaxed resize-none transition-all"
                            />
                          </div>
                        )}

                        {err && (
                          <p className="text-xs font-semibold text-destructive flex items-center gap-1 mt-1">
                            <AlertCircle className="h-3.5 w-3.5" />
                            {err}
                          </p>
                        )}
                      </div>
                    )
                  })}
              </div>
            )}

            {/* ================= ETAPA: SELETOR DE MODALIDADE, DATA E HORÁRIO ================= */}
            {currentStep?.type === "slot_picker" && (
              <div className="space-y-8">
                {/* 1. SELEÇÃO DE ESPECIALIDADE COM CARDS E ÍCONES PREMIUM */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      <span>1. Escolha a Especialidade</span>
                    </label>
                    <span className="text-[11px] text-muted-foreground font-medium">
                      Atendimento personalizado
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    {[
                      {
                        id: "pilates",
                        label: "Studio Pilates",
                        desc: "Aparelhos & Solo",
                        badge: "Máx. 4 alunos",
                        icon: Activity,
                        gradient: "from-emerald-500/10 to-teal-500/5",
                        borderColor: "hover:border-emerald-500/40",
                      },
                      {
                        id: "fisioterapia",
                        label: "Fisioterapia",
                        desc: "Ortopedia & Coluna",
                        badge: "Sessão Individual",
                        icon: HeartPulse,
                        gradient: "from-teal-500/10 to-primary/5",
                        borderColor: "hover:border-teal-500/40",
                      },
                      {
                        id: "rpg",
                        label: "RPG Souchard",
                        desc: "Postura & Cadeias",
                        badge: "Reeducação Global",
                        icon: Compass,
                        gradient: "from-emerald-600/10 to-emerald-500/5",
                        borderColor: "hover:border-emerald-600/40",
                      },
                    ].map((spec) => {
                      const isSelected = selectedSpecialty === spec.id
                      const IconComponent = spec.icon

                      return (
                        <button
                          key={spec.id}
                          type="button"
                          onClick={() => {
                            setSelectedSpecialty(spec.id as any)
                            setSelectedSlot(null)
                          }}
                          className={`group relative p-4 rounded-2xl border text-left transition-all duration-200 flex flex-col justify-between ${
                            isSelected
                              ? "bg-gradient-to-br from-primary/15 via-primary/5 to-card border-primary ring-2 ring-primary/40 shadow-md shadow-primary/10 -translate-y-0.5"
                              : `bg-card ${spec.borderColor} border-border text-foreground hover:bg-muted/40 hover:-translate-y-0.5`
                          }`}
                        >
                          <div className="flex items-start justify-between w-full mb-3">
                            <div
                              className={`h-11 w-11 rounded-2xl flex items-center justify-center transition-all ${
                                isSelected
                                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-105"
                                  : "bg-muted/80 text-muted-foreground group-hover:text-primary group-hover:bg-primary/10"
                              }`}
                            >
                              <IconComponent className="h-5 w-5" />
                            </div>

                            {isSelected ? (
                              <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
                                <Check className="h-3 w-3 stroke-[3]" />
                              </span>
                            ) : (
                              <span className="h-5 w-5 rounded-full border border-border/80 group-hover:border-primary/40 transition-colors" />
                            )}
                          </div>

                          <div>
                            <div className="font-extrabold text-sm sm:text-base text-foreground tracking-tight">
                              {spec.label}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1 font-medium">
                              {spec.desc}
                            </div>
                          </div>

                          <div className="mt-3.5 pt-2.5 border-t border-border/50 flex items-center justify-between">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                isSelected
                                  ? "bg-primary/20 text-primary border border-primary/30"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {spec.badge}
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* 2. SELETOR DE DATAS PREMIUM COM ÍCONES E CONTROLE HORIZONTAL */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5 text-primary" />
                      <span>2. Escolha o Dia da Sessão</span>
                    </label>

                    {/* Setas de navegação do carrossel */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => scrollDates("left")}
                        aria-label="Datas anteriores"
                        className="h-8 w-8 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-all shadow-sm"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => scrollDates("right")}
                        aria-label="Próximas datas"
                        className="h-8 w-8 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-all shadow-sm"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Carrossel Horizontal de Datas */}
                  <div
                    ref={dateScrollContainerRef}
                    className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none scroll-smooth -mx-1 px-1"
                  >
                    {dateOptions.map((item) => {
                      const isSelected = selectedDate === item.dateStr

                      return (
                        <button
                          key={item.dateStr}
                          type="button"
                          onClick={() => {
                            setSelectedDate(item.dateStr)
                            setSelectedSlot(null)
                          }}
                          className={`shrink-0 p-3 sm:p-3.5 rounded-2xl border flex flex-col items-center justify-between min-w-[86px] sm:min-w-[94px] transition-all duration-200 relative ${
                            isSelected
                              ? "bg-gradient-to-b from-primary via-emerald-600 to-emerald-700 text-white border-primary shadow-lg shadow-primary/25 ring-2 ring-primary ring-offset-2 scale-[1.03] -translate-y-0.5"
                              : "bg-card hover:bg-muted/60 border-border text-foreground hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-sm"
                          }`}
                        >
                          {/* Tag Especial (Hoje / Amanhã / Ícone de Dia) */}
                          <div className="w-full flex items-center justify-center mb-1.5">
                            {item.isToday ? (
                              <span
                                className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full flex items-center gap-1 ${
                                  isSelected
                                    ? "bg-white/20 text-white"
                                    : "bg-amber-500/10 text-amber-600 border border-amber-400/40"
                                }`}
                              >
                                <Sparkles className="h-2.5 w-2.5" />
                                Hoje
                              </span>
                            ) : item.isTomorrow ? (
                              <span
                                className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full flex items-center gap-1 ${
                                  isSelected
                                    ? "bg-white/20 text-white"
                                    : "bg-emerald-500/10 text-emerald-600 border border-emerald-400/40"
                                }`}
                              >
                                Amanhã
                              </span>
                            ) : (
                              <span
                                className={`text-[10px] font-bold uppercase tracking-wider ${
                                  isSelected ? "text-white/85" : "text-muted-foreground"
                                }`}
                              >
                                {item.weekday}
                              </span>
                            )}
                          </div>

                          {/* Número do Dia com Tipografia de Destaque */}
                          <span
                            className={`text-2xl font-black tracking-tight leading-none my-1.5 ${
                              isSelected ? "text-white" : "text-foreground"
                            }`}
                          >
                            {item.dayNumber}
                          </span>

                          {/* Mês e Micro Indicador */}
                          <div className="w-full flex items-center justify-center gap-1 mt-1">
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wider ${
                                isSelected ? "text-white/90" : "text-muted-foreground"
                              }`}
                            >
                              {item.monthName}
                            </span>
                            {isSelected ? (
                              <span className="h-1.5 w-1.5 rounded-full bg-white" />
                            ) : (
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* 3. HORÁRIOS DISPONÍVEIS COM FILTROS DE TURNO & CARDS LUXUOSOS */}
                <div className="space-y-4 pt-2">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/60 pb-3.5">
                    <div>
                      <label className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-primary" />
                        <span>3. Horários Disponíveis</span>
                      </label>
                      <p className="text-xs text-muted-foreground mt-1.5">
                        Para <strong className="text-foreground">{formatDateBR(selectedDate)}</strong> • Sessões com 55 minutos de duração
                      </p>
                    </div>

                    {/* Filtros Elegantes por Turno */}
                    <div className="inline-flex p-1 bg-muted/60 rounded-xl border border-border/80 self-start sm:self-auto">
                      <button
                        type="button"
                        onClick={() => setSelectedPeriodFilter("all")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                          selectedPeriodFilter === "all"
                            ? "bg-card text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Clock className="h-3.5 w-3.5 text-primary" />
                        <span>Todos ({slotCounts.all})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedPeriodFilter("morning")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                          selectedPeriodFilter === "morning"
                            ? "bg-card text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Sunrise className="h-3.5 w-3.5 text-amber-500" />
                        <span>Manhã</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedPeriodFilter("afternoon")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                          selectedPeriodFilter === "afternoon"
                            ? "bg-card text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Sun className="h-3.5 w-3.5 text-amber-600" />
                        <span>Tarde</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedPeriodFilter("evening")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                          selectedPeriodFilter === "evening"
                            ? "bg-card text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Moon className="h-3.5 w-3.5 text-indigo-400" />
                        <span>Noite</span>
                      </button>
                    </div>
                  </div>

                  {/* Mensagem de Erro de Horário Não Selecionado */}
                  {formErrors.slot && (
                    <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-bold flex items-center gap-2 animate-fade-in">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{formErrors.slot}</span>
                    </div>
                  )}

                  {/* Estados de Carregamento / Vazio / Grade de Horários */}
                  {!availableSlots ? (
                    <div className="py-14 text-center space-y-3">
                      <div className="h-8 w-8 mx-auto border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <div className="text-xs font-semibold text-muted-foreground">
                        Consultando disponibilidade em tempo real na clínica...
                      </div>
                    </div>
                  ) : filteredSlots.length === 0 ? (
                    <div className="py-12 text-center text-xs text-muted-foreground bg-muted/20 rounded-2xl border border-dashed border-border p-6 space-y-2">
                      <Clock className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                      <div className="font-bold text-foreground text-sm">
                        Nenhum horário disponível para o filtro selecionado
                      </div>
                      <p className="max-w-xs mx-auto text-muted-foreground">
                        Tente escolher outro turno acima ou selecione uma data diferente no calendário.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
                      {filteredSlots.map((slot) => {
                        const isSelected = selectedSlot?.startTime === slot.startTime
                        const firstRoom = slot.rooms[0]
                        const period = getSlotPeriod(slot.startTime)

                        // Ícone elegante baseado no período
                        const PeriodIcon =
                          period === "morning" ? Sunrise : period === "afternoon" ? Sun : Moon
                        const iconColorClass =
                          period === "morning"
                            ? "text-amber-500 bg-amber-500/10"
                            : period === "afternoon"
                            ? "text-amber-600 bg-amber-600/10"
                            : "text-indigo-400 bg-indigo-500/10"

                        return (
                          <button
                            key={slot.startTime}
                            type="button"
                            disabled={!slot.isAvailable}
                            onClick={() => {
                              setSelectedSlot({
                                startTime: slot.startTime,
                                endTime: slot.endTime,
                                roomId: firstRoom?.roomId,
                                roomName: firstRoom?.roomName,
                                professionalId: slot.availableProfessionals[0]?.id,
                              })
                              if (formErrors.slot) {
                                setFormErrors((prev) => {
                                  const n = { ...prev }
                                  delete n.slot
                                  return n
                                })
                              }
                            }}
                            className={`group p-4 rounded-2xl border text-left transition-all duration-200 relative flex flex-col justify-between min-h-[104px] ${
                              !slot.isAvailable
                                ? "opacity-35 bg-muted/20 border-dashed cursor-not-allowed"
                                : isSelected
                                ? "bg-gradient-to-br from-primary via-emerald-600 to-emerald-700 text-white border-primary shadow-xl shadow-primary/25 ring-2 ring-primary ring-offset-2 scale-[1.02] -translate-y-0.5"
                                : "bg-card hover:bg-muted/40 border-border text-foreground hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5"
                            }`}
                          >
                            {/* Linha Superior: Ícone do Turno + Horário Principal + Badge de Vagas */}
                            <div className="flex items-center justify-between gap-3 w-full">
                              <div className="flex items-center gap-3 min-w-0">
                                <div
                                  className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                                    isSelected
                                      ? "bg-white/20 text-white shadow-inner"
                                      : `${iconColorClass} group-hover:scale-105`
                                  }`}
                                >
                                  <PeriodIcon className="h-4 w-4" />
                                </div>

                                <div className="flex flex-col min-w-0">
                                  <span
                                    className={`text-lg sm:text-xl font-black tracking-tight leading-tight block ${
                                      isSelected ? "text-white" : "text-foreground"
                                    }`}
                                  >
                                    {slot.startTime}
                                  </span>
                                  <span
                                    className={`text-[11px] font-medium leading-tight block mt-1 ${
                                      isSelected ? "text-white/85" : "text-muted-foreground"
                                    }`}
                                  >
                                    até {slot.endTime}
                                  </span>
                                </div>
                              </div>

                              {/* Badge de Vagas ou Status Selecionado */}
                              <div className="shrink-0">
                                {isSelected ? (
                                  <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold tracking-wide uppercase bg-white text-emerald-800 dark:text-emerald-950 px-2.5 py-1 rounded-full shadow-sm">
                                    <Check className="h-3 w-3 stroke-[3] text-emerald-700" />
                                    <span>Escolhido</span>
                                  </span>
                                ) : slot.totalAvailableSpots === 1 ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-300/60 dark:border-amber-700/60 px-2 py-0.5 rounded-full">
                                    <Flame className="h-3 w-3 text-amber-500 animate-pulse" />
                                    1 vaga
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-300/60 dark:border-emerald-700/60 px-2.5 py-0.5 rounded-full">
                                    <Users className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                                    <span>{slot.totalAvailableSpots} vagas</span>
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Linha Inferior: Sala & Duração da Sessão */}
                            <div
                              className={`mt-3.5 pt-2.5 border-t flex items-center justify-between gap-2 text-[11px] ${
                                isSelected ? "border-white/20" : "border-border/60"
                              }`}
                            >
                              <div
                                className={`flex items-center gap-1.5 truncate min-w-0 ${
                                  isSelected ? "text-white/90" : "text-muted-foreground"
                                }`}
                              >
                                <Layers className="h-3.5 w-3.5 shrink-0 opacity-80" />
                                <span className="truncate font-medium">
                                  {firstRoom?.roomName || "Studio Pilates Aparelhos"}
                                </span>
                              </div>

                              <span
                                className={`text-[10px] font-semibold shrink-0 tabular-nums ${
                                  isSelected ? "text-white/80" : "text-muted-foreground/80"
                                }`}
                              >
                                55 min
                              </span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {/* Banner de Horário Selecionado */}
                  {selectedSlot && (
                    <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-primary/10 via-emerald-500/5 to-card border border-primary/25 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
                      <div className="flex items-center gap-3.5">
                        <div className="h-11 w-11 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-md shadow-primary/20 shrink-0">
                          <CheckCircle2 className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            <span>Sessão Selecionada:</span>
                            <span className="text-primary capitalize font-extrabold">
                              {selectedSpecialty}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {formatDateWithWeekdayBR(selectedDate)} às{" "}
                            <strong className="text-foreground font-semibold">{selectedSlot.startTime}</strong> (
                            {selectedSlot.roomName || "Studio Pilates"})
                          </div>
                        </div>
                      </div>

                      <Button
                        type="button"
                        onClick={handleNextStep}
                        className="rounded-xl px-5 py-2.5 h-10 sm:h-11 text-xs font-bold shadow-md shadow-primary/20 flex items-center gap-2 shrink-0 self-end sm:self-auto"
                      >
                        <span>Confirmar e Continuar</span>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ================= ETAPA: DADOS DO PACIENTE ================= */}
            {currentStep?.type === "patient_info" && (
              <div className="space-y-6">
                {/* Resumo da Sessão Escolhida */}
                <div className="rounded-2xl bg-primary/5 border border-primary/20 p-4 sm:p-5 flex items-start sm:items-center gap-3.5 shadow-sm">
                  <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <CalendarCheck className="h-5 w-5" />
                  </div>
                  <div className="text-xs text-muted-foreground leading-relaxed">
                    Você está agendando uma sessão de{" "}
                    <strong className="text-foreground font-bold capitalize">
                      {selectedSpecialty === "pilates"
                        ? "Studio Pilates"
                        : selectedSpecialty === "fisioterapia"
                        ? "Fisioterapia"
                        : "RPG"}
                    </strong>{" "}
                    para{" "}
                    <strong className="text-foreground font-bold">
                      {formatDateWithWeekdayBR(selectedDate)}
                    </strong>{" "}
                    às{" "}
                    <strong className="text-foreground font-bold">
                      {selectedSlot?.startTime} às {selectedSlot?.endTime}
                    </strong>
                    .
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-primary" />
                      <span>Nome Completo</span>
                      <span className="text-destructive">*</span>
                    </label>
                    <Input
                      value={patientName}
                      onChange={(e) => setPatientName(e.target.value)}
                      placeholder="Ex: Maria Silva Santos"
                      className="h-12 rounded-xl text-sm bg-card border-border"
                    />
                    {formErrors.name && (
                      <p className="text-xs text-destructive font-semibold flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {formErrors.name}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-primary" />
                        <span>WhatsApp / Celular</span>
                        <span className="text-destructive">*</span>
                      </label>
                      <Input
                        value={patientPhone}
                        onChange={(e) => setPatientPhone(formatPhone(e.target.value))}
                        placeholder="(11) 98765-4321"
                        className="h-12 rounded-xl text-sm bg-card border-border"
                      />
                      {formErrors.phone && (
                        <p className="text-xs text-destructive font-semibold flex items-center gap-1">
                          <AlertCircle className="h-3.5 w-3.5" />
                          {formErrors.phone}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <CreditCard className="h-3.5 w-3.5 text-primary" />
                        <span>CPF</span>
                        <span className="text-destructive">*</span>
                      </label>
                      <Input
                        value={patientCpf}
                        onChange={(e) => setPatientCpf(formatCpf(e.target.value))}
                        placeholder="000.000.000-00"
                        className="h-12 rounded-xl text-sm bg-card border-border"
                      />
                      {formErrors.cpf && (
                        <p className="text-xs text-destructive font-semibold flex items-center gap-1">
                          <AlertCircle className="h-3.5 w-3.5" />
                          {formErrors.cpf}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-primary" />
                        <span>Data de Nascimento</span>
                        <span className="text-destructive">*</span>
                      </label>
                      <Input
                        type="date"
                        value={patientBirthDate}
                        onChange={(e) => setPatientBirthDate(e.target.value)}
                        className="h-12 rounded-xl text-sm bg-card border-border"
                      />
                      {formErrors.birthDate && (
                        <p className="text-xs text-destructive font-semibold flex items-center gap-1">
                          <AlertCircle className="h-3.5 w-3.5" />
                          {formErrors.birthDate}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-primary" />
                        <span>E-mail (opcional)</span>
                      </label>
                      <Input
                        type="email"
                        value={patientEmail}
                        onChange={(e) => setPatientEmail(e.target.value)}
                        placeholder="seuemail@exemplo.com"
                        className="h-12 rounded-xl text-sm bg-card border-border"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5 text-primary" />
                      <span>Observações ou queixas para o Dr. Marcelo (opcional)</span>
                    </label>
                    <textarea
                      rows={2}
                      value={patientNotes}
                      onChange={(e) => setPatientNotes(e.target.value)}
                      placeholder="Ex: Já pratiquei Pilates antes; sinto dores lombares ao ficar muito tempo sentado..."
                      className="w-full p-4 rounded-xl border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 leading-relaxed resize-none transition-all"
                    />
                  </div>
                </div>

                {formErrors.submit && (
                  <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{formErrors.submit}</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>

          {/* Rodapé com Navegação */}
          <CardFooter className="p-6 sm:p-8 border-t border-border/60 bg-muted/10 flex items-center justify-between gap-4">
            <Button
              type="button"
              variant="outline"
              disabled={currentStepIndex === 0 || isSubmitting}
              onClick={handlePrevStep}
              className="rounded-xl px-5 h-12 text-xs font-bold border-border hover:bg-muted"
            >
              <ChevronLeft className="h-4 w-4 mr-1.5" />
              Voltar
            </Button>

            <Button
              type="button"
              disabled={isSubmitting}
              onClick={handleNextStep}
              className="rounded-xl px-7 h-12 text-xs font-black shadow-lg shadow-primary/25 flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Garantindo sua vaga...</span>
                </>
              ) : currentStepIndex === steps.length - 1 ? (
                <>
                  <span>Confirmar Agendamento</span>
                  <CheckCircle2 className="h-4 w-4" />
                </>
              ) : (
                <>
                  <span>Continuar para Próxima Etapa</span>
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </CardFooter>
        </Card>

        {/* Rodapé Seguro & Conformidade */}
        <div className="mt-8 text-center text-xs text-muted-foreground flex flex-col sm:flex-row items-center justify-center gap-4">
          <div className="flex items-center gap-1.5 font-medium">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span>Dados criptografados e protegidos em conformidade com a LGPD</span>
          </div>
          <span className="hidden sm:inline opacity-40">•</span>
          <div className="font-medium">
            Altar Fisio • Dr. Marcelo • Registro COFFITO / CREFITO-3
          </div>
        </div>
      </main>
    </div>
  )
}
