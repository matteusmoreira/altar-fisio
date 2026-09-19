// @vitest-environment jsdom
import React from 'react'
import { test, expect, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PortalLoginForm } from '../src/components/patients/PortalLoginForm'
afterEach(cleanup)

test('login applies phone mask and toggles password visibility', () => {
  render(<PortalLoginForm onLogin={vi.fn()} />)
  const phone = screen.getByLabelText('WhatsApp / Telefone com DDD') as HTMLInputElement
  expect(phone.value).toBe('')
  fireEvent.change(phone, { target: { value: '+55 (11) 98765-4321' } })
  expect(phone.value).toBe('(11) 98765-4321')
  const password = screen.getByLabelText('Senha') as HTMLInputElement
  expect(password.type).toBe('password')
  fireEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }))
  expect(password.type).toBe('text')
  fireEvent.click(screen.getByRole('button', { name: 'Ocultar senha' }))
  expect(password.type).toBe('password')
})

test('invalid phone is rejected locally; valid submission waits and reports server errors without success', async () => {
  let reject!: (error: unknown) => void
  const onLogin = vi.fn(() => new Promise<void>((_resolve, fail) => { reject = fail }))
  render(<PortalLoginForm onLogin={onLogin} />)
  fireEvent.change(screen.getByLabelText('WhatsApp / Telefone com DDD'), { target: { value: '1111' } })
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: '@mudar123' } })
  fireEvent.click(screen.getByRole('button', { name: 'Entrar', exact: true }))
  expect(screen.getByRole('alert').textContent).toContain('telefone válido')
  expect(onLogin).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('WhatsApp / Telefone com DDD'), { target: { value: '11987654321' } })
  fireEvent.click(screen.getByRole('button', { name: 'Entrar', exact: true }))
  expect((screen.getByRole('button', { name: 'Entrando…' }) as HTMLButtonElement).disabled).toBe(true)
  expect(onLogin).toHaveBeenCalledWith({ type: 'phone', identifier: '(11) 98765-4321', password: '@mudar123' })
  reject({ data: 'Credenciais inválidas.' })
  await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Credenciais inválidas.'))
  expect((screen.getByRole('button', { name: 'Entrar', exact: true }) as HTMLButtonElement).disabled).toBe(false)
})
