import React, { useState, useMemo } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@convex/_generated/api"
import { useAuth } from "@/contexts/AuthContext"
import type { Specialty } from "@/types"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select } from "@/components/ui/select-native"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Clock,
  Calendar,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  DoorOpen,
  User,
  ShieldCheck,
  Sparkles,
  CalendarDays,
  CalendarOff,
  Stethoscope,
  Filter,
  Layers,
  ChevronRight,
  Info,
  Check,
  X,
} from "lucide-react"
import { formatDateBR, getTodayDateString } from "@/lib/dateUtils"

const DAYS_OF_WEEK = [
  { day: 0, label: "Domingo", short: "Dom" },
  { day: 1, label: "Segunda-feira", short: "Seg" },
  { day: 2, label: "Terça-feira", short: "Ter" },
  { day: 3, label: "Quarta-feira", short: "Qua" },
  { day: 4, label: "Quinta-feira", short: "Qui" },
  { day: 5, label: "Sexta-feira", short: "Sex" },
  { day: 6, label: "Sábado", short: "Sáb" },
]

interface AvailabilityManagerModalProps {
  isOpen: boolean
  onClose: () => void
  initialProfessionalId?: string
  initialRoomId?: string
}

export const AvailabilityManagerModal: React.FC<AvailabilityManagerModalProps> = ({
  isOpen,
  onClose,
  initialProfessionalId,
  initialRoomId,
}) => {
  const { user, isProfessional, isAdmin } = useAuth()

  // Queries Convex
  const rules = useQuery(api.availability.listRules, {}) || []
  const overrides = useQuery(api.availability.listOverrides, {}) || []
  const professionals = useQuery(api.professionals.listProfessionals, {}) || []
  const rooms = useQuery(api.rooms.listRooms, {}) || []

  // Mutations Convex
  const saveRuleMutation = useMutation(api.availability.saveRule)
  const deleteRuleMutation = useMutation(api.availability.deleteRule)
  const saveOverrideMutation = useMutation(api.availability.saveOverride)
  const deleteOverrideMutation = useMutation(api.availability.deleteOverride)

  // Filtros Globais
  const [filterProfId, setFilterProfId] = useState<string>(
    initialProfessionalId || (isProfessional && user?.professionalId ? user.professionalId : "all")
  )
  const [filterRoomId, setFilterRoomId] = useState<string>(initialRoomId || "all")
  const [filterDay, setFilterDay] = useState<string>("all")

  // Aba Ativa: "weekly" | "blocks" | "extras" | "grid"
  const [activeTab, setActiveTab] = useState<"weekly" | "blocks" | "extras" | "grid">("weekly")

  // Toast / Feedback
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const showToast = (type: "success" | "error", message: string) => {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 4000)
  }

  // Estado do Form de Regra Semanal
  const [isRuleFormOpen, setIsRuleFormOpen] = useState(false)
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null)
  const [formProfId, setFormProfId] = useState<string>("")
  const [formRoomId, setFormRoomId] = useState<string>("")
  const [formSpecialty, setFormSpecialty] = useState<"fisioterapia" | "pilates" | "rpg">("fisioterapia")
  const [formDayOfWeek, setFormDayOfWeek] = useState<number>(1)
  const [formStartTime, setFormStartTime] = useState<string>("08:00")
  const [formEndTime, setFormEndTime] = useState<string>("12:00")
  const [formSlotDuration, setFormSlotDuration] = useState<number>(50)
  const [formBreakMinutes, setFormBreakMinutes] = useState<number>(10)
  const [formIsActive, setFormIsActive] = useState<boolean>(true)
  const [isSubmittingRule, setIsSubmittingRule] = useState(false)
  const [ruleError, setRuleError] = useState<string | null>(null)

  // Estado do Form de Bloqueio (Folga / Férias)
  const [isBlockFormOpen, setIsBlockFormOpen] = useState(false)
  const [blockProfId, setBlockProfId] = useState<string>("")
  const [blockRoomId, setBlockRoomId] = useState<string>("all")
  const [blockDate, setBlockDate] = useState<string>(getTodayDateString())
  const [blockIsFullDay, setBlockIsFullDay] = useState<boolean>(true)
  const [blockStartTime, setBlockStartTime] = useState<string>("08:00")
  const [blockEndTime, setBlockEndTime] = useState<string>("12:00")
  const [blockReason, setBlockReason] = useState<string>("Folga programada")
  const [isSubmittingBlock, setIsSubmittingBlock] = useState(false)

  // Estado do Form de Plantão / Dia Extra
  const [isExtraFormOpen, setIsExtraFormOpen] = useState(false)
  const [extraProfId, setExtraProfId] = useState<string>("")
  const [extraRoomId, setExtraRoomId] = useState<string>("")
  const [extraDate, setExtraDate] = useState<string>(getTodayDateString())
  const [extraSpecialty, setExtraSpecialty] = useState<"fisioterapia" | "pilates" | "rpg">("fisioterapia")
  const [extraStartTime, setExtraStartTime] = useState<string>("08:00")
  const [extraEndTime, setExtraEndTime] = useState<string>("12:00")
  const [extraReason, setExtraReason] = useState<string>("Atendimento Extra")
  const [isSubmittingExtra, setIsSubmittingExtra] = useState(false)

  // Sincroniza filtros quando prop mudar
  React.useEffect(() => {
    if (initialProfessionalId) setFilterProfId(initialProfessionalId)
    if (initialRoomId) setFilterRoomId(initialRoomId)
  }, [initialProfessionalId, initialRoomId])

  // Filtragem de Regras
  const filteredRules = useMemo(() => {
    return rules.filter((r) => {
      if (filterProfId !== "all" && r.professionalId !== filterProfId) return false
      if (filterRoomId !== "all" && r.roomId !== filterRoomId) return false
      if (filterDay !== "all" && r.dayOfWeek !== Number(filterDay)) return false
      return true
    })
  }, [rules, filterProfId, filterRoomId, filterDay])

  // Filtragem de Bloqueios e Extras
  const blocksList = useMemo(() => {
    return overrides.filter((o) => {
      if (o.type !== "block") return false
      if (filterProfId !== "all" && o.professionalId !== filterProfId) return false
      if (filterRoomId !== "all" && o.roomId && o.roomId !== filterRoomId) return false
      return true
    })
  }, [overrides, filterProfId, filterRoomId])

  const extrasList = useMemo(() => {
    return overrides.filter((o) => {
      if (o.type !== "extra") return false
      if (filterProfId !== "all" && o.professionalId !== filterProfId) return false
      if (filterRoomId !== "all" && o.roomId && o.roomId !== filterRoomId) return false
      return true
    })
  }, [overrides, filterProfId, filterRoomId])

  // Abre Modal de Nova Regra Semanal
  const handleOpenCreateRule = () => {
    setEditingRuleId(null)
    setFormProfId(
      filterProfId !== "all"
        ? filterProfId
        : (isProfessional && user?.professionalId ? user.professionalId : professionals[0]?._id || "")
    )
    setFormRoomId(filterRoomId !== "all" ? filterRoomId : rooms[0]?._id || "")
    setFormSpecialty("fisioterapia")
    setFormDayOfWeek(filterDay !== "all" ? Number(filterDay) : 1)
    setFormStartTime("08:00")
    setFormEndTime("12:00")
    setFormSlotDuration(50)
    setFormBreakMinutes(10)
    setFormIsActive(true)
    setRuleError(null)
    setIsRuleFormOpen(true)
  }

  // Abre Modal de Edição de Regra Semanal
  const handleOpenEditRule = (rule: any) => {
    setEditingRuleId(rule._id)
    setFormProfId(rule.professionalId)
    setFormRoomId(rule.roomId)
    setFormSpecialty(rule.specialty)
    setFormDayOfWeek(rule.dayOfWeek)
    setFormStartTime(rule.startTime)
    setFormEndTime(rule.endTime)
    setFormSlotDuration(rule.slotDurationMinutes || 50)
    setFormBreakMinutes(rule.breakMinutes || 10)
    setFormIsActive(rule.isActive)
    setRuleError(null)
    setIsRuleFormOpen(true)
  }

  // Salvar Regra Semanal
  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault()
    setRuleError(null)

    if (!formProfId || !formRoomId) {
      setRuleError("Selecione um profissional e uma sala válidos.")
      return
    }

    if (formStartTime >= formEndTime) {
      setRuleError("O horário de início deve ser anterior ao término.")
      return
    }

    setIsSubmittingRule(true)
    try {
      await saveRuleMutation({
        id: editingRuleId ? (editingRuleId as any) : undefined,
        professionalId: formProfId as any,
        roomId: formRoomId as any,
        specialty: formSpecialty,
        dayOfWeek: Number(formDayOfWeek),
        startTime: formStartTime,
        endTime: formEndTime,
        slotDurationMinutes: Number(formSlotDuration),
        breakMinutes: Number(formBreakMinutes),
        isActive: formIsActive,
      })

      showToast("success", "Regra de disponibilidade salva com sucesso!")
      setIsRuleFormOpen(false)
    } catch (err: any) {
      setRuleError(err?.message || "Erro ao salvar disponibilidade.")
    } finally {
      setIsSubmittingRule(false)
    }
  }

  // Excluir Regra Semanal
  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm("Deseja realmente remover esta regra de horário semanal? Os agendamentos de pacientes já marcados permanecerão intactos.")) {
      return
    }
    try {
      await deleteRuleMutation({ id: ruleId as any })
      showToast("success", "Regra de horário removida com sucesso!")
    } catch (err: any) {
      showToast("error", err?.message || "Erro ao remover regra.")
    }
  }

  // Salvar Bloqueio (Folga/Férias)
  const handleSaveBlock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!blockProfId) {
      alert("Selecione o profissional.")
      return
    }

    setIsSubmittingBlock(true)
    try {
      await saveOverrideMutation({
        professionalId: blockProfId as any,
        roomId: blockRoomId !== "all" ? (blockRoomId as any) : undefined,
        date: blockDate,
        type: "block",
        startTime: blockIsFullDay ? undefined : blockStartTime,
        endTime: blockIsFullDay ? undefined : blockEndTime,
        reason: blockReason || "Folga",
      })
      showToast("success", "Bloqueio de agenda cadastrado com sucesso!")
      setIsBlockFormOpen(false)
    } catch (err: any) {
      showToast("error", err?.message || "Erro ao cadastrar bloqueio.")
    } finally {
      setIsSubmittingBlock(false)
    }
  }

  // Salvar Plantão / Atendimento Extra
  const handleSaveExtra = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!extraProfId || !extraRoomId) {
      alert("Selecione o profissional e a sala.")
      return
    }
    if (extraStartTime >= extraEndTime) {
      alert("O horário de início deve ser anterior ao término.")
      return
    }

    setIsSubmittingExtra(true)
    try {
      await saveOverrideMutation({
        professionalId: extraProfId as any,
        roomId: extraRoomId as any,
        date: extraDate,
        type: "extra",
        startTime: extraStartTime,
        endTime: extraEndTime,
        specialty: extraSpecialty,
        reason: extraReason || "Atendimento Extra",
      })
      showToast("success", "Atendimento extra cadastrado com sucesso!")
      setIsExtraFormOpen(false)
    } catch (err: any) {
      showToast("error", err?.message || "Erro ao cadastrar atendimento extra.")
    } finally {
      setIsSubmittingExtra(false)
    }
  }

  // Excluir Exceção
  const handleDeleteOverride = async (overrideId: string) => {
    if (!confirm("Deseja remover esta exceção de agenda?")) return
    try {
      await deleteOverrideMutation({ id: overrideId as any })
      showToast("success", "Exceção removida com sucesso!")
    } catch (err: any) {
      showToast("error", err?.message || "Erro ao remover exceção.")
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden border-border bg-background">
        {/* Cabeçalho */}
        <DialogHeader className="p-6 pb-4 border-b border-border bg-card/60">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
                  Gestão de Horários & Disponibilidade
                  <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border-primary/20">
                    Atendimento Clínico
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Defina os dias e horários em que os profissionais atendem em cada sala e controle folgas e plantões.
                </DialogDescription>
              </div>
            </div>
          </div>

          {/* Feedback Toast */}
          {feedback && (
            <div
              className={`mt-3 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all animate-in fade-in ${
                feedback.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                  : "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400"
              }`}
            >
              {feedback.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* Barra de Filtros Rápidos */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3">
            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Filtrar por Profissional</label>
              <Select value={filterProfId} onChange={(e) => setFilterProfId(e.target.value)}>
                <option value="all">Todos os Profissionais</option>
                {professionals.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Filtrar por Sala</label>
              <Select value={filterRoomId} onChange={(e) => setFilterRoomId(e.target.value)}>
                <option value="all">Todas as Salas</option>
                {rooms.map((r) => (
                  <option key={r._id} value={r._id}>
                    {r.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Dia da Semana</label>
              <Select value={filterDay} onChange={(e) => setFilterDay(e.target.value)}>
                <option value="all">Todos os Dias</option>
                {DAYS_OF_WEEK.map((d) => (
                  <option key={d.day} value={d.day}>
                    {d.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </DialogHeader>

        {/* Abas Principais */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border">
              <TabsList className="bg-muted/40 p-1 rounded-xl">
                <TabsTrigger value="weekly" className="text-xs font-semibold rounded-lg">
                  <CalendarDays className="w-3.5 h-3.5 mr-1.5" />
                  Grade Semanal ({filteredRules.length})
                </TabsTrigger>
                <TabsTrigger value="blocks" className="text-xs font-semibold rounded-lg">
                  <CalendarOff className="w-3.5 h-3.5 mr-1.5" />
                  Folgas & Férias ({blocksList.length})
                </TabsTrigger>
                <TabsTrigger value="extras" className="text-xs font-semibold rounded-lg">
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  Plantões Extras ({extrasList.length})
                </TabsTrigger>
                <TabsTrigger value="grid" className="text-xs font-semibold rounded-lg">
                  <Layers className="w-3.5 h-3.5 mr-1.5" />
                  Visão Semanal
                </TabsTrigger>
              </TabsList>

              {activeTab === "weekly" && (
                <Button onClick={handleOpenCreateRule} size="sm" className="rounded-xl gap-1.5 font-semibold text-xs shadow-sm">
                  <Plus className="w-4 h-4" />
                  Novo Horário Semanal
                </Button>
              )}

              {activeTab === "blocks" && (
                <Button
                  onClick={() => {
                    setBlockProfId(filterProfId !== "all" ? filterProfId : professionals[0]?._id || "")
                    setBlockRoomId(filterRoomId)
                    setBlockDate(getTodayDateString())
                    setBlockIsFullDay(true)
                    setBlockReason("Folga")
                    setIsBlockFormOpen(true)
                  }}
                  size="sm"
                  variant="outline"
                  className="rounded-xl gap-1.5 font-semibold text-xs border-rose-500/30 text-rose-600 hover:bg-rose-500/10"
                >
                  <Plus className="w-4 h-4" />
                  Registrar Bloqueio de Folga
                </Button>
              )}

              {activeTab === "extras" && (
                <Button
                  onClick={() => {
                    setExtraProfId(filterProfId !== "all" ? filterProfId : professionals[0]?._id || "")
                    setExtraRoomId(filterRoomId !== "all" ? filterRoomId : rooms[0]?._id || "")
                    setExtraDate(getTodayDateString())
                    setExtraSpecialty("fisioterapia")
                    setIsExtraFormOpen(true)
                  }}
                  size="sm"
                  variant="outline"
                  className="rounded-xl gap-1.5 font-semibold text-xs border-primary/30 text-primary hover:bg-primary/10"
                >
                  <Plus className="w-4 h-4" />
                  Abrir Atendimento Extra
                </Button>
              )}
            </div>

            {/* TAB 1: GRADE SEMANAL */}
            <TabsContent value="weekly" className="mt-4 space-y-4">
              {filteredRules.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-border rounded-2xl bg-muted/10 p-6">
                  <Clock className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
                  <h4 className="text-base font-semibold text-foreground">Nenhum horário de atendimento configurado</h4>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1 mb-4">
                    Cadastre os dias e turnos em que os fisioterapeutas atendem em cada sala para liberar vagas na página pública de agendamento (/agendar) e na agenda interna.
                  </p>
                  <Button onClick={handleOpenCreateRule} size="sm" className="rounded-xl gap-2 text-xs font-semibold">
                    <Plus className="w-4 h-4" />
                    Adicionar Primeiro Horário
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {filteredRules.map((rule) => {
                    const dayObj = DAYS_OF_WEEK.find((d) => d.day === rule.dayOfWeek)
                    return (
                      <div
                        key={rule._id}
                        className="p-4 rounded-2xl border border-border/80 bg-card hover:border-primary/40 transition-all shadow-xs flex flex-col justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <Badge className="bg-primary/15 text-primary border-primary/30 text-xs font-bold px-2.5 py-0.5 rounded-lg">
                                {dayObj?.label || "Dia"}
                              </Badge>
                              <span className="text-sm font-extrabold text-foreground flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                                {rule.startTime} às {rule.endTime}
                              </span>
                            </div>
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-bold ${
                                rule.isActive
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                                  : "bg-muted text-muted-foreground border-border"
                              }`}
                            >
                              {rule.isActive ? "Ativo" : "Pausado"}
                            </Badge>
                          </div>

                          <div className="space-y-1.5 text-xs">
                            <div className="flex items-center gap-2 text-foreground font-semibold">
                              <Stethoscope className="w-4 h-4 text-primary shrink-0" />
                              <span>{rule.professionalName}</span>
                              <Badge variant="secondary" className="text-[9px] uppercase font-bold px-1.5 py-0">
                                {rule.specialty}
                              </Badge>
                            </div>

                            <div className="flex items-center gap-2 text-muted-foreground">
                              <div
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: rule.roomColor || "#10B981" }}
                              />
                              <span>{rule.roomName}</span>
                              <span className="text-[10px] text-muted-foreground/70">
                                (Capacidade: {rule.roomCapacity} {rule.roomCapacity === 1 ? "paciente" : "alunos"})
                              </span>
                            </div>

                            <div className="text-[11px] text-muted-foreground/80 pt-1 flex items-center gap-3">
                              <span>⏱ Sessões: <b>{rule.slotDurationMinutes || 50} min</b></span>
                              <span>☕ Intervalo: <b>{rule.breakMinutes || 10} min</b></span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEditRule(rule)}
                            className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground rounded-lg"
                          >
                            <Edit2 className="w-3.5 h-3.5 mr-1" />
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteRule(rule._id)}
                            className="h-8 px-2.5 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-lg"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1" />
                            Excluir
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </TabsContent>

            {/* TAB 2: BLOQUEIOS (FOLGAS E FÉRIAS) */}
            <TabsContent value="blocks" className="mt-4 space-y-4">
              {blocksList.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-border rounded-2xl bg-muted/10 p-6">
                  <CalendarOff className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
                  <h4 className="text-base font-semibold text-foreground">Nenhuma folga ou bloqueio registrado</h4>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1 mb-4">
                    Registre feriados, atestados, congressos ou períodos de férias para impedir que pacientes agendem horários nessas datas.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {blocksList.map((block) => (
                    <div
                      key={block._id}
                      className="p-4 rounded-2xl border border-rose-500/20 bg-rose-500/5 shadow-xs flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <Badge className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 text-xs font-bold">
                            {formatDateBR(block.date)}
                          </Badge>
                          <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                            {block.startTime && block.endTime
                              ? `${block.startTime} às ${block.endTime}`
                              : "Dia Completo"}
                          </span>
                        </div>

                        <h5 className="text-sm font-bold text-foreground">{block.reason || "Folga"}</h5>
                        <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                          <div>Profissional: <b className="text-foreground">{block.professionalName}</b></div>
                          <div>Ambiente: <b>{block.roomName || "Todas as salas"}</b></div>
                        </div>
                      </div>

                      <div className="flex justify-end pt-2 border-t border-border/40">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteOverride(block._id)}
                          className="h-7 px-2 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" />
                          Remover Bloqueio
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* TAB 3: PLANTÕES & DIAS EXTRAS */}
            <TabsContent value="extras" className="mt-4 space-y-4">
              {extrasList.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-border rounded-2xl bg-muted/10 p-6">
                  <Sparkles className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
                  <h4 className="text-base font-semibold text-foreground">Nenhum atendimento extra ou plantão avulso</h4>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1 mb-4">
                    Abra horários pontuais em dias que não fazem parte da sua rotina semanal padrão (ex: mutirões de fisioterapia ou plantão no sábado).
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {extrasList.map((extra) => (
                    <div
                      key={extra._id}
                      className="p-4 rounded-2xl border border-primary/30 bg-primary/5 shadow-xs flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <Badge className="bg-primary/15 text-primary border-primary/30 text-xs font-bold">
                            {formatDateBR(extra.date)}
                          </Badge>
                          <span className="text-xs font-bold text-primary">
                            {extra.startTime} às {extra.endTime}
                          </span>
                        </div>

                        <h5 className="text-sm font-bold text-foreground">{extra.reason || "Atendimento Extra"}</h5>
                        <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                          <div>Profissional: <b className="text-foreground">{extra.professionalName}</b></div>
                          <div>Sala: <b className="text-foreground">{extra.roomName}</b></div>
                        </div>
                      </div>

                      <div className="flex justify-end pt-2 border-t border-border/40">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteOverride(extra._id)}
                          className="h-7 px-2 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" />
                          Remover Plantão
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* TAB 4: VISÃO SEMANAL (GRID RESUMIDO) */}
            <TabsContent value="grid" className="mt-4">
              <div className="border border-border rounded-2xl p-4 bg-card/50 overflow-x-auto">
                <div className="grid grid-cols-6 gap-3 min-w-[650px]">
                  {DAYS_OF_WEEK.filter((d) => d.day !== 0).map((d) => {
                    const dayRules = filteredRules.filter((r) => r.dayOfWeek === d.day)
                    return (
                      <div key={d.day} className="rounded-xl border border-border/80 bg-background/80 p-3 flex flex-col gap-2">
                        <div className="text-center pb-2 border-b border-border">
                          <span className="text-xs font-extrabold text-foreground">{d.short}</span>
                          <div className="text-[10px] text-muted-foreground">{dayRules.length} turnos</div>
                        </div>

                        <div className="space-y-2 flex-1">
                          {dayRules.length === 0 ? (
                            <div className="text-[10px] text-muted-foreground/60 text-center py-6">Fechado</div>
                          ) : (
                            dayRules.map((r) => (
                              <div
                                key={r._id}
                                className="p-2 rounded-lg text-[11px] border border-border/60 bg-muted/20 space-y-0.5"
                              >
                                <div className="font-extrabold text-foreground">{r.startTime} - {r.endTime}</div>
                                <div className="text-primary truncate font-medium">{r.professionalName}</div>
                                <div className="text-muted-foreground truncate text-[10px]">{r.roomName}</div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Rodapé com Fechar */}
        <DialogFooter className="p-4 px-6 border-t border-border bg-card/60 flex items-center justify-between">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-primary shrink-0" />
            <span>As regras salvas refletem imediatamente na página pública <b>/agendar</b>.</span>
          </div>
          <Button onClick={onClose} variant="outline" size="sm" className="rounded-xl text-xs font-semibold">
            Fechar
          </Button>
        </DialogFooter>

        {/* SUBMODAL 1: CADASTRAR / EDITAR REGRA SEMANAL */}
        <Dialog open={isRuleFormOpen} onOpenChange={setIsRuleFormOpen}>
          <DialogContent className="sm:max-w-lg">
            <form onSubmit={handleSaveRule}>
              <DialogHeader>
                <DialogTitle className="text-lg font-bold text-foreground">
                  {editingRuleId ? "Editar Horário Semanal" : "Novo Horário Semanal"}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Vincule o profissional à sala e configure os horários de expediente semanal recorrente.
                </DialogDescription>
              </DialogHeader>

              {ruleError && (
                <div className="mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{ruleError}</span>
                </div>
              )}

              <div className="space-y-4 py-4 text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-foreground/85 mb-1">Profissional *</label>
                    <Select value={formProfId} onChange={(e) => setFormProfId(e.target.value)} required>
                      <option value="">Selecione...</option>
                      {professionals.map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.name}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground/85 mb-1">Ambiente / Sala *</label>
                    <Select value={formRoomId} onChange={(e) => setFormRoomId(e.target.value)} required>
                      <option value="">Selecione...</option>
                      {rooms.map((r) => (
                        <option key={r._id} value={r._id}>
                          {r.name} ({r.capacity} vagas)
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-foreground/85 mb-1">Dia da Semana *</label>
                    <Select value={String(formDayOfWeek)} onChange={(e) => setFormDayOfWeek(Number(e.target.value))}>
                      {DAYS_OF_WEEK.map((d) => (
                        <option key={d.day} value={d.day}>
                          {d.label}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground/85 mb-1">Especialidade Clínica *</label>
                    <Select value={formSpecialty} onChange={(e) => setFormSpecialty(e.target.value as any)}>
                      <option value="fisioterapia">Fisioterapia Avançada</option>
                      <option value="pilates">Pilates (Solo & Aparelhos)</option>
                      <option value="rpg">RPG (Postural)</option>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-foreground/85 mb-1">Horário de Início *</label>
                    <Input
                      type="time"
                      required
                      value={formStartTime}
                      onChange={(e) => setFormStartTime(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-foreground/85 mb-1">Horário de Término *</label>
                    <Input
                      type="time"
                      required
                      value={formEndTime}
                      onChange={(e) => setFormEndTime(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-foreground/85 mb-1">Duração da Sessão (min)</label>
                    <Input
                      type="number"
                      min={20}
                      max={180}
                      step={5}
                      value={formSlotDuration}
                      onChange={(e) => setFormSlotDuration(Number(e.target.value))}
                    />
                    <span className="text-[10px] text-muted-foreground mt-0.5 block">Ex: 50 min para Fisio</span>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-foreground/85 mb-1">Intervalo entre Sessões (min)</label>
                    <Input
                      type="number"
                      min={0}
                      max={60}
                      step={5}
                      value={formBreakMinutes}
                      onChange={(e) => setFormBreakMinutes(Number(e.target.value))}
                    />
                    <span className="text-[10px] text-muted-foreground mt-0.5 block">Ex: 10 min de respiro</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="rule-active"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="rounded border-input text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                  />
                  <label htmlFor="rule-active" className="text-xs font-semibold text-foreground cursor-pointer select-none">
                    Horário semanal ativo para agendamento
                  </label>
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsRuleFormOpen(false)} className="rounded-xl text-xs">
                  Cancelar
                </Button>
                <Button type="submit" size="sm" disabled={isSubmittingRule} className="rounded-xl text-xs font-semibold">
                  {isSubmittingRule ? "Salvando..." : "Salvar Horário"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* SUBMODAL 2: REGISTRAR BLOQUEIO DE FOLGA */}
        <Dialog open={isBlockFormOpen} onOpenChange={setIsBlockFormOpen}>
          <DialogContent className="sm:max-w-md">
            <form onSubmit={handleSaveBlock}>
              <DialogHeader>
                <DialogTitle className="text-lg font-bold text-foreground">Bloqueio de Agenda (Folga/Férias)</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Impeça agendamentos para este profissional na data selecionada.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4 text-sm">
                <div>
                  <label className="block text-xs font-semibold text-foreground/85 mb-1">Profissional *</label>
                  <Select value={blockProfId} onChange={(e) => setBlockProfId(e.target.value)} required>
                    <option value="">Selecione...</option>
                    {professionals.map((p) => (
                      <option key={p._id} value={p._id}>{p.name}</option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground/85 mb-1">Data do Bloqueio *</label>
                  <Input
                    type="date"
                    required
                    value={blockDate}
                    onChange={(e) => setBlockDate(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground/85 mb-1">Motivo do Bloqueio *</label>
                  <Input
                    placeholder="Ex: Férias, Folga, Congresso, Atestado Médico"
                    required
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                  />
                </div>

                <div className="p-3 rounded-xl bg-muted/20 border border-border space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="block-full-day"
                      checked={blockIsFullDay}
                      onChange={(e) => setBlockIsFullDay(e.target.checked)}
                      className="rounded border-input text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                    />
                    <label htmlFor="block-full-day" className="text-xs font-semibold text-foreground cursor-pointer select-none">
                      Bloquear o dia inteiro
                    </label>
                  </div>

                  {!blockIsFullDay && (
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Das:</label>
                        <Input
                          type="time"
                          value={blockStartTime}
                          onChange={(e) => setBlockStartTime(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Até:</label>
                        <Input
                          type="time"
                          value={blockEndTime}
                          onChange={(e) => setBlockEndTime(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsBlockFormOpen(false)} className="rounded-xl text-xs">
                  Cancelar
                </Button>
                <Button type="submit" size="sm" disabled={isSubmittingBlock} className="rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white">
                  {isSubmittingBlock ? "Salvando..." : "Confirmar Bloqueio"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* SUBMODAL 3: ABRIR PLANTÃO / ATENDIMENTO EXTRA */}
        <Dialog open={isExtraFormOpen} onOpenChange={setIsExtraFormOpen}>
          <DialogContent className="sm:max-w-md">
            <form onSubmit={handleSaveExtra}>
              <DialogHeader>
                <DialogTitle className="text-lg font-bold text-foreground">Abrir Atendimento Extra (Plantão)</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Disponibilize vagas avulsas para uma data específica fora da rotina padrão.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4 text-sm">
                <div>
                  <label className="block text-xs font-semibold text-foreground/85 mb-1">Profissional *</label>
                  <Select value={extraProfId} onChange={(e) => setExtraProfId(e.target.value)} required>
                    <option value="">Selecione...</option>
                    {professionals.map((p) => (
                      <option key={p._id} value={p._id}>{p.name}</option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground/85 mb-1">Sala / Ambiente *</label>
                  <Select value={extraRoomId} onChange={(e) => setExtraRoomId(e.target.value)} required>
                    <option value="">Selecione...</option>
                    {rooms.map((r) => (
                      <option key={r._id} value={r._id}>{r.name}</option>
                    ))}
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-foreground/85 mb-1">Data *</label>
                    <Input
                      type="date"
                      required
                      value={extraDate}
                      onChange={(e) => setExtraDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-foreground/85 mb-1">Especialidade *</label>
                    <Select value={extraSpecialty} onChange={(e) => setExtraSpecialty(e.target.value as any)}>
                      <option value="fisioterapia">Fisioterapia</option>
                      <option value="pilates">Pilates</option>
                      <option value="rpg">RPG</option>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-foreground/85 mb-1">Início *</label>
                    <Input
                      type="time"
                      required
                      value={extraStartTime}
                      onChange={(e) => setExtraStartTime(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-foreground/85 mb-1">Término *</label>
                    <Input
                      type="time"
                      required
                      value={extraEndTime}
                      onChange={(e) => setExtraEndTime(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground/85 mb-1">Descrição / Motivo</label>
                  <Input
                    placeholder="Ex: Plantão Sábado, Mutirão de Avaliações"
                    value={extraReason}
                    onChange={(e) => setExtraReason(e.target.value)}
                  />
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsExtraFormOpen(false)} className="rounded-xl text-xs">
                  Cancelar
                </Button>
                <Button type="submit" size="sm" disabled={isSubmittingExtra} className="rounded-xl text-xs font-semibold">
                  {isSubmittingExtra ? "Salvando..." : "Abrir Horários Extras"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  )
}
