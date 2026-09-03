import React, { useState, useEffect } from "react"
import { useQuery, useMutation } from "convex/react"
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
  Link2,
  Copy,
  ExternalLink,
  Sparkles,
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
  Filter,
  Check,
  X,
  Send,
  Eye,
  Settings2,
  MessageSquare,
  Layers,
  ArrowUp,
  ArrowDown,
  Download,
  FileSpreadsheet,
} from "lucide-react"
import { formatDateBR } from "@/lib/dateUtils"
import { exportSingleBookingToXls, exportAllBookingsToXls } from "@/lib/exportToXls"

export const BookingBuilderTab: React.FC = () => {
  const config = useQuery(api.bookingBuilder.getBookingConfig)
  const publicBookings = useQuery(api.bookingBuilder.listPublicBookings, {})
  const updateConfig = useMutation(api.bookingBuilder.updateBookingConfig)
  const resetConfig = useMutation(api.bookingBuilder.resetBookingConfigToDefault)
  const updateStatus = useMutation(api.bookingBuilder.updatePublicBookingStatus)

  // Feedback Toast
  const [feedback, setFeedback] = useState<string | null>(null)
  const showToast = (msg: string) => {
    setFeedback(msg)
    setTimeout(() => setFeedback(null), 3500)
  }

  // Estado Local das Configurações Gerais
  const [requireApproval, setRequireApproval] = useState(false)
  const [welcomeTitle, setWelcomeTitle] = useState("")
  const [welcomeMessage, setWelcomeMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [isSavingGeneral, setIsSavingGeneral] = useState(false)

  // Filtro de Agendamentos Online
  const [bookingFilter, setBookingFilter] = useState<string>("all")
  const [selectedSubmissionForDetails, setSelectedSubmissionForDetails] = useState<any>(null)

  // Modal de Edição de Etapa (Step)
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

  // Sincroniza do Convex
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
  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/agendar` : "https://altarfisio.com.br/agendar"

  const handleCopyLink = (urlToCopy: string) => {
    navigator.clipboard.writeText(urlToCopy)
    showToast("Link copiado para a área de transferência!")
  }

  // Salvar Configurações Gerais
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
      showToast("Configurações do construtor salvas com sucesso!")
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

  // Reordenar Etapa
  const handleMoveStep = async (stepIndex: number, direction: "up" | "down") => {
    if (!config) return
    const newSteps = [...config.steps]
    const targetIndex = direction === "up" ? stepIndex - 1 : stepIndex + 1
    if (targetIndex < 0 || targetIndex >= newSteps.length) return

    const temp = newSteps[stepIndex]
    newSteps[stepIndex] = newSteps[targetIndex]
    newSteps[targetIndex] = temp

    // Reatribui order
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

  // Abrir Modal de Pergunta
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

  const handleEditField = (field: any) => {
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
      showToast("Erro ao atualizar campos: " + (err?.message || "Tente novamente"))
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

  // Aprovar / Recusar Agendamento Online
  const handleApproveBooking = async (bookingId: string) => {
    try {
      await updateStatus({
        bookingId: bookingId as any,
        status: "confirmed",
      })
      showToast("Agendamento aprovado com sucesso! Vaga confirmada na agenda.")
    } catch (err: any) {
      showToast("Erro ao aprovar: " + (err?.message || "Tente novamente"))
    }
  }

  const handleRejectBooking = async (bookingId: string) => {
    const reason = prompt("Informe o motivo da recusa (opcional):")
    if (reason === null) return
    try {
      await updateStatus({
        bookingId: bookingId as any,
        status: "rejected",
        rejectionReason: reason || undefined,
      })
      showToast("Agendamento recusado.")
    } catch (err: any) {
      showToast("Erro ao recusar: " + (err?.message || "Tente novamente"))
    }
  }

  // Filtragem de Agendamentos Online
  const filteredBookings = (publicBookings || []).filter((b) => {
    if (bookingFilter === "all") return true
    return b.status === bookingFilter
  })

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Toast Feedback */}
      {feedback && (
        <div className="fixed bottom-6 right-6 z-50 bg-foreground text-background px-4 py-3 rounded-2xl shadow-xl text-xs font-semibold flex items-center gap-2 animate-scale-in">
          <Sparkles className="h-4 w-4 text-primary" />
          <span>{feedback}</span>
        </div>
      )}

      {/* CARD 1: LINK PÚBLICO E DIVULGAÇÃO (BIO INSTAGRAM & WHATSAPP) */}
      <Card className="border-border/70 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="p-6 border-b border-border/50 bg-primary/5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Link2 className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-foreground">
                  Link Público de Agendamento Online
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Divulgue na bio do Instagram, envie no WhatsApp ou gere o QR Code para a recepção
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(publicUrl, "_blank")}
                className="rounded-xl text-xs font-semibold gap-1.5 h-9"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Visualizar Página</span>
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
        </CardHeader>

        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Box Link Principal */}
            <div className="p-4 rounded-xl bg-muted/30 border border-border/60 flex flex-col justify-between">
              <div>
                <div className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span>Link Geral (Todos os Serviços)</span>
                  <Badge variant="secondary" className="text-[10px] font-semibold">Geral</Badge>
                </div>
                <div className="text-xs text-muted-foreground font-mono bg-background p-2.5 rounded-lg border border-border/60 mt-2 break-all select-all">
                  {publicUrl}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopyLink(publicUrl)}
                className="text-xs text-primary font-semibold hover:text-primary mt-3 h-8 self-start px-2"
              >
                <Copy className="h-3.5 w-3.5 mr-1" />
                Copiar URL
              </Button>
            </div>

            {/* Box Link Pilates */}
            <div className="p-4 rounded-xl bg-muted/30 border border-border/60 flex flex-col justify-between">
              <div>
                <div className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span>Campanha Studio Pilates</span>
                  <Badge variant="outline" className="text-[10px] font-semibold text-primary border-primary/30">Pilates</Badge>
                </div>
                <div className="text-xs text-muted-foreground font-mono bg-background p-2.5 rounded-lg border border-border/60 mt-2 break-all select-all">
                  {`${publicUrl}?servico=pilates`}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopyLink(`${publicUrl}?servico=pilates`)}
                className="text-xs text-primary font-semibold hover:text-primary mt-3 h-8 self-start px-2"
              >
                <Copy className="h-3.5 w-3.5 mr-1" />
                Copiar URL Pilates
              </Button>
            </div>

            {/* Box Link Fisioterapia */}
            <div className="p-4 rounded-xl bg-muted/30 border border-border/60 flex flex-col justify-between">
              <div>
                <div className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span>Campanha Fisioterapia</span>
                  <Badge variant="outline" className="text-[10px] font-semibold text-emerald-600 border-emerald-300">Fisio</Badge>
                </div>
                <div className="text-xs text-muted-foreground font-mono bg-background p-2.5 rounded-lg border border-border/60 mt-2 break-all select-all">
                  {`${publicUrl}?servico=fisioterapia`}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopyLink(`${publicUrl}?servico=fisioterapia`)}
                className="text-xs text-primary font-semibold hover:text-primary mt-3 h-8 self-start px-2"
              >
                <Copy className="h-3.5 w-3.5 mr-1" />
                Copiar URL Fisio
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CARD 2: MODO HÍBRIDO & MENSAGENS PERSONALIZADAS (COM EDIÇÃO DE DESCRIÇÃO DO TÍTULO) */}
      <Card className="border-border/70 shadow-sm rounded-2xl">
        <CardHeader className="p-6 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Settings2 className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-foreground">
                  Textos do Cabeçalho & Modo de Confirmação
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Edite o título principal, a descrição explicativa abaixo do título e o modo de aprovação
                </CardDescription>
              </div>
            </div>

            <Button
              size="sm"
              disabled={isSavingGeneral}
              onClick={handleSaveGeneralConfig}
              className="rounded-xl text-xs font-bold shadow-sm"
            >
              {isSavingGeneral ? "Salvando..." : "Salvar Textos & Configurações"}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-5">
          {/* Seletor do Modo Híbrido */}
          <div className="p-4 rounded-xl border border-border/70 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-sm font-bold text-foreground flex items-center gap-2">
                <span>Modo de Aprovação:</span>
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
              <p className="text-xs text-muted-foreground max-w-xl">
                {requireApproval
                  ? "Os agendamentos feitos pelos clientes entram com status 'Aguardando Aprovação' para a recepção validar a triagem e confirmar com um clique."
                  : "A vaga na sala e agenda do profissional é garantida e alocada imediatamente sem necessidade de intervenção humana."}
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRequireApproval(!requireApproval)}
              className="rounded-xl text-xs font-semibold shrink-0"
            >
              {requireApproval ? "Mudar para Auto-Confirmação" : "Mudar para Aprovação Manual"}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Título Principal na Página Pública
              </label>
              <Input
                value={welcomeTitle}
                onChange={(e) => setWelcomeTitle(e.target.value)}
                placeholder="Ex: Agende sua Consulta ou Sessão"
                className="h-10 rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Mensagem de Sucesso (Após Conclusão)
              </label>
              <Input
                value={successMessage}
                onChange={(e) => setSuccessMessage(e.target.value)}
                placeholder="Ex: Seu agendamento foi registrado com sucesso!..."
                className="h-10 rounded-xl text-xs"
              />
            </div>
          </div>

          {/* NOVO CAMPO: DESCRIÇÃO ABAIXO DO TÍTULO */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Descrição / Subtítulo abaixo do Título Principal</span>
              <span className="text-[10px] text-muted-foreground">Exibido em destaque no topo da página pública</span>
            </label>
            <textarea
              rows={2}
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              placeholder="Ex: Bem-vindo à Altar Fisio (Dr. Marcelo). Escolha o serviço, tire suas dúvidas e reserve seu horário online com rapidez e comodidade."
              className="w-full p-3 rounded-xl border border-input bg-card text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 leading-relaxed resize-none"
            />
          </div>
        </CardContent>
      </Card>

      {/* NOVO CARD 3: GERENCIADOR DE ETAPAS (TÍTULO, DESCRIÇÃO E REORDENAÇÃO) */}
      <Card className="border-border/70 shadow-sm rounded-2xl">
        <CardHeader className="p-6 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-foreground">
                Etapas do Agendamento (Título, Descrição e Ordem)
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Edite os títulos e descrições das etapas que aparecem no topo do formulário do cliente
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-3">
          {config?.steps?.map((step, idx) => (
            <div
              key={step.id}
              className="p-4 rounded-xl border border-border/70 bg-card hover:border-primary/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px] font-bold">
                    Etapa {idx + 1}
                  </Badge>
                  <span className="font-bold text-sm text-foreground">{step.title}</span>
                  <Badge variant="outline" className="text-[9px] text-muted-foreground">
                    {step.type === "intake_form"
                      ? "Formulário Clínico"
                      : step.type === "slot_picker"
                      ? "Escolha de Vaga"
                      : "Dados do Paciente"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
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
                  title="Mover etapa para cima"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={idx === (config?.steps?.length || 0) - 1}
                  onClick={() => handleMoveStep(idx, "down")}
                  className="h-8 w-8 p-0 rounded-lg"
                  title="Mover etapa para baixo"
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
                  <Edit2 className="h-3.5 w-3.5" />
                  <span>Editar Etapa</span>
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* CARD 4: PERGUNTAS & REGRAS CONDICIONAIS */}
      <Card className="border-border/70 shadow-sm rounded-2xl">
        <CardHeader className="p-6 border-b border-border/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-foreground">
                  Perguntas & Regras Condicionais da Triagem
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Personalize as perguntas de plano de saúde, convênio e sintomas que o paciente responde
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetDefault}
                className="rounded-xl text-xs font-semibold gap-1 h-9"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Restaurar Padrão</span>
              </Button>

              <Button
                size="sm"
                onClick={handleOpenNewField}
                className="rounded-xl text-xs font-bold gap-1.5 h-9 shadow-sm shadow-primary/20"
              >
                <Plus className="h-4 w-4" />
                <span>Nova Pergunta</span>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-4">
          <div className="space-y-3">
            {config?.fields?.map((field, idx) => {
              const hasCondition = !!field.conditional
              const parentField = hasCondition
                ? config.fields.find((f) => f.id === field.conditional?.dependsOnFieldId)
                : null

              return (
                <div
                  key={field.id}
                  className="p-4 rounded-xl bg-card border border-border/70 hover:border-primary/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-muted-foreground">#{idx + 1}</span>
                      <span className="text-sm font-bold text-foreground">{field.label}</span>
                      <Badge variant="secondary" className="text-[10px] uppercase font-semibold">
                        {field.type === "yes_no"
                          ? "Sim / Não"
                          : field.type === "select"
                          ? "Lista (Select)"
                          : field.type === "textarea"
                          ? "Texto Longo"
                          : "Texto Curto"}
                      </Badge>
                      {field.required ? (
                        <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30">
                          Obrigatória
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          Opcional
                        </Badge>
                      )}
                    </div>

                    {hasCondition && (
                      <div className="text-xs text-primary font-medium flex items-center gap-1.5 bg-primary/5 px-2.5 py-1 rounded-lg border border-primary/10 w-fit">
                        <Sparkles className="h-3 w-3" />
                        <span>
                          Exibida apenas se:{" "}
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
                        <span className="truncate max-w-lg">{field.options.join(" • ")}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditField(field)}
                      className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteField(field.id)}
                      className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* CARD 5: AGENDAMENTOS ONLINE COM BOTÃO DE EXPORTAR XLS */}
      <Card className="border-border/70 shadow-sm rounded-2xl">
        <CardHeader className="p-6 border-b border-border/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-foreground">
                  Agendamentos Recebidos pelo Portal Público
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Monitore as solicitações dos pacientes e confira as respostas da triagem
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportAllBookingsToXls(filteredBookings)}
                disabled={filteredBookings.length === 0}
                className="rounded-xl text-xs font-semibold gap-1.5 h-9"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                <span>Exportar Todos em XLS</span>
              </Button>

              <Select
                value={bookingFilter}
                onChange={(e) => setBookingFilter(e.target.value)}
                className="h-9 rounded-xl text-xs bg-card"
              >
                <option value="all">Todos os Status</option>
                <option value="pending_approval">Aguardando Aprovação</option>
                <option value="confirmed">Confirmados</option>
                <option value="rejected">Rejeitados</option>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {!publicBookings ? (
            <div className="py-8 text-center text-xs text-muted-foreground animate-pulse">
              Carregando agendamentos online...
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
              Nenhum agendamento online registrado com este filtro.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredBookings.map((b) => (
                <div
                  key={b._id}
                  className="p-4 rounded-xl border border-border/70 bg-card hover:border-primary/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-foreground">{b.patientName}</span>
                      <Badge
                        variant="outline"
                        className={
                          b.status === "confirmed"
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-300"
                            : b.status === "pending_approval"
                            ? "bg-amber-500/10 text-amber-600 border-amber-300"
                            : "bg-destructive/10 text-destructive border-destructive/30"
                        }
                      >
                        {b.status === "confirmed"
                          ? "Confirmado"
                          : b.status === "pending_approval"
                          ? "Aguardando Aprovação"
                          : "Recusado"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDateBR(b.date)} às {b.startTime}
                      </span>
                    </div>

                    <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3 text-primary" />
                        {b.patientPhone}
                      </span>
                      <span>•</span>
                      <span>CPF: {b.patientCpf}</span>
                      <span>•</span>
                      <span>Sala: {b.roomName}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedSubmissionForDetails(b)}
                      className="rounded-xl text-xs font-semibold gap-1 h-8"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Ver Respostas</span>
                    </Button>

                    {b.status === "pending_approval" && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleApproveBooking(b._id)}
                          className="rounded-xl text-xs font-bold gap-1 h-8 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>Aprovar</span>
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRejectBooking(b._id)}
                          className="rounded-xl text-xs font-semibold gap-1 h-8 text-destructive hover:bg-destructive/10"
                        >
                          <X className="h-3.5 w-3.5" />
                          <span>Recusar</span>
                        </Button>
                      </>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const cleanPhone = b.patientPhone.replace(/\D/g, "")
                        window.open(`https://wa.me/55${cleanPhone}`, "_blank")
                      }}
                      className="rounded-xl text-xs font-semibold gap-1 h-8 text-emerald-600 hover:bg-emerald-500/10"
                    >
                      <Send className="h-3 w-3" />
                      <span>WhatsApp</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
                  placeholder="Ex: Informações sobre plano de saúde e histórico para personalizarmos seu atendimento..."
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
              Salvar Alterações da Etapa
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

      {/* MODAL: VER DETALHES E RESPOSTAS COM EXPORTAÇÃO EM XLS */}
      <Dialog
        open={!!selectedSubmissionForDetails}
        onOpenChange={(open) => !open && setSelectedSubmissionForDetails(null)}
      >
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  Respostas da Triagem Clínica
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Informações preenchidas pelo paciente no agendamento online
                </DialogDescription>
              </div>

              {selectedSubmissionForDetails && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportSingleBookingToXls(selectedSubmissionForDetails)}
                  className="rounded-xl text-xs font-semibold gap-1.5 h-8 border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  <span>Exportar em XLS</span>
                </Button>
              )}
            </div>
          </DialogHeader>

          {selectedSubmissionForDetails && (
            <div className="space-y-4 py-2 text-xs">
              <div className="p-3.5 rounded-xl bg-muted/30 border border-border/70 space-y-1">
                <div className="font-bold text-sm text-foreground">
                  {selectedSubmissionForDetails.patientName}
                </div>
                <div className="text-muted-foreground">
                  WhatsApp: {selectedSubmissionForDetails.patientPhone} • CPF:{" "}
                  {selectedSubmissionForDetails.patientCpf}
                </div>
                <div className="text-primary font-medium mt-1">
                  {formatDateBR(selectedSubmissionForDetails.date)} às{" "}
                  {selectedSubmissionForDetails.startTime} ({selectedSubmissionForDetails.roomName})
                </div>
              </div>

              <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                {selectedSubmissionForDetails.answers?.map((ans: any, i: number) => (
                  <div key={i} className="p-3 rounded-xl bg-card border border-border/60 space-y-1">
                    <div className="font-semibold text-foreground text-[11px]">{ans.questionLabel}</div>
                    <div className="text-primary font-medium text-xs whitespace-pre-wrap">
                      {ans.answer || "Não informado"}
                    </div>
                  </div>
                ))}

                {selectedSubmissionForDetails.notes && (
                  <div className="p-3 rounded-xl bg-card border border-border/60 space-y-1">
                    <div className="font-semibold text-foreground text-[11px]">
                      Observações do Paciente:
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {selectedSubmissionForDetails.notes}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="flex items-center justify-between sm:justify-between w-full">
            {selectedSubmissionForDetails && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportSingleBookingToXls(selectedSubmissionForDetails)}
                className="rounded-xl text-xs font-semibold gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Baixar Planilha XLS</span>
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedSubmissionForDetails(null)}
              className="rounded-xl text-xs"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
