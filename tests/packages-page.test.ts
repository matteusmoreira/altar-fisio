import { describe, expect, test } from "vitest"
import { getPackageModalityLabel } from "../src/lib/packageDisplay"
import type { ClinicPackage, ClinicService } from "../src/types"

const packageFixture = {
  id: "package",
  name: "Pilates e RPG",
  serviceId: "service",
  modality: "turma",
  sessionCount: 8,
  validityDays: 30,
  price: 640,
  active: true,
} satisfies ClinicPackage

const serviceFixture = {
  id: "service",
  name: "Pilates em turma",
  modality: "turma",
  specialty: "pilates",
  maxCapacity: 8,
  durationMinutes: 30,
  defaultPrice: 80,
  active: true,
} satisfies ClinicService

describe("rótulo de modalidade do pacote", () => {
  test("exibe a capacidade configurável do serviço vinculado", () => {
    expect(getPackageModalityLabel(packageFixture, [serviceFixture])).toBe("Turma até 8")
    expect(getPackageModalityLabel(packageFixture, [{ ...serviceFixture, maxCapacity: 6 }])).toBe("Turma até 6")
  })

  test("exibe individual conforme o serviço vinculado", () => {
    expect(getPackageModalityLabel(packageFixture, [{ ...serviceFixture, modality: "individual", maxCapacity: 1 }])).toBe("Individual")
  })
})
