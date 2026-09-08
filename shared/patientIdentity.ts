export const DEFAULT_PATIENT_PASSWORD = '@mudar123'
export type PatientLoginType = 'cpf' | 'phone'
export const normalizeCpf = (value: string) => value.replace(/\D/g, '')
export function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, '')
  return (digits.length === 12 || digits.length === 13) && digits.startsWith('55') ? digits.slice(2) : digits
}
export function isValidCpf(value: string): boolean {
  const cpf = normalizeCpf(value)
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false
  for (const length of [9, 10]) {
    let sum = 0
    for (let i = 0; i < length; i++) sum += Number(cpf[i]) * (length + 1 - i)
    const digit = (sum * 10) % 11 % 10
    if (digit !== Number(cpf[length])) return false
  }
  return true
}
export const isValidPhone = (value: string) => /^[1-9]\d{9,10}$/.test(normalizePhone(value))
export function formatCpf(value: string): string {
  return normalizeCpf(value).slice(0, 11).replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4')
}
export function formatPhone(value: string): string {
  const digits = normalizePhone(value).slice(0, 11)
  if (!digits) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  const split = digits.length <= 10 ? 6 : 7
  return `(${digits.slice(0, 2)}) ${digits.slice(2, split)}-${digits.slice(split)}`
}

export const normalizeCep = (value: string) => value.replace(/\D/g, '').slice(0, 8)
export function formatCep(value: string): string {
  const digits = normalizeCep(value)
  if (digits.length <= 5) return digits
  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}
