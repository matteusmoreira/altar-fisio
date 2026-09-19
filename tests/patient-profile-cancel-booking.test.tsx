// @vitest-environment jsdom
import React from 'react'
import { test, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { PatientProfileModal } from '../src/components/patients/PatientProfileModal'

const mocks = vi.hoisted(() => ({
  role: 'admin',
  storedSchedules: [] as any[],
  removeParticipantFromSchedule: vi.fn(),
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ role: mocks.role, isAuthenticated: true, token: 'test' }),
}))

vi.mock('@/lib/staffConvex', () => ({
  useQuery: (fn: any, args: any) => {
    if (args === 'skip') return undefined
    return mocks.storedSchedules
  },
  useMutation: () => vi.fn(),
  useAction: () => vi.fn(),
}))

vi.mock('@/contexts/ClinicDataContext', () => ({
  useClinicData: () => ({
    patientPackages: [],
    packages: [],
    replacementCredits: [],
    transactions: [],
    clinicalReports: [],
    getClinicalRecord: vi.fn(),
    getEvolutions: vi.fn(),
    removeParticipantFromSchedule: mocks.removeParticipantFromSchedule,
  }),
}))

beforeEach(() => {
  mocks.role = 'admin'
  mocks.storedSchedules = []
  mocks.removeParticipantFromSchedule.mockReset()
})

afterEach(() => {
  cleanup()
})

const testPatient = {
  id: 'patient_moreira',
  name: 'Moreira 2',
  phone: '22999021889',
  birthDate: '2000-01-01',
  healthInsurance: 'Particular',
  active: true,
  createdAt: Date.now(),
}

const mockSchedules = [
  {
    _id: 'sched_1',
    title: 'Pilates e Fortalecimento Muscular 09:00',
    type: 'turma',
    specialty: 'pilates',
    roomId: 'room_pilates',
    roomName: 'Pilates e Fortalecimento Muscular',
    roomColor: '#10b981',
    professionalId: 'prof_daniele',
    professionalName: 'Daniele Silvestre',
    date: '2026-09-25',
    startTime: '09:00',
    endTime: '09:30',
    recurringGroupId: 'rec_group_1',
    isRecurring: true,
    participants: [
      {
        _id: 'part_1',
        patientId: 'patient_moreira',
        status: 'scheduled',
      },
    ],
  },
  {
    _id: 'sched_2',
    title: 'Turma 1 - 08:00 às 8:30',
    type: 'turma',
    specialty: 'pilates',
    roomId: 'room_pilates',
    roomName: 'Pilates e Fortalecimento Muscular',
    roomColor: '#10b981',
    professionalId: 'prof_daniele',
    professionalName: 'Daniele Silvestre',
    date: '2026-09-21',
    startTime: '08:00',
    endTime: '08:30',
    recurringGroupId: 'rec_group_1',
    isRecurring: true,
    participants: [
      {
        _id: 'part_2',
        patientId: 'patient_moreira',
        status: 'present',
      },
    ],
  },
]

test('renders Desmarcar button in Visão Geral upcoming cards and in Turmas & Presenças table', () => {
  mocks.storedSchedules = mockSchedules

  render(
    <PatientProfileModal
      patient={testPatient as any}
      isOpen={true}
      onClose={() => {}}
      onEdit={() => {}}
    />
  )

  // 1. Na aba Visão Geral (padrão), o card da sessão futura agendada possui o botão Desmarcar
  const desmarcarOverviewButtons = screen.getAllByRole('button', { name: /Desmarcar/i })
  expect(desmarcarOverviewButtons.length).toBeGreaterThanOrEqual(1)

  // 2. Navega para a aba "Turmas & Presenças" via atalho
  const viewClassesBtn = screen.getByText(/Ver todas na aba Turmas/i)
  fireEvent.click(viewClassesBtn)

  // 3. Na tabela de Turmas & Presenças, existe o cabeçalho "Ações" e o botão "Desmarcar" para a aula agendada
  expect(screen.getByText('Ações')).toBeTruthy()
  expect(screen.getByText('Histórico de Atendimentos & Aulas')).toBeTruthy()

  const allDesmarcarButtons = screen.getAllByRole('button', { name: /Desmarcar/i })
  expect(allDesmarcarButtons.length).toBeGreaterThanOrEqual(1)
})

test('clicking Desmarcar opens confirmation dialog and calls removeParticipantFromSchedule on confirm', async () => {
  mocks.storedSchedules = mockSchedules
  mocks.removeParticipantFromSchedule.mockResolvedValue(undefined)

  render(
    <PatientProfileModal
      patient={testPatient as any}
      isOpen={true}
      onClose={() => {}}
      onEdit={() => {}}
    />
  )

  // Clica no botão Desmarcar do card de próxima sessão
  const desmarcarButton = screen.getAllByRole('button', { name: /Desmarcar/i })[0]
  fireEvent.click(desmarcarButton)

  // Modal de confirmação deve abrir com título e detalhes da sessão
  expect(screen.getByText('Desmarcar Atendimento')).toBeTruthy()
  expect(screen.getByText(/Confirme a desmarcação para liberar a vaga imediatamente na clínica/i)).toBeTruthy()
  expect(screen.getByText(/Ao desmarcar, os lembretes automáticos do WhatsApp serão cancelados/i)).toBeTruthy()
  expect(screen.getByRole('button', { name: /Sim, Desmarcar/i })).toBeTruthy()

  // Clica em "Sim, Desmarcar"
  const confirmButton = screen.getByRole('button', { name: /Sim, Desmarcar/i })
  fireEvent.click(confirmButton)

  // Deve chamar removeParticipantFromSchedule com scheduleId e participantId
  await waitFor(() => {
    expect(mocks.removeParticipantFromSchedule).toHaveBeenCalledTimes(1)
    expect(mocks.removeParticipantFromSchedule).toHaveBeenCalledWith('sched_1', 'part_1')
  })

  // Toast de sucesso deve ser exibido
  await waitFor(() => {
    expect(screen.getByText(/desmarcado com sucesso\. Vaga liberada!/i)).toBeTruthy()
  })
})
