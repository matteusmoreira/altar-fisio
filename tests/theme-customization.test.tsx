// @vitest-environment jsdom
import React from 'react'
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import { ThemeProvider, useTheme, normalizeToHex, PRESET_COLORS } from '../src/contexts/ThemeContext'
import { ThemeCustomizerModal } from '../src/components/layout/ThemeCustomizerModal'

// Mock do Convex useQuery
const mockSettings = {
  mode: 'light',
  colorPreset: 'emerald',
  primaryColor: '158 64% 38%',
  clinicName: 'Altar Fisio',
  clinicSubtitle: 'Dr. Marcelo - Fisio, Pilates & RPG',
  logoUrl: undefined,
}

vi.mock('convex/react', () => ({
  useQuery: vi.fn(() => mockSettings),
}))

describe('normalizeToHex', () => {
  test('normaliza HSL emerald legado para o hex #10b981', () => {
    expect(normalizeToHex('158 64% 38%')).toBe('#10b981')
  })

  test('preserva hex válido de 6 dígitos', () => {
    expect(normalizeToHex('#0284c7')).toBe('#0284c7')
    expect(normalizeToHex('0284C7')).toBe('#0284c7')
  })

  test('expande hex curto de 3 dígitos', () => {
    expect(normalizeToHex('#fff')).toBe('#ffffff')
    expect(normalizeToHex('123')).toBe('#112233')
  })

  test('reconhece HSL de outros presets como ocean e indigo', () => {
    expect(normalizeToHex(PRESET_COLORS.ocean.hslLight)).toBe(PRESET_COLORS.ocean.hex)
    expect(normalizeToHex(PRESET_COLORS.indigo.hslLight)).toBe(PRESET_COLORS.indigo.hex)
  })

  test('retorna fallback quando cor é inválida ou vazia', () => {
    expect(normalizeToHex(undefined)).toBe('#10b981')
    expect(normalizeToHex('')).toBe('#10b981')
    expect(normalizeToHex('invalido')).toBe('#10b981')
  })
})

describe('ThemeProvider & useTheme', () => {
  let store: Record<string, string> = {}

  beforeEach(() => {
    store = {}
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => store[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key]
      }),
      clear: vi.fn(() => {
        store = {}
      }),
    })
    document.documentElement.className = ''
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    document.documentElement.className = ''
  })

  function TestConsumer() {
    const { theme, setMode, toggleMode, setPreset } = useTheme()
    return (
      <div>
        <span data-testid="mode">{theme.mode}</span>
        <span data-testid="preset">{theme.preset}</span>
        <span data-testid="customHex">{theme.customHex}</span>
        <button onClick={() => setMode('dark')}>Set Dark</button>
        <button onClick={() => setMode('light')}>Set Light</button>
        <button onClick={toggleMode}>Toggle Mode</button>
        <button onClick={() => setPreset('ocean')}>Set Ocean</button>
        <button onClick={() => setPreset('custom', '#6366f1')}>Set Custom</button>
      </div>
    )
  }

  test('inicializa com dados normalizados e permite alternar para modo escuro com persistência', () => {
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    )

    // O primaryColor legado "158 64% 38%" deve ser normalizado para "#10b981"
    expect(screen.getByTestId('customHex').textContent).toBe('#10b981')
    expect(screen.getByTestId('mode').textContent).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)

    // Clica para ativar o Modo Escuro
    act(() => {
      fireEvent.click(screen.getByText('Set Dark'))
    })

    expect(screen.getByTestId('mode').textContent).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    // Verifica que salvou no localStorage
    const saved = JSON.parse(store['altar_fisio_theme'] || '{}')
    expect(saved.mode).toBe('dark')

    // Alterna de volta com toggleMode
    act(() => {
      fireEvent.click(screen.getByText('Toggle Mode'))
    })

    expect(screen.getByTestId('mode').textContent).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  test('permite selecionar cores pré-definidas e cor customizada', () => {
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    )

    // Seleciona preset Ocean
    act(() => {
      fireEvent.click(screen.getByText('Set Ocean'))
    })

    expect(screen.getByTestId('preset').textContent).toBe('ocean')
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe(PRESET_COLORS.ocean.hslLight)

    // Seleciona cor customizada
    act(() => {
      fireEvent.click(screen.getByText('Set Custom'))
    })

    expect(screen.getByTestId('preset').textContent).toBe('custom')
    expect(screen.getByTestId('customHex').textContent).toBe('#6366f1')
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe('239 84% 48%')
  })
})

describe('ThemeCustomizerModal', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    })
    document.documentElement.className = ''
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  test('renderiza opções de modo claro/escuro e permite alternar', () => {
    render(
      <ThemeProvider>
        <ThemeCustomizerModal open={true} onOpenChange={vi.fn()} />
      </ThemeProvider>
    )

    const darkBtn = screen.getByRole('button', { name: /Modo Escuro/i })
    act(() => {
      fireEvent.click(darkBtn)
    })

    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  test('renderiza hex limpo e permite aplicar cor customizada', () => {
    render(
      <ThemeProvider>
        <ThemeCustomizerModal open={true} onOpenChange={vi.fn()} />
      </ThemeProvider>
    )

    const hexInput = screen.getByPlaceholderText('#10b981') as HTMLInputElement
    // Não deve conter a string HSL quebrada "158 64% 38%"
    expect(hexInput.value).toBe('#10b981')

    // Altera para nova cor
    act(() => {
      fireEvent.change(hexInput, { target: { value: '#0284c7' } })
    })

    const applyBtn = screen.getByRole('button', { name: /Aplicar HEX/i })
    act(() => {
      fireEvent.click(applyBtn)
    })

    expect(document.documentElement.style.getPropertyValue('--primary')).toBe('200 98% 39%')
  })
})
