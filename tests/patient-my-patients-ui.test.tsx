// @vitest-environment jsdom
import React from 'react'
import { test, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  user: { id: 'u1', role: 'professional', professionalId: 'prof-marcelo', name: 'Dr. Marcelo' } as any,
  role: 'professional',
  assignedIds: ['p1'] as string[] | undefined,
  healthOptions: ['Particular'] as string[],
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mocks.user,
    role: mocks.role,
    isProfessional: mocks.role === 'professional',
  }),
}))

vi.mock('@/lib/staffConvex', () => ({
  useAction: () => vi.fn(),
  useQuery: (fn: any, args: any) => {
    if (args && args.professionalId) return mocks.assignedIds
    return mocks.healthOptions
  },
  useMutation: () => vi.fn(),
}))

vi.mock('@/components/patients/PatientProfileModal', () => ({ PatientProfileModal: () => null }))

vi.mock('@/contexts/ClinicDataContext', () => ({
  useClinicData: () => ({
    patients: [
      { id: 'p1', name: 'Paciente do Dr. Marcelo', documentCpf: '11111111111', phone: '11911111111', birthDate: '1990-01-01', active: true },
      { id: 'p2', name: 'Paciente de Outro Profissional', documentCpf: '22222222222', phone: '11922222222', birthDate: '1991-01-01', active: true },
    ],
    professionals: [
      { id: 'prof-marcelo', name: 'Dr. Marcelo', active: true },
      { id: 'prof-stefanie', name: 'Dra. Stefanie', active: true },
    ],
    clinicalOverview: [],
    addPatient: vi.fn(),
    updatePatient: vi.fn(),
    deletePatient: vi.fn(),
  }),
}))

import { PatientsPage } from '../src/pages/PatientsPage'

beforeEach(() => {
  mocks.user = { id: 'u1', role: 'professional', professionalId: 'prof-marcelo', name: 'Dr. Marcelo' }
  mocks.role = 'professional'
  mocks.assignedIds = ['p1']
  const entries = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => entries.set(key, value),
    removeItem: (key: string) => entries.delete(key),
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

test('professional sees "Meus Pacientes" active by default and filters assigned patients', () => {
  render(<PatientsPage onNavigateToClinical={vi.fn()} />)

  // O botão Meus Pacientes deve estar presente
  const myPatientsBtn = screen.getByRole('button', { name: /Meus Pacientes/i })
  expect(myPatientsBtn).toBeTruthy()

  // Deve listar Paciente do Dr. Marcelo
  expect(screen.getByText('Paciente do Dr. Marcelo')).toBeTruthy()
  // Não deve listar o paciente do outro profissional
  expect(screen.queryByText('Paciente de Outro Profissional')).toBeNull()

  // Ao clicar em Meus Pacientes, desativa o filtro e lista todos
  fireEvent.click(myPatientsBtn)
  expect(screen.getByText('Paciente de Outro Profissional')).toBeTruthy()
  expect(screen.getByText('Paciente do Dr. Marcelo')).toBeTruthy()

  // Clicando novamente, reativa o filtro
  fireEvent.click(myPatientsBtn)
  expect(screen.getByText('Paciente do Dr. Marcelo')).toBeTruthy()
  expect(screen.queryByText('Paciente de Outro Profissional')).toBeNull()
})

test('admin sees professional selector dropdown and can view all or specific professional patients', () => {
  mocks.role = 'admin'
  mocks.user = { id: 'admin1', role: 'admin', name: 'Administrador' }

  render(<PatientsPage onNavigateToClinical={vi.fn()} />)

  // Admin vê o dropdown de profissionais
  const profSelect = screen.getByDisplayValue('Todos os Profissionais')
  expect(profSelect).toBeTruthy()

  // Por padrão mostra todos
  expect(screen.getByText('Paciente do Dr. Marcelo')).toBeTruthy()
  expect(screen.getByText('Paciente de Outro Profissional')).toBeTruthy()

  // Seleciona Dr. Marcelo
  fireEvent.change(profSelect, { target: { value: 'prof-marcelo' } })

  // Filtra para o Dr. Marcelo
  expect(screen.getByText('Paciente do Dr. Marcelo')).toBeTruthy()
  expect(screen.queryByText('Paciente de Outro Profissional')).toBeNull()
})
