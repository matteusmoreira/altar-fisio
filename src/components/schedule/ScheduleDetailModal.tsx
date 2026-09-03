import React, { useState } from "react"
import type { Schedule, ScheduleParticipant } from "@/types"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Calendar,
  Clock,
  User,
  UserPlus,
  Send,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
} from "lucide-react"
import { formatDateWithWeekdayBR, formatDateBR } from "@/lib/dateUtils"

interface ScheduleDetailModalProps {
  schedule: Schedule | null
  isOpen: boolean
  onClose: () => void
  onCheckIn: (
    scheduleId: string,
    participantId: string,
    status: "present" | "absence" | "scheduled"
  ) => Promise<any>
  onSendWhatsApp: (
    schedule: Schedule,
    participant: { name: string; phone: string }
  ) => Promise<any>
  onOpenEnroll: (schedule: Schedule) => void
  onOpenCancel: (schedule: Schedule, participant: ScheduleParticipant) => void
  onNavigateToDay?: (date: string) => void
}

export const ScheduleDetailModal: React.FC<ScheduleDetailModalProps> = ({
  schedule,
  isOpen,
  onClose,
  onCheckIn,
  onSendWhatsApp,
  onOpenEnroll,
  onOpenCancel,
  onNavigateToDay,
}) => {
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  if (!schedule) return null

  const occupied = (schedule.participants || []).filter(
    (p) => p.status !== "justified_absence"
  ).length
  const isFull = occupied >= schedule.maxCapacity
  const vacanciesLeft = Math.max(0, schedule.maxCapacity - occupied)

  const handleQuickCheckIn = async (
    participantId: string,
    status: "present" | "absence" | "scheduled"
  ) => {
    setLoadingActionId(`check_${participantId}`)
    try {
      const res = await onCheckIn(schedule.id, participantId, status)
      setFeedback(res?.message || "Presença atualizada com sucesso!")
      setTimeout(() => setFeedback(null), 3000)
    } catch (err: any) {
      alert(err?.message || "Erro ao atualizar presença")
    } finally {
      setLoadingActionId(null)
    }
  }

  const handleQuickWhatsApp = async (participant: ScheduleParticipant) => {
    if (!participant.patientPhone) {
      alert("Paciente sem telefone cadastrado.")
      return
    }
    setLoadingActionId(`wpp_${participant.id}`)
    try {
      await onSendWhatsApp(schedule, {
        name: participant.patientName,
        phone: participant.patientPhone,
      })
      setFeedback(`Lembrete enviado via WhatsApp para ${participant.patientName}!`)
      setTimeout(() => setFeedback(null), 3000)
    } catch (err: any) {
      alert(err?.message || "Erro ao disparar WhatsApp")
    } finally {
      setLoadingActionId(null)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader className="pr-8">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge
              variant={schedule.type === "turma" ? "purple" : "info"}
              className="text-[10px]"
            >
              {schedule.type === "turma" ? "Turma em Grupo" : "Atendimento Individual"}
            </Badge>
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold"
              style={{
                backgroundColor: `${schedule.roomColor}15`,
                color: schedule.roomColor,
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: schedule.roomColor }}
              />
              {schedule.roomName}
            </span>
          </div>
          <DialogTitle className="text-lg sm:text-xl font-bold text-foreground">
            {schedule.title}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground flex flex-wrap items-center gap-2 mt-1">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              {formatDateWithWeekdayBR(schedule.date)}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-primary" />
              {schedule.startTime} às {schedule.endTime}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <User className="h-3.5 w-3.5 text-primary" />
              {schedule.professionalName}
            </span>
          </DialogDescription>
        </DialogHeader>

        {feedback && (
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{feedback}</span>
          </div>
        )}

        {/* Barra de Status e Vagas */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground">Ocupação:</span>
            {isFull ? (
              <Badge variant="destructive" className="text-[10px]">
                Lotada ({occupied}/{schedule.maxCapacity})
              </Badge>
            ) : (
              <Badge variant="success" className="text-[10px]">
                {vacanciesLeft} vaga(s) livre(s) ({occupied}/{schedule.maxCapacity})
              </Badge>
            )}
          </div>

          {!isFull && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                onOpenEnroll(schedule)
                onClose()
              }}
              className="h-7 text-xs px-2.5 gap-1.5 text-primary border-primary/30 hover:bg-primary/5 rounded-lg font-semibold"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>+ Encaixar Paciente</span>
            </Button>
          )}
        </div>

        {/* Lista de Participantes */}
        <div className="space-y-2.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            <span>Alunos / Pacientes Matriculados</span>
            <span className="text-[11px] font-normal lowercase">
              {schedule.participants?.length || 0} cadastrado(s)
            </span>
          </h4>

          {(!schedule.participants || schedule.participants.length === 0) ? (
            <div className="p-6 text-center rounded-xl bg-muted/20 border border-dashed border-border">
              <p className="text-xs text-muted-foreground mb-3">
                Nenhum paciente matriculado neste horário até o momento.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  onOpenEnroll(schedule)
                  onClose()
                }}
                className="gap-1.5 text-xs text-primary border-primary/30"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>Encaixar Paciente Agora</span>
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border/60 rounded-xl border border-border bg-card overflow-hidden">
              {schedule.participants.map((p) => {
                const isAbsentJustified = p.status === "justified_absence"
                const isPresent = p.status === "present"

                return (
                  <div
                    key={p.id}
                    className={`p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isAbsentJustified ? "opacity-50 bg-muted/30" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                        {p.patientName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-xs font-bold text-foreground leading-tight truncate">
                            {p.patientName}
                          </p>
                          {p.status === "replacement" && (
                            <Badge variant="purple" className="text-[9px] px-1.5 py-0">
                              Reposição
                            </Badge>
                          )}
                          {isAbsentJustified && (
                            <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                              Desmarcado
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {p.patientPhone || "Sem telefone"}
                        </p>
                      </div>
                    </div>

                    {/* Ações de Presença, Desmarcação e WhatsApp */}
                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                      {!isAbsentJustified && (
                        <>
                          <Button
                            size="sm"
                            variant={isPresent ? "default" : "outline"}
                            onClick={() =>
                              handleQuickCheckIn(
                                p.id,
                                isPresent ? "scheduled" : "present"
                              )
                            }
                            disabled={loadingActionId === `check_${p.id}`}
                            className={`h-7 px-2 text-[11px] font-semibold gap-1 rounded-lg ${
                              isPresent
                                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                : "text-foreground hover:bg-muted"
                            }`}
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            <span>{isPresent ? "Presente" : "Confirmar"}</span>
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              onOpenCancel(schedule, p)
                              onClose()
                            }}
                            className="h-7 px-2 text-[11px] text-destructive hover:bg-destructive/10 rounded-lg"
                            title="Desmarcar horário e gerar crédito se dentro do prazo"
                          >
                            Desmarcar
                          </Button>
                        </>
                      )}

                      {p.patientPhone && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleQuickWhatsApp(p)}
                          disabled={loadingActionId === `wpp_${p.id}`}
                          className="h-7 w-7 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg"
                          title="Enviar lembrete via WhatsApp"
                        >
                          <Send className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-3 border-t border-border">
          {onNavigateToDay && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onNavigateToDay(schedule.date)
                onClose()
              }}
              className="gap-1.5 text-xs text-primary border-primary/30 hover:bg-primary/5 rounded-xl"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Ver Dia Completo na Agenda</span>
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-xs rounded-xl"
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
