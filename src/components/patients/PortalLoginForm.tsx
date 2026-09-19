import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { portalErrorMessage } from '@/lib/portalErrors'
import { formatPhone, isValidPhone, type PatientLoginType } from '../../../shared/patientIdentity'

export function PortalLoginForm({ onLogin }: { onLogin: (args: { type: PatientLoginType; identifier: string; password: string }) => Promise<void> }) {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  return <form className="space-y-5 text-left" onSubmit={async event => {
    event.preventDefault()
    if (busy) return
    setError('')
    if (!isValidPhone(identifier)) {
      setError('Informe um telefone válido com DDD.')
      return
    }
    setBusy(true)
    try { await onLogin({ type: 'phone', identifier, password }); setPassword('') }
    catch (failure) { setError(portalErrorMessage(failure)) }
    finally { setBusy(false) }
  }}>
    <div className="space-y-2">
      <label htmlFor="portal-identifier" className="text-sm font-medium">WhatsApp / Telefone com DDD</label>
      <Input id="portal-identifier" name="username" inputMode="tel" autoComplete="username" placeholder="(11) 98888-8888" value={identifier} disabled={busy} required className="h-12 text-base" onChange={event => setIdentifier(formatPhone(event.target.value))} />
    </div>
    <div className="space-y-2">
      <label htmlFor="portal-password" className="text-sm font-medium">Senha</label>
      <div className="relative">
        <Input id="portal-password" name="password" type={visible ? 'text' : 'password'} autoComplete="current-password" maxLength={256} required value={password} disabled={busy} onChange={event => setPassword(event.target.value)} className="h-12 pr-12 text-base" />
        <button type="button" aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={visible} onClick={() => setVisible(!visible)} className="absolute right-0 top-0 h-12 w-12 flex items-center justify-center text-muted-foreground rounded-md focus-visible:outline focus-visible:outline-primary">{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button>
      </div>
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button type="submit" disabled={busy} className="w-full h-12">{busy ? 'Entrando…' : 'Entrar'}</Button>
    <p className="text-sm text-muted-foreground text-center leading-relaxed">Para recuperar ou alterar sua senha, entre em contato com a clínica.</p>
  </form>
}

