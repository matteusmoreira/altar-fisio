import React, { useState } from "react"
import { useClinicData } from "@/contexts/ClinicDataContext"
import { useAuth } from "@/contexts/AuthContext"
import type { Schedule, ScheduleParticipant } from "@/types"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select-native"
import {
  formatDateBR,
  formatDateWithWeekdayBR,
  addDaysSafe,
  addWeeksSafe,
  addMonthsSafe,
  getWeekRange,
  formatWeekRangeBR,
  formatMonthYearBR,
  getTodayDateString,
} from "@/lib/dateUtils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Calendar as CalendarIcon,
  Clock,
  User,
  Plus,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  Send,
  CheckCircle2,
  AlertCircle,
  Filter,
  Repeat,
  ShieldAlert,
  Sparkles,
  AlertTriangle,
} from "lucide-react"
import { ViewModeToggle, type ViewMode } from "@/components/ui/view-mode-toggle"
import { AvailabilityManagerModal } from "@/components/availability/AvailabilityManagerModal"
import { SchedulePeriodToggle } from "@/components/schedule/SchedulePeriodToggle"
import { ScheduleMetricsBar } from "@/components/schedule/ScheduleMetricsBar"
import { WeeklyScheduleView } from "@/components/schedule/WeeklyScheduleView"
import { MonthlyScheduleView } from "@/components/schedule/MonthlyScheduleView"
import { ScheduleDetailModal } from "@/components/schedule/ScheduleDetailModal"

export const SchedulePage: React.FC = () => {
  const { user, isProfessional } = useAuth()
  const {
    schedules,
    rooms,
    professionals,
    patients,
    replacementCredits,
    selectedDate,
    setSelectedDate,
    schedulePeriodMode,
    setSchedulePeriodMode,
    addSchedule,
    addRecurringScheduleSeries,
    addParticipantToClass,
    checkIn,
    cancelWithReplacement,
    sendWhatsAppReminder,
  } = useClinicData()

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem("altar_schedule_view_mode")
    return saved === "list" || saved === "grid" ? saved : "list"
  })

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode)
    localStorage.setItem("altar_schedule_view_mode", mode)
  }

  const [selectedRoom, setSelectedRoom] = useState<string>("all")
  const [selectedProf, setSelectedProf] = useState<string>(
    isProfessional && user?.professionalId ? user.professionalId : "all"
  )
  const [isNewModalOpen, setIsNewModalOpen] = useState(false)
  const [isAvailabilityModalOpen, setIsAvailabilityModalOpen] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  // Form State para Novo Agendamento (Único ou Recorrente)
  const [creationMode, setCreationMode] = useState<"single" | "recurring">("single")
  const [title, setTitle] = useState("")
  const [type, setType] = useState<"individual" | "turma">("turma")
  const [specialty, setSpecialty] = useState<"pilates" | "fisioterapia" | "rpg">("pilates")
  const [roomId, setRoomId] = useState(rooms[0]?.id || "")
  const [profId, setProfId] = useState(professionals[0]?.id || "")
  const [startTime, setStartTime] = useState("08:00")
  const [endTime, setEndTime] = useState("08:55")
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 3]) // Seg e Qua
  const [weeksCount, setWeeksCount] = useState<number>(4)
  const [enrolledPatients, setEnrolledPatients] = useState<string[]>([])
  const [modalError, setModalError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Seleção de Paciente no Agendamento Único (Balcão / Presencial)
  const [singlePatientId, setSinglePatientId] = useState("")
  const [singleIsReplacement, setSingleIsReplacement] = useState(false)
  const [singleCreditId, setSingleCreditId] = useState("")

  // Modal de Encaixe / Agendamento Rápido em Horário Existente da Grade
  const [enrollTarget, setEnrollTarget] = useState<Schedule | null>(null)
  const [enrollPatientId, setEnrollPatientId] = useState("")
  const [enrollIsReplacement, setEnrollIsReplacement] = useState(false)
  const [enrollCreditId, setEnrollCreditId] = useState("")
  const [enrollError, setEnrollError] = useState<string | null>(null)
  const [isSubmittingEnroll, setIsSubmittingEnroll] = useState(false)

  const handleOpenEnrollModal = (schedule: Schedule) => {
    setEnrollTarget(schedule)
    setEnrollPatientId(patients[0]?.id || "")
    setEnrollIsReplacement(false)
    setEnrollCreditId("")
    setEnrollError(null)
  }

  const handleConfirmEnroll = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!enrollTarget || !enrollPatientId) {
      setEnrollError("Selecione um paciente para agendar.")
      return
    }

    setIsSubmittingEnroll(true)
    setEnrollError(null)

    try {
      await addParticipantToClass(
        enrollTarget.id,
        enrollPatientId,
        enrollIsReplacement,
        enrollCreditId || undefined
      )
      const patient = patients.find((p) => p.id === enrollPatientId)
      setFeedback(`Paciente ${patient?.name || ""} agendado com sucesso para às ${enrollTarget.startTime}!`)
      setEnrollTarget(null)
      setTimeout(() => setFeedback(null), 4000)
    } catch (err: any) {
      setEnrollError(err?.message || "Erro ao agendar paciente.")
    } finally {
      setIsSubmittingEnroll(false)
    }
  }

  // Modal de Desmarcação com Regra de Antecedência
  const [cancelTarget, setCancelTarget] = useState<{
    schedule: Schedule
    participant: any
  } | null>(null)
  const [cancelReason, setCancelReason] = useState("")
  const [forceExemption, setForceExemption] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)

  // Modal de Detalhes do Agendamento (Semana / Mês)
  const [selectedDetailSchedule, setSelectedDetailSchedule] = useState<Schedule | null>(null)

  // Navegação de datas adaptativa ao período ativo
  const handleDateChange = (offset: number) => {
    if (schedulePeriodMode === "day") {
      setSelectedDate(addDaysSafe(selectedDate, offset))
    } else if (schedulePeriodMode === "week") {
      setSelectedDate(addWeeksSafe(selectedDate, offset))
    } else if (schedulePeriodMode === "month") {
      setSelectedDate(addMonthsSafe(selectedDate, offset))
    }
  }

  // Filtragem por Sala e Profissional
  const filteredSchedules = schedules.filter((s) => {
    const matchRoom = selectedRoom === "all" || s.roomId === selectedRoom
    const matchProf = selectedProf === "all" || s.professionalId === selectedProf
    return matchRoom && matchProf
  })

  // Agendamentos do dia selecionado (para a Visão Diária)
  const dayFilteredSchedules = filteredSchedules.filter((s) => s.date === selectedDate)

  const toggleDayOfWeek = (day: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    )
  }

  const toggleEnrolledPatient = (patId: string) => {
    setEnrolledPatients((prev) =>
      prev.includes(patId) ? prev.filter((id) => id !== patId) : [...prev, patId]
    )
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setModalError(null)
    setIsSubmitting(true)

    const room = rooms.find((r) => r.id === roomId)
    const prof = professionals.find((p) => p.id === profId)

    if (!room || !prof) {
      setModalError("Selecione uma sala e um profissional válidos.")
      setIsSubmitting(false)
      return
    }

    try {
      if (creationMode === "single") {
        const selectedPat = patients.find((p) => p.id === singlePatientId)
        const defaultTitle = `${type === "turma" ? "Turma" : "Atendimento"} de ${specialty.toUpperCase()}${
          selectedPat ? ` - ${selectedPat.name}` : ""
        }`

        const createdScheduleId = await addSchedule({
          title: title || defaultTitle,
          type,
          specialty,
          roomId,
          roomName: room.name,
          roomColor: room.color,
          roomCapacity: room.capacity,
          professionalId: profId,
          professionalName: prof.name,
          date: selectedDate,
          startTime,
          endTime,
          maxCapacity: type === "turma" ? room.capacity : 1,
          status: "scheduled",
        })

        if (singlePatientId) {
          await addParticipantToClass(
            createdScheduleId,
            singlePatientId,
            singleIsReplacement,
            singleCreditId || undefined
          )
          setFeedback(`Horário agendado com sucesso para ${selectedPat?.name || "o paciente"}!`)
        } else {
          setFeedback("Horário adicionado à agenda com sucesso!")
        }
      } else {
        if (daysOfWeek.length === 0) {
          setModalError("Selecione ao menos um dia da semana para a turma recorrente.")
          setIsSubmitting(false)
          return
        }

        const res = await addRecurringScheduleSeries({
          title: title || `Turma Recorrente de ${specialty.toUpperCase()}`,
          type,
          specialty,
          roomId,
          professionalId: profId,
          startTime,
          endTime,
          maxCapacity: room.capacity,
          daysOfWeek,
          startDate: selectedDate,
          weeksCount,
          enrolledPatientIds: enrolledPatients,
        })

        if (res.skippedCount > 0) {
          setFeedback(`Série criada: ${res.createdCount} aulas agendadas (${res.skippedCount} datas puladas por conflito).`)
        } else {
          setFeedback(`Série recorrente criada: ${res.createdCount} aulas agendadas com sucesso!`)
        }
      }

      setIsNewModalOpen(false)
      setTitle("")
      setSinglePatientId("")
      setSingleIsReplacement(false)
      setSingleCreditId("")
      setEnrolledPatients([])
      setModalError(null)
      setTimeout(() => setFeedback(null), 4000)
    } catch (err: any) {
      setModalError(err?.message || "Erro ao criar agendamento.")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Cálculo de antecedência da aula selecionada para cancelamento
  const getNoticeInfo = () => {
    if (!cancelTarget) return null
    const sessionMs = new Date(`${cancelTarget.schedule.date}T${cancelTarget.schedule.startTime}:00-03:00`).getTime()
    const nowMs = Date.now()
    const diffHours = (sessionMs - nowMs) / (1000 * 60 * 60)
    const isWithinPolicy = diffHours >= 2

    return {
      diffHours: Number(diffHours.toFixed(1)),
      isWithinPolicy,
      formattedText: diffHours > 0
        ? `${Math.floor(diffHours)}h ${Math.round((diffHours % 1) * 60)}min de antecedência`
        : "Horário já iniciado ou passado",
    }
  }

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return
    setIsCancelling(true)

    try {
      const res = await cancelWithReplacement(
        cancelTarget.schedule.id,
        cancelTarget.participant.id,
        cancelReason,
        forceExemption
      )

      if (res.generatedCredit) {
        setFeedback(
          res.expiryDate
            ? `Desmarcado! Crédito de reposição gerado com validade até ${formatDateBR(res.expiryDate)}.`
            : "Desmarcado! Crédito de reposição gerado com sucesso."
        )
      } else {
        setFeedback(
          res.message || "Desmarcado e registrado como falta (fora do prazo mínimo de 2h da clínica)."
        )
      }

      setCancelTarget(null)
      setCancelReason("")
      setForceExemption(false)
      setTimeout(() => setFeedback(null), 4000)
    } catch (err: any) {
      alert(err?.message || "Erro ao desmarcar.")
    } finally {
      setIsCancelling(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {feedback && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm font-medium animate-fade-in">
          <CheckCircle2 className="h-4 w-4" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Header & Seletor de Data */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <CalendarIcon className="h-6 w-6 text-primary" />
            <span>Agenda & Marcações</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Gestão de atendimentos individuais, turmas de pilates e controle de presença.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            onClick={() => setIsAvailabilityModalOpen(true)}
            className="gap-2 shadow-sm border-primary/30 text-primary hover:bg-primary/5"
            title="Configurar horários de atendimento, salas e folgas"
          >
            <Clock className="h-4 w-4" />
            <span>{isProfessional ? "Minha Disponibilidade" : "Escalas & Horários"}</span>
          </Button>

          <Button onClick={() => setIsNewModalOpen(true)} className="gap-2 shadow-sm">
            <Plus className="h-4 w-4" />
            <span>Novo Agendamento / Turma</span>
          </Button>
        </div>
      </div>

      {/* Barra de Navegação de Data & Filtros */}
      <Card className="p-4 bg-card shadow-xs border-border">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Seletor de Período / Data */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleDateChange(-1)}
                className="h-10 w-10 rounded-xl"
                title={
                  schedulePeriodMode === "day"
                    ? "Dia anterior"
                    : schedulePeriodMode === "week"
                    ? "Semana anterior"
                    : "Mês anterior"
                }
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl border border-input bg-background shadow-2xs">
                <CalendarIcon className="h-4 w-4 text-primary shrink-0" />
                <input
                  type={schedulePeriodMode === "month" ? "month" : "date"}
                  value={
                    schedulePeriodMode === "month"
                      ? selectedDate.slice(0, 7)
                      : selectedDate
                  }
                  onChange={(e) => {
                    if (schedulePeriodMode === "month") {
                      setSelectedDate(`${e.target.value}-01`)
                    } else {
                      setSelectedDate(e.target.value)
                    }
                  }}
                  className="bg-transparent text-sm font-semibold text-foreground focus:outline-none cursor-pointer"
                />
              </div>

              <Button
                variant="outline"
                size="icon"
                onClick={() => handleDateChange(1)}
                className="h-10 w-10 rounded-xl"
                title={
                  schedulePeriodMode === "day"
                    ? "Próximo dia"
                    : schedulePeriodMode === "week"
                    ? "Próxima semana"
                    : "Próximo mês"
                }
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedDate(getTodayDateString())}
              className="h-10 px-3.5 rounded-xl text-xs font-semibold text-primary border-primary/30 hover:bg-primary/5"
            >
              Hoje
            </Button>

            {/* Rótulo Descritivo do Período */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted/50 border border-border text-xs text-foreground">
              {schedulePeriodMode === "day" ? (
                <>
                  <span className="font-semibold">{formatDateWithWeekdayBR(selectedDate)}</span>
                  <span className="text-primary font-bold">({formatDateBR(selectedDate)})</span>
                </>
              ) : schedulePeriodMode === "week" ? (
                <>
                  <span className="font-semibold">Semana:</span>
                  <span className="text-primary font-bold">
                    {formatWeekRangeBR(
                      getWeekRange(selectedDate).startDate,
                      getWeekRange(selectedDate).endDate
                    )}
                  </span>
                </>
              ) : (
                <>
                  <span className="font-semibold">Mês de</span>
                  <span className="text-primary font-bold">{formatMonthYearBR(selectedDate)}</span>
                </>
              )}
            </div>
          </div>

          {/* Filtros de Sala, Profissional e Modo de Período */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />
              <span className="font-medium">Filtrar:</span>
            </div>

            {/* Filtro por Sala */}
            <div className="w-36 sm:w-44">
              <Select
                value={selectedRoom}
                onChange={(e) => setSelectedRoom(e.target.value)}
              >
                <option value="all">Todas as Salas</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
            </div>

            {/* Filtro por Profissional */}
            <div className="w-40 sm:w-48">
              <Select
                value={selectedProf}
                onChange={(e) => setSelectedProf(e.target.value)}
              >
                <option value="all">Todos os Profissionais</option>
                {professionals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>

            {/* Alternador de Período [ Dia | Semana | Mês ] */}
            <SchedulePeriodToggle
              period={schedulePeriodMode}
              onChange={setSchedulePeriodMode}
            />

            {/* Alternador Grade/Lista (Apenas no Modo Dia) */}
            {schedulePeriodMode === "day" && (
              <ViewModeToggle viewMode={viewMode} onChange={handleViewModeChange} />
            )}
          </div>
        </div>
      </Card>

      {/* Barra de Métricas Resumo da Semana ou do Mês */}
      {schedulePeriodMode !== "day" && (
        <ScheduleMetricsBar schedules={filteredSchedules} />
      )}

      {/* VISÃO DA AGENDA: SEMANA, MÊS OU DIA */}
      {schedulePeriodMode === "week" ? (
        <WeeklyScheduleView
          currentDate={selectedDate}
          schedules={filteredSchedules}
          onSelectSchedule={(sch) => setSelectedDetailSchedule(sch)}
          onCreateScheduleAtDate={(date) => {
            setSelectedDate(date)
            setIsNewModalOpen(true)
          }}
          onOpenEnroll={(sch) => handleOpenEnrollModal(sch)}
        />
      ) : schedulePeriodMode === "month" ? (
        <MonthlyScheduleView
          currentDate={selectedDate}
          schedules={filteredSchedules}
          onSelectSchedule={(sch) => setSelectedDetailSchedule(sch)}
          onCreateScheduleAtDate={(date) => {
            setSelectedDate(date)
            setIsNewModalOpen(true)
          }}
          onNavigateToDay={(date) => {
            setSelectedDate(date)
            setSchedulePeriodMode("day")
          }}
          onOpenEnroll={(sch) => handleOpenEnrollModal(sch)}
        />
      ) : dayFilteredSchedules.length === 0 ? (
        <Card className="p-12 text-center border-border shadow-xs">
          <CalendarIcon className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-foreground">Nenhum agendamento encontrado</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Não há sessões ou turmas marcadas com os filtros selecionados para esta data.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsNewModalOpen(true)}
            className="mt-4 gap-2 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Criar Agendamento</span>
          </Button>
        </Card>
      ) : viewMode === "grid" ? (
        /* MODO GRADE (MOSAICO MULTI-COLUNA) */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4.5 animate-fade-in">
          {dayFilteredSchedules.map((schedule) => {
            const occupied = schedule.participants.filter(
              (p) => p.status !== "justified_absence"
            ).length
            const isFull = occupied >= schedule.maxCapacity

            return (
              <Card
                key={schedule.id}
                className="overflow-hidden border-border flex flex-col justify-between hover:border-primary/40 transition-all shadow-xs"
              >
                <div>
                  {/* Cabeçalho do Card */}
                  <div className="p-4 bg-muted/20 border-b border-border flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xs border border-primary/20 shrink-0">
                        {schedule.startTime}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-bold text-sm text-foreground leading-tight">
                            {schedule.title}
                          </h3>
                          <Badge
                            variant={schedule.type === "turma" ? "purple" : "info"}
                            className="text-[9px] px-1.5 py-0"
                          >
                            {schedule.type === "turma" ? "Turma" : "Individual"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {schedule.professionalName} •{" "}
                          <span style={{ color: schedule.roomColor }} className="font-medium">
                            {schedule.roomName}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isFull ? (
                        <Badge variant="destructive" className="text-[10px]">
                          Lotada ({occupied}/{schedule.maxCapacity})
                        </Badge>
                      ) : (
                        <>
                          <Badge variant="success" className="text-[10px]">
                            {schedule.maxCapacity - occupied} vaga(s) ({occupied}/{schedule.maxCapacity})
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenEnrollModal(schedule)}
                            className="h-6 text-[10px] px-2 gap-1 text-primary border-primary/30 hover:bg-primary/5 rounded-lg font-semibold shadow-2xs"
                            title="Agendar / Encaixar paciente neste horário"
                          >
                            <UserPlus className="h-3 w-3" />
                            <span>+ Encaixar</span>
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Lista de Alunos / Pacientes */}
                  <div className="p-3.5 divide-y divide-border/60">
                    {schedule.participants.length === 0 ? (
                      <div className="py-5 text-center flex flex-col items-center justify-center gap-2">
                        <p className="text-xs text-muted-foreground">Nenhum paciente agendado neste horário.</p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenEnrollModal(schedule)}
                          className="h-7 text-xs px-2.5 gap-1.5 text-primary border-primary/30 hover:bg-primary/5 rounded-xl font-semibold shadow-2xs"
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          <span>Agendar Paciente</span>
                        </Button>
                      </div>
                    ) : (
                      schedule.participants.map((p) => {
                        const isPresent = p.status === "present"
                        const isJustified = p.status === "justified_absence"

                        return (
                          <div
                            key={p.id}
                            className="py-2.5 flex flex-col gap-2 first:pt-0 last:pb-0"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2.5">
                                <div
                                  className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                    isPresent
                                      ? "bg-emerald-500 text-white"
                                      : isJustified
                                      ? "bg-amber-500 text-white"
                                      : "bg-muted text-foreground"
                                  }`}
                                >
                                  {p.patientName.charAt(0)}
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-xs font-semibold text-foreground">
                                      {p.patientName}
                                    </span>
                                    {p.status === "replacement" && (
                                      <Badge variant="warning" className="text-[8px] py-0 px-1">
                                        Reposição
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                    <span>{p.patientPhone}</span>
                                    {p.hasActivePackage && (
                                      <span className="text-[10px] text-primary font-medium">
                                        • {p.remainingSessions} rest.
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                {!isJustified ? (
                                  <>
                                    <Button
                                      size="sm"
                                      variant={isPresent ? "default" : "outline"}
                                      onClick={async () => {
                                        const res = await checkIn(
                                          schedule.id,
                                          p.id,
                                          isPresent ? "scheduled" : "present"
                                        )
                                        if (res?.message) {
                                          setFeedback(res.message)
                                          setTimeout(() => setFeedback(null), 4000)
                                        }
                                      }}
                                      className="h-7 text-[11px] px-2 gap-1"
                                      title={isPresent ? "Marcar como ausente/pendente" : "Confirmar Presença"}
                                    >
                                      <CheckCircle2 className="h-3 w-3" />
                                      <span>{isPresent ? "Presente" : "Confirmar"}</span>
                                    </Button>

                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        setCancelTarget({ schedule, participant: p })
                                        setCancelReason("")
                                        setForceExemption(false)
                                      }}
                                      className="h-7 text-[11px] px-1.5 text-amber-600 hover:text-amber-700"
                                      title="Desmarcar atendimento"
                                    >
                                      Desmarcar
                                    </Button>

                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        sendWhatsAppReminder(schedule, {
                                          name: p.patientName,
                                          phone: p.patientPhone,
                                        })
                                        setFeedback(`Lembrete WhatsApp enviado para ${p.patientName}!`)
                                        setTimeout(() => setFeedback(null), 3000)
                                      }}
                                      className="h-7 w-7 p-0 text-emerald-600 shrink-0"
                                      title="Enviar Lembrete WhatsApp"
                                    >
                                      <Send className="h-3 w-3" />
                                    </Button>
                                  </>
                                ) : (
                                  <Badge variant="warning" className="text-[10px]">
                                    Reposição Gerada
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      ) : (
        /* MODO LISTA (TIMELINE LINEAR CRONOLÓGICA) */
        <div className="space-y-4 animate-fade-in">
          {dayFilteredSchedules.map((schedule) => {
            const occupied = schedule.participants.filter(
              (p) => p.status !== "justified_absence"
            ).length
            const isFull = occupied >= schedule.maxCapacity

            return (
              <Card key={schedule.id} className="overflow-hidden border-border shadow-xs">
                {/* Cabeçalho do Card */}
                <div className="p-4 bg-muted/20 border-b border-border flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xs border border-primary/20">
                      {schedule.startTime}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm text-foreground">
                          {schedule.title}
                        </h3>
                        <Badge
                          variant={schedule.type === "turma" ? "purple" : "info"}
                          className="text-[10px]"
                        >
                          {schedule.type === "turma" ? "Turma" : "Individual"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {schedule.professionalName} •{" "}
                        <span style={{ color: schedule.roomColor }} className="font-medium">
                          {schedule.roomName}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-mono">
                      Capacidade: {occupied}/{schedule.maxCapacity}
                    </span>
                    {isFull ? (
                      <Badge variant="destructive" className="text-[10px]">
                        Lotada
                      </Badge>
                    ) : (
                      <>
                        <Badge variant="success" className="text-[10px]">
                          {schedule.maxCapacity - occupied} vaga(s)
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenEnrollModal(schedule)}
                          className="h-7 text-xs px-2.5 gap-1.5 text-primary border-primary/30 hover:bg-primary/5 rounded-xl font-semibold shadow-2xs"
                          title="Agendar / Encaixar paciente neste horário"
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          <span>+ Encaixar Paciente</span>
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Lista de Alunos / Pacientes */}
                <div className="p-4 divide-y divide-border/60">
                  {schedule.participants.length === 0 ? (
                    <div className="py-4 text-center flex flex-col sm:flex-row items-center justify-center gap-3 bg-muted/20 rounded-xl border border-dashed border-border/70 my-1">
                      <span className="text-xs text-muted-foreground">Nenhum paciente agendado neste horário.</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenEnrollModal(schedule)}
                        className="h-7 text-xs px-2.5 gap-1.5 text-primary border-primary/30 hover:bg-primary/5 rounded-xl font-semibold shadow-2xs"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        <span>Agendar Paciente</span>
                      </Button>
                    </div>
                  ) : (
                    schedule.participants.map((p) => {
                      const isPresent = p.status === "present"
                      const isJustified = p.status === "justified_absence"

                      return (
                        <div
                          key={p.id}
                          className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 first:pt-0 last:pb-0"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                isPresent
                                  ? "bg-emerald-500 text-white"
                                  : isJustified
                                  ? "bg-amber-500 text-white"
                                  : "bg-muted text-foreground"
                              }`}
                            >
                              {p.patientName.charAt(0)}
                            </div>
                            <div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-sm font-semibold text-foreground">
                                  {p.patientName}
                                </span>
                                {p.status === "replacement" && (
                                  <Badge variant="warning" className="text-[9px] py-0">
                                    Reposição
                                  </Badge>
                                )}
                                {p.hasActivePackage ? (
                                  <Badge
                                    variant={p.remainingSessions && p.remainingSessions <= 2 ? "warning" : "outline"}
                                    className="text-[9px] py-0 font-medium"
                                    title={p.activePackageName}
                                  >
                                    {p.remainingSessions && p.remainingSessions <= 2 ? "Renovar: " : "Saldo: "}
                                    {p.remainingSessions} rest.
                                  </Badge>
                                ) : p.status !== "replacement" && (
                                  <Badge variant="outline" className="text-[9px] py-0 text-amber-600 border-amber-500/30">
                                    Avulso / Sem Plano
                                  </Badge>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {p.patientPhone}
                              </span>
                            </div>
                          </div>

                          {/* Ações */}
                          <div className="flex items-center gap-2 self-end sm:self-auto">
                            {!isJustified ? (
                              <>
                                <Button
                                  size="sm"
                                  variant={isPresent ? "default" : "outline"}
                                  onClick={async () => {
                                    const res = await checkIn(
                                      schedule.id,
                                      p.id,
                                      isPresent ? "scheduled" : "present"
                                    )
                                    if (res?.message) {
                                      setFeedback(res.message)
                                      setTimeout(() => setFeedback(null), 4000)
                                    }
                                  }}
                                  className="h-8 text-xs gap-1.5"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  <span>{isPresent ? "Presente" : "Confirmar Presença"}</span>
                                </Button>

                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setCancelTarget({ schedule, participant: p })
                                    setCancelReason("")
                                    setForceExemption(false)
                                  }}
                                  className="h-8 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                                >
                                  Desmarcar
                                </Button>

                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    sendWhatsAppReminder(schedule, {
                                      name: p.patientName,
                                      phone: p.patientPhone,
                                    })
                                    setFeedback(`Lembrete WhatsApp enviado para ${p.patientName}!`)
                                    setTimeout(() => setFeedback(null), 3000)
                                  }}
                                  className="h-8 w-8 p-0 text-emerald-600"
                                  title="Enviar Lembrete UAZAPI"
                                >
                                  <Send className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            ) : (
                              <Badge variant="warning" className="text-xs">
                                Vaga Liberada (Reposição Gerada)
                              </Badge>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Modal Criar Agendamento / Turma (Único ou Série Recorrente) */}
      <Dialog
        open={isNewModalOpen}
        onOpenChange={(open) => {
          setIsNewModalOpen(open)
          if (!open) {
            setModalError(null)
            setTitle("")
            setEnrolledPatients([])
          }
        }}
      >
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleCreate}>
            <DialogHeader className="space-y-1">
              <DialogTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
                {creationMode === "recurring" ? (
                  <Repeat className="h-5 w-5 text-primary" />
                ) : (
                  <CalendarIcon className="h-5 w-5 text-primary" />
                )}
                <span>
                  {creationMode === "recurring"
                    ? "Nova Turma Recorrente Semanal"
                    : "Novo Agendamento / Horário"}
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Configure os detalhes do horário, ambiente, profissional e recorrência da grade.
              </DialogDescription>
            </DialogHeader>

            {/* Alternador de Modo */}
            <div className="pt-2">
              <div className="grid grid-cols-2 p-1 bg-muted rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setCreationMode("single")}
                  className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    creationMode === "single"
                      ? "bg-background text-foreground shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <CalendarIcon className="h-3.5 w-3.5" />
                  <span>Agendamento Único</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCreationMode("recurring")}
                  className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    creationMode === "recurring"
                      ? "bg-background text-foreground shadow-xs font-bold text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Repeat className="h-3.5 w-3.5" />
                  <span>Turma Recorrente</span>
                </button>
              </div>
            </div>

            {/* Alerta de Conflito / Erro */}
            {modalError && (
              <div className="mt-3 p-3.5 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-start gap-2 animate-fade-in">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="font-medium">{modalError}</span>
              </div>
            )}

            <div className="space-y-4 py-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-foreground/85 mb-1.5">Título / Descrição</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    creationMode === "recurring"
                      ? "Ex: Turma Pilates Manhã (Seg e Qua)"
                      : "Ex: Fisioterapia Ortopédica ou Pilates 08h"
                  }
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground/85 mb-1.5">Tipo de Atendimento</label>
                  <Select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                  >
                    <option value="turma">Turma (Grupo)</option>
                    <option value="individual">Individual</option>
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground/85 mb-1.5">Especialidade</label>
                  <Select
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value as any)}
                  >
                    <option value="pilates">Pilates</option>
                    <option value="fisioterapia">Fisioterapia</option>
                    <option value="rpg">RPG</option>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground/85 mb-1.5">Sala / Ambiente</label>
                  <Select
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                  >
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} (Capacidade: {r.capacity})
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground/85 mb-1.5">Profissional Responsável</label>
                  <Select
                    value={profId}
                    onChange={(e) => setProfId(e.target.value)}
                  >
                    {professionals.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground/85 mb-1.5">Horário Início</label>
                  <Input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground/85 mb-1.5">Horário Término</label>
                  <Input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>

              {/* Seção de Paciente no Agendamento Único (Balcão / Presencial) */}
              {creationMode === "single" && (
                <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/5 space-y-3 mt-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                      <User className="h-3.5 w-3.5 text-primary" />
                      Vincular Paciente / Aluno
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {singlePatientId ? "Paciente selecionado" : "Opcional (ou selecione para agendamento direto)"}
                    </span>
                  </div>

                  <div>
                    <Select
                      value={singlePatientId}
                      onChange={(e) => {
                        const pId = e.target.value
                        setSinglePatientId(pId)
                        setSingleIsReplacement(false)
                        setSingleCreditId("")
                        if (pId && (!title || title.startsWith("Sessão") || title.startsWith("Atendimento") || title.startsWith("Turma"))) {
                          const p = patients.find((pat) => pat.id === pId)
                          if (p) {
                            setTitle(`${type === "turma" ? "Turma" : "Atendimento"} - ${p.name}`)
                          }
                        }
                      }}
                    >
                      <option value="">Nenhum aluno vinculado (abrir horário na grade)...</option>
                      {patients.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.documentCpf ? `• CPF: ${p.documentCpf}` : ""} {p.phone ? `• (${p.phone})` : ""}
                        </option>
                      ))}
                    </Select>
                  </div>

                  {singlePatientId && (() => {
                    const patientCredits = replacementCredits.filter(
                      (c) => c.patientId === singlePatientId && c.status === "available"
                    )
                    if (patientCredits.length === 0) return null

                    return (
                      <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer font-medium text-foreground">
                          <input
                            type="checkbox"
                            checked={singleIsReplacement}
                            onChange={(e) => {
                              setSingleIsReplacement(e.target.checked)
                              if (e.target.checked && !singleCreditId && patientCredits.length > 0) {
                                setSingleCreditId(patientCredits[0].id)
                              }
                            }}
                            className="rounded border-input text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                          />
                          <span className="text-amber-800 dark:text-amber-300 font-semibold text-[11px]">
                            Utilizar crédito de reposição ({patientCredits.length} disponível{patientCredits.length > 1 ? "is" : ""})
                          </span>
                        </label>

                        {singleIsReplacement && (
                          <Select
                            value={singleCreditId}
                            onChange={(e) => setSingleCreditId(e.target.value)}
                            className="text-xs h-8"
                          >
                            {patientCredits.map((c) => (
                              <option key={c.id} value={c.id}>
                                Reposição de {formatDateBR(c.originDate)} (Expira: {formatDateBR(c.expiryDate)})
                              </option>
                            ))}
                          </Select>
                        )}
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* Seção Exclusiva para Turmas Recorrentes */}
              {creationMode === "recurring" && (
                <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/5 space-y-3 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                      <Repeat className="h-3.5 w-3.5 text-primary" />
                      Dias da Semana da Recorrência
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      Multi-seleção
                    </span>
                  </div>

                  <div className="grid grid-cols-6 gap-1.5">
                    {[
                      { day: 1, label: "Seg" },
                      { day: 2, label: "Ter" },
                      { day: 3, label: "Qua" },
                      { day: 4, label: "Qui" },
                      { day: 5, label: "Sex" },
                      { day: 6, label: "Sáb" },
                    ].map(({ day, label }) => {
                      const isSelected = daysOfWeek.includes(day)
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleDayOfWeek(day)}
                          className={`py-2 rounded-lg text-xs font-bold transition-all border ${
                            isSelected
                              ? "bg-primary text-primary-foreground border-primary shadow-xs"
                              : "bg-background text-muted-foreground border-input hover:border-primary/50"
                          }`}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <label className="font-medium text-foreground text-[11px]">
                        Data Inicial da Série
                      </label>
                      <Input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground/85 mb-1.5">
                        Duração da Série
                      </label>
                      <Select
                        value={weeksCount}
                        onChange={(e) => setWeeksCount(Number(e.target.value))}
                      >
                        <option value={4}>4 semanas (1 mês)</option>
                        <option value={8}>8 semanas (2 meses)</option>
                        <option value={12}>12 semanas (3 meses)</option>
                        <option value={24}>24 semanas (6 meses)</option>
                      </Select>
                    </div>
                  </div>

                  {/* Seleção de Alunos Fixos da Turma */}
                  <div className="space-y-2 pt-2 border-t border-primary/10">
                    <label className="text-xs font-semibold text-foreground/90 flex items-center justify-between">
                      <span>Matricular Alunos Fixos na Série ({enrolledPatients.length}):</span>
                      <span className="text-[10px] text-muted-foreground font-normal">Opcional</span>
                    </label>
                    <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1">
                      {patients.map((p) => {
                        const isEnrolled = enrolledPatients.includes(p.id)
                        return (
                          <div
                            key={p.id}
                            onClick={() => toggleEnrolledPatient(p.id)}
                            className={`p-2.5 rounded-xl text-xs cursor-pointer flex items-center justify-between border transition-all ${
                              isEnrolled
                                ? "bg-primary/10 border-primary text-foreground font-semibold shadow-2xs"
                                : "bg-background border-border/70 text-muted-foreground hover:bg-muted/40"
                            }`}
                          >
                            <span>{p.name}</span>
                            <span className="text-[10px]">{p.phone}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 pt-2 sm:space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsNewModalOpen(false)}
                disabled={isSubmitting}
                className="h-10 px-5 rounded-xl font-semibold"
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting} className="h-10 px-6 rounded-xl font-semibold shadow-xs">
                {isSubmitting
                  ? "Processando..."
                  : creationMode === "recurring"
                  ? "Gerar Grade Recorrente"
                  : "Adicionar Agendamento"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Inteligente de Desmarcação com Análise de Antecedência e Política */}
      <Dialog
        open={!!cancelTarget}
        onOpenChange={(open) => !open && setCancelTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          {cancelTarget && (() => {
            const notice = getNoticeInfo()
            return (
              <div>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-foreground">
                    <ShieldAlert className="h-5 w-5 text-amber-500" />
                    <span>Desmarcar Aluno & Política de Reposição</span>
                  </DialogTitle>
                  <DialogDescription>
                    O sistema avalia a antecedência mínima da clínica (2h) para conceder o crédito de reposição.
                  </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-3 text-xs">
                  {/* Informações da Aula */}
                  <div className="p-3 rounded-xl bg-muted/40 border border-border space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground">
                        {cancelTarget.participant.patientName}
                      </span>
                      <span className="text-muted-foreground">
                        {formatDateBR(cancelTarget.schedule.date)} às {cancelTarget.schedule.startTime}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-[11px]">
                      {cancelTarget.schedule.title} • {cancelTarget.schedule.roomName}
                    </p>
                  </div>

                  {/* Diagnóstico da Política da Clínica */}
                  {notice?.isWithinPolicy ? (
                    <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 space-y-1 animate-fade-in">
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <span>Cancelamento no Prazo ({notice.formattedText})</span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-emerald-700 dark:text-emerald-400">
                        O cancelamento cumpre a antecedência mínima de 2h. A vaga será liberada imediatamente e será gerado 1 crédito de reposição com validade de 30 dias.
                      </p>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 space-y-2 animate-fade-in">
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                        <span>Cancelamento Fora do Prazo ({notice?.formattedText})</span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
                        A política da clínica exige no mínimo 2h de antecedência. O registro padrão será computado como falta sem crédito automático.
                      </p>

                      <div className="pt-1 border-t border-amber-500/20">
                        <label className="flex items-center gap-2 cursor-pointer font-semibold text-foreground">
                          <input
                            type="checkbox"
                            checked={forceExemption}
                            onChange={(e) => setForceExemption(e.target.checked)}
                            className="rounded text-primary focus:ring-primary h-4 w-4"
                          />
                          <span className="text-[11px]">
                            Autorizar exceção da clínica (Conceder reposição como cortesia)
                          </span>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Motivo do Cancelamento */}
                  <div className="space-y-1">
                    <label className="font-medium text-foreground">
                      Motivo da Desmarcação (Opcional)
                    </label>
                    <Input
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="Ex: Imprevisto de saúde, trânsito, viagem"
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCancelTarget(null)}
                    disabled={isCancelling}
                  >
                    Voltar
                  </Button>
                  <Button
                    type="button"
                    variant={notice?.isWithinPolicy || forceExemption ? "default" : "destructive"}
                    onClick={handleConfirmCancel}
                    disabled={isCancelling}
                  >
                    {isCancelling ? "Processando..." : "Confirmar Desmarcação"}
                  </Button>
                </DialogFooter>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Modal de Encaixe / Agendamento Rápido em Horário Existente */}
      <Dialog
        open={!!enrollTarget}
        onOpenChange={(open) => {
          if (!open) {
            setEnrollTarget(null)
            setEnrollError(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          {enrollTarget && (
            <form onSubmit={handleConfirmEnroll}>
              <DialogHeader className="space-y-1">
                <DialogTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
                  <UserPlus className="h-5 w-5 text-primary" />
                  <span>Agendar / Encaixar Paciente</span>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Insira o paciente nesta sessão de forma manual e imediata.
                </DialogDescription>
              </DialogHeader>

              {enrollError && (
                <div className="mt-3 p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-start gap-2 animate-fade-in">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span className="font-medium">{enrollError}</span>
                </div>
              )}

              <div className="py-4 space-y-3.5 text-xs">
                {/* Card com Detalhes do Horário */}
                <div className="p-3 rounded-xl bg-muted/40 border border-border space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground text-sm">
                      {enrollTarget.title}
                    </span>
                    <Badge variant={enrollTarget.type === "turma" ? "purple" : "info"} className="text-[10px]">
                      {enrollTarget.type === "turma" ? "Turma" : "Individual"}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-[11px] pt-1">
                    <span>📅 {formatDateBR(enrollTarget.date)}</span>
                    <span>⏰ {enrollTarget.startTime} - {enrollTarget.endTime}</span>
                    <span>📍 {enrollTarget.roomName}</span>
                    <span>👤 {enrollTarget.professionalName}</span>
                  </div>
                </div>

                {/* Selecionar Paciente */}
                <div>
                  <label className="block text-xs font-semibold text-foreground/85 mb-1.5">
                    Paciente / Aluno *
                  </label>
                  <Select
                    value={enrollPatientId}
                    onChange={(e) => {
                      setEnrollPatientId(e.target.value)
                      setEnrollIsReplacement(false)
                      setEnrollCreditId("")
                    }}
                  >
                    <option value="">Selecione o paciente...</option>
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.documentCpf ? `(${p.documentCpf})` : ""} {p.phone ? `• ${p.phone}` : ""}
                      </option>
                    ))}
                  </Select>
                </div>

                {/* Créditos de Reposição se houver */}
                {enrollPatientId && (() => {
                  const patientCredits = replacementCredits.filter(
                    (c) => c.patientId === enrollPatientId && c.status === "available"
                  )
                  if (patientCredits.length === 0) return null

                  return (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer font-medium text-foreground">
                        <input
                          type="checkbox"
                          checked={enrollIsReplacement}
                          onChange={(e) => {
                            setEnrollIsReplacement(e.target.checked)
                            if (e.target.checked && !enrollCreditId && patientCredits.length > 0) {
                              setEnrollCreditId(patientCredits[0].id)
                            }
                          }}
                          className="rounded border-input text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                        />
                        <span className="text-amber-800 dark:text-amber-300 font-semibold text-[11px]">
                          Utilizar crédito de reposição disponível ({patientCredits.length})
                        </span>
                      </label>

                      {enrollIsReplacement && (
                        <Select
                          value={enrollCreditId}
                          onChange={(e) => setEnrollCreditId(e.target.value)}
                          className="text-xs h-8"
                        >
                          {patientCredits.map((c) => (
                            <option key={c.id} value={c.id}>
                              Reposição de {formatDateBR(c.originDate)} (Validade: {formatDateBR(c.expiryDate)})
                            </option>
                          ))}
                        </Select>
                      )}
                    </div>
                  )
                })()}
              </div>

              <DialogFooter className="gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEnrollTarget(null)}
                  disabled={isSubmittingEnroll}
                  className="h-9 px-4 text-xs font-semibold rounded-xl"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmittingEnroll || !enrollPatientId}
                  className="h-9 px-5 text-xs font-semibold rounded-xl shadow-xs"
                >
                  {isSubmittingEnroll ? "Agendando..." : "Confirmar Agendamento"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Unificado de Gestão de Horários & Disponibilidade */}
      <AvailabilityManagerModal
        isOpen={isAvailabilityModalOpen}
        onClose={() => setIsAvailabilityModalOpen(false)}
        initialProfessionalId={isProfessional && user?.professionalId ? user.professionalId : undefined}
      />

      {/* Modal Detalhado de Agendamento (Interatividade das visões Semana e Mês) */}
      <ScheduleDetailModal
        schedule={selectedDetailSchedule}
        isOpen={!!selectedDetailSchedule}
        onClose={() => setSelectedDetailSchedule(null)}
        onCheckIn={checkIn}
        onSendWhatsApp={sendWhatsAppReminder}
        onOpenEnroll={(sch) => handleOpenEnrollModal(sch)}
        onOpenCancel={(sch, p) =>
          setCancelTarget({ schedule: sch, participant: p })
        }
        onNavigateToDay={(date) => {
          setSelectedDate(date)
          setSchedulePeriodMode("day")
        }}
      />
    </div>
  )
}
