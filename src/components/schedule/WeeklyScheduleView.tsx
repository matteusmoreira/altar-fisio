import { occupiesSeat } from '../../../shared/scheduleOccupancy'
import React, { useState, useMemo } from "react"
import type { Schedule, ScheduleParticipant } from "@/types"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
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
  onOpenEnroll: (schedule: Schedule) => void
  patientSearchQuery?: string
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
  onSelectPatientSchedule,
  onCheckIn,
  onSendWhatsApp,
  onCreateScheduleAtDate,
  onOpenEnroll,
  patientSearchQuery = "",
}) => {
  const weekInfo = useMemo(() => getWeekRange(currentDate), [currentDate])

  // Estado para dia selecionado em visualização mobile
  const [mobileSelectedDay, setMobileSelectedDay] = useState<string>(() => {
    const today = getTodayDateString()
    return weekInfo.days.includes(today) ? today : weekInfo.days[0]
  })

  // Sincronizar dia selecionado no mobile ao mudar de semana
  React.useEffect(() => {
    if (!weekInfo.days.includes(mobileSelectedDay)) {
      const today = getTodayDateString()
      setMobileSelectedDay(weekInfo.days.includes(today) ? today : weekInfo.days[0])
    }
  }, [weekInfo.days, mobileSelectedDay])

  // Dia ativo seguro no mobile
  const activeMobileDay = weekInfo.days.includes(mobileSelectedDay)
    ? mobileSelectedDay
    : weekInfo.days.includes(getTodayDateString())
    ? getTodayDateString()
    : weekInfo.days[0]

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

  const normalizedSearch = patientSearchQuery.trim().toLowerCase()

  // Participantes agrupados por dia (com priorização de busca)
  const participantsByDate = useMemo(() => {
    const map: Record<string, Array<{ schedule: Schedule; participant: ScheduleParticipant }>> = {}
    weekInfo.days.forEach((day) => {
      const daySchedules = schedulesByDate[day] || []
      const list: Array<{ schedule: Schedule; participant: ScheduleParticipant }> = []
      daySchedules.forEach((s) => {
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

      map[day] = list
    })
    return map
  }, [weekInfo.days, schedulesByDate, normalizedSearch])

  return (
    <div className="space-y-4 w-full min-w-0">
      {/* SELETOR MOBILE EM PÍLULAS (Visível apenas em telas menores < md) */}
      <div className="md:hidden flex items-center gap-1.5 overflow-x-auto pb-2 pt-1 no-scrollbar select-none">
        {weekInfo.days.map((dayStr, idx) => {
          const isSelected = activeMobileDay === dayStr
          const dayIsToday = isToday(dayStr)
          const dayParticipants = participantsByDate[dayStr] || []
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
                {dayParticipants.length} pac.
              </span>
            </button>
          )
        })}
      </div>

      {/* MOBILE: EXIBIÇÃO DO DIA SELECIONADO EM LARGURA TOTAL */}
      <div className="md:hidden space-y-3 animate-fade-in">
        <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-border">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-foreground">
                {WEEKDAY_NAMES_FULL[weekInfo.days.indexOf(activeMobileDay)]}
              </span>
              {isToday(activeMobileDay) && (
                <Badge variant="success" className="text-[9px] px-1.5 py-0">
                  Hoje
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatDateBR(activeMobileDay)} • {participantsByDate[activeMobileDay]?.length || 0} paciente(s) agendado(s)
            </p>
          </div>

          <Button
            size="sm"
            onClick={() => onCreateScheduleAtDate(activeMobileDay)}
            className="h-8 gap-1 text-xs px-2.5 rounded-lg shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Novo</span>
          </Button>
        </div>

        {/* Lista de pacientes agendados no dia em mobile */}
        {(!participantsByDate[activeMobileDay] ||
          participantsByDate[activeMobileDay].length === 0) ? (
          <div className="p-8 text-center rounded-2xl bg-card border border-dashed border-border">
            <CalendarDays className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-xs font-semibold text-foreground">
              Nenhum paciente agendado neste dia
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5 mb-3">
              {(schedulesByDate[activeMobileDay] || []).length > 0
                ? "Há horários disponíveis sem matrículas."
                : "Não há turmas ou atendimentos para esta data."}
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onCreateScheduleAtDate(activeMobileDay)}
              className="gap-1.5 text-xs text-primary border-primary/30"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Agendar Horário</span>
            </Button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {participantsByDate[activeMobileDay].map(({ schedule, participant }) => {
              const isPresent = participant.status === "present"
              const isMatch =
                normalizedSearch &&
                participant.patientName.toLowerCase().includes(normalizedSearch)

              return (
                <Card
                  key={participant.id}
                  onClick={() => {
                    if (onSelectPatientSchedule) {
                      onSelectPatientSchedule(schedule, participant)
                    } else {
                      onSelectSchedule(schedule)
                    }
                  }}
                  className={`p-3.5 border transition-all cursor-pointer shadow-xs active:scale-[0.99] space-y-2.5 ${
                    isMatch ? "ring-2 ring-amber-500 border-amber-500" : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="px-2 py-1 rounded-md bg-primary/10 text-primary font-bold text-xs border border-primary/20 shrink-0">
                        {schedule.startTime}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-xs font-bold text-foreground leading-tight truncate">
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
                          {schedule.professionalName} • {schedule.roomName}
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

                  <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs">
                    <span className="text-[11px] text-muted-foreground truncate">
                      {schedule.title}
                    </span>

                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
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
                          className={`h-7 px-2 text-[11px] gap-1 rounded-lg ${
                            isPresent ? "bg-emerald-600 text-white" : ""
                          }`}
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          <span>{isPresent ? "Presente" : "Confirmar"}</span>
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (onSelectPatientSchedule) {
                            onSelectPatientSchedule(schedule, participant)
                          }
                        }}
                        className="h-7 px-2 text-[11px] text-destructive hover:bg-destructive/10 rounded-lg"
                      >
                        Desmarcar
                      </Button>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* DESKTOP & TABLET: GRADE DE 7 COLUNAS (SEGUNDA A DOMINGO) */}
      <div className="hidden md:block w-full min-w-0 overflow-x-auto pb-2 touch-pan-x">
        <div className="grid grid-cols-7 gap-1.5 lg:gap-2 xl:gap-2.5 min-w-[680px] xl:min-w-0 w-full">
          {weekInfo.days.map((dayStr, idx) => {
            const daySchedules = schedulesByDate[dayStr] || []
            const dayParticipants = participantsByDate[dayStr] || []
            const dayIsToday = isToday(dayStr)
            const isWeekend = idx === 5 || idx === 6
            const [, , dayNumber] = dayStr.split("-")

            const hasSearchMatch =
              normalizedSearch &&
              dayParticipants.some((dp) =>
                dp.participant.patientName.toLowerCase().includes(normalizedSearch)
              )

            const totalVacancies = daySchedules.reduce((acc, s) => {
              const occupied = (s.participants || []).filter(occupiesSeat).length
              return acc + Math.max(0, s.maxCapacity - occupied)
            }, 0)

            const vacantSlots = daySchedules.filter((s) => {
              const occupied = (s.participants || []).filter(occupiesSeat).length
              return occupied < s.maxCapacity
            })

            return (
              <div
                key={dayStr}
                className={`flex flex-col rounded-2xl border transition-all min-w-0 ${
                  hasSearchMatch
                    ? "bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/40"
                    : dayIsToday
                    ? "bg-primary/5 border-primary/40 ring-1 ring-primary/30"
                    : isWeekend
                    ? "bg-muted/30 border-border/60"
                    : "bg-card border-border shadow-2xs"
                }`}
              >
                {/* Cabeçalho do Dia */}
                <div className="p-2 sm:p-2.5 border-b border-border/80 flex items-center justify-between gap-1 min-w-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <span
                        className={`text-[11px] sm:text-xs font-bold leading-none ${
                          dayIsToday ? "text-primary font-extrabold" : "text-foreground"
                        }`}
                      >
                        {WEEKDAY_NAMES_SHORT[idx]}
                      </span>
                      {dayIsToday && (
                        <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                      )}
                    </div>
                    <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground">
                      {dayNumber}/{dayStr.split("-")[1]}
                    </span>
                  </div>

                  <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                    <span
                      className={`text-[9px] sm:text-[10px] font-bold px-1 sm:px-1.5 py-0.2 rounded-full ${
                        hasSearchMatch
                          ? "bg-amber-500 text-white font-black"
                          : dayParticipants.length > 0
                          ? "bg-primary/10 text-primary font-bold"
                          : "bg-muted text-muted-foreground"
                      }`}
                      title={`${dayParticipants.length} paciente(s) agendado(s)`}
                    >
                      {dayParticipants.length} pac.
                    </span>

                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => onCreateScheduleAtDate(dayStr)}
                      className="h-5 w-5 sm:h-6 sm:w-6 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 shrink-0"
                      title={`Adicionar agendamento em ${formatDateBR(dayStr)}`}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Lista de Pacientes da Coluna */}
                <div className="p-1.5 sm:p-2 flex-1 space-y-2 min-h-[380px] flex flex-col justify-between min-w-0">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    {dayParticipants.length === 0 && vacantSlots.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center p-3 text-center min-h-[160px]">
                        <p className="text-[11px] text-muted-foreground/60 mb-2">Sem marcações</p>
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
                      dayParticipants.map(({ schedule, participant }) => {
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
                            className={`p-1.5 sm:p-2 rounded-xl border bg-background/95 hover:bg-background hover:shadow-xs transition-all cursor-pointer group flex flex-col justify-between text-left min-w-0 ${
                              isMatch
                                ? "ring-2 ring-amber-500 border-amber-500 bg-amber-500/10"
                                : "border-border/80 hover:border-primary/50"
                            }`}
                          >
                            <div className="min-w-0">
                              {/* Horário & Status */}
                              <div className="flex items-center justify-between gap-1 mb-1">
                                <span className="font-extrabold text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded leading-none shrink-0">
                                  {schedule.startTime}
                                </span>

                                <div className="flex items-center gap-1 shrink-0">
                                  {participant.status === "replacement" && (
                                    <Badge variant="purple" className="text-[8px] px-1 py-0 h-3.5">
                                      Reposição
                                    </Badge>
                                  )}
                                  {isPresent && (
                                    <Badge className="bg-emerald-600/15 text-emerald-600 border-emerald-600/30 text-[8px] px-1 py-0 h-3.5">
                                      Presente
                                    </Badge>
                                  )}
                                </div>
                              </div>

                              {/* Nome do Paciente em Destaque */}
                              <h5 className="font-bold text-[11px] sm:text-xs text-foreground leading-tight group-hover:text-primary transition-colors truncate">
                                {participant.patientName}
                              </h5>

                              {/* Fisioterapeuta e Sala */}
                              <div className="flex items-center gap-1.5 mt-1 text-[9px] sm:text-[10px] text-muted-foreground truncate">
                                <span
                                  className="w-1.5 h-1.5 rounded-full shrink-0"
                                  style={{ backgroundColor: schedule.roomColor }}
                                />
                                <span className="truncate">{schedule.roomName}</span>
                              </div>
                            </div>

                            {/* Rodapé do Card: Ação rápida de desmarcar */}
                            <div className="mt-1.5 pt-1.5 border-t border-border/50 flex items-center justify-between gap-1 min-w-0">
                              <span className="text-[9px] text-muted-foreground truncate max-w-[55px] sm:max-w-[75px]">
                                {schedule.professionalName.split(" ")[0]}
                              </span>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (onSelectPatientSchedule) {
                                    onSelectPatientSchedule(schedule, participant)
                                  }
                                }}
                                className="text-[9px] font-bold text-destructive hover:underline cursor-pointer shrink-0"
                                title="Desmarcar horário deste paciente"
                              >
                                Desmarcar
                              </button>
                            </div>
                          </div>
                        )
                      })
                    )}

                    {/* Vagas disponíveis sem pacientes */}
                    {vacantSlots.length > 0 && (
                      <div className="pt-1.5 space-y-1">
                        {vacantSlots.slice(0, 2).map((s) => {
                          const occupied = (s.participants || []).filter(occupiesSeat).length
                          const left = Math.max(0, s.maxCapacity - occupied)
                          return (
                            <div
                              key={s.id}
                              onClick={() => onOpenEnroll(s)}
                              className="p-1.5 rounded-lg border border-dashed border-border/70 bg-muted/20 hover:bg-primary/5 hover:border-primary/40 text-[10px] flex items-center justify-between cursor-pointer transition-colors"
                              title={`Encaixar paciente às ${s.startTime}`}
                            >
                              <span className="font-semibold text-muted-foreground">
                                {s.startTime} ({left}v)
                              </span>
                              <span className="text-primary font-bold hover:underline flex items-center gap-0.5">
                                <UserPlus className="h-2.5 w-2.5" />
                                <span>+ Encaixe</span>
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Rodapé da Coluna com Vagas Livres */}
                  {totalVacancies > 0 && (
                    <div className="pt-2 border-t border-border/60 text-center">
                      <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">
                        +{totalVacancies} vaga(s) livre(s)
                      </span>
                    </div>
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
