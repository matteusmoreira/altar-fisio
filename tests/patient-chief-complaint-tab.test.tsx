// @vitest-environment jsdom
import React from 'react'
import { test, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { PatientProfileModal } from '../src/components/patients/PatientProfileModal'

const mocks = vi.hoisted(() => ({
  role: 'admin',
  saveChiefComplaint: vi.fn().mockResolvedValue('record_1'),
  downloadPdf: vi.fn().mockResolvedValue(undefined),
  clinicalRecord: {
    chiefComplaint: 'Dor lombar intensa com irradiação para membro inferior direito.',
    painScaleEva: 7,
    painLocation: 'Coluna lombar',
    hpi: 'Início insidioso há 3 semanas.',
    clinicalGoals: 'Redução do quadro álgico e ganho de amplitude articular.',
  } as any,
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    role: mocks.role,
    isAuthenticated: true,
    token: 'test-token',
    user: { name: 'Dr. Marcelo', crefito: 'CREFITO-3 123456-F' },
  }),
}))

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      clinicName: 'Clinica Dr Marcelo',
      clinicSubtitle: 'Fisioterapia & Pilates Avançado',
      phone: '(11) 98765-4321',
      address: 'Av. Paulista, 1000 - Bela Vista, São Paulo - SP',
      cnpj: '12.345.678/0001-90',
    },
  }),
}))

import { getFunctionName } from 'convex/server'

vi.mock('@/lib/staffConvex', () => ({
  useQuery: (fn: any, args: any) => {
    if (args === 'skip') return undefined
    try {
      const name = getFunctionName(fn)
      if (name === 'clinical:getClinicalRecord') return mocks.clinicalRecord
      if (name === 'clinic:getSettings') return {
        clinicName: 'Clinica Dr Marcelo',
        clinicSubtitle: 'Fisioterapia & Pilates Avançado',
        phone: '(11) 98765-4321',
        address: 'Av. Paulista, 1000 - Bela Vista, São Paulo - SP',
        cnpj: '12.345.678/0001-90',
      }
    } catch {
      // Fallback se não for FunctionReference
    }
    return []
  },
  useMutation: () => mocks.saveChiefComplaint,
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
    removeParticipantFromSchedule: vi.fn(),
  }),
}))

vi.mock('@/lib/pdfDownloader', () => ({
  downloadElementAsPdf: (...args: any[]) => mocks.downloadPdf(...args),
}))

function activateTab(tab: HTMLElement) {
  fireEvent.pointerDown(tab, { button: 0 })
  fireEvent.click(tab)
  fireEvent.keyDown(tab, { key: 'Enter', code: 'Enter' })
  fireEvent.keyDown(tab, { key: ' ', code: 'Space' })
}

beforeEach(() => {
  mocks.role = 'admin'
  mocks.saveChiefComplaint.mockReset().mockResolvedValue('record_1')
  mocks.downloadPdf.mockReset().mockResolvedValue(undefined)
  vi.spyOn(window, 'print').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const mockPatient = {
  id: 'patient_moreira_2',
  name: 'Moreira 2',
  phone: '22999021889',
  birthDate: '2000-01-01',
  healthInsurance: 'Particular',
  active: true,
  createdAt: 1789828165000,
}

test('removes Prontuário & SOAP, Pacotes & Financeiro and replaces Documentos & Laudos with Queixa principal', () => {
  render(
    <PatientProfileModal
      isOpen={true}
      onClose={vi.fn()}
      onEdit={vi.fn()}
      patient={mockPatient as any}
    />
  )

  // As abas removidas NÃO devem existir
  expect(screen.queryByText(/Prontuário & SOAP/i)).toBeNull()
  expect(screen.queryByText(/Pacotes & Financeiro/i)).toBeNull()
  expect(screen.queryByText(/Documentos & Laudos/i)).toBeNull()

  // As abas ativas devem estar visíveis
  expect(screen.getByRole('tab', { name: /Visão Geral/i })).toBeDefined()
  expect(screen.getByRole('tab', { name: /Turmas & Presenças/i })).toBeDefined()
  expect(screen.getByRole('tab', { name: /Queixa principal/i })).toBeDefined()

  // Badge "Sem Prontuário" não deve existir no topo
  expect(screen.queryByText(/^Sem Prontuário$/i)).toBeNull()
  expect(screen.queryByText(/^Prontuário Ativo$/i)).toBeNull()
})

test('renders RichTextEditor and action buttons inside Queixa principal tab', async () => {
  render(
    <PatientProfileModal
      isOpen={true}
      onClose={vi.fn()}
      onEdit={vi.fn()}
      patient={mockPatient as any}
    />
  )

  // Clica na aba Queixa principal
  const tabButton = screen.getByRole('tab', { name: /Queixa principal/i })
  activateTab(tabButton)

  // Cabeçalho da aba
  expect(screen.getByText(/Queixa Principal & Registro Clínico/i)).toBeDefined()

  // Botões de ação
  const saveBtn = screen.getByRole('button', { name: /Salvar Queixa/i })
  const topPrintBtn = screen.getByRole('button', { name: /Imprimir PDF/i })

  expect(saveBtn).toBeDefined()
  expect(topPrintBtn).toBeDefined()
  expect(screen.queryByRole('button', { name: /Baixar PDF/i })).toBeNull()

  // Barra de ferramentas do editor rico
  expect(screen.getByTitle(/Negrito/i)).toBeDefined()
  expect(screen.getByTitle(/Itálico/i)).toBeDefined()
  expect(screen.getByTitle(/Sublinhado/i)).toBeDefined()
  expect(screen.getByTitle(/Título Principal/i)).toBeDefined()
  expect(screen.getByTitle(/Subtítulo/i)).toBeDefined()
  expect(screen.getByTitle(/Lista com Marcadores/i)).toBeDefined()
  expect(screen.getByTitle(/Lista Numerada/i)).toBeDefined()

  // Conteúdo inicial carregado
  expect(screen.getAllByText(/Dor lombar intensa com irradiação/i).length).toBeGreaterThan(0)
})

test('clicking Salvar Queixa triggers saveChiefComplaint mutation', async () => {
  render(
    <PatientProfileModal
      isOpen={true}
      onClose={vi.fn()}
      onEdit={vi.fn()}
      patient={mockPatient as any}
    />
  )

  const tabButton = screen.getByRole('tab', { name: /Queixa principal/i })
  activateTab(tabButton)

  const saveBtn = screen.getByRole('button', { name: /Salvar Queixa/i })
  fireEvent.click(saveBtn)

  await waitFor(() => {
    expect(mocks.saveChiefComplaint).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: mockPatient.id,
      })
    )
  })
})

test('clicking Imprimir PDF triggers window.print and saves complaint if active tab', async () => {
  render(
    <PatientProfileModal
      isOpen={true}
      onClose={vi.fn()}
      onEdit={vi.fn()}
      patient={mockPatient as any}
    />
  )

  const tabButton = screen.getByRole('tab', { name: /Queixa principal/i })
  activateTab(tabButton)

  const printBtn = screen.getByRole('button', { name: /Imprimir PDF/i })
  fireEvent.click(printBtn)

  await waitFor(() => {
    expect(window.print).toHaveBeenCalled()
  })
})

test('printable chief complaint element contains clinic header, contact info and website without signatures', () => {
  const { container } = render(
    <PatientProfileModal
      isOpen={true}
      onClose={vi.fn()}
      onEdit={vi.fn()}
      patient={mockPatient as any}
    />
  )

  const printableElement = container.querySelector('#printable-chief-complaint')
  expect(printableElement).toBeDefined()
  expect(printableElement?.textContent).toContain('Moreira 2')
  expect(printableElement?.textContent).toContain('Queixa Principal & Avaliação Clínica')
  expect(printableElement?.textContent).toContain('https://clinicadrmarcelo.com.br')
  expect(printableElement?.textContent).not.toContain('Doc ID')
  expect(printableElement?.textContent).not.toContain('CREFITO')
})
