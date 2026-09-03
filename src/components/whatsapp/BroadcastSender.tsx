import React, { useState, useMemo } from "react"
import { useQuery, useMutation, useAction } from "convex/react"
import { api } from "@convex/_generated/api"
import { useClinicData } from "@/contexts/ClinicDataContext"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Send,
  Users,
  Repeat,
  Calendar,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  Layers,
  Sparkles,
  Play,
  Pause,
  Trash2,
  Loader2,
  CheckSquare,
  Square,
  Smartphone,
  Info,
} from "lucide-react"

const cleanLineBreaks = (text: string): string => {
  if (!text) return ""
  return text
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
}

export const BroadcastSender: React.FC = () => {
  const { patients } = useClinicData()
  const templates = useQuery(api.whatsapp.listTemplates, {}) || []
  const campaigns = useQuery(api.whatsapp.listBroadcastCampaigns) || []
  const defaultInstance = useQuery(api.whatsapp.listInstances)?.find((i: any) => i.isDefault)

  const createCampaignMutation = useMutation(api.whatsapp.createBroadcastCampaign)
  const toggleCampaignStatusMutation = useMutation(api.whatsapp.toggleCampaignStatus)
  const deleteCampaignMutation = useMutation(api.whatsapp.deleteCampaign)
  const dispatchCampaignAction = useAction(api.whatsapp.dispatchBroadcastCampaignAction)

  // Sub-aba: Novo Disparo vs Campanhas Ativas
  const [subTab, setSubTab] = useState<"novo_disparo" | "campanhas">("novo_disparo")

  // Filtros de Pacientes
  const [filterType, setFilterType] = useState<"all" | "pilates" | "fisioterapia" | "rpg" | "with_schedule">("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedPatientIds, setSelectedPatientIds] = useState<any[]>([])

  // Formulário de Disparo
  const [campaignName, setCampaignName] = useState("")
  const [messageMode, setMessageMode] = useState<"template" | "custom">("template")
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("")
  const [customText, setCustomText] = useState("Olá, *{{paciente}}*! Passando para compartilhar uma mensagem da equipe *{{clinica}}*...")
  const [messageType, setMessageType] = useState<"text" | "button" | "list" | "carousel">("text")

  // Recorrência
  const [recurrence, setRecurrence] = useState<"none" | "daily" | "weekly" | "biweekly" | "monthly">("none")
  const [scheduledHour, setScheduledHour] = useState("09:00")
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 3, 5]) // Seg, Qua, Sex

  // Feedback & Loading
  const [isSending, setIsSending] = useState(false)
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null)

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 4500)
  }

  // Filtragem Dinâmica de Pacientes
  const filteredPatients = useMemo(() => {
    return patients.filter((p: any) => {
      const q = searchQuery.toLowerCase().trim()
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.phone && p.phone.includes(q)) ||
        (p.documentCpf && p.documentCpf.includes(q))

      if (!matchSearch) return false

      if (filterType === "all") return true
      return true
    })
  }, [patients, searchQuery, filterType])

  // Selecionar Todos / Limpar
  const handleToggleSelectAll = () => {
    if (selectedPatientIds.length === filteredPatients.length) {
      setSelectedPatientIds([])
    } else {
      setSelectedPatientIds(filteredPatients.map((p: any) => p.id || p._id))
    }
  }

  const handleTogglePatient = (id: any) => {
    if (selectedPatientIds.includes(id)) {
      setSelectedPatientIds(selectedPatientIds.filter((pid) => pid !== id))
    } else {
      setSelectedPatientIds([...selectedPatientIds, id])
    }
  }

  // Toggle Dia da Semana para Recorrência
  const handleToggleDay = (dayIdx: number) => {
    if (selectedDays.includes(dayIdx)) {
      setSelectedDays(selectedDays.filter((d) => d !== dayIdx))
    } else {
      setSelectedDays([...selectedDays, dayIdx].sort())
    }
  }

  // Executar Disparo / Criar Campanha
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (selectedPatientIds.length === 0) {
      showToast("Selecione pelo menos 1 paciente destinatário.", "error")
      return
    }

    if (!campaignName.trim()) {
      showToast("Dê um nome para a campanha ou disparo.", "error")
      return
    }

    if (messageMode === "template" && !selectedTemplateId) {
      showToast("Escolha um modelo salvo da biblioteca ou mude para Texto Personalizado.", "error")
      return
    }

    setIsSending(true)
    try {
      const campaignId = await createCampaignMutation({
        name: campaignName.trim(),
        templateId: messageMode === "template" && selectedTemplateId ? (selectedTemplateId as any) : undefined,
        customText: messageMode === "custom" ? cleanLineBreaks(customText) : "",
        messageType: messageMode === "template" ? "button" : messageType,
        targetPatientIds: selectedPatientIds,
        recurrence,
        scheduledHour,
        scheduledDaysOfWeek: recurrence === "weekly" ? selectedDays : undefined,
      })

      // Se for envio imediato, dispara agora!
      if (recurrence === "none") {
        showToast(`Iniciando disparo em massa para ${selectedPatientIds.length} pacientes...`)
        const result = await dispatchCampaignAction({ campaignId })
        if (result.success) {
          showToast(`Disparo concluído: ${result.sent} mensagens enviadas (${result.failed} falhas).`)
        } else {
          showToast(result.error || "Erro no envio em massa", "error")
        }
      } else {
        showToast(`Campanha recorrente "${campaignName}" criada e agendada para às ${scheduledHour}!`)
      }

      // Reset
      setCampaignName("")
      setSelectedPatientIds([])
      setSubTab("campanhas")
    } catch (err: any) {
      showToast("Erro ao processar disparo: " + (err?.message || "Tente novamente"), "error")
    } finally {
      setIsSending(false)
    }
  }

  // Disparo manual imediato de uma campanha existente
  const handleRunCampaignNow = async (campaignId: any) => {
    setIsSending(true)
    try {
      showToast("Disparando mensagens da campanha...")
      const res = await dispatchCampaignAction({ campaignId })
      if (res.success) {
        showToast(`Envio concluído: ${res.sent} enviadas, ${res.failed} falhas.`)
      } else {
        showToast(res.error || "Erro ao executar campanha", "error")
      }
    } catch (err: any) {
      showToast("Falha na execução: " + err?.message, "error")
    } finally {
      setIsSending(false)
    }
  }

  const handleToggleStatus = async (campaignId: any, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "paused" : "active"
    try {
      await toggleCampaignStatusMutation({ campaignId, newStatus })
      showToast(`Campanha ${newStatus === "active" ? "reativada" : "pausada"}.`)
    } catch (err) {
      showToast("Erro ao alterar status da campanha", "error")
    }
  }

  const handleDeleteCampaign = async (campaignId: any) => {
    try {
      await deleteCampaignMutation({ campaignId })
      showToast("Campanha excluída com sucesso.")
    } catch (err) {
      showToast("Erro ao excluir campanha", "error")
    }
  }

  const daysMap = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between border animate-in fade-in ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800"
              : "bg-red-50 text-red-900 border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600" />
            )}
            <span className="text-sm font-medium">{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-xs opacity-70 hover:opacity-100">
            ✕
          </button>
        </div>
      )}

      {/* Sub-navegação interna */}
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={subTab === "novo_disparo" ? "default" : "outline"}
            onClick={() => setSubTab("novo_disparo")}
            className={subTab === "novo_disparo" ? "bg-emerald-600 text-white" : ""}
          >
            <Send className="w-3.5 h-3.5 mr-1.5" />
            Novo Disparo / Campanha
          </Button>
          <Button
            size="sm"
            variant={subTab === "campanhas" ? "default" : "outline"}
            onClick={() => setSubTab("campanhas")}
            className={subTab === "campanhas" ? "bg-emerald-600 text-white" : ""}
          >
            <Repeat className="w-3.5 h-3.5 mr-1.5" />
            Campanhas & Recorrência ({campaigns.length})
          </Button>
        </div>

        {defaultInstance && (
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Smartphone className="w-3.5 h-3.5 text-emerald-500" />
            Disparando via: <span className="font-semibold text-foreground">{defaultInstance.name}</span>
          </div>
        )}
      </div>

      {/* SUB-ABA 1: NOVO DISPARO */}
      {subTab === "novo_disparo" && (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* SELEÇÃO DE PACIENTES (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Users className="w-4 h-4 text-emerald-600" />
                      Destinatários ({selectedPatientIds.length} selecionados)
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Filtre e selecione os pacientes da clínica que receberão a mensagem.
                    </CardDescription>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleToggleSelectAll}
                    className="h-8 text-xs gap-1.5"
                  >
                    {selectedPatientIds.length === filteredPatients.length && filteredPatients.length > 0 ? (
                      <>
                        <CheckSquare className="w-3.5 h-3.5 text-emerald-600" /> Desmarcar Todos
                      </>
                    ) : (
                      <>
                        <Square className="w-3.5 h-3.5" /> Selecionar Todos ({filteredPatients.length})
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {/* Barra de Busca e Filtros Rápidos */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome, CPF ou WhatsApp..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-8 pl-8 text-xs"
                    />
                  </div>

                  <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs">
                    {(
                      [
                        { id: "all", label: "Todos Ativos" },
                        { id: "with_schedule", label: "Com Consulta" },
                      ] as const
                    ).map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setFilterType(f.id)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-all ${
                          filterType === f.id
                            ? "bg-emerald-600 text-white font-bold"
                            : "bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Lista de Pacientes com Checkbox */}
                <div className="border rounded-xl max-h-[380px] overflow-y-auto divide-y text-xs">
                  {filteredPatients.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      Nenhum paciente encontrado com o filtro selecionado.
                    </div>
                  ) : (
                    filteredPatients.map((p: any) => {
                      const patientId = p.id || p._id
                      const isSelected = selectedPatientIds.includes(patientId)

                      return (
                        <div
                          key={patientId}
                          onClick={() => handleTogglePatient(patientId)}
                          className={`p-2.5 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                            isSelected ? "bg-emerald-50/60 dark:bg-emerald-950/20" : "hover:bg-muted/40"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            <div className="min-w-0">
                              <div className="font-semibold text-foreground truncate">{p.name}</div>
                              <div className="text-[11px] text-muted-foreground font-mono truncate">
                                {p.phone || "Sem telefone"}
                              </div>
                            </div>
                          </div>

                          <Badge variant="outline" className="text-[10px] uppercase text-muted-foreground py-0">
                            {p.healthInsurance || "Particular"}
                          </Badge>
                        </div>
                      )
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* CONFIGURAÇÃO DA MENSAGEM & RECORRÊNCIA (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Send className="w-4 h-4 text-emerald-600" />
                  Conteúdo & Agendamento
                </CardTitle>
                <CardDescription className="text-xs">
                  Defina a mensagem e configure se o disparo é imediato ou periódico.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 text-xs">
                {/* Nome da Campanha */}
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Identificação da Campanha</label>
                  <Input
                    placeholder="Ex: Aviso Geral de Feriado, Lembrete Semanal"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    required
                    className="h-8 text-xs"
                  />
                </div>

                {/* Escolha entre Template ou Custom */}
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Tipo de Conteúdo</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setMessageMode("template")}
                      className={`p-2 text-center rounded-lg border transition-all text-xs font-medium flex items-center justify-center gap-1.5 ${
                        messageMode === "template"
                          ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 font-bold"
                          : "bg-muted/40 text-muted-foreground"
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" /> Usar Modelo Pronto
                    </button>

                    <button
                      type="button"
                      onClick={() => setMessageMode("custom")}
                      className={`p-2 text-center rounded-lg border transition-all text-xs font-medium flex items-center justify-center gap-1.5 ${
                        messageMode === "custom"
                          ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 font-bold"
                          : "bg-muted/40 text-muted-foreground"
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" /> Texto Avulso
                    </button>
                  </div>
                </div>

                {/* Seletor de Modelo */}
                {messageMode === "template" ? (
                  <div className="space-y-1">
                    <label className="font-semibold text-foreground">Selecione o Modelo da Biblioteca</label>
                    <select
                      value={selectedTemplateId}
                      onChange={(e) => setSelectedTemplateId(e.target.value)}
                      className="w-full h-8 px-2.5 rounded-md border bg-background text-xs outline-none"
                    >
                      <option value="">-- Escolha um modelo --</option>
                      {templates.map((t) => (
                        <option key={t._id} value={t._id}>
                          {t.title} ({t.type})
                        </option>
                      ))}
                    </select>

                    {selectedTemplateId && (
                      <div className="p-2.5 mt-2 bg-muted/40 rounded-lg border text-[11px] text-muted-foreground space-y-1">
                        <span className="font-semibold text-foreground">Prévia do Texto:</span>
                        <p className="line-clamp-3 font-mono whitespace-pre-line">
                          {cleanLineBreaks(templates.find((t) => t._id === selectedTemplateId)?.content || "")}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="font-semibold text-foreground">Texto da Mensagem</label>
                    <textarea
                      rows={4}
                      value={customText}
                      onChange={(e) => setCustomText(cleanLineBreaks(e.target.value))}
                      className="w-full p-2 rounded-lg border bg-background font-mono text-xs outline-none whitespace-pre-wrap leading-relaxed"
                      placeholder="Olá, {{paciente}}!..."
                      required
                    />
                  </div>
                )}

                {/* CONFIGURAÇÃO DE RECORRÊNCIA */}
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-foreground flex items-center gap-1.5">
                      <Repeat className="w-3.5 h-3.5 text-emerald-600" />
                      Periodicidade & Recorrência
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[11px] text-muted-foreground">Frequência</label>
                      <select
                        value={recurrence}
                        onChange={(e: any) => setRecurrence(e.target.value)}
                        className="w-full h-8 px-2 rounded-md border bg-background text-xs outline-none"
                      >
                        <option value="none">Envio Único (Imediato)</option>
                        <option value="daily">Diário (Todos os dias)</option>
                        <option value="weekly">Semanal (Dias específicos)</option>
                        <option value="biweekly">Quinzenal (A cada 14 dias)</option>
                        <option value="monthly">Mensal (Mesmo dia)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] text-muted-foreground">Horário de Disparo</label>
                      <Input
                        type="time"
                        value={scheduledHour}
                        onChange={(e) => setScheduledHour(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>

                  {recurrence === "weekly" && (
                    <div className="space-y-1 pt-1">
                      <label className="text-[11px] text-muted-foreground">Dias da Semana</label>
                      <div className="flex gap-1 justify-between">
                        {daysMap.map((dayName, idx) => {
                          const isSelected = selectedDays.includes(idx)
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleToggleDay(idx)}
                              className={`flex-1 py-1 text-[10px] font-semibold rounded border transition-all ${
                                isSelected
                                  ? "bg-emerald-600 text-white border-emerald-600 font-bold"
                                  : "bg-muted/40 text-muted-foreground"
                              }`}
                            >
                              {dayName}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Badge de Segurança Anti-bloqueio */}
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <span>
                    <b>Proteção Anti-bloqueio Uazapi:</b> Disparos automáticos respeitam intervalo seguro de 3.5 segundos entre mensagens para proteger sua conta do WhatsApp.
                  </span>
                </div>

                {/* Botão de Submissão */}
                <Button
                  type="submit"
                  disabled={isSending || selectedPatientIds.length === 0}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-2 h-9"
                >
                  {isSending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processando Disparo...
                    </>
                  ) : recurrence === "none" ? (
                    <>
                      <Send className="w-4 h-4" />
                      Disparar Agora ({selectedPatientIds.length} pacientes)
                    </>
                  ) : (
                    <>
                      <Repeat className="w-4 h-4" />
                      Criar Campanha Recorrente
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </form>
      )}

      {/* SUB-ABA 2: LISTAGEM DE CAMPANHAS RECORRENTES & HISTÓRICO */}
      {subTab === "campanhas" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <Repeat className="w-4 h-4 text-emerald-600" />
              Campanhas Cadastradas ({campaigns.length})
            </h4>
            <Button size="sm" onClick={() => setSubTab("novo_disparo")} className="bg-emerald-600 text-white gap-1.5 h-8 text-xs">
              <Send className="w-3.5 h-3.5" /> Nova Campanha
            </Button>
          </div>

          {campaigns.length === 0 ? (
            <Card className="border-dashed py-10 text-center">
              <CardContent className="space-y-2">
                <Repeat className="w-10 h-10 text-muted-foreground/50 mx-auto" />
                <h5 className="font-semibold text-sm">Nenhuma campanha registrada</h5>
                <p className="text-xs text-muted-foreground">
                  Crie sua primeira campanha em massa ou programada com recorrência na aba ao lado.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {campaigns.map((c) => {
                const isActive = c.status === "active"
                const isCompleted = c.status === "completed"

                return (
                  <Card key={c._id} className="overflow-hidden border">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-sm font-semibold truncate">{c.name}</CardTitle>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-bold py-0.5 ${
                            isActive
                              ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : isCompleted
                              ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                              : "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300"
                          }`}
                        >
                          {isActive ? "Ativa" : isCompleted ? "Concluída" : "Pausada"}
                        </Badge>
                      </div>

                      <CardDescription className="text-xs flex items-center gap-2">
                        <span>Recorrência: <b>{c.recurrence.toUpperCase()}</b></span>
                        <span>•</span>
                        <span>Horário: <b>{c.scheduledHour}</b></span>
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-3 text-xs">
                      {/* Progresso de Envios */}
                      <div className="p-2.5 rounded-lg bg-muted/40 border grid grid-cols-3 text-center">
                        <div>
                          <div className="text-[10px] text-muted-foreground">Destinatários</div>
                          <div className="font-bold text-sm text-foreground">{c.totalRecipients}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-muted-foreground">Enviadas</div>
                          <div className="font-bold text-sm text-emerald-600">{c.sentCount}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-muted-foreground">Falhas</div>
                          <div className="font-bold text-sm text-red-500">{c.failedCount}</div>
                        </div>
                      </div>

                      {/* Próximo Disparo */}
                      {c.nextRunAt && (
                        <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                          <span>Próximo Disparo:</span>
                          <span className="font-medium text-foreground">
                            {new Date(c.nextRunAt).toLocaleString("pt-BR")}
                          </span>
                        </div>
                      )}

                      {/* Ações */}
                      <div className="pt-2 border-t flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRunCampaignNow(c._id)}
                            disabled={isSending}
                            className="h-7 text-[11px] gap-1"
                          >
                            <Play className="w-3 h-3 text-emerald-600" /> Disparar Agora
                          </Button>

                          {!isCompleted && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleToggleStatus(c._id, c.status)}
                              className="h-7 text-[11px] gap-1"
                            >
                              {isActive ? (
                                <>
                                  <Pause className="w-3 h-3 text-amber-500" /> Pausar
                                </>
                              ) : (
                                <>
                                  <Play className="w-3 h-3 text-emerald-500" /> Reativar
                                </>
                              )}
                            </Button>
                          )}
                        </div>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteCampaign(c._id)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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
    </div>
  )
}
