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
import { Input } from "@/components/ui/input"
import {
  Calendar,
  User,
  Send,
  CheckCircle2,
  FileText,
  Trash2,
  Repeat,
  Phone,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react"
import { formatDateWithWeekdayBR, formatDateBR } from "@/lib/dateUtils"
import { formatPhoneBR } from "@/lib/utils"

interface PatientScheduleSummaryModalProps {
  isOpen: boolean
  onClose: () => void
  schedule: Schedule | null
  participant: ScheduleParticipant | null
  onCheckIn: (
    scheduleId: string,
    participantId: string,
    status: "present" | "absence" | "scheduled"
  ) => Promise<any>
  onCancelParticipant: (
    schedule: Schedule,
    participant: ScheduleParticipant,
    scope: "single" | "series",
    reason?: string
  ) => Promise<any>
  onSendWhatsApp?: (
    schedule: Schedule,
    participant: { name: string; phone: string }
  ) => Promise<any>
  onOpenPatientProfile?: (patientId: string) => void
}

export const PatientScheduleSummaryModal: React.FC<PatientScheduleSummaryModalProps> = ({
  isOpen,
  onClose,
  schedule,
  participant,
  onCheckIn,
  onCancelParticipant,
  onSendWhatsApp,
  onOpenPatientProfile,
}) => {
  const [isConfirmingCancel, setIsConfirmingCancel] = useState(false)
  const [cancelScope, setCancelScope] = useState<"single" | "series">("single")
  const [cancelReason, setCancelReason] = useState("")
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false)
  const [isSubmittingCheckIn, setIsSubmittingCheckIn] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const feedbackTimerRef = React.useRef<NodeJS.Timeout | null>(null)

  React.useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
    }
  }, [])

  if (!schedule || !participant) return null

  const isRecurring = Boolean(schedule.recurringGroupId || schedule.isRecurring)
  const isPresent = participant.status === "present"
  const isAbsent = participant.status === "absence"
  const isJustified = participant.status === "justified_absence"
  const isReplacement = participant.status === "replacement"

  const triggerFeedback = (msg: string) => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
    setFeedback(msg)
    feedbackTimerRef.current = setTimeout(() => setFeedback(null), 3000)
  }

  const handleToggleCheckIn = async () => {
    setIsSubmittingCheckIn(true)
    try {
      const nextStatus = isPresent ? "scheduled" : "present"
      const res = await onCheckIn(schedule.id, participant.id, nextStatus)
      triggerFeedback(res?.message || (nextStatus === "present" ? "Presença confirmada com sucesso!" : "Presença desfeita."))
    } catch (err: any) {
      alert(err?.message || "Erro ao atualizar presença.")
    } finally {
      setIsSubmittingCheckIn(false)
    }
  }

  const handleWhatsApp = async () => {
    if (!participant.patientPhone) {
      alert("Paciente sem telefone cadastrado.")
      return
    }
    if (onSendWhatsApp) {
      try {
        await onSendWhatsApp(schedule, {
          name: participant.patientName,
          phone: participant.patientPhone,
        })
        triggerFeedback(`Lembrete WhatsApp enviado para ${participant.patientName}!`)
      } catch (err: any) {
        alert(err?.message || "Erro ao disparar WhatsApp.")
      }
    } else {
      const clean = participant.patientPhone.replace(/\D/g, "")
      const msg = encodeURIComponent(
        `Olá ${participant.patientName}, confirmamos seu agendamento em ${formatDateBR(schedule.date)} às ${schedule.startTime}. Clínica Dr Marcelo.`
      )
      window.open(`https://wa.me/55${clean}?text=${msg}`, "_blank")
    }
  }

  const handleExecuteCancel = async () => {
    setIsSubmittingCancel(true)
    try {
      await onCancelParticipant(schedule, participant, cancelScope, cancelReason.trim() || undefined)
      setIsConfirmingCancel(false)
      setCancelReason("")
      onClose()
    } catch (err: any) {
      // Se onCancelParticipant lançar erro, o modal permanece aberto com o feedback de erro do alert
    } finally {
      setIsSubmittingCancel(false)
    }
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setIsConfirmingCancel(false)
          setCancelReason("")
          onClose()
        }
      }}
    >
      <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl p-5 sm:p-6 border-border">
        {feedback && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2 animate-fade-in mb-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span className="font-semibold">{feedback}</span>
          </div>
        )}

        <DialogHeader className="pr-6 space-y-1">
          <div className="flex items-start gap-3.5">
            <div className="h-12 w-12 rounded-2xl bg-primary/15 text-primary flex items-center justify-center font-bold text-lg shadow-2xs shrink-0">
              {participant.patientName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-base sm:text-lg font-bold text-foreground truncate">
                  {participant.patientName}
                </DialogTitle>
                {isPresent && (
                  <Badge className="bg-emerald-600/15 text-emerald-600 border-emerald-600/30 text-[10px] px-2 py-0">
                    Presente
                  </Badge>
                )}
                {isAbsent && (
                  <Badge className="bg-destructive/15 text-destructive border-destructive/30 text-[10px] px-2 py-0">
                    Falta
                  </Badge>
                )}
                {isJustified && (
                  <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 text-[10px] px-2 py-0">
                    Falta Justificada
                  </Badge>
                )}
                {isReplacement && (
                  <Badge className="bg-purple-500/15 text-purple-600 border-purple-500/30 text-[10px] px-2 py-0">
                    Reposição
                  </Badge>
                )}
                {!isPresent && !isAbsent && !isJustified && !isReplacement && (
                  <Badge variant="outline" className="text-[10px] px-2 py-0 text-primary border-primary/30">
                    Agendado
                  </Badge>
                )}
              </div>
              <DialogDescription className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                <Phone className="h-3 w-3" />
                <span>{participant.patientPhone ? formatPhoneBR(participant.patientPhone) : "Sem telefone"}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* MODO DE CONFIRMAÇÃO DE DESMARCAÇÃO */}
        {isConfirmingCancel ? (
          <div className="mt-4 p-4 rounded-2xl bg-destructive/5 border border-destructive/20 space-y-4 animate-fade-in">
            <div className="flex items-center gap-2 text-destructive font-bold text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Confirmar Desmarcação</span>
            </div>
            <p className="text-xs text-foreground/80 leading-relaxed">
              Tem certeza que deseja desmarcar <strong>{participant.patientName}</strong> do horário das{" "}
              <strong>{schedule.startTime}</strong> no dia <strong>{formatDateBR(schedule.date)}</strong>? A vaga será
              liberada imediatamente para novos pacientes.
            </p>

            {isRecurring && (
              <div className="p-3 rounded-xl bg-background border border-border space-y-2">
                <label className="block text-xs font-semibold text-foreground">
                  Este horário faz parte de uma série/turma recorrente. Escolha o escopo:
                </label>
                <div className="space-y-1.5 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="cancelScope"
                      checked={cancelScope === "single"}
                      onChange={() => setCancelScope("single")}
                      className="text-primary focus:ring-primary h-3.5 w-3.5"
                    />
                    <span className="text-foreground">Apenas esta data ({formatDateBR(schedule.date)})</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="cancelScope"
                      checked={cancelScope === "series"}
                      onChange={() => setCancelScope("series")}
                      className="text-primary focus:ring-primary h-3.5 w-3.5"
                    />
                    <span className="text-foreground font-semibold text-destructive">
                      Todas as próximas aulas da série
                    </span>
                  </label>
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="block text-xs font-medium text-foreground">
                Motivo da desmarcação (opcional):
              </label>
              <Input
                placeholder="Ex: Imprevisto de saúde, viagem..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="text-xs h-8"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsConfirmingCancel(false)}
                disabled={isSubmittingCancel}
                className="h-8 text-xs rounded-xl"
              >
                Voltar
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleExecuteCancel}
                disabled={isSubmittingCancel}
                className="h-8 text-xs rounded-xl font-bold gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{isSubmittingCancel ? "Desmarcando..." : "Confirmar e Liberar Vaga"}</span>
              </Button>
            </div>
          </div>
        ) : (
          /* RESUMO DETALHADO DO AGENDAMENTO */
          <div className="space-y-3.5 mt-4">
            {/* Grid de Informações Principais */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-muted/40 border border-border/80 space-y-1">
                <span className="text-muted-foreground flex items-center gap-1 text-[11px] font-medium">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                  <span>Data & Horário</span>
                </span>
                <div className="font-bold text-foreground text-xs">
                  {formatDateWithWeekdayBR(schedule.date)}
                </div>
                <div className="text-primary font-semibold text-xs">
                  {schedule.startTime} às {schedule.endTime}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-muted/40 border border-border/80 space-y-1">
                <span className="text-muted-foreground flex items-center gap-1 text-[11px] font-medium">
                  <User className="h-3.5 w-3.5 text-primary" />
                  <span>Profissional & Sala</span>
                </span>
                <div className="font-bold text-foreground text-xs truncate">
                  {schedule.professionalName}
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground font-medium text-xs">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: schedule.roomColor }}
                  />
                  <span className="truncate">{schedule.roomName}</span>
                </div>
              </div>
            </div>

            {/* Modalidade / Tratamento e Tipo */}
            <div className="p-3 rounded-xl bg-muted/30 border border-border/80 flex items-center justify-between gap-2 text-xs">
              <div>
                <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">
                  Modalidade / Turma
                </span>
                <h4 className="font-bold text-foreground text-xs leading-snug">
                  {schedule.title}
                </h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {schedule.specialty.toUpperCase()} • {schedule.type === "turma" ? "Turma em Grupo" : "Individual"}
                </p>
              </div>

              {isRecurring && (
                <Badge variant="outline" className="gap-1 text-[10px] text-primary border-primary/30 shrink-0">
                  <Repeat className="h-3 w-3" />
                  <span>Série Recorrente</span>
                </Badge>
              )}
            </div>

            {/* Plano & Pacote do Paciente */}
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <span className="font-bold text-foreground text-xs">
                    {participant.hasActivePackage
                      ? participant.activePackageName || "Pacote Ativo"
                      : isReplacement
                      ? "Aula de Reposição"
                      : "Atendimento Avulso"}
                  </span>
                  <p className="text-[11px] text-muted-foreground">
                    {participant.remainingSessions !== undefined
                      ? `${participant.remainingSessions} sessão(ões) restante(s)`
                      : isReplacement
                      ? "Vaga preenchida via reposição de aula"
                      : "Sem pacote de sessões vinculado"}
                  </p>
                </div>
              </div>

              {participant.hasActivePackage && participant.remainingSessions !== undefined && (
                <Badge
                  variant={participant.remainingSessions <= 2 ? "warning" : "success"}
                  className="text-[10px] font-bold shrink-0"
                >
                  {participant.remainingSessions} rest.
                </Badge>
              )}
            </div>

            {/* BARRA DE AÇÕES RÁPIDAS */}
            <div className="pt-2 border-t border-border flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Check-in / Presença */}
                <Button
                  type="button"
                  size="sm"
                  variant={isPresent ? "default" : "outline"}
                  onClick={handleToggleCheckIn}
                  disabled={isSubmittingCheckIn}
                  className={`h-8 text-xs font-semibold gap-1.5 rounded-xl ${
                    isPresent
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{isPresent ? "Presença Marcada" : "Confirmar Presença"}</span>
                </Button>

                {/* WhatsApp */}
                {participant.patientPhone && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleWhatsApp}
                    className="h-8 text-xs font-semibold gap-1.5 rounded-xl text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border-emerald-500/30"
                    title="Enviar confirmação / lembrete via WhatsApp"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>WhatsApp</span>
                  </Button>
                )}

                {/* Ficha Clínica */}
                {onOpenPatientProfile && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      onOpenPatientProfile(participant.patientId)
                      onClose()
                    }}
                    className="h-8 text-xs font-semibold gap-1.5 rounded-xl text-muted-foreground hover:text-foreground"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>Ver Ficha</span>
                  </Button>
                )}
              </div>

              {/* Botão de Desmarcar */}
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => setIsConfirmingCancel(true)}
                className="h-8 text-xs font-bold gap-1.5 rounded-xl"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Desmarcar</span>
              </Button>
            </div>
          </div>
        )}

        <DialogFooter className="pt-2 border-t border-border mt-2">
          <Button
            type="button"
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
