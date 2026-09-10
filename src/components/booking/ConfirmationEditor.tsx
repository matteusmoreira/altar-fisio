import { useEffect, useState } from 'react'
import type { FunctionReturnType } from 'convex/server'
import { api } from '@convex/_generated/api'
import { useMutation } from '@/lib/staffConvex'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DEFAULT_CONFIRMATION, type BookingConfirmation } from '../../../shared/bookingConfirmation'

const textFields = [
  ['confirmedTitle', 'Título quando confirmado'], ['pendingTitle', 'Título quando aguarda aprovação'],
  ['pendingMessage', 'Mensagem quando aguarda aprovação'], ['portalTitle', 'Título do acesso ao portal'],
  ['portalButton', 'Botão do portal'], ['receiptTitle', 'Título do comprovante'],
  ['paymentTitle', 'Título do pagamento'], ['paymentMessage', 'Orientações de pagamento'],
  ['locationTitle', 'Título do local'], ['address', 'Endereço (vazio usa o cadastro da clínica)'],
  ['instructionsTitle', 'Título das orientações'], ['instructionsMessage', 'Orientações para o atendimento'],
  ['calendarButton', 'Botão Google Agenda'], ['whatsappButton', 'Botão WhatsApp'], ['restartButton', 'Botão de novo agendamento'],
] as const
const blocks = [
  ['showPortal', 'Acesso ao portal'], ['showReceipt', 'Comprovante'], ['showPayment', 'Pagamento'],
  ['showLocation', 'Local'], ['showInstructions', 'Orientações'], ['showCalendar', 'Google Agenda'],
  ['showWhatsapp', 'WhatsApp'], ['showRestart', 'Novo agendamento'],
] as const

export function ConfirmationEditor({ config, onPreview }: {
  config: FunctionReturnType<typeof api.bookingBuilder.getBookingConfig> | undefined
  onPreview: (screen: string) => void
}) {
  const update = useMutation(api.bookingBuilder.updateBookingConfig)
  const [draft, setDraft] = useState<BookingConfirmation>(DEFAULT_CONFIRMATION)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const saved = config && 'confirmation' in config ? config.confirmation : undefined
  useEffect(() => { setDraft({ ...DEFAULT_CONFIRMATION, ...saved }) }, [saved])
  const invalid = textFields.some(([key]) => key !== 'address' && !draft[key].trim())
  return <Card className="rounded-2xl">
    <CardHeader>
      <CardTitle>Página de confirmação</CardTitle>
      <CardDescription>Personalize a tela exibida após o envio. A mensagem de sucesso fica em “Salvar Textos”, acima. Dados da reserva e instruções de senha são preenchidos pelo sistema.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      <fieldset disabled={busy || !config} className="space-y-4">
        <legend className="text-sm font-semibold mb-2">Blocos e botões visíveis</legend>
        <div className="grid grid-cols-2 gap-3">
          {blocks.map(([key, label]) => <label key={key} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={draft[key]} onChange={e => setDraft({ ...draft, [key]: e.target.checked })} />{label}</label>)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {textFields.map(([key, label]) => <label key={key} className="block space-y-1 text-xs font-medium">{label}
            <textarea rows={key.endsWith('Message') ? 4 : 2} maxLength={2000} value={draft[key]} onChange={e => setDraft({ ...draft, [key]: e.target.value })} className="block w-full rounded-xl border border-input bg-card p-2 text-sm font-normal" />
          </label>)}
        </div>
      </fieldset>
      <Button disabled={!config || busy || invalid} onClick={async () => {
        if (!config) return
        setBusy(true); setMessage('')
        try {
          await update({ requireApproval: config.requireApproval, steps: config.steps, fields: config.fields, welcomeTitle: config.welcomeTitle, welcomeMessage: config.welcomeMessage, successMessage: config.successMessage, confirmation: draft })
          setMessage('Página de confirmação salva. A prévia usa os dados salvos.'); onPreview('confirmed')
        } catch { setMessage('Não foi possível salvar. Tente novamente.') }
        finally { setBusy(false) }
      }}>{busy ? 'Salvando...' : 'Salvar confirmação'}</Button>
      <p role="status" className="text-sm">{message}</p>
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Prévia com dados fictícios. Salve as alterações antes de visualizar. Os botões externos ficam desativados na prévia.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => onPreview('confirmed')}>Ver confirmação</Button>
          <Button variant="outline" size="sm" onClick={() => onPreview('pending')}>Ver solicitação pendente</Button>
          <Button variant="outline" size="sm" onClick={() => onPreview('form')}>Ver formulário</Button>
        </div>
      </div>
    </CardContent>
  </Card>
}
