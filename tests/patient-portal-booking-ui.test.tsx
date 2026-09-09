// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { getFunctionName } from 'convex/server'

const mocks = vi.hoisted(() => ({ mutation: vi.fn(), action: vi.fn(), closed: false }))
const portalData = {
  patient: { _id: 'patient', name: 'Paciente Teste' },
  upcomingSchedules: [],
  historySchedules: [],
  replacementCredits: [],
  packages: [{
    _id: 'patient-package',
    packageName: 'Plano RPG e Pilates',
    serviceName: 'RPG e Pilates',
    specialty: 'pilates',
    totalSessions: 8,
    remainingSessions: 8,
    bookableSessionsCount: 8,
    canBook: true,
    status: 'active',
    startDate: '2026-09-01',
    expiryDate: '2026-10-01',
  }],
  policy: { cancellationNoticeHours: 2, replacementExpiryDays: 30, clinicPhone: '11999999999', clinicAddress: 'Rua Teste', clinicName: 'Altar Fisio' },
}
const slots = [
  { slotKey: 'slot-0800', scheduleId: null, title: 'RPG e Pilates', date: '2026-09-10', startTime: '08:00', endTime: '08:30', roomId: 'room', roomName: 'Studio Pilates e RPG', professionalId: 'professional', professionalName: 'Dani', vacanciesLeft: 8, maxCapacity: 8, isAlreadyEnrolled: false },
  { slotKey: 'slot-0830', scheduleId: null, title: 'RPG e Pilates', date: '2026-09-10', startTime: '08:30', endTime: '09:00', roomId: 'room', roomName: 'Studio Pilates e RPG', professionalId: 'professional', professionalName: 'Dani', vacanciesLeft: 8, maxCapacity: 8, isAlreadyEnrolled: false },
]

vi.mock('convex/react', () => ({
  useQuery: (ref: any, args: unknown) => {
    if (args === "skip") return undefined
    const name = getFunctionName(ref)
    if (name === 'clinic:getSettings') return { clinicName: 'Altar Fisio' }
    if (name === 'portalAccess:current') return { _id: 'patient' }
    if (name === 'patientPortal:getPatientPortalData') return { ...portalData, portalBookingEnabled: !mocks.closed, portalBookingMessage: [{ type: 'paragraph', runs: [{ text: 'Agende com nossa equipe', bold: true }] }] }
    if (name === 'patientPortal:listMonthlyClasses') return { freeBalance: 8, groups: slots.map((s, i) => ({ key: s.slotKey, recurringGroupId: s.slotKey, dayOfWeek: i + 1, title: s.title, startTime: s.startTime, endTime: s.endTime, professionalName: s.professionalName, roomName: s.roomName, dates: [{ scheduleId: s.slotKey, date: s.date, alreadyBooked: false, vacancies: 8, error: null }] })) }
    if (name === 'patientPortal:listAvailabilitySlotsForPatientBooking') return slots
    return []
  },
  useMutation: () => mocks.mutation,
  useAction: () => mocks.action,
}))

vi.mock('@/components/patients/PatientWaitlist', () => ({ PatientWaitlist: () => null }))

import { PatientPortalPage } from '../src/pages/PatientPortalPage'

beforeEach(() => { mocks.closed = false; sessionStorage.setItem('altar_patient_portal_token_v2', 'a'.repeat(64)) })
afterEach(() => {
  cleanup()
  sessionStorage.clear()
  vi.clearAllMocks()
})

test('monthly booking offers five frequencies and actual classes', () => {
  render(<PatientPortalPage />)
  fireEvent.click(screen.getByRole('button', { name: 'Agendar Aula' }))
  for (const n of [1,2,3,4,5]) expect(screen.getByRole('button', { name: `${n}×` })).toBeTruthy()
  expect(screen.getByText('Segunda · 08:00–08:30')).toBeTruthy()
  expect(screen.getByText('Terça · 08:30–09:00')).toBeTruthy()
  expect(screen.queryByText(/08:00 às 17:00/)).toBeNull()
})

test('closure replaces booking controls and closes an already open form', () => {
  const { rerender } = render(<PatientPortalPage />)
  fireEvent.click(screen.getByRole('button', { name: 'Agendar Aula' }))
  mocks.closed = true
  rerender(<PatientPortalPage />)
  expect(screen.getByText('Agende com nossa equipe')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Agendar Aula' })).toBeNull()
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('monthly booking dialog toggles class selections and displays elegant status indicators', () => {
  render(<PatientPortalPage />)
  fireEvent.click(screen.getByRole('button', { name: 'Agendar Aula' }))

  // Verifica elementos de cabeçalho e formulário
  expect(screen.getByText('Agendar minhas turmas do mês')).toBeTruthy()
  expect(screen.getByLabelText('Plano')).toBeTruthy()
  expect(screen.getByLabelText('Mês')).toBeTruthy()
  expect(screen.getByText(/Saldo livre:/)).toBeTruthy()

  // Verifica turma disponível
  const classCard = screen.getByText('Segunda · 08:00–08:30').closest('button')
  expect(classCard).toBeTruthy()
  expect(classCard?.getAttribute('aria-pressed')).toBe('false')

  // Clica na turma para selecionar
  fireEvent.click(classCard!)
  expect(classCard?.getAttribute('aria-pressed')).toBe('true')

  // Botão de cancelar fecha ou está presente
  expect(screen.getByRole('button', { name: 'Cancelar' })).toBeTruthy()
  expect(screen.getByRole('button', { name: /Confirmar todas as reservas/ })).toBeTruthy()
})

