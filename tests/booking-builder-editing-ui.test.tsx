// @vitest-environment jsdom
import React from "react"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"
const mocks = vi.hoisted(() => ({ update: vi.fn().mockResolvedValue({ success: true }), config: {
  requireApproval: false, steps: [
    { id: "triage", title: "Triagem", type: "intake_form", order: 1 },
    { id: "slot", title: "Horário", type: "slot_picker", order: 2 },
    { id: "patient", title: "Dados", type: "patient_info", order: 3 },
  ], fields: [
    { id: "first", stepId: "triage", label: "Queixa", type: "text", required: false, order: 1 },
  ], insurancePartners: [{ id: "one", name: "Plano Teste", logo: "https://example.com/logo.png" }],
} as any }))
vi.mock("@/lib/staffConvex", () => ({ useQuery: () => mocks.config, useMutation: () => mocks.update }))
import { BookingBuilderPage } from "../src/pages/BookingBuilderPage"
import { InsuranceEditor } from "../src/components/booking/InsuranceEditor"
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.restoreAllMocks() })

test("removes only the logo while retaining the insurance plan", async () => {
  render(<InsuranceEditor config={mocks.config} />)
  fireEvent.click(screen.getByRole("button", { name: "Editar Plano Teste" }))
  fireEvent.click(screen.getByRole("button", { name: "Remover logo" }))
  fireEvent.click(screen.getByRole("button", { name: "Salvar convênio" }))
  await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ insurancePartners: [{ id: "one", name: "Plano Teste", logo: undefined }] })))
})

test("adds a named insurance plan without requiring an image", async () => {
  render(<InsuranceEditor config={mocks.config} />)
  fireEvent.click(screen.getByRole("button", { name: "Adicionar convênio" }))
  fireEvent.change(screen.getByRole("textbox", { name: "Nome do convênio" }), { target: { value: "Novo Convênio" } })
  fireEvent.click(screen.getByRole("button", { name: "Salvar convênio" }))
  await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ insurancePartners: expect.arrayContaining([expect.objectContaining({ name: "Novo Convênio" })]) })))
})

test("deletes intake and its questions while showing essential steps as required", async () => {
  vi.spyOn(window, "confirm").mockReturnValue(true)
  render(<BookingBuilderPage />)
  expect(screen.getAllByText("Obrigatória")).toHaveLength(2)
  fireEvent.click(screen.getByRole("button", { name: "Excluir etapa Triagem" }))
  await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ steps: [
    expect.objectContaining({ id: "slot", order: 1 }), expect.objectContaining({ id: "patient", order: 2 }),
  ], fields: [] })))
})
