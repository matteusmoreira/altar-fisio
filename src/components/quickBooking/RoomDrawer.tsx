import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, User, Check, AlertCircle, Clock, MapPin, Stethoscope } from 'lucide-react';
import type { GridSlot, SelectedSlot } from './WeeklyScheduleGrid';
import { formatDateBR } from '@/lib/dateUtils';
import { formatSpecialtyName } from '../../../shared/clinicalSpecialties';

interface RoomDrawerProps {
  open: boolean;
  onClose: () => void;
  slot: GridSlot | null;
  selectedPatientName: string | null;
  onAllocatePatient: (slot: SelectedSlot) => void;
  onReschedulePatient: (participantId: string, patientName: string, patientId?: string) => void;
  onAddToWaitlist: (slot: GridSlot) => void;
  isSlotSelected: boolean;
  isRescheduling?: boolean;
}

export function RoomDrawer({
  open,
  onClose,
  slot,
  selectedPatientName,
  onAllocatePatient,
  onReschedulePatient,
  onAddToWaitlist,
  isSlotSelected,
  isRescheduling = false,
}: RoomDrawerProps) {
  if (!slot) return null;

  const isFull = slot.occupiedSeats >= slot.totalCapacity;
  const isIndividual = slot.totalCapacity === 1;
  const chairs = Array.from({ length: slot.totalCapacity });

  // Map participants to chairs
  const occupiedChairs = slot.participants.map((p, index) => ({
    ...p,
    chairIndex: index,
  }));

  const handleAllocate = () => {
    onAllocatePatient({
      day: slot.day,
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      roomId: slot.roomId,
      roomName: slot.roomName,
      professionalId: slot.professionalId,
      professionalName: slot.professionalName,
      specialty: slot.specialty,
      scheduleId: slot.scheduleId || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b border-border pb-3">
          <div className="flex items-center justify-between pr-8">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              {slot.roomName}
            </DialogTitle>
            <Badge
              variant="outline"
              className={
                isFull
                  ? 'bg-destructive/10 text-destructive border-destructive/20 font-semibold'
                  : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-semibold'
              }
            >
              {isFull ? 'Lotado' : `${slot.totalCapacity - slot.occupiedSeats} vaga(s) livre(s)`}
            </Badge>
          </div>

          <DialogDescription asChild>
            <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
              <span className="flex items-center gap-1 font-medium text-foreground">
                <Clock className="w-3.5 h-3.5 text-primary" />
                {formatDateBR(slot.day)} • {slot.startTime} às {slot.endTime}
              </span>
              <span className="flex items-center gap-1">
                <Stethoscope className="w-3.5 h-3.5 text-primary" />
                {slot.professionalName}
              </span>
              <span>
                Especialidade: <strong>{formatSpecialtyName(slot.specialty, null, slot.roomName)}</strong>
              </span>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {isSlotSelected && (
            <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-primary font-medium">
                <Check className="w-4 h-4 text-primary" />
                <span>Horário adicionado à seleção para agendamento.</span>
              </div>
            </div>
          )}

          {/* MODO INDIVIDUAL (1 vaga) */}
          {isIndividual ? (
            <div className="p-5 rounded-2xl border border-border bg-card space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                    Atendimento Individual (1:1)
                  </span>
                  <h4 className="text-base font-bold text-foreground mt-0.5">
                    {slot.occupiedSeats > 0 ? 'Horário Ocupado' : 'Horário Disponível'}
                  </h4>
                </div>
                <Badge
                  className={
                    slot.occupiedSeats > 0
                      ? 'bg-amber-500/15 text-amber-600 border-amber-500/20'
                      : 'bg-emerald-500/15 text-emerald-600 border-emerald-500/20'
                  }
                >
                  {slot.occupiedSeats > 0 ? 'Ocupado' : 'Livre'}
                </Badge>
              </div>

              {slot.participants.length > 0 ? (
                <div className="p-3.5 bg-muted/60 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-sm">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {slot.participants[0].patientName}
                      </p>
                      <p className="text-xs text-muted-foreground">Paciente Agendado</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      onReschedulePatient(
                        slot.participants[0].participantId,
                        slot.participants[0].patientName,
                        slot.participants[0].patientId
                      )
                    }
                    className="text-xs font-semibold text-amber-600 border-amber-500/30 hover:bg-amber-500/10"
                  >
                    Remarcar Paciente
                  </Button>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground mb-4">
                    Este horário individual está livre para o paciente selecionado.
                  </p>
                  <Button
                    onClick={handleAllocate}
                    disabled={isSlotSelected}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {isSlotSelected
                      ? 'Horário Já Selecionado'
                      : isRescheduling
                      ? `Transferir ${selectedPatientName || 'Paciente'} para cá`
                      : `Alocar ${selectedPatientName || 'Paciente'}`}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            /* MODO TURMA (CADEIRAS) */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Cadeiras / Aparelhos da Sala ({slot.occupiedSeats}/{slot.totalCapacity})
                </h4>
                <span className="text-xs text-muted-foreground">
                  Clique numa cadeira livre para reservar
                </span>
              </div>

              <div
                className={`grid gap-3 ${
                  slot.totalCapacity <= 4
                    ? 'grid-cols-2 sm:grid-cols-4'
                    : slot.totalCapacity <= 6
                    ? 'grid-cols-3 sm:grid-cols-3'
                    : 'grid-cols-3 sm:grid-cols-4'
                }`}
              >
                {chairs.map((_, index) => {
                  const participant = occupiedChairs.find((p) => p.chairIndex === index);

                  if (participant) {
                    return (
                      <div
                        key={`chair-${index}`}
                        className="flex flex-col items-center justify-between p-3 rounded-2xl bg-muted/60 border border-border text-center min-h-[115px]"
                      >
                        <div className="w-9 h-9 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-xs">
                          🪑 {index + 1}
                        </div>
                        <span
                          className="text-xs font-semibold text-foreground truncate w-full mt-1"
                          title={participant.patientName}
                        >
                          {participant.patientName.split(' ')[0]}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            onReschedulePatient(
                              participant.participantId,
                              participant.patientName,
                              participant.patientId
                            )
                          }
                          className="text-[11px] h-6 px-2 text-amber-600 hover:text-amber-700 hover:bg-amber-500/10 mt-1"
                        >
                          Remarcar
                        </Button>
                      </div>
                    );
                  }

                  return (
                    <button
                      key={`chair-${index}`}
                      type="button"
                      onClick={handleAllocate}
                      disabled={isSlotSelected}
                      className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 border-dashed transition-all min-h-[115px] ${
                        isSlotSelected
                          ? 'border-border bg-muted/20 opacity-40 cursor-not-allowed'
                          : 'border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/15 hover:border-emerald-500 cursor-pointer text-emerald-600 group'
                      }`}
                    >
                      <div className="w-9 h-9 rounded-full bg-emerald-500/15 group-hover:bg-emerald-500/25 flex items-center justify-center font-bold text-xs mb-1">
                        <Plus className="w-4 h-4 text-emerald-600" />
                      </div>
                      <span className="text-xs font-semibold text-foreground">
                        {isRescheduling ? `Transferir Vaga ${index + 1}` : `Vaga ${index + 1}`}
                      </span>
                      <span className="text-[10px] text-muted-foreground mt-0.5">
                        {isSlotSelected ? 'Selecionado' : 'Disponível'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* AVISO DE LOTAÇÃO + FILA DE ESPERA */}
          {isFull && (
            <div className="mt-4 p-4 border border-destructive/20 bg-destructive/5 rounded-2xl flex flex-col items-center gap-2 text-center">
              <div className="flex items-center gap-2 text-destructive font-bold text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>Horário com Capacidade Máxima Atingida</span>
              </div>
              <p className="text-xs text-muted-foreground max-w-sm">
                Não há vagas disponíveis neste momento. Você pode colocar o paciente na fila de espera para ser encaixado automaticamente caso alguém desmarque.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-1 border-destructive/30 hover:bg-destructive/10 text-destructive font-semibold"
                onClick={() => onAddToWaitlist(slot)}
              >
                Adicionar à Fila de Espera
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
