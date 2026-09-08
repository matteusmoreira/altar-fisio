export function validateProductionUrl(value: string | undefined): string {
  if (!value) throw new Error('VITE_CONVEX_URL é obrigatória no build de produção.')
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.username || url.password || url.hostname === 'localhost' || url.hostname.endsWith('.localhost') || /^127\./.test(url.hostname) || url.hostname === '[::1]') throw new Error('VITE_CONVEX_URL deve apontar para backend HTTPS de produção.')
  return url.origin
}
