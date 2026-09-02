import React, { useState } from "react"
import { useClinicData } from "@/contexts/ClinicDataContext"
import type { ReplacementCredit, Schedule } from "@/types"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Layers,
  UserPlus,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Repeat,
  ArrowRight,
  ShieldCheck,
  UserCheck,
} from "lucide-react"

export const ClassesPage: React.FC = () => {
  const {
    rooms,
    professionals,
    schedules,
    patients,
    replacementCredits,
    addParticipantToClass,
    addRecurringScheduleSeries,
  } = useClinicData()

  // Estados de Modal e Formulários
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null)
  const [selectedPatientId, setSelectedPatientId] = useState<string>("")
  const [isReplacementBooking, setIsReplacementBooking] = useState(false)
  const [selectedCreditId, setSelectedCreditId] = useState<string>("")
  const [feedback, setFeedback] = useState<string | null>(null)

  // Modal de Alocação de Reposição Direta
  const [allocateCreditTarget, setAllocateCreditTarget] = useState<ReplacementCredit | null>(null)

  // Modal de Nova Série Recorrente
  const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false)
  const [recTitle, setRecTitle] = useState("")
  const [recSpecialty, setRecSpecialty] = useState<"pilates" | "fisioterapia" | "rpg">("pilates")
  const [recRoomId, setRecRoomId] = useState(rooms[0]?.id || "")
  const [recProfId, setRecProfId] = useState(professionals[0]?.id || "")
  const [recStartTime, setRecStartTime] = useState("08:00")
  const [recEndTime, setRecEndTime] = useState("08:55")
  const [recDaysOfWeek, setRecDaysOfWeek] = useState<number[]>([1, 3]) // Seg e Qua
  const [recStartDate, setRecStartDate] = useState(new Date().toISOString().split("T")[0])
  const [recWeeksCount, setRecWeeksCount] = useState<number>(4)
  const [recEnrolledPatients, setRecEnrolledPatients] = useState<string[]>([])
  const [recError, setRecError] = useState<string | null>(null)
  const [isSubmittingRec, setIsSubmittingRec] = useState(false)

  // Filtrar apenas agendamentos de turmas
  const classSchedules = schedules.filter((s) => s.type === "turma")

  // Créditos disponíveis
  const availableCredits = replacementCredits.filter((c) => c.status === "available")

  // Turmas com vagas livres
  const turmasWithVacancies = classSchedules.filter((s) => {
    const activeStudents = s.participants.filter((p) => p.status !== "justified_absence")
    return activeStudents.length < s.maxCapacity
  })

  const toggleDayOfWeek = (day: number) => {
    setRecDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    )
  }

  const toggleEnrolledPatient = (patId: string) => {
    setRecEnrolledPatients((prev) =>
      prev.includes(patId) ? prev.filter((id) => id !== patId) : [...prev, patId]
    )
  }

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedScheduleId || !selectedPatientId) return

    try {
      await addParticipantToClass(
        selectedScheduleId,
        selectedPatientId,
        isReplacementBooking,
        isReplacementBooking ? selectedCreditId : undefined
      )

      setSelectedScheduleId(null)
      setSelectedPatientId("")
      setIsReplacementBooking(false)
      setSelectedCreditId("")
      setFeedback(
        isReplacementBooking
          ? "Aluno matriculado com sucesso usando crédito de reposição!"
          : "Aluno matriculado com sucesso na turma!"
      )
      setTimeout(() => setFeedback(null), 3500)
    } catch (err: any) {
      alert(err?.message || "Erro ao matricular aluno.")
    }
  }

  // Alocação em 1 clique a partir da Central de Reposições
  const handleQuickAllocate = async (scheduleId: string) => {
    if (!allocateCreditTarget) return

    try {
      await addParticipantToClass(
        scheduleId,
        allocateCreditTarget.patientId,
        true,
        allocateCreditTarget.id
      )

      setFeedback(
        `Reposição alocada com sucesso para ${allocateCreditTarget.patientName}!`
      )
      setAllocateCreditTarget(null)
      setTimeout(() => setFeedback(null), 3500)
    } catch (err: any) {
      alert(err?.message || "Erro ao alocar reposição nesta turma.")
    }
  }

  const handleCreateRecurringSeries = async (e: React.FormEvent) => {
    e.preventDefault()
    setRecError(null)
    setIsSubmittingRec(true)

    const room = rooms.find((r) => r.id === recRoomId)
    const prof = professionals.find((p) => p.id === recProfId)

    if (!room || !prof) {
      setRecError("Selecione uma sala e um profissional válidos.")
      setIsSubmittingRec(false)
      return
    }

    if (recDaysOfWeek.length === 0) {
      setRecError("Selecione ao menos um dia da semana para a turma.")
      setIsSubmittingRec(false)
      return
    }

    try {
      const res = await addRecurringScheduleSeries({
        title: recTitle || `Turma Pilates ${prof.name.split(" ")[0]}`,
        type: "turma",
        specialty: recSpecialty,
        roomId: recRoomId,
        professionalId: recProfId,
        startTime: recStartTime,
        endTime: recEndTime,
        maxCapacity: room.capacity,
        daysOfWeek: recDaysOfWeek,
        startDate: recStartDate,
        weeksCount: recWeeksCount,
        enrolledPatientIds: recEnrolledPatients,
      })

      if (res.skippedCount > 0) {
        setFeedback(`Turma recorrente criada: ${res.createdCount} aulas geradas (${res.skippedCount} datas puladas por conflito).`)
      } else {
        setFeedback(`Turma recorrente criada com sucesso! (${res.createdCount} aulas na grade).`)
      }

      setIsRecurringModalOpen(false)
      setRecTitle("")
      setRecEnrolledPatients([])
      setTimeout(() => setFeedback(null), 4000)
    } catch (err: any) {
      setRecError(err?.message || "Erro ao criar grade recorrente.")
    } finally {
      setIsSubmittingRec(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {feedback && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm font-medium animate-fade-in">
          <CheckCircle2 className="h-4 w-4" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Header com Ação de Nova Turma Recorrente */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Layers className="h-6 w-6 text-primary" />
            <span>Turmas, Salas & Reposições</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Acompanhe a capacidade física das salas (Pilates Reformer, Solo, RPG), turmas recorrentes e alocação de reposições.
          </p>
        </div>

        <Button
          onClick={() => setIsRecurringModalOpen(true)}
          className="gap-2 self-start sm:self-auto"
        >
          <Repeat className="h-4 w-4" />
          <span>Nova Turma Recorrente</span>
        </Button>
      </div>

      {/* Salas e Lotação */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {rooms.map((room) => (
          <Card key={room.id} className="border-border">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <Badge
                  variant="outline"
                  className="text-[10px] font-semibold uppercase tracking-wider"
                  style={{ borderColor: room.color, color: room.color }}
                >
                  Capacidade Máxima: {room.capacity} alunos
                </Badge>
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: room.color }}
                />
              </div>
              <CardTitle className="text-sm font-bold mt-2 text-foreground">
                {room.name}
              </CardTitle>
              <CardDescription className="text-xs">
                {room.description || "Ambiente clínico equipado"}
              </CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* Painel Central de Reposições Inteligente */}
      <Card className="bg-amber-500/5 border-amber-500/20">
        <CardHeader className="p-4 pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <CardTitle className="text-sm font-bold text-amber-800 dark:text-amber-300 flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600" />
              <span>Central de Reposições ({availableCredits.length} créditos ativos)</span>
            </CardTitle>
            <span className="text-xs text-muted-foreground">
              Regra da clínica: Válidos por até 30 dias a partir da desmarcação com 2h+ de antecedência
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          {availableCredits.length === 0 ? (
            <div className="py-4 text-center">
              <ShieldCheck className="h-8 w-8 text-emerald-500/50 mx-auto mb-1.5" />
              <p className="text-xs text-muted-foreground italic">
                Nenhum crédito de reposição pendente no momento. Todas as presenças e turmas estão em conformidade!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-1">
              {availableCredits.map((c) => {
                const daysLeft = c.daysLeft ?? 30
                const isExpiringSoon = daysLeft <= 7

                return (
                  <div
                    key={c.id}
                    className="p-3 rounded-xl border border-amber-500/25 bg-background text-xs space-y-2.5 flex flex-col justify-between shadow-xs"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-foreground text-sm">{c.patientName}</p>
                          <p className="text-[11px] text-muted-foreground">{c.patientPhone || "Sem telefone"}</p>
                        </div>
                        <Badge
                          variant={isExpiringSoon ? "destructive" : "warning"}
                          className="text-[10px] shrink-0 font-medium"
                        >
                          {daysLeft > 0 ? `${daysLeft} dias restantes` : "Vence hoje"}
                        </Badge>
                      </div>

                      <p className="text-[11px] text-muted-foreground mt-1.5">
                        Origem: <span className="font-medium text-foreground">{c.originDate}</span> • Expira: <span className="font-medium text-foreground">{c.expiryDate}</span>
                      </p>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAllocateCreditTarget(c)}
                      className="w-full text-xs gap-1.5 border-amber-500/40 hover:bg-amber-500/10 text-amber-900 dark:text-amber-200"
                    >
                      <UserCheck className="h-3.5 w-3.5 text-amber-600" />
                      <span>Encaixar em Vaga Ociosa</span>
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Grade de Turmas de Pilates & RPG */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <span>Turmas Agendadas</span>
          </h2>
          <span className="text-xs text-muted-foreground">
            Total: {classSchedules.length} horários cadastrados
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {classSchedules.map((schedule) => {
            const activeStudents = schedule.participants.filter(
              (p) => p.status !== "justified_absence"
            )
            const count = activeStudents.length
            const isFull = count >= schedule.maxCapacity
            const vacancies = Math.max(0, schedule.maxCapacity - count)

            return (
              <Card key={schedule.id} className="border-border shadow-xs">
                <CardHeader className="p-4 pb-3 border-b border-border bg-muted/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">
                        {schedule.startTime} - {schedule.endTime}
                      </span>
                      {schedule.isRecurring && (
                        <Badge variant="secondary" className="text-[10px] gap-1">
                          <Repeat className="h-2.5 w-2.5" />
                          Recorrente
                        </Badge>
                      )}
                    </div>
                    <Badge variant={isFull ? "destructive" : "success"} className="text-xs">
                      {count} / {schedule.maxCapacity} Alunos ({vacancies} vaga{vacancies !== 1 ? "s" : ""})
                    </Badge>
                  </div>
                  <CardTitle className="text-sm font-bold text-foreground mt-2">
                    {schedule.title}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {schedule.professionalName} • {schedule.roomName} ({schedule.date})
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-4 space-y-3">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Alunos Matriculados:
                    </label>
                    <div className="space-y-1.5">
                      {schedule.participants.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic py-1">
                          Nenhum aluno matriculado nesta turma ainda.
                        </p>
                      ) : (
                        schedule.participants.map((p) => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/30 border border-border/60"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-primary" />
                                {p.patientName}
                              </span>
                              {p.hasActivePackage ? (
                                <Badge
                                  variant={p.remainingSessions && p.remainingSessions <= 2 ? "warning" : "outline"}
                                  className="text-[9px] py-0"
                                >
                                  {p.remainingSessions} rest.
                                </Badge>
                              ) : p.status !== "replacement" && (
                                <Badge variant="outline" className="text-[9px] py-0 text-amber-600 border-amber-500/30">
                                  Avulso
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              {p.status === "replacement" && (
                                <Badge variant="warning" className="text-[9px] py-0">
                                  Reposição
                                </Badge>
                              )}
                              {p.status === "present" && (
                                <Badge variant="success" className="text-[9px] py-0">
                                  Presente
                                </Badge>
                              )}
                              {p.status === "absence" && (
                                <Badge variant="destructive" className="text-[9px] py-0">
                                  Falta
                                </Badge>
                              )}
                              {p.status === "justified_absence" && (
                                <span className="text-[10px] text-amber-600 font-medium">
                                  Vaga liberada (Reposição)
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {!isFull && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedScheduleId(schedule.id)
                        setSelectedPatientId(patients[0]?.id || "")
                      }}
                      className="w-full text-xs gap-1.5 mt-2"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      <span>Matricular Aluno ou Encaixar Reposição</span>
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Modal 1: Matrícula Manual na Turma */}
      <Dialog
        open={!!selectedScheduleId}
        onOpenChange={(open) => !open && setSelectedScheduleId(null)}
      >
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleEnroll}>
            <DialogHeader>
              <DialogTitle>Matricular Aluno na Turma</DialogTitle>
              <DialogDescription>
                Selecione o paciente e defina se é uma matrícula regular ou encaixe de reposição.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4 text-xs">
              <div className="space-y-1">
                <label className="font-medium text-foreground">Selecione o Aluno</label>
                <select
                  value={selectedPatientId}
                  onChange={(e) => {
                    setSelectedPatientId(e.target.value)
                    // Auto-detecta crédito de reposição
                    const patCredits = availableCredits.filter((c) => c.patientId === e.target.value)
                    if (patCredits.length > 0) {
                      setSelectedCreditId(patCredits[0].id)
                    }
                  }}
                  className="w-full h-10 rounded-lg border border-input bg-background px-3 text-xs"
                >
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.phone})
                    </option>
                  ))}
                </select>
              </div>

              {/* Checkbox de Reposição */}
              <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-foreground">
                  <input
                    type="checkbox"
                    checked={isReplacementBooking}
                    onChange={(e) => setIsReplacementBooking(e.target.checked)}
                    className="rounded text-primary focus:ring-primary h-4 w-4"
                  />
                  <span>Utilizar Crédito de Reposição</span>
                </label>
                <p className="text-[11px] text-muted-foreground">
                  Ao marcar esta opção, o sistema debitará 1 crédito de reposição ativo do paciente sem cobrar sessão avulsa.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSelectedScheduleId(null)}
              >
                Cancelar
              </Button>
              <Button type="submit">Confirmar Matrícula</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal 2: Alocação Rápida de Crédito de Reposição em Vagas Ociosas */}
      <Dialog
        open={!!allocateCreditTarget}
        onOpenChange={(open) => !open && setAllocateCreditTarget(null)}
      >
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          {allocateCreditTarget && (
            <div>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-amber-600" />
                  <span>Alocar Reposição: {allocateCreditTarget.patientName}</span>
                </DialogTitle>
                <DialogDescription>
                  Selecione uma turma abaixo com vagas ociosas para encaixar o paciente.
                </DialogDescription>
              </DialogHeader>

              <div className="py-4 space-y-4 text-xs">
                {/* Detalhes do Crédito */}
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-amber-900 dark:text-amber-200">
                      Crédito Válido até {allocateCreditTarget.expiryDate}
                    </p>
                    <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
                      Aula de Origem: {allocateCreditTarget.originDate}
                    </p>
                  </div>
                  <Badge variant="warning">
                    {allocateCreditTarget.daysLeft ?? 30} dias restantes
                  </Badge>
                </div>

                <div className="space-y-2">
                  <label className="font-bold text-foreground flex items-center justify-between">
                    <span>Turmas com Vagas Abertas ({turmasWithVacancies.length})</span>
                    <span className="text-[10px] text-muted-foreground font-normal">
                      Clique para alocar
                    </span>
                  </label>

                  {turmasWithVacancies.length === 0 ? (
                    <div className="p-6 text-center border rounded-xl bg-muted/20">
                      <AlertCircle className="h-6 w-6 text-muted-foreground/50 mx-auto mb-1" />
                      <p className="font-medium text-foreground">Nenhuma turma com vaga livre no momento</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Aguarde uma desmarcação ou crie um novo horário para alocação.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {turmasWithVacancies.map((turma) => {
                        const activeCount = turma.participants.filter(
                          (p) => p.status !== "justified_absence"
                        ).length
                        const vacancies = turma.maxCapacity - activeCount

                        return (
                          <div
                            key={turma.id}
                            className="p-3 rounded-xl border border-border bg-card flex items-center justify-between hover:border-primary/50 transition-all gap-2"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-foreground">
                                  {turma.title}
                                </span>
                                <Badge variant="success" className="text-[9px]">
                                  {vacancies} vaga{vacancies > 1 ? "s" : ""}
                                </Badge>
                              </div>
                              <p className="text-muted-foreground text-[11px] mt-0.5">
                                {turma.date} às {turma.startTime} - {turma.endTime} • {turma.roomName}
                              </p>
                            </div>

                            <Button
                              size="sm"
                              onClick={() => handleQuickAllocate(turma.id)}
                              className="text-xs gap-1 shrink-0"
                            >
                              <span>Alocar</span>
                              <ArrowRight className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setAllocateCreditTarget(null)}
                >
                  Fechar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal 3: Criar Nova Série Recorrente Direto da Tela de Turmas */}
      <Dialog
        open={isRecurringModalOpen}
        onOpenChange={(open) => {
          setIsRecurringModalOpen(open)
          if (!open) {
            setRecError(null)
            setRecTitle("")
            setRecEnrolledPatients([])
          }
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleCreateRecurringSeries}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Repeat className="h-5 w-5 text-primary" />
                <span>Criar Turma Recorrente Semanal</span>
              </DialogTitle>
              <DialogDescription>
                Gere a grade semanal contínua de aulas (ex: Pilates Seg/Qua) com prevenção automática de conflitos.
              </DialogDescription>
            </DialogHeader>

            {recError && (
              <div className="mt-3 p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="font-medium">{recError}</span>
              </div>
            )}

            <div className="space-y-3.5 py-3 text-xs">
              <div className="space-y-1">
                <label className="font-medium text-foreground">Título da Turma</label>
                <Input
                  value={recTitle}
                  onChange={(e) => setRecTitle(e.target.value)}
                  placeholder="Ex: Turma Pilates Reformer Manhã (Seg e Qua)"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-medium text-foreground">Especialidade</label>
                  <select
                    value={recSpecialty}
                    onChange={(e) => setRecSpecialty(e.target.value as any)}
                    className="w-full h-10 rounded-lg border border-input bg-background px-3 text-xs"
                  >
                    <option value="pilates">Pilates</option>
                    <option value="fisioterapia">Fisioterapia</option>
                    <option value="rpg">RPG</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-foreground">Sala / Ambiente</label>
                  <select
                    value={recRoomId}
                    onChange={(e) => setRecRoomId(e.target.value)}
                    className="w-full h-10 rounded-lg border border-input bg-background px-3 text-xs"
                  >
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} (Capacidade: {r.capacity})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-medium text-foreground">Fisioterapeuta / Instrutor</label>
                <select
                  value={recProfId}
                  onChange={(e) => setRecProfId(e.target.value)}
                  className="w-full h-10 rounded-lg border border-input bg-background px-3 text-xs"
                >
                  {professionals.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-medium text-foreground">Horário Início</label>
                  <Input
                    type="time"
                    value={recStartTime}
                    onChange={(e) => setRecStartTime(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-medium text-foreground">Horário Término</label>
                  <Input
                    type="time"
                    value={recEndTime}
                    onChange={(e) => setRecEndTime(e.target.value)}
                  />
                </div>
              </div>

              {/* Dias da Semana */}
              <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                    <Repeat className="h-3.5 w-3.5 text-primary" />
                    Dias da Semana da Recorrência
                  </span>
                  <span className="text-[10px] text-muted-foreground">Multi-seleção</span>
                </div>

                <div className="grid grid-cols-6 gap-1.5">
                  {[
                    { day: 1, label: "Seg" },
                    { day: 2, label: "Ter" },
                    { day: 3, label: "Qua" },
                    { day: 4, label: "Qui" },
                    { day: 5, label: "Sex" },
                    { day: 6, label: "Sáb" },
                  ].map(({ day, label }) => {
                    const isSelected = recDaysOfWeek.includes(day)
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDayOfWeek(day)}
                        className={`py-2 rounded-lg text-xs font-bold transition-all border ${
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary shadow-xs"
                            : "bg-background text-muted-foreground border-input hover:border-primary/50"
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <label className="font-medium text-foreground text-[11px]">
                      Data Inicial
                    </label>
                    <Input
                      type="date"
                      value={recStartDate}
                      onChange={(e) => setRecStartDate(e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-medium text-foreground text-[11px]">
                      Duração
                    </label>
                    <select
                      value={recWeeksCount}
                      onChange={(e) => setRecWeeksCount(Number(e.target.value))}
                      className="w-full h-9 rounded-lg border border-input bg-background px-3 text-xs"
                    >
                      <option value={4}>4 semanas (1 mês)</option>
                      <option value={8}>8 semanas (2 meses)</option>
                      <option value={12}>12 semanas (3 meses)</option>
                      <option value={24}>24 semanas (6 meses)</option>
                    </select>
                  </div>
                </div>

                {/* Alunos Fixos */}
                <div className="space-y-1.5 pt-1 border-t border-primary/10">
                  <label className="font-medium text-foreground text-[11px] flex items-center justify-between">
                    <span>Alunos Fixos na Série ({recEnrolledPatients.length}):</span>
                    <span className="text-[10px] text-muted-foreground">Opcional</span>
                  </label>
                  <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                    {patients.map((p) => {
                      const isEnrolled = recEnrolledPatients.includes(p.id)
                      return (
                        <div
                          key={p.id}
                          onClick={() => toggleEnrolledPatient(p.id)}
                          className={`p-2 rounded-lg text-xs cursor-pointer flex items-center justify-between border transition-all ${
                            isEnrolled
                              ? "bg-primary/10 border-primary text-foreground font-semibold"
                              : "bg-background border-border/70 text-muted-foreground hover:bg-muted/40"
                          }`}
                        >
                          <span>{p.name}</span>
                          <span className="text-[10px]">{p.phone}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsRecurringModalOpen(false)}
                disabled={isSubmittingRec}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmittingRec}>
                {isSubmittingRec ? "Gerando Grade..." : "Gerar Turma Recorrente"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

