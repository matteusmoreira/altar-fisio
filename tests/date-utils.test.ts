import { describe, expect, it } from "vitest"
import { getDurationMinutes } from "@/lib/dateUtils"

describe("getDurationMinutes", () => {
  it("calcula a duração configurada da sessão pelo intervalo do slot", () => {
    expect(getDurationMinutes("07:00", "07:30")).toBe(30)
  })

  it("calcula intervalos que atravessam uma hora", () => {
    expect(getDurationMinutes("07:35", "08:05")).toBe(30)
  })
})
