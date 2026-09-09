// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { getFunctionName } from 'convex/server'

const mocks = vi.hoisted(() => ({ mutation: vi.fn(), action: vi.fn() }))
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
  useQuery: (ref: any) => {
    const name = getFunctionName(ref)
    if (name === 'clinic:getSettings') return { clinicName: 'Altar Fisio' }
    if (name === 'portalAccess:current') return { _id: 'patient' }
    if (name === 'patientPortal:getPatientPortalData') return portalData
    if (name === 'patientPortal:listAvailabilitySlotsForPatientBooking') return slots
    return []
  },
  useMutation: () => mocks.mutation,
  useAction: () => mocks.action,
}))

vi.mock('@/components/patients/PatientWaitlist', () => ({ PatientWaitlist: () => null }))

import { PatientPortalPage } from '../src/pages/PatientPortalPage'

beforeEach(() => sessionStorage.setItem('altar_patient_portal_token_v2', 'a'.repeat(64)))
afterEach(() => {
  cleanup()
  sessionStorage.clear()
  vi.clearAllMocks()
})

test('new booking modal renders each weekly-grid slot separately', () => {
  render(<PatientPortalPage />)
  fireEvent.click(screen.getByRole('button', { name: 'Agendar Aula' }))

  expect(screen.getByText('08:00 às 08:30 • RPG e Pilates')).toBeTruthy()
  expect(screen.getByText('08:30 às 09:00 • RPG e Pilates')).toBeTruthy()
  expect(screen.getAllByText('8 vaga(s)')).toHaveLength(2)
  expect(screen.queryByText(/08:00 às 17:00/)).toBeNull()
})
