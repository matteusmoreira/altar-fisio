// @vitest-environment jsdom
import React from 'react'
import { test, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  user: { id: 'u1', name: 'Matteus Moreira', role: 'admin' },
  rooms: [
    {
      id: 'room-pilates',
      name: 'Pilates e Fortalecimento Muscular',
      type: 'pilates_aparelhos',
      capacity: 5,
      color: '#10b981',
      isActive: true,
    },
    {
      id: 'room-marcelo',
      name: 'Fisioterapia | Dr Marcelo',
      type: 'fisioterapia',
      capacity: 8,
      color: '#0284c7',
      isActive: true,
    },
    {
      id: 'room-gustavo',
      name: 'Fisioterapia | Dr Gustavo',
      type: 'fisioterapia',
      capacity: 8,
      color: '#8b5cf6',
      isActive: true,
    },
  ],
  schedules: [] as any[],
  transactions: [] as any[],
  replacementCredits: [] as any[],
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mocks.user,
    role: 'admin',
    isProfessional: false,
  }),
}))

vi.mock('@/lib/staffConvex', () => ({
  useAction: () => vi.fn(),
  useQuery: () => [],
  useMutation: () => vi.fn(),
}))

vi.mock('@/contexts/ClinicDataContext', () => ({
  useClinicData: () => ({
    rooms: mocks.rooms,
    schedules: mocks.schedules,
    transactions: mocks.transactions,
    replacementCredits: mocks.replacementCredits,
    checkIn: vi.fn(),
    cancelWithReplacement: vi.fn(),
    sendWhatsAppReminder: vi.fn(),
  }),
}))

import { DashboardPage } from '../src/pages/DashboardPage'

beforeEach(() => {
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

test('o botão "Lançar SOAP" foi removido do cabeçalho de ações rápidas', () => {
  render(<DashboardPage onNavigate={vi.fn()} />)

  // O botão "Lançar SOAP" não deve existir
  const soapBtn = screen.queryByRole('button', { name: /lançar soap/i })
  expect(soapBtn).toBeNull()

  // Os outros botões principais devem continuar presentes
  expect(screen.getByRole('button', { name: /ver agenda/i })).toBeTruthy()
  expect(screen.getByRole('button', { name: /novo paciente/i })).toBeTruthy()
  expect(screen.getByRole('button', { name: /lembretes whatsapp/i })).toBeTruthy()
})

test('renderiza o painel de alto destaque de "Lotação das Salas" com dados de capacidade e status em tempo real', () => {
  render(<DashboardPage onNavigate={vi.fn()} />)

  // Cabeçalho da seção de lotação de salas
  expect(screen.getByText('Lotação das Salas')).toBeTruthy()
  expect(screen.getByText(/ocupação física instantânea/i)).toBeTruthy()
  expect(screen.getByRole('button', { name: /gerenciar salas & turmas/i })).toBeTruthy()

  // Deve renderizar cada uma das salas cadastradas
  expect(screen.getByText('Pilates e Fortalecimento Muscular')).toBeTruthy()
  expect(screen.getByText('Fisioterapia | Dr Marcelo')).toBeTruthy()
  expect(screen.getByText('Fisioterapia | Dr Gustavo')).toBeTruthy()

  // Deve exibir a capacidade e contagem de vagas
  expect(screen.getByText(/5 alunos/)).toBeTruthy()
  expect(screen.getAllByText(/8 alunos/)).toHaveLength(2)

  // Deve exibir o indicador de ocupação em tempo real (0/5 e 0/8)
  expect(screen.getByText('/5')).toBeTruthy()
  expect(screen.getAllByText('/8')).toHaveLength(2)
})
