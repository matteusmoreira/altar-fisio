export interface ClinicalSpecialty {
  id: string
  name: string
  description?: string
}

export const DEFAULT_CLINICAL_SPECIALTIES: readonly ClinicalSpecialty[] = [
  { id: "fisioterapia", name: "Fisioterapia Avançada" },
  { id: "pilates", name: "Pilates (Solo & Aparelhos)" },
  { id: "rpg", name: "RPG (Postural)" },
] as const

export function slugifySpecialtyId(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 32) || "especialidade"
  )
}
