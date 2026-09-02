import React, { useState } from "react"
import { useClinicData } from "@/contexts/ClinicDataContext"
import { useTheme } from "@/contexts/ThemeContext"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Calendar,
  Users,
  Layers,
  DollarSign,
  CheckCircle2,
  Clock,
  Send,
  Building,
  Sparkles,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  Plus,
} from "lucide-react"

interface DashboardPageProps {
  onNavigate: (section: any) => void
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { theme } = useTheme()
  const {
    rooms,
    schedules,
    patients,
    transactions,
    checkIn,
    cancelWithReplacement,
    sendWhatsAppReminder,
    replacementCredits,
  } = useClinicData()

  const [notificationToast, setNotificationToast] = useState<string | null>(null)

  // Estatísticas do dia
  const todaySchedules = schedules
  const totalAttendancesToday = todaySchedules.reduce(
    (acc, s) => acc + s.participants.length,
    0
  )
  const completedToday = todaySchedules.reduce(
    (acc, s) =>
      acc + s.participants.filter((p) => p.status === "present").length,
    0
  )

  // Financeiro do dia/mês
  const totalPaidIncome = transactions
    .filter((t) => t.status === "paid" && t.type === "income")
    .reduce((acc, t) => acc + t.amount, 0)

  const pendingIncome = transactions
    .filter((t) => t.status === "pending" && t.type === "income")
    .reduce((acc, t) => acc + t.amount, 0)

  // Créditos de reposição ativos
  const activeCredits = replacementCredits.filter((c) => c.status === "available")

  const handleReminderClick = (schedule: any, participant: any) => {
    sendWhatsAppReminder(schedule, {
      name: participant.patientName,
      phone: participant.patientPhone,
    })
    setNotificationToast(`Lembrete UAZAPI enviado para ${participant.patientName}!`)
    setTimeout(() => setNotificationToast(null), 3500)
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Toast Feedback */}
      {notificationToast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm font-medium animate-fade-in">
          <Send className="h-4 w-4" />
          <span>{notificationToast}</span>
        </div>
      )}

      {/* Banner de Boas-vindas e Identidade da Clínica */}
      <div className="rounded-2xl bg-gradient-to-r from-primary/15 via-primary/5 to-card p-5 sm:p-6 border border-primary/20 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-semibold">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Sistema Operacional de Saúde</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {theme.clinicName}
          </h1>
          <p className="text-sm text-muted-foreground font-medium">
            Gestão integrada de Fisioterapia Ortopédica, Pilates Clínico e RPG.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => onNavigate("schedule")}
            className="gap-2 shadow-sm font-semibold"
          >
            <Calendar className="h-4 w-4" />
            <span>Ver Agenda Completa</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onNavigate("patients")}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            <span>Novo Paciente</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards em Grid Mobile-First */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Atendimentos Hoje */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Atendimentos Hoje
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Calendar className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-xl sm:text-2xl font-bold text-foreground">
              {completedToday} / {totalAttendancesToday}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              <span>{Math.round((completedToday / (totalAttendancesToday || 1)) * 100)}% concluídos</span>
            </p>
          </CardContent>
        </Card>

        {/* Ocupação das Turmas */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Vagas em Turmas
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Layers className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-xl sm:text-2xl font-bold text-foreground">
              75% Ocupação
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Studio Reformer & Solo
            </p>
          </CardContent>
        </Card>

        {/* Receita Interna Realizada */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Receita Recebida
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <DollarSign className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              R$ {totalPaidIncome.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              R$ {pendingIncome.toFixed(2)} a receber
            </p>
          </CardContent>
        </Card>

        {/* Reposições Pendentes */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Créditos Reposição
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Clock className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400">
              {activeCredits.length} ativos
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Validade de até 30 dias
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Grid Principal: Agenda do Dia & Capacidade por Sala */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna 1 & 2: Agenda do Dia e Check-in Rápido */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <span>Atendimentos de Hoje</span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Controle de presença e lembretes UAZAPI (WhatsApp) em tempo real
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate("schedule")}
              className="text-xs text-primary gap-1"
            >
              Ver Grade <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="space-y-3">
            {todaySchedules.map((schedule) => {
              const occupied = schedule.participants.filter(
                (p) => p.status !== "justified_absence"
              ).length
              const vacancies = schedule.maxCapacity - occupied

              return (
                <Card
                  key={schedule.id}
                  className="overflow-hidden border-border hover:border-primary/40 transition-colors"
                >
                  <div className="p-4 bg-muted/30 border-b border-border flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="text-xs font-bold font-mono px-2.5 py-1 rounded-md bg-primary/10 text-primary border border-primary/20">
                        {schedule.startTime} - {schedule.endTime}
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm text-foreground">
                          {schedule.title}
                        </h4>
                        <p className="text-[11px] text-muted-foreground">
                          {schedule.professionalName} •{" "}
                          <span
                            className="font-medium"
                            style={{ color: schedule.roomColor }}
                          >
                            {schedule.roomName}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          schedule.type === "turma" ? "purple" : "info"
                        }
                        className="text-[10px]"
                      >
                        {schedule.type === "turma"
                          ? `Turma (${occupied}/${schedule.maxCapacity})`
                          : "Individual"}
                      </Badge>
                      {schedule.type === "turma" && vacancies > 0 && (
                        <span className="text-[10px] text-emerald-600 font-semibold">
                          {vacancies} vaga(s) livre(s)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Lista de Alunos / Pacientes no Horário */}
                  <div className="p-3 divide-y divide-border/60">
                    {schedule.participants.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic py-2 text-center">
                        Nenhum aluno agendado para este horário.
                      </p>
                    ) : (
                      schedule.participants.map((p) => {
                        const isPresent = p.status === "present"
                        const isAbsent = p.status === "absence"
                        const isJustified = p.status === "justified_absence"

                        return (
                          <div
                            key={p.id}
                            className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 first:pt-0 last:pb-0"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs ${
                                  isPresent
                                    ? "bg-emerald-500 text-white"
                                    : isJustified
                                    ? "bg-amber-500 text-white"
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {p.patientName.charAt(0)}
                              </div>
                              <div>
                                <span className="text-xs font-semibold text-foreground">
                                  {p.patientName}
                                </span>
                                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                  <span>{p.patientPhone}</span>
                                  {p.status === "replacement" && (
                                    <Badge variant="warning" className="text-[9px] py-0">
                                      Reposição
                                    </Badge>
                                  )}
                                  {isJustified && (
                                    <span className="text-amber-600 text-[10px] font-medium">
                                      Crédito de reposição gerado
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Ações de Check-in e WhatsApp */}
                            <div className="flex items-center gap-1.5 self-end sm:self-auto">
                              {!isJustified ? (
                                <>
                                  <Button
                                    size="sm"
                                    variant={isPresent ? "default" : "outline"}
                                    onClick={() =>
                                      checkIn(
                                        schedule.id,
                                        p.id,
                                        isPresent ? "scheduled" : "present"
                                      )
                                    }
                                    className="h-7 text-xs px-2.5 gap-1"
                                  >
                                    <CheckCircle2 className="h-3 w-3" />
                                    <span>{isPresent ? "Presente" : "Check-in"}</span>
                                  </Button>

                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() =>
                                      cancelWithReplacement(
                                        schedule.id,
                                        p.id,
                                        "Aviso prévio do aluno"
                                      )
                                    }
                                    className="h-7 text-[11px] text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/50 px-2"
                                    title="Desmarcar e Gerar Crédito de Reposição"
                                  >
                                    Desmarcar
                                  </Button>

                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleReminderClick(schedule, p)}
                                    className="h-7 w-7 p-0 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                                    title="Enviar Lembrete WhatsApp (UAZAPI)"
                                  >
                                    <Send className="h-3.5 w-3.5" />
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
            })}
          </div>
        </div>

        {/* Coluna 3: Lotação de Salas & Ações Rápidas */}
        <div className="space-y-6">
          {/* Capacidade das Salas Físicas */}
          <Card>
            <CardHeader className="p-4 pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Building className="h-4 w-4 text-primary" />
                <span>Capacidade das Salas</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Ocupação simultânea por ambiente físico
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-4">
              {rooms.map((room) => {
                // Cálculo de alunos agendados agora
                const currentOccupied = room.type === "pilates_aparelhos" ? 3 : 1
                const pct = Math.round((currentOccupied / room.capacity) * 100)

                return (
                  <div key={room.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: room.color }}
                        />
                        {room.name}
                      </span>
                      <span className="text-muted-foreground font-mono">
                        {currentOccupied}/{room.capacity} alunos
                      </span>
                    </div>
                    {/* Barra de progresso */}
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, pct)}%`,
                          backgroundColor: room.color,
                        }}
                      />
                    </div>
                  </div>
                )
              })}

              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate("classes")}
                className="w-full text-xs mt-2"
              >
                Gerenciar Salas e Turmas
              </Button>
            </CardContent>
          </Card>

          {/* Atalhos Rápidos para Fisioterapeutas / Secretária */}
          <Card className="bg-gradient-to-br from-card to-muted/30 border-border">
            <CardHeader className="p-4 pb-3">
              <CardTitle className="text-sm font-bold">Ações Clínicas Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-2">
              <Button
                variant="outline"
                onClick={() => onNavigate("clinical")}
                className="w-full justify-start text-xs h-9 gap-2"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                <span>Lançar Evolução Diária (SOAP)</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => onNavigate("finance")}
                className="w-full justify-start text-xs h-9 gap-2"
              >
                <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
                <span>Novo Lançamento Financeiro</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => onNavigate("notifications")}
                className="w-full justify-start text-xs h-9 gap-2"
              >
                <Send className="h-3.5 w-3.5 text-sky-600" />
                <span>Testar Envio UAZAPI (WhatsApp)</span>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
