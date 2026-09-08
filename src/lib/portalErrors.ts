export function portalErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'data' in error && typeof error.data === 'string') return error.data
  return 'Não foi possível concluir. Tente novamente ou procure a clínica.'
}
