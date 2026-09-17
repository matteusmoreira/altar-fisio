import React, { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  CalendarDays,
  Clock,
  ArrowLeftRight,
  CalendarX,
  Repeat,
  MapPin,
  Stethoscope,
  AlertTriangle,
} from 'lucide-react'
import { formatProfessionalDisplayName } from '@/lib/professionalUtils'
import type { UpcomingAppointment } from './RescheduleScopeDialog'

const SHORT_DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

interface PatientUpcomingSessionsCardProps {
  patientName: string
  appointments: UpcomingAppointment[]
  onRescheduleClick: (appointment: UpcomingAppointment) => void
  onCancelClick: (appointment: UpcomingAppointment) => Promise<void>
  isCancelling?: boolean
}

export function PatientUpcomingSessionsCard({
  patientName,
  appointments,
  onRescheduleClick,
  onCancelClick,
  isCancelling = false,
}: PatientUpcomingSessionsCardProps) {
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null)

  if (!appointments || appointments.length === 0) {
    return null
  }

  const handleConfirmCancel = async (apt: UpcomingAppointment) => {
    try {
      await onCancelClick(apt)
    } finally {
      setConfirmCancelId(null)
    }
  }

  return (
    <Card className="border-border/80 shadow-xs bg-card/60 backdrop-blur-xs">
      <CardHeader className="p-3.5 pb-2.5 border-b border-border/50 flex flex-row items-center justify-between">
        <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-primary" />
          <span>Próximas Sessões de {patientName} ({appointments.length})</span>
        </CardTitle>
        <span className="text-[11px] text-muted-foreground">
          Clique em Remarcar para trocar de horário
        </span>
      </CardHeader>

      <CardContent className="p-3.5 pt-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {appointments.map((apt) => {
            const [y, m, d] = apt.date.split('-').map(Number)
            const dateObj = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
            const dayName = SHORT_DAY_NAMES[dateObj.getUTCDay()]
            const formattedDate = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`
            const isConfirmingThis = confirmCancelId === apt.participantId

            return (
              <div
                key={apt.participantId}
                className="p-3 rounded-xl border border-border bg-card hover:border-primary/40 transition-all flex flex-col justify-between relative overflow-hidden shadow-2xs group"
              >
                {/* Faixa lateral com cor da sala */}
                <div
                  className="absolute top-0 left-0 bottom-0 w-1.5"
                  style={{ backgroundColor: apt.roomColor || 'var(--primary)' }}
                />

                <div className="pl-1.5 space-y-1.5">
                  {/* Topo do Card: Data e Badge */}
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-primary" />
                      <span>{dayName}, {formattedDate} às {apt.startTime}</span>
                    </span>

                    {apt.isRecurring ? (
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0 h-4 gap-1 bg-indigo-500/10 text-indigo-600 border-indigo-500/20 font-medium"
                      >
                        <Repeat className="w-2.5 h-2.5" />
                        <span>Turma Fixa</span>
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 h-4 text-muted-foreground"
                      >
                        Avulso
                      </Badge>
                    )}
                  </div>

                  {/* Detalhes: Especialidade, Sala e Profissional */}
                  <div className="text-[11px] text-muted-foreground space-y-0.5 pt-0.5">
                    <div className="flex items-center gap-1 text-foreground font-medium truncate capitalize">
                      <span>{apt.specialty}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground truncate">
                      <span className="flex items-center gap-0.5 truncate">
                        <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span className="truncate">{apt.roomName}</span>
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-0.5 truncate">
                        <Stethoscope className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span className="truncate">{formatProfessionalDisplayName(apt.professionalName)}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Botões de Ação */}
                <div className="pt-2.5 mt-2 border-t border-border/50 pl-1.5">
                  {isConfirmingThis ? (
                    <div className="space-y-1.5 bg-destructive/5 p-2 rounded-lg border border-destructive/20">
                      <div className="text-[11px] font-semibold text-destructive flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        <span>Confirmar desmarcação?</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        A vaga será liberada imediatamente para a clínica.
                      </p>
                      <div className="flex items-center gap-1.5 pt-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={isCancelling}
                          onClick={() => handleConfirmCancel(apt)}
                          className="h-6 text-[10px] px-2 font-bold"
                        >
                          {isCancelling ? 'Liberando...' : 'Sim, Desmarcar'}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={isCancelling}
                          onClick={() => setConfirmCancelId(null)}
                          className="h-6 text-[10px] px-2 text-muted-foreground"
                        >
                          Voltar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onRescheduleClick(apt)}
                        className="flex-1 h-7 text-xs font-semibold text-amber-600 dark:text-amber-500 border-amber-500/30 hover:bg-amber-500/10 hover:border-amber-500/50 gap-1"
                      >
                        <ArrowLeftRight className="w-3.5 h-3.5" />
                        <span>Remarcar</span>
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirmCancelId(apt.participantId)}
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        title="Desmarcar aula e liberar vaga"
                      >
                        <CalendarX className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
