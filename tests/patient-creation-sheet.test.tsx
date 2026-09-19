// @vitest-environment jsdom
import React from 'react'
import { test, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { PatientProfileModal } from '../src/components/patients/PatientProfileModal'
import { PatientsPage } from '../src/pages/PatientsPage'
import { formatDateTimeBR } from '../src/lib/dateUtils'
import { api } from '@convex/_generated/api'

const mocks = vi.hoisted(() => ({
  role: 'admin',
  storedSchedules: [] as any[],
  healthOptions: ['Particular', 'Unimed'] as string[],
  customFields: [] as any[],
  addPatient: vi.fn(),
  updatePatient: vi.fn(),
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ role: mocks.role, isAuthenticated: true, token: 'test' }),
}))

vi.mock('@/lib/staffConvex', () => ({
  useQuery: (fn: any, args: any) => {
    if (args === 'skip') return undefined
    if (args && typeof args === 'object' && 'patientId' in args) {
      return mocks.storedSchedules
    }
    if (args && typeof args === 'object' && 'professionalId' in args) {
      return []
    }
    return mocks.healthOptions
  },
  useMutation: () => vi.fn(),
  useAction: () => vi.fn(),
}))

vi.mock('@/contexts/ClinicDataContext', () => ({
  useClinicData: () => ({
    patients: [],
    patientPackages: [],
    packages: [],
    replacementCredits: [],
    transactions: [],
    clinicalReports: [],
    clinicalOverview: [],
    getClinicalRecord: vi.fn(),
    getEvolutions: vi.fn(),
    addPatient: mocks.addPatient,
    updatePatient: mocks.updatePatient,
    deletePatient: vi.fn(),
  }),
}))

beforeEach(() => {
  mocks.role = 'admin'
  mocks.storedSchedules = []
  mocks.addPatient.mockReset()
  mocks.updatePatient.mockReset()
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

test('PatientProfileModal displays registration date and time across header, overview cards and print sheet', () => {
  const fixedTimestamp = new Date('2026-09-19T14:35:00-03:00').getTime()
  const expectedFormatted = formatDateTimeBR(fixedTimestamp)

  const patient = {
    id: 'pat_123',
    name: 'Carlos Alberto Silva',
    phone: '11988887777',
    birthDate: '1985-05-15',
    healthInsurance: 'Unimed',
    active: true,
    createdAt: fixedTimestamp,
  }

  render(
    <PatientProfileModal
      patient={patient}
      isOpen={true}
      onClose={vi.fn()}
      onEdit={vi.fn()}
      onNavigateToClinical={vi.fn()}
    />
  )

  // 1. Cabeçalho do modal
  const headerRegistration = screen.getByText(new RegExp(`Cadastrado em:\\s*${expectedFormatted}`))
  expect(headerRegistration).toBeTruthy()

  // 2. Card Identificação & Contatos
  expect(screen.getByText('Data e Hora do Cadastro')).toBeTruthy()

  // 3. Ficha de Impressão / Card Convênio
  const allInstances = screen.getAllByText(expectedFormatted)
  expect(allInstances.length).toBeGreaterThanOrEqual(2)

  // 4. Garante ausência de blocos desnecessários de endereço e emergência para novos pacientes
  expect(screen.queryByText('Endereço não cadastrado')).toBeNull()
  expect(screen.queryByText('Contato de Emergência')).toBeNull()
})

test('PatientProfileModal renders legacy address and emergency contact when present', () => {
  const fixedTimestamp = new Date('2026-09-19T10:00:00-03:00').getTime()

  const legacyPatient = {
    id: 'pat_legacy',
    name: 'Dona Maria Antiga',
    phone: '21977776666',
    birthDate: '1960-03-20',
    cep: '22790-702',
    address: 'Av das Américas, 500',
    emergencyContact: 'Filho João',
    emergencyPhone: '21988880000',
    healthInsurance: 'Particular',
    active: true,
    createdAt: fixedTimestamp,
  }

  render(
    <PatientProfileModal
      patient={legacyPatient}
      isOpen={true}
      onClose={vi.fn()}
      onEdit={vi.fn()}
      onNavigateToClinical={vi.fn()}
    />
  )

  expect(screen.getAllByText(/Av das Américas, 500/).length).toBeGreaterThanOrEqual(1)
  expect(screen.getAllByText(/Filho João/).length).toBeGreaterThanOrEqual(1)
})

test('creating patient submits without CEP/emergency and opens patient profile sheet with registration time', async () => {
  const createdId = 'patient_new_999'
  mocks.addPatient.mockResolvedValue(createdId)

  render(<PatientsPage onNavigateToClinical={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Novo Paciente' }))

  // Preenche nome e telefone
  fireEvent.change(screen.getByPlaceholderText('Nome do paciente'), {
    target: { value: 'Lucas Pereira' },
  })
  fireEvent.change(screen.getByPlaceholderText('(11) 98888-8888'), {
    target: { value: '11977778888' },
  })

  // Clica em cadastrar
  fireEvent.click(screen.getByRole('button', { name: 'Cadastrar Paciente' }))

  await waitFor(() => expect(mocks.addPatient).toHaveBeenCalledTimes(1))

  expect(mocks.addPatient).toHaveBeenCalledWith(
    expect.objectContaining({
      name: 'Lucas Pereira',
      phone: '(11) 97777-8888',
      healthInsurance: 'Particular',
    })
  )

  const submittedPayload = mocks.addPatient.mock.calls[0][0]
  expect(submittedPayload.cep).toBeUndefined()
  expect(submittedPayload.address).toBeUndefined()
  expect(submittedPayload.emergencyContact).toBeUndefined()
  expect(submittedPayload.emergencyPhone).toBeUndefined()

  // A Ficha do Paciente foi aberta exibindo o nome e a data/hora de cadastro
  await waitFor(() => {
    expect(screen.getAllByText('Lucas Pereira').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/Cadastrado em:/)).toBeTruthy()
  })
})
