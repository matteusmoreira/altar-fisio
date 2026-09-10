// @vitest-environment jsdom
import React from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { getFunctionName } from 'convex/server'

const mocks = vi.hoisted(() => ({
  save: vi.fn().mockResolvedValue('rule'),
  bookingConfig: { steps: [{ id: 'slots', type: 'slot_picker', title: 'Horários', order: 0 }], fields: [] } as any,
  publicPackages: [] as any[],
}))
const rule = { _id: 'rule', professionalId: 'prof', roomId: 'room', professionalName: 'Profissional', roomName: 'Sala', specialty: 'fisioterapia', dayOfWeek: 1, startTime: '08:00', endTime: '10:00', slotDurationMinutes: 30, breakMinutes: 0, isActive: true }
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { role: 'admin' }, isAdmin: true, isProfessional: false }) }))
vi.mock('@/lib/staffConvex', () => ({
  useQuery: (ref: any) => {
    const name = getFunctionName(ref)
    if (name === 'availability:listRules') return [rule]
    if (name === 'professionals:listProfessionals') return [{ _id: 'prof', name: 'Profissional', specialties: ['fisioterapia'], active: true }]
    if (name === 'rooms:listRooms') return [{ _id: 'room', name: 'Sala', capacity: 8, isActive: true }]
    return []
  },
  useMutation: () => mocks.save,
}))
vi.mock('@/components/ui/dialog', () => {
  const Box = ({ children }: any) => <div>{children}</div>
  return { Dialog: ({ open, children }: any) => open ? <div>{children}</div> : null, DialogContent: Box, DialogHeader: Box, DialogTitle: Box, DialogDescription: Box, DialogFooter: Box }
})
import { AvailabilityManagerModal } from '../src/components/availability/AvailabilityManagerModal'
const publicSlots = [{ startTime: '08:00', endTime: '08:30', isAvailable: true, totalAvailableSpots: 16, availableProfessionals: [], rooms: [
  { roomId: 'room1', roomName: 'Sala A', professionalId: 'prof1', capacity: 8, availableSpots: 8 },
  { roomId: 'room2', roomName: 'Sala B', professionalId: 'prof2', capacity: 8, availableSpots: 8 },
] }]
vi.mock('convex/react', () => ({
  useConvex: () => ({ url: 'https://example.convex.cloud' }),
  useQuery: (ref: any) => {
    const name = getFunctionName(ref)
    if (name === 'bookingBuilder:getBookingConfig') return mocks.bookingConfig
    if (name === 'bookingBuilder:listPublicAvailableSlots') return publicSlots
    if (name === 'bookingBuilder:listPublicPackages') return mocks.publicPackages
    return { clinicName: 'Clínica teste' }
  },
  useAction: () => mocks.save,
}))
import { PublicBookingPage } from '../src/pages/PublicBookingPage'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-09T10:59:00Z'))
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.useRealTimers()
  vi.clearAllMocks()
  mocks.bookingConfig = { steps: [{ id: 'slots', type: 'slot_picker', title: 'Horários', order: 0 }], fields: [] }
  mocks.publicPackages = []
})

test('elapsed cards disappear at 19:39 in Sao Paulo while tomorrow remains bookable', () => {
  vi.setSystemTime(new Date('2026-09-09T22:39:00Z'))
  render(<PublicBookingPage />)
  expect(screen.queryByRole('button', { name: /Sala A/ })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /AMANHÃ/i }))
  expect(screen.getByRole('button', { name: /Sala A/ })).toBeTruthy()
})

test('an open page removes a selected slot when its start arrives', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-09T10:59:59Z'))
  render(<PublicBookingPage />)
  fireEvent.click(screen.getByRole('button', { name: /Sala A/ }))
  act(() => { vi.advanceTimersByTime(1000) })
  expect(screen.queryByRole('button', { name: /Sala A/ })).toBeNull()
  expect(screen.queryByText('Selecionado')).toBeNull()
})
test('editing and saving a zero-minute break preserves zero and explains consecutive sessions', async () => {
  render(<AvailabilityManagerModal isOpen onClose={() => {}} />)
  expect(screen.getByText('0 min')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
  const inputs = screen.getAllByRole('spinbutton') as HTMLInputElement[]
  expect(inputs.map(i => i.value)).toEqual(['30', '0'])
  expect(screen.getByText(/Use 0 para horários seguidos/)).toBeTruthy()
  expect(screen.getByText(/configure a sala com capacidade 8/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /Salvar/ }))
  await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ slotDurationMinutes: 30, breakMinutes: 0 })))
})

test('public cards show eight places per room and selecting one does not select both', () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-09T07:00:00-03:00'))
  render(<PublicBookingPage />)
  expect(screen.getAllByText('8 vagas')).toHaveLength(2)
  expect(screen.queryByText('16 vagas')).toBeNull()
  const roomA = screen.getByRole('button', { name: /Sala A/ })
  const roomB = screen.getByRole('button', { name: /Sala B/ })
  fireEvent.click(roomB)
  expect(roomB.className).toContain('ring-2')
  expect(roomA.className).not.toContain('ring-2')
})

test('public intake keeps insurance selection only in the session step', () => {
  mocks.bookingConfig = {
    steps: [{ id: 'step_triagem', type: 'intake_form', title: 'Triagem & Convênio', description: 'Informações sobre plano de saúde e histórico para personalizarmos seu atendimento', order: 0 }],
    fields: [
      { id: 'field_has_insurance', stepId: 'step_triagem', label: 'Você possui plano ou convênio de saúde?', type: 'yes_no', required: true, order: 1 },
      { id: 'field_insurance_name', stepId: 'step_triagem', label: 'Qual é o seu plano de saúde / convênio?', type: 'select', required: true, order: 2 },
      { id: 'field_chief_complaint', stepId: 'step_triagem', label: 'Qual é a sua queixa principal?', type: 'textarea', required: true, order: 3 },
    ],
  }

  render(<PublicBookingPage />)

  expect(screen.getAllByText('Triagem Inicial').length).toBeGreaterThan(0)
  expect(screen.getByText('Qual é a sua queixa principal?')).toBeTruthy()
  expect(screen.queryByText('Você possui plano ou convênio de saúde?')).toBeNull()
  expect(screen.queryByText('Qual é o seu plano de saúde / convênio?')).toBeNull()
})

test('public modalities come from registered packages and empty results stop showing loading', () => {
  const { rerender } = render(<PublicBookingPage />)
  expect(screen.queryByText('Carregando opções de planos e pacotes da clínica...')).toBeNull()

  mocks.publicPackages = [{
    _id: 'pilates-package',
    name: 'Pilates avulso',
    specialty: 'pilates',
    sessionCount: 1,
    price: 100,
    pricePix: 90,
    active: true,
  }]
  rerender(<PublicBookingPage />)

  expect(screen.getByRole('button', { name: 'Studio Pilates' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'RPG Souchard' })).toBeNull()
})
