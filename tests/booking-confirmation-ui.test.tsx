// @vitest-environment jsdom
import React from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { getFunctionName } from 'convex/server'
import { DEFAULT_CONFIRMATION } from '../shared/bookingConfirmation'

const mocks = vi.hoisted(() => ({ confirmation: {} as any, submit: vi.fn(), save: vi.fn().mockResolvedValue({ success: true }) }))
vi.mock('@/lib/staffConvex', () => ({ useMutation: () => mocks.save }))
vi.mock('@/lib/publicBookingSubmit', () => ({ createPublicBookingSubmit: () => mocks.submit }))
vi.mock('convex/react', () => ({
  useConvex: () => ({ url: 'https://example.convex.cloud' }),
  useQuery: (ref: any) => {
    const name = getFunctionName(ref)
    if (name === 'bookingBuilder:getBookingConfig') return { confirmation: mocks.confirmation, successMessage: 'Mensagem personalizada', steps: [], fields: [] }
    if (name === 'clinic:getSettings') return { address: 'Endereço cadastrado' }
    return []
  },
}))
import { PublicBookingPage } from '../src/pages/PublicBookingPage'
import { ConfirmationEditor } from '../src/components/booking/ConfirmationEditor'

afterEach(() => { cleanup(); window.history.replaceState({}, '', '/'); vi.clearAllMocks() })
test('editor saves changed text and visibility and opens the confirmation preview', async () => {
  const onPreview = vi.fn()
  render(<ConfirmationEditor config={{ confirmation: DEFAULT_CONFIRMATION, requireApproval: false, steps: [], fields: [], successMessage: 'Mensagem salva' } as any} onPreview={onPreview} />)
  fireEvent.change(screen.getByLabelText('Título quando confirmado'), { target: { value: 'Reserva recebida!' } })
  fireEvent.click(screen.getByLabelText('Pagamento'))
  fireEvent.click(screen.getByRole('button', { name: 'Salvar confirmação' }))
  await waitFor(() => expect(onPreview).toHaveBeenCalledWith('confirmed'))
  expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ confirmation: expect.objectContaining({ confirmedTitle: 'Reserva recebida!', showPayment: false }), successMessage: 'Mensagem salva' }))
})
test('preview renders saved edits and visibility without creating a booking or external actions', () => {
  window.history.replaceState({}, '', '/agendar?preview=builder&confirmation=confirmed')
  mocks.confirmation = { ...DEFAULT_CONFIRMATION, confirmedTitle: 'Tudo certo!', showPayment: false, address: 'Rua personalizada, 10' }
  render(<PublicBookingPage />)
  expect(screen.getByRole('heading', { name: 'Tudo certo!' })).toBeTruthy()
  expect(screen.getByText('Rua personalizada, 10')).toBeTruthy()
  expect(screen.getByText('Mensagem personalizada')).toBeTruthy()
  expect(screen.queryByText(DEFAULT_CONFIRMATION.paymentTitle)).toBeNull()
  expect(screen.getByText(DEFAULT_CONFIRMATION.whatsappButton).closest('a')?.hasAttribute('href')).toBe(false)
  expect(mocks.submit).not.toHaveBeenCalled()
})
test('pending preview distinguishes a request from a guaranteed reservation', () => {
  window.history.replaceState({}, '', '/agendar?preview=builder&confirmation=pending')
  mocks.confirmation = DEFAULT_CONFIRMATION
  render(<PublicBookingPage />)
  expect(screen.getByRole('heading', { name: DEFAULT_CONFIRMATION.pendingTitle })).toBeTruthy()
  expect(screen.getByText(DEFAULT_CONFIRMATION.pendingMessage)).toBeTruthy()
  expect(screen.getByText('Aguardando aprovação')).toBeTruthy()
  expect(screen.queryByText('Vaga Garantida')).toBeNull()
  expect(mocks.submit).not.toHaveBeenCalled()
})
