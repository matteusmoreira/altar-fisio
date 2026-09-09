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

  test("mockup mobile renderiza moldura de smartphone realista com Dynamic Island e barra de status", () => {
    expect(builderSource).toContain("Dynamic Island com lente de câmera frontal e sensor")
    expect(builderSource).toContain("09:41")
    expect(builderSource).toContain("Sinal 5G")
    expect(builderSource).toContain("Home Indicator estilo iOS")
    expect(builderSource).toContain("scrollbar-none")
  })

  test("mockup desktop renderiza moldura de navegador com botões macOS e barra de endereço", () => {
    expect(builderSource).toContain("altarfisio.com.br/agendar")
    expect(builderSource).toContain("Prévia real do agendamento público em desktop")
    expect(builderSource).toContain("1280 px")
  })

  test("controles da prévia incluem alternância, recarregar e abertura em nova aba", () => {
    expect(builderSource).toContain("handleReloadPreview")
    expect(builderSource).toContain("Recarregar Prévia")
    expect(builderSource).toContain("Abrir página pública em tela cheia")
  })
})
