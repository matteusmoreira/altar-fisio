// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { accessPolicy } from '../shared/accessPolicy'
import {
  PatientUpcomingSessionsCard,
} from '../src/components/quickBooking/PatientUpcomingSessionsCard'
import {
  RescheduleScopeDialog,
  type UpcomingAppointment,
} from '../src/components/quickBooking/RescheduleScopeDialog'

describe('Quick Booking Rescheduling & Cancellation', () => {
  afterEach(() => {
    cleanup()
  })
  it('has rescheduleSeriesParticipant and cancelQuickBookingParticipant registered in accessPolicy for admin and reception', () => {
    const rescheduleSeriesPolicy = accessPolicy['quickBooking:rescheduleSeriesParticipant']
    expect(rescheduleSeriesPolicy).toBeTruthy()
    expect(rescheduleSeriesPolicy).toContain('admin')
    expect(rescheduleSeriesPolicy).toContain('reception')

    const cancelPolicy = accessPolicy['quickBooking:cancelQuickBookingParticipant']
    expect(cancelPolicy).toBeTruthy()
    expect(cancelPolicy).toContain('admin')
    expect(cancelPolicy).toContain('reception')
  })

  it('renders PatientUpcomingSessionsCard with session information and handles Remarcar click', () => {
    const onRescheduleClick = vi.fn()
    const onCancelClick = vi.fn()

    const mockAppointments: UpcomingAppointment[] = [
      {
        participantId: 'part-1',
        scheduleId: 'sch-1',
        date: '2026-09-22',
        startTime: '08:00',
        endTime: '08:50',
        roomId: 'room-1',
        roomName: 'Studio Pilates',
        roomColor: '#10b981',
        professionalId: 'prof-1',
        professionalName: 'Dr. Marcelo Santos',
        specialty: 'pilates',
        isRecurring: true,
        recurringGroupId: 'rec-123',
        status: 'scheduled',
      },
      {
        participantId: 'part-2',
        scheduleId: 'sch-2',
        date: '2026-09-25',
        startTime: '14:00',
        endTime: '14:50',
        roomId: 'room-2',
        roomName: 'Consultório 1',
        roomColor: '#3b82f6',
        professionalId: 'prof-2',
        professionalName: 'Claudia Silva',
        specialty: 'fisioterapia',
        isRecurring: false,
        status: 'scheduled',
      },
    ]

    render(
      <PatientUpcomingSessionsCard
        patientName="João da Silva"
        appointments={mockAppointments}
        onRescheduleClick={onRescheduleClick}
        onCancelClick={onCancelClick}
      />
    )

    // Header
    expect(screen.getByText(/Próximas Sessões de João da Silva/i)).toBeTruthy()
    expect(screen.getByText(/\(2\)/i)).toBeTruthy()

    // Turma fixa vs avulso
    expect(screen.getByText('Turma Fixa')).toBeTruthy()
    expect(screen.getByText('Avulso')).toBeTruthy()

    // Detalhes dos profissionais formatados
    expect(screen.getByText('Dr Marcelo')).toBeTruthy()
    expect(screen.getByText('Claudia')).toBeTruthy()

    // Botões de remarcar
    const rescheduleBtns = screen.getAllByRole('button', { name: /Remarcar/i })
    expect(rescheduleBtns.length).toBe(2)

    fireEvent.click(rescheduleBtns[0])
    expect(onRescheduleClick).toHaveBeenCalledWith(mockAppointments[0])
  })

  it('handles cancellation confirmation workflow in PatientUpcomingSessionsCard', async () => {
    const onRescheduleClick = vi.fn()
    const onCancelClick = vi.fn().mockResolvedValue(undefined)

    const mockAppointments: UpcomingAppointment[] = [
      {
        participantId: 'part-1',
        scheduleId: 'sch-1',
        date: '2026-09-22',
        startTime: '08:00',
        endTime: '08:50',
        roomId: 'room-1',
        roomName: 'Studio Pilates',
        roomColor: '#10b981',
        professionalId: 'prof-1',
        professionalName: 'Dra. Larissa Moreira',
        specialty: 'pilates',
        isRecurring: false,
        status: 'scheduled',
      },
    ]

    render(
      <PatientUpcomingSessionsCard
        patientName="Maria Oliveira"
        appointments={mockAppointments}
        onRescheduleClick={onRescheduleClick}
        onCancelClick={onCancelClick}
      />
    )

    // Clica no botão de desmarcar (ícone)
    const cancelIconBtn = screen.getByTitle('Desmarcar aula e liberar vaga')
    fireEvent.click(cancelIconBtn)

    // Pergunta de confirmação de segurança
    expect(screen.getByText('Confirmar desmarcação?')).toBeTruthy()
    expect(screen.getByText('A vaga será liberada imediatamente para a clínica.')).toBeTruthy()

    // Confirma a desmarcação
    const confirmBtn = screen.getByRole('button', { name: /Sim, Desmarcar/i })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(onCancelClick).toHaveBeenCalledWith(mockAppointments[0])
    })
  })

  it('renders RescheduleScopeDialog and allows selecting single date or series scope', () => {
    const onSelectScope = vi.fn()
    const onClose = vi.fn()

    const appointment: UpcomingAppointment = {
      participantId: 'part-rec',
      scheduleId: 'sch-rec',
      date: '2026-09-22',
      startTime: '08:00',
      endTime: '08:50',
      roomId: 'room-1',
      roomName: 'Studio Pilates',
      roomColor: '#10b981',
      professionalId: 'prof-1',
      professionalName: 'Dr. Marcelo',
      specialty: 'pilates',
      isRecurring: true,
      recurringGroupId: 'rec-xyz',
      status: 'scheduled',
    }

    const { rerender } = render(
      <RescheduleScopeDialog
        open={true}
        onClose={onClose}
        appointment={appointment}
        onSelectScope={onSelectScope}
      />
    )

    expect(screen.getByText('Remarcação de Turma Recorrente')).toBeTruthy()
    expect(screen.getByText(/Apenas esta data \(22\/09\/2026\)/i)).toBeTruthy()
    expect(screen.getByText(/Mudar dia fixo para todas as próximas semanas/i)).toBeTruthy()

    // Clica em "Apenas esta data"
    const singleOption = screen.getByText(/Apenas esta data \(22\/09\/2026\)/i)
    fireEvent.click(singleOption)
    expect(onSelectScope).toHaveBeenCalledWith('single')

    // Rerender e clica em "Mudar dia fixo"
    rerender(
      <RescheduleScopeDialog
        open={true}
        onClose={onClose}
        appointment={appointment}
        onSelectScope={onSelectScope}
      />
    )

    const seriesOption = screen.getByText(/Mudar dia fixo para todas as próximas semanas/i)
    fireEvent.click(seriesOption)
    expect(onSelectScope).toHaveBeenCalledWith('series')
  })
})
