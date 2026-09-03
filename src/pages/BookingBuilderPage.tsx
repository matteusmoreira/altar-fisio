import React, { useState, useEffect, useMemo } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@convex/_generated/api"
import { useTheme } from "@/contexts/ThemeContext"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select } from "@/components/ui/select-native"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Sparkles,
  Link2,
  Copy,
  ExternalLink,
  Plus,
  Trash2,
  Edit2,
  RotateCcw,
  CheckCircle2,
  Clock,
  User,
  Phone,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  Check,
  X,
  Settings2,
  Layers,
  ArrowUp,
  ArrowDown,
  Smartphone,
  Monitor,
  HeartPulse,
  Calendar,
  ChevronRight,
  ChevronLeft,
  Share2,
  Info,
  CalendarCheck,
} from "lucide-react"

interface BookingStep {
  id: string
  title: string
  description: string
  order: number
  type: "intake_form" | "slot_picker" | "patient_info"
}

interface BookingField {
  id: string
  stepId: string
  label: string
  type: "yes_no" | "select" | "text" | "textarea" | "multiselect"
  options?: string[]
  required: boolean
  order: number
  placeholder?: string
  helpText?: string
  conditional?: {
    dependsOnFieldId: string
    equalsValue: string
  }
}

export const BookingBuilderPage: React.FC = () => {
  const { theme } = useTheme()
  const config = useQuery(api.bookingBuilder.getBookingConfig)
  const clinicSettings = useQuery(api.clinic.getSettings)
  const updateConfig = useMutation(api.bookingBuilder.updateBookingConfig)
  const resetConfig = useMutation(api.bookingBuilder.resetBookingConfigToDefault)

  // Feedback Toast
  const [feedback, setFeedback] = useState<string | null>(null)
  const showToast = (msg: string) => {
    setFeedback(msg)
    setTimeout(() => setFeedback(null), 3500)
  }

  // Estado Local das Configurações
  const [requireApproval, setRequireApproval] = useState(false)
  const [welcomeTitle, setWelcomeTitle] = useState("")
  const [welcomeMessage, setWelcomeMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [isSavingGeneral, setIsSavingGeneral] = useState(false)

  // Viewport do Live Preview: "mobile" | "desktop"
  const [previewDevice, setPreviewDevice] = useState<"mobile" | "desktop">("mobile")
  const [previewStepIndex, setPreviewStepIndex] = useState(0)
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, string>>({})
  const [previewService, setPreviewService] = useState("pilates")
  const [previewSlot, setPreviewSlot] = useState("09:00")

  // Modal de Edição de Etapa
  const [editingStep, setEditingStep] = useState<{
    id: string
    title: string
    description: string
  } | null>(null)

  // Modal de Adicionar / Editar Pergunta
  const [isFieldModalOpen, setIsFieldModalOpen] = useState(false)
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null)
  const [fieldStepId, setFieldStepId] = useState("step_triagem")
  const [fieldLabel, setFieldLabel] = useState("")
  const [fieldType, setFieldType] = useState<"yes_no" | "select" | "text" | "textarea" | "multiselect">("select")
  const [fieldOptionsText, setFieldOptionsText] = useState("")
  const [fieldRequired, setFieldRequired] = useState(true)
  const [fieldPlaceholder, setFieldPlaceholder] = useState("")
  const [fieldHelpText, setFieldHelpText] = useState("")
  const [fieldHasCondition, setFieldHasCondition] = useState(false)
  const [fieldDependsOn, setFieldDependsOn] = useState("")
  const [fieldEqualsValue, setFieldEqualsValue] = useState("Sim")

  // Sincroniza do Convex ao carregar
  useEffect(() => {
    if (config) {
      setRequireApproval(config.requireApproval)
      setWelcomeTitle(config.welcomeTitle || "Agende sua Consulta ou Sessão")
      setWelcomeMessage(
        config.welcomeMessage ||
          "Bem-vindo à Altar Fisio (Dr. Marcelo). Escolha o serviço, tire suas dúvidas e reserve seu horário online com rapidez e comodidade."
      )
      setSuccessMessage(
        config.successMessage ||
          "Seu agendamento foi registrado com sucesso! Entraremos em contato via WhatsApp com os detalhes da sua sessão."
      )
    }
  }, [config])

  // Link público base
  const publicUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/agendar`
      : "https://altarfisio.com.br/agendar"

  const handleCopyLink = (urlToCopy: string) => {
    navigator.clipboard.writeText(urlToCopy)
    showToast("Link copiado para a área de transferência!")
  }

  // Salvar Textos e Configurações Gerais
  const handleSaveGeneralConfig = async () => {
    if (!config) return
    setIsSavingGeneral(true)
    try {
      await updateConfig({
        requireApproval,
        steps: config.steps,
        fields: config.fields,
        welcomeTitle,
        welcomeMessage,
        successMessage,
      })
      showToast("Configurações salvas com sucesso!")
    } catch (err: any) {
      showToast("Erro ao salvar: " + (err?.message || "Tente novamente"))
    } finally {
      setIsSavingGeneral(false)
    }
  }

  // Salvar Edição de Etapa
  const handleSaveStep = async () => {
    if (!config || !editingStep) return
    const updatedSteps = config.steps.map((s) =>
      s.id === editingStep.id
        ? { ...s, title: editingStep.title.trim(), description: editingStep.description.trim() }
        : s
    )
    try {
      await updateConfig({
        requireApproval,
        steps: updatedSteps,
        fields: config.fields,
        welcomeTitle,
        welcomeMessage,
        successMessage,
      })
      setEditingStep(null)
      showToast("Etapa atualizada com sucesso!")
    } catch (err: any) {
      showToast("Erro ao atualizar etapa: " + (err?.message || "Tente novamente"))
    }
  }

  // Reordenar Etapa (Subir/Descer)
  const handleMoveStep = async (stepIndex: number, direction: "up" | "down") => {
    if (!config) return
    const newSteps = [...config.steps]
    const targetIndex = direction === "up" ? stepIndex - 1 : stepIndex + 1
    if (targetIndex < 0 || targetIndex >= newSteps.length) return

    const temp = newSteps[stepIndex]
    newSteps[stepIndex] = newSteps[targetIndex]
    newSteps[targetIndex] = temp

    const orderedSteps = newSteps.map((s, idx) => ({ ...s, order: idx + 1 }))

    try {
      await updateConfig({
        requireApproval,
        steps: orderedSteps,
        fields: config.fields,
        welcomeTitle,
        welcomeMessage,
        successMessage,
      })
      showToast("Ordem das etapas atualizada!")
    } catch (err: any) {
      showToast("Erro ao reordenar: " + (err?.message || "Tente novamente"))
    }
  }

  // Abrir Modal de Nova Pergunta
  const handleOpenNewField = () => {
    setEditingFieldId(null)
    setFieldStepId("step_triagem")
    setFieldLabel("")
    setFieldType("select")
    setFieldOptionsText("Opção 1, Opção 2, Opção 3")
    setFieldRequired(true)
    setFieldPlaceholder("")
    setFieldHelpText("")
    setFieldHasCondition(false)
    setFieldDependsOn(config?.fields?.[0]?.id || "")
    setFieldEqualsValue("Sim")
    setIsFieldModalOpen(true)
  }

  // Abrir Modal para Editar Pergunta
  const handleEditField = (field: BookingField) => {
    setEditingFieldId(field.id)
    setFieldStepId(field.stepId)
    setFieldLabel(field.label)
    setFieldType(field.type)
    setFieldOptionsText(field.options?.join(", ") || "")
    setFieldRequired(field.required)
    setFieldPlaceholder(field.placeholder || "")
    setFieldHelpText(field.helpText || "")
    if (field.conditional) {
      setFieldHasCondition(true)
      setFieldDependsOn(field.conditional.dependsOnFieldId)
      setFieldEqualsValue(field.conditional.equalsValue)
    } else {
      setFieldHasCondition(false)
      setFieldDependsOn(config?.fields?.[0]?.id || "")
      setFieldEqualsValue("Sim")
    }
    setIsFieldModalOpen(true)
  }

  // Salvar Pergunta no Construtor
  const handleSaveField = async () => {
    if (!config || !fieldLabel.trim()) return

    const parsedOptions =
      fieldType === "select" || fieldType === "multiselect"
        ? fieldOptionsText
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined

    const conditional =
      fieldHasCondition && fieldDependsOn
        ? {
            dependsOnFieldId: fieldDependsOn,
            equalsValue: fieldEqualsValue,
          }
        : undefined

    let updatedFields = [...config.fields]

    if (editingFieldId) {
      updatedFields = updatedFields.map((f) =>
        f.id === editingFieldId
          ? {
              ...f,
              stepId: fieldStepId,
              label: fieldLabel.trim(),
              type: fieldType,
              options: parsedOptions,
              required: fieldRequired,
              placeholder: fieldPlaceholder.trim() || undefined,
              helpText: fieldHelpText.trim() || undefined,
              conditional,
            }
          : f
      )
    } else {
      const newId = "field_" + Date.now().toString(36)
      updatedFields.push({
        id: newId,
        stepId: fieldStepId,
        label: fieldLabel.trim(),
        type: fieldType,
        options: parsedOptions,
        required: fieldRequired,
        order: updatedFields.length + 1,
        placeholder: fieldPlaceholder.trim() || undefined,
        helpText: fieldHelpText.trim() || undefined,
        conditional,
      })
    }

    try {
      await updateConfig({
        requireApproval,
        steps: config.steps,
        fields: updatedFields,
        welcomeTitle,
        welcomeMessage,
        successMessage,
      })
      setIsFieldModalOpen(false)
      showToast(editingFieldId ? "Pergunta atualizada!" : "Nova pergunta adicionada!")
    } catch (err: any) {
      showToast("Erro ao salvar pergunta: " + (err?.message || "Tente novamente"))
    }
  }

  // Excluir Pergunta
  const handleDeleteField = async (fieldId: string) => {
    if (!config) return
    const updatedFields = config.fields.filter((f) => f.id !== fieldId)
    try {
      await updateConfig({
        requireApproval,
        steps: config.steps,
        fields: updatedFields,
        welcomeTitle,
        welcomeMessage,
        successMessage,
      })
      showToast("Pergunta removida.")
    } catch (err: any) {
      showToast("Erro ao remover: " + (err?.message || "Tente novamente"))
    }
  }

  // Restaurar Padrão Clínico
  const handleResetDefault = async () => {
    if (
      !confirm(
        "Deseja restaurar as perguntas para o padrão clínico Altar Fisio (Plano de Saúde condicional, Queixa, EVA, etc.)?"
      )
    ) {
      return
    }
    try {
      await resetConfig()
      showToast("Padrão clínico restaurado com sucesso!")
    } catch (err: any) {
      showToast("Erro ao restaurar: " + (err?.message || "Tente novamente"))
    }
  }

  // Etapas ordenadas para o Live Preview
  const orderedSteps = useMemo(() => {
    if (!config?.steps) return []
    return [...config.steps].sort((a, b) => a.order - b.order)
  }, [config?.steps])

  const activePreviewStep = orderedSteps[previewStepIndex] || orderedSteps[0]

  // Avaliação de visibilidade condicional dentro do Live Preview
  const isFieldVisibleInPreview = (field: BookingField): boolean => {
    if (!field.conditional) return true
    const parentAnswer = previewAnswers[field.conditional.dependsOnFieldId]
    return parentAnswer === field.conditional.equalsValue
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Toast Feedback */}
      {feedback && (
        <div className="fixed top-4 right-4 z-50 bg-foreground text-background px-4 py-3 rounded-2xl shadow-xl text-xs font-semibold flex items-center gap-2 animate-scale-in">
          <Sparkles className="h-4 w-4 text-primary" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Top Header da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <span>Construtor de Agendamento Online</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Personalize os links de divulgação, etapas do fluxo, perguntas da triagem e veja a simulação em tempo real.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetDefault}
            className="rounded-xl text-xs font-semibold gap-1.5 h-9"
            title="Restaurar padrão clínico"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Restaurar Padrão</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(publicUrl, "_blank")}
            className="rounded-xl text-xs font-semibold gap-1.5 h-9"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>Abrir Página Pública</span>
          </Button>

          <Button
            size="sm"
            onClick={() => handleCopyLink(publicUrl)}
            className="rounded-xl text-xs font-bold gap-1.5 h-9 shadow-sm shadow-primary/20"
          >
            <Copy className="h-3.5 w-3.5" />
            <span>Copiar Link Principal</span>
          </Button>
        </div>
      </div>

      {/* Grid Principal: Split Screen (Controles à Esquerda e Live Preview à Direita) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* ========================================================================= */}
        {/* COLUNA ESQUERDA: CONTROLES & CONFIGURAÇÕES (xl:col-span-7)               */}
        {/* ========================================================================= */}
        <div className="xl:col-span-7 space-y-6">
          {/* Card 1: Links de Divulgação e Campanhas */}
          <Card className="border-border/70 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="p-5 border-b border-border/50 bg-primary/5">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Link2 className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-foreground">
                    Links de Divulgação & Campanhas
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Divulgue na bio do Instagram, WhatsApp ou use em campanhas segmentadas por serviço.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-5 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Link Geral */}
                <div className="p-3.5 rounded-xl bg-muted/20 border border-border/60 flex flex-col justify-between space-y-2">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">Link Geral</span>
                      <Badge variant="secondary" className="text-[10px]">Todos</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">Página com todos os serviços e profissionais.</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyLink(publicUrl)}
                    className="w-full text-xs font-semibold gap-1 h-8"
                  >
                    <Copy className="h-3 w-3" />
                    <span>Copiar Link</span>
                  </Button>
                </div>

                {/* Link Pilates */}
                <div className="p-3.5 rounded-xl bg-muted/20 border border-border/60 flex flex-col justify-between space-y-2">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">Studio Pilates</span>
                      <Badge variant="outline" className="text-[10px] text-primary border-primary/30">Pilates</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">Direciona automaticamente para turmas de Pilates.</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyLink(`${publicUrl}?servico=pilates`)}
                    className="w-full text-xs font-semibold gap-1 h-8"
                  >
                    <Copy className="h-3 w-3" />
                    <span>Copiar Link</span>
                  </Button>
                </div>

                {/* Link Fisioterapia */}
                <div className="p-3.5 rounded-xl bg-muted/20 border border-border/60 flex flex-col justify-between space-y-2">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">Fisioterapia</span>
                      <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300">Fisio</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">Direciona para avaliação e reabilitação física.</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyLink(`${publicUrl}?servico=fisioterapia`)}
                    className="w-full text-xs font-semibold gap-1 h-8"
                  >
                    <Copy className="h-3 w-3" />
                    <span>Copiar Link</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Modo Híbrido & Textos do Cabeçalho */}
          <Card className="border-border/70 shadow-sm rounded-2xl">
            <CardHeader className="p-5 border-b border-border/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Settings2 className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-foreground">
                      Modo de Aprovação & Textos do Portal
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                      Configure como os agendamentos são recebidos e a mensagem inicial do paciente.
                    </CardDescription>
                  </div>
                </div>

                <Button
                  size="sm"
                  disabled={isSavingGeneral}
                  onClick={handleSaveGeneralConfig}
                  className="rounded-xl text-xs font-bold shadow-sm"
                >
                  {isSavingGeneral ? "Salvando..." : "Salvar Textos"}
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-5 space-y-4">
              {/* Seletor do Modo Híbrido */}
              <div className="p-3.5 rounded-xl border border-border/70 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-foreground flex items-center gap-2">
                    <span>Modo de Confirmação:</span>
                    <Badge
                      variant={requireApproval ? "outline" : "default"}
                      className={
                        requireApproval
                          ? "text-amber-600 border-amber-300 bg-amber-500/10"
                          : "text-emerald-600 border-emerald-300 bg-emerald-500/10"
                      }
                    >
                      {requireApproval ? "Requer Aprovação Manual" : "Auto-Confirmação Imediata"}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground max-w-lg">
                    {requireApproval
                      ? "As solicitações entram como pendentes para a recepção validar antes de ocupar a agenda."
                      : "A vaga na sala e agenda do profissional é alocada e confirmada imediatamente."}
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setRequireApproval(!requireApproval)}
                  className="rounded-xl text-xs font-semibold shrink-0"
                >
                  {requireApproval ? "Mudar para Auto-Confirmação" : "Mudar para Manual"}
                </Button>
              </div>

              {/* Título e Mensagem de Sucesso */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Título Principal</label>
                  <Input
                    value={welcomeTitle}
                    onChange={(e) => setWelcomeTitle(e.target.value)}
                    placeholder="Ex: Agende sua Consulta ou Sessão"
                    className="h-9 rounded-xl text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Mensagem de Sucesso</label>
                  <Input
                    value={successMessage}
                    onChange={(e) => setSuccessMessage(e.target.value)}
                    placeholder="Ex: Seu agendamento foi registrado com sucesso!..."
                    className="h-9 rounded-xl text-xs"
                  />
                </div>
              </div>

              {/* Descrição / Subtítulo */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>Descrição / Subtítulo da Página Pública</span>
                  <span className="text-[10px] text-muted-foreground">Exibido no topo do portal</span>
                </label>
                <textarea
                  rows={2}
                  value={welcomeMessage}
                  onChange={(e) => setWelcomeMessage(e.target.value)}
                  placeholder="Ex: Bem-vindo à Altar Fisio (Dr. Marcelo)..."
                  className="w-full p-2.5 rounded-xl border border-input bg-card text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 leading-relaxed resize-none"
                />
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Gerenciador de Etapas */}
          <Card className="border-border/70 shadow-sm rounded-2xl">
            <CardHeader className="p-5 border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Layers className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-foreground">
                    Etapas do Fluxo de Agendamento
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Reordene ou edite o título e a descrição de cada etapa exibida para o paciente.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-5 space-y-3">
              {config?.steps?.map((step, idx) => (
                <div
                  key={step.id}
                  className="p-3.5 rounded-xl border border-border/70 bg-card hover:border-primary/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px] font-bold">
                        Etapa {idx + 1}
                      </Badge>
                      <span className="font-bold text-xs text-foreground">{step.title}</span>
                      <Badge variant="outline" className="text-[9px] text-muted-foreground">
                        {step.type === "intake_form"
                          ? "Formulário Clínico"
                          : step.type === "slot_picker"
                          ? "Horário & Vaga"
                          : "Dados Pessoais"}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {step.description || "Sem descrição definida."}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={idx === 0}
                      onClick={() => handleMoveStep(idx, "up")}
                      className="h-8 w-8 p-0 rounded-lg"
                      title="Mover para cima"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      disabled={idx === (config?.steps?.length || 0) - 1}
                      onClick={() => handleMoveStep(idx, "down")}
                      className="h-8 w-8 p-0 rounded-lg"
                      title="Mover para baixo"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setEditingStep({
                          id: step.id,
                          title: step.title,
                          description: step.description || "",
                        })
                      }
                      className="rounded-xl text-xs font-semibold gap-1 h-8"
                    >
                      <Edit2 className="h-3 w-3" />
                      <span>Editar</span>
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Card 4: Perguntas & Regras Condicionais da Triagem */}
          <Card className="border-border/70 shadow-sm rounded-2xl">
            <CardHeader className="p-5 border-b border-border/50">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-foreground">
                      Perguntas da Triagem Clínica & Regras Condicionais
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                      Perguntas exibidas no formulário do paciente, com lógica inteligente de exibição.
                    </CardDescription>
                  </div>
                </div>

                <Button
                  size="sm"
                  onClick={handleOpenNewField}
                  className="rounded-xl text-xs font-bold gap-1.5 h-9 shadow-sm shadow-primary/20 shrink-0"
                >
                  <Plus className="h-4 w-4" />
                  <span>Nova Pergunta</span>
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-5 space-y-3">
              {config?.fields?.map((field, idx) => {
                const hasCondition = !!field.conditional
                const parentField = hasCondition
                  ? config.fields.find((f) => f.id === field.conditional?.dependsOnFieldId)
                  : null

                return (
                  <div
                    key={field.id}
                    className="p-3.5 rounded-xl bg-card border border-border/70 hover:border-primary/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-muted-foreground">#{idx + 1}</span>
                        <span className="text-xs font-bold text-foreground">{field.label}</span>
                        <Badge variant="secondary" className="text-[9px] uppercase font-semibold">
                          {field.type === "yes_no"
                            ? "Sim / Não"
                            : field.type === "select"
                            ? "Lista (Dropdown)"
                            : field.type === "textarea"
                            ? "Texto Longo"
                            : "Texto Curto"}
                        </Badge>
                        {field.required ? (
                          <Badge variant="outline" className="text-[9px] text-destructive border-destructive/30">
                            Obrigatória
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] text-muted-foreground">
                            Opcional
                          </Badge>
                        )}
                      </div>

                      {hasCondition && (
                        <div className="text-[11px] text-primary font-medium flex items-center gap-1.5 bg-primary/5 px-2 py-0.5 rounded-md border border-primary/10 w-fit">
                          <Sparkles className="h-3 w-3" />
                          <span>
                            Exibida se:{" "}
                            <strong>
                              "{parentField?.label || field.conditional?.dependsOnFieldId}" = "
                              {field.conditional?.equalsValue}"
                            </strong>
                          </span>
                        </div>
                      )}

                      {field.options && field.options.length > 0 && (
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                          <span className="font-semibold text-foreground/80">Opções:</span>
                          <span className="truncate max-w-sm">{field.options.join(" • ")}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditField(field)}
                        className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground"
                        title="Editar pergunta"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteField(field.id)}
                        className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-destructive"
                        title="Remover pergunta"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>

        {/* ========================================================================= */}
        {/* COLUNA DIREITA: LIVE PREVIEW EM TEMPO REAL (xl:col-span-5, sticky)       */}
        {/* ========================================================================= */}
        <div className="xl:col-span-5 sticky top-20 space-y-4">
          {/* Barra de Controle do Simulador */}
          <div className="p-3.5 rounded-2xl bg-card border border-border/80 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-bold text-foreground">Live Preview Interativo</span>
            </div>

            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/60">
              <button
                type="button"
                onClick={() => setPreviewDevice("mobile")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  previewDevice === "mobile"
                    ? "bg-background text-foreground shadow-2xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Visualização Mobile"
              >
                <Smartphone className="h-3.5 w-3.5" />
                <span>Mobile</span>
              </button>

              <button
                type="button"
                onClick={() => setPreviewDevice("desktop")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  previewDevice === "desktop"
                    ? "bg-background text-foreground shadow-2xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Visualização Desktop"
              >
                <Monitor className="h-3.5 w-3.5" />
                <span>Desktop</span>
              </button>
            </div>
          </div>

          {/* Container do Simulador */}
          <div className="flex justify-center w-full">
            {previewDevice === "mobile" ? (
              /* ================= MOCKUP SMARTPHONE ================= */
              <div className="w-[360px] max-w-full rounded-[38px] border-[7px] border-border/80 bg-background shadow-2xl overflow-hidden flex flex-col transition-all">
                {/* Smartphone Notch / Header bar */}
                <div className="h-6 bg-card flex items-center justify-center relative border-b border-border/40">
                  <div className="w-20 h-3.5 bg-muted/80 rounded-full"></div>
                </div>

                {/* Tela do Celular com Conteúdo */}
                <div className="p-4 max-h-[640px] overflow-y-auto space-y-4 text-xs">
                  {/* Topo da Clínica */}
                  <div className="text-center space-y-1.5 pb-3 border-b border-border/50">
                    <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center mx-auto shadow-2xs">
                      <HeartPulse className="h-5 w-5" />
                    </div>
                    <h3 className="font-bold text-sm text-foreground leading-tight">
                      {welcomeTitle || "Agende sua Consulta"}
                    </h3>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {welcomeMessage}
                    </p>
                  </div>

                  {/* Indicador de Etapas */}
                  <div className="flex items-center justify-between gap-1 pt-1">
                    {orderedSteps.map((step, idx) => (
                      <button
                        key={step.id}
                        type="button"
                        onClick={() => setPreviewStepIndex(idx)}
                        className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-bold transition-all text-center truncate ${
                          idx === previewStepIndex
                            ? "bg-primary text-primary-foreground shadow-2xs"
                            : "bg-muted/40 text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {idx + 1}. {step.title.split(" ")[0]}
                      </button>
                    ))}
                  </div>

                  {/* Detalhes da Etapa Atual */}
                  {activePreviewStep && (
                    <div className="p-2.5 rounded-xl bg-muted/20 border border-border/50">
                      <div className="font-bold text-[11px] text-foreground">
                        {activePreviewStep.title}
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {activePreviewStep.description}
                      </p>
                    </div>
                  )}

                  {/* Conteúdo Dinâmico por Tipo de Etapa */}
                  {activePreviewStep?.type === "intake_form" && (
                    <div className="space-y-3">
                      {config?.fields?.map((field) => {
                        const isVisible = isFieldVisibleInPreview(field)
                        if (!isVisible) return null

                        return (
                          <div key={field.id} className="space-y-1 animate-fade-in">
                            <label className="text-[11px] font-semibold text-foreground flex items-center justify-between">
                              <span>{field.label}</span>
                              {field.required && (
                                <span className="text-[9px] text-destructive font-bold">*</span>
                              )}
                            </label>

                            {field.type === "yes_no" ? (
                              <div className="grid grid-cols-2 gap-2">
                                {["Sim", "Não"].map((opt) => {
                                  const isSelected = previewAnswers[field.id] === opt
                                  return (
                                    <button
                                      key={opt}
                                      type="button"
                                      onClick={() =>
                                        setPreviewAnswers((prev) => ({
                                          ...prev,
                                          [field.id]: opt,
                                        }))
                                      }
                                      className={`py-1.5 px-3 rounded-lg border text-xs font-semibold transition-all ${
                                        isSelected
                                          ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                                          : "bg-card border-border hover:bg-muted/50 text-foreground"
                                      }`}
                                    >
                                      {opt}
                                    </button>
                                  )
                                })}
                              </div>
                            ) : field.type === "select" ? (
                              <Select
                                value={previewAnswers[field.id] || ""}
                                onChange={(e) =>
                                  setPreviewAnswers((prev) => ({
                                    ...prev,
                                    [field.id]: e.target.value,
                                  }))
                                }
                                className="h-8 text-xs rounded-lg"
                              >
                                <option value="">{field.placeholder || "Selecione..."}</option>
                                {field.options?.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </Select>
                            ) : field.type === "textarea" ? (
                              <textarea
                                rows={2}
                                value={previewAnswers[field.id] || ""}
                                onChange={(e) =>
                                  setPreviewAnswers((prev) => ({
                                    ...prev,
                                    [field.id]: e.target.value,
                                  }))
                                }
                                placeholder={field.placeholder || "Digite aqui..."}
                                className="w-full p-2 rounded-lg border border-input bg-card text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed resize-none"
                              />
                            ) : (
                              <Input
                                value={previewAnswers[field.id] || ""}
                                onChange={(e) =>
                                  setPreviewAnswers((prev) => ({
                                    ...prev,
                                    [field.id]: e.target.value,
                                  }))
                                }
                                placeholder={field.placeholder || "Preencha..."}
                                className="h-8 text-xs rounded-lg"
                              />
                            )}

                            {field.helpText && (
                              <p className="text-[9px] text-muted-foreground">{field.helpText}</p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {activePreviewStep?.type === "slot_picker" && (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <span className="text-[11px] font-semibold text-foreground">Especialidade:</span>
                        <div className="grid grid-cols-3 gap-1.5">
                          {[
                            { id: "pilates", label: "Pilates" },
                            { id: "fisioterapia", label: "Fisioterapia" },
                            { id: "rpg", label: "RPG" },
                          ].map((serv) => (
                            <button
                              key={serv.id}
                              type="button"
                              onClick={() => setPreviewService(serv.id)}
                              className={`py-1.5 px-2 rounded-lg text-[10px] font-bold border truncate transition-all ${
                                previewService === serv.id
                                  ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                                  : "bg-card border-border text-foreground hover:bg-muted"
                              }`}
                            >
                              {serv.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[11px] font-semibold text-foreground">Horários Disponíveis:</span>
                        <div className="grid grid-cols-2 gap-2">
                          {["08:00", "09:00", "14:00", "16:00"].map((time) => (
                            <button
                              key={time}
                              type="button"
                              onClick={() => setPreviewSlot(time)}
                              className={`py-2 px-2 rounded-xl text-center border text-xs font-bold transition-all ${
                                previewSlot === time
                                  ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                                  : "bg-card border-border text-foreground hover:bg-muted/50"
                              }`}
                            >
                              {time}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {activePreviewStep?.type === "patient_info" && (
                    <div className="space-y-2.5">
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-foreground">Nome Completo</label>
                        <Input placeholder="Ex: Maria Silva" className="h-8 text-xs rounded-lg" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-foreground">WhatsApp Celular</label>
                        <Input placeholder="(11) 98765-4321" className="h-8 text-xs rounded-lg" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-foreground">CPF do Paciente</label>
                        <Input placeholder="000.000.000-00" className="h-8 text-xs rounded-lg" />
                      </div>
                    </div>
                  )}

                  {/* Botões de Navegação da Simulação */}
                  <div className="pt-2 flex items-center justify-between border-t border-border/50">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={previewStepIndex === 0}
                      onClick={() => setPreviewStepIndex((p) => Math.max(0, p - 1))}
                      className="h-8 text-xs rounded-lg gap-1"
                    >
                      <ChevronLeft className="h-3 w-3" />
                      <span>Voltar</span>
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => {
                        if (previewStepIndex < orderedSteps.length - 1) {
                          setPreviewStepIndex((p) => p + 1)
                        } else {
                          alert(successMessage || "Agendamento simulado com sucesso!")
                        }
                      }}
                      className="h-8 text-xs rounded-lg font-bold gap-1 shadow-2xs"
                    >
                      <span>
                        {previewStepIndex === orderedSteps.length - 1 ? "Concluir" : "Avançar"}
                      </span>
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Smartphone Home Indicator */}
                <div className="h-4 bg-card flex items-center justify-center">
                  <div className="w-28 h-1 bg-muted-foreground/30 rounded-full"></div>
                </div>
              </div>
            ) : (
              /* ================= MOCKUP DESKTOP ================= */
              <div className="w-full rounded-2xl border border-border/80 bg-background shadow-2xl overflow-hidden flex flex-col transition-all">
                {/* Browser Titlebar */}
                <div className="h-9 bg-muted/40 border-b border-border/60 px-3 flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-rose-500/80"></div>
                    <div className="h-2.5 w-2.5 rounded-full bg-amber-500/80"></div>
                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/80"></div>
                  </div>
                  <div className="flex-1 max-w-sm mx-auto bg-background/80 px-3 py-0.5 rounded-md border border-border/50 text-[10px] text-muted-foreground font-mono truncate text-center">
                    altarfisio.com.br/agendar
                  </div>
                </div>

                {/* Conteúdo Desktop */}
                <div className="p-5 max-h-[640px] overflow-y-auto space-y-4 text-xs">
                  <div className="text-center space-y-1.5 pb-3 border-b border-border/50">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
                      <HeartPulse className="h-5 w-5" />
                    </div>
                    <h3 className="font-bold text-base text-foreground">{welcomeTitle}</h3>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto">
                      {welcomeMessage}
                    </p>
                  </div>

                  {/* Abas de Etapas Desktop */}
                  <div className="flex items-center justify-center gap-2">
                    {orderedSteps.map((step, idx) => (
                      <button
                        key={step.id}
                        type="button"
                        onClick={() => setPreviewStepIndex(idx)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          idx === previewStepIndex
                            ? "bg-primary text-primary-foreground shadow-2xs"
                            : "bg-muted/40 text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        Etapa {idx + 1}: {step.title}
                      </button>
                    ))}
                  </div>

                  {/* Campos simulados na etapa atual */}
                  {activePreviewStep?.type === "intake_form" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      {config?.fields?.map((field) => {
                        if (!isFieldVisibleInPreview(field)) return null
                        return (
                          <div key={field.id} className="space-y-1">
                            <label className="text-xs font-semibold text-foreground">
                              {field.label} {field.required && <span className="text-destructive">*</span>}
                            </label>
                            {field.type === "yes_no" ? (
                              <div className="grid grid-cols-2 gap-2">
                                {["Sim", "Não"].map((opt) => (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() =>
                                      setPreviewAnswers((prev) => ({
                                        ...prev,
                                        [field.id]: opt,
                                      }))
                                    }
                                    className={`py-1.5 rounded-lg border text-xs font-semibold ${
                                      previewAnswers[field.id] === opt
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "bg-card border-border hover:bg-muted/50"
                                    }`}
                                  >
                                    {opt}
                                  </button>
                                ))}
                              </div>
                            ) : field.type === "select" ? (
                              <Select
                                value={previewAnswers[field.id] || ""}
                                onChange={(e) =>
                                  setPreviewAnswers((prev) => ({
                                    ...prev,
                                    [field.id]: e.target.value,
                                  }))
                                }
                                className="h-9 text-xs"
                              >
                                <option value="">{field.placeholder || "Selecione..."}</option>
                                {field.options?.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </Select>
                            ) : (
                              <Input
                                value={previewAnswers[field.id] || ""}
                                onChange={(e) =>
                                  setPreviewAnswers((prev) => ({
                                    ...prev,
                                    [field.id]: e.target.value,
                                  }))
                                }
                                placeholder={field.placeholder || "Preencha..."}
                                className="h-9 text-xs"
                              />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {activePreviewStep?.type === "slot_picker" && (
                    <div className="space-y-3 pt-2">
                      <div className="text-xs font-bold text-foreground">Escolha de Vaga & Serviço</div>
                      <div className="grid grid-cols-3 gap-2">
                        {["Studio Pilates", "Fisioterapia Geral", "Reeducação Postural (RPG)"].map((s) => (
                          <div key={s} className="p-3 rounded-xl border border-border bg-card text-center font-bold text-xs hover:border-primary cursor-pointer">
                            {s}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activePreviewStep?.type === "patient_info" && (
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold">Nome Completo</label>
                        <Input placeholder="Ex: Lucas Ferreira" className="h-9 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold">WhatsApp Celular</label>
                        <Input placeholder="(11) 98765-4321" className="h-9 text-xs" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL: EDITAR ETAPA */}
      <Dialog open={!!editingStep} onOpenChange={(open) => !open && setEditingStep(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              Editar Etapa do Agendamento
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Atualize o título e a descrição que guiam o paciente na página pública.
            </DialogDescription>
          </DialogHeader>

          {editingStep && (
            <div className="space-y-4 py-2 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Título da Etapa *</label>
                <Input
                  value={editingStep.title}
                  onChange={(e) => setEditingStep({ ...editingStep, title: e.target.value })}
                  placeholder="Ex: Triagem & Convênio"
                  className="h-10 rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Descrição de Apoio da Etapa</label>
                <textarea
                  rows={3}
                  value={editingStep.description}
                  onChange={(e) => setEditingStep({ ...editingStep, description: e.target.value })}
                  placeholder="Ex: Informações sobre plano de saúde e histórico..."
                  className="w-full p-3 rounded-xl border border-input bg-card text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 leading-relaxed resize-none"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditingStep(null)}
              className="rounded-xl text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSaveStep}
              disabled={!editingStep?.title?.trim()}
              className="rounded-xl text-xs font-bold shadow-xs"
            >
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: ADICIONAR / EDITAR PERGUNTA */}
      <Dialog open={isFieldModalOpen} onOpenChange={setIsFieldModalOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              {editingFieldId ? "Editar Pergunta da Triagem" : "Adicionar Pergunta à Triagem"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Defina o texto, tipo de resposta e regras condicionais da pergunta.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Texto da Pergunta *</label>
              <Input
                value={fieldLabel}
                onChange={(e) => setFieldLabel(e.target.value)}
                placeholder="Ex: Você possui plano ou convênio de saúde?"
                className="h-10 rounded-xl text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Tipo de Resposta</label>
                <Select
                  value={fieldType}
                  onChange={(e) => setFieldType(e.target.value as any)}
                  className="h-10 rounded-xl text-xs bg-card"
                >
                  <option value="yes_no">Sim / Não</option>
                  <option value="select">Lista de Seleção (Dropdown)</option>
                  <option value="text">Texto Curto</option>
                  <option value="textarea">Texto Longo (Parágrafo)</option>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Obrigatoriedade</label>
                <Select
                  value={fieldRequired ? "true" : "false"}
                  onChange={(e) => setFieldRequired(e.target.value === "true")}
                  className="h-10 rounded-xl text-xs bg-card"
                >
                  <option value="true">Obrigatória</option>
                  <option value="false">Opcional</option>
                </Select>
              </div>
            </div>

            {/* Opções para Select */}
            {fieldType === "select" && (
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">
                  Opções do Dropdown (separadas por vírgula)
                </label>
                <Input
                  value={fieldOptionsText}
                  onChange={(e) => setFieldOptionsText(e.target.value)}
                  placeholder="Unimed, Bradesco, SulAmérica, Amil, Particular"
                  className="h-10 rounded-xl text-xs"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Texto de Ajuda / Placeholder (opcional)</label>
              <Input
                value={fieldPlaceholder}
                onChange={(e) => setFieldPlaceholder(e.target.value)}
                placeholder="Ex: Selecione o seu plano de saúde..."
                className="h-10 rounded-xl text-xs"
              />
            </div>

            {/* Configuração de Regra Condicional */}
            <div className="p-3.5 rounded-xl bg-muted/40 border border-border/70 space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="font-bold text-foreground">Regra Condicional</div>
                  <div className="text-[11px] text-muted-foreground">
                    Exibir esta pergunta apenas dependendo da resposta de outra
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={fieldHasCondition}
                  onChange={(e) => setFieldHasCondition(e.target.checked)}
                  className="h-4 w-4 rounded text-primary focus:ring-primary/20 cursor-pointer"
                />
              </div>

              {fieldHasCondition && (
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/50">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-foreground">Exibir se a pergunta:</label>
                    <Select
                      value={fieldDependsOn}
                      onChange={(e) => setFieldDependsOn(e.target.value)}
                      className="h-9 rounded-lg text-xs bg-card"
                    >
                      {config?.fields
                        ?.filter((f) => f.id !== editingFieldId)
                        .map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.label}
                          </option>
                        ))}
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-foreground">For igual ao valor:</label>
                    <Input
                      value={fieldEqualsValue}
                      onChange={(e) => setFieldEqualsValue(e.target.value)}
                      placeholder="Ex: Sim"
                      className="h-9 rounded-lg text-xs"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsFieldModalOpen(false)}
              className="rounded-xl text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSaveField}
              disabled={!fieldLabel.trim()}
              className="rounded-xl text-xs font-bold shadow-xs"
            >
              Salvar Pergunta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
