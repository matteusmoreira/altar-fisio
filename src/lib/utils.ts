import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { isValidPhone } from '../../shared/patientIdentity'
/** Máscara brasileira compartilhada, com suporte ao prefixo +55. */
export { formatPhone as formatPhoneBR } from '../../shared/patientIdentity'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Remove a formatação preservando o DDI, quando informado. */
export function cleanPhoneDigits(val: string): string {
  return val.replace(/\D/g, "")
}

export function isValidBrazilianPhone(val: string): boolean {
  return isValidPhone(val)
}
