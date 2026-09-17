import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Calendar, Repeat, ArrowRight } from 'lucide-react'
import { formatDateBR } from '@/lib/dateUtils'

export interface UpcomingAppointment {
  participantId: string
  scheduleId: string
  date: string
  startTime: string
  endTime: string
  roomId: string
  roomName: string
  roomColor: string
  professionalId: string
  professionalName: string
  specialty: string
  isRecurring: boolean
  recurringGroupId?: string
  status: string
}

interface RescheduleScopeDialogProps {
  open: boolean
  onClose: () => void
  appointment: UpcomingAppointment | null
  onSelectScope: (scope: 'single' | 'series') => void
}

export function RescheduleScopeDialog({
  open,
  onClose,
  appointment,
  onSelectScope,
}: RescheduleScopeDialogProps) {
  if (!appointment) return null

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <Repeat className="w-5 h-5 text-primary" />
            Remarcação de Turma Recorrente
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Esta aula de <strong>{formatDateBR(appointment.date)} às {appointment.startTime}</strong> faz parte de uma turma/série semanal fixa.
            Como deseja efetuar a remarcação?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          {/* Opção 1: Apenas esta aula */}
          <button
            type="button"
            onClick={() => onSelectScope('single')}
            className="w-full text-left p-3.5 rounded-xl border border-border bg-card hover:bg-muted/50 hover:border-primary/50 transition-all flex items-start gap-3 group cursor-pointer"
          >
            <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0 mt-0.5">
              <Calendar className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                Apenas esta data ({formatDateBR(appointment.date)})
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Troca somente esta sessão pontual. As próximas semanas continuam normalmente no dia e horário habitual do paciente.
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 self-center" />
          </button>

          {/* Opção 2: Mudar a série para todas as próximas semanas */}
          <button
            type="button"
            onClick={() => onSelectScope('series')}
            className="w-full text-left p-3.5 rounded-xl border border-border bg-card hover:bg-muted/50 hover:border-primary/50 transition-all flex items-start gap-3 group cursor-pointer"
          >
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white transition-colors shrink-0 mt-0.5">
              <Repeat className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-foreground group-hover:text-indigo-500 transition-colors">
                Mudar dia fixo para todas as próximas semanas
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Altera esta aula e todos os encontros futuros desta turma para o novo dia da semana e horário escolhido.
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all shrink-0 self-center" />
          </button>
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
