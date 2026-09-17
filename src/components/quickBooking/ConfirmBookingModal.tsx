import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { SelectedSlot } from './WeeklyScheduleGrid';

interface ConfirmBookingModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  patientName: string;
  selectedSlots: SelectedSlot[];
  isRecurring: boolean;
  month: string | null;
  totalSessions: number;
  isLoading: boolean;
}

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const formatDayShort = (dateStr: string) => {
  const d = new Date(`${dateStr}T12:00:00Z`);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

const formatMonth = (monthStr: string) => {
  if (!monthStr) return '';
  const [year, month] = monthStr.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
};

export function ConfirmBookingModal({
  open,
  onClose,
  onConfirm,
  patientName,
  selectedSlots,
  isRecurring,
  month,
  totalSessions,
  isLoading,
}: ConfirmBookingModalProps) {
  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirmar Agendamento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <h4 className="text-sm font-medium text-gray-500">Paciente</h4>
            <p className="text-base font-semibold text-gray-900">{patientName}</p>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-500 mb-2">Horários Selecionados</h4>
            <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2">
              {selectedSlots.map((slot, index) => {
                const dateObj = new Date(`${slot.day}T12:00:00Z`);
                const dayName = DAY_NAMES[dateObj.getDay()];
                
                return (
                  <div key={index} className="bg-gray-50 p-3 rounded-lg border border-gray-200 text-sm">
                    <div className="flex justify-between items-start font-medium text-gray-900 mb-1">
                      <span>{dayName}, {formatDayShort(slot.day)}</span>
                      <span>{slot.startTime} - {slot.endTime}</span>
                    </div>
                    <div className="text-gray-600">
                      <p>{slot.roomName}</p>
                      <p className="text-xs">{slot.professionalName}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {isRecurring && month && (
            <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-sm border border-blue-100 flex flex-col gap-1">
              <span className="font-medium flex items-center gap-2">
                <span>🔁</span> Recorrência mensal: <span className="capitalize">{formatMonth(month)}</span>
              </span>
              <span>Total estimado: {totalSessions} sessões no mês</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button 
            onClick={onConfirm} 
            disabled={isLoading}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {isLoading ? 'Confirmando...' : 'Confirmar Agendamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
