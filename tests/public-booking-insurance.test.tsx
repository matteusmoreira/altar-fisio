// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { getFunctionName } from 'convex/server'

const mocks = vi.hoisted(() => ({
  save: vi.fn().mockResolvedValue('rule'),
  bookingConfig: {
    steps: [
      { id: 'step_slot', type: 'slot_picker', title: 'Sessão & Horário', order: 0 },
    ],
    fields: [],
  } as any,
  publicPackages: [
    {
      _id: 'pkg-1',
      name: 'Sessão Avulsa',
      specialty: 'pilates',
      sessionCount: 1,
      price: 150,
      pricePix: 135,
      insurancePrice: 120,
      insurancePricePix: 108,
      active: true,
    },
  ] as any[],
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { role: 'admin' }, isAdmin: true, isProfessional: false }),
}))

vi.mock('convex/react', () => ({
  useQuery: (ref: any) => {
    const name = getFunctionName(ref)
    if (name === 'bookingBuilder:getBookingConfig') return mocks.bookingConfig
    if (name === 'bookingBuilder:listPublicAvailableSlots') return [{
      startTime: '08:00',
      endTime: '08:30',
      isAvailable: true,
      totalAvailableSpots: 8,
      availableProfessionals: [],
      rooms: [{ roomId: 'room1', roomName: 'Studio A', professionalId: 'prof1', capacity: 8, availableSpots: 8 }],
    }]
    if (name === 'bookingBuilder:listPublicPackages') return mocks.publicPackages
    return { clinicName: 'Altar Fisio' }
  },
  useAction: () => mocks.save,
}))

import { PublicBookingPage } from '../src/pages/PublicBookingPage'

afterEach(() => {
  delete mocks.bookingConfig.insurancePartners
  cleanup()
  vi.clearAllMocks()
})

test.each([undefined, 0, 120])('only Particular displays prices, even with insurance price %s', (insurancePrice) => {
  const original = mocks.publicPackages[0]
  mocks.publicPackages[0] = { ...original, insurancePrice, insurancePricePix: insurancePrice }
  try {
    render(<PublicBookingPage />)
    expect(screen.queryByText(/R\$/)).toBeNull()
    expect(screen.queryByText(/Desconto Pix/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^Particular$/i }))
    expect(screen.getByText(/R\$ 135,00/)).toBeTruthy()
    expect(screen.getByText(/R\$ 150,00/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Tenho Plano de Saúde/i }))
    expect(screen.queryByText(/R\$/)).toBeNull()
  } finally {
    mocks.publicPackages[0] = original
  }
})

test('public booking step 2 starts with Tenho Plano de Saúde pre-selected and displays all 6 logos', () => {
  render(<PublicBookingPage />)

  // 1. Botão Tenho Plano de Saúde está ativo por padrão
  const convenioBtn = screen.getByRole('button', { name: /Tenho Plano de Saúde/i })
  expect(convenioBtn.className).toContain('bg-primary')

  // 2. Cabeçalho de convênios visível
  expect(screen.getByText('Qual é o seu Plano de Saúde ou Convênio?')).toBeTruthy()
  expect(screen.getByText(/Atendemos os principais planos com autorização ágil/i)).toBeTruthy()

  // 3. Todas as 6 logos do site e o botão Outro Plano estão presentes
  expect(screen.getByRole('button', { name: /Selecionar convênio Unimed/i })).toBeTruthy()
  expect(screen.getByRole('button', { name: /Selecionar convênio Amil/i })).toBeTruthy()
  expect(screen.getByRole('button', { name: /Selecionar convênio Saúde Petrobras/i })).toBeTruthy()
  expect(screen.getByRole('button', { name: /Selecionar convênio Bradesco Saúde/i })).toBeTruthy()
  expect(screen.getByRole('button', { name: /Selecionar convênio SulAmérica/i })).toBeTruthy()
  expect(screen.getByRole('button', { name: /Selecionar convênio BraSeg/i })).toBeTruthy()
  expect(screen.getByRole('button', { name: /Selecionar outro convênio/i })).toBeTruthy()

  // 4. Unimed começa selecionada por padrão
  expect(screen.getAllByText(/Plano selecionado/i).length).toBeGreaterThan(0)
  expect(screen.getAllByText('Unimed').length).toBeGreaterThan(0)
})

test('clicking on a logo selects the insurance and updates active display', () => {
  render(<PublicBookingPage />)

  const amilBtn = screen.getByRole('button', { name: /Selecionar convênio Amil/i })
  fireEvent.click(amilBtn)

  expect(amilBtn.className).toContain('ring-2')
  expect(screen.getAllByText('Amil').length).toBeGreaterThan(0)

  const bradescoBtn = screen.getByRole('button', { name: /Selecionar convênio Bradesco Saúde/i })
  fireEvent.click(bradescoBtn)

  expect(bradescoBtn.className).toContain('ring-2')
  expect(amilBtn.className).not.toContain('ring-2')
  expect(screen.getAllByText('Bradesco Saúde').length).toBeGreaterThan(0)
})

test('clicking Outro Plano displays the text input and allows typing custom insurance', () => {
  render(<PublicBookingPage />)

  const outroBtn = screen.getByRole('button', { name: /Selecionar outro convênio/i })
  fireEvent.click(outroBtn)

  const input = screen.getByPlaceholderText(/Digite o nome do seu plano/i) as HTMLInputElement
  expect(input).toBeTruthy()

  fireEvent.change(input, { target: { value: 'Porto Seguro Saúde' } })
  expect(input.value).toBe('Porto Seguro Saúde')
  expect(screen.getAllByText('Porto Seguro Saúde').length).toBeGreaterThan(0)
})

test('switching between Tenho Plano de Saúde and Particular toggles the logo section', () => {
  render(<PublicBookingPage />)

  // Começa visível
  expect(screen.getByText('Qual é o seu Plano de Saúde ou Convênio?')).toBeTruthy()

  // Clica em Particular
  const particularBtn = screen.getByRole('button', { name: /Particular/i })
  fireEvent.click(particularBtn)

  // Logos somem
  expect(screen.queryByText('Qual é o seu Plano de Saúde ou Convênio?')).toBeNull()
  expect(screen.queryByRole('button', { name: /Selecionar convênio Unimed/i })).toBeNull()

  // Volta para Tenho Plano de Saúde
  const convenioBtn = screen.getByRole('button', { name: /Tenho Plano de Saúde/i })
  fireEvent.click(convenioBtn)

  // Logos reaparecem
  expect(screen.getByText('Qual é o seu Plano de Saúde ou Convênio?')).toBeTruthy()
  expect(screen.getByRole('button', { name: /Selecionar convênio Unimed/i })).toBeTruthy()
})


test('renders configured plans without restoring deleted default logos', () => {
  mocks.bookingConfig.insurancePartners = [{ id: 'new', name: 'Novo Plano' }]
  render(<PublicBookingPage />)
  expect(screen.queryByRole('button', { name: /Selecionar convênio Unimed/i })).toBeNull()
  expect(screen.getByRole('button', { name: 'Selecionar convênio Novo Plano' })).toBeTruthy()
  expect(screen.getAllByText('Novo Plano').length).toBeGreaterThan(0)
})

test('an empty configured list leaves only the custom insurance option', () => {
  mocks.bookingConfig.insurancePartners = []
  render(<PublicBookingPage />)
  expect(screen.queryByRole('button', { name: /Selecionar convênio Unimed/i })).toBeNull()
  expect(screen.getByPlaceholderText(/Digite o nome do seu plano/i)).toBeTruthy()
})
