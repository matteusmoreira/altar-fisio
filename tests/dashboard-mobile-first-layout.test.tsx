// @vitest-environment jsdom
import React from "react"
import { test, expect, vi, afterEach, beforeEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"

const mocks = vi.hoisted(() => ({
  user: { id: "u1", name: "Dr. Marcelo Santos", role: "admin" },
  rooms: [
    {
      id: "room-pilates",
      name: "Pilates e Fortalecimento Muscular",
      type: "pilates_aparelhos",
      capacity: 5,
      color: "#10b981",
      isActive: true,
    },
    {
      id: "room-marcelo",
      name: "Fisioterapia | Dr Marcelo",
      type: "fisioterapia",
      capacity: 8,
      color: "#0284c7",
      isActive: true,
    },
  ],
  schedules: [
    {
      id: "sch-1",
      date: "2026-09-19",
      startTime: "08:00",
      endTime: "09:00",
      roomId: "room-pilates",
      roomName: "Pilates e Fortalecimento Muscular",
      roomColor: "#10b981",
      professionalName: "Dr. Marcelo",
      title: "Pilates e Fortalecimento Muscular",
      type: "turma",
      maxCapacity: 5,
      participants: [
        {
          id: "p1",
          patientName: "Ana Beatriz",
          patientPhone: "(11) 98888-7777",
          status: "scheduled",
        },
      ],
    },
  ],
}))

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: mocks.user,
    role: "admin",
    isProfessional: false,
  }),
}))

vi.mock("@/lib/staffConvex", () => ({
  useAction: () => vi.fn(),
  useQuery: () => [],
  useMutation: () => vi.fn(),
}))

vi.mock("@/contexts/ClinicDataContext", () => ({
  useClinicData: () => ({
    rooms: mocks.rooms,
    schedules: mocks.schedules,
    transactions: [],
    replacementCredits: [],
    checkIn: vi.fn(),
    cancelWithReplacement: vi.fn(),
    sendWhatsAppReminder: vi.fn(),
  }),
}))

import { DashboardPage } from "../src/pages/DashboardPage"

beforeEach(() => {
  const entries = new Map<string, string>()
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => entries.set(key, value),
    removeItem: (key: string) => entries.delete(key),
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

test("DashboardPage renders mobile-first layout with unconstrained container and responsive action grid", () => {
  const { container } = render(<DashboardPage onNavigate={vi.fn()} />)

  // 1. Container principal deve ter largura total e min-w-0 para nunca transbordar no mobile
  const mainDiv = container.firstChild as HTMLElement
  expect(mainDiv.className).toContain("w-full")
  expect(mainDiv.className).toContain("min-w-0")

  // 2. Saudação deve exibir Dr. Marcelo (não apenas Dr.)
  expect(screen.getByRole("heading", { name: /Dr\. Marcelo/i })).toBeTruthy()

  // 3. Grupo de ações rápidas no topo deve usar grid de 2 colunas no mobile
  const actionsGroup = mainDiv.querySelector(".grid.grid-cols-2")
  expect(actionsGroup).toBeDefined()
  expect(actionsGroup?.className).toContain("sm:flex")

  // 4. Barra de filtros de turno deve permitir rolagem horizontal sem expandir o card
  const shiftFilters = mainDiv.querySelector(".overflow-x-auto")
  expect(shiftFilters).toBeDefined()
  expect(shiftFilters?.className).toContain("w-full")
  expect(shiftFilters?.className).toContain("min-w-0")

  // 5. O campo de busca deve usar largura total no mobile (w-full sm:w-64)
  const searchContainer = mainDiv.querySelector(".relative.w-full.sm\\:w-64")
  expect(searchContainer).toBeDefined()
})
