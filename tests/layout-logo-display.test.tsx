// @vitest-environment jsdom
import React from 'react'
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import { AppLayout } from '../src/components/layout/AppLayout'
import { LoginPage } from '../src/pages/LoginPage'

let currentMockSettings = {
  mode: 'light',
  colorPreset: 'emerald',
  primaryColor: '#10b981',
  clinicName: 'Clínica de Fisioterapia Dr Marcelo',
  clinicSubtitle: 'RPG | Pilates | Fisioterapia',
  logoUrl: undefined as string | undefined,
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

describe('Exibição de Logotipo sem Texto no AppLayout', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    })
    currentMockSettings.logoUrl = undefined
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  test('quando não há logoUrl configurada, exibe o nome e o subtítulo da clínica como texto', async () => {
    currentMockSettings.logoUrl = undefined

    const { ThemeProvider } = await import('../src/contexts/ThemeContext')

    render(
      <ThemeProvider>
        <AppLayout currentSection="dashboard" onNavigate={vi.fn()}>
          <div>Conteúdo</div>
        </AppLayout>
      </ThemeProvider>
    )

    // O subtítulo deve estar presente na sidebar
    expect(screen.getAllByText('RPG | Pilates | Fisioterapia').length).toBeGreaterThanOrEqual(1)
  })

  test('quando logoUrl é configurada, remove todo o texto da marca na sidebar e exibe apenas a logo', async () => {
    currentMockSettings.logoUrl = 'https://altarfisio.com.br/minha-logo.png'

    const { ThemeProvider } = await import('../src/contexts/ThemeContext')

    render(
      <ThemeProvider>
        <AppLayout currentSection="dashboard" onNavigate={vi.fn()}>
          <div>Conteúdo</div>
        </AppLayout>
      </ThemeProvider>
    )

    // A imagem do logotipo deve estar renderizada na tela com a URL correta
    const logos = screen.getAllByRole('img')
    const customLogo = logos.find((img) => img.getAttribute('src') === 'https://altarfisio.com.br/minha-logo.png')
    expect(customLogo).toBeTruthy()

    // O subtítulo da marca NÃO deve mais existir na sidebar
    expect(screen.queryByText('RPG | Pilates | Fisioterapia')).toBeNull()
  })

  test('se a imagem da logo falhar ao carregar (onError), ativa fallback seguro para o ícone e textos', async () => {
    currentMockSettings.logoUrl = 'https://altarfisio.com.br/logo-quebrada.png'

    const { ThemeProvider } = await import('../src/contexts/ThemeContext')

    render(
      <ThemeProvider>
        <AppLayout currentSection="dashboard" onNavigate={vi.fn()}>
          <div>Conteúdo</div>
        </AppLayout>
      </ThemeProvider>
    )

    const logos = screen.getAllByRole('img')
    const brokenLogo = logos.find((img) => img.getAttribute('src') === 'https://altarfisio.com.br/logo-quebrada.png')
    expect(brokenLogo).toBeTruthy()

    // Dispara erro de carregamento na imagem
    act(() => {
      fireEvent.error(brokenLogo!)
    })

    // Com o erro, o fallback seguro restaura o texto para não ficar em branco nem exibir imagem quebrada
    expect(screen.getAllByText('RPG | Pilates | Fisioterapia').length).toBeGreaterThanOrEqual(1)
  })
})

describe('Exibição de Logotipo no LoginPage', () => {
  afterEach(() => {
    cleanup()
  })

  test('quando logoUrl está presente, exibe a logo sem o título de texto redundante h1 ao lado', async () => {
    currentMockSettings.logoUrl = 'https://altarfisio.com.br/logo.png'
    const { ThemeProvider } = await import('../src/contexts/ThemeContext')

    render(
      <ThemeProvider>
        <LoginPage />
      </ThemeProvider>
    )

    const logos = screen.getAllByRole('img')
    const logoImg = logos.find((img) => img.getAttribute('src') === 'https://altarfisio.com.br/logo.png')
    expect(logoImg).toBeTruthy()

    // Não deve renderizar o h1 com o nome da clínica
    const heading = screen.queryByRole('heading', { name: 'Clínica de Fisioterapia Dr Marcelo' })
    expect(heading).toBeNull()
  })

  test('quando não há logoUrl, renderiza o título de texto h1 com o nome da clínica', async () => {
    currentMockSettings.logoUrl = undefined
    const { ThemeProvider } = await import('../src/contexts/ThemeContext')

    render(
      <ThemeProvider>
        <LoginPage />
      </ThemeProvider>
    )

    const heading = screen.getByRole('heading', { name: 'Clínica de Fisioterapia Dr Marcelo' })
    expect(heading).toBeTruthy()
  })
})
