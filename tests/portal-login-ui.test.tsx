// @vitest-environment jsdom
import React from 'react'
import { test, expect, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PortalLoginForm } from '../src/components/patients/PortalLoginForm'
afterEach(cleanup)

test('login defaults to CPF, applies masks, switches phone format and toggles password visibility', () => {
  render(<PortalLoginForm onLogin={vi.fn()} />)
  const cpf = screen.getByLabelText('CPF') as HTMLInputElement
  fireEvent.change(cpf, { target: { value: '52998224725' } })
  expect(cpf.value).toBe('529.982.247-25')
  fireEvent.click(screen.getByRole('button', { name: 'Telefone', exact: true }))
  const phone = screen.getByLabelText('Telefone com DDD') as HTMLInputElement
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

test('invalid CPF is rejected locally; valid submission waits and reports server errors without success', async () => {
  let reject!: (error: unknown) => void
  const onLogin = vi.fn(() => new Promise<void>((_resolve, fail) => { reject = fail }))
  render(<PortalLoginForm onLogin={onLogin} />)
  fireEvent.change(screen.getByLabelText('CPF'), { target: { value: '11111111111' } })
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: '@mudar123' } })
  fireEvent.click(screen.getByRole('button', { name: 'Entrar', exact: true }))
  expect(screen.getByRole('alert').textContent).toContain('CPF válido')
  expect(onLogin).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('CPF'), { target: { value: '52998224725' } })
  fireEvent.click(screen.getByRole('button', { name: 'Entrar', exact: true }))
  expect((screen.getByRole('button', { name: 'Entrando…' }) as HTMLButtonElement).disabled).toBe(true)
  expect(onLogin).toHaveBeenCalledWith({ type: 'cpf', identifier: '529.982.247-25', password: '@mudar123' })
  reject({ data: 'Credenciais inválidas.' })
  await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Credenciais inválidas.'))
  expect((screen.getByRole('button', { name: 'Entrar', exact: true }) as HTMLButtonElement).disabled).toBe(false)
})
