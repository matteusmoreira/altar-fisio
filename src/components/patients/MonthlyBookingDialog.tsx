import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { getTodayDateString, formatDateBR } from '@/lib/dateUtils'

type Choice = { recurringGroupId: string; dayOfWeek: number }
export function MonthlyBookingDialog({ portalToken, packages, initialPackageId, onClose, onSuccess }: { portalToken: string; packages: { _id: string; packageName: string; status: string }[]; initialPackageId: string | null; onClose: () => void; onSuccess: (message: string) => void }) {
  const [packageId, setPackageId] = useState(initialPackageId ?? '')
  const [month, setMonth] = useState(getTodayDateString().slice(0, 7))
  const [frequency, setFrequency] = useState(2)
  const [choices, setChoices] = useState<Choice[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [requestId, setRequestId] = useState(() => crypto.randomUUID())
  const args = { portalToken, patientPackageId: packageId as Id<'patientPackages'>, month }
  const options = useQuery(api.patientPortal.listMonthlyClasses, packageId && month ? args : 'skip')
  const preview = useQuery(api.patientPortal.previewMonthlyBooking, packageId && month && choices.length === frequency ? { ...args, choices } : 'skip')
  const book = useMutation(api.patientPortal.bookMonthlyClasses)
  const reset = () => { setChoices([]); setError(''); setRequestId(crypto.randomUUID()) }
  const weekdays = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
  return <Dialog open onOpenChange={open => { if (!open && !saving) onClose() }}><DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
    <DialogTitle>Agendar minhas turmas do mês</DialogTitle><DialogDescription>Escolha de 1 a 5 dias por semana. Confira todas as datas antes de reservar.</DialogDescription>
    <label className="text-sm font-medium">Plano<select aria-label="Plano" className="block w-full border rounded-lg p-2 bg-background" value={packageId} onChange={e => { setPackageId(e.target.value); reset() }}><option value="">Selecione seu plano</option>{packages.filter(p => p.status === 'active').map(p => <option key={p._id} value={p._id}>{p.packageName}</option>)}</select></label>
    <label className="text-sm font-medium">Mês<input aria-label="Mês" type="month" min={getTodayDateString().slice(0, 7)} className="block w-full border rounded-lg p-2 bg-background" value={month} onChange={e => { setMonth(e.target.value); reset() }} /></label>
    <fieldset><legend className="text-sm font-medium mb-2">Quantas vezes por semana?</legend><div className="grid grid-cols-5 gap-2">{[1,2,3,4,5].map(n => <Button type="button" key={n} variant={frequency === n ? 'default' : 'outline'} aria-pressed={frequency === n} onClick={() => { setFrequency(n); reset() }}>{n}×</Button>)}</div></fieldset>
    {options && <p className="text-sm">Saldo livre: <strong>{options.freeBalance} sessões</strong>. Selecione {frequency} dias distintos.</p>}
    {packageId && !options && <p role="status">Carregando turmas…</p>}
    {options?.issue && <p role="alert">{options.issue}</p>}
    {options?.groups.length === 0 && <p>Nenhuma turma deste tratamento foi disponibilizada neste mês. Fale com a recepção.</p>}
    <div className="space-y-2">{options?.groups.map(g => {
      const selected = choices.some(c => c.recurringGroupId === g.recurringGroupId && c.dayOfWeek === g.dayOfWeek)
      return <button type="button" key={g.key} aria-pressed={selected} disabled={saving} className={`w-full text-left p-3 rounded-xl border ${selected ? 'border-primary bg-primary/10' : 'border-border'}`} onClick={() => { setError(''); setRequestId(crypto.randomUUID()); setChoices(prev => selected ? prev.filter(c => c.dayOfWeek !== g.dayOfWeek) : [...prev.filter(c => c.dayOfWeek !== g.dayOfWeek), { recurringGroupId: g.recurringGroupId, dayOfWeek: g.dayOfWeek }].slice(-frequency)) }}>
        <strong>{weekdays[g.dayOfWeek]} · {g.startTime}–{g.endTime}</strong><span className="block text-sm">{g.title} · {g.professionalName} · {g.roomName}</span><span className="block text-xs">{g.dates.length} encontros · {Math.min(...g.dates.map(d => d.vacancies))} vagas mínimas nas datas</span>{g.dates.some(d => d.error) && <span className="text-xs text-destructive">Há datas com impedimentos; confira abaixo.</span>}
      </button>
    })}</div>
    {preview && <section className="space-y-2 rounded-xl bg-muted p-3"><h3 className="font-bold">Confira suas datas · {preview.required} novas reservas</h3><ul className="text-sm space-y-1">{preview.dates.map(d => <li key={d.scheduleId}>{formatDateBR(d.date)} {d.alreadyBooked ? '· já reservado' : ''}{d.error ? ` · ${d.error}` : ''}</li>)}</ul>{preview.errors.map(e => <p key={e} role="alert" className="text-sm text-destructive">{e}</p>)}</section>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button disabled={saving || !preview?.canConfirm || preview.required === 0} onClick={async () => { if (!preview) return; setSaving(true); try { const result = await book({ ...args, choices, expectedScheduleIds: preview.dates.map(d => d.scheduleId), requestId }); onSuccess(`${result.createdCount} encontros reservados com sucesso!`); onClose() } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível reservar.'); } finally { setSaving(false) } }}>{saving ? 'Reservando…' : 'Confirmar todas as reservas'}</Button>
  </DialogContent></Dialog>
}
