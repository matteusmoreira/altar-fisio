import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { useQuery, useMutation } from '@/lib/staffConvex'
import { api } from '@convex/_generated/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select-native'
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Package,
  Hash,
  Repeat,
  Trash2,
  Check,
  AlertTriangle,
  Loader2,
  ArrowLeft,
  CalendarRange,
  CalendarDays,
} from 'lucide-react'
import { PatientSearchPanel } from '@/components/quickBooking/PatientSearchPanel'
import { QuickPatientForm } from '@/components/quickBooking/QuickPatientForm'
import { WeeklyScheduleGrid, type GridSlot, type SelectedSlot } from '@/components/quickBooking/WeeklyScheduleGrid'
import { RoomDrawer } from '@/components/quickBooking/RoomDrawer'
import { ConfirmBookingModal } from '@/components/quickBooking/ConfirmBookingModal'
import { WhatsAppCountdownToast } from '@/components/quickBooking/WhatsAppCountdownToast'
import {
  getTodayDateString,
  addDaysSafe,
  addMonthsSafe,
  formatDateWithWeekdayBR,
  formatMonthYearBR,
} from '@/lib/dateUtils'
import { formatProfessionalDisplayName } from '@/lib/professionalUtils'
import { DEFAULT_CLINICAL_SPECIALTIES } from '../../shared/clinicalSpecialties'

// ─── Helpers de Data (timezone-safe) ────────────────────────────────────────

function getMonday(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dateObj = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  const day = dateObj.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  dateObj.setUTCDate(dateObj.getUTCDate() + diff)
  return dateObj.toISOString().split('T')[0]
}

function shiftWeek(weekStart: string, direction: number): string {
  const [y, m, d] = weekStart.split('-').map(Number)
  const dateObj = new Date(Date.UTC(y, m - 1, d + direction * 7, 12, 0, 0))
  return dateObj.toISOString().split('T')[0]
}

function getCurrentMonth(weekStart: string): string {
  return weekStart.slice(0, 7) // YYYY-MM
}

function formatMonthLabel(month: string): string {
  const [year, m] = month.split('-')
  const MONTHS = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ]
  return `${MONTHS[parseInt(m, 10) - 1]} ${year}`
}

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function estimateRecurringSessions(slots: SelectedSlot[], month: string): number {
  const [year, m] = month.split('-').map(Number)
  const daysInMonth = new Date(year, m, 0).getDate()
  let total = 0
  for (const slot of slots) {
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(Date.UTC(year, m - 1, d, 12, 0, 0))
      if (date.getUTCDay() === slot.dayOfWeek) total++
    }
  }
  return total
}

// ─── Componente Principal ───────────────────────────────────────────────────

interface QuickBookingPageProps {
  onNavigate?: (section: any) => void
}

export function QuickBookingPage({ onNavigate }: QuickBookingPageProps = {}) {
  // State: Paciente
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null)
  const [showQuickRegister, setShowQuickRegister] = useState(false)

  // State: Sessões e Recorrência
  const [sessionCount, setSessionCount] = useState<number>(0)
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null)
  const [isRecurring, setIsRecurring] = useState(false)
  const [specialtyFilter, setSpecialtyFilter] = useState('')

  // State: Modo de Período [ Dia | Semana | Mês ]
  const [periodMode, setPeriodMode] = useState<'day' | 'week' | 'month'>('week')

  // State: Navegação da grade (alinhada rigorosamente com America/Sao_Paulo)
  const today = useMemo(() => getTodayDateString(), [])
  const [weekStart, setWeekStart] = useState(() => getMonday(today))
  const [selectedDay, setSelectedDay] = useState(today)
  const month = getCurrentMonth(weekStart)

  // State: Slots selecionados
  const [selectedSlots, setSelectedSlots] = useState<SelectedSlot[]>([])

  // State: Drawer
  const [drawerSlot, setDrawerSlot] = useState<GridSlot | null>(null)

  // State: Confirmação
  const [showConfirm, setShowConfirm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // State: WhatsApp
  const [showWhatsAppToast, setShowWhatsAppToast] = useState(false)
  const [lastBookingResult, setLastBookingResult] = useState<{ scheduleIds: string[] } | null>(null)

  // State: Remarcação
  const [reschedulingParticipant, setReschedulingParticipant] = useState<{
    participantId: string
    patientName: string
  } | null>(null)

  // ─── Queries ────────────────────────────────────────────────────────────

  const dbClinicalSpecialties = useQuery(api.clinic.getClinicalSpecialties, {})
  const clinicalSpecialties = dbClinicalSpecialties && dbClinicalSpecialties.length > 0
    ? dbClinicalSpecialties
    : DEFAULT_CLINICAL_SPECIALTIES

  useEffect(() => {
    if (specialtyFilter && !clinicalSpecialties.some((s) => s.id === specialtyFilter)) {
      setSpecialtyFilter('')
    }
  }, [clinicalSpecialties, specialtyFilter])

  const gridData = useQuery(api.quickBooking.getWeeklyGridData, {
    weekStart,
    specialtyFilter: specialtyFilter || undefined,
  })

  const patientContext = useQuery(
    api.quickBooking.getPatientBookingContext,
    selectedPatientId ? { patientId: selectedPatientId as any } : 'skip'
  )

  // ─── Mutations / Actions ───────────────────────────────────────────────

  const confirmBooking = useMutation(api.quickBooking.confirmQuickBooking)
  const reschedule = useMutation(api.quickBooking.rescheduleParticipant)
  const addToWaitlist = useMutation(api.quickBooking.addToWaitlistQuick)
  const sendWhatsApp = useMutation(api.quickBooking.sendQuickBookingWhatsApp)

  // ─── Derived ──────────────────────────────────────────────────────────

  const selectedPackage = patientContext?.packages.find((p) => p.id === selectedPackageId)
  const freeBalance = selectedPackage?.freeBalance ?? 0
  const totalEstimated = isRecurring ? estimateRecurringSessions(selectedSlots, month) : selectedSlots.length
  const overBalance = sessionCount > 0 && totalEstimated > sessionCount

  // ─── Handlers ─────────────────────────────────────────────────────────

  const handleSelectPatient = useCallback((patientId: string) => {
    setSelectedPatientId(patientId)
    setSelectedSlots([])
    setSelectedPackageId(null)
    setSessionCount(0)
    setShowQuickRegister(false)
  }, [])

  const handleClearPatient = useCallback(() => {
    setSelectedPatientId(null)
    setSelectedSlots([])
    setSelectedPackageId(null)
    setSessionCount(0)
    setReschedulingParticipant(null)
  }, [])

  const handleSlotClick = useCallback((slot: GridSlot) => {
    if (!selectedPatientId && !reschedulingParticipant) return
    setDrawerSlot(slot)
  }, [selectedPatientId, reschedulingParticipant])

  const handleAllocatePatient = useCallback((slot: SelectedSlot) => {
    if (reschedulingParticipant) {
      // Remarcação limpa
      reschedule({
        participantId: reschedulingParticipant.participantId as any,
        newDate: slot.day,
        newStartTime: slot.startTime,
        newEndTime: slot.endTime,
        newRoomId: slot.roomId as any,
        newProfessionalId: slot.professionalId as any,
        specialty: slot.specialty,
      }).then(() => {
        setReschedulingParticipant(null)
        setDrawerSlot(null)
      }).catch((e) => alert(e.message))
      return
    }

    // Verifica se já está selecionado
    const exists = selectedSlots.some(
      (s) => s.day === slot.day && s.startTime === slot.startTime && s.roomId === slot.roomId
    )
    if (!exists) {
      setSelectedSlots((prev) => [...prev, slot])
    }
    setDrawerSlot(null)
  }, [selectedSlots, reschedulingParticipant, reschedule])

  const handleRemoveSlot = useCallback((index: number) => {
    setSelectedSlots((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleReschedulePatient = useCallback((participantId: string, patientName: string) => {
    setReschedulingParticipant({ participantId, patientName })
    setDrawerSlot(null)
  }, [])

  const handleAddToWaitlist = useCallback((slot: GridSlot) => {
    if (!selectedPatientId) return
    addToWaitlist({
      patientId: selectedPatientId as any,
      scheduleId: (slot.scheduleId as any) || undefined,
      date: slot.day,
      startTime: slot.startTime,
      endTime: slot.endTime,
      roomId: slot.roomId as any,
      professionalId: slot.professionalId as any,
      specialty: slot.specialty,
    }).then(() => {
      setDrawerSlot(null)
      alert('Paciente adicionado com sucesso à fila de espera deste horário!')
    }).catch((e) => alert(e.message))
  }, [selectedPatientId, addToWaitlist])

  const handleConfirm = useCallback(async () => {
    if (!selectedPatientId || selectedSlots.length === 0) return
    setIsSubmitting(true)

    try {
      const result = await confirmBooking({
        patientId: selectedPatientId as any,
        patientPackageId: (selectedPackageId as any) || undefined,
        slots: selectedSlots.map((s) => ({
          day: s.day,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
          roomId: s.roomId as any,
          professionalId: s.professionalId as any,
          specialty: s.specialty,
          scheduleId: (s.scheduleId as any) || undefined,
        })),
        isRecurring,
        month: isRecurring ? month : undefined,
      })

      setLastBookingResult({ scheduleIds: result.scheduleIds })
      setShowConfirm(false)
      setSelectedSlots([])
      setShowWhatsAppToast(true)

      if (result.errors.length > 0) {
        alert(`Agendamento criado com ${result.errors.length} avisos:\n${result.errors.join('\n')}`)
      }
    } catch (e: any) {
      alert(e.message)
    } finally {
      setIsSubmitting(false)
    }
  }, [selectedPatientId, selectedPackageId, selectedSlots, isRecurring, month, confirmBooking])

  const handleWhatsAppComplete = useCallback(() => {
    if (!selectedPatientId || !lastBookingResult) return
    sendWhatsApp({
      patientId: selectedPatientId as any,
      scheduleIds: lastBookingResult.scheduleIds as any[],
    }).catch(() => {})
    setShowWhatsAppToast(false)
    setLastBookingResult(null)
  }, [selectedPatientId, lastBookingResult, sendWhatsApp])

  const handleWhatsAppCancel = useCallback(() => {
    setShowWhatsAppToast(false)
    setLastBookingResult(null)
  }, [])

  // Auto-seleciona pacote caso o paciente tenha apenas um ativo
  useEffect(() => {
    if (patientContext?.packages.length === 1 && !selectedPackageId) {
      setSelectedPackageId(patientContext.packages[0].id)
      setSessionCount(patientContext.packages[0].freeBalance)
    }
  }, [patientContext?.packages, selectedPackageId])

  // ─── Navegação Temporal ───────────────────────────────────────────────

  const handlePrevPeriod = useCallback(() => {
    if (periodMode === 'day') {
      const prev = addDaysSafe(selectedDay, -1)
      setSelectedDay(prev)
      setWeekStart(getMonday(prev))
    } else if (periodMode === 'week') {
      const newWeek = shiftWeek(weekStart, -1)
      setWeekStart(newWeek)
      setSelectedDay(newWeek)
    } else {
      const prevMonth = addMonthsSafe(selectedDay, -1)
      setSelectedDay(prevMonth)
      setWeekStart(getMonday(prevMonth))
    }
  }, [periodMode, selectedDay, weekStart])

  const handleNextPeriod = useCallback(() => {
    if (periodMode === 'day') {
      const next = addDaysSafe(selectedDay, 1)
      setSelectedDay(next)
      setWeekStart(getMonday(next))
    } else if (periodMode === 'week') {
      const newWeek = shiftWeek(weekStart, 1)
      setWeekStart(newWeek)
      setSelectedDay(newWeek)
    } else {
      const nextMonth = addMonthsSafe(selectedDay, 1)
      setSelectedDay(nextMonth)
      setWeekStart(getMonday(nextMonth))
    }
  }, [periodMode, selectedDay, weekStart])

  const handleGoToToday = useCallback(() => {
    setSelectedDay(today)
    setWeekStart(getMonday(today))
  }, [today])

  const periodLabel = useMemo(() => {
    if (periodMode === 'day') {
      return formatDateWithWeekdayBR(selectedDay)
    }
    if (periodMode === 'month') {
      return formatMonthYearBR(selectedDay)
    }
    return formatMonthLabel(month)
  }, [periodMode, selectedDay, month])

  const periodSubLabel = useMemo(() => {
    if (periodMode === 'day') {
      return 'Visualização diária'
    }
    if (periodMode === 'month') {
      return 'Selecione qualquer dia no calendário para visualizar os horários'
    }
    return `Semana a partir de ${weekStart.split('-').reverse().join('/')}`
  }, [periodMode, weekStart])

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <div className="w-full min-h-screen bg-background text-foreground antialiased p-4 md:p-6 space-y-5 pb-20">
      {/* ─── CABEÇALHO DA PÁGINA ─── */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-border">
        <div className="space-y-1">
          {onNavigate && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate("schedule")}
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground h-7 px-2 -ml-2 mb-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar à Agenda</span>
            </Button>
          )}
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <Calendar className="w-6 h-6 text-primary" />
            Agendamento Rápido
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            Fluxo prático para recepção com reserva em lote, turmas e salas em coluna única.
          </p>
        </div>

        {/* Ação de confirmação no topo */}
        <div className="flex items-center gap-3">
          <Button
            size="lg"
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm h-11 px-5 text-sm gap-2"
            disabled={!selectedPatientId || selectedSlots.length === 0 || isSubmitting}
            onClick={() => setShowConfirm(true)}
          >
            <Check className="w-4 h-4" />
            <span>Confirmar Agendamento ({selectedSlots.length})</span>
          </Button>
        </div>
      </div>

      {/* ─── PAINEL SUPERIOR: SELEÇÃO DE PACIENTE E CONTROLES (1 COLUNA / GRID) ─── */}
      <Card className="border-border shadow-xs bg-card">
        <CardContent className="p-4 md:p-5 space-y-4">
          {/* Linha 1: Paciente, Especialidade e Recorrência */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            {/* Paciente (coluna maior) */}
            <div className="md:col-span-6 lg:col-span-6">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Paciente
              </label>
              {showQuickRegister ? (
                <QuickPatientForm
                  onPatientCreated={handleSelectPatient}
                  onCancel={() => setShowQuickRegister(false)}
                />
              ) : (
                <PatientSearchPanel
                  selectedPatientId={selectedPatientId}
                  onSelectPatient={handleSelectPatient}
                  onClearPatient={handleClearPatient}
                  onOpenQuickRegister={() => setShowQuickRegister(true)}
                />
              )}
            </div>

            {/* Especialidade */}
            <div className="md:col-span-3 lg:col-span-3">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Especialidade
              </label>
              <Select
                value={specialtyFilter}
                onChange={(e) => setSpecialtyFilter(e.target.value)}
                className="h-10"
              >
                <option value="">Todas as especialidades</option>
                {clinicalSpecialties.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </div>

            {/* Recorrência Mensal Compacta (SEM texto explicativo longo) */}
            <div className="md:col-span-3 lg:col-span-3">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Recorrência
              </label>
              <div className="flex items-center h-10 px-3 bg-muted/40 rounded-xl border border-border">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-foreground w-full">
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                    className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                  />
                  <Repeat className="w-4 h-4 text-primary shrink-0" />
                  <span className="truncate">Recorrência Mensal</span>
                </label>
              </div>
            </div>
          </div>

          {/* Linha 2 (Condicional quando paciente selecionado): Pacote, Sessões e Resumo */}
          {selectedPatientId && (
            <div className="pt-3 border-t border-border/60 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
              {/* Pacote / Saldo */}
              <div className="md:col-span-5 lg:col-span-5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
                  <Package className="w-3.5 h-3.5 inline mr-1 text-primary" />
                  Pacote & Saldo Disponível
                </label>
                {!patientContext ? (
                  <div className="text-xs text-muted-foreground">Carregando plano...</div>
                ) : patientContext.packages.length === 0 ? (
                  <div className="text-xs text-muted-foreground bg-muted/30 px-3 py-2 rounded-lg border border-border">
                    Nenhum pacote ativo. O agendamento será criado avulso.
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    {patientContext.packages.length > 1 && (
                      <Select
                        value={selectedPackageId || ''}
                        onChange={(e) => {
                          setSelectedPackageId(e.target.value || null)
                          const pkg = patientContext.packages.find((p) => p.id === e.target.value)
                          if (pkg) setSessionCount(pkg.freeBalance)
                        }}
                        className="h-9 text-xs flex-1 min-w-[180px]"
                      >
                        <option value="">Selecionar pacote...</option>
                        {patientContext.packages.map((pkg) => (
                          <option key={pkg.id} value={pkg.id}>
                            {pkg.serviceName} ({pkg.freeBalance} livres)
                          </option>
                        ))}
                      </Select>
                    )}
                    {selectedPackage && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline" className="text-xs font-medium">
                          Total: {selectedPackage.totalSessions}
                        </Badge>
                        <Badge variant="outline" className="text-xs font-medium text-muted-foreground">
                          Usadas: {selectedPackage.usedSessions}
                        </Badge>
                        <Badge className="text-xs font-bold bg-emerald-500/15 text-emerald-600 border-emerald-500/20">
                          Livres: {selectedPackage.freeBalance}
                        </Badge>
                      </div>
                    )}
                  </div>
                )}
                {patientContext?.availableCredits && patientContext.availableCredits > 0 ? (
                  <Badge className="mt-1 bg-blue-500/15 text-blue-600 border-blue-500/20 text-[11px]">
                    {patientContext.availableCredits} crédito(s) de reposição
                  </Badge>
                ) : null}
              </div>

              {/* Quantidade de Sessões */}
              <div className="md:col-span-3 lg:col-span-3">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
                  <Hash className="w-3.5 h-3.5 inline mr-1 text-primary" />
                  Qtd. de Sessões a Marcar
                </label>
                <Input
                  type="number"
                  min={1}
                  max={freeBalance > 0 ? freeBalance : 100}
                  value={sessionCount || ''}
                  placeholder="Ex: 4 ou 8"
                  onChange={(e) => setSessionCount(parseInt(e.target.value, 10) || 0)}
                  className="h-9 text-xs"
                />
              </div>

              {/* Contador de Horários Marcados */}
              <div className="md:col-span-4 lg:col-span-4 flex items-center justify-end gap-2">
                <div className="text-right">
                  <div className="text-xs font-bold text-foreground">
                    {isRecurring ? `~${totalEstimated}` : selectedSlots.length} de {sessionCount || '?'} sessões
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {selectedSlots.length} horário(s) selecionado(s)
                  </div>
                </div>
                {overBalance && (
                  <Badge variant="destructive" className="text-[11px] gap-1 shrink-0">
                    <AlertTriangle className="w-3 h-3" /> Excede saldo
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Horários Selecionados (Chips compactos) */}
          {selectedSlots.length > 0 && (
            <div className="pt-2 border-t border-border/40">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Horários Marcados na Grade ({selectedSlots.length})
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedSlots([])}
                  className="h-6 px-2 text-[11px] text-muted-foreground hover:text-destructive"
                >
                  Limpar todos
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {selectedSlots.map((slot, i) => (
                  <div
                    key={i}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-muted/60 hover:bg-muted border border-border rounded-lg text-xs font-medium shadow-2xs"
                  >
                    <span className="font-bold text-foreground">
                      {DAY_NAMES[slot.dayOfWeek]} {slot.startTime}
                    </span>
                    <span className="text-muted-foreground">
                      • {slot.roomName} ({formatProfessionalDisplayName(slot.professionalName)})
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSlot(i)}
                      className="text-muted-foreground hover:text-destructive ml-1 p-0.5"
                      title="Remover horário"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Modo Remarcação Ativo */}
          {reschedulingParticipant && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-600">
                  Modo Remarcação Ativo:
                </span>
                <span className="ml-1.5 text-sm font-semibold text-foreground">
                  {reschedulingParticipant.patientName}
                </span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Clique em um horário vago na grade abaixo para transferir o paciente.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReschedulingParticipant(null)}
                className="text-xs text-amber-600 border-amber-500/30 hover:bg-amber-500/20"
              >
                Cancelar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── BARRA DE NAVEGAÇÃO DA GRADE & FILTROS DIA / SEMANA / MÊS ─── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border shadow-xs">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={handlePrevPeriod}
            title="Período anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div>
            <h3 className="text-sm md:text-base font-bold text-foreground">
              {periodLabel}
            </h3>
            <p className="text-xs text-muted-foreground">
              {periodSubLabel}
            </p>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={handleNextPeriod}
            title="Próximo período"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleGoToToday}
            className="text-xs font-semibold h-9"
          >
            Ir para Hoje
          </Button>

          {/* Alternador de Período [ Dia | Semana | Mês ] */}
          <div
            role="group"
            aria-label="Filtro de visualização temporal"
            className="inline-flex items-center bg-muted/60 p-1 rounded-xl border border-border shrink-0 select-none shadow-2xs"
          >
            <button
              type="button"
              onClick={() => setPeriodMode('day')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                periodMode === 'day'
                  ? 'bg-background text-foreground shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Visualização por Dia"
            >
              <Calendar className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span>Dia</span>
            </button>
            <button
              type="button"
              onClick={() => setPeriodMode('week')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                periodMode === 'week'
                  ? 'bg-background text-foreground shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Visualização Semanal"
            >
              <CalendarRange className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span>Semana</span>
            </button>
            <button
              type="button"
              onClick={() => setPeriodMode('month')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                periodMode === 'month'
                  ? 'bg-background text-foreground shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Visualização Mensal"
            >
              <CalendarDays className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span>Mês</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── ÁREA DA GRADE (100% DE LARGURA) ─── */}
      <div>
        {!gridData ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="text-xs font-semibold">Carregando disponibilidade de salas e profissionais...</span>
          </div>
        ) : (
          <WeeklyScheduleGrid
            dates={gridData.dates}
            rooms={gridData.rooms}
            slots={gridData.slots as any}
            selectedSlots={selectedSlots}
            selectedDay={selectedDay}
            periodMode={periodMode}
            onDayChange={(day) => {
              setSelectedDay(day)
              const mon = getMonday(day)
              if (mon !== weekStart) {
                setWeekStart(mon)
              }
            }}
            onSlotClick={handleSlotClick}
            hasPatientSelected={!!selectedPatientId || !!reschedulingParticipant}
          />
        )}
      </div>

      {/* ─── MODAL DE SALAS E CADEIRAS ─── */}
      <RoomDrawer
        open={!!drawerSlot}
        onClose={() => setDrawerSlot(null)}
        slot={drawerSlot}
        selectedPatientName={
          reschedulingParticipant?.patientName || patientContext?.patient.name || null
        }
        onAllocatePatient={handleAllocatePatient}
        onReschedulePatient={handleReschedulePatient}
        onAddToWaitlist={handleAddToWaitlist}
        isSlotSelected={
          !!drawerSlot &&
          selectedSlots.some(
            (s) =>
              s.day === drawerSlot.day &&
              s.startTime === drawerSlot.startTime &&
              s.roomId === drawerSlot.roomId
          )
        }
      />

      {/* ─── MODAL DE CONFIRMAÇÃO ─── */}
      <ConfirmBookingModal
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleConfirm}
        patientName={patientContext?.patient.name || ''}
        selectedSlots={selectedSlots}
        isRecurring={isRecurring}
        month={isRecurring ? month : null}
        totalSessions={totalEstimated}
        isLoading={isSubmitting}
      />

      {/* ─── TOAST COM TIMER DE 5S DO WHATSAPP ─── */}
      <WhatsAppCountdownToast
        visible={showWhatsAppToast}
        patientName={patientContext?.patient.name || ''}
        onCancel={handleWhatsAppCancel}
        onComplete={handleWhatsAppComplete}
      />
    </div>
  )
}
