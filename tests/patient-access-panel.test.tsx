// @vitest-environment jsdom
import React from 'react'
import { test, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
const mocks = vi.hoisted(() => ({ role: 'admin', changePassword: vi.fn(), healthOptions: undefined as string[] | undefined, updateOptions: vi.fn() }))
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ role: mocks.role }) }))
vi.mock('@/lib/staffConvex', () => ({
  useAction: () => mocks.changePassword,
  useQuery: () => mocks.healthOptions,
  useMutation: () => mocks.updateOptions,
}))
vi.mock('@/components/patients/PatientProfileModal', () => ({ PatientProfileModal: () => null }))
vi.mock('@/contexts/ClinicDataContext', () => ({ useClinicData: () => ({
  patients: [{ id: 'patient', name: 'Paciente teste', documentCpf: '52998224725', phone: '11987654321', birthDate: '1990-01-01', active: true }],
  clinicalOverview: [], addPatient: vi.fn(), updatePatient: vi.fn(), deletePatient: vi.fn(),
}) }))
import { PatientsPage } from '../src/pages/PatientsPage'
import { PortalAccessSettings } from '../src/components/patients/PortalAccessSettings'
beforeEach(() => {
  mocks.role = 'admin'; mocks.changePassword.mockReset()
  mocks.healthOptions = undefined; mocks.updateOptions.mockReset()
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

test('patient form formats emergency phone and fills address from CEP', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      logradouro: 'Rua Rio Grande do Norte',
      bairro: 'Extensão do Bosque',
      localidade: 'Rio das Ostras',
      uf: 'RJ',
    }),
  })
  vi.stubGlobal('fetch', fetchMock)

  render(<PatientsPage onNavigateToClinical={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Novo Paciente' }))

  const cep = screen.getByPlaceholderText('00000-000') as HTMLInputElement
  const emergencyPhone = screen.getByPlaceholderText('(11) 99999-9999') as HTMLInputElement
  const address = screen.getByPlaceholderText('Rua, Número, Bairro, Cidade') as HTMLInputElement

  fireEvent.change(cep, { target: { value: '22790702' } })
  fireEvent.change(emergencyPhone, { target: { value: '22999902189' } })

  expect(cep.value).toBe('22790-702')
  expect(emergencyPhone.value).toBe('(22) 99990-2189')
  await waitFor(() => expect(address.value).toBe('Rua Rio Grande do Norte, Extensão do Bosque, Rio das Ostras - RJ'))
  expect(fetchMock).toHaveBeenCalledWith('https://viacep.com.br/ws/22790702/json/')
})

test('admin manages health insurance options inside the patient form', async () => {
  mocks.healthOptions = ['Particular', 'Unimed']
  mocks.updateOptions.mockResolvedValue(['Particular', 'Golden Cross'])

  render(<PatientsPage onNavigateToClinical={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Novo Paciente' }))
  fireEvent.click(screen.getByRole('button', { name: 'Gerenciar opções' }))

  fireEvent.change(screen.getByLabelText('Nova opção de plano ou convênio'), {
    target: { value: 'Golden Cross' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar', exact: true }))
  fireEvent.click(screen.getByRole('button', { name: 'Remover opção Unimed' }))
  fireEvent.click(screen.getByRole('button', { name: 'Salvar opções' }))

  await waitFor(() => expect(mocks.updateOptions).toHaveBeenCalledWith({
    options: ['Particular', 'Golden Cross'],
  }))
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
