import React, { useState, useMemo } from "react"
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
  HelpCircle,
  FileText,
  AlertCircle,
  ArrowRight,
  ExternalLink,
  CalendarCheck,
  Share2,
} from "lucide-react"
import { formatDateBR, formatDateWithWeekdayBR, addDaysSafe, getTodayDateString } from "@/lib/dateUtils"

interface AnswerMap {
  [key: string]: string
}

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
  }, [config?.steps])

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

  // Próximos dias para seleção rápida no calendário
  const dateOptions = useMemo(() => {
    const dates = []
    const base = getTodayDateString()
    for (let i = 0; i < 14; i++) {
      const dStr = addDaysSafe(base, i)
      const parts = dStr.split("-")
      const dObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
      // Exclui domingos
      if (dObj.getDay() !== 0) {
        dates.push({
          dateStr: dStr,
          weekday: formatDateWithWeekdayBR(dStr).split(",")[0],
          dayMonth: `${parts[2]}/${parts[1]}`,
        })
      }
    }
    return dates
  }, [])

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
        errors.slot = "Por favor, selecione um horário disponível na grade."
      }
    } else if (currentStep.type === "patient_info") {
      if (!patientName.trim()) errors.name = "Nome completo é obrigatório."
      if (!patientPhone.trim() || patientPhone.replace(/\D/g, "").length < 10) {
        errors.phone = "Telefone celular válido com DDD é obrigatório."
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
      `Atendimento na Clínica Altar Fisio (Dr. Marcelo).\nEndereço: ${clinicSettings?.address || "Av. Paulista, 1000"}\nTelefone: ${clinicSettings?.phone || "(11) 98765-4321"}\nOrientações: Roupas confortáveis e meias antiderrapantes para Pilates.`
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
      `Olá, acabei de realizar meu agendamento de ${selectedSpecialty} no site da Altar Fisio para o dia ${formatDateBR(selectedDate)} às ${selectedSlot?.startTime || ""}. Meu nome é ${patientName}.`
    )
    return `https://wa.me/55${rawPhone}?text=${msg}`
  }, [clinicSettings?.phone, selectedSpecialty, selectedDate, selectedSlot, patientName])

  // ================= RENDER TELA DE SUCESSO =================
  if (bookingSuccessData) {
    const isPending = bookingSuccessData.requireApproval || bookingSuccessData.status === "pending_approval"
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background py-10 px-4 sm:px-6 flex flex-col items-center justify-center">
        <div className="w-full max-w-xl animate-scale-in">
          <Card className="border-border/60 shadow-xl overflow-hidden rounded-3xl">
            <div className="bg-primary/10 border-b border-primary/15 p-8 text-center relative">
              <div className="h-16 w-16 mx-auto rounded-3xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/20 mb-4 animate-bounce">
                <CheckCircle2 className="h-9 w-9" />
              </div>
              <Badge
                variant="outline"
                className={
                  isPending
                    ? "bg-amber-500/10 text-amber-600 border-amber-300 font-semibold px-3 py-1"
                    : "bg-emerald-500/10 text-emerald-600 border-emerald-300 font-semibold px-3 py-1"
                }
              >
                {isPending ? "Solicitação Recebida com Sucesso" : "Agendamento Confirmado!"}
              </Badge>
              <h1 className="text-2xl font-bold tracking-tight text-foreground mt-3">
                {isPending ? "Tudo Pronto! Recebemos seus Dados" : "Sua Vaga está Garantida!"}
              </h1>
              <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
                {config?.successMessage ||
                  "Seu agendamento foi registrado no sistema Altar Fisio. Enviamos a confirmação detalhada para o seu WhatsApp."}
              </p>
            </div>

            <CardContent className="p-6 sm:p-8 space-y-6">
              {/* Resumo do Agendamento */}
              <div className="rounded-2xl bg-muted/40 border border-border/70 p-5 space-y-3.5">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Resumo da Sessão
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-xs text-muted-foreground block">Paciente</span>
                    <span className="font-semibold text-foreground">{bookingSuccessData.patientName}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Modalidade</span>
                    <span className="font-semibold text-primary capitalize">{selectedSpecialty}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Data da Sessão</span>
                    <span className="font-semibold text-foreground">{formatDateBR(selectedDate)}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Horário Reservado</span>
                    <span className="font-semibold text-foreground">
                      {selectedSlot?.startTime} às {selectedSlot?.endTime}
                    </span>
                  </div>
                </div>
              </div>

              {/* Informações da Clínica & Dicas */}
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-primary/5 border border-primary/10">
                  <MapPin className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-foreground">Endereço da Clínica</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {clinicSettings?.address || "Av. Paulista, 1000 - Bela Vista, São Paulo - SP"}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-muted/50 border border-border/60">
                  <ShieldCheck className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="text-xs text-muted-foreground leading-relaxed">
                    <strong className="text-foreground">Orientações de Comparecimento:</strong> Para sessões
                    de Pilates Studio ou RPG, recomendamos roupas confortáveis e meias antiderrapantes.
                    Por favor, chegue com 10 minutos de antecedência.
                  </div>
                </div>
              </div>

              {/* Ações Rápidas */}
              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <a
                  href={getGoogleCalendarUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-card hover:bg-muted border border-border font-medium text-xs text-foreground transition-all shadow-sm"
                >
                  <CalendarCheck className="h-4 w-4 text-primary" />
                  <span>Salvar no Google Agenda</span>
                </a>

                <a
                  href={clinicWhatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition-all shadow-sm"
                >
                  <Phone className="h-4 w-4" />
                  <span>Falar no WhatsApp</span>
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
                  className="text-xs text-muted-foreground hover:text-foreground"
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

  // ================= RENDER FLUXO DO AGENDAMENTO =================
  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/30 via-background to-background text-foreground selection:bg-primary/20">
      {/* Top Header com Identidade da Clínica */}
      <header className="border-b border-border/60 bg-card/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
              <HeartPulse className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="font-bold text-base tracking-tight text-foreground flex items-center gap-1.5">
                {clinicSettings?.clinicName || "Altar Fisio"}
                <span className="text-xs font-normal text-muted-foreground hidden sm:inline">
                  • {clinicSettings?.clinicSubtitle || "Dr. Marcelo"}
                </span>
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3 text-primary/70" />
                <span className="truncate max-w-[240px] sm:max-w-none">
                  {clinicSettings?.address || "Av. Paulista, 1000 - São Paulo, SP"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[11px] font-semibold text-emerald-600 bg-emerald-500/10 border-emerald-300">
              <Sparkles className="h-3 w-3 mr-1" />
              Online 24h
            </Badge>
          </div>
        </div>
      </header>

      {/* Hero / Apresentação */}
      <main className="max-w-3xl mx-auto px-4 py-8 sm:py-10">
        <div className="text-center space-y-2 mb-8">
          <Badge variant="secondary" className="px-3 py-1 text-xs font-semibold rounded-full uppercase tracking-wider text-primary">
            Agendamento Rápido & Sem Espera
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            {config?.welcomeTitle || "Agende sua Consulta ou Aula"}
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
            {config?.welcomeMessage ||
              "Reserve seu horário no Studio de Pilates ou na Clínica de Fisioterapia em poucos passos com total comodidade."}
          </p>
        </div>

        {/* Barra de Progresso / Stepper */}
        {steps.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                Etapa {currentStepIndex + 1} de {steps.length}
              </span>
              <span className="text-xs font-semibold text-muted-foreground">
                {currentStep?.title}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {steps.map((s, idx) => (
                <div
                  key={s.id}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    idx < currentStepIndex
                      ? "bg-primary"
                      : idx === currentStepIndex
                      ? "bg-primary/80 ring-2 ring-primary/20"
                      : "bg-muted"
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Card do Passo Atual */}
        <Card className="border-border/70 shadow-lg rounded-3xl overflow-hidden bg-card">
          <CardHeader className="p-6 sm:p-8 border-b border-border/50 bg-muted/20">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary mb-1">
              <span>Etapa {currentStepIndex + 1}</span>
            </div>
            <CardTitle className="text-xl sm:text-2xl font-bold text-foreground">
              {currentStep?.title}
            </CardTitle>
            {currentStep?.description && (
              <CardDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed mt-1">
                {currentStep.description}
              </CardDescription>
            )}
          </CardHeader>

          <CardContent className="p-6 sm:p-8 space-y-6">
            {/* ================= ETAPA 1: TRIAGEM DINÂMICA ================= */}
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
                        className="space-y-2 p-4 rounded-2xl bg-muted/20 border border-border/50 transition-all animate-fade-in"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                            {field.label}
                            {field.required && <span className="text-destructive">*</span>}
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
                                className={`py-3 px-4 rounded-xl border text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                                  answers[field.id] === opt
                                    ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20 scale-[1.01]"
                                    : "bg-card hover:bg-muted border-border text-foreground"
                                }`}
                              >
                                {opt === "Sim" ? "✓ Sim" : "✕ Não"}
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
                              className="h-11 rounded-xl bg-card text-sm"
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
                              className="h-11 rounded-xl bg-card text-sm"
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
                              className="w-full p-3.5 rounded-xl border border-input bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 leading-relaxed resize-none"
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

            {/* ================= ETAPA 2: ESCOLHA DE SERVIÇO, DATA E HORÁRIO ================= */}
            {currentStep?.type === "slot_picker" && (
              <div className="space-y-6">
                {/* Seleção de Modalidade */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                    1. Escolha a Especialidade
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: "pilates", label: "Studio Pilates", desc: "Aparelhos & Solo" },
                      { id: "fisioterapia", label: "Fisioterapia", desc: "Ortopedia & Coluna" },
                      { id: "rpg", label: "RPG", desc: "Postura & Cadeias" },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setSelectedSpecialty(m.id as any)
                          setSelectedSlot(null)
                        }}
                        className={`p-3.5 rounded-2xl border text-left transition-all ${
                          selectedSpecialty === m.id
                            ? "bg-primary/10 border-primary text-foreground shadow-sm ring-1 ring-primary/30"
                            : "bg-card hover:bg-muted/60 border-border text-muted-foreground"
                        }`}
                      >
                        <div className="font-bold text-sm text-foreground">{m.label}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">{m.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Seletor de Data */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                    2. Escolha o Dia
                  </label>
                  <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-thin">
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
                          className={`shrink-0 p-3 rounded-2xl border flex flex-col items-center justify-center min-w-[76px] transition-all ${
                            isSelected
                              ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20 scale-[1.02]"
                              : "bg-card hover:bg-muted border-border text-foreground"
                          }`}
                        >
                          <span className="text-[11px] font-medium uppercase opacity-80">
                            {item.weekday}
                          </span>
                          <span className="text-base font-extrabold mt-0.5">{item.dayMonth}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Grade de Horários Livres */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                      3. Horários Disponíveis para {formatDateBR(selectedDate)}
                    </label>
                    <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-primary" />
                      Sessões de 55min
                    </span>
                  </div>

                  {formErrors.slot && (
                    <p className="text-xs font-semibold text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {formErrors.slot}
                    </p>
                  )}

                  {!availableSlots ? (
                    <div className="py-12 text-center text-xs text-muted-foreground animate-pulse">
                      Consultando disponibilidade na clínica em tempo real...
                    </div>
                  ) : availableSlots.length === 0 ? (
                    <div className="py-10 text-center text-xs text-muted-foreground bg-muted/20 rounded-2xl border border-dashed">
                      Nenhum horário disponível para esta data. Por favor, selecione outro dia.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                      {availableSlots.map((slot) => {
                        const isSelected = selectedSlot?.startTime === slot.startTime
                        const firstRoom = slot.rooms[0]

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
                            className={`p-3 rounded-2xl border text-left transition-all relative flex flex-col justify-between min-h-[72px] ${
                              !slot.isAvailable
                                ? "opacity-40 bg-muted/30 border-dashed cursor-not-allowed"
                                : isSelected
                                ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20 scale-[1.02]"
                                : "bg-card hover:bg-muted/70 border-border text-foreground"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-extrabold text-sm">{slot.startTime}</span>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                                  isSelected
                                    ? "bg-primary-foreground/20 text-primary-foreground"
                                    : "bg-emerald-500/10 text-emerald-600 border border-emerald-300/60"
                                }`}
                              >
                                {slot.totalAvailableSpots > 1
                                  ? `${slot.totalAvailableSpots} vagas`
                                  : "1 vaga"}
                              </span>
                            </div>
                            <div
                              className={`text-[11px] truncate mt-1.5 ${
                                isSelected ? "text-primary-foreground/90" : "text-muted-foreground"
                              }`}
                            >
                              {firstRoom?.roomName || "Sala Principal"}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ================= ETAPA 3: DADOS DO PACIENTE ================= */}
            {currentStep?.type === "patient_info" && (
              <div className="space-y-4">
                <div className="rounded-2xl bg-primary/5 border border-primary/15 p-4 flex items-center gap-3">
                  <CalendarCheck className="h-5 w-5 text-primary shrink-0" />
                  <div className="text-xs text-muted-foreground">
                    Você está reservando:{" "}
                    <strong className="text-foreground capitalize">{selectedSpecialty}</strong> no dia{" "}
                    <strong className="text-foreground">{formatDateBR(selectedDate)}</strong> às{" "}
                    <strong className="text-foreground">{selectedSlot?.startTime}</strong>.
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Nome Completo <span className="text-destructive">*</span>
                  </label>
                  <Input
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    placeholder="Ex: Maria Silva Santos"
                    className="h-11 rounded-xl text-sm"
                  />
                  {formErrors.name && (
                    <p className="text-xs text-destructive font-medium">{formErrors.name}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      WhatsApp / Celular <span className="text-destructive">*</span>
                    </label>
                    <Input
                      value={patientPhone}
                      onChange={(e) => setPatientPhone(formatPhone(e.target.value))}
                      placeholder="(11) 98765-4321"
                      className="h-11 rounded-xl text-sm"
                    />
                    {formErrors.phone && (
                      <p className="text-xs text-destructive font-medium">{formErrors.phone}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      CPF <span className="text-destructive">*</span>
                    </label>
                    <Input
                      value={patientCpf}
                      onChange={(e) => setPatientCpf(formatCpf(e.target.value))}
                      placeholder="000.000.000-00"
                      className="h-11 rounded-xl text-sm"
                    />
                    {formErrors.cpf && (
                      <p className="text-xs text-destructive font-medium">{formErrors.cpf}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      Data de Nascimento <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="date"
                      value={patientBirthDate}
                      onChange={(e) => setPatientBirthDate(e.target.value)}
                      className="h-11 rounded-xl text-sm"
                    />
                    {formErrors.birthDate && (
                      <p className="text-xs text-destructive font-medium">{formErrors.birthDate}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">E-mail (opcional)</label>
                    <Input
                      type="email"
                      value={patientEmail}
                      onChange={(e) => setPatientEmail(e.target.value)}
                      placeholder="seuemail@exemplo.com"
                      className="h-11 rounded-xl text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Observações adicionais para o Dr. Marcelo (opcional)
                  </label>
                  <textarea
                    rows={2}
                    value={patientNotes}
                    onChange={(e) => setPatientNotes(e.target.value)}
                    placeholder="Ex: Tenho cirurgia recente no ombro, prefiro horários mais calmos..."
                    className="w-full p-3.5 rounded-xl border border-input bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 leading-relaxed resize-none"
                  />
                </div>

                {formErrors.submit && (
                  <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{formErrors.submit}</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>

          {/* Rodapé com Navegação */}
          <CardFooter className="p-6 sm:p-8 border-t border-border/50 bg-muted/10 flex items-center justify-between gap-4">
            <Button
              type="button"
              variant="outline"
              disabled={currentStepIndex === 0 || isSubmitting}
              onClick={handlePrevStep}
              className="rounded-xl px-5 h-11 text-xs font-semibold"
            >
              <ChevronLeft className="h-4 w-4 mr-1.5" />
              Voltar
            </Button>

            <Button
              type="button"
              disabled={isSubmitting}
              onClick={handleNextStep}
              className="rounded-xl px-7 h-11 text-xs font-bold shadow-md shadow-primary/20 flex items-center gap-2"
            >
              {isSubmitting ? (
                <span>Confirmando vaga...</span>
              ) : currentStepIndex === steps.length - 1 ? (
                <>
                  <span>Finalizar Agendamento</span>
                  <CheckCircle2 className="h-4 w-4" />
                </>
              ) : (
                <>
                  <span>Continuar</span>
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </CardFooter>
        </Card>

        {/* Rodapé Seguro & Conformidade */}
        <div className="mt-8 text-center text-xs text-muted-foreground flex flex-col sm:flex-row items-center justify-center gap-4">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span>Dados protegidos em conformidade com a LGPD</span>
          </div>
          <span className="hidden sm:inline">•</span>
          <div>Altar Fisio • Registro COFFITO / CREFITO-3</div>
        </div>
      </main>
    </div>
  )
}
