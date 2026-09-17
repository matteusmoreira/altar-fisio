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

/**
 * Retorna o nome amigável e legível da especialidade sem underscores.
 * Prioriza a lista de especialidades da clínica ou o nome da sala se compatível.
 */
export function formatSpecialtyName(
  specialtyIdOrName?: string | null,
  customSpecialties?: readonly ClinicalSpecialty[] | ClinicalSpecialty[] | null,
  roomName?: string | null
): string {
  if (!specialtyIdOrName && roomName) return roomName
  if (!specialtyIdOrName) return "Sessão"

  const trimmed = specialtyIdOrName.trim()
  const lower = trimmed.toLowerCase()

  // 1. Procura na lista de especialidades fornecidas
  if (customSpecialties && customSpecialties.length > 0) {
    const found = customSpecialties.find(
      (s) => s.id.toLowerCase() === lower || s.name.toLowerCase() === lower
    )
    if (found) return found.name
  }

  // 2. Procura nas especialidades padrão
  const defaultFound = DEFAULT_CLINICAL_SPECIALTIES.find(
    (s) => s.id.toLowerCase() === lower || s.name.toLowerCase() === lower
  )
  if (defaultFound) return defaultFound.name

  // 3. Se o nome da sala coincidir ou tiver relação com o slug
  if (roomName && roomName.trim()) {
    const roomSlug = slugifySpecialtyId(roomName)
    const specSlug = slugifySpecialtyId(trimmed)
    if (roomSlug === specSlug || specSlug.startsWith(roomSlug) || roomSlug.startsWith(specSlug)) {
      return roomName
    }
  }

  // 4. Se contiver underscores, formata limpando os underscores
  if (lower.includes("_")) {
    if (roomName && lower.includes("pilates") && roomName.toLowerCase().includes("pilates")) {
      return roomName
    }
    return lower
      .split("_")
      .filter(Boolean)
      .map((word, idx) => {
        if (idx > 0 && ["e", "de", "do", "da", "em"].includes(word)) {
          return word
        }
        return word.charAt(0).toUpperCase() + word.slice(1)
      })
      .join(" ")
  }

  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}

/**
 * Normaliza o título da turma/sessão para remover underscores e usar o nome legível
 * da sala ou especialidade.
 * Exemplo: "Pilates_e_fortalecimento_muscula 09:00" -> "Pilates e Fortalecimento Muscular 09:00"
 */
export function formatScheduleTitle(
  title?: string | null,
  options?: {
    roomName?: string | null
    specialty?: string | null
    startTime?: string | null
    specialties?: readonly ClinicalSpecialty[] | ClinicalSpecialty[] | null
  }
): string {
  if (!title) {
    const base = options?.roomName || formatSpecialtyName(options?.specialty, options?.specialties)
    return options?.startTime ? `${base} ${options.startTime}` : base
  }

  // Se não tiver underscore, preserva
  if (!title.includes("_")) {
    return title
  }

  // Se o título contiver horário no final (ex: "Pilates_e_fortalecimento_muscula 09:00")
  const timeMatch = title.match(/^(.*?)(?:\s+(\d{1,2}:\d{2}))$/)
  const prefix = timeMatch ? timeMatch[1] : title
  const timeSuffix = timeMatch ? timeMatch[2] : (options?.startTime || "")

  // Se tiver roomName disponível e o prefixo tiver relação com o slug da sala
  let cleanPrefix: string
  if (options?.roomName) {
    const roomSlug = slugifySpecialtyId(options.roomName)
    const prefixSlug = slugifySpecialtyId(prefix)
    if (roomSlug === prefixSlug || prefixSlug.startsWith(roomSlug) || roomSlug.startsWith(prefixSlug)) {
      cleanPrefix = options.roomName
    } else {
      cleanPrefix = formatSpecialtyName(prefix, options?.specialties, options?.roomName)
    }
  } else {
    cleanPrefix = formatSpecialtyName(prefix, options?.specialties, options?.roomName)
  }

  return timeSuffix ? `${cleanPrefix} ${timeSuffix}` : cleanPrefix
}

