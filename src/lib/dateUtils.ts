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

/**
 * Retorna o intervalo da semana (Segunda a Domingo) para uma data YYYY-MM-DD.
 */
export const getWeekRange = (dateStr: string) => {
  if (!dateStr || !dateStr.includes("-")) {
    dateStr = getTodayDateString()
  }

  const [y, m, d] = dateStr.split("-").map(Number)
  const dt = new Date(y, m - 1, d, 12, 0, 0)
  const dayOfWeek = dt.getDay() // 0: Dom, 1: Seg, ..., 6: Sab
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek

  const mondayStr = addDaysSafe(dateStr, diffToMonday)
  const days: string[] = []
  for (let i = 0; i < 7; i++) {
    days.push(addDaysSafe(mondayStr, i))
  }

  return {
    startDate: days[0], // Segunda-feira
    endDate: days[6],   // Domingo
    days,
  }
}

/**
 * Avança ou retrocede semanas de forma segura.
 */
export const addWeeksSafe = (dateStr: string, weeks: number): string => {
  return addDaysSafe(dateStr, weeks * 7)
}

/**
 * Retorna os dados do mês contendo a data YYYY-MM-DD.
 */
export const getMonthRange = (dateStr: string) => {
  if (!dateStr || !dateStr.includes("-")) {
    dateStr = getTodayDateString()
  }

  const [y, m] = dateStr.split("-").map(Number)
  const startDate = `${y}-${String(m).padStart(2, "0")}-01`
  const lastDay = new Date(y, m, 0, 12, 0, 0).getDate()
  const endDate = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`

  return {
    startDate,
    endDate,
    year: y,
    month: m,
    daysInMonth: lastDay,
  }
}

/**
 * Avança ou retrocede meses de forma pura e segura contra overflow de dias (ex: 31 Jan -> 28 Fev).
 */
export const addMonthsSafe = (dateStr: string, months: number): string => {
  if (!dateStr || !dateStr.includes("-")) {
    dateStr = getTodayDateString()
  }

  const [y, m, d] = dateStr.split("-").map(Number)
  const target = new Date(y, m - 1 + months, 1, 12, 0, 0)
  const targetYear = target.getFullYear()
  const targetMonth = target.getMonth() + 1
  const maxDay = new Date(targetYear, targetMonth, 0, 12, 0, 0).getDate()
  const finalDay = Math.min(d, maxDay)

  return `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(finalDay).padStart(2, "0")}`
}

/**
 * Formata o período de uma semana: "31/08 a 06/09/2026"
 */
export const formatWeekRangeBR = (startDate: string, endDate: string): string => {
  if (!startDate || !endDate) return ""
  const [sy, sm, sd] = startDate.split("-")
  const [ey, em, ed] = endDate.split("-")

  if (sy === ey && sm === em) {
    return `${sd} a ${ed}/${em}/${ey}`
  }
  if (sy === ey) {
    return `${sd}/${sm} a ${ed}/${em}/${ey}`
  }
  return `${sd}/${sm}/${sy} a ${ed}/${em}/${ey}`
}

/**
 * Formata mês e ano por extenso capitalizado: "Setembro de 2026"
 */
export const formatMonthYearBR = (dateStr: string): string => {
  if (!dateStr || !dateStr.includes("-")) return ""
  const [y, m] = dateStr.split("-").map(Number)
  const dt = new Date(y, m - 1, 1, 12, 0, 0)

  const formatted = dt.toLocaleDateString("pt-BR", {
    timeZone: CLINIC_TIMEZONE,
    month: "long",
    year: "numeric",
  })

  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

export interface CalendarDayCell {
  date: string
  dayNumber: number
  isCurrentMonth: boolean
  isToday: boolean
  isWeekend: boolean
}

/**
 * Constrói a matriz completa de células (Seg-Dom) para renderizar a grade mensal com 35 ou 42 dias.
 */
export const getMonthCalendarGrid = (dateStr: string): CalendarDayCell[] => {
  if (!dateStr || !dateStr.includes("-")) {
    dateStr = getTodayDateString()
  }

  const [y, m] = dateStr.split("-").map(Number)
  const todayStr = getTodayDateString()
  const daysInMonth = new Date(y, m, 0, 12, 0, 0).getDate()

  // Dia da semana do 1º dia do mês (0: Dom, 1: Seg, ..., 6: Sab)
  const firstDayOfWeek = new Date(y, m - 1, 1, 12, 0, 0).getDay()
  // No padrão Segunda a Domingo: Segunda = 0, ..., Domingo = 6
  const leadingDays = (firstDayOfWeek + 6) % 7

  const cells: CalendarDayCell[] = []

  // Dias do mês anterior para completar a primeira semana
  const prevMonthDate = new Date(y, m - 2, 1, 12, 0, 0)
  const prevMonthYear = prevMonthDate.getFullYear()
  const prevMonthMonth = prevMonthDate.getMonth() + 1
  const prevMonthTotalDays = new Date(prevMonthYear, prevMonthMonth, 0, 12, 0, 0).getDate()

  for (let i = leadingDays - 1; i >= 0; i--) {
    const dayNum = prevMonthTotalDays - i
    const dStr = `${prevMonthYear}-${String(prevMonthMonth).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`
    const dt = new Date(prevMonthYear, prevMonthMonth - 1, dayNum, 12, 0, 0)
    const dow = dt.getDay()
    cells.push({
      date: dStr,
      dayNumber: dayNum,
      isCurrentMonth: false,
      isToday: dStr === todayStr,
      isWeekend: dow === 0 || dow === 6,
    })
  }

  // Dias do mês atual
  for (let d = 1; d <= daysInMonth; d++) {
    const dStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
    const dt = new Date(y, m - 1, d, 12, 0, 0)
    const dow = dt.getDay()
    cells.push({
      date: dStr,
      dayNumber: d,
      isCurrentMonth: true,
      isToday: dStr === todayStr,
      isWeekend: dow === 0 || dow === 6,
    })
  }

  // Dias do próximo mês para fechar a última linha (múltiplo de 7: 35 ou 42)
  const nextMonthDate = new Date(y, m, 1, 12, 0, 0)
  const nextMonthYear = nextMonthDate.getFullYear()
  const nextMonthMonth = nextMonthDate.getMonth() + 1

  const remainingDays = (7 - (cells.length % 7)) % 7
  for (let d = 1; d <= remainingDays; d++) {
    const dStr = `${nextMonthYear}-${String(nextMonthMonth).padStart(2, "0")}-${String(d).padStart(2, "0")}`
    const dt = new Date(nextMonthYear, nextMonthMonth - 1, d, 12, 0, 0)
    const dow = dt.getDay()
    cells.push({
      date: dStr,
      dayNumber: d,
      isCurrentMonth: false,
      isToday: dStr === todayStr,
      isWeekend: dow === 0 || dow === 6,
    })
  }

  return cells
}

