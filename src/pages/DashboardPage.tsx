import React, { useState, useMemo } from "react"
import { useClinicData } from "@/contexts/ClinicDataContext"
import { useAuth } from "@/contexts/AuthContext"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  formatDateWithWeekdayBR,
  getTodayDateString,
  getCurrentTimeString,
  getCurrentMonthString,
} from "@/lib/dateUtils"
import { useQuery, useMutation } from "convex/react"
import { api } from "@convex/_generated/api"
import {
  Calendar,
  Layers,
  DollarSign,
  CheckCircle2,
  Clock,
  Send,
  Building,
  ChevronRight,
  TrendingUp,
  Plus,
  Search,
  Check,
  X,
  FileText,
  Zap,
  CalendarCheck,
  UserX,
} from "lucide-react"

interface DashboardPageProps {
  onNavigate: (section: any) => void
}

type ShiftFilter = "all" | "morning" | "afternoon" | "evening" | "pending"

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { user } = useAuth()
  const {
    rooms,
    schedules,
    transactions,
    checkIn,
    cancelWithReplacement,
    sendWhatsAppReminder,
    replacementCredits,
  } = useClinicData()

  // Agendamentos online pendentes da página pública /agendar
  const publicBookings = useQuery(api.bookingBuilder.listPublicBookings, {
    status: "pending_approval",
  })
  const updateBookingStatus = useMutation(api.bookingBuilder.updatePublicBookingStatus)

  // Estados locais
  const [notificationToast, setNotificationToast] = useState<{
    message: string
    type: "success" | "info" | "warning"
  } | null>(null)
  const [activeShiftFilter, setActiveShiftFilter] = useState<ShiftFilter>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [cancelModalData, setCancelModalData] = useState<{
    scheduleId: string
    participantId: string
    patientName: string
  } | null>(null)
  const [cancelReason, setCancelReason] = useState("Aviso prévio do paciente")
  const [generateCredit, setGenerateCredit] = useState(true)
  const [isActionLoading, setIsActionLoading] = useState(false)

  const showToast = (message: string, type: "success" | "info" | "warning" = "success") => {
    setNotificationToast({ message, type })
    setTimeout(() => setNotificationToast(null), 3800)
  }

  // Horário e data de referência no fuso de Brasília
  const todayStr = getTodayDateString()
  const currentTime = getCurrentTimeString()
  const currentMonth = getCurrentMonthString()

  // Saudação contextual por turno
  const greeting = useMemo(() => {
    const hour = parseInt(currentTime.split(":")[0], 10) || 12
    if (hour < 12) return "Bom dia"
    if (hour < 18) return "Boa tarde"
    return "Boa noite"
  }, [currentTime])

  const doctorName = user?.name ? user.name.split(" ")[0] : "Doutor(a)"

  // Atendimentos do dia
  const todaySchedules = useMemo(() => {
    return schedules.filter((s) => s.date === todayStr)
  }, [schedules, todayStr])

  // Métricas operacionais do dia
  const {
    totalAttendancesToday,
    completedToday,
    pendingToday,
    completionRate,
    totalCapacityToday,
    occupiedCapacityToday,
    occupancyRate,
    vacanciesToday,
  } = useMemo(() => {
    let totalAtt = 0
    let completed = 0
    let totalCap = 0
    let occupiedCap = 0

    todaySchedules.forEach((s) => {
      totalCap += s.maxCapacity
      const activeParts = s.participants.filter((p) => p.status !== "justified_absence")
      occupiedCap += activeParts.length
      totalAtt += s.participants.length

      s.participants.forEach((p) => {
        if (p.status === "present") completed += 1
      })
    })

    const pending = Math.max(0, totalAtt - completed)
    const compRate = totalAtt > 0 ? Math.round((completed / totalAtt) * 100) : 0
    const occRate = totalCap > 0 ? Math.round((occupiedCap / totalCap) * 100) : 0
    const vacancies = Math.max(0, totalCap - occupiedCap)

    return {
      totalAttendancesToday: totalAtt,
      completedToday: completed,
      pendingToday: pending,
      completionRate: compRate,
      totalCapacityToday: totalCap,
      occupiedCapacityToday: occupiedCap,
      occupancyRate: occRate,
      vacanciesToday: vacancies,
    }
  }, [todaySchedules])

  // Financeiro do mês atual
  const { totalPaidMonth, pendingMonth } = useMemo(() => {
    let paid = 0
    let pending = 0

    transactions.forEach((t) => {
      const isThisMonth = !t.dueDate || t.dueDate.startsWith(currentMonth)
      if (t.type === "income" && isThisMonth) {
        if (t.status === "paid") paid += t.amount
        if (t.status === "pending") pending += t.amount
      }
    })

    return { totalPaidMonth: paid, pendingMonth: pending }
  }, [transactions, currentMonth])

  // Créditos de reposição ativos
  const activeCredits = useMemo(() => {
    return replacementCredits.filter((c) => c.status === "available")
  }, [replacementCredits])

  // Spotlight ao Vivo: Atendimento Em Andamento ou Próximo Imediato
  const spotlightSession = useMemo(() => {
    if (todaySchedules.length === 0) return null

    const sorted = [...todaySchedules].sort((a, b) => a.startTime.localeCompare(b.startTime))

    // 1. Em andamento agora
    const ongoing = sorted.find((s) => s.startTime <= currentTime && s.endTime >= currentTime)
    if (ongoing) return { schedule: ongoing, isLive: true }

    // 2. Próximo do dia
    const nextUpcoming = sorted.find((s) => s.startTime > currentTime)
    if (nextUpcoming) return { schedule: nextUpcoming, isLive: false }

    // 3. Se todos já passaram, exibe o último realizado
    return { schedule: sorted[sorted.length - 1], isFinishedDay: true }
  }, [todaySchedules, currentTime])

  // Filtragem e busca da timeline de horários
  const filteredSchedules = useMemo(() => {
    return todaySchedules
      .filter((schedule) => {
        // Filtro por Turno
        if (activeShiftFilter === "morning" && schedule.startTime >= "12:00") return false
        if (
          activeShiftFilter === "afternoon" &&
          (schedule.startTime < "12:00" || schedule.startTime >= "18:00")
        )
          return false
        if (activeShiftFilter === "evening" && schedule.startTime < "18:00") return false
        if (activeShiftFilter === "pending") {
          const hasPending = schedule.participants.some(
            (p) => p.status === "scheduled" || p.status === "replacement"
          )
          if (!hasPending) return false
        }

        // Filtro por Busca (Nome do Paciente ou Telefone)
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim()
          const matchesTitle = schedule.title.toLowerCase().includes(q)
          const matchesRoom = schedule.roomName.toLowerCase().includes(q)
          const matchesProf = schedule.professionalName.toLowerCase().includes(q)
          const matchesParticipant = schedule.participants.some(
            (p) =>
              p.patientName.toLowerCase().includes(q) ||
              p.patientPhone.replace(/\D/g, "").includes(q)
          )
          if (!matchesTitle && !matchesRoom && !matchesProf && !matchesParticipant) return false
        }

        return true
      })
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
  }, [todaySchedules, activeShiftFilter, searchQuery])

  // Capacidade real e dinâmica por sala física
  const realRoomStats = useMemo(() => {
    return rooms.map((room) => {
      const roomSchedules = todaySchedules.filter((s) => s.roomId === room.id)
      const currentActive = roomSchedules.find(
        (s) => s.startTime <= currentTime && s.endTime >= currentTime
      )
      const currentOccupied = currentActive
        ? currentActive.participants.filter((p) => p.status !== "justified_absence").length
        : 0

      const totalStudentsToday = roomSchedules.reduce(
        (acc, s) =>
          acc + s.participants.filter((p) => p.status !== "justified_absence").length,
        0
      )
      const totalCapacityRoom = roomSchedules.reduce((acc, s) => acc + s.maxCapacity, 0)
      const occupancyPct =
        totalCapacityRoom > 0 ? Math.round((totalStudentsToday / totalCapacityRoom) * 100) : 0

      return {
        ...room,
        schedulesCount: roomSchedules.length,
        currentOccupied,
        totalStudentsToday,
        totalCapacityRoom,
        occupancyPct,
        isCurrentlyInUse: Boolean(currentActive),
      }
    })
  }, [rooms, todaySchedules, currentTime])

  // Ações Rápidas
  const handleCheckInToggle = async (
    scheduleId: string,
    participantId: string,
    currentStatus: string,
    patientName: string
  ) => {
    try {
      const nextStatus = currentStatus === "present" ? "scheduled" : "present"
      await checkIn(scheduleId, participantId, nextStatus)
      showToast(
        nextStatus === "present"
          ? `Check-in de ${patientName} confirmado com sucesso!`
          : `Presença de ${patientName} revertida para agendado.`,
        "success"
      )
    } catch {
      showToast("Erro ao registrar check-in. Tente novamente.", "warning")
    }
  }

  const handleReminderClick = async (schedule: any, participant: any) => {
    try {
      await sendWhatsAppReminder(schedule, {
        name: participant.patientName,
        phone: participant.patientPhone,
      })
      showToast(`Lembrete UAZAPI enviado para ${participant.patientName}!`, "success")
    } catch {
      showToast("Falha no disparo do lembrete WhatsApp.", "warning")
    }
  }

  const handleBatchReminders = async () => {
    setIsActionLoading(true)
    try {
      let sentCount = 0
      for (const s of todaySchedules) {
        for (const p of s.participants) {
          if (p.status === "scheduled" || p.status === "replacement") {
            await sendWhatsAppReminder(s, {
              name: p.patientName,
              phone: p.patientPhone,
            })
            sentCount++
          }
        }
      }
      showToast(
        sentCount > 0
          ? `Disparo em lote concluído: ${sentCount} lembretes enviados via WhatsApp!`
          : "Todos os pacientes de hoje já estavam com presença confirmada.",
        "success"
      )
    } catch {
      showToast("Erro durante o envio em lote.", "warning")
    } finally {
      setIsActionLoading(false)
    }
  }

  const handleApproveOnlineBooking = async (bookingId: any, patientName: string) => {
    try {
      await updateBookingStatus({ bookingId, status: "confirmed" })
      showToast(`Agendamento online de ${patientName} aprovado e confirmado!`, "success")
    } catch (err: any) {
      showToast(`Erro ao aprovar agendamento: ${err.message || "Tente novamente"}`, "warning")
    }
  }

  const confirmCancelAction = async () => {
    if (!cancelModalData) return
    try {
      await cancelWithReplacement(
        cancelModalData.scheduleId,
        cancelModalData.participantId,
        cancelReason,
        generateCredit
      )
      showToast(
        generateCredit
          ? `Agendamento desmarcado. Crédito de reposição gerado para ${cancelModalData.patientName}!`
          : `Agendamento de ${cancelModalData.patientName} cancelado sem crédito.`,
        "info"
      )
      setCancelModalData(null)
    } catch {
      showToast("Erro ao processar cancelamento.", "warning")
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in text-foreground">
      {/* Toast Feedback Flutuante */}
      {notificationToast && (
        <div className="fixed top-5 right-5 z-50 bg-foreground text-background px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-xs font-semibold animate-fade-in border border-border">
          <div className="h-6 w-6 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
            <Send className="h-3.5 w-3.5" />
          </div>
          <span>{notificationToast.message}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. CENTRAL DE COMANDO SUPERIOR (Sleek Command Header)                      */}
      {/* ========================================================================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {greeting}, <span className="text-primary">{doctorName}</span>
            </h1>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span>Clínica em Atendimento</span>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground font-medium flex items-center gap-2">
            <span>{formatDateWithWeekdayBR(todayStr)}</span>
            <span>•</span>
            <span>
              {totalAttendancesToday} atendimentos previstos hoje ({completedToday} concluídos)
            </span>
          </p>
        </div>

        {/* Grupo de Ações Rápidas no Topo */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            onClick={() => onNavigate("schedule")}
            className="gap-2 shadow-sm font-semibold rounded-xl text-xs h-9 px-3.5"
          >
            <Calendar className="h-4 w-4" />
            <span>Ver Agenda</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => onNavigate("patients")}
            className="gap-2 rounded-xl text-xs h-9 px-3.5 hover:bg-muted"
          >
            <Plus className="h-4 w-4 text-primary" />
            <span>Novo Paciente</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => onNavigate("clinical")}
            className="gap-2 rounded-xl text-xs h-9 px-3.5 hover:bg-muted hidden sm:inline-flex"
          >
            <FileText className="h-4 w-4 text-sky-600" />
            <span>Lançar SOAP</span>
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleBatchReminders}
            disabled={isActionLoading || pendingToday === 0}
            className="gap-2 rounded-xl text-xs h-9 px-3 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-emerald-500/20"
            title="Disparar lembrete via WhatsApp para todos os agendados de hoje"
          >
            <Send className={`h-3.5 w-3.5 ${isActionLoading ? "animate-spin" : ""}`} />
            <span className="hidden md:inline">Lembretes WhatsApp</span>
          </Button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. ALERTA INTELIGENTE: AGENDAMENTOS ONLINE PENDENTES (/agendar)            */}
      {/* ========================================================================= */}
      {publicBookings && publicBookings.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-in shadow-xs">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 border border-amber-500/30">
              <CalendarCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  Agendamento Online Público
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-800 dark:text-amber-300">
                  {publicBookings.length} pendente(s)
                </span>
              </div>
              <p className="text-xs text-foreground/90 font-medium mt-0.5">
                <strong className="font-semibold">{publicBookings[0].patientName}</strong> solicitou{" "}
                {publicBookings[0].serviceName} para o dia {publicBookings[0].date} às{" "}
                {publicBookings[0].startTime}.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <Button
              size="sm"
              onClick={() =>
                handleApproveOnlineBooking(publicBookings[0]._id, publicBookings[0].patientName)
              }
              className="h-8 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-xs gap-1.5"
            >
              <Check className="h-3.5 w-3.5" />
              <span>Aprovar Vaga</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onNavigate("online_bookings")}
              className="h-8 text-xs font-medium rounded-xl border-amber-500/30 hover:bg-amber-500/10 text-amber-900 dark:text-amber-200"
            >
              <span>Ver Todos</span>
              <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. KPI CARDS OPERACIONAIS DE ALTA DENSIDADE (Executive Grid)               */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Atendimentos do Dia */}
        <Card className="rounded-2xl border-border/80 shadow-2xs hover:shadow-sm transition-all">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Atendimentos Hoje
            </CardTitle>
            <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Calendar className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {completedToday}
                <span className="text-muted-foreground/60 text-lg sm:text-xl font-medium">
                  /{totalAttendancesToday}
                </span>
              </span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                {completionRate}%
              </span>
            </div>

            {/* Barra de Progresso Segmentada */}
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden mt-2.5">
              <div
                className="h-full bg-emerald-500 transition-all duration-500 rounded-full"
                style={{ width: `${completionRate}%` }}
              />
            </div>

            <p className="text-[11px] text-muted-foreground mt-2 flex items-center justify-between">
              <span>{pendingToday} a realizar</span>
              <span className="text-emerald-600 font-medium">{completedToday} presentes</span>
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Ocupação das Turmas & Vagas */}
        <Card className="rounded-2xl border-border/80 shadow-2xs hover:shadow-sm transition-all">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Ocupação da Grade
            </CardTitle>
            <div className="h-8 w-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Layers className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {occupancyRate}%
              </span>
              <span className="text-[11px] font-semibold text-muted-foreground">
                ({occupiedCapacityToday}/{totalCapacityToday} vagas)
              </span>
            </div>

            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden mt-2.5">
              <div
                className="h-full bg-indigo-500 transition-all duration-500 rounded-full"
                style={{ width: `${occupancyRate}%` }}
              />
            </div>

            <p className="text-[11px] text-muted-foreground mt-2 flex items-center justify-between">
              <span>
                {vacanciesToday > 0 ? (
                  <span className="text-emerald-600 font-bold">{vacanciesToday} vaga(s) livre(s)</span>
                ) : (
                  <span className="text-indigo-600 font-medium">Turmas lotadas</span>
                )}
              </span>
              <span className="text-[10px] text-muted-foreground/80">Pilates & RPG</span>
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Receita do Mês Atual */}
        <Card className="rounded-2xl border-border/80 shadow-2xs hover:shadow-sm transition-all">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Receita do Mês
            </CardTitle>
            <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <DollarSign className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
              R$ {totalPaidMonth.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>

            <div className="flex items-center gap-1.5 mt-2 text-[11px] text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span>
                + R$ {pendingMonth.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} a receber
              </span>
            </div>

            <div className="mt-2 pt-1.5 border-t border-border/50 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Mensalidades e Sessões</span>
              <button
                type="button"
                onClick={() => onNavigate("finance")}
                className="text-primary hover:underline font-semibold"
              >
                Fluxo &rarr;
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Créditos & Oportunidades de Reposição */}
        <Card className="rounded-2xl border-border/80 shadow-2xs hover:shadow-sm transition-all">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Reposições & Encaixes
            </CardTitle>
            <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Clock className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                {activeCredits.length}
              </span>
              <span className="text-xs text-muted-foreground font-medium">créditos ativos</span>
            </div>

            <div className="mt-2.5">
              {vacanciesToday > 0 && activeCredits.length > 0 ? (
                <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                  <Zap className="h-3 w-3" />
                  <span>{Math.min(vacanciesToday, activeCredits.length)} encaixe(s) viável(is) hoje</span>
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">Validade de até 30 dias</p>
              )}
            </div>

            <div className="mt-2 pt-1.5 border-t border-border/50 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Avisos prévios</span>
              <button
                type="button"
                onClick={() => onNavigate("schedule")}
                className="text-primary hover:underline font-semibold"
              >
                Grade &rarr;
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ========================================================================= */}
      {/* 4. SPOTLIGHT "AGORA NA CLÍNICA / PRÓXIMO ATENDIMENTO"                      */}
      {/* ========================================================================= */}
      {spotlightSession && (
        <div className="rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 via-card to-card p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                {spotlightSession.isLive ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25 animate-pulse">
                    <span className="h-2 w-2 rounded-full bg-rose-500" />
                    EM ANDAMENTO AGORA
                  </span>
                ) : spotlightSession.isFinishedDay ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-muted text-muted-foreground border border-border">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    ATENDIMENTOS DO DIA CONCLUÍDOS
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-primary/15 text-primary border border-primary/25">
                    <Clock className="h-3.5 w-3.5" />
                    A SEGUIR NA CLÍNICA
                  </span>
                )}

                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-background/80 border border-border">
                  {spotlightSession.schedule.startTime} - {spotlightSession.schedule.endTime}
                </span>

                <span
                  className="text-xs font-semibold px-2.5 py-0.5 rounded-md border"
                  style={{
                    backgroundColor: `${spotlightSession.schedule.roomColor}15`,
                    borderColor: `${spotlightSession.schedule.roomColor}40`,
                    color: spotlightSession.schedule.roomColor,
                  }}
                >
                  {spotlightSession.schedule.roomName}
                </span>
              </div>

              <h2 className="text-base sm:text-lg font-bold text-foreground">
                {spotlightSession.schedule.title}
              </h2>
              <p className="text-xs text-muted-foreground">
                Profissional responsável:{" "}
                <strong className="text-foreground font-semibold">
                  {spotlightSession.schedule.professionalName}
                </strong>
              </p>
            </div>

            {/* Participantes em Foco no Horário Atual */}
            <div className="flex flex-wrap items-center gap-2">
              {spotlightSession.schedule.participants.map((p) => {
                const isPresent = p.status === "present"
                return (
                  <div
                    key={p.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${
                      isPresent
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200"
                        : "bg-background/80 border-border text-foreground"
                    }`}
                  >
                    <div
                      className={`h-7 w-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                        isPresent
                          ? "bg-emerald-500 text-white"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {p.patientName.charAt(0)}
                    </div>
                    <div className="text-left">
                      <div className="text-xs font-semibold truncate max-w-[120px] sm:max-w-[160px]">
                        {p.patientName}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {isPresent ? "Presente" : "Aguardando"}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={isPresent ? "default" : "outline"}
                      onClick={() =>
                        handleCheckInToggle(
                          spotlightSession.schedule.id,
                          p.id,
                          p.status,
                          p.patientName
                        )
                      }
                      className="h-7 text-[11px] px-2.5 rounded-lg gap-1"
                    >
                      <Check className="h-3 w-3" />
                      <span>{isPresent ? "Confirmado" : "Check-in"}</span>
                    </Button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. GRID PRINCIPAL: TIMELINE DO DIA (2 cols) & INTELIGÊNCIA CLÍNICA (1 col) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ======================================================================= */}
        {/* COLUNA 1 & 2: AGENDA DO DIA, FILTROS E CHECK-IN EM TEMPO REAL           */}
        {/* ======================================================================= */}
        <div className="lg:col-span-2 space-y-4">
          {/* Barra de Filtros de Turno e Busca */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-border shadow-2xs">
            {/* Segmented Controls por Turno */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {(
                [
                  { id: "all", label: "Todos", count: todaySchedules.length },
                  {
                    id: "morning",
                    label: "Manhã",
                    count: todaySchedules.filter((s) => s.startTime < "12:00").length,
                  },
                  {
                    id: "afternoon",
                    label: "Tarde",
                    count: todaySchedules.filter(
                      (s) => s.startTime >= "12:00" && s.startTime < "18:00"
                    ).length,
                  },
                  {
                    id: "evening",
                    label: "Noite",
                    count: todaySchedules.filter((s) => s.startTime >= "18:00").length,
                  },
                  {
                    id: "pending",
                    label: "Pendentes",
                    count: todaySchedules.filter((s) =>
                      s.participants.some(
                        (p) => p.status === "scheduled" || p.status === "replacement"
                      )
                    ).length,
                  },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveShiftFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    activeShiftFilter === tab.id
                      ? "bg-primary text-primary-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      activeShiftFilter === tab.id
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Campo de Busca Rápida de Paciente */}
            <div className="relative min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar aluno ou horário..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground placeholder:text-muted-foreground"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Lista de Sessões / Turmas da Timeline */}
          <div className="space-y-3">
            {filteredSchedules.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center bg-card/50">
                <Calendar className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                <h3 className="text-sm font-semibold text-foreground">Nenhum horário encontrado</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  {searchQuery
                    ? `Nenhum paciente ou turma corresponde ao termo "${searchQuery}".`
                    : "Não há atendimentos cadastrados para este filtro de turno hoje."}
                </p>
                {searchQuery && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSearchQuery("")}
                    className="mt-3 text-xs rounded-xl"
                  >
                    Limpar busca
                  </Button>
                )}
              </div>
            ) : (
              filteredSchedules.map((schedule) => {
                const occupied = schedule.participants.filter(
                  (p) => p.status !== "justified_absence"
                ).length
                const vacancies = schedule.maxCapacity - occupied
                const isLiveNow =
                  schedule.startTime <= currentTime && schedule.endTime >= currentTime
                const isPast = schedule.endTime < currentTime

                return (
                  <Card
                    key={schedule.id}
                    className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                      isLiveNow
                        ? "border-primary/60 shadow-sm ring-1 ring-primary/30"
                        : "border-border/80 hover:border-border hover:shadow-2xs"
                    }`}
                  >
                    {/* Cabeçalho da Sessão */}
                    <div className="p-3.5 sm:p-4 bg-muted/20 border-b border-border/70 flex flex-wrap items-center justify-between gap-2.5">
                      <div className="flex items-center gap-3">
                        <div className="font-mono text-xs font-extrabold px-2.5 py-1 rounded-lg bg-background border border-border shadow-2xs text-foreground">
                          {schedule.startTime} - {schedule.endTime}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-sm text-foreground">{schedule.title}</h4>
                            {isLiveNow && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/15 px-2 py-0.5 rounded-full">
                                <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping" />
                                Agora
                              </span>
                            )}
                            {isPast && (
                              <span className="text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.2 rounded-full">
                                Finalizado
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                            <span>{schedule.professionalName}</span>
                            <span>•</span>
                            <span className="inline-flex items-center gap-1 font-medium">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: schedule.roomColor }}
                              />
                              <span style={{ color: schedule.roomColor }}>{schedule.roomName}</span>
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge
                          variant={schedule.type === "turma" ? "purple" : "info"}
                          className="text-[10px] font-semibold"
                        >
                          {schedule.type === "turma"
                            ? `Turma (${occupied}/${schedule.maxCapacity})`
                            : "Individual"}
                        </Badge>
                        {schedule.type === "turma" && vacancies > 0 && (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                            {vacancies} vaga(s) livre(s)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Lista de Alunos / Pacientes no Horário */}
                    <div className="p-3 sm:p-4 divide-y divide-border/50">
                      {schedule.participants.length === 0 ? (
                        <div className="py-3 text-center">
                          <p className="text-xs text-muted-foreground italic">
                            Nenhum aluno agendado neste horário.
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onNavigate("schedule")}
                            className="mt-1 text-xs text-primary font-semibold h-7"
                          >
                            + Encaixar Aluno ou Reposição
                          </Button>
                        </div>
                      ) : (
                        schedule.participants.map((p) => {
                          const isPresent = p.status === "present"
                          const isJustified = p.status === "justified_absence"
                          const isReplacement = p.status === "replacement"

                          return (
                            <div
                              key={p.id}
                              className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 first:pt-0 last:pb-0"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div
                                  className={`h-9 w-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                                    isPresent
                                      ? "bg-emerald-500 text-white shadow-xs"
                                      : isJustified
                                      ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                                      : "bg-muted text-muted-foreground border border-border"
                                  }`}
                                >
                                  {isPresent ? (
                                    <Check className="h-4 w-4" />
                                  ) : (
                                    p.patientName.charAt(0)
                                  )}
                                </div>

                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-foreground truncate">
                                      {p.patientName}
                                    </span>
                                    {isReplacement && (
                                      <Badge variant="warning" className="text-[9px] py-0 px-1.5">
                                        Reposição
                                      </Badge>
                                    )}
                                    {isPresent && (
                                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                                        <CheckCircle2 className="h-3 w-3" />
                                        Presente
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                                    <span className="font-mono">{p.patientPhone}</span>
                                    {p.hasActivePackage && (
                                      <>
                                        <span>•</span>
                                        <span className="text-primary font-medium truncate">
                                          {p.activePackageName || "Plano Ativo"} (
                                          {p.remainingSessions ?? 0} rest.)
                                        </span>
                                      </>
                                    )}
                                    {isJustified && (
                                      <span className="text-amber-600 text-[10px] font-semibold">
                                        Crédito gerado
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Ações de Check-in, Desmarcar e WhatsApp */}
                              <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                                {!isJustified ? (
                                  <>
                                    <Button
                                      size="sm"
                                      variant={isPresent ? "default" : "outline"}
                                      onClick={() =>
                                        handleCheckInToggle(
                                          schedule.id,
                                          p.id,
                                          p.status,
                                          p.patientName
                                        )
                                      }
                                      className={`h-8 text-xs font-semibold px-3 rounded-xl gap-1.5 transition-all ${
                                        isPresent
                                          ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                                          : "hover:border-primary/50 text-foreground"
                                      }`}
                                    >
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                      <span>{isPresent ? "Presente" : "Fazer Check-in"}</span>
                                    </Button>

                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() =>
                                        setCancelModalData({
                                          scheduleId: schedule.id,
                                          participantId: p.id,
                                          patientName: p.patientName,
                                        })
                                      }
                                      className="h-8 text-[11px] font-medium text-muted-foreground hover:text-amber-600 hover:bg-amber-500/10 px-2.5 rounded-xl"
                                      title="Desmarcar horário e opcionalmente gerar reposição"
                                    >
                                      Desmarcar
                                    </Button>

                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleReminderClick(schedule, p)}
                                      className="h-8 w-8 p-0 rounded-xl text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                                      title="Enviar Lembrete WhatsApp (UAZAPI)"
                                    >
                                      <Send className="h-3.5 w-3.5" />
                                    </Button>

                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => onNavigate("clinical")}
                                      className="h-8 w-8 p-0 rounded-xl text-sky-600 dark:text-sky-400 hover:bg-sky-500/10"
                                      title="Lançar Evolução Clínica (SOAP)"
                                    >
                                      <FileText className="h-3.5 w-3.5" />
                                    </Button>
                                  </>
                                ) : (
                                  <Badge variant="warning" className="text-xs">
                                    Vaga Liberada
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
              })
            )}
          </div>
        </div>

        {/* ======================================================================= */}
        {/* COLUNA 3: CAPACIDADE DAS SALAS, STATUS UAZAPI & ATALHOS CLÍNICOS        */}
        {/* ======================================================================= */}
        <div className="space-y-6">
          {/* Card: Ocupação Real das Salas Físicas */}
          <Card className="rounded-2xl border-border/80 shadow-2xs">
            <CardHeader className="p-4 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Building className="h-4 w-4 text-primary" />
                  <span>Lotação das Salas</span>
                </CardTitle>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  Tempo Real
                </span>
              </div>
              <CardDescription className="text-xs">
                Ocupação física atual e capacidade acumulada hoje
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-4">
              {realRoomStats.map((room) => {
                return (
                  <div key={room.id} className="space-y-1.5 p-2 rounded-xl bg-muted/20 border border-border/40">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground flex items-center gap-1.5 truncate max-w-[170px]">
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: room.color }}
                        />
                        <span className="truncate">{room.name}</span>
                      </span>
                      <span className="text-[11px] font-mono font-semibold text-foreground">
                        {room.currentOccupied}/{room.capacity}{" "}
                        <span className="text-muted-foreground font-normal">agora</span>
                      </span>
                    </div>

                    {/* Barra de Progresso Real */}
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round((room.currentOccupied / room.capacity) * 100)
                          )}%`,
                          backgroundColor: room.color,
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>
                        {room.isCurrentlyInUse ? (
                          <span className="text-emerald-600 font-semibold">● Em uso</span>
                        ) : (
                          <span>Disponível</span>
                        )}
                      </span>
                      <span>
                        {room.totalStudentsToday} alunos atendidos hoje ({room.schedulesCount} turmas)
                      </span>
                    </div>
                  </div>
                )
              })}

              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate("classes")}
                className="w-full text-xs font-semibold rounded-xl h-9 mt-2 gap-1.5"
              >
                <span>Gerenciar Salas e Turmas</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </CardContent>
          </Card>

          {/* Card: Central Omnicanal WhatsApp (UAZAPI) */}
          <Card className="rounded-2xl border-border/80 shadow-2xs bg-gradient-to-br from-card via-card to-emerald-500/5">
            <CardHeader className="p-4 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Send className="h-4 w-4 text-emerald-600" />
                  <span>Central WhatsApp (UAZAPI)</span>
                </CardTitle>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-500/15 px-2 py-0.5 rounded-full">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Ativo
                </span>
              </div>
              <CardDescription className="text-xs">
                Lembretes automatizados de presença e avisos
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
              <div className="p-3 rounded-xl bg-background/80 border border-border text-xs space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">Lembrete de 24h & 2h:</span>
                  <span className="font-semibold text-emerald-600">Disparo Automático</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">Pacientes aguardando:</span>
                  <span className="font-bold text-foreground">{pendingToday} hoje</span>
                </div>
              </div>

              <Button
                variant="default"
                size="sm"
                onClick={handleBatchReminders}
                disabled={isActionLoading || pendingToday === 0}
                className="w-full text-xs font-semibold rounded-xl h-9 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
              >
                <Send className={`h-3.5 w-3.5 ${isActionLoading ? "animate-spin" : ""}`} />
                <span>Disparar Lembretes de Hoje</span>
              </Button>
            </CardContent>
          </Card>

          {/* Card: Ações Clínicas e Administrativas Rápidas */}
          <Card className="rounded-2xl border-border/80 shadow-2xs">
            <CardHeader className="p-4 pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <span>Ações Rápidas da Clínica</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 grid grid-cols-1 gap-2">
              <Button
                variant="outline"
                onClick={() => onNavigate("clinical")}
                className="w-full justify-start text-xs h-9 gap-2.5 rounded-xl hover:bg-muted/80 font-medium"
              >
                <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                <span>Nova Evolução SOAP</span>
              </Button>

              <Button
                variant="outline"
                onClick={() => onNavigate("finance")}
                className="w-full justify-start text-xs h-9 gap-2.5 rounded-xl hover:bg-muted/80 font-medium"
              >
                <DollarSign className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>Novo Pagamento / Receita</span>
              </Button>

              <Button
                variant="outline"
                onClick={() => onNavigate("packages")}
                className="w-full justify-start text-xs h-9 gap-2.5 rounded-xl hover:bg-muted/80 font-medium"
              >
                <Layers className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                <span>Catálogo de Pacientes & Planos</span>
              </Button>

              <Button
                variant="outline"
                onClick={() => onNavigate("online_bookings")}
                className="w-full justify-start text-xs h-9 gap-2.5 rounded-xl hover:bg-muted/80 font-medium"
              >
                <CalendarCheck className="h-3.5 w-3.5 text-sky-600 shrink-0" />
                <span>Gerenciar Agendamentos Online</span>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 6. MODAL DE CANCELAMENTO / REPOSIÇÃO (Segurança Operacional)               */}
      {/* ========================================================================= */}
      {cancelModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-card border border-border w-full max-w-md rounded-2xl shadow-2xl p-5 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-amber-500/20 text-amber-600 flex items-center justify-center">
                  <UserX className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-bold text-foreground">Desmarcar Agendamento</h3>
              </div>
              <button
                type="button"
                onClick={() => setCancelModalData(null)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Você está desmarcando a sessão de{" "}
              <strong className="text-foreground font-semibold">
                {cancelModalData.patientName}
              </strong>
              . Deseja liberar a vaga imediatamente e gerar um crédito de reposição?
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1 text-foreground">
                  Motivo do cancelamento:
                </label>
                <input
                  type="text"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 text-xs"
                />
              </div>

              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-border bg-muted/20 cursor-pointer">
                <input
                  type="checkbox"
                  checked={generateCredit}
                  onChange={(e) => setGenerateCredit(e.target.checked)}
                  className="rounded text-primary focus:ring-primary h-4 w-4"
                />
                <span className="text-xs font-semibold text-foreground">
                  Gerar crédito de reposição com validade de 30 dias
                </span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCancelModalData(null)}
                className="rounded-xl text-xs h-8"
              >
                Voltar
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={confirmCancelAction}
                className="rounded-xl text-xs h-8 font-semibold"
              >
                Confirmar Desmarcação
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
