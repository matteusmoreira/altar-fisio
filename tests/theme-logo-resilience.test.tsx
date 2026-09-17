// @vitest-environment jsdom
import React from 'react'
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { AppLayout } from '../src/components/layout/AppLayout'

let currentMockSettings = {
  mode: 'light',
  colorPreset: 'emerald',
  primaryColor: '#10b981',
  clinicName: 'Clínica de Fisioterapia Dr Marcelo',
  clinicSubtitle: 'RPG | Pilates | Fisioterapia',
  logoUrl: 'https://exuberant-guanaco-180.convex.cloud/api/storage/a4baf116-4cb4-4fe1-8756-6c7293064348' as string | undefined,
}

vi.mock('convex/react', () => ({
  useQuery: vi.fn(() => currentMockSettings),
  useMutation: vi.fn(() => vi.fn()),
  useAction: vi.fn(() => vi.fn()),
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: { name: 'Matteus Moreira', role: 'admin' },
    role: 'admin',
    canAccessSection: () => true,
    logout: vi.fn(),
    login: vi.fn(),
    isAuthenticated: true,
    token: 'test-token',
  })),
}))

describe('Resiliência do Logotipo no Menu Lateral', () => {
  let storageMap: Record<string, string> = {}

  beforeEach(() => {
    storageMap = {
      altar_fisio_theme: JSON.stringify({
        mode: 'light',
        preset: 'emerald',
        clinicName: 'Clínica de Fisioterapia Dr Marcelo',
        clinicSubtitle: 'RPG | Pilates | Fisioterapia',
        logoUrl: 'blob:https://clinicadrmarcelo.vercel.app/aea1e102-5481-4a41-a08d-a8d40aa9745c',
      }),
    }

    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => storageMap[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        storageMap[key] = value
      }),
      removeItem: vi.fn((key: string) => {
        delete storageMap[key]
      }),
      clear: vi.fn(() => {
        storageMap = {}
      }),
    })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  test('ignora blob legado do localStorage e renderiza a URL oficial do Convex na sidebar', async () => {
    const { ThemeProvider } = await import('../src/contexts/ThemeContext')

    render(
      <ThemeProvider>
        <AppLayout currentSection="dashboard" onNavigate={vi.fn()}>
          <div>Conteúdo</div>
        </AppLayout>
      </ThemeProvider>
    )

    // Deve renderizar a imagem do logotipo do servidor Convex
    const logos = screen.getAllByRole('img')
    const officialLogo = logos.find(
      (img) => img.getAttribute('src') === 'https://exuberant-guanaco-180.convex.cloud/api/storage/a4baf116-4cb4-4fe1-8756-6c7293064348'
    )
    expect(officialLogo).toBeTruthy()

    // O blob quebrado do localStorage NÃO deve estar em nenhuma imagem
    const brokenBlobLogo = logos.find(
      (img) => img.getAttribute('src')?.startsWith('blob:')
    )
    expect(brokenBlobLogo).toBeUndefined()

    // O fallback de texto da marca não deve ser exibido quando a logo é válida
    expect(screen.queryByText('RPG | Pilates | Fisioterapia')).toBeNull()
  })

  test('localStorage salvo nunca inclui a chave logoUrl nem blobs', async () => {
    const { ThemeProvider } = await import('../src/contexts/ThemeContext')

    render(
      <ThemeProvider>
        <AppLayout currentSection="dashboard" onNavigate={vi.fn()}>
          <div>Conteúdo</div>
        </AppLayout>
      </ThemeProvider>
    )

    const savedTheme = JSON.parse(storageMap['altar_fisio_theme'] || '{}')
    expect(savedTheme.logoUrl).toBeUndefined()
    expect(savedTheme.mode).toBe('light')
    expect(savedTheme.preset).toBe('emerald')
  })
})
