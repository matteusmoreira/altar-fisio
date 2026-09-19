// @vitest-environment jsdom
import React from 'react'
import { test, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { PatientProfileModal } from '../src/components/patients/PatientProfileModal'

const mocks = vi.hoisted(() => ({
  role: 'admin',
  storedSchedules: [] as any[],
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
  }),
}))

beforeEach(() => {
  mocks.role = 'admin'
  mocks.storedSchedules = []
})

afterEach(() => {
  cleanup()
})

const testPatient = {
  id: 'patient_1',
  name: 'Matteus Moreira',
  documentCpf: '14322094775',
  phone: '22999021889',
  birthDate: '2000-01-01',
  active: true,
  createdAt: Date.now(),
}

test('renders upcoming sessions in Visão Geral and identifies recurring series as Turma Fixa', () => {
  mocks.storedSchedules = [
    {
      _id: 'sched_1',
      title: 'Fisioterapia 08:00',
      type: 'individual',
      specialty: 'fisioterapia',
      roomId: 'room_1',
      roomName: 'Sala Pilates',
      roomColor: '#10b981',
      professionalId: 'prof_1',
      professionalName: 'Dr. Marcelo',
      date: '2026-09-21',
      startTime: '08:00',
      endTime: '08:50',
      recurringGroupId: 'rec_series_1',
      isRecurring: true,
      participants: [
        {
          _id: 'part_1',
          patientId: 'patient_1',
          status: 'scheduled',
        },
      ],
    },
    {
      _id: 'sched_2',
      title: 'Fisioterapia 08:00',
      type: 'individual',
      specialty: 'fisioterapia',
      roomId: 'room_1',
      roomName: 'Sala Pilates',
      roomColor: '#10b981',
      professionalId: 'prof_1',
      professionalName: 'Dr. Marcelo',
      date: '2026-09-23',
      startTime: '08:00',
      endTime: '08:50',
      recurringGroupId: 'rec_series_1',
      isRecurring: true,
      participants: [
        {
          _id: 'part_2',
          patientId: 'patient_1',
          status: 'scheduled',
        },
      ],
    },
  ]

  render(
    <PatientProfileModal
      patient={testPatient as any}
      isOpen={true}
      onClose={() => {}}
      onEdit={() => {}}
    />
  )

  // 1. Deve exibir o paciente
  expect(screen.getAllByText('Matteus Moreira').length).toBeGreaterThanOrEqual(1)

  // 2. Deve exibir o card de Próximas Sessões Marcadas na Visão Geral
  expect(screen.getByText(/Próximas Sessões Marcadas \(2\)/i)).toBeTruthy()
  expect(screen.getAllByText(/Sala Pilates/i).length).toBeGreaterThanOrEqual(1)
  expect(screen.getAllByText(/Dr\. Marcelo/i).length).toBeGreaterThanOrEqual(1)

  // 3. No KPI superior, deve reconhecer a turma fixa como Seg e Qua 08:00 (em vez de Avulso)
  expect(screen.getAllByText(/Seg e Qua/i).length).toBeGreaterThanOrEqual(1)
})

test('renders friendly empty state when patient has no upcoming sessions', () => {
  mocks.storedSchedules = []

  render(
    <PatientProfileModal
      patient={testPatient as any}
      isOpen={true}
      onClose={() => {}}
      onEdit={() => {}}
    />
  )

  expect(screen.getByText(/Nenhuma sessão futura agendada/i)).toBeTruthy()
  expect(screen.getByText(/Avulso \/ Sem turma/i)).toBeTruthy()
})

test('posiciona o acesso ao portal e redefinição de senha no rodapé como última opção na Visão Geral', () => {
  render(
    <PatientProfileModal
      patient={testPatient as any}
      isOpen={true}
      onClose={() => {}}
      onEdit={() => {}}
    />
  )

  const contactsSection = screen.getByText(/Identificação & Contatos/i)
  const upcomingSection = screen.getByText(/Próximas Sessões Marcadas/i)
  const portalSection = screen.getByRole('heading', { name: /Acesso ao Portal & Redefinição de Senha/i })

  expect(portalSection).toBeTruthy()
  // Confere a ordem no DOM: Identificação -> Próximas Sessões -> Acesso ao Portal (última opção)
  expect(contactsSection.compareDocumentPosition(portalSection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(upcomingSection.compareDocumentPosition(portalSection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

