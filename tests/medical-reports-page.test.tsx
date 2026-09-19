// @vitest-environment jsdom
import React from "react"
import { test, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react"
import { MedicalReportsPage } from "../src/pages/MedicalReportsPage"
import { AppLayout } from "../src/components/layout/AppLayout"
import { OFFICIAL_REPORT_TEMPLATES } from "../src/components/reports/reportTemplates"

const mocks = vi.hoisted(() => ({
  createReport: vi.fn().mockResolvedValue("report_123"),
  deleteReport: vi.fn().mockResolvedValue({ success: true, id: "report_123" }),
  saveTemplate: vi.fn().mockResolvedValue("template_123"),
  deleteTemplate: vi.fn().mockResolvedValue({ success: true, id: "template_123" }),
  reportsList: [
    {
      _id: "rep_1",
      patientName: "João da Silva",
      title: "LAUDO",
      type: "report",
      date: "19/09/2026",
      diagnosticCid: "M54.5 (Dor lombar baixa)",
      conclusion: "encontra-se em tratamento 3 (três) vezes por semana...",
      signedProfessionalName: "Dr. Marcelo S. Santos",
      crefito: "Crefito 2: 40008-F",
      createdAt: Date.now(),
    },
    {
      _id: "rep_2",
      patientName: "Maria Oliveira",
      title: "CLÍNICA DE FISIOTERAPIA",
      type: "certificate",
      date: "19/09/2026",
      conclusion: "Declaro para os devidos fins, que o(a) Sr(a) esteve em nosso consultório...",
      signedProfessionalName: "Dr. Marcelo S. Santos",
      crefito: "Crefito 2: 40008-F",
      createdAt: Date.now(),
    },
  ],
}))

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    role: "admin",
    isAuthenticated: true,
    token: "valid-session-token",
    user: { id: "user_1", name: "Dr. Marcelo S. Santos", role: "admin" },
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
        mode: "light",
        preset: "emerald",
        clinicName: "Clinica Dr Marcelo",
        clinicSubtitle: "Fisioterapia, Studio de Pilates & RPG",
        logoUrl: "https://example.com/logo.png",
        phone: "(22) 9 9999-1417",
        address: "Rodovia Amaral Peixoto, nº 4473 - 3º andar, sala 302, Edifício Comercial Porto Florido II - Centro",
      },
      toggleMode: vi.fn(),
    }),
  }
})

import { getFunctionName } from "convex/server"

vi.mock("@/lib/staffConvex", () => ({
  useQuery: (fn: any, args: any) => {
    if (args === "skip") return undefined
    try {
      const name = getFunctionName(fn)
      if (name === "clinical:listClinicalReports") return mocks.reportsList
      if (name === "clinical:listReportCustomTemplates") return []
      if (name === "clinic:getSettings") {
        return {
          clinicName: "Clinica Dr Marcelo",
          clinicSubtitle: "Fisioterapia, Studio de Pilates & RPG",
          phone: "(22) 9 9999-1417",
          address: "Rodovia Amaral Peixoto, nº 4473 - 3º andar, sala 302",
        }
      }
      if (name === "bookingBuilder:listPublicBookings") return []
    } catch {}
    return []
  },
  useMutation: (fn: any) => {
    try {
      const name = getFunctionName(fn)
      if (name === "clinical:createClinicalReport") return mocks.createReport
      if (name === "clinical:deleteClinicalReport") return mocks.deleteReport
      if (name === "clinical:saveReportCustomTemplate") return mocks.saveTemplate
      if (name === "clinical:deleteReportCustomTemplate") return mocks.deleteTemplate
    } catch {}
    return vi.fn()
  },
  useAction: () => vi.fn(),
}))

vi.mock("@/contexts/ClinicDataContext", () => ({
  useClinicData: () => ({
    patients: [
      { id: "pat_1", name: "Leticia Vitória", phone: "(22) 98888-1111", active: true },
      { id: "pat_2", name: "Carlos Eduardo", phone: "(22) 97777-2222", active: true },
    ],
    professionals: [
      { id: "prof_1", name: "Dr. Marcelo S. Santos", crefito: "Crefito 2: 40008-F", active: true },
    ],
  }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  window.print = vi.fn()
})

afterEach(() => {
  cleanup()
})

test("Sidebar do AppLayout renderiza o item Laudos na lista de navegação", () => {
  render(
    <AppLayout currentSection="dashboard" onNavigate={vi.fn()}>
      <div>Conteúdo</div>
    </AppLayout>
  )

  // Deve haver o item de menu "Laudos"
  const laudosBtn = screen.getAllByRole("button", { name: /Laudos/i })
  expect(laudosBtn.length).toBeGreaterThan(0)
})

test("MedicalReportsPage renderiza o cabeçalho oficial e o modelo de Fisioterapia 3x/semana por padrão", () => {
  render(<MedicalReportsPage />)

  expect(screen.getByText(/Laudos & Declarações/i)).toBeDefined()
  expect(screen.getAllByText(/Fisioterapia 3x\/sem/i).length).toBeGreaterThan(0)

  // O texto padrão do modelo 1 deve estar no textarea
  const textarea = screen.getByPlaceholderText(/Edite o conteúdo que sairá impresso/i) as HTMLTextAreaElement
  expect(textarea.value).toContain("encontra-se em tratamento 3 (três) vezes por semana de Fisioterapia")

  // Carimbo do Dr. Marcelo e CREFITO oficial devem estar visíveis na folha
  expect(screen.getAllByText(/Dr\. Marcelo S\. Santos/i).length).toBeGreaterThan(0)
  expect(screen.getAllByText(/Crefito 2: 40008-F/i).length).toBeGreaterThan(0)
})

test("Permite alternar entre os 5 modelos oficiais das fotos com atualização do texto e dos campos", () => {
  render(<MedicalReportsPage />)

  const textarea = screen.getByPlaceholderText(/Edite o conteúdo que sairá impresso/i) as HTMLTextAreaElement

  // 1. Clicar no modelo Cirurgias & Fraturas
  const cirurgiasBtn = screen.getByRole("button", { name: /Cirurgias & Fraturas/i })
  fireEvent.click(cirurgiasBtn)
  expect(textarea.value).toContain("apresenta histórico de cirurgias, fraturas, entorses ou luxações")

  // 2. Clicar no modelo Fisioterapia Diária
  const diarioBtn = screen.getByRole("button", { name: /Fisioterapia Diária/i })
  fireEvent.click(diarioBtn)
  expect(textarea.value).toContain("encontra-se em tratamento diário de Fisioterapia")

  // 3. Clicar no modelo R.P.G Postural
  const rpgBtn = screen.getByRole("button", { name: /R\.P\.G Postural/i })
  fireEvent.click(rpgBtn)
  expect(textarea.value).toContain("encontra-se em tratamento R.P.G para redução das dores cervicais")

  // 4. Clicar no modelo Declaração de Comparecimento
  const declaracaoBtn = screen.getByRole("button", { name: /Declaração/i })
  fireEvent.click(declaracaoBtn)
  expect(textarea.value).toContain("Declaro para os devidos fins, que o(a) Sr(a)")
  // Campos de horário devem aparecer
  expect(screen.getByText(/Horário Início/i)).toBeDefined()
  expect(screen.getByText(/Horário Fim/i)).toBeDefined()
})

test("Permite selecionar paciente cadastrado ou digitar paciente avulso", () => {
  render(<MedicalReportsPage />)

  // Paciente avulso: marcar checkbox
  const walkInCheckbox = screen.getByLabelText(/Paciente avulso \(sem cadastro\)/i)
  fireEvent.click(walkInCheckbox)

  const walkInInput = screen.getByPlaceholderText(/Digite o nome completo do paciente\.\.\./i) as HTMLInputElement
  fireEvent.change(walkInInput, { target: { value: "Mariana Costa" } })

  // O nome digitado deve refletir na folha de visualização
  expect(screen.getAllByText(/Mariana Costa/i).length).toBeGreaterThan(0)
})

test("Alternador de papel A4 / A5 altera a proporção da folha e toggle de marca d'água funciona", () => {
  render(<MedicalReportsPage />)

  const a5Btn = screen.getByRole("button", { name: /A5 \(Meia folha\)/i })
  fireEvent.click(a5Btn)

  expect(screen.getByText(/Formato A5/i)).toBeDefined()

  const watermarkToggle = screen.getByLabelText(/Marca d'água/i) as HTMLInputElement
  expect(watermarkToggle.checked).toBe(true)
  fireEvent.click(watermarkToggle)
  expect(watermarkToggle.checked).toBe(false)
})

test("Clicar em Imprimir Agora dispara window.print e salva no histórico", async () => {
  render(<MedicalReportsPage initialPatientId="pat_1" />)

  const printBtn = screen.getByRole("button", { name: /Imprimir Agora/i })
  fireEvent.click(printBtn)

  await waitFor(() => {
    expect(mocks.createReport).toHaveBeenCalled()
    expect(window.print).toHaveBeenCalled()
  })
})

test("Aba Histórico exibe relatórios emitidos e permite reimprimir", () => {
  render(<MedicalReportsPage />)

  const historyTabBtn = screen.getByRole("button", { name: /Histórico Salvo/i })
  fireEvent.click(historyTabBtn)

  expect(screen.getByText("João da Silva")).toBeDefined()
  expect(screen.getByText("Maria Oliveira")).toBeDefined()

  const reprintBtns = screen.getAllByRole("button", { name: /Reimprimir/i })
  expect(reprintBtns.length).toBeGreaterThan(0)

  // Ao clicar em reimprimir no primeiro laudo, volta para a aba de emissão com o laudo carregado
  fireEvent.click(reprintBtns[0])
  expect(screen.getByText(/1\. Escolha o Modelo Físico/i)).toBeDefined()
})
