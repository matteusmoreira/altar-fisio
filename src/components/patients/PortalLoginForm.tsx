import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { portalErrorMessage } from '@/lib/portalErrors'
import { formatCpf, formatPhone, isValidCpf, isValidPhone, type PatientLoginType } from '../../../shared/patientIdentity'

export function PortalLoginForm({ onLogin }: { onLogin: (args: { type: PatientLoginType; identifier: string; password: string }) => Promise<void> }) {
  const [type, setType] = useState<PatientLoginType>('cpf')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return <form className="space-y-5 text-left" onSubmit={async event => {
    event.preventDefault()
    if (busy) return
    setError('')
    if (!(type === 'cpf' ? isValidCpf(identifier) : isValidPhone(identifier))) {
      setError(type === 'cpf' ? 'Informe um CPF válido.' : 'Informe um telefone válido com DDD.')
      return
    }
    setBusy(true)
    try { await onLogin({ type, identifier, password }); setPassword('') }
    catch (failure) { setError(portalErrorMessage(failure)) }
    finally { setBusy(false) }
  }}>
    <fieldset disabled={busy} className="space-y-2">
      <legend className="text-sm font-medium mb-2">Entrar com</legend>
      <div className="grid grid-cols-2 gap-2">
        {(['cpf', 'phone'] as const).map(option => <Button key={option} type="button" aria-pressed={type === option} variant={type === option ? 'default' : 'outline'} className="h-11" onClick={() => { setType(option); setIdentifier(''); setError('') }}>{option === 'cpf' ? 'CPF' : 'Telefone'}</Button>)}
      </div>
    </fieldset>
    <div className="space-y-2">
      <label htmlFor="portal-identifier" className="text-sm font-medium">{type === 'cpf' ? 'CPF' : 'Telefone com DDD'}</label>
      <Input id="portal-identifier" name="username" inputMode="numeric" autoComplete="username" placeholder={type === 'cpf' ? '000.000.000-00' : '(00) 00000-0000'} value={identifier} disabled={busy} required className="h-12 text-base" onChange={event => setIdentifier(type === 'cpf' ? formatCpf(event.target.value) : formatPhone(event.target.value))} />
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
