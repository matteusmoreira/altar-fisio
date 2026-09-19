// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react"
import { describe, test, expect, vi, afterEach } from "vitest"
import { AppLayout } from "../src/components/layout/AppLayout"

vi.mock("@/contexts/ThemeContext", async (importOriginal) => {
  const actual = await importOriginal<any>()
  return {
    ...actual,
    useTheme: () => ({
      theme: {
        clinicName: "Clinica Dr Marcelo",
        clinicSubtitle: "Fisioterapia & Pilates",
        logoUrl: "",
        primaryColor: "emerald",
        mode: "light",
        preset: "emerald",
      },
      toggleMode: vi.fn(),
    }),
  }
})

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: "admin-1",
      name: "Dr. Marcelo",
      email: "marcelo@altarfisio.com.br",
      role: "admin",
      crefito: "CREFITO 2: 40008-F",
    },
    role: "admin",
    canAccessSection: () => true,
    logout: vi.fn(),
  }),
}))

afterEach(() => {
  cleanup()
})

describe("Itens Ocultos da Interface no AppLayout", () => {
  test("não renderiza botões de Portal do Aluno e Página Pública no topo", () => {
    render(
      <AppLayout currentSection="dashboard" onNavigate={vi.fn()}>
        <div>Conteúdo Principal</div>
      </AppLayout>
    )

    // Botões do topo
    expect(screen.queryByTitle(/Abrir Portal do Aluno/i)).toBeNull()
    expect(screen.queryByTitle(/Abrir página pública de agendamento online/i)).toBeNull()
    expect(screen.queryByText("/portal")).toBeNull()
    expect(screen.queryByText("/agendar")).toBeNull()
  })

  test("oculta do menu lateral e drawer os módulos solicitados", () => {
    render(
      <AppLayout currentSection="dashboard" onNavigate={vi.fn()}>
        <div>Conteúdo Principal</div>
      </AppLayout>
    )

    // Itens que devem estar ocultos do menu:
    // 1. Agendamento online
    expect(screen.queryByRole("button", { name: /Agendamentos Online/i })).toBeNull()
    // 2. Prontuário & Avaliações
    expect(screen.queryByRole("button", { name: /Prontuário & Avaliações/i })).toBeNull()
    // 3. Financeiro Interno
    expect(screen.queryByRole("button", { name: /Financeiro Interno/i })).toBeNull()
    // 4. Construtor de agendamento
    expect(screen.queryByRole("button", { name: /Construtor de Agendamento/i })).toBeNull()
  })

  test("mantém os módulos principais visíveis no menu", () => {
    render(
      <AppLayout currentSection="dashboard" onNavigate={vi.fn()}>
        <div>Conteúdo Principal</div>
      </AppLayout>
    )

    expect(screen.getAllByRole("button", { name: /Visão Geral/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole("button", { name: /Agenda & Marcações/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole("button", { name: /Agendamento Rápido/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole("button", { name: /Turmas & Salas/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole("button", { name: /Pacientes & Alunos/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole("button", { name: /Profissionais da Saúde/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole("button", { name: /Laudos/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole("button", { name: /Serviços & Pacotes/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole("button", { name: /Lembretes WhatsApp\/Email/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole("button", { name: /Configurações da Clínica/i }).length).toBeGreaterThan(0)
  })
})
