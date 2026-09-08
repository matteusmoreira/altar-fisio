import { useState } from 'react'
import { useAction } from '@/lib/staffConvex'
import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DEFAULT_PATIENT_PASSWORD } from '../../../shared/patientIdentity'
import { portalErrorMessage } from '@/lib/portalErrors'

export function PortalAccessSettings({ patientId }: { patientId: Id<'patients'> }) {
  const changePassword = useAction(api.portalAuth.changePassword)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const save = async (value: string) => {
    if (busy) return
    setBusy(true); setError(''); setSuccess('')
    try {
      await changePassword({ patientId, password: value })
      setPassword(''); setConfirmation('')
      setSuccess('Senha atualizada. Os acessos anteriores foram encerrados.')
    } catch (failure) { setError(portalErrorMessage(failure)) }
    finally { setBusy(false) }
  }
  return <section aria-labelledby="portal-access-title" className="rounded-xl border border-border bg-card p-4 space-y-3">
    <h3 id="portal-access-title" className="font-semibold">Acesso ao portal</h3>
    <p className="text-sm text-muted-foreground">O paciente entra com CPF ou telefone em <a className="text-primary underline" href="/portal" target="_blank" rel="noreferrer">Portal do paciente</a>. Apenas administradores podem alterar a senha.</p>
    <form className="space-y-3" onSubmit={event => {
      event.preventDefault()
      if (password !== confirmation) { setSuccess(''); setError('As senhas não coincidem.'); return }
      void save(password)
    }}>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-sm space-y-1 block">Nova senha<Input autoComplete="new-password" type="password" minLength={9} maxLength={256} required disabled={busy} value={password} onChange={event => setPassword(event.target.value)} /></label>
        <label className="text-sm space-y-1 block">Confirmar nova senha<Input autoComplete="new-password" type="password" minLength={9} maxLength={256} required disabled={busy} value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label>
      </div>
      <p className="text-xs text-muted-foreground">Use de 9 a 256 caracteres. A alteração encerra as sessões abertas do paciente.</p>
      <div className="flex flex-col sm:flex-row gap-2">
        <Button disabled={busy} type="submit">{busy ? 'Salvando…' : 'Salvar nova senha'}</Button>
        <Button disabled={busy} type="button" variant="outline" onClick={() => void save(DEFAULT_PATIENT_PASSWORD)}>Redefinir para @mudar123</Button>
      </div>
    </form>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {success && <p role="status" className="text-sm text-primary">{success}</p>}
  </section>
}
