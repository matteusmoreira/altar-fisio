export const DEFAULT_INSURANCE_PARTNERS = [
  { id: "Unimed", name: "Unimed", logo: "/assets/convenios/unimed.svg" },
  { id: "Amil", name: "Amil", logo: "/assets/convenios/amil.svg" },
  { id: "Saúde Petrobras", name: "Saúde Petrobras", logo: "/assets/convenios/petrobras.svg" },
  { id: "Bradesco Saúde", name: "Bradesco Saúde", logo: "/assets/convenios/bradesco.svg" },
  { id: "SulAmérica", name: "SulAmérica", logo: "/assets/convenios/sulamerica.svg" },
  { id: "BraSeg", name: "BraSeg", logo: "/assets/convenios/braseg.png" },
]
export type InsurancePartner = { id: string; name: string; logo?: string }
