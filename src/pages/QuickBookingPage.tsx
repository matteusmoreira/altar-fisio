import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useAction } from '@/lib/staffConvex'
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
} from 'lucide-react'
import { PatientSearchPanel } from '@/components/quickBooking/PatientSearchPanel'
import { QuickPatientForm } from '@/components/quickBooking/QuickPatientForm'
import { WeeklyScheduleGrid, type GridSlot, type SelectedSlot } from '@/components/quickBooking/WeeklyScheduleGrid'
import { RoomDrawer } from '@/components/quickBooking/RoomDrawer'
import { ConfirmBookingModal } from '@/components/quickBooking/ConfirmBookingModal'
import { WhatsAppCountdownToast } from '@/components/quickBooking/WhatsAppCountdownToast'
import { getTodayDateString } from '@/lib/dateUtils'
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
  React.useEffect(() => {
    if (patientContext?.packages.length === 1 && !selectedPackageId) {
      setSelectedPackageId(patientContext.packages[0].id)
      setSessionCount(patientContext.packages[0].freeBalance)
    }
  }, [patientContext?.packages, selectedPackageId])

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-background text-foreground antialiased">
      {/* ─── SIDEBAR ─── */}
      <aside className="w-84 border-r border-border bg-card flex flex-col overflow-y-auto shrink-0 shadow-sm">
        <div className="p-4 border-b border-border space-y-1">
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
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Agendamento Rápido
          </h2>
          <p className="text-xs text-muted-foreground">
            Fluxo prático para recepção com reserva em lote e salas.
          </p>
        </div>

        <div className="p-4 space-y-5 flex-1">
          {/* 1. Paciente */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
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

          {/* 2. Pacote e Saldo */}
          {selectedPatientId && patientContext && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                <Package className="w-3.5 h-3.5 inline mr-1 text-primary" />
                Pacote & Saldo Disponível
              </label>
              {patientContext.packages.length === 0 ? (
                <div className="p-3 bg-muted/40 rounded-xl border border-border text-xs text-muted-foreground">
                  Nenhum pacote ativo. O agendamento poderá ser criado de forma avulsa.
                </div>
              ) : (
                <>
                  {patientContext.packages.length > 1 && (
                    <Select
                      value={selectedPackageId || ''}
                      onChange={(e) => {
                        setSelectedPackageId(e.target.value || null)
                        const pkg = patientContext.packages.find((p) => p.id === e.target.value)
                        if (pkg) setSessionCount(pkg.freeBalance)
                      }}
                    >
                      <option value="">Selecionar pacote do paciente...</option>
                      {patientContext.packages.map((pkg) => (
                        <option key={pkg.id} value={pkg.id}>
                          {pkg.serviceName} ({pkg.freeBalance} livres de {pkg.totalSessions})
                        </option>
                      ))}
                    </Select>
                  )}
                  {selectedPackage && (
                    <div className="mt-2 p-3 bg-muted/50 rounded-xl border border-border">
                      <p className="text-xs font-semibold text-foreground truncate">{selectedPackage.serviceName}</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge variant="outline" className="text-[11px] font-medium">
                          Total: {selectedPackage.totalSessions}
                        </Badge>
                        <Badge variant="outline" className="text-[11px] font-medium text-muted-foreground">
                          Usadas: {selectedPackage.usedSessions}
                        </Badge>
                        <Badge className="text-[11px] font-bold bg-emerald-500/15 text-emerald-600 border-emerald-500/20">
                          Livres: {selectedPackage.freeBalance}
                        </Badge>
                      </div>
                    </div>
                  )}
                </>
              )}
              {patientContext.availableCredits > 0 && (
                <Badge className="mt-2 bg-blue-500/15 text-blue-600 border-blue-500/20 text-xs">
                  {patientContext.availableCredits} crédito(s) de reposição disponível(is)
                </Badge>
              )}
            </div>
          )}

          {/* 3. Quantidade de Sessões */}
          {selectedPatientId && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                <Hash className="w-3.5 h-3.5 inline mr-1 text-primary" />
                Quantidade de Sessões a Marcar
              </label>
              <Input
                type="number"
                min={1}
                max={freeBalance > 0 ? freeBalance : 100}
                value={sessionCount || ''}
                placeholder="Ex: 4 ou 8 sessões"
                onChange={(e) => setSessionCount(parseInt(e.target.value, 10) || 0)}
                className="w-full"
              />
              {freeBalance > 0 && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Saldo livre no plano selecionado: <strong>{freeBalance}</strong>
                </p>
              )}
            </div>
          )}

          {/* 4. Filtro de Especialidade */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
              Especialidade
            </label>
            <Select value={specialtyFilter} onChange={(e) => setSpecialtyFilter(e.target.value)}>
              <option value="">Todas as especialidades</option>
              {clinicalSpecialties.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </div>

          {/* 5. Recorrência Mensal */}
          <div className="p-3 bg-muted/30 rounded-xl border border-border">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary h-4 w-4"
              />
              <Repeat className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Recorrência Mensal</span>
            </label>
            {isRecurring ? (
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                Ao selecionar um horário (ex: Seg 08:00), o sistema reservará <strong>todas as segundas-feiras</strong> do mês de {formatMonthLabel(month)}.
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground mt-1">
                Marcar apenas na data específica da semana selecionada.
              </p>
            )}
          </div>

          {/* 6. Modo Remarcação Ativo */}
          {reschedulingParticipant && (
            <Card className="border-amber-500/30 bg-amber-500/10 animate-fade-in">
              <CardContent className="p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-600">
                  Modo Remarcação Ativo
                </p>
                <p className="text-sm font-semibold text-foreground mt-1">
                  {reschedulingParticipant.patientName}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Clique em um horário livre na grade para transferir o paciente.
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setReschedulingParticipant(null)}
                  className="mt-2 text-xs text-amber-600 hover:text-amber-700 h-7 px-2"
                >
                  Cancelar remarcação
                </Button>
              </CardContent>
            </Card>
          )}

          {/* 7. Resumo de Seleções */}
          {selectedSlots.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                Horários Selecionados ({selectedSlots.length})
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {selectedSlots.map((slot, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2.5 bg-card rounded-xl border border-border shadow-xs text-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-bold text-foreground">
                        {DAY_NAMES[slot.dayOfWeek]} às {slot.startTime}
                      </p>
                      <p className="text-muted-foreground truncate">
                        {slot.roomName} • {slot.professionalName.split(' ')[0]}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => handleRemoveSlot(i)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Contador & Alerta */}
              <div className="mt-3 flex items-center justify-between">
                <Badge variant="outline" className="text-xs font-semibold">
                  {isRecurring ? `~${totalEstimated}` : selectedSlots.length} de {sessionCount || '?'} sessões
                </Badge>
                {overBalance && (
                  <span className="text-xs font-semibold text-destructive flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Excede saldo
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Rodapé: Confirmar Agendamento */}
        <div className="p-4 border-t border-border bg-card">
          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm"
            disabled={!selectedPatientId || selectedSlots.length === 0}
            onClick={() => setShowConfirm(true)}
          >
            <Check className="w-4 h-4 mr-2" />
            Confirmar Agendamento ({selectedSlots.length})
          </Button>
        </div>
      </aside>

      {/* ─── ÁREA PRINCIPAL (GRADE SEMANAL) ─── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header: Mês e Navegação de Semanas */}
        <div className="p-4 border-b border-border flex flex-wrap items-center justify-between gap-4 bg-card">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => setWeekStart(shiftWeek(weekStart, -1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div>
              <h3 className="text-base font-bold text-foreground">
                {formatMonthLabel(month)}
              </h3>
              <p className="text-xs text-muted-foreground">
                Semana a partir de {weekStart.split('-').reverse().join('/')}
              </p>
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => setWeekStart(shiftWeek(weekStart, 1))}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setWeekStart(getMonday(today))
                setSelectedDay(today)
              }}
              className="text-xs font-semibold"
            >
              Ir para Hoje
            </Button>
          </div>
        </div>

        {/* Grade Semanal */}
        <div className="flex-1 overflow-auto p-4">
          {!gridData ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
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
              onDayChange={setSelectedDay}
              onSlotClick={handleSlotClick}
              hasPatientSelected={!!selectedPatientId || !!reschedulingParticipant}
            />
          )}
        </div>
      </main>

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
