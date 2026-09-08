/** Cancelar a participação libera a vaga, independentemente de gerar crédito. */
export const occupiesSeat = (participant: { status: string }) => !['absence', 'justified_absence'].includes(participant.status)
