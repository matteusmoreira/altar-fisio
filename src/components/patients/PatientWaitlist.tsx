import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import { Button } from '@/components/ui/button'
import { formatDateBR } from '@/lib/dateUtils'

export function PatientWaitlist({ portalToken, onChangeSlot }: { portalToken: string; onChangeSlot: (creditId: Id<'replacementCredits'>) => void }) {
  const entries = useQuery(api.waitlist.mine, { portalToken })
  const leave = useMutation(api.waitlist.leave)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const visibleEntries = entries?.filter(e => e.status !== 'cancelled') || []
  if (!visibleEntries.length) return null
  return <section aria-label="Minhas filas de espera" className="space-y-3">
    <h3 className="text-base font-bold">Minha fila de espera</h3>
    <p className="text-xs text-muted-foreground">Encaixes pontuais. Seus horários fixos continuam os mesmos.</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {visibleEntries.map(e => <div key={e._id} className="rounded-2xl border p-4 space-y-2">
      <p className="text-sm font-semibold">{e.schedule ? `${formatDateBR(e.schedule.date)} • ${e.schedule.startTime} às ${e.schedule.endTime}` : 'Sessão removida'}</p>
      <p className="text-xs">{e.status === 'waiting' ? `${e.position}º na fila` : e.status === 'booked' ? 'Reposição — encaixe pela fila. Confira seus compromissos.' : e.reason}</p>
      {e.expiryDate && <p className="text-xs text-muted-foreground">Validade do crédito: {formatDateBR(e.expiryDate)}</p>}
      {e.status === 'waiting' && <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={!!busy} onClick={() => onChangeSlot(e.creditId)}>Trocar horário</Button>
        <Button size="sm" variant="ghost" disabled={!!busy} onClick={async () => {
          setBusy(e._id); setError('')
          try { await leave({ portalToken, entryId: e._id }) } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível sair da fila.') } finally { setBusy(null) }
        }}>Sair da fila</Button>
      </div>}
    </div>)}
  </section>
}
