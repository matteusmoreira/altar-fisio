export function portalErrorMessage(
  error: unknown,
  fallback = 'Não foi possível concluir a solicitação. Verifique os dados ou contate a recepção.'
): string {
  if (error && typeof error === 'object') {
    if ('data' in error) {
      if (typeof error.data === 'string' && error.data.trim()) return error.data
      if (error.data && typeof error.data === 'object' && 'message' in error.data && typeof (error.data as any).message === 'string') {
        return (error.data as any).message
      }
    }
  }

  if (error instanceof Error && typeof error.message === 'string' && error.message.trim()) {
    const msg = error.message
    // Se for mensagem técnica interna do Convex com ConvexError embutido
    const convexErrorMatch = msg.match(/ConvexError:\s*([^\n\r]+)/)
    if (convexErrorMatch && convexErrorMatch[1]?.trim()) {
      return convexErrorMatch[1].trim()
    }
    // Se for erro técnico do transporte do Convex ou Server Error, não exibe o payload bruto
    if (msg.includes('[CONVEX') || msg.includes('Server Error') || msg.includes('Request ID:')) {
      return fallback
    }
    return msg
  }

  return fallback
}

