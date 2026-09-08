// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { getFunctionName } from 'convex/server'

const mocks = vi.hoisted(() => ({ save: vi.fn().mockResolvedValue('rule') }))
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
  useQuery: (ref: any) => {
    const name = getFunctionName(ref)
    if (name === 'bookingBuilder:getBookingConfig') return { steps: [{ id: 'slots', type: 'slot_picker', title: 'Horários', order: 0 }], fields: [] }
    if (name === 'bookingBuilder:listPublicAvailableSlots') return publicSlots
    if (name === 'bookingBuilder:listPublicPackages') return []
    return { clinicName: 'Clínica teste' }
  },
  useAction: () => mocks.save,
}))
import { PublicBookingPage } from '../src/pages/PublicBookingPage'

afterEach(() => { cleanup(); vi.clearAllMocks() })
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
  render(<PublicBookingPage />)
  expect(screen.getAllByText('8 vagas')).toHaveLength(2)
  expect(screen.queryByText('16 vagas')).toBeNull()
  const roomA = screen.getByRole('button', { name: /Sala A/ })
  const roomB = screen.getByRole('button', { name: /Sala B/ })
  fireEvent.click(roomB)
  expect(roomB.className).toContain('ring-2')
  expect(roomA.className).not.toContain('ring-2')
})
