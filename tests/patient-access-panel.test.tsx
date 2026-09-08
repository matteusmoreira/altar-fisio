// @vitest-environment jsdom
import React from 'react'
import { test, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
const mocks = vi.hoisted(() => ({ role: 'admin', changePassword: vi.fn() }))
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ role: mocks.role }) }))
vi.mock('@/lib/staffConvex', () => ({ useAction: () => mocks.changePassword }))
vi.mock('@/components/patients/PatientProfileModal', () => ({ PatientProfileModal: () => null }))
vi.mock('@/contexts/ClinicDataContext', () => ({ useClinicData: () => ({
  patients: [{ id: 'patient', name: 'Paciente teste', documentCpf: '52998224725', phone: '11987654321', birthDate: '1990-01-01', active: true }],
  clinicalOverview: [], addPatient: vi.fn(), updatePatient: vi.fn(), deletePatient: vi.fn(),
}) }))
import { PatientsPage } from '../src/pages/PatientsPage'
import { PortalAccessSettings } from '../src/components/patients/PortalAccessSettings'
beforeEach(() => {
  mocks.role = 'admin'; mocks.changePassword.mockReset()
  const entries = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => entries.set(key, value), removeItem: (key: string) => entries.delete(key) })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

test.each(['reception', 'professional'])('%s keeps creation and consultation but cannot edit, deactivate or delete in the UI', role => {
  mocks.role = role
  render(<PatientsPage onNavigateToClinical={vi.fn()} />)
  expect(screen.getByRole('button', { name: 'Novo Paciente' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Ficha Completa 360°', exact: true })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Editar', exact: true })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Inativar Paciente' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Excluir paciente' })).toBeNull()
})

test('admin retains patient controls', () => {
  render(<PatientsPage onNavigateToClinical={vi.fn()} />)
  expect(screen.getByRole('button', { name: 'Editar', exact: true })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Inativar Paciente' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Excluir paciente' })).toBeTruthy()
})

test('password panel validates confirmation and reports confirmed default reset without reading current password', async () => {
  mocks.changePassword.mockResolvedValue(undefined)
  render(<PortalAccessSettings patientId={'patient' as any} />)
  fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: 'NewPassword123' } })
  fireEvent.change(screen.getByLabelText('Confirmar nova senha'), { target: { value: 'Different123' } })
  fireEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }))
  expect(screen.getByRole('alert').textContent).toBe('As senhas não coincidem.')
  expect(mocks.changePassword).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Redefinir para @mudar123' }))
  await screen.findByRole('status')
  expect(mocks.changePassword).toHaveBeenCalledWith({ patientId: 'patient', password: '@mudar123' })
  expect((screen.getByLabelText('Nova senha') as HTMLInputElement).value).toBe('')
})

test('password change failure never announces success', async () => {
  mocks.changePassword.mockRejectedValue({ data: 'Sem permissão.' })
  render(<PortalAccessSettings patientId={'patient' as any} />)
  fireEvent.click(screen.getByRole('button', { name: 'Redefinir para @mudar123' }))
  expect((await screen.findByRole('alert')).textContent).toBe('Sem permissão.')
  expect(screen.queryByRole('status')).toBeNull()
})
