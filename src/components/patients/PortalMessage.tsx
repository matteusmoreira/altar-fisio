import { useEffect, useRef, useState } from 'react'
import { DEFAULT_PORTAL_MESSAGE, safeMessageLink, type MessageBlock, type MessageRun } from '../../../shared/portalMessage'
import { useQuery, useMutation } from '@/lib/staffConvex'
import { api } from '@convex/_generated/api'
import { Button } from '@/components/ui/button'

export function PortalMessage({ value }: { value: MessageBlock[] }) {
  return <div className="space-y-2 break-words text-sm">{value.map((block, i) => <div key={i} className={block.type === 'bullet' ? 'list-item ml-5' : ''}>{block.runs.map((run, j) => {
    const text = <span style={{ fontWeight: run.bold ? 700 : undefined, fontStyle: run.italic ? 'italic' : undefined, whiteSpace: 'pre-wrap' }}>{run.text}</span>
    const href = run.href && safeMessageLink(run.href)
    return href ? <a key={j} href={href} className="underline text-primary" rel="noopener noreferrer">{text}</a> : <span key={j}>{text}</span>
  })}</div>)}</div>
}

function readEditor(root: HTMLElement): MessageBlock[] {
  const blocks: MessageBlock[] = []
  let current: MessageBlock = { type: 'paragraph', runs: [] }
  const flush = () => { if (current.runs.length) blocks.push(current); current = { type: 'paragraph', runs: [] } }
  function walk(node: Node, marks: Omit<MessageRun, 'text'> = {}) {
    if (node.nodeType === Node.TEXT_NODE) { current.runs.push({ text: node.textContent ?? '', ...marks }); return }
    if (!(node instanceof HTMLElement) || ['SCRIPT', 'STYLE', 'IFRAME', 'IMG'].includes(node.tagName)) return
    const block = ['DIV', 'P', 'LI'].includes(node.tagName)
    if (block) { flush(); current.type = node.tagName === 'LI' ? 'bullet' : 'paragraph' }
    const next = { ...marks }
    if (['B', 'STRONG'].includes(node.tagName) || node.style.fontWeight === 'bold') next.bold = true
    if (['I', 'EM'].includes(node.tagName) || node.style.fontStyle === 'italic') next.italic = true
    if (node.tagName === 'A') next.href = safeMessageLink(node.getAttribute('href') ?? '')
    if (node.tagName === 'BR') current.runs.push({ text: '\n', ...next })
    node.childNodes.forEach(child => walk(child, next))
    if (block) flush()
  }
  root.childNodes.forEach(node => walk(node)); flush()
  return blocks
}

export function PortalBookingSettings() {
  const settings = useQuery(api.clinic.getAdminSettings)
  const save = useMutation(api.clinic.updatePortalBooking)
  const [enabled, setEnabled] = useState(true)
  const [message, setMessage] = useState<MessageBlock[]>(DEFAULT_PORTAL_MESSAGE)
  const [feedback, setFeedback] = useState('')
  const [saving, setSaving] = useState(false)
  const editor = useRef<HTMLDivElement>(null)
  const loaded = useRef(false)
  useEffect(() => {
    if (settings === undefined || loaded.current || !editor.current) return
    loaded.current = true
    setEnabled(settings?.portalBookingEnabled !== false)
    const value = settings?.portalBookingMessage ?? DEFAULT_PORTAL_MESSAGE
    setMessage(value)
    editor.current.replaceChildren()
    for (const block of value) {
      const p = document.createElement(block.type === 'bullet' ? 'li' : 'p')
      for (const run of block.runs) {
        const span = document.createElement(run.href && safeMessageLink(run.href) ? 'a' : 'span')
        span.textContent = run.text
        if (span instanceof HTMLAnchorElement) span.href = safeMessageLink(run.href!)!
        if (run.bold) span.style.fontWeight = 'bold'
        if (run.italic) span.style.fontStyle = 'italic'
        p.append(span)
      }
      editor.current.append(p)
    }
  }, [settings])
  const command = (name: string, value?: string) => { editor.current?.focus(); document.execCommand(name, false, value); if (editor.current) setMessage(readEditor(editor.current)) }
  return <section className="rounded-xl border bg-card p-5 space-y-4">
    <h2 className="font-bold text-lg">Portal do paciente</h2>
    <label className="flex items-center gap-3 font-medium"><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />Permitir agendamentos pelo portal</label>
    <p className="text-sm text-muted-foreground">Ao desativar, somente a equipe agenda, remarca e reserva reposições. Os pacientes continuam consultando e desmarcando conforme as regras. O agendamento público de avaliações não muda.</p>
    <label className="block font-medium" id="portal-message-label">Mensagem exibida quando fechado</label>
    <div className="flex flex-wrap gap-2" role="toolbar" aria-label="Formatação da mensagem">
      {([['bold', 'Negrito'], ['italic', 'Itálico'], ['insertUnorderedList', 'Lista']] as const).map(([cmd, label]) => <Button key={cmd} type="button" variant="outline" onMouseDown={e => e.preventDefault()} onClick={() => command(cmd)}>{label}</Button>)}
      <Button type="button" variant="outline" onMouseDown={e => e.preventDefault()} onClick={() => { const href = window.prompt('Endereço do link (https://, mailto: ou tel:)'); if (href) { const safe = safeMessageLink(href); if (safe) command('createLink', safe); else setFeedback('Link inválido.') } }}>Inserir link</Button>
    </div>
    <div ref={editor} role="textbox" aria-labelledby="portal-message-label" aria-multiline contentEditable suppressContentEditableWarning className="min-h-32 rounded-lg border p-3 space-y-2 select-text" onInput={() => editor.current && setMessage(readEditor(editor.current))} onPaste={e => { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain')) }} />
    <div className="rounded-lg bg-muted p-4 space-y-2"><h3 className="font-medium">Prévia para o paciente</h3><PortalMessage value={message} /></div>
    {feedback && <p role="status" className="text-sm">{feedback}</p>}
    <Button type="button" disabled={saving || settings === undefined} onClick={async () => { setSaving(true); try { await save({ enabled, message }); setFeedback('Configuração do portal salva.') } catch (e) { setFeedback(e instanceof Error ? e.message : 'Não foi possível salvar.') } finally { setSaving(false) } }}>{saving ? 'Salvando…' : 'Salvar configuração do portal'}</Button>
  </section>
}
