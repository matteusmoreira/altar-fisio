export function staffErrorMessage(error: unknown, fallback = 'Não foi possível concluir a operação. Atualize a página e tente novamente. Se o problema continuar, contate o suporte.'): string {
  if (error && typeof error === 'object' && 'data' in error && typeof error.data === 'string' && error.data.trim()) {
    return error.data
  }
  return fallback
}
