import React, { useState, useMemo } from "react"
import type { Schedule } from "@/types"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Calendar as CalendarIcon,
  Clock,
  User,
  Plus,
  ChevronRight,
  ExternalLink,
  X,
  UserPlus,
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
  onCreateScheduleAtDate: (date: string) => void
  onNavigateToDay: (date: string) => void
  onOpenEnroll: (schedule: Schedule) => void
}

const WEEKDAY_HEADERS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]

export const MonthlyScheduleView: React.FC<MonthlyScheduleViewProps> = ({
  currentDate,
  schedules,
  onSelectSchedule,
  onCreateScheduleAtDate,
  onNavigateToDay,
  onOpenEnroll,
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

  // Painel lateral / Drawer do dia clicado
  const [selectedDayCell, setSelectedDayCell] = useState<CalendarDayCell | null>(
    () => {
      const today = getTodayDateString()
      const foundToday = gridCells.find((c) => c.date === today && c.isCurrentMonth)
      return foundToday || gridCells.find((c) => c.isCurrentMonth) || null
    }
  )

  const selectedDaySchedules = selectedDayCell
    ? schedulesByDate[selectedDayCell.date] || []
    : []

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
              const hasSchedules = daySchedules.length > 0
              const isSelected = selectedDayCell?.date === cell.date

              return (
                <div
                  key={cell.date}
                  onClick={() => setSelectedDayCell(cell)}
                  className={`min-h-[72px] sm:min-h-[96px] p-1.5 sm:p-2 rounded-xl border transition-all cursor-pointer flex flex-col justify-between text-left select-none relative group ${
                    !cell.isCurrentMonth
                      ? "opacity-35 bg-muted/20 border-transparent hover:opacity-60"
                      : isSelected
                      ? "bg-primary/10 border-primary ring-1 ring-primary/40 shadow-xs"
                      : cell.isToday
                      ? "bg-primary/5 border-primary/40"
                      : cell.isWeekend
                      ? "bg-muted/30 border-border/60 hover:bg-muted/50 hover:border-border"
                      : "bg-background border-border/80 hover:bg-muted/40 hover:border-border"
                  }`}
                >
                  {/* Número do Dia e Indicador de Hoje */}
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

                    {hasSchedules && (
                      <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-full bg-primary/15 text-primary">
                        {daySchedules.length}
                      </span>
                    )}
                  </div>

                  {/* Chips Resumidos dos Horários */}
                  <div className="space-y-1 my-1 overflow-hidden">
                    {daySchedules.slice(0, 2).map((s) => (
                      <div
                        key={s.id}
                        className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold truncate bg-muted/70 text-foreground border border-border/40"
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: s.roomColor }}
                        />
                        <span className="truncate">
                          {s.startTime} {s.specialty.toUpperCase()}
                        </span>
                      </div>
                    ))}

                    {/* Em mobile, pequenos pontinhos de status */}
                    <div className="sm:hidden flex items-center gap-1 flex-wrap">
                      {daySchedules.slice(0, 3).map((s) => (
                        <span
                          key={s.id}
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: s.roomColor }}
                        />
                      ))}
                    </div>

                    {daySchedules.length > 2 && (
                      <span className="hidden sm:block text-[9px] font-bold text-muted-foreground pl-1 leading-none">
                        +{daySchedules.length - 2} mais
                      </span>
                    )}
                  </div>

                  {/* Vagas livres no dia */}
                  {hasSchedules && cell.isCurrentMonth && (
                    <div className="hidden sm:block text-[9px] font-medium text-muted-foreground/80 truncate">
                      {daySchedules.reduce(
                        (acc, s) =>
                          acc +
                          Math.max(
                            0,
                            s.maxCapacity -
                              (s.participants?.filter(
                                (p) => p.status !== "justified_absence"
                              ).length || 0)
                          ),
                        0
                      )}{" "}
                      vaga(s)
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
                  {selectedDaySchedules.length} agendamento(s) cadastrado(s)
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

            {/* Ação de Navegação Rápida para o Dia na Visão Diária */}
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

            {/* Lista dos Agendamentos do Dia */}
            <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
              {selectedDaySchedules.length === 0 ? (
                <div className="p-8 text-center rounded-xl bg-muted/20 border border-dashed border-border">
                  <CalendarIcon className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-foreground">
                    Nenhum agendamento neste dia
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 mb-3">
                    A clínica não possui sessões agendadas para esta data.
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
                selectedDaySchedules.map((schedule) => {
                  const occupied = (schedule.participants || []).filter(
                    (p) => p.status !== "justified_absence"
                  ).length
                  const isFull = occupied >= schedule.maxCapacity
                  const vacancies = Math.max(0, schedule.maxCapacity - occupied)

                  return (
                    <div
                      key={schedule.id}
                      onClick={() => onSelectSchedule(schedule)}
                      className="p-3 rounded-xl border border-border bg-background hover:border-primary/50 hover:shadow-xs transition-all cursor-pointer group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 rounded-md bg-primary/10 text-primary font-bold text-xs border border-primary/20 shrink-0">
                            {schedule.startTime}
                          </span>
                          <div>
                            <h4 className="text-xs font-bold text-foreground leading-tight group-hover:text-primary transition-colors">
                              {schedule.title}
                            </h4>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {schedule.professionalName}
                            </p>
                          </div>
                        </div>

                        <Badge
                          variant={schedule.type === "turma" ? "purple" : "info"}
                          className="text-[9px] px-1.5 py-0 shrink-0"
                        >
                          {schedule.type === "turma" ? "Turma" : "Indiv"}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-border/60 text-xs">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: schedule.roomColor }}
                          />
                          <span className="text-[11px] font-medium text-muted-foreground truncate">
                            {schedule.roomName}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {isFull ? (
                            <Badge variant="destructive" className="text-[9px]">
                              Lotada ({occupied}/{schedule.maxCapacity})
                            </Badge>
                          ) : (
                            <Badge variant="success" className="text-[9px]">
                              {vacancies} vaga(s)
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
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
