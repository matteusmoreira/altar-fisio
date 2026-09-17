import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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
  onDayChange: (day: string) => void;
  onSlotClick: (slot: GridSlot) => void;
  hasPatientSelected: boolean;
}

const formatDayShort = (dateStr: string) => {
  const d = new Date(`${dateStr}T12:00:00Z`);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function WeeklyScheduleGrid({
  dates,
  rooms,
  slots,
  selectedSlots,
  selectedDay,
  onDayChange,
  onSlotClick,
  hasPatientSelected,
}: WeeklyScheduleGridProps) {
  // Filter slots for the selected day
  const daySlots = slots.filter((slot) => slot.day === selectedDay);

  // Get unique times for the selected day across all rooms
  const uniqueTimes = Array.from(
    new Set(daySlots.map((slot) => `${slot.startTime} - ${slot.endTime}`))
  ).sort();

  return (
    <div className="flex flex-col gap-4">
      {/* Day Selector Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {dates.map((dateStr) => {
          const d = new Date(`${dateStr}T12:00:00Z`);
          const dayName = DAY_NAMES[d.getDay()];
          const isSelected = dateStr === selectedDay;

          return (
            <button
              key={dateStr}
              onClick={() => onDayChange(dateStr)}
              className={`flex flex-col items-center justify-center min-w-[80px] p-2 rounded-md border transition-colors ${
                isSelected
                  ? 'bg-primary/10 border-primary text-primary font-medium'
                  : 'bg-card border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              <span className="text-sm">{dayName}</span>
              <span className="text-xs">{formatDayShort(dateStr)}</span>
            </button>
          );
        })}
      </div>

      {/* Grid */}
      <div className="overflow-x-auto border border-border rounded-md bg-card">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-600 w-24 border-r">Horário</th>
              {rooms.map((room) => (
                <th key={room.id} className="px-4 py-3 font-medium text-gray-600 text-center min-w-[150px] border-r last:border-r-0">
                  {room.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {uniqueTimes.length === 0 ? (
              <tr>
                <td colSpan={rooms.length + 1} className="px-4 py-8 text-center text-gray-500">
                  Nenhum horário disponível neste dia.
                </td>
              </tr>
            ) : (
              uniqueTimes.map((timeLabel) => {
                const [startTime, endTime] = timeLabel.split(' - ');
                return (
                  <tr key={timeLabel} className="border-b last:border-b-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-700 border-r text-center whitespace-nowrap">
                      {startTime}
                    </td>
                    {rooms.map((room) => {
                      const slot = daySlots.find(
                        (s) =>
                          s.roomId === room.id &&
                          s.startTime === startTime &&
                          s.endTime === endTime
                      );

                      if (!slot) {
                        return (
                          <td key={room.id} className="px-4 py-3 text-center text-gray-300 border-r last:border-r-0">
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

                      let badgeColor = 'bg-green-100 text-green-700 border-green-200';
                      if (isFull) {
                        badgeColor = 'bg-red-100 text-red-700 border-red-200';
                      } else if (isAlmostFull) {
                        badgeColor = 'bg-yellow-100 text-yellow-700 border-yellow-200';
                      }

                      return (
                        <td
                          key={room.id}
                          className="px-2 py-2 border-r last:border-r-0 align-top"
                        >
                          <div
                            onClick={() => {
                              if (hasPatientSelected) {
                                onSlotClick(slot);
                              }
                            }}
                            title={!hasPatientSelected ? 'Selecione um paciente primeiro' : ''}
                            className={`flex flex-col gap-1 p-2 rounded border cursor-pointer transition-all ${
                              isSelected
                                ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                                : hasPatientSelected
                                ? 'border-gray-200 bg-white hover:border-gray-300 shadow-sm'
                                : 'border-gray-200 bg-gray-50 opacity-70 cursor-not-allowed'
                            }`}
                          >
                            <div className="flex justify-between items-center">
                              <Badge variant="outline" className={`text-[10px] px-1 py-0 h-4 ${badgeColor}`}>
                                {slot.occupiedSeats}/{slot.totalCapacity}
                              </Badge>
                            </div>
                            <span className="text-[11px] text-gray-600 truncate mt-1 leading-tight" title={slot.professionalName}>
                              {slot.professionalName.split(' ')[0]}
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
