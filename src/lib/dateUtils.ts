/**
 * Altar Fisio — Utilitários de Data e Horário
 * Fuso Horário Padrão Oficial: America/Sao_Paulo (UTC-3 / Horário de Brasília)
 * Formato Padrão de Exibição: dd/mm/aaaa
 */

export const CLINIC_TIMEZONE = "America/Sao_Paulo"

/**
 * Retorna a data de hoje no formato ISO "YYYY-MM-DD" estritamente no fuso America/Sao_Paulo.
 * Evita o bug de virada de dia quando são 21h+ no Brasil (quando UTC já é o dia seguinte).
 */
export const getTodayDateString = (): string => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: CLINIC_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  return formatter.format(new Date()) // Retorna "YYYY-MM-DD"
}

/**
 * Converte um Date ou timestamp numérico para a string "YYYY-MM-DD" no fuso America/Sao_Paulo.
 */
export const formatDateISOInTz = (dateOrTimestamp: Date | number): string => {
  const d = typeof dateOrTimestamp === "number" ? new Date(dateOrTimestamp) : dateOrTimestamp
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: CLINIC_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  return formatter.format(d)
}

/**
 * Retorna o horário atual "HH:mm" no fuso America/Sao_Paulo.
 */
export const getCurrentTimeString = (): string => {
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: CLINIC_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
  return formatter.format(new Date())
}

/**
 * Retorna o mês atual no formato "YYYY-MM" no fuso America/Sao_Paulo.
 */
export const getCurrentMonthString = (): string => {
  const today = getTodayDateString()
  return today.slice(0, 7)
}

/**
 * Converte qualquer formato de data aceitável (string ISO YYYY-MM-DD, ISO com hora, Date ou timestamp)
 * para o formato oficial brasileiro: dd/mm/aaaa.
 *
 * Tratamento especial para strings "YYYY-MM-DD": parsing puro para eliminar qualquer desvio de fuso.
 */
export const formatDateBR = (
  value: string | Date | number | null | undefined
): string => {
  if (!value) return ""

  if (typeof value === "string") {
    const trimmed = value.trim()
    // Caso 1: String pura "YYYY-MM-DD"
    const isoDateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (isoDateMatch) {
      const [, y, m, d] = isoDateMatch
      return `${d}/${m}/${y}`
    }

    // Caso 2: Já está em formato dd/mm/aaaa
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
      return trimmed
    }

    // Caso 3: String com data e hora ou timestamp
    const parsedDate = new Date(trimmed)
    if (!isNaN(parsedDate.getTime())) {
      return new Intl.DateTimeFormat("pt-BR", {
        timeZone: CLINIC_TIMEZONE,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(parsedDate)
    }

    return trimmed
  }

  // Caso 4: Objeto Date ou timestamp numérico
  const dateObj = typeof value === "number" ? new Date(value) : value
  if (!isNaN(dateObj.getTime())) {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: CLINIC_TIMEZONE,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(dateObj)
  }

  return ""
}

/**
 * Converte data e hora para o formato brasileiro completo: dd/mm/aaaa às HH:mm
 */
export const formatDateTimeBR = (
  value: string | Date | number | null | undefined
): string => {
  if (!value) return ""

  const dateObj =
    typeof value === "string"
      ? new Date(value)
      : typeof value === "number"
      ? new Date(value)
      : value

  if (isNaN(dateObj.getTime())) {
    return String(value)
  }

  const datePart = new Intl.DateTimeFormat("pt-BR", {
    timeZone: CLINIC_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(dateObj)

  const timePart = new Intl.DateTimeFormat("pt-BR", {
    timeZone: CLINIC_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(dateObj)

  return `${datePart} às ${timePart}`
}

/**
 * Converte timestamp ou objeto de data para apenas a hora: HH:mm
 */
export const formatTimeBR = (
  value: string | Date | number | null | undefined
): string => {
  if (!value) return ""

  const dateObj =
    typeof value === "string"
      ? new Date(value)
      : typeof value === "number"
      ? new Date(value)
      : value

  if (isNaN(dateObj.getTime())) return ""

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: CLINIC_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(dateObj)
}

/**
 * Formata data por extenso: "02 de setembro de 2026"
 */
export const formatDateExtendedBR = (
  value: string | Date | number | null | undefined
): string => {
  if (!value) return ""

  let d: Date
  if (typeof value === "string") {
    const parts = value.split("T")[0].split("-")
    if (parts.length === 3) {
      d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0)
    } else {
      d = new Date(value)
    }
  } else if (typeof value === "number") {
    d = new Date(value)
  } else {
    d = value
  }

  if (isNaN(d.getTime())) return ""

  return d.toLocaleDateString("pt-BR", {
    timeZone: CLINIC_TIMEZONE,
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

/**
 * Formata com dia da semana: "Quarta-feira, 02 de setembro de 2026"
 */
export const formatDateWithWeekdayBR = (
  value: string | Date | number | null | undefined
): string => {
  if (!value) return ""

  let d: Date
  if (typeof value === "string") {
    const parts = value.split("T")[0].split("-")
    if (parts.length === 3) {
      d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0)
    } else {
      d = new Date(value)
    }
  } else if (typeof value === "number") {
    d = new Date(value)
  } else {
    d = value
  }

  if (isNaN(d.getTime())) return ""

  const weekday = d.toLocaleDateString("pt-BR", {
    timeZone: CLINIC_TIMEZONE,
    weekday: "long",
  })

  // Capitaliza o dia da semana
  const capitalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1)

  const dateStr = d.toLocaleDateString("pt-BR", {
    timeZone: CLINIC_TIMEZONE,
    day: "2-digit",
    month: "long",
    year: "numeric",
  })

  return `${capitalizedWeekday}, ${dateStr}`
}

/**
 * Adiciona ou subtrai dias de uma data no formato "YYYY-MM-DD" de forma pura e segura.
 * Elimina riscos de salto de horário de verão ou conversão UTC errática.
 */
export const addDaysSafe = (dateStr: string, days: number): string => {
  if (!dateStr || !dateStr.includes("-")) {
    return getTodayDateString()
  }

  const [y, m, d] = dateStr.split("-").map(Number)
  const dt = new Date(y, m - 1, d + days, 12, 0, 0) // usa meio-dia para evitar limites de dia

  const yyyy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, "0")
  const dd = String(dt.getDate()).padStart(2, "0")

  return `${yyyy}-${mm}-${dd}`
}

/**
 * Compara se a data informada é hoje no fuso America/Sao_Paulo.
 */
export const isToday = (dateStr: string): boolean => {
  return dateStr === getTodayDateString()
}
