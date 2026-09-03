import React, { useState, useMemo } from "react"
import type { Schedule } from "@/types"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Calendar,
  Clock,
  User,
  Plus,
  UserPlus,
  CheckCircle2,
  CalendarDays,
} from "lucide-react"
import {
  getWeekRange,
  formatDateBR,
  isToday,
  getTodayDateString,
} from "@/lib/dateUtils"

interface WeeklyScheduleViewProps {
  currentDate: string // YYYY-MM-DD
  schedules: Schedule[]
  onSelectSchedule: (schedule: Schedule) => void
  onCreateScheduleAtDate: (date: string) => void
  onOpenEnroll: (schedule: Schedule) => void
}

const WEEKDAY_NAMES_FULL = [
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
  "Domingo",
]

const WEEKDAY_NAMES_SHORT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]

export const WeeklyScheduleView: React.FC<WeeklyScheduleViewProps> = ({
  currentDate,
  schedules,
  onSelectSchedule,
  onCreateScheduleAtDate,
  onOpenEnroll,
}) => {
  const weekInfo = useMemo(() => getWeekRange(currentDate), [currentDate])

  // Estado para dia selecionado em visualização mobile
  const [mobileSelectedDay, setMobileSelectedDay] = useState<string>(() => {
    // Se hoje estiver na semana atual, foca em hoje; caso contrário foca no primeiro dia
    const today = getTodayDateString()
    return weekInfo.days.includes(today) ? today : weekInfo.days[0]
  })

  // Agrupar agendamentos por data (YYYY-MM-DD)
  const schedulesByDate = useMemo(() => {
    const map: Record<string, Schedule[]> = {}
    weekInfo.days.forEach((day) => {
      map[day] = []
    })

    schedules.forEach((s) => {
      if (map[s.date]) {
        map[s.date].push(s)
      }
    })

    // Ordenar cronologicamente dentro de cada dia
    Object.keys(map).forEach((d) => {
      map[d].sort((a, b) => a.startTime.localeCompare(b.startTime))
    })

    return map
  }, [weekInfo.days, schedules])

  return (
    <div className="space-y-4">
      {/* SELETOR MOBILE EM PÍLULAS (Visível apenas em telas menores < sm) */}
      <div className="sm:hidden flex items-center gap-1.5 overflow-x-auto pb-2 pt-1 no-scrollbar select-none">
        {weekInfo.days.map((dayStr, idx) => {
          const isSelected = mobileSelectedDay === dayStr
          const dayIsToday = isToday(dayStr)
          const dayCount = schedulesByDate[dayStr]?.length || 0
          const [, , dayNumber] = dayStr.split("-")

          return (
            <button
              key={dayStr}
              type="button"
              onClick={() => setMobileSelectedDay(dayStr)}
              className={`flex flex-col items-center justify-center min-w-[54px] py-2 px-1 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer border ${
                isSelected
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : dayIsToday
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "bg-card text-foreground border-border hover:bg-muted/50"
              }`}
            >
              <span className="text-[10px] font-medium uppercase tracking-wider">
                {WEEKDAY_NAMES_SHORT[idx]}
              </span>
              <span className="text-base font-extrabold">{dayNumber}</span>
              <span
                className={`text-[9px] px-1.5 py-0.2 rounded-full font-semibold mt-0.5 ${
                  isSelected
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {dayCount}
              </span>
            </button>
          )
        })}
      </div>

      {/* MOBILE: EXIBIÇÃO DO DIA SELECIONADO EM LARGURA TOTAL */}
      <div className="sm:hidden space-y-3 animate-fade-in">
        <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-border">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-foreground">
                {WEEKDAY_NAMES_FULL[weekInfo.days.indexOf(mobileSelectedDay)]}
              </span>
              {isToday(mobileSelectedDay) && (
                <Badge variant="success" className="text-[9px] px-1.5 py-0">
                  Hoje
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatDateBR(mobileSelectedDay)} • {schedulesByDate[mobileSelectedDay]?.length || 0} agendamento(s)
            </p>
          </div>

          <Button
            size="sm"
            onClick={() => onCreateScheduleAtDate(mobileSelectedDay)}
            className="h-8 gap-1 text-xs px-2.5 rounded-lg shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Novo</span>
          </Button>
        </div>

        {/* Lista de cards do dia selecionado em mobile */}
        {(!schedulesByDate[mobileSelectedDay] ||
          schedulesByDate[mobileSelectedDay].length === 0) ? (
          <div className="p-8 text-center rounded-2xl bg-card border border-dashed border-border">
            <CalendarDays className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-xs font-medium text-foreground">
              Nenhum agendamento neste dia
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5 mb-3">
              Não há turmas ou atendimentos para esta data.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onCreateScheduleAtDate(mobileSelectedDay)}
              className="gap-1.5 text-xs text-primary border-primary/30"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Agendar Horário</span>
            </Button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {schedulesByDate[mobileSelectedDay].map((schedule) => {
              const occupied = (schedule.participants || []).filter(
                (p) => p.status !== "justified_absence"
              ).length
              const isFull = occupied >= schedule.maxCapacity
              const vacancies = Math.max(0, schedule.maxCapacity - occupied)

              return (
                <Card
                  key={schedule.id}
                  onClick={() => onSelectSchedule(schedule)}
                  className="p-3.5 border-border hover:border-primary/50 transition-all cursor-pointer shadow-xs active:scale-[0.99]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="px-2 py-1 rounded-md bg-primary/10 text-primary font-bold text-xs border border-primary/20">
                        {schedule.startTime}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-foreground leading-tight">
                          {schedule.title}
                        </h4>
                        <p className="text-[11px] text-muted-foreground">
                          {schedule.professionalName}
                        </p>
                      </div>
                    </div>

                    <Badge
                      variant={schedule.type === "turma" ? "purple" : "info"}
                      className="text-[9px] px-1.5 py-0 shrink-0"
                    >
                      {schedule.type === "turma" ? "Turma" : "Individual"}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border/60 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: schedule.roomColor }}
                      />
                      <span className="text-[11px] font-medium text-muted-foreground truncate max-w-[140px]">
                        {schedule.roomName}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
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
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* DESKTOP & TABLET: GRADE DE 7 COLUNAS (SEGUNDA A DOMINGO) */}
      <div className="hidden sm:block overflow-x-auto pb-2">
        <div className="grid grid-cols-7 gap-2.5 min-w-[920px]">
          {weekInfo.days.map((dayStr, idx) => {
            const daySchedules = schedulesByDate[dayStr] || []
            const dayIsToday = isToday(dayStr)
            const isWeekend = idx === 5 || idx === 6 // Sábado ou Domingo
            const [, , dayNumber] = dayStr.split("-")

            return (
              <div
                key={dayStr}
                className={`flex flex-col rounded-2xl border transition-all ${
                  dayIsToday
                    ? "bg-primary/5 border-primary/40 ring-1 ring-primary/30"
                    : isWeekend
                    ? "bg-muted/30 border-border/60"
                    : "bg-card border-border shadow-2xs"
                }`}
              >
                {/* Cabeçalho do Dia */}
                <div className="p-2.5 border-b border-border/80 flex items-center justify-between gap-1">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <span
                        className={`text-xs font-bold leading-none ${
                          dayIsToday ? "text-primary font-extrabold" : "text-foreground"
                        }`}
                      >
                        {WEEKDAY_NAMES_SHORT[idx]}
                      </span>
                      {dayIsToday && (
                        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      )}
                    </div>
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      {dayNumber}/{dayStr.split("-")[1]}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                        daySchedules.length > 0
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                      title={`${daySchedules.length} agendamento(s)`}
                    >
                      {daySchedules.length}
                    </span>

                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => onCreateScheduleAtDate(dayStr)}
                      className="h-6 w-6 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10"
                      title={`Adicionar agendamento em ${formatDateBR(dayStr)}`}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Lista de Cards da Coluna */}
                <div className="p-2 flex-1 space-y-2 min-h-[360px] flex flex-col">
                  {daySchedules.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-3 text-center">
                      <p className="text-[11px] text-muted-foreground/60 mb-2">Sem horários</p>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onCreateScheduleAtDate(dayStr)}
                        className="h-6 text-[10px] px-2 text-primary hover:bg-primary/10 rounded-lg gap-1 font-semibold"
                      >
                        <Plus className="h-3 w-3" />
                        <span>Agendar</span>
                      </Button>
                    </div>
                  ) : (
                    daySchedules.map((schedule) => {
                      const occupied = (schedule.participants || []).filter(
                        (p) => p.status !== "justified_absence"
                      ).length
                      const isFull = occupied >= schedule.maxCapacity
                      const vacancies = Math.max(0, schedule.maxCapacity - occupied)

                      return (
                        <div
                          key={schedule.id}
                          onClick={() => onSelectSchedule(schedule)}
                          className="p-2.5 rounded-xl border border-border/80 bg-background/90 hover:bg-background hover:border-primary/50 hover:shadow-xs transition-all cursor-pointer group flex flex-col justify-between text-left"
                        >
                          <div>
                            {/* Horário e Badge de Tipo */}
                            <div className="flex items-center justify-between gap-1 mb-1.5">
                              <span className="font-extrabold text-[11px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-md leading-none">
                                {schedule.startTime}
                              </span>
                              <Badge
                                variant={schedule.type === "turma" ? "purple" : "info"}
                                className="text-[8px] px-1 py-0 h-4"
                              >
                                {schedule.type === "turma" ? "Turma" : "Indiv"}
                              </Badge>
                            </div>

                            {/* Título */}
                            <h5 className="font-bold text-xs text-foreground leading-tight group-hover:text-primary transition-colors line-clamp-2">
                              {schedule.title}
                            </h5>

                            {/* Profissional e Sala */}
                            <p className="text-[10px] text-muted-foreground mt-1 truncate">
                              {schedule.professionalName}
                            </p>

                            <div className="flex items-center gap-1.5 mt-1">
                              <span
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ backgroundColor: schedule.roomColor }}
                              />
                              <span className="text-[10px] font-medium text-muted-foreground truncate">
                                {schedule.roomName}
                              </span>
                            </div>
                          </div>

                          {/* Rodapé do Card: Vagas e Ação de Encaixe */}
                          <div className="mt-2.5 pt-2 border-t border-border/60 flex items-center justify-between gap-1">
                            {isFull ? (
                              <span className="text-[9px] font-bold text-destructive">
                                Lotada ({occupied}/{schedule.maxCapacity})
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                                {vacancies} vaga(s)
                              </span>
                            )}

                            {!isFull && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onOpenEnroll(schedule)
                                }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
                                title="Encaixar paciente neste horário"
                              >
                                <UserPlus className="h-2.5 w-2.5" />
                                <span>+ Encaixar</span>
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
