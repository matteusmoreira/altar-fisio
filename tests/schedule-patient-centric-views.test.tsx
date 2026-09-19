// @vitest-environment jsdom
import React from 'react'
import { test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { MonthlyScheduleView } from '../src/components/schedule/MonthlyScheduleView'
import { WeeklyScheduleView } from '../src/components/schedule/WeeklyScheduleView'
import { PatientScheduleSummaryModal } from '../src/components/schedule/PatientScheduleSummaryModal'
import type { Schedule, ScheduleParticipant } from '../src/types'

afterEach(() => {
  cleanup()
})

const mockParticipant1: ScheduleParticipant = {
  id: 'part_1',
  patientId: 'pat_1',
  patientName: 'Ana Clara Lima',
  patientPhone: '11999991111',
  status: 'scheduled',
  hasActivePackage: true,
  activePackageName: 'Pilates 10 Sessões',
  remainingSessions: 4,
}

const mockParticipant2: ScheduleParticipant = {
  id: 'part_2',
  patientId: 'pat_2',
  patientName: 'Bruno Carvalho',
  patientPhone: '11988882222',
  status: 'present',
  hasActivePackage: false,
}

const mockSchedule1: Schedule = {
  id: 'sched_1',
  title: 'Turma de Pilates',
  type: 'turma',
  specialty: 'pilates',
  roomId: 'room_1',
  roomName: 'Studio Pilates',
  roomColor: '#10b981',
  roomCapacity: 4,
  professionalId: 'prof_1',
  professionalName: 'Dr. Marcelo Henrique',
  date: '2026-09-15',
  startTime: '10:00',
  endTime: '10:50',
  maxCapacity: 4,
  status: 'scheduled',
  participants: [mockParticipant1, mockParticipant2],
}

const mockSchedule2: Schedule = {
  id: 'sched_2',
  title: 'Fisioterapia Individual',
  type: 'individual',
  specialty: 'fisioterapia',
  roomId: 'room_2',
  roomName: 'Consultório 1',
  roomColor: '#3b82f6',
  roomCapacity: 1,
  professionalId: 'prof_1',
  professionalName: 'Dr. Marcelo Henrique',
  date: '2026-09-17',
  startTime: '14:00',
  endTime: '14:50',
  maxCapacity: 1,
  status: 'scheduled',
  participants: [
    {
      id: 'part_3',
      patientId: 'pat_3',
      patientName: 'Carla Souza',
      patientPhone: '11977773333',
      status: 'scheduled',
    },
  ],
}

test('MonthlyScheduleView renders patient names directly in calendar cells and selected day side panel', () => {
  const onSelectPatientSchedule = vi.fn()
  const onCheckIn = vi.fn()

  render(
    <MonthlyScheduleView
      currentDate="2026-09-15"
      schedules={[mockSchedule1, mockSchedule2]}
      onSelectSchedule={vi.fn()}
      onSelectPatientSchedule={onSelectPatientSchedule}
      onCheckIn={onCheckIn}
      onCreateScheduleAtDate={vi.fn()}
      onNavigateToDay={vi.fn()}
      onOpenEnroll={vi.fn()}
    />
  )

  // 1. O nome dos pacientes deve estar visível diretamente na célula do calendário (bater o olho)
  expect(screen.getAllByText(/Ana Clara Lima/i).length).toBeGreaterThanOrEqual(1)
  expect(screen.getAllByText(/Bruno Carvalho/i).length).toBeGreaterThanOrEqual(1)

  // 2. Indicador sutil de vagas livres na célula do dia
  expect(screen.getByText(/\+2 vaga\(s\) livre\(s\)/i)).toBeTruthy()

  // 3. Ao clicar no chip de um paciente na célula do calendário, dispara onSelectPatientSchedule
  const patientChip = screen.getByTitle(/10:00 • Ana Clara Lima/i)
  fireEvent.click(patientChip)
  expect(onSelectPatientSchedule).toHaveBeenCalledWith(mockSchedule1, mockParticipant1)
})

test('WeeklyScheduleView renders patient names in weekday columns and handles direct actions', () => {
  const onSelectPatientSchedule = vi.fn()

  render(
    <WeeklyScheduleView
      currentDate="2026-09-15"
      schedules={[mockSchedule1, mockSchedule2]}
      onSelectSchedule={vi.fn()}
      onSelectPatientSchedule={onSelectPatientSchedule}
      onCreateScheduleAtDate={vi.fn()}
      onOpenEnroll={vi.fn()}
    />
  )

  // 1. Deve exibir o nome do paciente na coluna da terça-feira (2026-09-15)
  expect(screen.getAllByText('Ana Clara Lima').length).toBeGreaterThanOrEqual(1)
  expect(screen.getAllByText('Bruno Carvalho').length).toBeGreaterThanOrEqual(1)

  // 2. Deve exibir Carla Souza na coluna da quinta-feira (2026-09-17)
  expect(screen.getAllByText('Carla Souza').length).toBeGreaterThanOrEqual(1)

  // 3. Botão desmarcar deve disparar onSelectPatientSchedule
  const desmarcarBtns = screen.getAllByRole('button', { name: /Desmarcar/i })
  expect(desmarcarBtns.length).toBeGreaterThanOrEqual(1)
  fireEvent.click(desmarcarBtns[0])
  expect(onSelectPatientSchedule).toHaveBeenCalled()
})

test('PatientScheduleSummaryModal opens with complete details and executes cancel flow', async () => {
  const onCheckIn = vi.fn().mockResolvedValue({ message: 'Presença ok' })
  const onCancel = vi.fn().mockResolvedValue(undefined)
  const onClose = vi.fn()

  render(
    <PatientScheduleSummaryModal
      isOpen={true}
      onClose={onClose}
      schedule={mockSchedule1}
      participant={mockParticipant1}
      onCheckIn={onCheckIn}
      onCancelParticipant={onCancel}
    />
  )

  // 1. Exibe os dados completos do paciente e do agendamento
  expect(screen.getByText('Ana Clara Lima')).toBeTruthy()
  expect(screen.getByText('Studio Pilates')).toBeTruthy()
  expect(screen.getByText('Dr. Marcelo Henrique')).toBeTruthy()
  expect(screen.getByText('Pilates 10 Sessões')).toBeTruthy()
  expect(screen.getByText(/4 rest\./i)).toBeTruthy()

  // 2. Confirmar Presença
  const checkInBtn = screen.getByRole('button', { name: /Confirmar Presença/i })
  fireEvent.click(checkInBtn)
  expect(onCheckIn).toHaveBeenCalledWith('sched_1', 'part_1', 'present')

  // 3. Fluxo de desmarcação: Clicar em Desmarcar abre a confirmação
  const desmarcarBtn = screen.getByRole('button', { name: /^Desmarcar$/i })
  fireEvent.click(desmarcarBtn)

  // Modal de confirmação visível
  expect(screen.getByText('Confirmar Desmarcação')).toBeTruthy()
  expect(screen.getByText(/Tem certeza que deseja desmarcar/i)).toBeTruthy()

  // Confirmar desmarcação
  const confirmBtn = screen.getByRole('button', { name: /Confirmar e Liberar Vaga/i })
  fireEvent.click(confirmBtn)

  await waitFor(() => {
    expect(onCancel).toHaveBeenCalledWith(mockSchedule1, mockParticipant1, 'single', undefined)
  })
})

test('PatientScheduleSummaryModal allows selecting series cancellation scope when schedule is recurring', async () => {
  const onCancel = vi.fn().mockResolvedValue(undefined)
  const recurringSchedule: Schedule = {
    ...mockSchedule1,
    recurringGroupId: 'rec_group_123',
    isRecurring: true,
  }

  render(
    <PatientScheduleSummaryModal
      isOpen={true}
      onClose={vi.fn()}
      schedule={recurringSchedule}
      participant={mockParticipant1}
      onCheckIn={vi.fn()}
      onCancelParticipant={onCancel}
    />
  )

  expect(screen.getByText('Série Recorrente')).toBeTruthy()

  // Clica em desmarcar
  fireEvent.click(screen.getByRole('button', { name: /^Desmarcar$/i }))

  // Verifica opções de escopo
  expect(screen.getByText(/Apenas esta data/i)).toBeTruthy()
  expect(screen.getByText(/Todas as próximas aulas da série/i)).toBeTruthy()

  // Seleciona a opção de série
  const seriesRadio = screen.getByLabelText(/Todas as próximas aulas da série/i)
  fireEvent.click(seriesRadio)

  // Preenche motivo opcional
  const reasonInput = screen.getByPlaceholderText(/Ex: Imprevisto de saúde/i)
  fireEvent.change(reasonInput, { target: { value: 'Mudança de rotina' } })

  // Confirma
  fireEvent.click(screen.getByRole('button', { name: /Confirmar e Liberar Vaga/i }))

  await waitFor(() => {
    expect(onCancel).toHaveBeenCalledWith(
      recurringSchedule,
      mockParticipant1,
      'series',
      'Mudança de rotina'
    )
  })
})

test('MonthlyScheduleView highlights matching patients when patientSearchQuery is provided', () => {
  render(
    <MonthlyScheduleView
      currentDate="2026-09-15"
      schedules={[mockSchedule1, mockSchedule2]}
      onSelectSchedule={vi.fn()}
      onCreateScheduleAtDate={vi.fn()}
      onNavigateToDay={vi.fn()}
      onOpenEnroll={vi.fn()}
      patientSearchQuery="Carla"
    />
  )

  // Carla Souza deve estar presente e ter destaque
  expect(screen.getByText(/Carla Souza/i)).toBeTruthy()
})
