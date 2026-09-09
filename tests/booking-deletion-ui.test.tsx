// @vitest-environment jsdom
import React from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
const mocks = vi.hoisted(() => ({ isAdmin: true, remove: vi.fn().mockResolvedValue({ success: true }) }))
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ isAdmin: mocks.isAdmin }) }))
vi.mock('@/lib/staffConvex', () => ({
  useMutation: () => mocks.remove,
  useQuery: () => [{ _id: 'booking1', patientName: 'Maria', patientPhone: '', patientCpf: '', date: '2026-09-14', startTime: '08:00', status: 'confirmed', createdAt: Date.now(), answers: [] }],
}))
vi.mock('@/components/schedule/WaitlistPanel', () => ({ WaitlistPanel: () => null }))
import { OnlineBookingsPage } from '../src/pages/OnlineBookingsPage'
import { ScheduleDetailModal } from '../src/components/schedule/ScheduleDetailModal'

afterEach(() => { cleanup(); vi.restoreAllMocks(); mocks.remove.mockClear(); mocks.isAdmin = true })

test('request deletion requires confirmation and sends the selected ID', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  render(<OnlineBookingsPage />)
  fireEvent.click(screen.getByRole('button', { name: 'Excluir solicitação' }))
  expect(mocks.remove).not.toHaveBeenCalled()
  confirm.mockReturnValue(true)
  fireEvent.click(screen.getByRole('button', { name: 'Excluir solicitação' }))
  await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith({ bookingId: 'booking1' }))
  expect(confirm.mock.calls[0][0]).toContain('mantido')
})

const schedule = { id: 'schedule1', title: 'Sessão', date: '2026-09-14', startTime: '08:00', endTime: '08:30', type: 'turma', maxCapacity: 2, participants: [], roomColor: '#000000' } as any
const props = { schedule, isOpen: true, onClose: vi.fn(), onCheckIn: vi.fn(), onSendWhatsApp: vi.fn(), onOpenEnroll: vi.fn(), onOpenCancel: vi.fn() }

test('admin deletes the selected appointment after confirmation', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  render(<ScheduleDetailModal {...props} />)
  fireEvent.click(screen.getByRole('button', { name: 'Excluir agendamento' }))
  expect(mocks.remove).not.toHaveBeenCalled()
  confirm.mockReturnValue(true)
  fireEvent.click(screen.getByRole('button', { name: 'Excluir agendamento' }))
  await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith({ id: 'schedule1' }))
})

test('non-admin has no deletion buttons', () => {
  mocks.isAdmin = false
  render(<OnlineBookingsPage />)
  expect(screen.queryByRole('button', { name: 'Excluir solicitação' })).toBeNull()
  cleanup()
  render(<ScheduleDetailModal {...props} />)
  expect(screen.queryByRole('button', { name: 'Excluir agendamento' })).toBeNull()
})
