import { occupiesSeat } from '../../../shared/scheduleOccupancy'
import React, { useState, useMemo } from "react"
import type { Schedule, ScheduleParticipant } from "@/types"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Calendar as CalendarIcon,
  User,
  Plus,
  ChevronRight,
  UserPlus,
  CheckCircle2,
  Send,
  Users,
} from "lucide-react"
import {
  getMonthCalendarGrid,
  formatDateBR,
  formatDateWithWeekdayBR,
  isToday,
  getTodayDateString,
  type CalendarDayCell,
} from "@/lib/dateUtils"

interface MonthlyScheduleViewProps {
  currentDate: string // YYYY-MM-DD
  schedules: Schedule[]
  onSelectSchedule: (schedule: Schedule) => void
  onSelectPatientSchedule?: (schedule: Schedule, participant: ScheduleParticipant) => void
  onCheckIn?: (
    scheduleId: string,
    participantId: string,
    status: "present" | "absence" | "scheduled"
  ) => Promise<any>
  onSendWhatsApp?: (
    schedule: Schedule,
    participant: { name: string; phone: string }
  ) => Promise<any>
  onCreateScheduleAtDate: (date: string) => void
  onNavigateToDay: (date: string) => void
  onOpenEnroll: (schedule: Schedule) => void
  patientSearchQuery?: string
}

const WEEKDAY_HEADERS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]

export const MonthlyScheduleView: React.FC<MonthlyScheduleViewProps> = ({
  currentDate,
  schedules,
  onSelectSchedule,
  onSelectPatientSchedule,
  onCheckIn,
  onSendWhatsApp,
  onCreateScheduleAtDate,
  onNavigateToDay,
  onOpenEnroll,
  patientSearchQuery = "",
}) => {
  const gridCells = useMemo(
    () => getMonthCalendarGrid(currentDate),
    [currentDate]
  )

  // Mapeamento de agendamentos por data YYYY-MM-DD
  const schedulesByDate = useMemo(() => {
    const map: Record<string, Schedule[]> = {}
    schedules.forEach((s) => {
      if (!map[s.date]) {
        map[s.date] = []
      }
      map[s.date].push(s)
    })

    // Ordenar cronologicamente
    Object.keys(map).forEach((d) => {
      map[d].sort((a, b) => a.startTime.localeCompare(b.startTime))
    })

    return map
  }, [schedules])

  // Busca normalizada
  const normalizedSearch = patientSearchQuery.trim().toLowerCase()

  // Painel lateral / Drawer do dia clicado
  const [selectedDayCell, setSelectedDayCell] = useState<CalendarDayCell | null>(
    () => {
      const today = getTodayDateString()
      const foundToday = gridCells.find((c) => c.date === today && c.isCurrentMonth)
      return foundToday || gridCells.find((c) => c.isCurrentMonth) || null
    }
  )

  // Sincronizar o dia selecionado quando a grade de dias mudar (ex: navegação de mês)
  React.useEffect(() => {
    const today = getTodayDateString()
    const foundToday = gridCells.find((c) => c.date === today && c.isCurrentMonth)
    const fallback = foundToday || gridCells.find((c) => c.isCurrentMonth) || null

    setSelectedDayCell((prev) => {
      if (!prev) return fallback
      const stillInMonth = gridCells.find((c) => c.date === prev.date && c.isCurrentMonth)
      return stillInMonth || fallback
    })
  }, [gridCells])

  const selectedDaySchedules = selectedDayCell
    ? schedulesByDate[selectedDayCell.date] || []
    : []

  // Todos os participantes do dia selecionado (com ordenação priorizando busca)
  const selectedDayParticipants = useMemo(() => {
    const list: Array<{ schedule: Schedule; participant: ScheduleParticipant }> = []
    selectedDaySchedules.forEach((s) => {
      ;(s.participants || []).forEach((p) => {
        list.push({ schedule: s, participant: p })
      })
    })

    if (normalizedSearch) {
      list.sort((a, b) => {
        const aMatch = a.participant.patientName.toLowerCase().includes(normalizedSearch) ? 0 : 1
        const bMatch = b.participant.patientName.toLowerCase().includes(normalizedSearch) ? 0 : 1
        if (aMatch !== bMatch) return aMatch - bMatch
        return a.schedule.startTime.localeCompare(b.schedule.startTime)
      })
    } else {
      list.sort((a, b) => a.schedule.startTime.localeCompare(b.schedule.startTime))
    }

    return list
  }, [selectedDaySchedules, normalizedSearch])

  // Horários do dia selecionado com vagas livres
  const selectedDayVacantSchedules = useMemo(() => {
    return selectedDaySchedules.filter((s) => {
      const occupied = (s.participants || []).filter(occupiesSeat).length
      return occupied < s.maxCapacity
    })
  }, [selectedDaySchedules])

  return (
    <div className="flex flex-col lg:flex-row gap-5 items-start">
      {/* GRADE DO CALENDÁRIO MENSAL (7 COLUNAS) */}
      <div className="flex-1 w-full space-y-2">
        <Card className="p-3 sm:p-4 rounded-2xl border-border bg-card shadow-xs overflow-hidden">
          {/* Cabeçalho dos Dias da Semana */}
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5 mb-2 pb-2 border-b border-border/70 text-center">
            {WEEKDAY_HEADERS.map((name, i) => (
              <div
                key={name}
                className={`text-[11px] sm:text-xs font-bold uppercase tracking-wider py-1 ${
                  i === 5 || i === 6
                    ? "text-muted-foreground/60"
                    : "text-foreground/80"
                }`}
              >
                {name}
              </div>
            ))}
          </div>

          {/* Matriz dos Dias */}
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {gridCells.map((cell) => {
              const daySchedules = schedulesByDate[cell.date] || []
              const isSelected = selectedDayCell?.date === cell.date

              // Participantes deste dia
              const dayParticipants: Array<{
                schedule: Schedule
                participant: ScheduleParticipant
              }> = []

              daySchedules.forEach((s) => {
                ;(s.participants || []).forEach((p) => {
                  dayParticipants.push({ schedule: s, participant: p })
                })
              })

              if (normalizedSearch) {
                dayParticipants.sort((a, b) => {
                  const aMatch = a.participant.patientName.toLowerCase().includes(normalizedSearch) ? 0 : 1
                  const bMatch = b.participant.patientName.toLowerCase().includes(normalizedSearch) ? 0 : 1
                  if (aMatch !== bMatch) return aMatch - bMatch
                  return a.schedule.startTime.localeCompare(b.schedule.startTime)
                })
              } else {
                dayParticipants.sort((a, b) => a.schedule.startTime.localeCompare(b.schedule.startTime))
              }

              // Se houver busca por paciente, verifica se há match
              const matchesSearch = normalizedSearch
                ? dayParticipants.some((dp) =>
                    dp.participant.patientName.toLowerCase().includes(normalizedSearch)
                  )
                : false

              const totalVacancies = daySchedules.reduce((acc, s) => {
                const occupied = (s.participants || []).filter(occupiesSeat).length
                return acc + Math.max(0, s.maxCapacity - occupied)
              }, 0)

              return (
                <div
                  key={cell.date}
                  onClick={() => setSelectedDayCell(cell)}
                  className={`min-h-[82px] sm:min-h-[110px] p-1.5 sm:p-2 rounded-xl border transition-all cursor-pointer flex flex-col justify-between text-left select-none relative group ${
                    !cell.isCurrentMonth
                      ? "opacity-35 bg-muted/20 border-transparent hover:opacity-60"
                      : matchesSearch
                      ? "bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/50 shadow-xs"
                      : isSelected
                      ? "bg-primary/10 border-primary ring-1 ring-primary/40 shadow-xs"
                      : cell.isToday
                      ? "bg-primary/5 border-primary/40"
                      : cell.isWeekend
                      ? "bg-muted/30 border-border/60 hover:bg-muted/50 hover:border-border"
                      : "bg-background border-border/80 hover:bg-muted/40 hover:border-border"
                  }`}
                >
                  {/* Número do Dia e Contagem de Pacientes */}
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`text-xs sm:text-sm font-bold leading-none ${
                        cell.isToday
                          ? "h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-extrabold text-xs shadow-2xs"
                          : isSelected
                          ? "text-primary font-extrabold"
                          : "text-foreground"
                      }`}
                    >
                      {cell.dayNumber}
                    </span>

                    {dayParticipants.length > 0 && (
                      <span
                        className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${
                          matchesSearch
                            ? "bg-amber-500 text-white font-black"
                            : "bg-primary/15 text-primary"
                        }`}
                        title={`${dayParticipants.length} paciente(s) agendado(s)`}
                      >
                        {dayParticipants.length} pac.
                      </span>
                    )}
                  </div>

                  {/* Chips Individuais dos Pacientes Agendados */}
                  <div className="space-y-1 my-1 overflow-hidden flex-1">
                    {dayParticipants.slice(0, 3).map(({ schedule, participant }) => {
                      const isMatch =
                        normalizedSearch &&
                        participant.patientName.toLowerCase().includes(normalizedSearch)

                      return (
                        <div
                          key={participant.id}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (onSelectPatientSchedule) {
                              onSelectPatientSchedule(schedule, participant)
                            } else {
                              onSelectSchedule(schedule)
                            }
                          }}
                          className={`hidden sm:flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold truncate transition-colors border ${
                            isMatch
                              ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                              : participant.status === "present"
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25"
                              : participant.status === "replacement"
                              ? "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30 hover:bg-purple-500/25"
                              : "bg-muted/80 hover:bg-primary/15 hover:border-primary/50 text-foreground border-border/60"
                          }`}
                          title={`${schedule.startTime} • ${participant.patientName} (${schedule.roomName})`}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: schedule.roomColor }}
                          />
                          <span className="truncate">
                            {schedule.startTime} • {participant.patientName}
                          </span>
                        </div>
                      )
                    })}

                    {/* Em mobile, pequenos pontinhos com a cor da sala */}
                    <div className="sm:hidden flex items-center gap-1 flex-wrap">
                      {dayParticipants.slice(0, 4).map(({ schedule, participant }) => (
                        <span
                          key={participant.id}
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: schedule.roomColor }}
                          title={participant.patientName}
                        />
                      ))}
                    </div>

                    {dayParticipants.length > 3 && (
                      <span className="hidden sm:block text-[9px] font-bold text-muted-foreground pl-1 leading-none">
                        +{dayParticipants.length - 3} mais
                      </span>
                    )}

                    {dayParticipants.length === 0 && daySchedules.length > 0 && (
                      <div className="hidden sm:block text-[10px] text-muted-foreground/60 italic pl-1 leading-tight">
                        Sem alunos
                      </div>
                    )}
                  </div>

                  {/* Vagas livres no rodapé da célula */}
                  {cell.isCurrentMonth && totalVacancies > 0 && (
                    <div className="hidden sm:block text-[9px] font-medium text-emerald-600 dark:text-emerald-400 truncate">
                      +{totalVacancies} vaga(s) livre(s)
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      {/* PAINEL LATERAL (DRAWER / SIDEBAR DO DIA SELECIONADO) */}
      <div className="w-full lg:w-96 shrink-0 space-y-3">
        {selectedDayCell ? (
          <Card className="p-4 sm:p-5 rounded-2xl border-border bg-card shadow-xs space-y-4 animate-fade-in">
            {/* Header do Dia Selecionado */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-border">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-extrabold text-base text-foreground">
                    {formatDateWithWeekdayBR(selectedDayCell.date)}
                  </h3>
                  {selectedDayCell.isToday && (
                    <Badge variant="success" className="text-[10px] px-1.5 py-0">
                      Hoje
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {selectedDayParticipants.length} paciente(s) agendado(s)
                </p>
              </div>

              <Button
                size="sm"
                onClick={() => onCreateScheduleAtDate(selectedDayCell.date)}
                className="h-8 text-xs gap-1 px-2.5 rounded-xl shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Novo</span>
              </Button>
            </div>

            {/* Ação de Navegação Rápida para a Visão Diária */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigateToDay(selectedDayCell.date)}
              className="w-full justify-between gap-2 h-9 text-xs text-primary border-primary/30 hover:bg-primary/5 rounded-xl font-semibold shadow-2xs"
            >
              <span className="flex items-center gap-1.5">
                <CalendarIcon className="h-3.5 w-3.5" />
                <span>Ver este dia na Agenda Diária</span>
              </span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>

            {/* Lista dos Pacientes Agendados no Dia */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-foreground">
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-primary" />
                  <span>Pacientes Agendados ({selectedDayParticipants.length})</span>
                </span>
              </div>

              {selectedDayParticipants.length === 0 ? (
                <div className="p-6 text-center rounded-xl bg-muted/20 border border-dashed border-border">
                  <User className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-foreground">
                    Nenhum paciente agendado neste dia
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 mb-3">
                    {selectedDaySchedules.length > 0
                      ? `Existem ${selectedDaySchedules.length} horário(s) com vagas disponíveis.`
                      : "A clínica não possui sessões agendadas para esta data."}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onCreateScheduleAtDate(selectedDayCell.date)}
                    className="gap-1.5 text-xs text-primary border-primary/30"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Criar Agendamento</span>
                  </Button>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[440px] overflow-y-auto pr-1">
                  {selectedDayParticipants.map(({ schedule, participant }) => {
                    const isPresent = participant.status === "present"
                    const isMatch =
                      normalizedSearch &&
                      participant.patientName.toLowerCase().includes(normalizedSearch)

                    return (
                      <div
                        key={participant.id}
                        onClick={() => {
                          if (onSelectPatientSchedule) {
                            onSelectPatientSchedule(schedule, participant)
                          } else {
                            onSelectSchedule(schedule)
                          }
                        }}
                        className={`p-3 rounded-xl border bg-background hover:border-primary/60 hover:shadow-xs transition-all cursor-pointer group space-y-2 ${
                          isMatch ? "ring-2 ring-amber-500 border-amber-500" : "border-border"
                        }`}
                      >
                        {/* Linha Superior: Nome, Status e Horário */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                              {participant.patientName.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h4 className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">
                                  {participant.patientName}
                                </h4>
                                {participant.status === "replacement" && (
                                  <Badge variant="purple" className="text-[9px] px-1.5 py-0">
                                    Reposição
                                  </Badge>
                                )}
                                {isPresent && (
                                  <Badge className="bg-emerald-600/15 text-emerald-600 border-emerald-600/30 text-[9px] px-1.5 py-0">
                                    Presente
                                  </Badge>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                {schedule.startTime} às {schedule.endTime} • {schedule.professionalName}
                              </p>
                            </div>
                          </div>

                          <span
                            className="text-[9px] px-2 py-0.5 rounded font-bold shrink-0"
                            style={{
                              backgroundColor: `${schedule.roomColor}15`,
                              color: schedule.roomColor,
                            }}
                          >
                            {schedule.roomName}
                          </span>
                        </div>

                        {/* Linha Inferior: Modalidade e Ações Diretas */}
                        <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs">
                          <span className="text-[10px] text-muted-foreground truncate max-w-[140px]">
                            {schedule.title}
                          </span>

                          <div
                            className="flex items-center gap-1.5 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* Toggle Presença */}
                            {onCheckIn && (
                              <Button
                                size="sm"
                                variant={isPresent ? "default" : "outline"}
                                onClick={() =>
                                  onCheckIn(
                                    schedule.id,
                                    participant.id,
                                    isPresent ? "scheduled" : "present"
                                  )
                                }
                                className={`h-6 text-[10px] px-2 gap-1 rounded-lg ${
                                  isPresent
                                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                    : "text-foreground"
                                }`}
                                title={isPresent ? "Desmarcar presença" : "Confirmar presença"}
                              >
                                <CheckCircle2 className="h-2.5 w-2.5" />
                                <span>{isPresent ? "Presente" : "Confirmar"}</span>
                              </Button>
                            )}

                            {/* Desmarcar Direto */}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (onSelectPatientSchedule) {
                                  onSelectPatientSchedule(schedule, participant)
                                }
                              }}
                              className="h-6 text-[10px] px-1.5 text-destructive hover:bg-destructive/10 rounded-lg"
                              title="Desmarcar horário do paciente"
                            >
                              Desmarcar
                            </Button>

                            {/* WhatsApp */}
                            {participant.patientPhone && onSendWhatsApp && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() =>
                                  onSendWhatsApp(schedule, {
                                    name: participant.patientName,
                                    phone: participant.patientPhone,
                                  })
                                }
                                className="h-6 w-6 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg"
                                title="Enviar mensagem via WhatsApp"
                              >
                                <Send className="h-2.5 w-2.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Seção Secundária: Horários com Vagas Livres para Encaixe */}
            {selectedDayVacantSchedules.length > 0 && (
              <div className="pt-3 border-t border-border space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
                  <span>Horários com Vagas Livres</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    {selectedDayVacantSchedules.reduce(
                      (acc, s) =>
                        acc +
                        Math.max(
                          0,
                          s.maxCapacity -
                            (s.participants?.filter(occupiesSeat).length || 0)
                        ),
                      0
                    )}{" "}
                    vaga(s)
                  </span>
                </div>

                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {selectedDayVacantSchedules.map((s) => {
                    const occupied = (s.participants || []).filter(occupiesSeat).length
                    const vacancies = Math.max(0, s.maxCapacity - occupied)

                    return (
                      <div
                        key={s.id}
                        className="p-2 rounded-xl bg-muted/30 border border-border/70 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <span className="font-bold text-foreground text-xs">
                            {s.startTime}
                          </span>{" "}
                          •{" "}
                          <span className="text-muted-foreground text-[11px] truncate">
                            {s.roomName}
                          </span>
                        </div>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onOpenEnroll(s)}
                          className="h-6 text-[10px] px-2 gap-1 text-primary border-primary/30 hover:bg-primary/10 rounded-lg shrink-0"
                        >
                          <UserPlus className="h-2.5 w-2.5" />
                          <span>+ Encaixar ({vacancies})</span>
                        </Button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </Card>
        ) : (
          <Card className="p-6 text-center border-dashed border-border">
            <p className="text-xs text-muted-foreground">
              Selecione um dia no calendário para ver seus agendamentos.
            </p>
          </Card>
        )}
      </div>
    </div>
  )
}
