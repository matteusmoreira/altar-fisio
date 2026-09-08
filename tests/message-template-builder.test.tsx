// @vitest-environment jsdom
import React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { getFunctionName } from "convex/server"
import { afterEach, beforeEach, expect, test, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  templates: [] as any[],
  settings: {},
  save: vi.fn(),
}))

vi.mock("@/lib/staffConvex", () => ({
  useQuery: (reference: unknown) => {
    const name = getFunctionName(reference as any)
    return name.includes("listTemplates") ? mocks.templates : mocks.settings
  },
  useMutation: () => mocks.save,
}))

import { MessageTemplateBuilder } from "../src/components/whatsapp/MessageTemplateBuilder"

function getCategorySelect() {
  const select = screen
    .getAllByRole("combobox")
    .find((element) => ["reminder_24h", "reminder_2h", "booking_confirmation", "broadcast", "custom"].includes((element as HTMLSelectElement).value))

  expect(select).toBeTruthy()
  return select as HTMLSelectElement
}

function getContentEditor() {
  const editor = screen.getAllByRole("textbox").find((element) => element.tagName === "TEXTAREA")

  expect(editor).toBeTruthy()
  return editor as HTMLTextAreaElement
}

beforeEach(() => {
  mocks.templates = []
  mocks.settings = {}
  mocks.save.mockReset()
})

afterEach(() => cleanup())

test("trocar a categoria de um novo modelo carrega o preset correspondente no editor", () => {
  render(<MessageTemplateBuilder />)

  fireEvent.change(getCategorySelect(), { target: { value: "reminder_2h" } })

  expect(screen.getByDisplayValue("Lembrete 2h com Orientações")).toBeTruthy()
  expect(getContentEditor().value).toContain("Falta pouco para seu atendimento")
  expect(screen.getByText("Botões de Ação Rápida (2/3)")).toBeTruthy()
})

test("trocar a categoria durante a edição preserva o conteúdo já salvo", () => {
  mocks.templates = [
    {
      _id: "template-1",
      title: "Meu modelo personalizado",
      category: "custom",
      type: "text",
      content: "Conteúdo manual que não pode ser perdido",
      footerText: "Rodapé manual",
    },
  ]

  render(<MessageTemplateBuilder />)
  fireEvent.click(screen.getByText("Meu modelo personalizado"))
  fireEvent.change(getCategorySelect(), { target: { value: "reminder_24h" } })

  expect(screen.getByDisplayValue("Meu modelo personalizado")).toBeTruthy()
  expect(getContentEditor().value).toBe("Conteúdo manual que não pode ser perdido")
})
