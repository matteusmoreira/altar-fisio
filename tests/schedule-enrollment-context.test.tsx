// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { getFunctionName } from 'convex/server'
const mocks = vi.hoisted(() => ({ enroll: vi.fn(), create: vi.fn(), rows: [] as any[] }))
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }))
vi.mock('@/lib/staffConvex', () => ({
  useQuery: (ref: any) => {
    const name = getFunctionName(ref)
    if (name === 'patients:listPatients') return [{ _id: 'patient1', name: 'Paciente Teste', phone: '' }]
    if (name === 'schedules:listSchedulesByDate') return mocks.rows
    return undefined
  },
  useMutation: (ref: any) => getFunctionName(ref) === 'schedules:addParticipantToSchedule' ? mocks.enroll : mocks.create,
  useAction: () => vi.fn(),
}))
import { ClinicDataProvider, useClinicData } from '../src/contexts/ClinicDataContext'
import { SchedulePage } from '../src/pages/SchedulePage'
import { getTodayDateString } from '../src/lib/dateUtils'
vi.mock('@/components/availability/AvailabilityManagerModal', () => ({ AvailabilityManagerModal: () => null }))
vi.mock('@/components/schedule/WaitlistPanel', () => ({ WaitlistPanel: () => null }))
beforeEach(() => {
  const entries = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => entries.set(key, value),
    removeItem: (key: string) => entries.delete(key),
    clear: () => entries.clear(),
  })
})
afterEach(() => { cleanup(); vi.resetAllMocks(); mocks.rows = []; vi.unstubAllGlobals() })
const wrapper = ({ children }: { children: React.ReactNode }) => <ClinicDataProvider>{children}</ClinicDataProvider>

test('enrolls a server-loaded patient and shows the persisted participant from the reactive query', async () => {
  mocks.rows = [{ _id: 'schedule1', participants: [], maxCapacity: 8 }]
  mocks.enroll.mockResolvedValue('participant1')
  const { result, rerender } = renderHook(useClinicData, { wrapper })
  await act(() => result.current.addParticipantToClass('schedule1', 'patient1'))
  expect(mocks.enroll).toHaveBeenCalledWith({ scheduleId: 'schedule1', patientId: 'patient1', isReplacement: false, replacementCreditId: undefined })
  mocks.rows = [{ ...mocks.rows[0], participants: [{ _id: 'participant1', patientId: 'patient1', patientName: 'Paciente Teste', status: 'scheduled' }], activeCount: 1, vacanciesLeft: 7 }]
  rerender()
  expect(result.current.schedules[0].participants[0].id).toBe('participant1')
  expect(result.current.schedules[0].vacanciesLeft).toBe(7)
})

test('enrolls into a newly created schedule before its reactive query arrives', async () => {
  mocks.create.mockResolvedValue('newSchedule')
  mocks.enroll.mockResolvedValue('participant1')
  const { result } = renderHook(useClinicData, { wrapper })
  const context = result.current
  await act(async () => {
    const id = await context.addSchedule({ title: 'Sessão', type: 'turma', specialty: 'pilates', roomId: 'room1', professionalId: 'prof1', date: '2026-09-15', startTime: '08:00', endTime: '08:30', maxCapacity: 8 } as any)
    await context.addParticipantToClass(id, 'patient1')
  })
  expect(mocks.enroll).toHaveBeenCalledWith(expect.objectContaining({ scheduleId: 'newSchedule', patientId: 'patient1' }))
})

test.each([new Error('Sessão indisponível.'), 'Falha de conexão'])('propagates enrollment failure instead of reporting success: %s', async error => {
  mocks.enroll.mockRejectedValue(error)
  const { result } = renderHook(useClinicData, { wrapper })
  await expect(result.current.addParticipantToClass('schedule1', 'patient1', true, 'credit1')).rejects.toBe(error)
  expect(mocks.enroll).toHaveBeenCalledWith(expect.objectContaining({ isReplacement: true, replacementCreditId: 'credit1' }))
})

test.each(['+ Encaixar', 'Agendar Paciente'])('%s saves and displays the patient in the class', async button => {
  localStorage.setItem('altar_schedule_view_mode', 'grid')
  mocks.rows = [{ _id: 'schedule1', title: 'Turma Teste', type: 'turma', specialty: 'pilates', date: getTodayDateString(), startTime: '16:00', endTime: '16:30', participants: [], maxCapacity: 8, roomColor: '#10b981', status: 'scheduled' }]
  mocks.enroll.mockImplementation(async () => {
    mocks.rows = [{ ...mocks.rows[0], participants: [{ _id: 'participant1', patientId: 'patient1', patientName: 'Paciente Teste', status: 'scheduled' }], activeCount: 1, vacanciesLeft: 7 }]
    return 'participant1'
  })
  const view = render(<ClinicDataProvider><SchedulePage /></ClinicDataProvider>)
  fireEvent.click(screen.getByRole('button', { name: button, exact: true }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar Agendamento' }))
  await waitFor(() => expect(mocks.enroll).toHaveBeenCalledOnce())
  view.rerender(<ClinicDataProvider><SchedulePage /></ClinicDataProvider>)
  await waitFor(() => expect(screen.getByText('Paciente Teste', { exact: true })).toBeTruthy())
  expect(screen.queryByText('Nenhum paciente agendado neste horário.')).toBeNull()
})
