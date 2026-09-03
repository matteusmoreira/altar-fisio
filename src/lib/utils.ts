import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Aplica máscara de telefone brasileiro dinamicamente:
 * (XX) XXXXX-XXXX (celular com 11 dígitos) ou (XX) XXXX-XXXX (fixo com 10 dígitos).
 * Suporta colagem com código DDI (55) ou sem formatação.
 */
export function formatPhoneBR(val: string): string {
  let digits = val.replace(/\D/g, "")
  // Se veio com DDI 55 na frente e tem 12 ou 13 dígitos, remove o 55 para formatar o DDD + número
  if (digits.length >= 12 && digits.startsWith("55")) {
    digits = digits.slice(2)
  }
  digits = digits.slice(0, 11)
  if (!digits) return ""
  if (digits.length <= 2) {
    return `(${digits}`
  }
  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  }
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`
}

export function cleanPhoneDigits(val: string): string {
  return val.replace(/\D/g, "")
}

export function isValidBrazilianPhone(val: string): boolean {
  const digits = cleanPhoneDigits(val)
  if (digits.length === 10 || digits.length === 11) return true
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) return true
  return false
}
