export type MessageRun = { text: string; bold?: boolean; italic?: boolean; href?: string }
export type MessageBlock = { type: 'paragraph' | 'bullet'; runs: MessageRun[] }
export const DEFAULT_PORTAL_MESSAGE: MessageBlock[] = [{ type: 'paragraph', runs: [{ text: 'Os agendamentos estão sendo realizados pela nossa equipe. Entre em contato com a clínica para agendar, remarcar ou solicitar uma reposição.' }] }]
export function safeMessageLink(value: string) {
  try { const url = new URL(value); return ['https:', 'http:', 'mailto:', 'tel:'].includes(url.protocol) ? url.href : undefined } catch { return undefined }
}
export function validatePortalMessage(value: unknown): MessageBlock[] {
  if (!Array.isArray(value) || value.length > 100 || JSON.stringify(value).length > 20000) throw new Error('Mensagem inválida ou muito longa.')
  return value.map(block => {
    if (!block || !['paragraph', 'bullet'].includes(block.type) || !Array.isArray(block.runs) || block.runs.length > 200) throw new Error('Formatação de mensagem inválida.')
    return { type: block.type, runs: block.runs.map((run: MessageRun) => {
      if (!run || typeof run.text !== 'string' || (run.bold !== undefined && typeof run.bold !== 'boolean') || (run.italic !== undefined && typeof run.italic !== 'boolean')) throw new Error('Texto inválido.')
      if (run.href !== undefined && (typeof run.href !== 'string' || !safeMessageLink(run.href))) throw new Error('Link inválido. Use HTTPS, telefone ou e-mail.')
      return { text: run.text, ...(run.bold ? { bold: true } : {}), ...(run.italic ? { italic: true } : {}), ...(run.href ? { href: safeMessageLink(run.href) } : {}) }
    }) }
  })
}
export function messageText(value: MessageBlock[]) { return value.flatMap(b => b.runs.map(r => r.text)).join(' ').trim() }
