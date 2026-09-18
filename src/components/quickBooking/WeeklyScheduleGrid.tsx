import React, { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { formatProfessionalDisplayName } from '@/lib/professionalUtils';

export interface GridSlot {
  day: string; // YYYY-MM-DD
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  roomId: string;
  roomName: string;
  roomCapacity: number;
  roomColor: string;
  professionalId: string;
  professionalName: string;
  specialty: string;
  scheduleId: string | null;
  scheduleTitle: string | null;
  scheduleType: string | null;
  occupiedSeats: number;
  totalCapacity: number;
  participants: Array<{
    participantId: string;
    patientId: string;
    patientName: string;
    status: string;
  }>;
}

export interface SelectedSlot {
  day: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  roomId: string;
  roomName: string;
  professionalId: string;
  professionalName: string;
  specialty: string;
  scheduleId?: string;
}

interface WeeklyScheduleGridProps {
  dates: string[];
  rooms: Array<{
    id: string;
    name: string;
    color: string;
    capacity: number;
    type: string;
  }>;
  slots: GridSlot[];
  selectedSlots: SelectedSlot[];
  selectedDay: string;
  periodMode?: 'day' | 'week' | 'month';
  onDayChange: (day: string) => void;
  onSlotClick: (slot: GridSlot) => void;
  hasPatientSelected: boolean;
}

const formatDayShort = (dateStr: string) => {
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}`;
  }
  return dateStr;
};

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function WeeklyScheduleGrid({
  dates,
  rooms,
  slots,
  selectedSlots,
  selectedDay,
  periodMode = 'week',
  onDayChange,
  onSlotClick,
  hasPatientSelected,
}: WeeklyScheduleGridProps) {
  // Filtro de sala na visão mobile
  const [selectedMobileRoomId, setSelectedMobileRoomId] = useState<string>('all');

  const visibleRooms = useMemo(() => {
    if (selectedMobileRoomId === 'all') return rooms;
    return rooms.filter((r) => r.id === selectedMobileRoomId);
  }, [rooms, selectedMobileRoomId]);

  // Filter slots for the selected day
  const daySlots = slots.filter((slot) => slot.day === selectedDay);

  // Get unique times for the selected day across all rooms
  const uniqueTimes = useMemo(() => {
    return Array.from(
      new Set(daySlots.map((slot) => `${slot.startTime} - ${slot.endTime}`))
    ).sort();
  }, [daySlots]);

  // Dias do mês para o modo "month"
  const monthDays = useMemo(() => {
    if (periodMode !== 'month') return [];
    const [yearStr, monthStr] = selectedDay.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const totalDays = new Date(year, month, 0).getDate();
    const days: string[] = [];
    for (let d = 1; d <= totalDays; d++) {
      const dStr = String(d).padStart(2, '0');
      const mStr = String(month).padStart(2, '0');
      days.push(`${year}-${mStr}-${dStr}`);
    }
    return days;
  }, [periodMode, selectedDay]);

  return (
    <div className="flex flex-col gap-4">
      {/* ─── VISUALIZAÇÃO DE ABAS TEMPORAIS ─── */}
      {periodMode === 'week' && (
        <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 scrollbar-none snap-x touch-pan-x w-full max-w-full">
          {dates.map((dateStr) => {
            const [y, m, d] = dateStr.split('-').map(Number);
            const dayOfWeek = new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).getUTCDay();
            const dayName = DAY_NAMES[dayOfWeek];
            const isSelected = dateStr === selectedDay;

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => onDayChange(dateStr)}
                className={`flex flex-col items-center justify-center min-w-[62px] sm:min-w-[78px] flex-1 sm:flex-none py-1.5 sm:py-2 px-2 sm:px-3 rounded-xl border transition-all cursor-pointer select-none snap-start shrink-0 sm:shrink ${
                  isSelected
                    ? 'bg-primary text-primary-foreground border-primary shadow-xs font-semibold'
                    : 'bg-card border-border text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                }`}
              >
                <span className="text-[11px] sm:text-xs">{dayName}</span>
                <span className="text-xs sm:text-sm font-bold">{formatDayShort(dateStr)}</span>
              </button>
            );
          })}
        </div>
      )}

      {periodMode === 'month' && (
        <div className="p-3 bg-card border border-border rounded-xl shadow-2xs">
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted-foreground mb-2">
            {DAY_NAMES.map((name) => (
              <div key={name} className="py-1">
                {name}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {/* Offset do primeiro dia */}
            {(() => {
              if (monthDays.length === 0) return null;
              const [y, m, d] = monthDays[0].split('-').map(Number);
              const firstDayOfWeek = new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).getUTCDay();
              return Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} className="h-9" />
              ));
            })()}
            {monthDays.map((dateStr) => {
              const isSelected = dateStr === selectedDay;
              const dayNum = dateStr.split('-')[2];
              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => onDayChange(dateStr)}
                  className={`h-9 flex items-center justify-center rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'hover:bg-muted text-foreground border border-transparent hover:border-border'
                  }`}
                >
                  {parseInt(dayNum, 10)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── FILTRO RÁPIDO DE SALA NO MOBILE (< sm) ─── */}
      {rooms.length > 1 && (
        <div className="block sm:hidden">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5 px-0.5">
            <span className="font-semibold text-foreground">Ambiente / Sala:</span>
            {selectedMobileRoomId === 'all' && (
              <span className="text-[11px] text-primary">Deslize para ver todas ➔</span>
            )}
          </div>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1 touch-pan-x w-full max-w-full">
            <button
              type="button"
              onClick={() => setSelectedMobileRoomId('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all border ${
                selectedMobileRoomId === 'all'
                  ? 'bg-primary text-primary-foreground border-primary shadow-2xs'
                  : 'bg-card border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              Todas as Salas ({rooms.length})
            </button>
            {rooms.map((room) => (
              <button
                key={room.id}
                type="button"
                onClick={() => setSelectedMobileRoomId(room.id)}
                title={room.name}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all border max-w-[170px] truncate ${
                  selectedMobileRoomId === room.id
                    ? 'bg-primary text-primary-foreground border-primary shadow-2xs'
                    : 'bg-card border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {room.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── GRADE DE SALAS E HORÁRIOS ─── */}
      <div className="overflow-x-auto border border-border rounded-xl bg-card shadow-2xs">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              <th className="px-3 sm:px-4 py-2.5 sm:py-3 font-semibold text-foreground/80 w-20 sm:w-24 border-r border-border text-center text-xs sm:text-sm">
                Horário
              </th>
              {visibleRooms.map((room) => (
                <th
                  key={room.id}
                  className="px-3 sm:px-4 py-2.5 sm:py-3 font-semibold text-foreground/80 text-center min-w-[130px] sm:min-w-[150px] border-r border-border last:border-r-0 text-xs sm:text-sm"
                >
                  {room.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {uniqueTimes.length === 0 ? (
              <tr>
                <td colSpan={visibleRooms.length + 1} className="px-4 py-12 text-center text-muted-foreground text-sm">
                  Nenhum horário disponível configurado para este dia.
                </td>
              </tr>
            ) : (
              uniqueTimes.map((timeLabel) => {
                const [startTime, endTime] = timeLabel.split(' - ');
                return (
                  <tr key={timeLabel} className="border-b border-border/60 last:border-b-0 hover:bg-muted/30 transition-colors">
                    <td className="px-2 sm:px-4 py-2 sm:py-3 font-semibold text-foreground/90 border-r border-border text-center whitespace-nowrap text-xs">
                      {startTime}
                    </td>
                    {visibleRooms.map((room) => {
                      const slot = daySlots.find(
                        (s) =>
                          s.roomId === room.id &&
                          s.startTime === startTime &&
                          s.endTime === endTime
                      );

                      if (!slot) {
                        return (
                          <td key={room.id} className="px-4 py-3 text-center text-muted-foreground/30 border-r border-border/60 last:border-r-0">
                            -
                          </td>
                        );
                      }

                      const isSelected = selectedSlots.some(
                        (ss) =>
                          ss.day === slot.day &&
                          ss.roomId === slot.roomId &&
                          ss.startTime === slot.startTime
                      );

                      const isFull = slot.occupiedSeats >= slot.totalCapacity;
                      const isAlmostFull = slot.totalCapacity - slot.occupiedSeats === 1;

                      let badgeClass = 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30';
                      if (isFull) {
                        badgeClass = 'bg-destructive/15 text-destructive border-destructive/30';
                      } else if (isAlmostFull) {
                        badgeClass = 'bg-amber-500/15 text-amber-600 border-amber-500/30';
                      }

                      const profDisplayName = formatProfessionalDisplayName(slot.professionalName);

                      return (
                        <td
                          key={room.id}
                          className="px-2 py-2 border-r border-border/60 last:border-r-0 align-top"
                        >
                          <div
                            onClick={() => {
                              if (hasPatientSelected) {
                                onSlotClick(slot);
                              }
                            }}
                            title={!hasPatientSelected ? 'Selecione um paciente primeiro no painel superior' : slot.professionalName}
                            className={`flex flex-col gap-1 p-2 rounded-lg border transition-all ${
                              isSelected
                                ? 'border-primary bg-primary/10 ring-2 ring-primary/40 shadow-xs'
                                : hasPatientSelected
                                ? 'border-border bg-card hover:border-primary/50 hover:shadow-xs cursor-pointer'
                                : 'border-border/60 bg-muted/40 opacity-70 cursor-not-allowed'
                            }`}
                          >
                            <div className="flex justify-between items-center">
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 font-semibold ${badgeClass}`}>
                                {slot.occupiedSeats}/{slot.totalCapacity}
                              </Badge>
                            </div>
                            <span
                              className="text-[11px] font-medium text-foreground/80 truncate mt-1 leading-tight"
                              title={slot.professionalName}
                            >
                              {profDisplayName}
                            </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
