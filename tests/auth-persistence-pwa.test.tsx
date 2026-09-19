// @vitest-environment jsdom
import React from 'react'
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { LoginPage } from '../src/pages/LoginPage'
import { convexTest } from 'convex-test'
import schema from '../convex/schema'
import { api, internal } from '../convex/_generated/api'

const modules = import.meta.glob('../convex/**/*.ts')

const mockLogin = vi.fn()

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
    isLoading: false,
  }),
}))

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      clinicName: 'Clinica Dr Marcelo',
      clinicSubtitle: 'Fisioterapia & Pilates',
      logoUrl: null,
    },
  }),
}))

const localStore = new Map<string, string>()
const sessionStore = new Map<string, string>()

vi.stubGlobal('localStorage', {
  getItem: (key: string) => localStore.get(key) ?? null,
  setItem: (key: string, value: string) => localStore.set(key, value),
  removeItem: (key: string) => localStore.delete(key),
  clear: () => localStore.clear(),
})

vi.stubGlobal('sessionStorage', {
  getItem: (key: string) => sessionStore.get(key) ?? null,
  setItem: (key: string, value: string) => sessionStore.set(key, value),
  removeItem: (key: string) => sessionStore.delete(key),
  clear: () => sessionStore.clear(),
})

describe('LoginPage PWA and Credentials UI', () => {
  beforeEach(() => {
    localStore.clear()
    sessionStore.clear()
    mockLogin.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  test('renders form with semantic attributes for password managers and 1-click autofill', () => {
    render(<LoginPage />)

    const emailInput = screen.getByLabelText(/E-mail Profissional/i) as HTMLInputElement
    const passwordInput = screen.getByLabelText(/^Senha$/i, { selector: 'input' }) as HTMLInputElement
    const rememberCheckbox = screen.getByLabelText(/Manter conectado neste dispositivo/i) as HTMLInputElement

    expect(emailInput).toBeTruthy()
    expect(emailInput.name).toBe('email')
    expect(emailInput.getAttribute('autocomplete')).toBe('username')
    expect(emailInput.id).toBe('login-email')

    expect(passwordInput).toBeTruthy()
    expect(passwordInput.name).toBe('password')
    expect(passwordInput.getAttribute('autocomplete')).toBe('current-password')
    expect(passwordInput.id).toBe('login-password')

    expect(rememberCheckbox).toBeTruthy()
    expect(rememberCheckbox.type).toBe('checkbox')
    expect(rememberCheckbox.checked).toBe(true)
  })

  test('pre-fills remembered email from localStorage when available', () => {
    localStorage.setItem('altar_remembered_email', 'marcelo@altarfisio.com.br')

    render(<LoginPage />)

    const emailInput = screen.getByLabelText(/E-mail Profissional/i) as HTMLInputElement
    expect(emailInput.value).toBe('marcelo@altarfisio.com.br')
  })

  test('submits with email, password, and rememberMe=true by default', async () => {
    render(<LoginPage />)

    const emailInput = screen.getByLabelText(/E-mail Profissional/i)
    const passwordInput = screen.getByLabelText(/^Senha$/i, { selector: 'input' })
    const submitButton = screen.getByRole('button', { name: /Entrar no Sistema/i })

    fireEvent.change(emailInput, { target: { value: 'marcelo@altarfisio.com.br' } })
    fireEvent.change(passwordInput, { target: { value: 'secret123' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('marcelo@altarfisio.com.br', 'secret123', true)
    })
  })

  test('submits with rememberMe=false and removes remembered email when unchecked', async () => {
    localStorage.setItem('altar_remembered_email', 'marcelo@altarfisio.com.br')

    render(<LoginPage />)

    const rememberCheckbox = screen.getByLabelText(/Manter conectado neste dispositivo/i)
    const passwordInput = screen.getByLabelText(/^Senha$/i, { selector: 'input' })
    const submitButton = screen.getByRole('button', { name: /Entrar no Sistema/i })

    fireEvent.click(rememberCheckbox)
    expect((rememberCheckbox as HTMLInputElement).checked).toBe(false)

    fireEvent.change(passwordInput, { target: { value: 'secret123' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('marcelo@altarfisio.com.br', 'secret123', false)
      expect(localStorage.getItem('altar_remembered_email')).toBeNull()
    })
  })
})

describe('Backend Session Lifetime (30 days vs 8 hours)', () => {
  test('createSession with rememberMe=true grants 30 days lifetime', async () => {
    const t = convexTest(schema, modules)
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert('users', {
        name: 'Dr Marcelo',
        email: 'marcelo@test.invalid',
        role: 'admin',
        passwordHash: 'dummyHash',
        salt: 'dummySalt',
        active: true,
        createdAt: Date.now(),
      })
    })

    const token = 'tok_remember_30d'
    const now = Date.now()

    await t.mutation(internal.auth.createSession, {
      userId,
      expectedHash: 'dummyHash',
      token,
      rememberMe: true,
    })

    const session = await t.run(async (ctx) => {
      return await ctx.db.query('userSessions').withIndex('by_token', (q) => q.eq('token', token)).first()
    })

    expect(session).toBeTruthy()
    const thirtyDaysMs = 30 * 24 * 60 * 60_000
    // Session expiration should be ~30 days in the future
    expect(session!.expiresAt).toBeGreaterThanOrEqual(now + thirtyDaysMs - 5000)
    expect(session!.expiresAt).toBeLessThanOrEqual(now + thirtyDaysMs + 60000)
  })

  test('createSession with rememberMe=false grants 8 hours lifetime', async () => {
    const t = convexTest(schema, modules)
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert('users', {
        name: 'Recepção Temporária',
        email: 'recepcao@test.invalid',
        role: 'reception',
        passwordHash: 'dummyHash',
        salt: 'dummySalt',
        active: true,
        createdAt: Date.now(),
      })
    })

    const token = 'tok_ephemeral_8h'
    const now = Date.now()

    await t.mutation(internal.auth.createSession, {
      userId,
      expectedHash: 'dummyHash',
      token,
      rememberMe: false,
    })

    const session = await t.run(async (ctx) => {
      return await ctx.db.query('userSessions').withIndex('by_token', (q) => q.eq('token', token)).first()
    })

    expect(session).toBeTruthy()
    const eightHoursMs = 8 * 60 * 60_000
    // Session expiration should be ~8 hours in the future
    expect(session!.expiresAt).toBeGreaterThanOrEqual(now + eightHoursMs - 5000)
    expect(session!.expiresAt).toBeLessThanOrEqual(now + eightHoursMs + 60000)
  })
})
