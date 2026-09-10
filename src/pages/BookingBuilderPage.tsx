import { ConfirmationEditor } from "@/components/booking/ConfirmationEditor"
import { InsuranceEditor } from "@/components/booking/InsuranceEditor"
import React, { useState, useEffect } from "react"
import { useQuery, useMutation } from "@/lib/staffConvex"
import { api } from "@convex/_generated/api"
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
  RotateCw,
  Settings2,
  Layers,
  ArrowUp,
  ArrowDown,
  Smartphone,
  Monitor,
  Lock,
  Wifi,
} from "lucide-react"

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
  const config = useQuery(api.bookingBuilder.getBookingConfig)
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

  // Viewport da página pública real: "mobile" | "desktop"
  const [previewDevice, setPreviewDevice] = useState<"mobile" | "desktop">("mobile")
  const [previewScreen, setPreviewScreen] = useState("form")
  const [previewKey, setPreviewKey] = useState(0)
  const handleReloadPreview = () => setPreviewKey((prev) => prev + 1)

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
  }, [config?.requireApproval, config?.welcomeTitle, config?.welcomeMessage, config?.successMessage])

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
    if (!config || !editingStep || !editingStep.title.trim()) return
    const baseSteps = config.steps.some(s => s.id === editingStep.id) ? config.steps : [...config.steps, { ...editingStep, type: "intake_form" as const, order: config.steps.length + 1 }]
    const updatedSteps = baseSteps.map((s) =>
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

  const handleDeleteStep = async (stepId: string) => {
    if (!config || !confirm("Excluir esta etapa e suas perguntas? As condições que dependem dessas perguntas também serão removidas.")) return
    const steps = config.steps.filter(s => s.id !== stepId).map((s, i) => ({ ...s, order: i + 1 }))
    const remaining = config.fields.filter(f => f.stepId !== stepId)
    const fields = remaining.map(f => f.conditional && !remaining.some(parent => parent.id === f.conditional?.dependsOnFieldId) ? { ...f, conditional: undefined } : f)
    try {
      await updateConfig({ requireApproval, steps, fields, welcomeTitle, welcomeMessage, successMessage })
      showToast("Etapa e perguntas removidas.")
    } catch (err: any) { showToast("Erro ao excluir etapa: " + err.message) }
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
    setFieldStepId(config?.steps.find(s => s.type === "intake_form")?.id ?? "")
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
    if (!config || !fieldLabel.trim() || !fieldStepId) return

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
    const updatedFields = config.fields.filter((f) => f.id !== fieldId).map(f => f.conditional?.dependsOnFieldId === fieldId ? { ...f, conditional: undefined } : f)
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

      {/* Grid Principal: controles à esquerda e página pública real à direita */}
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

          <ConfirmationEditor config={config} onPreview={setPreviewScreen} />

          <InsuranceEditor config={config} />

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
                    Adicione, exclua e reordene etapas de perguntas. Horário e dados pessoais são obrigatórios para concluir a reserva.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-5 space-y-3">
              <Button size="sm" disabled={!config} onClick={() => setEditingStep({ id: "step_" + crypto.randomUUID(), title: "Nova etapa", description: "" })}><Plus className="h-4 w-4 mr-1" />Adicionar etapa</Button>
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
                    {step.type === "intake_form" ? <Button variant="outline" size="sm" onClick={() => handleDeleteStep(step.id)} aria-label={`Excluir etapa ${step.title}`}><Trash2 className="h-3 w-3 mr-1" />Excluir</Button> : <span className="text-[10px] text-muted-foreground">Obrigatória</span>}
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
                  disabled={!config?.steps.some(s => s.type === "intake_form")}
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
          <div className="p-3 sm:p-3.5 rounded-2xl bg-card border border-border/80 shadow-sm flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-foreground">Prévia Pública Real</span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {previewDevice === "mobile" ? "iPhone Pro · 390 × 844 px" : "Desktop HD · 1280 px"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Seletor de dispositivo */}
              <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/60">
                <button
                  type="button"
                  onClick={() => setPreviewDevice("mobile")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    previewDevice === "mobile"
                      ? "bg-background text-foreground shadow-2xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Visualização Smartphone"
                >
                  <Smartphone className="h-3.5 w-3.5" />
                  <span>Mobile</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewDevice("desktop")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
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

              {/* Botão de recarregar prévia */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleReloadPreview}
                className="h-8 w-8 p-0 rounded-xl text-muted-foreground hover:text-foreground"
                title="Recarregar Prévia"
              >
                <RotateCw className="h-3.5 w-3.5" />
              </Button>

              {/* Botão de abrir em nova aba */}
              <Button
                variant="outline"
                size="sm"
                asChild
                className="h-8 w-8 p-0 rounded-xl text-muted-foreground hover:text-foreground"
                title="Abrir página pública em tela cheia"
              >
                <a href={`${publicUrl}?preview=builder${previewScreen === "form" ? "" : `&confirmation=${previewScreen}`}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            </div>
          </div>

          {/* Renderização do Mockup */}
          <div className="flex justify-center w-full">
            {previewDevice === "mobile" ? (
              /* ======================================================= */
              /* MOCKUP DE CELULAR REALISTA (SMARTPHONE TITANIUM COM DYNAMIC ISLAND) */
              /* ======================================================= */
              <div className="relative mx-auto w-full max-w-[390px] transition-all duration-300">
                {/* Chassi externo com efeito titânio e botões laterais */}
                <div className="relative rounded-[54px] p-[10px] bg-gradient-to-b from-slate-700 via-slate-900 to-black shadow-[0_25px_60px_-15px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.15)_inset] border border-slate-700/60 select-none">
                  {/* Botões físicos laterais (Action, Vol+, Vol-, Power) */}
                  <div className="absolute -left-[13px] top-24 w-[3.5px] h-7 bg-slate-600 rounded-l-[3px] shadow-xs" />
                  <div className="absolute -left-[13px] top-36 w-[3.5px] h-12 bg-slate-600 rounded-l-[3px] shadow-xs" />
                  <div className="absolute -left-[13px] top-52 w-[3.5px] h-12 bg-slate-600 rounded-l-[3px] shadow-xs" />
                  <div className="absolute -right-[13px] top-40 w-[3.5px] h-16 bg-slate-600 rounded-r-[3px] shadow-xs" />

                  {/* Alto-falante de chamada estéreo no topo do frame */}
                  <div className="absolute top-[5px] left-1/2 -translate-x-1/2 w-14 h-1 bg-slate-800/90 rounded-full z-40" />

                  {/* Tela interna do Smartphone */}
                  <div className="relative overflow-hidden rounded-[44px] bg-background border border-black/50 flex flex-col shadow-inner">
                    {/* Barra de Status com Horário, Dynamic Island e Conectividade */}
                    <div className="relative z-30 h-11 bg-background/95 backdrop-blur-md px-6 flex items-center justify-between select-none border-b border-border/30">
                      {/* Horário */}
                      <span className="text-[12px] font-bold tracking-tight text-foreground font-mono">
                        09:41
                      </span>

                      {/* Dynamic Island com lente de câmera frontal e sensor */}
                      <div className="h-6 w-28 bg-black rounded-full flex items-center justify-between px-3 shadow-md ring-1 ring-white/10">
                        {/* Lente com anel de vidro e reflexo sutil */}
                        <div className="w-2.5 h-2.5 rounded-full bg-[#0a0f1d] ring-1 ring-slate-800 flex items-center justify-center">
                          <div className="w-1 h-1 rounded-full bg-blue-950/90" />
                        </div>
                        {/* Sensor infravermelho */}
                        <div className="w-2 h-2 rounded-full bg-[#121216]" />
                      </div>

                      {/* Ícones de Conectividade (Sinal, Wi-Fi, Bateria) */}
                      <div className="flex items-center gap-1.5 text-foreground/85">
                        <div className="flex items-end gap-[1.5px] h-2.5" title="Sinal 5G">
                          <span className="w-[2.5px] h-1 bg-foreground/80 rounded-2xs" />
                          <span className="w-[2.5px] h-1.5 bg-foreground/80 rounded-2xs" />
                          <span className="w-[2.5px] h-2 bg-foreground/80 rounded-2xs" />
                          <span className="w-[2.5px] h-2.5 bg-foreground/80 rounded-2xs" />
                        </div>

                        <Wifi className="h-3 w-3 text-foreground/80" />

                        <div className="flex items-center" title="Bateria 100%">
                          <div className="w-5 h-2.5 rounded-[3px] border border-foreground/60 p-[1px] flex items-center">
                            <div className="h-full w-full bg-emerald-500 rounded-[1.5px]" />
                          </div>
                          <div className="w-[1.5px] h-1 bg-foreground/50 rounded-r-xs -ml-[0.5px]" />
                        </div>
                      </div>
                    </div>

                    {/* Iframe da Página Pública Real com scrollbar oculta */}
                    <iframe
                      key={`mobile-${previewKey}`}
                      title="Prévia real do agendamento público em celular"
                      src={`${publicUrl}?preview=builder${previewScreen === "form" ? "" : `&confirmation=${previewScreen}`}`}
                      sandbox="allow-scripts allow-same-origin"
                      className="block w-full h-[690px] border-none bg-background scrollbar-none"
                    />

                    {/* Rodapé com Home Indicator estilo iOS */}
                    <div className="relative z-30 h-6 bg-background/95 backdrop-blur-md flex items-center justify-center border-t border-border/20 select-none">
                      <div className="w-32 h-1 bg-foreground/30 hover:bg-foreground/50 rounded-full transition-colors" />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* ======================================================= */
              /* MOCKUP DE DESKTOP (BROWSER WINDOW MODERNO COM macOS DOTS) */
              /* ======================================================= */
              <div className="w-full overflow-hidden bg-background shadow-2xl transition-all rounded-2xl border border-border/80">
                {/* Barra do Navegador */}
                <div className="h-10 bg-muted/50 border-b border-border/60 px-4 flex items-center justify-between gap-3 select-none">
                  {/* Botões macOS */}
                  <div className="flex items-center gap-1.5" aria-hidden="true">
                    <div className="h-3 w-3 rounded-full bg-rose-500/90 border border-rose-600/30 hover:brightness-90" />
                    <div className="h-3 w-3 rounded-full bg-amber-500/90 border border-amber-600/30 hover:brightness-90" />
                    <div className="h-3 w-3 rounded-full bg-emerald-500/90 border border-emerald-600/30 hover:brightness-90" />
                  </div>

                  {/* Barra de Endereço do Navegador */}
                  <div className="flex-1 max-w-sm mx-auto bg-background/90 px-3 py-1 rounded-lg border border-border/60 flex items-center justify-center gap-1.5 text-xs text-muted-foreground font-mono truncate shadow-2xs">
                    <Lock className="h-3 w-3 text-emerald-500 shrink-0" />
                    <span className="truncate">altarfisio.com.br/agendar</span>
                    <span className="text-[10px] text-muted-foreground/60 hidden sm:inline">· prévia</span>
                  </div>

                  <div className="text-[10px] font-mono text-muted-foreground/70 hidden sm:block">
                    1280 px
                  </div>
                </div>

                <iframe
                  key={`desktop-${previewKey}`}
                  title="Prévia real do agendamento público em desktop"
                  src={`${publicUrl}?preview=builder${previewScreen === "form" ? "" : `&confirmation=${previewScreen}`}`}
                  sandbox="allow-scripts allow-same-origin"
                  className="block w-full bg-background h-[760px] border-none"
                />
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
            <label className="block space-y-1">Etapa da pergunta
              <Select aria-label="Etapa da pergunta" value={fieldStepId} onChange={e => setFieldStepId(e.target.value)}>
                {config?.steps.filter(s => s.type === "intake_form").map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
              </Select>
            </label>
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
                  <option value="multiselect">Múltipla escolha</option>
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
            {(fieldType === "select" || fieldType === "multiselect") && (
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

            <label className="block space-y-1">Texto de ajuda
              <Input aria-label="Texto de ajuda" value={fieldHelpText} onChange={e => setFieldHelpText(e.target.value)} />
            </label>
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
