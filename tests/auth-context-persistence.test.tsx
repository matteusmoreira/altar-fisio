// @vitest-environment jsdom
import React from 'react'
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'
import { AuthProvider, useAuth } from '../src/contexts/AuthContext'

const mockLoginAction = vi.fn()
const mockLogoutMutation = vi.fn()
let mockUserQuery: any = null

vi.mock('convex/react', () => ({
  useQuery: vi.fn(() => mockUserQuery),
  useAction: vi.fn(() => mockLoginAction),
  useMutation: vi.fn(() => mockLogoutMutation),
}))

let localStore = new Map<string, string>()
let sessionStore = new Map<string, string>()

describe('AuthContext Persistence and Token Storage', () => {
  beforeEach(() => {
    localStore = new Map<string, string>()
    sessionStore = new Map<string, string>()
    mockLoginAction.mockReset()
    mockLogoutMutation.mockReset()
    mockUserQuery = { id: 'u1', name: 'Dr Marcelo', email: 'marcelo@altarfisio.com.br', role: 'admin' }

    const mockLocal = {
      getItem: (key: string) => localStore.get(key) ?? null,
      setItem: (key: string, value: string) => { localStore.set(key, value) },
      removeItem: (key: string) => { localStore.delete(key) },
      clear: () => { localStore.clear() },
    }
    const mockSession = {
      getItem: (key: string) => sessionStore.get(key) ?? null,
      setItem: (key: string, value: string) => { sessionStore.set(key, value) },
      removeItem: (key: string) => { sessionStore.delete(key) },
      clear: () => { sessionStore.clear() },
    }

    vi.stubGlobal('localStorage', mockLocal)
    vi.stubGlobal('sessionStorage', mockSession)
    Object.defineProperty(window, 'localStorage', { value: mockLocal, configurable: true })
    Object.defineProperty(window, 'sessionStorage', { value: mockSession, configurable: true })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  test('initializes with token from localStorage when app opens (PWA reopen simulation)', () => {
    localStore.set('altar_auth_session_token', 'persisted_pwa_token_123')

    const wrapper = ({ children }: { children: React.ReactNode }) => <AuthProvider>{children}</AuthProvider>
    const { result } = renderHook(() => useAuth(), { wrapper })

    expect(result.current.token).toBe('persisted_pwa_token_123')
  })

  test('login with rememberMe=true (default) stores token and email in localStorage', async () => {
    mockLoginAction.mockResolvedValueOnce({
      token: 'new_token_777',
      user: { id: 'u1', name: 'Dr Marcelo', email: 'marcelo@altarfisio.com.br', role: 'admin' },
    })

    const wrapper = ({ children }: { children: React.ReactNode }) => <AuthProvider>{children}</AuthProvider>
    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      await result.current.login('marcelo@altarfisio.com.br', 'pass123', true)
    })

    expect(localStore.get('altar_auth_session_token')).toBe('new_token_777')
    expect(localStore.get('altar_remembered_email')).toBe('marcelo@altarfisio.com.br')
    expect(sessionStore.get('altar_auth_session_token')).toBeUndefined()
    expect(result.current.token).toBe('new_token_777')
  })

  test('login with rememberMe=false stores token only in sessionStorage', async () => {
    localStore.set('altar_auth_session_token', 'old_local')

    mockLoginAction.mockResolvedValueOnce({
      token: 'ephemeral_token_888',
      user: { id: 'u2', name: 'Recepção', email: 'recepcao@altarfisio.com.br', role: 'reception' },
    })

    const wrapper = ({ children }: { children: React.ReactNode }) => <AuthProvider>{children}</AuthProvider>
    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      await result.current.login('recepcao@altarfisio.com.br', 'pass123', false)
    })

    expect(sessionStore.get('altar_auth_session_token')).toBe('ephemeral_token_888')
    expect(localStore.get('altar_auth_session_token')).toBeUndefined()
    expect(result.current.token).toBe('ephemeral_token_888')
  })

  test('logout removes token from both localStorage and sessionStorage and invokes backend logout', async () => {
    localStore.set('altar_auth_session_token', 'active_token')
    sessionStore.set('altar_auth_session_token', 'active_token')

    mockLogoutMutation.mockResolvedValueOnce({ success: true })

    const wrapper = ({ children }: { children: React.ReactNode }) => <AuthProvider>{children}</AuthProvider>
    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      await result.current.logout()
    })

    expect(mockLogoutMutation).toHaveBeenCalledWith({ token: 'active_token' })
    expect(localStore.get('altar_auth_session_token')).toBeUndefined()
    expect(sessionStore.get('altar_auth_session_token')).toBeUndefined()
    expect(result.current.token).toBeNull()
    expect(result.current.user).toBeNull()
  })

  test('expired or revoked token on backend triggers automatic cleanup of stored tokens', () => {
    localStore.set('altar_auth_session_token', 'expired_token')
    mockUserQuery = null // Backend reports token invalid/expired

    const wrapper = ({ children }: { children: React.ReactNode }) => <AuthProvider>{children}</AuthProvider>
    const { result } = renderHook(() => useAuth(), { wrapper })

    expect(localStore.get('altar_auth_session_token')).toBeUndefined()
    expect(sessionStore.get('altar_auth_session_token')).toBeUndefined()
    expect(result.current.token).toBeNull()
    expect(result.current.user).toBeNull()
  })
})
