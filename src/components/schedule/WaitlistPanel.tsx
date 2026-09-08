import { useState } from 'react'
import { useMutation, useQuery } from '@/lib/staffConvex'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import { Button } from '@/components/ui/button'
import { formatDateBR } from '@/lib/dateUtils'
import { formatPhone, isValidPhone } from '../../../shared/patientIdentity'

export function WaitlistPanel({ scheduleId }: { scheduleId: Id<'schedules'> }) {
  const { user } = useAuth()
  const canManage = user?.role === 'admin' || user?.role === 'reception'
  const entries = useQuery(api.waitlist.forStaff, { scheduleId })
  const patients = useQuery(api.patients.listPatients, canManage ? {} : 'skip')
  const [patientId, setPatientId] = useState<Id<'patients'> | ''>('')
  const credits = useQuery(api.waitlist.staffCredits, patientId ? { patientId } : 'skip')
  const [creditId, setCreditId] = useState<Id<'replacementCredits'> | ''>('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  const join = useMutation(api.waitlist.staffJoin)
  const leave = useMutation(api.waitlist.staffLeave)
  const retry = useMutation(api.appointmentNotifications.retry)
  const execute = async (operation: () => Promise<unknown>) => {
    setBusy(true); setFeedback('')
    try { await operation(); setFeedback('Fila atualizada.') } catch (err) { setFeedback(err instanceof Error ? err.message : 'Não foi possível atualizar a fila.') } finally { setBusy(false) }
  }
  const waiting = entries?.filter(e => e.status === 'waiting') || []
  const selectedPatient = patients?.find(p => p._id === patientId)
  return <section className="border-t pt-4 space-y-3" aria-label="Fila de espera da sessão">
    <h3 className="font-semibold text-sm">Fila de espera · {waiting.length}</h3>
    <p className="text-xs text-muted-foreground">Um encaixe por crédito, por ordem de entrada, até 90 minutos antes.</p>
    {feedback && <p role="status" className="text-xs break-words">{feedback}</p>}
    {entries === undefined ? <p className="text-xs">Carregando fila…</p> : waiting.length === 0 ? <p className="text-xs text-muted-foreground">Ninguém aguardando esta sessão.</p> : waiting.map((e, index) => <div key={e._id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-xs">
      <span>{index + 1}º · {e.patientName}</span>
      {canManage && <Button size="sm" variant="ghost" disabled={busy} onClick={() => execute(() => leave({ entryId: e._id }))}>Retirar</Button>}
    </div>)}
    {entries?.flatMap(e => e.jobs.map(job => <div key={job._id} role="status" className="rounded-xl border border-amber-400 p-3 text-xs space-y-2">
      <p>{e.patientName}: {job.error || 'Envio em processamento. Confira o histórico.'}</p>
      {canManage && job.status !== 'sending' && <Button size="sm" variant="outline" disabled={busy} onClick={() => {
        if (job.status === 'uncertain' && !window.confirm('O provedor pode ter enviado esta mensagem. Você conferiu o WhatsApp e deseja reenviar?')) return
        void execute(() => retry({ jobId: job._id }))
      }}>Reenviar aviso</Button>}
    </div>))}
    {canManage && <div className="grid gap-2">
      <label className="text-xs font-medium">Paciente
        <select className="mt-1 w-full min-w-0 rounded-lg border bg-background p-2 text-sm" value={patientId} onChange={e => { setPatientId(e.target.value as Id<'patients'>); setCreditId('') }}>
          <option value="">Selecione o paciente</option>
          {patients?.filter(p => p.active).map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
        </select>
      </label>
      <label className="text-xs font-medium">Crédito de reposição
        <select className="mt-1 w-full min-w-0 rounded-lg border bg-background p-2 text-sm" disabled={!patientId} value={creditId} onChange={e => setCreditId(e.target.value as Id<'replacementCredits'>)}>
          <option value="">{patientId && credits?.length === 0 ? 'Nenhum crédito disponível' : 'Selecione o crédito'}</option>
          {credits?.map((c, index) => <option key={c._id} value={c._id}>Crédito {index + 1} · válido até {formatDateBR(c.expiryDate)}</option>)}
        </select>
      </label>
      <p className="text-xs text-muted-foreground">Confirme com o paciente a disponibilidade e o WhatsApp cadastrado. Se já existir uma vaga, o encaixe será imediato.</p>
      {selectedPatient && <p className="text-xs">WhatsApp: {formatPhone(selectedPatient.phone) || 'Não cadastrado'}{!isValidPhone(selectedPatient.phone) && ' — corrija o cadastro antes de incluir na fila.'}</p>}
      <Button size="sm" disabled={busy || !patientId || !creditId || !isValidPhone(selectedPatient?.phone || '')} onClick={() => {
        if (patientId && creditId) void execute(() => join({ patientId, creditId, scheduleId }))
      }}>Incluir na fila</Button>
    </div>}
  </section>
}
