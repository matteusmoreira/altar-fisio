// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { getFunctionName } from 'convex/server'

const mocks = vi.hoisted(() => ({ role: 'reception', queries: vi.fn(), mutation: vi.fn() }))
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { role: mocks.role }, role: mocks.role, token: 'staff-test', isAuthenticated: true }) }))
vi.mock('convex/react', () => ({
  useQuery: (reference: any, args: any) => {
    const name = getFunctionName(reference)
    mocks.queries(name, args)
    if (args === 'skip') return undefined
    if (name === 'waitlist:forStaff') return [{ _id: 'entry-1', status: 'waiting', patientName: 'Paciente na fila', jobs: [] }]
    if (name === 'waitlist:mine') return [{ _id: 'entry-1', creditId: 'credit-1', status: 'waiting', position: 1, expiryDate: '2026-09-30', schedule: { date: '2026-09-15', startTime: '14:00', endTime: '15:00', title: 'Pilates' } }]
    return []
  },
  useMutation: () => mocks.mutation,
  useAction: () => mocks.mutation,
}))
import { WaitlistPanel } from '../src/components/schedule/WaitlistPanel'
import { PatientWaitlist } from '../src/components/patients/PatientWaitlist'

beforeEach(() => { mocks.role = 'reception'; mocks.queries.mockClear(); mocks.mutation.mockReset().mockResolvedValue(null) })
afterEach(cleanup)

test('reception query passes the actual UI permission gate and allows removing a waiting patient', async () => {
  render(<WaitlistPanel scheduleId={'schedule-1' as any} />)
  expect(screen.getByText('1º · Paciente na fila')).toBeTruthy()
  expect(mocks.queries).toHaveBeenCalledWith('waitlist:forStaff', { scheduleId: 'schedule-1', sessionToken: 'staff-test' })
  fireEvent.click(screen.getByRole('button', { name: 'Retirar' }))
  await waitFor(() => expect(mocks.mutation).toHaveBeenCalledWith({ entryId: 'entry-1', sessionToken: 'staff-test' }))
})

test('professional sees the queue but cannot add or remove patients', () => {
  mocks.role = 'professional'
  render(<WaitlistPanel scheduleId={'schedule-1' as any} />)
  expect(screen.getByText('1º · Paciente na fila')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Retirar' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Incluir na fila' })).toBeNull()
})

test('patient can change slots and sees errors without pretending that leaving succeeded', async () => {
  const change = vi.fn()
  mocks.mutation.mockRejectedValueOnce(new Error('A fila já foi processada.'))
  render(<PatientWaitlist portalToken="patient-test" onChangeSlot={change} />)
  expect(screen.getByText('1º na fila')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Trocar horário' }))
  expect(change).toHaveBeenCalledWith('credit-1')
  fireEvent.click(screen.getByRole('button', { name: 'Sair da fila' }))
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('já foi processada'))
})
