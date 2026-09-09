import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select-native'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { getTodayDateString, formatDateBR } from '@/lib/dateUtils'
import {
  Calendar,
  CalendarCheck,
  CalendarCheck2,
  CalendarDays,
  Clock,
  User,
  MapPin,
  Users,
  Check,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Sparkles,
  Layers,
  Plus,
  Loader2,
  Repeat,
  CalendarX,
} from 'lucide-react'

type Choice = { recurringGroupId: string; dayOfWeek: number }

export function MonthlyBookingDialog({
  portalToken,
  packages,
  initialPackageId,
  onClose,
  onSuccess,
}: {
  portalToken: string
  packages: { _id: string; packageName: string; status: string }[]
  initialPackageId: string | null
  onClose: () => void
  onSuccess: (message: string) => void
}) {
  const [packageId, setPackageId] = useState(initialPackageId ?? '')
  const [month, setMonth] = useState(getTodayDateString().slice(0, 7))
  const [frequency, setFrequency] = useState(2)
  const [choices, setChoices] = useState<Choice[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [requestId, setRequestId] = useState(() => crypto.randomUUID())

  const args = { portalToken, patientPackageId: packageId as Id<'patientPackages'>, month }
  const options = useQuery(api.patientPortal.listMonthlyClasses, packageId && month ? args : 'skip')
  const preview = useQuery(
    api.patientPortal.previewMonthlyBooking,
    packageId && month && choices.length === frequency ? { ...args, choices } : 'skip'
  )
  const book = useMutation(api.patientPortal.bookMonthlyClasses)

  const reset = () => {
    setChoices([])
    setError('')
    setRequestId(crypto.randomUUID())
  }

  const weekdays = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

  return (
    <Dialog open onOpenChange={open => { if (!open && !saving) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto p-5 sm:p-7 gap-5 rounded-3xl border-border/80 shadow-2xl">
        <DialogHeader className="pr-10 text-left">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20 shadow-2xs">
              <CalendarCheck2 className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                Agendar minhas turmas do mês
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Escolha de 1 a 5 dias por semana. Confira todas as datas antes de reservar.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Seleção do Plano e Mês */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-4 rounded-2xl bg-muted/40 dark:bg-muted/20 border border-border/60">
          <label className="block text-xs font-semibold text-foreground/85">
            <span className="flex items-center gap-1.5 mb-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" /> Plano
            </span>
            <Select
              icon={<Layers className="w-4 h-4" />}
              aria-label="Plano"
              value={packageId}
              onChange={e => {
                setPackageId(e.target.value)
                reset()
              }}
            >
              <option value="">Selecione seu plano</option>
              {packages
                .filter(p => p.status === 'active')
                .map(p => (
                  <option key={p._id} value={p._id}>
                    {p.packageName}
                  </option>
                ))}
            </Select>
          </label>

          <label className="block text-xs font-semibold text-foreground/85">
            <span className="flex items-center gap-1.5 mb-1.5">
              <Calendar className="w-3.5 h-3.5 text-primary" /> Mês
            </span>
            <Input
              icon={<Calendar className="w-4 h-4" />}
              aria-label="Mês"
              type="month"
              min={getTodayDateString().slice(0, 7)}
              value={month}
              onChange={e => {
                setMonth(e.target.value)
                reset()
              }}
            />
          </label>
        </div>

        {/* Quantas vezes por semana */}
        <fieldset>
          <legend className="flex items-center gap-1.5 text-xs font-semibold text-foreground/85 mb-2">
            <Repeat className="w-3.5 h-3.5 text-primary" /> Quantas vezes por semana?
          </legend>
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map(n => (
              <Button
                type="button"
                key={n}
                variant={frequency === n ? 'default' : 'outline'}
                aria-pressed={frequency === n}
                aria-label={`${n}×`}
                onClick={() => {
                  setFrequency(n)
                  reset()
                }}
                className={cn(
                  "h-12 flex flex-col items-center justify-center rounded-xl transition-all duration-200",
                  frequency === n
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25 font-bold scale-[1.02]"
                    : "hover:border-primary/40 hover:bg-muted/50"
                )}
              >
                <span className="text-sm sm:text-base font-bold leading-none">{n}×</span>
                <span
                  className={cn(
                    "text-[10px] mt-0.5 font-medium leading-none",
                    frequency === n ? "text-primary-foreground/90" : "text-muted-foreground"
                  )}
                >
                  {n === 1 ? "dia/sem" : "dias/sem"}
                </span>
              </Button>
            ))}
          </div>
        </fieldset>

        {/* Status de Saldo Livre e Seleção */}
        {options && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 p-3.5 rounded-2xl bg-primary/[0.04] border border-primary/15 text-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <p className="text-xs font-semibold text-foreground">
                Saldo livre: <strong>{options.freeBalance} sessões</strong>. Selecione {frequency} {frequency === 1 ? 'dia distinto' : 'dias distintos'}.
              </p>
            </div>
            <div className="self-start sm:self-auto">
              {choices.length === frequency ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200">
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" /> Frequência completa ({choices.length}/{frequency})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200">
                  <Clock className="w-3.5 h-3.5" /> Escolha mais {frequency - choices.length} {frequency - choices.length === 1 ? 'dia' : 'dias'} ({choices.length}/{frequency})
                </span>
              )}
            </div>
          </div>
        )}

        {/* Feedback de Carregamento e Alertas */}
        {packageId && !options && (
          <div className="flex items-center justify-center gap-2.5 p-6 rounded-2xl border border-dashed border-border/80 bg-muted/20 text-muted-foreground text-sm" role="status">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span>Carregando turmas…</span>
          </div>
        )}

        {options?.issue && (
          <div role="alert" className="flex items-start gap-2 p-3.5 rounded-2xl bg-amber-50 text-amber-900 border border-amber-200 text-xs font-medium">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>{options.issue}</span>
          </div>
        )}

        {options?.groups.length === 0 && (
          <div className="flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-dashed border-border/80 bg-muted/20">
            <CalendarX className="w-8 h-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm font-medium text-foreground">
              Nenhuma turma deste tratamento foi disponibilizada neste mês. Fale com a recepção.
            </p>
          </div>
        )}

        {/* Lista de Turmas Disponíveis */}
        <div className="space-y-2.5">
          {options && options.groups.length > 0 && (
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground px-1">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-primary" />
                Turmas Disponíveis ({options.groups.length})
              </span>
              {choices.length > 0 && (
                <span className="text-primary font-medium">
                  {choices.length} de {frequency} {choices.length === 1 ? 'dia escolhido' : 'dias escolhidos'}
                </span>
              )}
            </div>
          )}

          {options?.groups.map(g => {
            const selected = choices.some(c => c.recurringGroupId === g.recurringGroupId && c.dayOfWeek === g.dayOfWeek)
            const minVacancies = Math.min(...g.dates.map(d => d.vacancies))
            const hasImpediment = g.dates.some(d => d.error)

            return (
              <button
                type="button"
                key={g.key}
                aria-pressed={selected}
                disabled={saving}
                className={cn(
                  "w-full text-left p-4 sm:p-5 rounded-2xl border transition-all duration-200 group relative",
                  selected
                    ? "border-primary bg-primary/[0.04] ring-2 ring-primary/20 shadow-xs"
                    : "border-border/80 bg-card hover:border-primary/40 hover:bg-muted/20 hover:shadow-2xs"
                )}
                onClick={() => {
                  setError('')
                  setRequestId(crypto.randomUUID())
                  setChoices(prev =>
                    selected
                      ? prev.filter(c => c.dayOfWeek !== g.dayOfWeek)
                      : [...prev.filter(c => c.dayOfWeek !== g.dayOfWeek), { recurringGroupId: g.recurringGroupId, dayOfWeek: g.dayOfWeek }].slice(-frequency)
                  )
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-primary/10 text-primary border border-primary/15">
                        {weekdays[g.dayOfWeek]}
                      </span>
                      <div className="inline-flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                        <strong className="text-sm sm:text-base font-bold text-foreground">
                          {weekdays[g.dayOfWeek]} · {g.startTime}–{g.endTime}
                        </strong>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground pt-0.5">
                      <span className="font-semibold text-foreground/90">{g.title}</span>
                      <span className="inline-flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-primary/70" />
                        {g.professionalName}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-primary/70" />
                        {g.roomName}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-medium bg-muted text-muted-foreground border border-border/50">
                        <CalendarDays className="w-3 h-3 text-muted-foreground" />
                        {g.dates.length} encontros
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-semibold border",
                          minVacancies > 2
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200/50"
                            : minVacancies > 0
                            ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200/50"
                            : "bg-rose-50 text-rose-700 border-rose-200/50"
                        )}
                      >
                        <Users className="w-3 h-3" />
                        {minVacancies} {minVacancies === 1 ? 'vaga mínima' : 'vagas mínimas'} nas datas
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 pt-0.5">
                    {selected ? (
                      <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xs ring-2 ring-primary/20">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full border-2 border-muted-foreground/30 group-hover:border-primary/50 transition-colors" />
                    )}
                  </div>
                </div>

                {hasImpediment && (
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-destructive bg-destructive/10 px-2.5 py-1.5 rounded-lg border border-destructive/20">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Há datas com impedimentos; confira abaixo.</span>
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Resumo e Conferência de Datas */}
        {preview && (
          <section aria-label="Confira suas datas" className="space-y-3 rounded-2xl bg-gradient-to-b from-primary/[0.04] to-transparent border border-primary/20 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
                  <CalendarCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-foreground">
                    Confira suas datas · {preview.required} novas reservas
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {preview.dates.length} {preview.dates.length === 1 ? 'encontro previsto' : 'encontros previstos'} no mês
                  </p>
                </div>
              </div>
              {preview.required === 0 ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border/60 shrink-0">
                  <Check className="w-3.5 h-3.5 text-emerald-600" /> Já reservadas
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-primary text-primary-foreground shadow-xs shrink-0">
                  <Plus className="w-3.5 h-3.5 stroke-[3]" /> {preview.required} novas
                </span>
              )}
            </div>

            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {preview.dates.map(d => (
                <li
                  key={d.scheduleId}
                  className="flex flex-col gap-2 min-w-0 p-2.5 rounded-xl bg-card border border-border/70 text-xs shadow-2xs hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                    <span className="font-semibold text-foreground">{formatDateBR(d.date)}</span>
                  </div>
                  <div className="space-y-1 text-muted-foreground break-words">
                    <p className="font-semibold text-foreground">{d.startTime}–{d.endTime}</p>
                    <p>Profissional: {d.professionalName}</p>
                    <p>Sala: {d.roomName}</p>
                  </div>
                  <div>
                    {d.alreadyBooked && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/50">
                        <Check className="w-3 h-3 stroke-[2.5]" /> já reservado
                      </span>
                    )}
                    {d.error && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-destructive/10 text-destructive border border-destructive/20">
                        <AlertCircle className="w-3 h-3 shrink-0" /> {d.error}
                      </span>
                    )}
                    {!d.alreadyBooked && !d.error && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
                        <Plus className="w-3 h-3 stroke-[2.5]" /> nova vaga
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            {preview.errors.map(e => (
              <div key={e} role="alert" className="flex items-start gap-2 p-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{e}</span>
              </div>
            ))}
          </section>
        )}

        {/* Mensagem de Erro Geral */}
        {error && (
          <div role="alert" className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Rodapé com Ações */}
        <div className="pt-2 border-t border-border/60 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl h-11 px-5 text-xs font-semibold"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={saving || !preview?.canConfirm || preview.required === 0}
            onClick={async () => {
              if (!preview) return
              setSaving(true)
              try {
                const result = await book({
                  ...args,
                  choices,
                  expectedScheduleIds: preview.dates.map(d => d.scheduleId),
                  requestId,
                })
                onSuccess(`${result.createdCount} encontros reservados com sucesso!`)
                onClose()
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Não foi possível reservar.')
              } finally {
                setSaving(false)
              }
            }}
            className="h-11 px-6 rounded-xl font-bold text-xs sm:text-sm shadow-md shadow-primary/20 gap-2 bg-primary hover:bg-primary/90 text-primary-foreground transition-all"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Reservando…</span>
              </>
            ) : (
              <>
                <CalendarCheck2 className="w-4 h-4" />
                <span>Confirmar todas as reservas</span>
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

