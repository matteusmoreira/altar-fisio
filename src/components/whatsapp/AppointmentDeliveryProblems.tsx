import { useState } from 'react'
import { useMutation, useQuery } from '@/lib/staffConvex'
import { api } from '@convex/_generated/api'
import { Button } from '@/components/ui/button'

export function AppointmentDeliveryProblems() {
  const jobs = useQuery(api.appointmentNotifications.problems, {})
  const retry = useMutation(api.appointmentNotifications.retry)
  const [busy, setBusy] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')
  if (!jobs?.length) return null
  return <section className="rounded-2xl border border-amber-400 p-4 space-y-3" aria-label="Envios que precisam de atenção">
    <h3 className="font-semibold text-sm">WhatsApp: envios que precisam de atenção</h3>
    <p className="text-xs text-muted-foreground">Os compromissos continuam confirmados. Confira o WhatsApp antes de repetir um envio não confirmado.</p>
    {feedback && <p role="status" className="text-sm">{feedback}</p>}
    {jobs.map(job => <div key={job._id} className="flex flex-wrap items-center justify-between gap-2 border-t pt-2">
      <div className="text-xs min-w-0"><p className="font-semibold">{job.patientName}</p><p className="break-words">{job.error || 'Envio em processamento.'}</p></div>
      {job.status !== 'sending' && <Button size="sm" variant="outline" disabled={!!busy} onClick={async () => {
        if (job.status === 'uncertain' && !window.confirm('Você conferiu o WhatsApp e deseja repetir este envio não confirmado?')) return
        setBusy(job._id); setFeedback('')
        try { await retry({ jobId: job._id }); setFeedback('Reenvio solicitado. Acompanhe o resultado no histórico.') } catch (err) { setFeedback(err instanceof Error ? err.message : 'Não foi possível reenviar.') } finally { setBusy(null) }
      }}>Reenviar</Button>}
    </div>)}
  </section>
}
