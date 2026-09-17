// @vitest-environment jsdom
import React from 'react'
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { DocumentGeneratorModal } from '../src/components/clinical/DocumentGeneratorModal'
import { ThemeProvider } from '../src/contexts/ThemeContext'
import type { Patient, Professional } from '../src/types'

let currentMockSettings = {
  mode: 'light',
  colorPreset: 'emerald',
  primaryColor: '#10b981',
  clinicName: 'Clínica de Fisioterapia Dr Marcelo',
  clinicSubtitle: 'RPG | Pilates | Fisioterapia',
  logoUrl: undefined as string | undefined,
  phone: '(19) 99876-5432',
  address: 'Rua das Palmeiras, 500, Centro, Campinas - SP',
  cnpj: '12.345.678/0001-99',
}

vi.mock('convex/react', () => ({
  useQuery: vi.fn(() => currentMockSettings),
  useMutation: vi.fn(() => vi.fn()),
  useAction: vi.fn(() => vi.fn()),
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: { name: 'Dr. Marcelo', role: 'admin' },
    role: 'admin',
    canAccessSection: () => true,
    logout: vi.fn(),
    login: vi.fn(),
    isAuthenticated: true,
    token: 'test-token',
  })),
}))

const mockPatient: Patient = {
  id: 'p1' as any,
  name: 'Matteus Moreira',
  documentCpf: '123.456.789-00',
  phone: '11987654321',
  birthDate: '1990-01-01',
  active: true,
  createdAt: Date.now(),
}

const mockProfessional: Professional = {
  id: 'prof1' as any,
  name: 'Dr. Marcelo Santos',
  email: 'marcelo@altarfisio.com.br',
  phone: '11999999999',
  crefito: 'CREFITO-3 / 184520-F',
  specialties: ['fisioterapia', 'pilates'],
  commissionType: 'percentage',
  commissionValue: 50,
  active: true,
}

describe('Central de Emissão de Documentos Clínicos - Dados da Clínica Dinâmicos', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    })
    currentMockSettings = {
      mode: 'light',
      colorPreset: 'emerald',
      primaryColor: '#10b981',
      clinicName: 'Clínica de Fisioterapia Dr Marcelo',
      clinicSubtitle: 'RPG | Pilates | Fisioterapia',
      logoUrl: undefined,
      phone: '(19) 99876-5432',
      address: 'Rua das Palmeiras, 500, Centro, Campinas - SP',
      cnpj: '12.345.678/0001-99',
    }
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  test('renderiza no cabeçalho timbrado os dados reais da clínica configurada', () => {
    render(
      <ThemeProvider>
        <DocumentGeneratorModal
          open={true}
          onOpenChange={vi.fn()}
          patient={mockPatient}
          professionals={[mockProfessional]}
          currentProfessional={mockProfessional}
        />
      </ThemeProvider>
    )

    // CNPJ configurado deve estar presente
    expect(screen.getByText(/CNPJ: 12\.345\.678\/0001-99/i)).toBeTruthy()

    // Telefone configurado deve estar presente
    expect(screen.getByText(/Tel\/WhatsApp: \(19\) 99876-5432/i)).toBeTruthy()

    // Endereço configurado deve estar presente
    expect(screen.getByText(/Rua das Palmeiras, 500, Centro/i)).toBeTruthy()
    expect(screen.getAllByText(/Campinas - SP/i).length).toBeGreaterThanOrEqual(2)

    // Nome e subtítulo da clínica configurada devem estar presentes
    expect(screen.getByRole('heading', { name: /Clínica de Fisioterapia Dr Marcelo/i })).toBeTruthy()
    expect(screen.getByText(/RPG \| Pilates \| Fisioterapia/i)).toBeTruthy()

    // Valores mockados antigos NÃO podem aparecer
    expect(screen.queryByText(/45\.123\.789\/0001-90/i)).toBeNull()
    expect(screen.queryByText(/\(11\) 99123-4567/i)).toBeNull()
    expect(screen.queryByText(/Cj\. 42 • Bela Vista/i)).toBeNull()
  })

  test('deriva a cidade e UF do endereço configurado na data do documento', () => {
    render(
      <ThemeProvider>
        <DocumentGeneratorModal
          open={true}
          onOpenChange={vi.fn()}
          patient={mockPatient}
          professionals={[mockProfessional]}
          currentProfessional={mockProfessional}
        />
      </ThemeProvider>
    )

    // Data e Local deve refletir a cidade/UF do endereço configurado (Campinas - SP)
    expect(screen.getByText(/Campinas - SP,/i)).toBeTruthy()
  })

  test('utiliza o nome da clínica configurada no Termo TCLE & LGPD e nas assinaturas', () => {
    render(
      <ThemeProvider>
        <DocumentGeneratorModal
          open={true}
          onOpenChange={vi.fn()}
          patient={mockPatient}
          professionals={[mockProfessional]}
          currentProfessional={mockProfessional}
          initialDocType="tcle"
        />
      </ThemeProvider>
    )

    // No texto da LGPD
    expect(screen.getByText(/pela/i)).toBeTruthy()
    const lgpdTexts = screen.getAllByText(/Clínica de Fisioterapia Dr Marcelo/i)
    expect(lgpdTexts.length).toBeGreaterThanOrEqual(1)

    // Na assinatura do fisioterapeuta
    expect(screen.getByText(/Fisioterapeuta Responsável • Clínica de Fisioterapia Dr Marcelo/i)).toBeTruthy()
  })

  test('quando o CNPJ não é configurado, omite o campo CNPJ sem renderizar dados fictícios', () => {
    currentMockSettings.cnpj = undefined as any

    render(
      <ThemeProvider>
        <DocumentGeneratorModal
          open={true}
          onOpenChange={vi.fn()}
          patient={mockPatient}
          professionals={[mockProfessional]}
          currentProfessional={mockProfessional}
        />
      </ThemeProvider>
    )

    // Não deve conter menção a CNPJ
    expect(screen.queryByText(/CNPJ:/i)).toBeNull()
    expect(screen.queryByText(/45\.123\.789\/0001-90/i)).toBeNull()
  })
})
