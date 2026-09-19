// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import {
  formatSpecialtyName,
  formatScheduleTitle,
  type ClinicalSpecialty,
} from '../shared/clinicalSpecialties'
import { PatientProfileModal } from '@/components/patients/PatientProfileModal'

const mocks = vi.hoisted(() => ({
  role: 'admin',
  storedSchedules: [] as any[],
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ role: mocks.role, isAuthenticated: true, token: 'test' }),
}))

vi.mock('@/lib/staffConvex', () => ({
  useQuery: (_fn: any, args: any) => {
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

vi.mock('@/lib/dateUtils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/dateUtils')>()
  return {
    ...actual,
    getTodayDateString: () => '2026-09-17',
  }
})

describe('formatSpecialtyName & formatScheduleTitle', () => {
  const customSpecialties: ClinicalSpecialty[] = [
    { id: 'pilates_e_fortalecimento_muscula', name: 'Pilates e Fortalecimento Muscular' },
    { id: 'fisioterapia', name: 'Fisioterapia Avançada' },
  ]

  it('formats specialty without underscores matching room name or specialty catalog', () => {
    // 1. Coincidindo com o nome da sala
    expect(
      formatSpecialtyName('pilates_e_fortalecimento_muscula', null, 'Pilates e Fortalecimento Muscular')
    ).toBe('Pilates e Fortalecimento Muscular')

    // 2. Coincidindo com a lista de especialidades da clínica
    expect(
      formatSpecialtyName('pilates_e_fortalecimento_muscula', customSpecialties)
    ).toBe('Pilates e Fortalecimento Muscular')

    // 3. Fallback sem sala e sem especialidade: remove underscores e capitaliza adequadamente
    expect(
      formatSpecialtyName('pilates_e_fortalecimento_muscula')
    ).toBe('Pilates e Fortalecimento Muscula')

    // 4. Especialidades padrão
    expect(formatSpecialtyName('fisioterapia')).toBe('Fisioterapia Avançada')
    expect(formatSpecialtyName('pilates')).toBe('Pilates (Solo & Aparelhos)')
    expect(formatSpecialtyName('rpg')).toBe('RPG (Postural)')
  })

  it('normalizes schedule titles with underscores into room-based names', () => {
    // Título criado no formato antigo: 'Pilates_e_fortalecimento_muscula 09:00'
    const formatted = formatScheduleTitle('Pilates_e_fortalecimento_muscula 09:00', {
      roomName: 'Pilates e Fortalecimento Muscular',
      specialty: 'pilates_e_fortalecimento_muscula',
    })
    expect(formatted).toBe('Pilates e Fortalecimento Muscular 09:00')

    // Horário das 10:00
    const formatted10 = formatScheduleTitle('Pilates_e_fortalecimento_muscula 10:00', {
      roomName: 'Pilates e Fortalecimento Muscular',
      specialty: 'pilates_e_fortalecimento_muscula',
    })
    expect(formatted10).toBe('Pilates e Fortalecimento Muscular 10:00')

    // Usando catálogo de especialidades
    const formattedWithSpec = formatScheduleTitle('Pilates_e_fortalecimento_muscula 09:00', {
      specialties: customSpecialties,
      specialty: 'pilates_e_fortalecimento_muscula',
    })
    expect(formattedWithSpec).toBe('Pilates e Fortalecimento Muscular 09:00')

    // Título já limpo sem underscores permanece intacto
    expect(
      formatScheduleTitle('Pilates e Fortalecimento Muscular 09:00', {
        roomName: 'Pilates e Fortalecimento Muscular',
      })
    ).toBe('Pilates e Fortalecimento Muscular 09:00')
  })
})

describe('PatientProfileModal formatting without underscores', () => {
  beforeEach(() => {
    mocks.role = 'admin'
  })

  afterEach(() => {
    cleanup()
  })

  const testPatient = {
    id: 'patient_123',
    name: 'Matteus Moreira',
    documentCpf: '14322094775',
    phone: '22999021889',
    birthDate: '2000-01-01',
    active: true,
    createdAt: Date.now(),
  }

  it('renders clean turma and modalidade names without underscores in the patient profile', () => {
    mocks.storedSchedules = [
      {
        _id: 'sched_1',
        title: 'Pilates_e_fortalecimento_muscula 09:00',
        type: 'turma',
        specialty: 'pilates_e_fortalecimento_muscula',
        roomId: 'room_1',
        roomName: 'Pilates e Fortalecimento Muscular',
        roomColor: '#10b981',
        professionalId: 'prof_1',
        professionalName: 'Daniele silvestre',
        date: '2026-09-18',
        startTime: '09:00',
        endTime: '09:30',
        recurringGroupId: 'rec_pilates_1',
        isRecurring: true,
        participants: [
          {
            _id: 'part_1',
            patientId: 'patient_123',
            status: 'scheduled',
          },
        ],
      },
      {
        _id: 'sched_2',
        title: 'Pilates_e_fortalecimento_muscula 10:00',
        type: 'turma',
        specialty: 'pilates_e_fortalecimento_muscula',
        roomId: 'room_1',
        roomName: 'Pilates e Fortalecimento Muscular',
        roomColor: '#10b981',
        professionalId: 'prof_2',
        professionalName: 'Claudia Monteiro',
        date: '2026-09-22',
        startTime: '10:00',
        endTime: '10:30',
        recurringGroupId: 'rec_pilates_1',
        isRecurring: true,
        participants: [
          {
            _id: 'part_2',
            patientId: 'patient_123',
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

    // 1. Não deve haver nenhum texto na tela contendo underscore no título ou modalidade
    expect(screen.queryByText(/Pilates_e_fortalecimento_muscula/i)).toBeNull()

    // 2. Deve exibir os títulos limpos exatamente iguais ao nome da sala
    expect(screen.getAllByText(/Pilates e Fortalecimento Muscular 09:00/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/Pilates e Fortalecimento Muscular 10:00/i).length).toBeGreaterThanOrEqual(1)

    // 3. Os nomes dos profissionais e da sala devem estar visíveis
    expect(screen.getAllByText(/Daniele silvestre/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/Claudia Monteiro/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/Pilates e Fortalecimento Muscular/i).length).toBeGreaterThanOrEqual(2)
  })
})
