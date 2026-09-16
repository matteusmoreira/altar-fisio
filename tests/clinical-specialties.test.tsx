// @vitest-environment jsdom
import React from 'react'
import { test, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { getFunctionName } from 'convex/server'

const mocks = vi.hoisted(() => ({
  role: 'admin',
  isAdmin: true,
  specialties: undefined as Array<{ id: string; name: string; description?: string }> | undefined,
  updateSpecialties: vi.fn(),
  saveRule: vi.fn(),
  deleteRule: vi.fn(),
  saveOverride: vi.fn(),
  deleteOverride: vi.fn(),
  rules: [] as any[],
  overrides: [] as any[],
  professionals: [
    { _id: 'prof1', name: 'Dr. Marcelo Santos', active: true, specialties: ['Fisioterapia', 'Pilates'] },
  ],
  rooms: [
    { _id: 'room1', name: 'Studio Pilates e RPG', type: 'pilates_aparelhos', capacity: 8, color: '#10B981', isActive: true },
  ],
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    role: mocks.role,
    isAdmin: mocks.isAdmin,
    isProfessional: false,
    user: { id: 'u1', name: 'Admin', role: mocks.role },
  }),
}))

vi.mock('@/lib/staffConvex', () => ({
  useQuery: (ref: any) => {
    const name = getFunctionName(ref)
    if (name === 'clinic:getClinicalSpecialties') return mocks.specialties
    if (name === 'availability:listRules') return mocks.rules
    if (name === 'availability:listOverrides') return mocks.overrides
    if (name === 'professionals:listProfessionals') return mocks.professionals
    if (name === 'rooms:listRooms') return mocks.rooms
    return []
  },
  useMutation: (ref: any) => {
    const name = getFunctionName(ref)
    if (name === 'clinic:updateClinicalSpecialties') return mocks.updateSpecialties
    if (name === 'availability:saveRule') return mocks.saveRule
    return vi.fn()
  },
}))

vi.mock('@/components/ui/dialog', () => {
  const Box = ({ children }: any) => <div>{children}</div>
  return {
    Dialog: ({ open, children }: any) => (open ? <div>{children}</div> : null),
    DialogContent: Box,
    DialogHeader: Box,
    DialogTitle: Box,
    DialogDescription: Box,
    DialogFooter: Box,
  }
})

import { ClinicalSpecialtiesManager } from '../src/components/settings/ClinicalSpecialtiesManager'
import { AvailabilityManagerModal } from '../src/components/availability/AvailabilityManagerModal'

beforeEach(() => {
  mocks.role = 'admin'
  mocks.isAdmin = true
  mocks.specialties = [
    { id: 'fisioterapia', name: 'Fisioterapia Avançada' },
    { id: 'pilates', name: 'Pilates (Solo & Aparelhos)' },
    { id: 'rpg', name: 'RPG (Postural)' },
  ]
  mocks.updateSpecialties.mockReset()
  mocks.saveRule.mockReset()
  mocks.rules = []
})

afterEach(() => {
  cleanup()
})

test('renderiza as especialidades ativas padrão', () => {
  render(<ClinicalSpecialtiesManager variant="card" />)
  expect(screen.getByText('Fisioterapia Avançada')).toBeTruthy()
  expect(screen.getByText('Pilates (Solo & Aparelhos)')).toBeTruthy()
  expect(screen.getByText('RPG (Postural)')).toBeTruthy()
})

test('adiciona uma nova especialidade clínica e salva', async () => {
  mocks.updateSpecialties.mockResolvedValue(undefined)
  render(<ClinicalSpecialtiesManager variant="card" />)

  const input = screen.getByLabelText('Nome da nova especialidade clínica')
  fireEvent.change(input, { target: { value: 'Osteopatia Clínica' } })
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))

  await waitFor(() => {
    expect(screen.getByText('Osteopatia Clínica')).toBeTruthy()
  })

  await waitFor(() => {
    expect(mocks.updateSpecialties).toHaveBeenCalledWith({
      specialties: [
        { id: 'fisioterapia', name: 'Fisioterapia Avançada', description: undefined },
        { id: 'pilates', name: 'Pilates (Solo & Aparelhos)', description: undefined },
        { id: 'rpg', name: 'RPG (Postural)', description: undefined },
        { id: 'osteopatia_clinica', name: 'Osteopatia Clínica', description: undefined },
      ],
    })
  })
})

test('edita o nome de uma especialidade clínica existente', async () => {
  mocks.updateSpecialties.mockResolvedValue(undefined)
  render(<ClinicalSpecialtiesManager variant="card" />)

  const editButton = screen.getByRole('button', { name: 'Editar Pilates (Solo & Aparelhos)' })
  fireEvent.click(editButton)

  const editInput = screen.getByLabelText('Editar nome da especialidade Pilates (Solo & Aparelhos)')
  fireEvent.change(editInput, { target: { value: 'Studio Pilates Moderno' } })

  fireEvent.click(screen.getByRole('button', { name: 'Confirmar edição' }))

  await waitFor(() => {
    expect(screen.getByText('Studio Pilates Moderno')).toBeTruthy()
    expect(screen.queryByText('Pilates (Solo & Aparelhos)')).toBeNull()
  })

  await waitFor(() => {
    expect(mocks.updateSpecialties).toHaveBeenCalledWith({
      specialties: [
        { id: 'fisioterapia', name: 'Fisioterapia Avançada', description: undefined },
        { id: 'pilates', name: 'Studio Pilates Moderno', description: undefined },
        { id: 'rpg', name: 'RPG (Postural)', description: undefined },
      ],
    })
  })
})

test('exclui uma especialidade clínica da lista', async () => {
  mocks.updateSpecialties.mockResolvedValue(undefined)
  render(<ClinicalSpecialtiesManager variant="card" />)

  const deleteButton = screen.getByRole('button', { name: 'Excluir RPG (Postural)' })
  fireEvent.click(deleteButton)

  await waitFor(() => {
    expect(screen.queryByText('RPG (Postural)')).toBeNull()
  })

  await waitFor(() => {
    expect(mocks.updateSpecialties).toHaveBeenCalledWith({
      specialties: [
        { id: 'fisioterapia', name: 'Fisioterapia Avançada', description: undefined },
        { id: 'pilates', name: 'Pilates (Solo & Aparelhos)', description: undefined },
      ],
    })
  })
})

test('AvailabilityManagerModal exibe opções dinâmicas e botão para gerenciar especialidades', () => {
  render(
    <AvailabilityManagerModal
      isOpen={true}
      onClose={vi.fn()}
    />
  )

  // Abre form de criar horário
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar Primeiro Horário' }))

  // Verifica o botão de gerenciar especialidades
  const manageBtn = screen.getByRole('button', { name: /gerenciar especialidades/i })
  expect(manageBtn).toBeTruthy()

  // Clica para abrir o gestor embutido
  fireEvent.click(manageBtn)
  expect(screen.getByText('Gerenciar Especialidades Clínicas')).toBeTruthy()
})
