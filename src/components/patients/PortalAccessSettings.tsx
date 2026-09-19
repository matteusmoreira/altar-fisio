import { useState } from 'react'
import { useAction } from '@/lib/staffConvex'
import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DEFAULT_PATIENT_PASSWORD } from '../../../shared/patientIdentity'
import { portalErrorMessage } from '@/lib/portalErrors'
import { KeyRound, ShieldAlert } from 'lucide-react'

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
  return (
    <section
      aria-labelledby="portal-access-title"
      className="rounded-xl border border-border bg-card shadow-xs overflow-hidden"
    >
      <div className="p-4 pb-3 border-b border-border/60 flex items-center justify-between">
        <h3
          id="portal-access-title"
          className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2"
        >
          <KeyRound className="h-3.5 w-3.5 text-primary" />
          <span>Acesso ao Portal & Redefinição de Senha</span>
        </h3>
      </div>
      <div className="p-4 space-y-3.5 text-xs">
        <p className="text-xs text-muted-foreground leading-relaxed">
          O paciente entra com CPF ou telefone em{' '}
          <a
            className="text-primary underline hover:text-primary/80 font-medium"
            href="/portal"
            target="_blank"
            rel="noreferrer"
          >
            Portal do paciente
          </a>
          . Apenas administradores podem alterar a senha.
        </p>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            if (password !== confirmation) {
              setSuccess('')
              setError('As senhas não coincidem.')
              return
            }
            void save(password)
          }}
        >
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-xs font-medium space-y-1 block">
              <span>Nova senha</span>
              <Input
                autoComplete="new-password"
                type="password"
                minLength={9}
                maxLength={256}
                required
                disabled={busy}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1 h-9 text-xs"
              />
            </label>
            <label className="text-xs font-medium space-y-1 block">
              <span>Confirmar nova senha</span>
              <Input
                autoComplete="new-password"
                type="password"
                minLength={9}
                maxLength={256}
                required
                disabled={busy}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                className="mt-1 h-9 text-xs"
              />
            </label>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Use de 9 a 256 caracteres. A alteração encerra as sessões abertas do paciente.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <Button
              disabled={busy}
              type="submit"
              size="sm"
              className="text-xs h-9 shadow-2xs"
            >
              {busy ? 'Salvando…' : 'Salvar nova senha'}
            </Button>
            <Button
              disabled={busy}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void save(DEFAULT_PATIENT_PASSWORD)}
              className="text-xs h-9 shadow-2xs"
            >
              Redefinir para @mudar123
            </Button>
          </div>
        </form>
        {error && (
          <p role="alert" className="text-xs font-medium text-destructive flex items-center gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </p>
        )}
        {success && (
          <p role="status" className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
            {success}
          </p>
        )}
      </div>
    </section>
  )
}
