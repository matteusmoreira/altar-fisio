// @vitest-environment jsdom
import React from "react"
import { test, expect, vi, afterEach } from "vitest"
import { render, cleanup } from "@testing-library/react"
import { AppLayout } from "../src/components/layout/AppLayout"
import { PrintableReportSheet } from "../src/components/reports/PrintableReportSheet"

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { name: "Dr. Marcelo Santos", crefito: "CREFITO 2: 40008-F" },
    role: "admin",
    canAccessSection: () => true,
    logout: vi.fn(),
  }),
}))

vi.mock("@/contexts/ThemeContext", async (importOriginal) => {
  const actual = await importOriginal<any>()
  return {
    ...actual,
    useTheme: () => ({
      theme: {
        clinicName: "Clinica Dr Marcelo",
        clinicSubtitle: "Fisioterapia, Studio de Pilates & RPG",
        logoUrl: "https://clinicadrmarcelo.com.br/logo.png",
        mode: "light",
        preset: "emerald",
      },
      toggleMode: vi.fn(),
      setMode: vi.fn(),
      setPreset: vi.fn(),
      updateClinicInfo: vi.fn(),
    }),
  }
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

test("AppLayout renders mobile header and bottom navigation with mobile-first responsive classes", () => {
  const { container } = render(
    <AppLayout currentSection="dashboard" onNavigate={vi.fn()}>
      <div data-testid="page-content">Conteúdo</div>
    </AppLayout>
  )

  // Header mobile
  const header = container.querySelector("header.md\\:hidden")
  expect(header).toBeDefined()
  expect(header?.className).toContain("px-3 sm:px-4")

  // Nav inferior móvel
  const nav = container.querySelector("nav.md\\:hidden")
  expect(nav).toBeDefined()
  expect(nav?.className).toContain("w-full max-w-full")

  // Os 5 botões de navegação inferior
  const navButtons = nav?.querySelectorAll("button")
  expect(navButtons?.length).toBe(5)

  // Botões de aba laterais possuem flex-1 min-w-0 e truncate no rótulo
  const lateralButtons = [navButtons![0], navButtons![1], navButtons![3], navButtons![4]]
  lateralButtons.forEach((btn) => {
    expect(btn.className).toContain("flex-1")
    expect(btn.className).toContain("min-w-0")
    expect(btn.querySelector("span")?.className).toContain("truncate")
  })

  // Botão central de início é o botão flutuante estilizado
  const centerButton = navButtons![2]
  expect(centerButton.className).toContain("rounded-full")
  expect(centerButton.className).toContain("bg-primary")
})

test("PrintableReportSheet applies fluid mobile-friendly padding without horizontal overflow", () => {
  const { container } = render(
    <PrintableReportSheet
      template={{
        id: "laudo_fisioterapia_3x",
        name: "Laudo Fisioterapia 3x",
        category: "laudo",
        defaultFrequency: "3x por semana",
        suggestedDuration: "60 dias",
        defaultText: "Paciente {PACIENTE} em tratamento.",
        paperSize: "a4",
      }}
      patientName="Maria da Silva"
      dateStr="19/09/2026"
      bodyText="Paciente Maria da Silva em tratamento de fisioterapia."
    />
  )

  const sheet = container.querySelector("#printable-report-sheet")
  expect(sheet).toBeDefined()
  expect(sheet?.className).toContain("p-4 sm:p-8 md:p-12")
  expect(sheet?.className).toContain("w-full")
})


