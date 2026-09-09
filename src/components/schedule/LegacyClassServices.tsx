import { useState } from 'react'
import { useQuery, useMutation } from '@/lib/staffConvex'
import { api } from '@convex/_generated/api'
import { Button } from '@/components/ui/button'
import type { Id } from '@convex/_generated/dataModel'
export function LegacyClassServices() {
  const rows = useQuery(api.schedules.unlinkedClassSeries)
  const services = useQuery(api.services.listServices)
  const link = useMutation(api.schedules.linkClassSeriesService)
  const [selected, setSelected] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  if (!rows?.length) return null
  return <section className="border rounded-xl p-5 space-y-3"><h2 className="font-bold">Tratamento das turmas existentes</h2><p className="text-sm text-muted-foreground">Vincule as séries antigas ao serviço dos planos. Quando há mais de um serviço compatível, o paciente só verá a turma após este ajuste.</p>{rows.map(row => <div key={row.recurringGroupId} className="border rounded-lg p-3 space-y-2"><p className="font-medium">{row.title} · {row.count} encontros</p><select aria-label={`Tratamento de ${row.title}`} className="w-full border rounded-lg p-2 bg-background" value={selected[row.recurringGroupId] ?? ''} onChange={e => setSelected({ ...selected, [row.recurringGroupId]: e.target.value })}><option value="">Selecione o tratamento</option>{services?.filter(s => s.active && s.modality === 'turma' && s.specialty === row.specialty).map(s => <option key={s._id} value={s._id}>{s.name}</option>)}</select><Button disabled={busy || !selected[row.recurringGroupId]} onClick={async () => { setBusy(true); setError(''); try { await link({ recurringGroupId: row.recurringGroupId, serviceId: selected[row.recurringGroupId] as Id<'services'> }) } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível vincular.') } finally { setBusy(false) } }}>Vincular tratamento</Button></div>)}{error && <p role="alert">{error}</p>}</section>
}
