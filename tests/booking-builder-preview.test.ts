import { readFileSync } from "node:fs"
import { describe, expect, test } from "vitest"

const builderSource = readFileSync(
  new URL("../src/pages/BookingBuilderPage.tsx", import.meta.url),
  "utf8"
)

const publicBookingSource = readFileSync(
  new URL("../src/pages/PublicBookingPage.tsx", import.meta.url),
  "utf8"
)

describe("prévia do construtor de agendamento", () => {
  test("renderiza a própria agenda pública em vez de manter um fluxo simulado duplicado", () => {
    expect(builderSource).toContain('src={`${publicUrl}?preview=builder`}')
    expect(builderSource).toContain('sandbox="allow-scripts allow-same-origin"')
    expect(builderSource).not.toContain('"08:00", "09:00", "14:00", "16:00"')
    expect(builderSource).not.toContain("Studio Pilates\", \"Fisioterapia Geral")
  })

  test("o modo de prévia impede a criação de uma reserva real", () => {
    expect(publicBookingSource).toContain('urlParams.get("preview") === "builder"')
    expect(publicBookingSource).toContain("nenhum agendamento real será criado pelo construtor")
  })
})
