import React, { useState } from "react"
import { useClinicData } from "@/contexts/ClinicDataContext"
import type { ReplacementCredit, Schedule, Room, RoomType, Specialty } from "@/types"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select-native"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { formatDateBR, getTodayDateString } from "@/lib/dateUtils"
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
  Building,
  Plus,
  Edit2,
  Trash2,
  Users,
  Search,
  Check,
  X,
  UserX,
  AlertTriangle,
  DoorOpen,
  CheckCheck,
  FileSpreadsheet,
} from "lucide-react"
import { AbsenceModal } from "@/components/classes/AbsenceModal"
import { AttendanceReportView } from "@/components/classes/AttendanceReportView"
import { ViewModeToggle, type ViewMode } from "@/components/ui/view-mode-toggle"
import { AvailabilityManagerModal } from "@/components/availability/AvailabilityManagerModal"

const ROOM_TYPES: Array<{ id: RoomType; label: string }> = [
  { id: "pilates_aparelhos", label: "Pilates em Aparelhos" },
  { id: "pilates_solo", label: "Pilates Solo / Mat Pilates" },
  { id: "rpg", label: "Reeducação Postural Global (RPG)" },
  { id: "fisioterapia", label: "Fisioterapia Avançada" },
  { id: "consultorio", label: "Consultório Clínico" },
]

export const ClassesPage: React.FC = () => {
  const {
    rooms,
    addRoom,
    updateRoom,
    deleteRoom,
    professionals,
    schedules,
    patients,
    replacementCredits,
    addParticipantToClass,
    addRecurringScheduleSeries,
    updateSchedule,
    deleteSchedule,
    removeParticipantFromSchedule,
    checkIn,
    batchCheckIn,
  } = useClinicData()

  // Aba ativa (Turmas, Salas, Reposições, Relatório de Frequência)
  const [activeTab, setActiveTab] = useState<"turmas" | "salas" | "reposicoes" | "relatorio">("turmas")
  const [turmasViewMode, setTurmasViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem("altar_turmas_view_mode")
    return saved === "list" || saved === "grid" ? saved : "grid"
  })

  const handleTurmasViewModeChange = (mode: ViewMode) => {
    setTurmasViewMode(mode)
    localStorage.setItem("altar_turmas_view_mode", mode)
  }

  const [feedback, setFeedback] = useState<string | null>(null)

  // Estado do Modal de Falta
  const [absenceModalTarget, setAbsenceModalTarget] = useState<{
    isOpen: boolean
    scheduleId: string
    participantId: string
    studentName: string
    studentPhone?: string
    classNameTitle: string
    initialNotes?: string
    initialDebitPackage?: boolean
  }>({
    isOpen: false,
    scheduleId: "",
    participantId: "",
    studentName: "",
    classNameTitle: "",
  })

  // Modal de Gestão de Horários & Disponibilidade de Atendimento
  const [isAvailabilityModalOpen, setIsAvailabilityModalOpen] = useState(false)
  const [availabilityTargetRoomId, setAvailabilityTargetRoomId] = useState<string | undefined>(undefined)
  const [availabilityTargetProfId, setAvailabilityTargetProfId] = useState<string | undefined>(undefined)

  const handleOpenAvailabilityModal = (profId?: string, roomId?: string) => {
    setAvailabilityTargetProfId(profId)
    setAvailabilityTargetRoomId(roomId)
    setIsAvailabilityModalOpen(true)
  }

  // Ação em Lote: Marcar todos os matriculados como presentes
  const handleBatchCheckIn = async (scheduleId: string) => {
    try {
      const res = await batchCheckIn(scheduleId)
      if (res?.message) {
        setFeedback(res.message)
        setTimeout(() => setFeedback(null), 4000)
      }
    } catch (err) {
      console.error("Erro na chamada em lote:", err)
    }
  }

  // Filtros de Turmas
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedSpecialtyFilter, setSelectedSpecialtyFilter] = useState<string>("all")
  const [selectedRoomFilter, setSelectedRoomFilter] = useState<string>("all")

  // Modal 1: Matricular Aluno / Alocar Reposição
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null)
  const [selectedPatientId, setSelectedPatientId] = useState<string>("")
  const [isReplacementBooking, setIsReplacementBooking] = useState(false)
  const [selectedCreditId, setSelectedCreditId] = useState<string>("")

  // Modal 2: Alocação Rápida da Central de Reposições
  const [allocateCreditTarget, setAllocateCreditTarget] = useState<ReplacementCredit | null>(null)

  // Modal 3: Nova Série Recorrente
  const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false)
  const [recTitle, setRecTitle] = useState("")
  const [recSpecialty, setRecSpecialty] = useState<"pilates" | "fisioterapia" | "rpg">("pilates")
  const [recRoomId, setRecRoomId] = useState(rooms[0]?.id || "")
  const [recProfId, setRecProfId] = useState(professionals[0]?.id || "")
  const [recStartTime, setRecStartTime] = useState("08:00")
  const [recEndTime, setRecEndTime] = useState("08:55")
  const [recDaysOfWeek, setRecDaysOfWeek] = useState<number[]>([1, 3])
  const [recStartDate, setRecStartDate] = useState(getTodayDateString())
  const [recWeeksCount, setRecWeeksCount] = useState<number>(4)
  const [recEnrolledPatients, setRecEnrolledPatients] = useState<string[]>([])
  const [recError, setRecError] = useState<string | null>(null)
  const [isSubmittingRec, setIsSubmittingRec] = useState(false)

  // Modal 4: Editar Turma / Horário
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editSpecialty, setEditSpecialty] = useState<"pilates" | "fisioterapia" | "rpg">("pilates")
  const [editRoomId, setEditRoomId] = useState("")
  const [editProfId, setEditProfId] = useState("")
  const [editDate, setEditDate] = useState("")
  const [editStartTime, setEditStartTime] = useState("")
  const [editEndTime, setEditEndTime] = useState("")
  const [editMaxCapacity, setEditMaxCapacity] = useState(4)
  const [editNotes, setEditNotes] = useState("")
  const [isSubmittingEditSchedule, setIsSubmittingEditSchedule] = useState(false)

  // Modal 5: Excluir Turma
  const [deletingSchedule, setDeletingSchedule] = useState<Schedule | null>(null)
  const [deleteSeriesOption, setDeleteSeriesOption] = useState(false)
  const [isDeletingSchedule, setIsDeletingSchedule] = useState(false)

  // Modal 6: Nova / Editar Sala
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false)
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null)
  const [roomName, setRoomName] = useState("")
  const [roomType, setRoomType] = useState<RoomType>("pilates_aparelhos")
  const [roomCapacity, setRoomCapacity] = useState(4)
  const [roomColor, setRoomColor] = useState("#10b981")
  const [roomDescription, setRoomDescription] = useState("")
  const [roomIsActive, setRoomIsActive] = useState(true)
  const [isSubmittingRoom, setIsSubmittingRoom] = useState(false)

  // Modal 7: Excluir Sala
  const [deletingRoom, setDeletingRoom] = useState<Room | null>(null)
  const [isDeletingRoom, setIsDeletingRoom] = useState(false)

  // Modal 8: Remover Aluno da Turma
  const [removingStudent, setRemovingStudent] = useState<{ scheduleId: string; participantId: string; studentName: string } | null>(null)
  const [isRemovingStudent, setIsRemovingStudent] = useState(false)

  const showToast = (msg: string) => {
    setFeedback(msg)
    setTimeout(() => setFeedback(null), 3500)
  }

  // Filtrar apenas agendamentos de turmas
  const classSchedules = schedules.filter((s) => s.type === "turma")

  // Filtragem na UI
  const filteredTurmas = classSchedules.filter((s) => {
    const term = searchTerm.toLowerCase()
    const matchesSearch =
      s.title.toLowerCase().includes(term) ||
      s.roomName.toLowerCase().includes(term) ||
      s.professionalName.toLowerCase().includes(term) ||
      s.participants.some((p) => p.patientName.toLowerCase().includes(term))

    if (!matchesSearch) return false
    if (selectedSpecialtyFilter !== "all" && s.specialty !== selectedSpecialtyFilter) return false
    if (selectedRoomFilter !== "all" && s.roomId !== selectedRoomFilter) return false
    return true
  })

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

  // Submissão: Matrícula de Aluno
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
      showToast(
        isReplacementBooking
          ? "Aluno matriculado com sucesso usando crédito de reposição!"
          : "Aluno matriculado com sucesso na turma!"
      )
    } catch (err: any) {
      alert(err?.message || "Erro ao matricular aluno.")
    }
  }

  // Alocação Rápida da Central de Reposições
  const handleQuickAllocate = async (scheduleId: string) => {
    if (!allocateCreditTarget) return

    try {
      await addParticipantToClass(
        scheduleId,
        allocateCreditTarget.patientId,
        true,
        allocateCreditTarget.id
      )

      showToast(`Reposição alocada com sucesso para ${allocateCreditTarget.patientName}!`)
      setAllocateCreditTarget(null)
    } catch (err: any) {
      alert(err?.message || "Erro ao alocar reposição nesta turma.")
    }
  }

  // Submissão: Criar Série Recorrente
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

    try {
      const res = await addRecurringScheduleSeries({
        title: recTitle || `Turma de ${recSpecialty.toUpperCase()} (${room.name})`,
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

      showToast(`Grade gerada com sucesso! ${res.createdCount} aulas criadas.`)
      setIsRecurringModalOpen(false)
      setRecTitle("")
      setRecEnrolledPatients([])
    } catch (err: any) {
      setRecError(err?.message || "Erro ao gerar grade recorrente.")
    } finally {
      setIsSubmittingRec(false)
    }
  }

  // Abrir Modal de Edição de Turma
  const handleOpenEditSchedule = (s: Schedule) => {
    setEditingSchedule(s)
    setEditTitle(s.title)
    setEditSpecialty(s.specialty)
    setEditRoomId(s.roomId)
    setEditProfId(s.professionalId)
    setEditDate(s.date)
    setEditStartTime(s.startTime)
    setEditEndTime(s.endTime)
    setEditMaxCapacity(s.maxCapacity)
    setEditNotes(s.notes || "")
  }

  // Submeter Edição de Turma
  const handleSaveEditSchedule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingSchedule) return
    setIsSubmittingEditSchedule(true)

    try {
      await updateSchedule(editingSchedule.id, {
        title: editTitle,
        specialty: editSpecialty,
        roomId: editRoomId,
        professionalId: editProfId,
        date: editDate,
        startTime: editStartTime,
        endTime: editEndTime,
        maxCapacity: Number(editMaxCapacity),
        notes: editNotes,
      })
      showToast("Turma atualizada com sucesso!")
      setEditingSchedule(null)
    } catch (err: any) {
      alert("Erro ao atualizar turma: " + (err?.message || "Tente novamente."))
    } finally {
      setIsSubmittingEditSchedule(false)
    }
  }

  // Confirmar Exclusão de Turma
  const handleConfirmDeleteSchedule = async () => {
    if (!deletingSchedule) return
    setIsDeletingSchedule(true)

    try {
      await deleteSchedule(deletingSchedule.id, deleteSeriesOption)
      showToast(
        deleteSeriesOption
          ? "Série recorrente excluída com sucesso."
          : "Horário da turma excluído com sucesso."
      )
      setDeletingSchedule(null)
      setDeleteSeriesOption(false)
    } catch (err: any) {
      alert("Erro ao excluir turma: " + (err?.message || "Tente novamente."))
    } finally {
      setIsDeletingSchedule(false)
    }
  }

  // Confirmar Remoção de Aluno da Turma
  const handleConfirmRemoveStudent = async () => {
    if (!removingStudent) return
    setIsRemovingStudent(true)
    try {
      await removeParticipantFromSchedule(removingStudent.scheduleId, removingStudent.participantId)
      showToast(`Aluno ${removingStudent.studentName} desmatriculado da turma.`)
      setRemovingStudent(null)
    } catch (err: any) {
      alert("Erro ao remover aluno: " + (err?.message || "Tente novamente."))
    } finally {
      setIsRemovingStudent(false)
    }
  }

  // Gestão de Salas: Criar / Editar
  const handleOpenCreateRoom = () => {
    setEditingRoomId(null)
    setRoomName("")
    setRoomType("pilates_aparelhos")
    setRoomCapacity(4)
    setRoomColor("#10b981")
    setRoomDescription("")
    setRoomIsActive(true)
    setIsRoomModalOpen(true)
  }

  const handleOpenEditRoom = (room: Room) => {
    setEditingRoomId(room.id)
    setRoomName(room.name)
    setRoomType(room.type)
    setRoomCapacity(room.capacity)
    setRoomColor(room.color)
    setRoomDescription(room.description || "")
    setRoomIsActive(room.isActive)
    setIsRoomModalOpen(true)
  }

  const handleSaveRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!roomName) {
      alert("Por favor, preencha o nome do ambiente/sala.")
      return
    }
    setIsSubmittingRoom(true)

    try {
      if (editingRoomId) {
        await updateRoom(editingRoomId, {
          name: roomName,
          type: roomType,
          capacity: Number(roomCapacity),
          color: roomColor,
          description: roomDescription,
          isActive: roomIsActive,
        })
        showToast(`Sala "${roomName}" atualizada com sucesso!`)
      } else {
        await addRoom({
          name: roomName,
          type: roomType,
          capacity: Number(roomCapacity),
          color: roomColor,
          description: roomDescription,
          isActive: roomIsActive,
        })
        showToast(`Sala "${roomName}" cadastrada com sucesso!`)
      }
      setIsRoomModalOpen(false)
    } catch (err: any) {
      alert("Erro ao salvar sala: " + (err?.message || "Tente novamente."))
    } finally {
      setIsSubmittingRoom(false)
    }
  }

  const handleConfirmDeleteRoom = async () => {
    if (!deletingRoom) return
    setIsDeletingRoom(true)
    try {
      await deleteRoom(deletingRoom.id)
      showToast(`Ambiente "${deletingRoom.name}" excluído com sucesso.`)
      setDeletingRoom(null)
    } catch (err: any) {
      alert("Erro ao excluir sala: " + (err?.message || "Tente novamente."))
    } finally {
      setIsDeletingRoom(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Toast Feedback */}
      {feedback && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm font-medium animate-fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Header com Abas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Layers className="h-6 w-6 text-primary" />
            <span>Turmas & Salas Físicas</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Gestão unificada de turmas de Pilates e RPG, alocação de ambientes físicos e controle de reposições.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {activeTab !== "relatorio" && (
            <Button
              variant="outline"
              onClick={() => setActiveTab("relatorio")}
              className="gap-2 shadow-xs text-xs"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>Relatório de Frequência</span>
            </Button>
          )}

          {activeTab === "turmas" && (
            <Button
              onClick={() => {
                if (rooms.length > 0 && !recRoomId) setRecRoomId(rooms[0].id)
                if (professionals.length > 0 && !recProfId) setRecProfId(professionals[0].id)
                setIsRecurringModalOpen(true)
              }}
              className="gap-2 shadow-sm"
            >
              <Repeat className="h-4 w-4" />
              <span>Nova Série Recorrente</span>
            </Button>
          )}

          {activeTab === "salas" && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => handleOpenAvailabilityModal()}
                className="gap-2 shadow-sm border-primary/30 text-primary hover:bg-primary/5"
              >
                <Clock className="h-4 w-4" />
                <span>Horários de Atendimento & Escalas</span>
              </Button>
              <Button onClick={handleOpenCreateRoom} className="gap-2 shadow-sm">
                <Plus className="h-4 w-4" />
                <span>Nova Sala / Box</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs Principais */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 max-w-2xl w-full">
          <TabsTrigger value="turmas" className="text-xs gap-1.5">
            <Layers className="h-3.5 w-3.5" />
            <span>Turmas ({classSchedules.length})</span>
          </TabsTrigger>
          <TabsTrigger value="relatorio" className="text-xs gap-1.5">
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>Relatório & Faltas</span>
          </TabsTrigger>
          <TabsTrigger value="salas" className="text-xs gap-1.5">
            <DoorOpen className="h-3.5 w-3.5" />
            <span>Salas & Ambientes ({rooms.length})</span>
          </TabsTrigger>
          <TabsTrigger value="reposicoes" className="text-xs gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            <span>Reposições ({availableCredits.length})</span>
          </TabsTrigger>
        </TabsList>

        {/* ========================================================================= */}
        {/* ABA 1: TURMAS DE PILATES & RPG (CRUD COMPLETO)                           */}
        {/* ========================================================================= */}
        <TabsContent value="turmas" className="space-y-6">
          {/* Barra de Filtros */}
          <Card className="p-4 border-border shadow-xs">
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por turma, sala, instrutor ou aluno matriculado..."
                  className="pl-10 h-10 text-xs sm:text-sm"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="w-44 sm:w-48">
                  <Select
                    value={selectedSpecialtyFilter}
                    onChange={(e) => setSelectedSpecialtyFilter(e.target.value)}
                  >
                    <option value="all">Todas Modalidades</option>
                    <option value="pilates">Pilates</option>
                    <option value="rpg">RPG</option>
                    <option value="fisioterapia">Fisioterapia</option>
                  </Select>
                </div>

                <div className="w-44 sm:w-48">
                  <Select
                    value={selectedRoomFilter}
                    onChange={(e) => setSelectedRoomFilter(e.target.value)}
                  >
                    <option value="all">Todas as Salas</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <ViewModeToggle viewMode={turmasViewMode} onChange={handleTurmasViewModeChange} />
              </div>
            </div>
          </Card>

          {/* Grid de Turmas */}
          {filteredTurmas.length === 0 ? (
            <Card className="p-12 text-center border-border shadow-xs">
              <Layers className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-foreground">Nenhuma turma encontrada</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Crie uma série recorrente semanal ou ajuste os filtros de busca para visualizar os horários.
              </p>
              <Button
                onClick={() => setIsRecurringModalOpen(true)}
                variant="outline"
                size="sm"
                className="mt-4 gap-2 text-xs"
              >
                <Repeat className="h-3.5 w-3.5" />
                <span>Criar Série Recorrente</span>
              </Button>
            </Card>
          ) : (
            <div className={turmasViewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in" : "space-y-4 animate-fade-in"}>
              {filteredTurmas.map((schedule) => {
                const activeParticipants = schedule.participants.filter(
                  (p) => p.status !== "justified_absence"
                )
                const vacancies = schedule.maxCapacity - activeParticipants.length
                const isFull = vacancies <= 0

                return (
                  <Card
                    key={schedule.id}
                    className="border-border hover:border-primary/40 transition-all flex flex-col justify-between shadow-xs overflow-hidden"
                  >
                    <div>
                      {/* Header do Card com Cor da Sala */}
                      <div
                        className="h-2 w-full"
                        style={{ backgroundColor: schedule.roomColor || "#10b981" }}
                      />

                      <CardHeader className="p-4 pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-bold text-sm text-foreground">
                                {schedule.title}
                              </h3>
                              <Badge
                                variant={isFull ? "destructive" : "outline"}
                                className={`text-[10px] ${!isFull ? "text-emerald-600 border-emerald-600/30 bg-emerald-500/10" : ""}`}
                              >
                                {isFull ? "Turma Lotada" : `${vacancies} vaga${vacancies > 1 ? "s" : ""} livre${vacancies > 1 ? "s" : ""}`}
                              </Badge>
                              {schedule.isRecurring && (
                                <Badge variant="secondary" className="text-[9px] gap-1">
                                  <Repeat className="h-2.5 w-2.5" />
                                  <span>Recorrente</span>
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                              <span>📅 {formatDateBR(schedule.date)}</span>
                              <span>⏰ {schedule.startTime} - {schedule.endTime}</span>
                            </p>
                          </div>

                          {/* Ações de Edição e Exclusão da Turma */}
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenEditSchedule(schedule)}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                              title="Editar turma"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setDeletingSchedule(schedule)
                                setDeleteSeriesOption(false)
                              }}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                              title="Excluir turma"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>

                        {/* Detalhes de Ambiente e Instrutor */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground pt-2 border-t border-border/60 mt-2">
                          <span className="flex items-center gap-1 font-medium text-foreground">
                            <DoorOpen className="h-3.5 w-3.5 text-primary" />
                            {schedule.roomName}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5 text-primary" />
                            Instrutor: <strong>{schedule.professionalName}</strong>
                          </span>
                        </div>
                      </CardHeader>

                      {/* Lista de Alunos Matriculados */}
                      <CardContent className="p-4 pt-1 space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground pt-1">
                          <span>Alunos Matriculados ({activeParticipants.length}/{schedule.maxCapacity}):</span>
                          <div className="flex items-center gap-2">
                            {activeParticipants.length > 0 && (
                              <button
                                onClick={() => handleBatchCheckIn(schedule.id)}
                                className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 text-[11px] font-bold"
                                title="Marcar todos os alunos desta turma como presentes com 1 clique"
                              >
                                <CheckCheck className="h-3.5 w-3.5" />
                                <span>Marcar todos presentes</span>
                              </button>
                            )}

                            {!isFull && (
                              <button
                                onClick={() => {
                                  setSelectedScheduleId(schedule.id)
                                  setSelectedPatientId(patients[0]?.id || "")
                                }}
                                className="text-primary hover:underline flex items-center gap-1 text-[11px] font-bold"
                              >
                                <UserPlus className="h-3 w-3" />
                                <span>Matricular</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {schedule.participants.length === 0 ? (
                          <div className="py-4 text-center text-xs text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border">
                            Nenhum aluno matriculado ainda nesta aula.
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {schedule.participants.map((p) => {
                              const isJustified = p.status === "justified_absence"
                              const isPresent = p.status === "present"
                              const isAbsence = p.status === "absence"
                              return (
                                <div
                                  key={p.id}
                                  className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs transition-colors ${
                                    isJustified
                                      ? "bg-muted/30 border-dashed border-border opacity-70"
                                      : isPresent
                                      ? "bg-emerald-500/5 border-emerald-500/30"
                                      : isAbsence
                                      ? "bg-rose-500/5 border-rose-500/30"
                                      : "bg-card border-border/80"
                                  }`}
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-semibold text-foreground truncate">
                                        {p.patientName}
                                      </span>
                                      {p.status === "replacement" && (
                                        <Badge variant="warning" className="text-[9px] py-0 px-1.5">
                                          Reposição
                                        </Badge>
                                      )}
                                      {isPresent && (
                                        <Badge variant="success" className="text-[9px] py-0 px-1.5">
                                          Presente
                                        </Badge>
                                      )}
                                      {isAbsence && (
                                        <Badge variant="destructive" className="text-[9px] py-0 px-1.5">
                                          Falta
                                        </Badge>
                                      )}
                                      {isJustified && (
                                        <Badge variant="outline" className="text-[9px] py-0 px-1.5">
                                          Desmarcado (Vaga Liberada)
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">{p.patientPhone}</p>
                                    {p.notes && isAbsence && (
                                      <p className="text-[10px] text-rose-500 dark:text-rose-400 italic truncate max-w-[220px]" title={p.notes}>
                                        Motivo: {p.notes}
                                      </p>
                                    )}
                                  </div>

                                  {/* Ações por Aluno */}
                                  <div className="flex items-center gap-1 shrink-0">
                                    {/* Botão [✓ Presente] */}
                                    <Button
                                      size="sm"
                                      variant={isPresent ? "default" : "outline"}
                                      onClick={() => checkIn(schedule.id, p.id, isPresent ? "scheduled" : "present")}
                                      className={`h-7 px-2 text-[11px] gap-1 ${
                                        isPresent ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""
                                      }`}
                                      title={isPresent ? "Presença confirmada (Clique para desfazer)" : "Confirmar presença"}
                                    >
                                      <Check className="h-3 w-3" />
                                      <span>{isPresent ? "Presente" : "Check-in"}</span>
                                    </Button>

                                    {/* Botão [✕ Faltou] */}
                                    <Button
                                      size="sm"
                                      variant={isAbsence ? "destructive" : "outline"}
                                      onClick={() => {
                                        setAbsenceModalTarget({
                                          isOpen: true,
                                          scheduleId: schedule.id,
                                          participantId: p.id,
                                          studentName: p.patientName,
                                          studentPhone: p.patientPhone,
                                          classNameTitle: schedule.title,
                                          initialNotes: p.notes,
                                        })
                                      }}
                                      className={`h-7 px-2 text-[11px] gap-1 ${
                                        isAbsence ? "bg-rose-600 hover:bg-rose-700 text-white" : "hover:text-rose-600 hover:border-rose-300"
                                      }`}
                                      title={isAbsence ? "Falta registrada (Clique para ver/editar)" : "Marcar que o aluno faltou"}
                                    >
                                      <UserX className="h-3 w-3" />
                                      <span>{isAbsence ? "Faltou" : "Falta"}</span>
                                    </Button>

                                    {/* Botão Remover/Desmatricular */}
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() =>
                                        setRemovingStudent({
                                          scheduleId: schedule.id,
                                          participantId: p.id,
                                          studentName: p.patientName,
                                        })
                                      }
                                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                      title="Desmatricular aluno desta turma"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </CardContent>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* ========================================================================= */}
        {/* ABA 2: SALAS & AMBIENTES (CRUD COMPLETO)                                  */}
        {/* ========================================================================= */}
        <TabsContent value="salas" className="space-y-6">
          {/* Grid de Salas Físicas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rooms.map((room) => {
              const typeDef = ROOM_TYPES.find((t) => t.id === room.type)
              return (
                <Card
                  key={room.id}
                  className="border-border hover:border-primary/40 transition-all flex flex-col justify-between shadow-xs overflow-hidden"
                >
                  <div>
                    {/* Tarja Colorida da Sala */}
                    <div className="h-2.5 w-full" style={{ backgroundColor: room.color || "#10b981" }} />

                    <CardHeader className="p-5 pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="h-10 w-10 rounded-2xl flex items-center justify-center font-bold text-white shadow-xs"
                            style={{ backgroundColor: room.color || "#10b981" }}
                          >
                            <DoorOpen className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="font-bold text-base text-foreground leading-tight">
                              {room.name}
                            </h3>
                            <Badge variant="outline" className="text-[10px] mt-1">
                              {typeDef?.label || room.type}
                            </Badge>
                          </div>
                        </div>

                        <Badge
                          variant={room.isActive ? "default" : "outline"}
                          className={`text-[10px] shrink-0 font-semibold ${
                            room.isActive
                              ? "bg-emerald-600/10 text-emerald-600 border-emerald-600/30"
                              : "text-muted-foreground"
                          }`}
                        >
                          {room.isActive ? "Ativa" : "Inativa"}
                        </Badge>
                      </div>

                      {room.description && (
                        <p className="text-xs text-muted-foreground pt-3 line-clamp-2">
                          {room.description}
                        </p>
                      )}
                    </CardHeader>

                    <CardContent className="p-5 pt-0 space-y-3">
                      <div className="p-3 rounded-xl bg-muted/40 border border-border flex items-center justify-between text-xs">
                        <span className="text-muted-foreground font-medium">Capacidade Máxima:</span>
                        <span className="font-bold text-foreground">
                          {room.capacity} aluno{room.capacity > 1 ? "s" : ""} simultâneo{room.capacity > 1 ? "s" : ""}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-border flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenAvailabilityModal(undefined, room.id)}
                          className="text-xs h-8 px-2.5 gap-1.5 text-foreground border-border hover:border-primary/40 hover:bg-primary/5"
                          title="Gerenciar horários de atendimento desta sala"
                        >
                          <Clock className="h-3.5 w-3.5 text-primary" />
                          <span>Horários</span>
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenEditRoom(room)}
                          className="text-xs h-8 px-2.5 gap-1 text-primary border-primary/30 hover:bg-primary/5"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          <span>Editar</span>
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDeletingRoom(room)}
                          className="text-xs h-8 px-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                          title="Excluir sala"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </div>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        {/* ========================================================================= */}
        {/* ABA 3: CENTRAL DE REPOSIÇÕES                                              */}
        {/* ========================================================================= */}
        <TabsContent value="reposicoes" className="space-y-6">
          <Card className="border-border shadow-xs">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                <Clock className="h-5 w-5 text-amber-500" />
                <span>Radar de Créditos de Reposição ({availableCredits.length})</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Créditos gerados automaticamente quando o paciente desmarca com a antecedência mínima configurada.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-5 pt-2">
              {availableCredits.length === 0 ? (
                <div className="py-10 text-center text-xs text-muted-foreground">
                  Nenhum crédito de reposição disponível no momento.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {availableCredits.map((credit) => (
                    <div
                      key={credit.id}
                      className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 flex flex-col justify-between gap-3 shadow-2xs"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-bold text-sm text-foreground">{credit.patientName}</h4>
                          <Badge variant="warning" className="text-[10px]">
                            {credit.daysLeft ?? 30} dias restantes
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Origem: Aula desmarcada em {formatDateBR(credit.originDate)}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Expira em: <strong>{formatDateBR(credit.expiryDate)}</strong>
                        </p>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => setAllocateCreditTarget(credit)}
                        className="w-full text-xs gap-1.5 h-8 bg-amber-600 hover:bg-amber-700 text-white"
                      >
                        <ArrowRight className="h-3.5 w-3.5" />
                        <span>Alocar em Turma Aberta</span>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================================= */}
        {/* ABA 4: RELATÓRIO DE FREQUÊNCIA, CHECK-IN & FALTAS COM EXPORTAÇÃO XLS     */}
        {/* ========================================================================= */}
        <TabsContent value="relatorio" className="space-y-6">
          <AttendanceReportView onBackToClasses={() => setActiveTab("turmas")} />
        </TabsContent>
      </Tabs>

      {/* MODAIS */}

      {/* Modal: Matricular Aluno na Turma */}
      <Dialog open={!!selectedScheduleId} onOpenChange={(open) => !open && setSelectedScheduleId(null)}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleEnroll}>
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-xl font-bold text-foreground">Matricular Aluno na Turma</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Selecione o paciente e especifique se o agendamento utilizará vaga regular ou crédito de reposição.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-5 text-sm">
              <div>
                <label className="block text-xs font-semibold text-foreground/85 mb-1.5">Selecionar Aluno *</label>
                <Select
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                >
                  <option value="">Selecione um paciente...</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.documentCpf})
                    </option>
                  ))}
                </Select>
              </div>

              <div className="p-3.5 rounded-xl border border-border bg-muted/20 flex items-center gap-3">
                <input
                  type="checkbox"
                  id="use-replacement"
                  checked={isReplacementBooking}
                  onChange={(e) => setIsReplacementBooking(e.target.checked)}
                  className="rounded border-input text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                />
                <label htmlFor="use-replacement" className="font-medium text-foreground cursor-pointer text-xs select-none">
                  Utilizar crédito de reposição existente
                </label>
              </div>
            </div>

            <DialogFooter className="gap-2 pt-2 sm:space-x-2">
              <Button type="button" variant="outline" onClick={() => setSelectedScheduleId(null)} className="h-10 px-5 rounded-xl font-semibold">
                Cancelar
              </Button>
              <Button type="submit" className="h-10 px-6 rounded-xl font-semibold shadow-xs">
                Confirmar Matrícula
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Alocação Direta de Reposição */}
      <Dialog open={!!allocateCreditTarget} onOpenChange={(open) => !open && setAllocateCreditTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Alocar Reposição para {allocateCreditTarget?.patientName}</DialogTitle>
            <DialogDescription>
              Selecione uma turma com vaga aberta para alocar a reposição em 1 clique.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-3 max-h-60 overflow-y-auto">
            {turmasWithVacancies.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                Nenhuma turma com vaga disponível no momento.
              </p>
            ) : (
              turmasWithVacancies.map((t) => (
                <div
                  key={t.id}
                  className="p-3 rounded-xl border border-border flex items-center justify-between gap-2"
                >
                  <div>
                    <h4 className="font-bold text-xs text-foreground">{t.title}</h4>
                    <p className="text-[11px] text-muted-foreground">
                      {formatDateBR(t.date)} às {t.startTime} • {t.roomName}
                    </p>
                  </div>
                  <Button size="sm" onClick={() => handleQuickAllocate(t.id)} className="h-7 text-xs">
                    Alocar
                  </Button>
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAllocateCreditTarget(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Criar Série Recorrente */}
      <Dialog open={isRecurringModalOpen} onOpenChange={setIsRecurringModalOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleCreateRecurringSeries}>
            <DialogHeader className="space-y-1">
              <DialogTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
                <Repeat className="h-5 w-5 text-primary" />
                <span>Criar Turma Recorrente Semanal</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Gere a grade semanal contínua de aulas (ex: Pilates Seg/Qua) com prevenção automática de conflitos.
              </DialogDescription>
            </DialogHeader>

            {recError && (
              <div className="mt-3 p-3.5 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="font-medium">{recError}</span>
              </div>
            )}

            <div className="space-y-4 py-5 text-sm">
              <div>
                <label className="block text-xs font-semibold text-foreground/85 mb-1.5">Título da Turma *</label>
                <Input
                  required
                  value={recTitle}
                  onChange={(e) => setRecTitle(e.target.value)}
                  placeholder="Ex: Pilates Reformer Manhã"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground/85 mb-1.5">Modalidade *</label>
                  <Select
                    value={recSpecialty}
                    onChange={(e) => setRecSpecialty(e.target.value as any)}
                  >
                    <option value="pilates">Pilates</option>
                    <option value="rpg">RPG</option>
                    <option value="fisioterapia">Fisioterapia</option>
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground/85 mb-1.5">Sala / Ambiente *</label>
                  <Select
                    value={recRoomId}
                    onChange={(e) => setRecRoomId(e.target.value)}
                  >
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} (Cap: {r.capacity})
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground/85 mb-1.5">Instrutor Responsável *</label>
                <Select
                  value={recProfId}
                  onChange={(e) => setRecProfId(e.target.value)}
                >
                  {professionals.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.crefito})
                    </option>
                  ))}
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground/85 mb-1.5">Horário Início *</label>
                  <Input
                    type="time"
                    value={recStartTime}
                    onChange={(e) => setRecStartTime(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground/85 mb-1.5">Horário Término *</label>
                  <Input
                    type="time"
                    value={recEndTime}
                    onChange={(e) => setRecEndTime(e.target.value)}
                  />
                </div>
              </div>

              {/* Dias da Semana */}
              <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/5 space-y-2.5">
                <span className="font-semibold text-foreground block text-xs">
                  Dias da Semana da Recorrência
                </span>
                <div className="grid grid-cols-6 gap-2">
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
                        className={`py-2 rounded-xl text-xs font-bold border transition-all ${
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
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground/85 mb-1.5">Data Inicial *</label>
                  <Input
                    type="date"
                    value={recStartDate}
                    onChange={(e) => setRecStartDate(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground/85 mb-1.5">Duração da Série</label>
                  <Select
                    value={recWeeksCount}
                    onChange={(e) => setRecWeeksCount(Number(e.target.value))}
                  >
                    <option value={4}>4 semanas (1 mês)</option>
                    <option value={8}>8 semanas (2 meses)</option>
                    <option value={12}>12 semanas (3 meses)</option>
                    <option value={24}>24 semanas (6 meses)</option>
                  </Select>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 pt-2 sm:space-x-2">
              <Button type="button" variant="outline" onClick={() => setIsRecurringModalOpen(false)} className="h-10 px-5 rounded-xl font-semibold">
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmittingRec} className="h-10 px-6 rounded-xl font-semibold shadow-xs">
                {isSubmittingRec ? "Gerando..." : "Gerar Série Recorrente"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Editar Turma */}
      <Dialog open={!!editingSchedule} onOpenChange={(open) => !open && setEditingSchedule(null)}>
        <DialogContent className="sm:max-w-xl">
          <form onSubmit={handleSaveEditSchedule}>
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-xl font-bold text-foreground">Editar Horário da Turma</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Ajuste a sala, horário, profissional ou capacidade máxima desta turma.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-5 text-sm">
              <div>
                <label className="block text-xs font-semibold text-foreground/85 mb-1.5">Título da Turma *</label>
                <Input
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Ex: Turma Pilates Manhã"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground/85 mb-1.5">Sala *</label>
                  <Select
                    value={editRoomId}
                    onChange={(e) => setEditRoomId(e.target.value)}
                  >
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground/85 mb-1.5">Profissional *</label>
                  <Select
                    value={editProfId}
                    onChange={(e) => setEditProfId(e.target.value)}
                  >
                    {professionals.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-foreground/85 mb-1.5">Data</label>
                  <Input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground/85 mb-1.5">Início</label>
                  <Input
                    type="time"
                    value={editStartTime}
                    onChange={(e) => setEditStartTime(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground/85 mb-1.5">Término</label>
                  <Input
                    type="time"
                    value={editEndTime}
                    onChange={(e) => setEditEndTime(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground/85 mb-1.5">Capacidade Máxima (Vagas)</label>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={editMaxCapacity}
                  onChange={(e) => setEditMaxCapacity(Number(e.target.value))}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground/85 mb-1.5">Observações</label>
                <Input
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Ex: Trazer toalha individual"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 pt-2 sm:space-x-2">
              <Button type="button" variant="outline" onClick={() => setEditingSchedule(null)} className="h-10 px-5 rounded-xl font-semibold">
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmittingEditSchedule} className="h-10 px-6 rounded-xl font-semibold shadow-xs">
                {isSubmittingEditSchedule ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Excluir Turma */}
      <Dialog open={!!deletingSchedule} onOpenChange={(open) => !open && setDeletingSchedule(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="h-10 w-10 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-2">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <DialogTitle>Excluir Turma / Horário</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir <strong>{deletingSchedule?.title}</strong> no dia{" "}
              {formatDateBR(deletingSchedule?.date)} ({deletingSchedule?.startTime})?
            </DialogDescription>
          </DialogHeader>

          {deletingSchedule?.isRecurring && (
            <div className="p-3 rounded-xl bg-muted/40 border border-border text-xs space-y-2">
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-foreground">
                <input
                  type="checkbox"
                  checked={deleteSeriesOption}
                  onChange={(e) => setDeleteSeriesOption(e.target.checked)}
                  className="rounded border-input text-destructive h-4 w-4"
                />
                <span>Excluir todas as aulas futuras desta série recorrente</span>
              </label>
              <p className="text-[11px] text-muted-foreground pl-6">
                Se desmarcado, apenas esta aula individual será removida.
              </p>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setDeletingSchedule(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDeleteSchedule}
              disabled={isDeletingSchedule}
            >
              {isDeletingSchedule ? "Excluindo..." : "Confirmar Exclusão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Desmatricular Aluno */}
      <Dialog open={!!removingStudent} onOpenChange={(open) => !open && setRemovingStudent(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Desmatricular Aluno</DialogTitle>
            <DialogDescription>
              Remover <strong>{removingStudent?.studentName}</strong> desta turma? A vaga ficará livre para outro aluno ou reposição.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setRemovingStudent(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmRemoveStudent}
              disabled={isRemovingStudent}
            >
              {isRemovingStudent ? "Removendo..." : "Remover Aluno"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Nova / Editar Sala */}
      <Dialog open={isRoomModalOpen} onOpenChange={setIsRoomModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleSaveRoom}>
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-xl font-bold text-foreground">
                {editingRoomId ? "Editar Ambiente / Sala" : "Cadastrar Novo Ambiente / Sala"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Configure o nome, capacidade simultânea de aparelhos/alunos e cor de identificação da sala.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-5 text-sm">
              <div>
                <label className="block text-xs font-semibold text-foreground/85 mb-1.5">Nome da Sala / Box *</label>
                <Input
                  required
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="Ex: Studio Reformer 1"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground/85 mb-1.5">Tipo de Ambiente *</label>
                  <Select
                    value={roomType}
                    onChange={(e) => setRoomType(e.target.value as any)}
                  >
                    {ROOM_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground/85 mb-1.5">Capacidade Máxima *</label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    required
                    value={roomCapacity}
                    onChange={(e) => setRoomCapacity(Number(e.target.value))}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground/85 mb-1.5">Cor Visual do Ambiente</label>
                <div className="flex items-center gap-2.5">
                  <input
                    type="color"
                    value={roomColor}
                    onChange={(e) => setRoomColor(e.target.value)}
                    className="h-10 w-14 rounded-xl border border-input p-1 cursor-pointer bg-background"
                  />
                  <Input
                    value={roomColor}
                    onChange={(e) => setRoomColor(e.target.value)}
                    className="font-mono text-xs uppercase"
                    placeholder="#10B981"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground/85 mb-1.5">Descrição / Equipamentos</label>
                <Input
                  value={roomDescription}
                  onChange={(e) => setRoomDescription(e.target.value)}
                  placeholder="Ex: 4 Reformers com torre, cadillac e chair"
                />
              </div>

              <div className="p-3.5 rounded-xl border border-border bg-muted/20 flex items-center gap-3">
                <input
                  type="checkbox"
                  id="room-active"
                  checked={roomIsActive}
                  onChange={(e) => setRoomIsActive(e.target.checked)}
                  className="rounded border-input text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                />
                <label htmlFor="room-active" className="font-medium text-foreground cursor-pointer text-xs select-none">
                  Ambiente Ativo para Agendamentos
                </label>
              </div>
            </div>

            <DialogFooter className="gap-2 pt-2 sm:space-x-2">
              <Button type="button" variant="outline" onClick={() => setIsRoomModalOpen(false)} className="h-10 px-5 rounded-xl font-semibold">
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmittingRoom} className="h-10 px-6 rounded-xl font-semibold shadow-xs">
                {isSubmittingRoom ? "Salvando..." : editingRoomId ? "Salvar Alterações" : "Cadastrar Sala"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Excluir Sala */}
      <Dialog open={!!deletingRoom} onOpenChange={(open) => !open && setDeletingRoom(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="h-10 w-10 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-2">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <DialogTitle>Excluir Sala / Ambiente</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o ambiente <strong>{deletingRoom?.name}</strong>?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setDeletingRoom(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDeleteRoom}
              disabled={isDeletingRoom}
            >
              {isDeletingRoom ? "Excluindo..." : "Confirmar Exclusão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Registro de Falta */}
      <AbsenceModal
        isOpen={absenceModalTarget.isOpen}
        onClose={() => setAbsenceModalTarget((prev) => ({ ...prev, isOpen: false }))}
        studentName={absenceModalTarget.studentName}
        studentPhone={absenceModalTarget.studentPhone}
        classNameTitle={absenceModalTarget.classNameTitle}
        initialNotes={absenceModalTarget.initialNotes}
        initialDebitPackage={absenceModalTarget.initialDebitPackage ?? true}
        onConfirm={async (notes, debitPackage) => {
          const res = await checkIn(
            absenceModalTarget.scheduleId,
            absenceModalTarget.participantId,
            "absence",
            {
              notes,
              debitPackageOnAbsence: debitPackage,
            }
          )
          if (res?.message) {
            setFeedback(res.message)
            setTimeout(() => setFeedback(null), 4000)
          }
        }}
      />

      {/* Modal Unificado de Gestão de Horários & Disponibilidade */}
      <AvailabilityManagerModal
        isOpen={isAvailabilityModalOpen}
        onClose={() => setIsAvailabilityModalOpen(false)}
        initialRoomId={availabilityTargetRoomId}
        initialProfessionalId={availabilityTargetProfId}
      />
    </div>
  )
}
