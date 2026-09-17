/**
 * Utilitário de formatação de nomes de profissionais
 * Utilizado para manter consistência em cards, grades de agendamento e resumos.
 */

/**
 * Formata o nome do profissional para exibição compacta e legível:
 * - Profissionais com títulos/prefixos (Dr., Dr, Dra., Dra, Prof., etc.) são exibidos como "Dr Marcelo", "Dra Larissa".
 * - Demais profissionais são exibidos pelo primeiro nome (ex: "Gustavo", "Claudia").
 * - Remove pontos abreviativos no prefixo para visualização limpa e uniforme.
 */
export function formatProfessionalDisplayName(fullName: string | null | undefined): string {
  if (!fullName) return ''
  const trimmed = fullName.trim()
  if (!trimmed) return ''

  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return parts[0]

  const firstClean = parts[0].toLowerCase().replace('.', '')
  const isPrefix = ['dr', 'dra', 'prof', 'profa', 'doutor', 'doutora'].includes(firstClean)

  if (isPrefix) {
    const prefix = parts[0].replace('.', '')
    const firstName = parts[1] || ''
    return `${prefix} ${firstName}`.trim()
  }

  return parts[0]
}
