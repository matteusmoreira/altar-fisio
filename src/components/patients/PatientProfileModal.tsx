import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { PortalAccessSettings } from './PortalAccessSettings'
import { useQuery, useMutation } from '@/lib/staffConvex'
import { api } from '@convex/_generated/api'
import React, { useState, useMemo, useRef, useEffect } from "react"
import { useClinicData } from "@/contexts/ClinicDataContext"
import type { Patient, Specialty } from "@/types"
import { RichTextEditor } from "./RichTextEditor"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { formatDateBR, formatDateTimeBR, formatDateExtendedBR, getTodayDateString } from "@/lib/dateUtils"
import { formatPhoneBR, cleanPhoneDigits } from "@/lib/utils"
import { formatCep } from "../../../shared/patientIdentity"
import { formatSpecialtyName, formatScheduleTitle, DEFAULT_CLINICAL_SPECIALTIES } from "../../../shared/clinicalSpecialties"
import {
  User,
  Phone,
  Calendar,
  HeartPulse,
  Shield,
  FileText,
  Layers,
  Clock,
  CheckCircle2,
  AlertCircle,
  Printer,
  FileCheck2,
  Edit2,
  ChevronRight,
  TrendingUp,
  CalendarX,
  AlertTriangle,
  Loader2,
  Save,
  MapPin,
  CalendarDays,
  ArrowRight,
  Building,
  XCircle,
} from "lucide-react"

interface PatientProfileModalProps {
  patient: Patient | null
  isOpen: boolean
  onClose: () => void
  onEdit: (patient: Patient) => void
  onNavigateToClinical?: (patientId: string) => void
  onNavigateToReports?: (patientId: string) => void
}

const DAY_NAMES = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
]

const SHORT_DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

export const PatientProfileModal: React.FC<PatientProfileModalProps> = ({
  patient,
  isOpen,
  onClose,
  onEdit,
  onNavigateToClinical,
  onNavigateToReports,
}) => {
  const {
    patientPackages,
    packages,
    replacementCredits,
    transactions,
    clinicalReports,
    getClinicalRecord,
    getEvolutions,
    removeParticipantFromSchedule,
  } = useClinicData()

  const { role, user } = useAuth()
  const { theme } = useTheme()
  const clinicSettings = useQuery(api.clinic.getSettings)
  const clinicDisplayName = theme.clinicName || clinicSettings?.clinicName || "Clinica Dr Marcelo"
  const clinicSubtitle = theme.clinicSubtitle || clinicSettings?.clinicSubtitle || "Clínica de Fisioterapia, Studio de Pilates & RPG"
  const clinicLogoUrl = theme.logoUrl || clinicSettings?.logoUrl
  const clinicPhone = theme.phone || clinicSettings?.phone || "(22) 99999-1417"
  const clinicAddress = theme.address || clinicSettings?.address || "Amaral Peixoto, 4473 · Sala 302 · Centro · Rio das Ostras - RJ"
  const clinicWebsite = "https://clinicadrmarcelo.com.br"
  const clinicCnpj = theme.cnpj || clinicSettings?.cnpj || ""

  const canEditPatient = role === 'admin'
  const [activeTab, setActiveTab] = useState<
    "overview" | "classes" | "complaint"
  >("overview")
  const [attendanceFilter, setAttendanceFilter] = useState<
    "all" | "present" | "absence" | "replacement" | "scheduled"
  >("all")
  const [selectedPhotoZoom, setSelectedPhotoZoom] = useState<{
    url: string
    title: string
  } | null>(null)

  // Estado da Queixa Principal com Editor Rico
  const [chiefComplaintText, setChiefComplaintText] = useState("")
  const [isSavingComplaint, setIsSavingComplaint] = useState(false)
  const [complaintSaveStatus, setComplaintSaveStatus] = useState<"saved" | "saving" | "unsaved" | "error">("saved")
  const [printTarget, setPrintTarget] = useState<"patient-sheet" | "chief-complaint">("patient-sheet")
  const complaintDebounceRef = useRef<NodeJS.Timeout | null>(null)
  const saveChiefComplaintMutation = useMutation(api.clinical.saveChiefComplaint)

  // Estado para desmarcação de agendamento do paciente
  const [cancelTarget, setCancelTarget] = useState<{
    scheduleId: string
    participantId: string
    title: string
    date: string
    startTime: string
    endTime: string
    roomName: string
    professionalName: string
  } | null>(null)
  const [isCancelling, setIsCancelling] = useState(false)
  const [feedbackToast, setFeedbackToast] = useState<{ message: string; type: "success" | "error" } | null>(null)
  const feedbackTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current)
      }
    }
  }, [])

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return
    setIsCancelling(true)
    try {
      await removeParticipantFromSchedule(cancelTarget.scheduleId, cancelTarget.participantId)
      const formattedDate = formatDateBR(cancelTarget.date)
      setFeedbackToast({
        message: `Atendimento de ${formattedDate} às ${cancelTarget.startTime} desmarcado com sucesso. Vaga liberada!`,
        type: "success",
      })
      setCancelTarget(null)
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
      feedbackTimerRef.current = setTimeout(() => {
        setFeedbackToast(null)
      }, 4000)
    } catch (err: any) {
      alert(`Erro ao desmarcar atendimento: ${err?.message || "Falha ao processar cancelamento."}`)
    } finally {
      setIsCancelling(false)
    }
  }

  const storedPatientSchedules = useQuery(
    api.schedules.listSchedulesForPatient,
    patient && isOpen ? { patientId: patient.id as any } : "skip"
  )

  const dbClinicalSpecialties = useQuery(api.clinic.getClinicalSpecialties, {})
  const clinicalSpecialties =
    Array.isArray(dbClinicalSpecialties) &&
    dbClinicalSpecialties.length > 0 &&
    (dbClinicalSpecialties[0] as any)?.id &&
    (dbClinicalSpecialties[0] as any)?.name
      ? dbClinicalSpecialties
      : DEFAULT_CLINICAL_SPECIALTIES

  // Cálculo da idade
  const age = useMemo(() => {
    if (!patient?.birthDate) return null
    const parts = patient.birthDate.split("-")
    if (parts.length < 3) return null
    const birthYear = parseInt(parts[0], 10)
    const birthMonth = parseInt(parts[1], 10) - 1
    const birthDay = parseInt(parts[2], 10)
    const today = new Date()
    let calculatedAge = today.getFullYear() - birthYear
    const m = today.getMonth() - birthMonth
    if (m < 0 || (m === 0 && today.getDate() < birthDay)) {
      calculatedAge--
    }
    return calculatedAge >= 0 ? calculatedAge : null
  }, [patient?.birthDate])

  // Agendamentos e Presenças do Paciente (com títulos e modalidades higienizados sem underscores)
  const patientSchedules = useMemo(() => {
    if (!patient) return []
    const schedulesList = Array.isArray(storedPatientSchedules) ? storedPatientSchedules : []
    return schedulesList
      .filter((s) => s && Array.isArray(s.participants) && s.participants.some((p) => p.patientId === patient.id))
      .map((s) => {
        const participant = s.participants.find((p) => p.patientId === patient.id)!
        const cleanTitle = formatScheduleTitle(s.title, {
          roomName: s.roomName,
          specialty: s.specialty,
          startTime: s.startTime,
          specialties: clinicalSpecialties,
        })
        const cleanSpecialty = formatSpecialtyName(s.specialty, clinicalSpecialties, s.roomName)
        return {
          scheduleId: s._id,
          participantId: (participant as any)._id || (participant as any).id,
          title: cleanTitle,
          type: s.type,
          specialty: cleanSpecialty,
          date: s.date,
          startTime: s.startTime,
          endTime: s.endTime,
          roomName: s.roomName,
          roomColor: s.roomColor,
          professionalName: s.professionalName,
          recurringGroupId: s.recurringGroupId,
          isRecurring: s.isRecurring,
          status: participant.status,
          checkedInAt: participant.checkedInAt,
          notes: participant.notes,
        }
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime))
  }, [storedPatientSchedules, patient, clinicalSpecialties])

  // Próximos agendamentos futuros do paciente (para visualização imediata)
  const upcomingSchedules = useMemo(() => {
    const today = getTodayDateString()
    return patientSchedules
      .filter((s) => s.date >= today && (s.status === "scheduled" || s.status === "replacement"))
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
  }, [patientSchedules])

  // Métricas de Presença e Assiduidade
  const attendanceStats = useMemo(() => {
    const total = patientSchedules.length
    const presents = patientSchedules.filter((s) => s.status === "present").length
    const absences = patientSchedules.filter((s) => s.status === "absence").length
    const justified = patientSchedules.filter(
      (s) => s.status === "justified_absence"
    ).length
    const replacements = patientSchedules.filter(
      (s) => s.status === "replacement"
    ).length
    const scheduled = patientSchedules.filter(
      (s) => s.status === "scheduled"
    ).length

    const completedTotal = presents + absences + justified
    const rate =
      completedTotal > 0
        ? Math.round((presents / completedTotal) * 100)
        : total > 0
        ? 100
        : 0

    return {
      total,
      presents,
      absences,
      justified,
      replacements,
      scheduled,
      rate,
    }
  }, [patientSchedules])

  // Identificação de Turmas Fixas / Regulares / Séries Recorrentes
  const activeTurmas = useMemo(() => {
    if (!patient) return []
    const today = getTodayDateString()

    // Filtra agendamentos do tipo "turma" ou criados como série recorrente
    const turmaSchedules = patientSchedules.filter(
      (s) => s.type === "turma" || s.recurringGroupId || s.isRecurring
    )

    // Agrupa por assinatura única da série ou título + horário + sala
    const groups: {
      [key: string]: {
        title: string
        specialty: Specialty
        startTime: string
        endTime: string
        roomName: string
        roomColor: string
        professionalName: string
        daysOfWeek: Set<number>
        upcomingCount: number
        totalCount: number
        lastDate: string
      }
    } = {}

    turmaSchedules.forEach((s) => {
      const key = s.recurringGroupId || `${s.title}|${s.startTime}|${s.endTime}|${s.roomName}`
      const d = new Date(s.date + "T12:00:00")
      const dayOfWeek = d.getDay()

      if (!groups[key]) {
        groups[key] = {
          title: s.title,
          specialty: s.specialty as Specialty,
          startTime: s.startTime,
          endTime: s.endTime,
          roomName: s.roomName,
          roomColor: s.roomColor,
          professionalName: s.professionalName,
          daysOfWeek: new Set([dayOfWeek]),
          upcomingCount: s.date >= today ? 1 : 0,
          totalCount: 1,
          lastDate: s.date,
        }
      } else {
        groups[key].daysOfWeek.add(dayOfWeek)
        groups[key].totalCount++
        if (s.date >= today) {
          groups[key].upcomingCount++
        }
        if (s.date > groups[key].lastDate) {
          groups[key].lastDate = s.date
        }
      }
    })

    return Object.values(groups).map((g) => {
      const sortedDays = Array.from(g.daysOfWeek).sort((a, b) => a - b)
      const dayLabels = sortedDays.map((d) => SHORT_DAY_NAMES[d]).join(" e ")
      return {
        ...g,
        dayLabels,
        isCurrentlyActive: g.upcomingCount > 0,
      }
    })
  }, [patientSchedules, patient])

  // Pacotes do Paciente
  const patientPackagesList = useMemo(() => {
    if (!patient) return []
    return patientPackages
      .filter((pp) => pp.patientId === patient.id)
      .map((pp) => {
        const pkg = packages.find((p) => p.id === pp.packageId)
        const progressPercent =
          pp.totalSessions > 0
            ? Math.round((pp.usedSessions / pp.totalSessions) * 100)
            : 0
        return {
          ...pp,
          packageName: pkg?.name || "Pacote de Sessões",
          packagePrice: pkg?.price || 0,
          progressPercent,
        }
      })
      .sort((a, b) => (a.status === "active" ? -1 : 1))
  }, [patientPackages, packages, patient])

  // Total de sessões restantes em pacotes ativos
  const activePackageSummary = useMemo(() => {
    const activePkgs = patientPackagesList.filter((pp) => pp.status === "active")
    if (activePkgs.length === 0) return null
    const totalRemaining = activePkgs.reduce((acc, p) => acc + p.remainingSessions, 0)
    const totalContracted = activePkgs.reduce((acc, p) => acc + p.totalSessions, 0)
    return {
      primaryName: activePkgs[0].packageName,
      remaining: totalRemaining,
      total: totalContracted,
      expiryDate: activePkgs[0].expiryDate,
    }
  }, [patientPackagesList])

  // Créditos de Reposição
  const patientCredits = useMemo(() => {
    if (!patient) return []
    return replacementCredits.filter((rc) => rc.patientId === patient.id)
  }, [replacementCredits, patient])

  // Prontuário Clínico & Evoluções
  const clinicalRecord = useQuery(api.clinical.getClinicalRecord, patient && isOpen ? { patientId: patient.id as any } : 'skip')

  const storedEvolutions = useQuery(api.clinical.listEvolutions, patient && isOpen ? { patientId: patient.id as any } : 'skip')
  const evolutions = (Array.isArray(storedEvolutions) ? storedEvolutions : []).map(e => ({ ...e, id: e._id, professionalName: e.signedProfessionalName, patientName: patient?.name || '' }))

  // Último nível de dor registrado
  const currentPainEva = useMemo(() => {
    if (evolutions.length > 0 && evolutions[0].painScaleAfter !== undefined) {
      return evolutions[0].painScaleAfter
    }
    if (clinicalRecord?.painScaleEva !== undefined) {
      return clinicalRecord.painScaleEva
    }
    return null
  }, [evolutions, clinicalRecord])

  const lastLoadedPatientIdRef = useRef<string | null>(null)

  // Sincronização e Gerenciamento da Queixa Principal
  useEffect(() => {
    if (!patient) return
    const isNewPatient = lastLoadedPatientIdRef.current !== patient.id
    if (isNewPatient) {
      lastLoadedPatientIdRef.current = patient.id
      setChiefComplaintText(clinicalRecord?.chiefComplaint || "")
      setComplaintSaveStatus("saved")
      return
    }

    // Se é o mesmo paciente e não há alterações locais pendentes, sincroniza com o servidor
    if (complaintSaveStatus !== "unsaved" && clinicalRecord?.chiefComplaint !== undefined) {
      if (chiefComplaintText !== clinicalRecord.chiefComplaint) {
        setChiefComplaintText(clinicalRecord.chiefComplaint || "")
      }
    }
  }, [patient?.id, clinicalRecord?.chiefComplaint, complaintSaveStatus, chiefComplaintText])

  useEffect(() => {
    return () => {
      if (complaintDebounceRef.current) {
        clearTimeout(complaintDebounceRef.current)
      }
    }
  }, [])

  const handleSaveComplaint = async (textToSave?: string) => {
    if (!patient) return
    if (complaintDebounceRef.current) {
      clearTimeout(complaintDebounceRef.current)
      complaintDebounceRef.current = null
    }
    const content = textToSave !== undefined ? textToSave : chiefComplaintText
    setIsSavingComplaint(true)
    setComplaintSaveStatus("saving")
    try {
      await saveChiefComplaintMutation({
        patientId: patient.id as any,
        chiefComplaint: content,
      })
      setComplaintSaveStatus("saved")
    } catch (err) {
      console.error("Erro ao salvar queixa principal:", err)
      setComplaintSaveStatus("error")
    } finally {
      setIsSavingComplaint(false)
    }
  }

  const handleComplaintChange = (html: string) => {
    setChiefComplaintText(html)
    setComplaintSaveStatus("unsaved")
    if (complaintDebounceRef.current) clearTimeout(complaintDebounceRef.current)
    complaintDebounceRef.current = setTimeout(() => {
      handleSaveComplaint(html)
    }, 1500)
  }

  const handlePrint = async () => {
    if (activeTab === "complaint") {
      await handleSaveComplaint()
      setPrintTarget("chief-complaint")
    } else {
      setPrintTarget("patient-sheet")
    }
    setTimeout(() => window.print(), 50)
  }

  // Agendamentos filtrados
  const filteredSchedules = useMemo(() => {
    if (attendanceFilter === "all") return patientSchedules
    if (attendanceFilter === "present") {
      return patientSchedules.filter((s) => s.status === "present")
    }
    if (attendanceFilter === "absence") {
      return patientSchedules.filter(
        (s) => s.status === "absence" || s.status === "justified_absence"
      )
    }
    if (attendanceFilter === "replacement") {
      return patientSchedules.filter((s) => s.status === "replacement")
    }
    if (attendanceFilter === "scheduled") {
      return patientSchedules.filter((s) => s.status === "scheduled")
    }
    return patientSchedules
  }, [patientSchedules, attendanceFilter])

  if (!patient) return null

  const cleanPhone = cleanPhoneDigits(patient.phone)
  const whatsappUrl = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(
    `Olá, ${patient.name}! Entramos em contato da Clinica Dr Marcelo.`
  )}`

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden border-border rounded-2xl shadow-2xl">
          {/* Header Superior Estilizado */}
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-border/70 p-5 sm:p-6 pb-4 shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="h-14 w-14 rounded-2xl bg-primary/20 text-primary flex items-center justify-center font-bold text-xl shadow-xs shrink-0">
                  {patient.name.charAt(0).toUpperCase()}
                </div>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <DialogTitle className="text-xl sm:text-2xl font-bold text-foreground">
                      {patient.name}
                    </DialogTitle>
                    <Badge
                      variant={patient.active ? "default" : "outline"}
                      className={`text-xs font-semibold ${
                        patient.active
                          ? "bg-emerald-600/15 text-emerald-600 border-emerald-600/30"
                          : "text-muted-foreground"
                      }`}
                    >
                      {patient.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                    <span className="font-mono">{formatPhoneBR(patient.phone)}</span>
                    {age !== null && (
                      <>
                        <span>•</span>
                        <span className="font-medium text-foreground/80">
                          {age} anos ({formatDateBR(patient.birthDate)})
                        </span>
                      </>
                    )}
                    {patient.createdAt && (
                      <>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1 text-primary font-medium">
                          <Clock className="h-3 w-3" />
                          <span>Cadastrado em: {formatDateTimeBR(patient.createdAt)}</span>
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Botões de Ação Rápida */}
              <div className="flex items-center gap-2 self-end sm:self-center shrink-0 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(whatsappUrl, "_blank")}
                  className="gap-1.5 text-xs h-9 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 border-emerald-600/30 hover:bg-emerald-600/20 shadow-2xs"
                  title="Abrir conversa no WhatsApp"
                >
                  <Phone className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">WhatsApp</span>
                </Button>

                {onNavigateToReports && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onClose()
                      onNavigateToReports(patient.id)
                    }}
                    className="gap-1.5 text-xs h-9 bg-primary/10 text-primary border-primary/30 hover:bg-primary/20 shadow-2xs font-semibold"
                    title="Emitir Laudo ou Declaração para este paciente"
                  >
                    <FileCheck2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Emitir Laudo</span>
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handlePrint}
                  className="gap-1.5 text-xs h-9 shadow-2xs font-medium"
                  title={activeTab === "complaint" ? "Imprimir Queixa Principal em folha timbrada (A4)" : "Imprimir Ficha Completa do Paciente (A4)"}
                >
                  <Printer className="h-3.5 w-3.5 text-primary" />
                  <span className="hidden sm:inline">Imprimir PDF</span>
                </Button>

                {canEditPatient && <Button
                  size="sm"
                  variant="default"
                  onClick={() => {
                    onClose()
                    onEdit(patient)
                  }}
                  className="gap-1.5 text-xs h-9 shadow-2xs"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  <span>Editar</span>
                </Button>}
              </div>
            </div>

            {/* Barra de KPIs Rápidos */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-3 border-t border-border/50">
              {/* Turma Principal */}
              <div className="p-2.5 rounded-xl bg-background/80 border border-border/70 shadow-2xs">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                  <Layers className="h-3.5 w-3.5 text-primary" />
                  <span>Turma Fixa</span>
                </div>
                <div className="text-xs font-bold text-foreground mt-1 truncate">
                  {activeTurmas.length > 0 ? (
                    <span className="text-primary font-semibold">
                      {activeTurmas[0].dayLabels} {activeTurmas[0].startTime}
                    </span>
                  ) : (
                    <span className="text-muted-foreground font-normal">Avulso / Sem turma</span>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                  {activeTurmas.length > 0
                    ? `${activeTurmas[0].title} (${activeTurmas[0].roomName})`
                    : "Individual ou flexível"}
                </div>
              </div>

              {/* Assiduidade */}
              <div className="p-2.5 rounded-xl bg-background/80 border border-border/70 shadow-2xs">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Assiduidade</span>
                </div>
                <div className="text-xs font-bold text-foreground mt-1">
                  <span
                    className={
                      attendanceStats.rate >= 75
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-amber-600"
                    }
                  >
                    {attendanceStats.rate}% de presença
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {attendanceStats.presents} presenças • {attendanceStats.absences} faltas
                </div>
              </div>

              {/* Pacote & Sessões */}
              <div className="p-2.5 rounded-xl bg-background/80 border border-border/70 shadow-2xs">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                  <Shield className="h-3.5 w-3.5 text-primary" />
                  <span>Plano / Pacote</span>
                </div>
                <div className="text-xs font-bold text-foreground mt-1 truncate">
                  {activePackageSummary ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      {activePackageSummary.remaining}/{activePackageSummary.total} livres
                    </span>
                  ) : (
                    <span className="text-muted-foreground font-normal">Sem plano ativo</span>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                  {activePackageSummary
                    ? `Expira em ${formatDateBR(activePackageSummary.expiryDate)}`
                    : "Sessões avulsas"}
                </div>
              </div>

              {/* Dor EVA Atual */}
              <div className="p-2.5 rounded-xl bg-background/80 border border-border/70 shadow-2xs">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                  <HeartPulse className="h-3.5 w-3.5 text-rose-500" />
                  <span>Nível de Dor (EVA)</span>
                </div>
                <div className="text-xs font-bold text-foreground mt-1">
                  {currentPainEva !== null ? (
                    <span
                      className={
                        currentPainEva <= 3
                          ? "text-emerald-600"
                          : currentPainEva <= 6
                          ? "text-amber-500"
                          : "text-rose-600"
                      }
                    >
                      Grau {currentPainEva}/10{" "}
                      <span className="text-[10px] font-normal text-muted-foreground">
                        ({currentPainEva === 0 ? "Sem dor" : currentPainEva <= 3 ? "Leve" : currentPainEva <= 7 ? "Moderada" : "Severa"})
                      </span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground font-normal">Não informada</span>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                  {clinicalRecord?.painLocation || "Sem queixa álgica"}
                </div>
              </div>
            </div>
          </div>

          {/* Abas Navegáveis */}
          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as any)}
            className="flex-1 flex flex-col overflow-hidden min-h-0"
          >
            <div className="px-4 sm:px-6 py-2 border-b border-border bg-muted/20 overflow-x-auto scrollbar-none shrink-0 touch-pan-x">
              <TabsList className="bg-transparent h-9 p-0 flex gap-2 sm:gap-4 border-b-0 w-max shrink-0">
                <TabsTrigger
                  value="overview"
                  className="data-[state=active]:bg-background data-[state=active]:shadow-2xs rounded-lg px-3 py-1.5 text-xs font-medium shrink-0 whitespace-nowrap"
                >
                  <User className="h-3.5 w-3.5 mr-1.5 text-primary" />
                  <span>Visão Geral</span>
                </TabsTrigger>

                <TabsTrigger
                  value="classes"
                  className="data-[state=active]:bg-background data-[state=active]:shadow-2xs rounded-lg px-3 py-1.5 text-xs font-medium shrink-0 whitespace-nowrap"
                >
                  <Layers className="h-3.5 w-3.5 mr-1.5 text-primary" />
                  <span>Turmas & Presenças</span>
                  {activeTurmas.length > 0 && (
                    <Badge variant="secondary" className="ml-1.5 text-[9px] px-1 py-0 h-4">
                      {activeTurmas.length}
                    </Badge>
                  )}
                </TabsTrigger>

                <TabsTrigger
                  value="complaint"
                  className="data-[state=active]:bg-background data-[state=active]:shadow-2xs rounded-lg px-3 py-1.5 text-xs font-medium shrink-0 whitespace-nowrap"
                >
                  <FileText className="h-3.5 w-3.5 mr-1.5 text-primary" />
                  <span>Queixa principal</span>
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Conteúdo com Scroll Suave */}
            <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 space-y-6">
              {/* ========================================================= */}
              {/* ABA 1: VISÃO GERAL & DADOS CADASTRAIS                     */}
              {/* ========================================================= */}
              <TabsContent value="overview" className="m-0 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Dados Pessoais & Contato */}
                  <Card className="border-border shadow-xs">
                    <CardHeader className="p-4 pb-3 border-b border-border/60">
                      <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-primary" />
                        <span>Identificação & Contatos</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3 text-xs">
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Nome do Paciente</span>
                        <span className="font-semibold text-foreground text-sm">{patient.name}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/50">
                        <div>
                          <span className="text-muted-foreground block text-[11px]">Telefone / WhatsApp</span>
                          <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-primary hover:underline flex items-center gap-1.5 mt-0.5"
                          >
                            <Phone className="h-3 w-3 text-emerald-600" />
                            <span>{formatPhoneBR(patient.phone)}</span>
                          </a>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[11px]">Data de Nascimento</span>
                          <span className="text-foreground font-medium">
                            {formatDateBR(patient.birthDate)} {age !== null && `(${age} anos)`}
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-border/50">
                        <span className="text-muted-foreground block text-[11px]">Data e Hora do Cadastro</span>
                        <span className="text-foreground font-semibold flex items-center gap-1.5 mt-0.5">
                          <Clock className="h-3.5 w-3.5 text-primary" />
                          <span>{formatDateTimeBR(patient.createdAt)}</span>
                        </span>
                      </div>

                      {(patient.address || patient.cep) && (
                        <div className="pt-2 border-t border-border/50">
                          <span className="text-muted-foreground block text-[11px]">Endereço Residencial</span>
                          <span className="text-foreground font-medium flex items-start gap-1.5 mt-0.5">
                            <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                            <span>
                              {patient.address || "Endereço não cadastrado"}
                              {patient.cep && (
                                <span className="block text-[11px] font-normal text-muted-foreground mt-0.5">
                                  CEP: {formatCep(patient.cep)}
                                </span>
                              )}
                            </span>
                          </span>
                        </div>
                      )}

                      {patient.customFields && patient.customFields.length > 0 && (
                        <div className="pt-2 border-t border-border/50">
                          <span className="text-muted-foreground block text-[11px] font-semibold uppercase tracking-wider mb-1.5">
                            Campos Livres
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {patient.customFields.map((cf, idx) => (
                              <div key={idx} className="rounded-lg bg-muted/20 border border-border/50 p-2">
                                <span className="text-muted-foreground block text-[11px] font-medium">{cf.label}</span>
                                <span className="text-foreground font-semibold text-xs mt-0.5 block break-words">
                                  {cf.type === "date" ? formatDateBR(cf.value) : cf.value}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Convênio & Observações */}
                  <Card className="border-border shadow-xs">
                    <CardHeader className="p-4 pb-3 border-b border-border/60">
                      <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <Shield className="h-3.5 w-3.5 text-indigo-500" />
                        <span>Convênio & Observações</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3 text-xs">
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Modalidade / Convênio</span>
                        <div className="mt-1">
                          <Badge variant="outline" className="font-semibold text-foreground">
                            {patient.healthInsurance || "Particular"}
                          </Badge>
                        </div>
                      </div>

                      {(patient.emergencyContact || patient.emergencyPhone) && (
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/50">
                          <div>
                            <span className="text-muted-foreground block text-[11px]">Contato de Emergência</span>
                            <span className="text-foreground font-medium block">
                              {patient.emergencyContact || "Não informado"}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-[11px]">Telefone de Emergência</span>
                            <span className="text-foreground font-mono font-medium block">
                              {patient.emergencyPhone ? formatPhoneBR(patient.emergencyPhone) : "—"}
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="pt-2 border-t border-border/50">
                        <span className="text-muted-foreground block text-[11px]">Observações Cadastrais</span>
                        <p className="text-xs text-foreground/90 bg-muted/30 p-2.5 rounded-xl border border-border/50 mt-1 whitespace-pre-wrap min-h-[60px]">
                          {patient.notes || "Nenhuma observação interna cadastrada para este paciente."}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-border/50 text-[11px] text-muted-foreground flex items-center justify-between">
                        <span>Data e hora do cadastro:</span>
                        <span className="font-semibold text-foreground">
                          {formatDateTimeBR(patient.createdAt)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Próximas Sessões Marcadas & Visão dos Horários */}
                <Card className="border-border shadow-xs">
                  <CardHeader className="p-4 pb-3 border-b border-border/60 flex flex-row items-center justify-between">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <CalendarDays className="h-3.5 w-3.5 text-primary" />
                      <span>Próximas Sessões Marcadas ({upcomingSchedules.length})</span>
                    </CardTitle>
                    {upcomingSchedules.length > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setActiveTab("classes")
                          setAttendanceFilter("scheduled")
                        }}
                        className="h-6 text-[11px] text-primary hover:text-primary/80 gap-1 px-2"
                      >
                        <span>Ver todas na aba Turmas</span>
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent className="p-4 space-y-2.5">
                    {upcomingSchedules.length === 0 ? (
                      <div className="py-6 text-center text-muted-foreground">
                        <Calendar className="h-7 w-7 mx-auto mb-1.5 opacity-40 text-muted-foreground" />
                        <p className="text-xs font-medium text-foreground">Nenhuma sessão futura agendada</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Para marcar novas sessões, acesse a Agenda ou o Agendamento Rápido.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {upcomingSchedules.slice(0, 6).map((sched, idx) => {
                          const [y, m, d] = sched.date.split('-').map(Number)
                          const dateObj = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
                          const dayName = SHORT_DAY_NAMES[dateObj.getUTCDay()]
                          const formattedDate = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`

                          return (
                            <div
                              key={idx}
                              className="p-3 rounded-xl border border-border/70 bg-card hover:border-primary/40 transition-colors space-y-1 text-xs relative overflow-hidden shadow-2xs"
                            >
                              <div
                                className="absolute top-0 left-0 bottom-0 w-1"
                                style={{ backgroundColor: sched.roomColor || 'var(--primary)' }}
                              />
                              <div className="pl-1.5">
                                <div className="flex items-center justify-between gap-1 font-semibold text-foreground">
                                  <span className="flex items-center gap-1.5">
                                    <Clock className="h-3 w-3 text-primary" />
                                    <span>{dayName}, {formattedDate}</span>
                                  </span>
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-primary/5 text-primary border-primary/20">
                                    {sched.startTime}
                                  </Badge>
                                </div>
                                <div className="text-[11px] font-medium text-foreground/90 mt-1 truncate">
                                  {sched.title}
                                </div>
                                <div className="text-[10px] text-muted-foreground truncate flex items-center justify-between mt-1 pt-1 border-t border-border/40">
                                  <span>{sched.professionalName}</span>
                                  <span>{sched.roomName}</span>
                                </div>
                                <div className="pt-2 mt-1 border-t border-border/40 flex justify-end">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      setCancelTarget({
                                        scheduleId: sched.scheduleId,
                                        participantId: sched.participantId,
                                        title: sched.title,
                                        date: sched.date,
                                        startTime: sched.startTime,
                                        endTime: sched.endTime,
                                        roomName: sched.roomName,
                                        professionalName: sched.professionalName,
                                      })
                                    }
                                    className="h-6 px-2 text-[10px] font-semibold text-destructive hover:bg-destructive/10 border-destructive/30 hover:border-destructive/50 gap-1 w-full justify-center"
                                    title="Desmarcar atendimento e liberar vaga"
                                  >
                                    <CalendarX className="h-3 w-3" />
                                    <span>Desmarcar</span>
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {upcomingSchedules.length > 6 && (
                      <div className="text-center pt-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setActiveTab("classes")
                            setAttendanceFilter("scheduled")
                          }}
                          className="text-[11px] h-7 gap-1"
                        >
                          <span>+ {upcomingSchedules.length - 6} sessões agendadas. Ver lista completa</span>
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Acesso ao Portal & Redefinição de Senha (Última opção da ficha) */}
                {canEditPatient && (
                  <PortalAccessSettings key={patient.id} patientId={patient.id as any} />
                )}
              </TabsContent>

              {/* ========================================================= */}
              {/* ABA 2: TURMAS & HISTÓRICO DE PRESENÇAS                    */}
              {/* ========================================================= */}
              <TabsContent value="classes" className="m-0 space-y-6">
                {/* Turmas Fixas Matriculadas */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Layers className="h-4 w-4 text-primary" />
                      <span>Turmas Fixas Matriculadas</span>
                    </h3>
                    <Badge variant="outline" className="text-xs">
                      {activeTurmas.length} turma(s) encontrada(s)
                    </Badge>
                  </div>

                  {activeTurmas.length === 0 ? (
                    <Card className="p-6 text-center border-dashed border-border bg-muted/10">
                      <Calendar className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-foreground">
                        Nenhuma turma fixa recorrente identificada
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 max-w-sm mx-auto">
                        O paciente participa de sessões individuais, agendamentos pontuais ou ainda não foi enturmado.
                      </p>
                    </Card>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {activeTurmas.map((turma, idx) => (
                        <Card
                          key={idx}
                          className="border-border shadow-xs hover:border-primary/40 transition-colors p-4 relative overflow-hidden"
                        >
                          <div
                            className="absolute top-0 left-0 bottom-0 w-1.5"
                            style={{ backgroundColor: turma.roomColor || "var(--primary)" }}
                          />
                          <div className="pl-2 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h4 className="font-bold text-sm text-foreground">
                                  {turma.title}
                                </h4>
                                <span className="text-xs text-primary font-semibold flex items-center gap-1.5 mt-0.5">
                                  <Clock className="h-3 w-3" />
                                  <span>{turma.dayLabels} • {turma.startTime} às {turma.endTime}</span>
                                </span>
                              </div>
                              <Badge
                                variant={turma.isCurrentlyActive ? "default" : "outline"}
                                className={`text-[10px] ${
                                  turma.isCurrentlyActive
                                    ? "bg-emerald-600/15 text-emerald-600 border-emerald-600/30"
                                    : "text-muted-foreground"
                                }`}
                              >
                                {turma.isCurrentlyActive ? "Ativa" : "Histórico"}
                              </Badge>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-2 border-t border-border/50">
                              <div>
                                <span className="block text-[10px]">Sala de Aula</span>
                                <span className="font-medium text-foreground flex items-center gap-1">
                                  <Building className="h-3 w-3 text-muted-foreground" />
                                  <span>{turma.roomName}</span>
                                </span>
                              </div>
                              <div>
                                <span className="block text-[10px]">Fisioterapeuta</span>
                                <span className="font-medium text-foreground">
                                  {turma.professionalName}
                                </span>
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>

                {/* Créditos de Reposição */}
                {patientCredits.length > 0 && (
                  <div className="space-y-2.5">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Clock className="h-4 w-4 text-amber-500" />
                      <span>Créditos de Reposição Disponíveis</span>
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {patientCredits.map((credit) => (
                        <Card key={credit.id} className="p-3 border-border shadow-2xs">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-foreground">
                              {credit.originSpecialty || "Reposição"}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-[9px] ${
                                credit.status === "available"
                                  ? "bg-emerald-600/10 text-emerald-600 border-emerald-600/30"
                                  : credit.status === "used"
                                  ? "text-muted-foreground"
                                  : "text-destructive border-destructive/30"
                              }`}
                            >
                              {credit.status === "available"
                                ? "Disponível"
                                : credit.status === "used"
                                ? "Utilizado"
                                : "Expirado"}
                            </Badge>
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-1.5 space-y-0.5">
                            <div>Origem: {formatDateBR(credit.originDate)}</div>
                            <div>
                              Validade: <strong>{formatDateBR(credit.expiryDate)}</strong>
                              {credit.daysLeft !== undefined && credit.status === "available" && (
                                <span className="text-amber-600 ml-1">
                                  ({credit.daysLeft} dias restantes)
                                </span>
                              )}
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Histórico Completo de Aulas */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-primary" />
                      <span>Histórico de Atendimentos & Aulas</span>
                    </h3>

                    {/* Filtros de Frequência */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Button
                        size="sm"
                        variant={attendanceFilter === "all" ? "default" : "outline"}
                        onClick={() => setAttendanceFilter("all")}
                        className="text-[11px] h-7 px-2.5"
                      >
                        Todas ({attendanceStats.total})
                      </Button>
                      <Button
                        size="sm"
                        variant={attendanceFilter === "present" ? "default" : "outline"}
                        onClick={() => setAttendanceFilter("present")}
                        className="text-[11px] h-7 px-2.5 text-emerald-600 hover:text-emerald-700"
                      >
                        Presenças ({attendanceStats.presents})
                      </Button>
                      <Button
                        size="sm"
                        variant={attendanceFilter === "absence" ? "default" : "outline"}
                        onClick={() => setAttendanceFilter("absence")}
                        className="text-[11px] h-7 px-2.5 text-destructive hover:text-destructive"
                      >
                        Faltas ({attendanceStats.absences + attendanceStats.justified})
                      </Button>
                      <Button
                        size="sm"
                        variant={attendanceFilter === "replacement" ? "default" : "outline"}
                        onClick={() => setAttendanceFilter("replacement")}
                        className="text-[11px] h-7 px-2.5 text-indigo-500 hover:text-indigo-600"
                      >
                        Reposições ({attendanceStats.replacements})
                      </Button>
                      <Button
                        size="sm"
                        variant={attendanceFilter === "scheduled" ? "default" : "outline"}
                        onClick={() => setAttendanceFilter("scheduled")}
                        className="text-[11px] h-7 px-2.5 text-muted-foreground hover:text-foreground"
                      >
                        Agendadas ({attendanceStats.scheduled})
                      </Button>
                    </div>
                  </div>

                  {filteredSchedules.length === 0 ? (
                    <Card className="p-8 text-center border-dashed border-border bg-muted/10">
                      <Calendar className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-foreground">
                        Nenhum atendimento registrado com este filtro
                      </p>
                    </Card>
                  ) : (
                    <div className="border border-border rounded-xl overflow-hidden shadow-xs">
                      <div className="max-h-[320px] overflow-y-auto overflow-x-auto touch-pan-x">
                        <table className="w-full min-w-[560px] text-xs text-left">
                          <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold uppercase text-[10px] sticky top-0">
                            <tr>
                              <th className="p-2.5 pl-3.5">Data & Horário</th>
                              <th className="p-2.5">Turma / Modalidade</th>
                              <th className="p-2.5">Profissional & Sala</th>
                              <th className="p-2.5">Status de Presença</th>
                              <th className="p-2.5 text-right pr-3.5">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {filteredSchedules.map((item, idx) => (
                              <tr key={idx} className="hover:bg-muted/20 transition-colors">
                                <td className="p-2.5 pl-3.5 font-medium text-foreground whitespace-nowrap">
                                  <div>{formatDateBR(item.date)}</div>
                                  <div className="text-[10px] text-muted-foreground">
                                    {item.startTime} às {item.endTime}
                                  </div>
                                </td>
                                <td className="p-2.5">
                                  <span className="font-semibold text-foreground">
                                    {item.title}
                                  </span>
                                  <div className="text-[10px] text-muted-foreground">
                                    {item.type === "turma" ? "Aula em Grupo" : "Individual"} • {item.specialty}
                                  </div>
                                </td>
                                <td className="p-2.5 text-muted-foreground">
                                  <div className="text-foreground font-medium">
                                    {item.professionalName}
                                  </div>
                                  <div className="text-[10px]">{item.roomName}</div>
                                </td>
                                <td className="p-2.5 whitespace-nowrap">
                                  {item.status === "present" && (
                                    <Badge className="bg-emerald-600/15 text-emerald-600 border-emerald-600/30 text-[10px] gap-1">
                                      <CheckCircle2 className="h-3 w-3" />
                                      <span>Presente</span>
                                    </Badge>
                                  )}
                                  {item.status === "absence" && (
                                    <Badge className="bg-destructive/15 text-destructive border-destructive/30 text-[10px] gap-1">
                                      <XCircle className="h-3 w-3" />
                                      <span>Falta</span>
                                    </Badge>
                                  )}
                                  {item.status === "justified_absence" && (
                                    <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 text-[10px] gap-1">
                                      <AlertCircle className="h-3 w-3" />
                                      <span>Falta Justificada</span>
                                    </Badge>
                                  )}
                                  {item.status === "replacement" && (
                                    <Badge className="bg-indigo-500/15 text-indigo-500 border-indigo-500/30 text-[10px] gap-1">
                                      <Clock className="h-3 w-3" />
                                      <span>Reposição</span>
                                    </Badge>
                                  )}
                                  {item.status === "scheduled" && (
                                    <Badge variant="outline" className="text-muted-foreground text-[10px]">
                                      Agendado
                                    </Badge>
                                  )}
                                </td>
                                <td className="p-2.5 text-right pr-3.5 whitespace-nowrap">
                                  {(item.status === "scheduled" || item.status === "replacement") ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        setCancelTarget({
                                          scheduleId: item.scheduleId,
                                          participantId: item.participantId,
                                          title: item.title,
                                          date: item.date,
                                          startTime: item.startTime,
                                          endTime: item.endTime,
                                          roomName: item.roomName,
                                          professionalName: item.professionalName,
                                        })
                                      }
                                      className="h-6 px-2 text-[11px] font-semibold text-destructive hover:bg-destructive/10 border-destructive/30 hover:border-destructive/50 gap-1"
                                      title="Desmarcar horário e liberar vaga"
                                    >
                                      <CalendarX className="h-3 w-3" />
                                      <span>Desmarcar</span>
                                    </Button>
                                  ) : (
                                    <span className="text-[10px] text-muted-foreground">—</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* ========================================================= */}
              {/* ABA 3: QUEIXA PRINCIPAL COM EDITOR RICO & EMISSÃO PDF     */}
              {/* ========================================================= */}
              <TabsContent value="complaint" className="m-0 space-y-4">
                {/* Barra de Ações Rápidas, Status e Emissão */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-muted/30 rounded-xl border border-border/70 shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground">Queixa Principal & Registro Clínico</h4>
                      <p className="text-[11px] text-muted-foreground">
                        Texto 100% livre com editor rico, sincronização instantânea e emissão timbrada.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center flex-wrap">
                    {/* Indicador de Status do Salvamento */}
                    <div className="text-[11px] font-medium mr-1 flex items-center gap-1.5">
                      {complaintSaveStatus === "saving" ? (
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin text-primary" />
                          <span>Salvando...</span>
                        </span>
                      ) : complaintSaveStatus === "saved" ? (
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Salvo</span>
                        </span>
                      ) : complaintSaveStatus === "unsaved" ? (
                        <span className="text-amber-500 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>Alterações pendentes</span>
                        </span>
                      ) : (
                        <span className="text-rose-500 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          <span>Erro ao salvar</span>
                        </span>
                      )}
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleSaveComplaint()}
                      disabled={isSavingComplaint}
                      className="h-8 text-xs gap-1.5 shadow-2xs font-medium"
                      title="Salvar alterações no prontuário agora"
                    >
                      <Save className="h-3.5 w-3.5 text-primary" />
                      <span>Salvar Queixa</span>
                    </Button>
                  </div>
                </div>

                {/* Editor Rico Interativo */}
                <RichTextEditor
                  value={chiefComplaintText}
                  onChange={handleComplaintChange}
                  placeholder="Descreva a queixa principal do paciente, histórico clínico, queixas álgicas, metas ou conduta terapêutica..."
                  minHeight="380px"
                />
              </TabsContent>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Modal de Zoom de Foto Postural */}
      {selectedPhotoZoom && (
        <Dialog open={!!selectedPhotoZoom} onOpenChange={() => setSelectedPhotoZoom(null)}>
          <DialogContent className="sm:max-w-2xl p-2 bg-background border-border">
            <DialogHeader className="p-3 pb-1">
              <DialogTitle className="text-base font-bold text-foreground">
                {selectedPhotoZoom.title} — {patient.name}
              </DialogTitle>
            </DialogHeader>

            <div className="max-h-[75vh] overflow-hidden rounded-xl bg-black/10 flex items-center justify-center p-1">
              <img
                src={selectedPhotoZoom.url}
                alt={selectedPhotoZoom.title}
                className="max-h-[72vh] w-auto object-contain rounded-lg"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal de Confirmação para Desmarcar Atendimento */}
      <Dialog open={!!cancelTarget} onOpenChange={(open) => !open && !isCancelling && setCancelTarget(null)}>
        <DialogContent className="sm:max-w-md">
          {cancelTarget && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-foreground">
                  <div className="p-2 rounded-xl bg-destructive/10 text-destructive">
                    <CalendarX className="h-5 w-5" />
                  </div>
                  <span>Desmarcar Atendimento</span>
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Confirme a desmarcação para liberar a vaga imediatamente na clínica.
                </DialogDescription>
              </DialogHeader>

              <div className="p-3.5 rounded-xl bg-muted/40 border border-border/70 space-y-2 text-xs">
                <div className="flex items-center justify-between font-semibold text-foreground">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                    <span>{formatDateBR(cancelTarget.date)}</span>
                  </span>
                  <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-xs">
                    {cancelTarget.startTime} às {cancelTarget.endTime}
                  </Badge>
                </div>

                <div className="pt-1 text-[11px] text-muted-foreground space-y-0.5">
                  <div>
                    <strong className="text-foreground">{cancelTarget.title}</strong>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>{cancelTarget.professionalName}</span>
                    <span>•</span>
                    <span>{cancelTarget.roomName}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  Ao desmarcar, os lembretes automáticos do WhatsApp serão cancelados e a vaga ficará livre para outros pacientes.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isCancelling}
                  onClick={() => setCancelTarget(null)}
                  className="h-8 text-xs px-3"
                >
                  Voltar
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={isCancelling}
                  onClick={handleConfirmCancel}
                  className="h-8 text-xs px-3 font-semibold gap-1.5"
                >
                  {isCancelling ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Desmarcando...</span>
                    </>
                  ) : (
                    <>
                      <CalendarX className="h-3.5 w-3.5" />
                      <span>Sim, Desmarcar</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Toast Flutuante de Feedback */}
      {feedbackToast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-xs font-medium animate-fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{feedbackToast.message}</span>
        </div>
      )}

      {/* Documento Oculto para Impressão Nativa da Ficha Cadastral A4 */}
      <div
        id="printable-patient-sheet"
        className={`${
          printTarget === "patient-sheet" ? "hidden print:block" : "hidden"
        } font-sans text-black p-6`}
      >
        <div className="border-b-2 border-primary/40 pb-4 mb-5 flex items-center justify-between">
          <div className="flex items-center">
            {clinicLogoUrl ? (
              <img
                src={clinicLogoUrl}
                alt={clinicDisplayName}
                crossOrigin="anonymous"
                className="h-16 max-h-20 w-auto object-contain"
              />
            ) : (
              <div>
                <h1 className="text-xl font-bold uppercase tracking-wide text-black">
                  {clinicDisplayName}
                </h1>
                <p className="text-xs text-gray-600 mt-0.5">
                  {clinicSubtitle}
                </p>
              </div>
            )}
          </div>
          <div className="text-right text-xs text-gray-600">
            <div className="font-semibold text-gray-900">Ficha Clínica Cadastral</div>
            <div className="mt-0.5">Data de Emissão: {formatDateBR(getTodayDateString())}</div>
          </div>
        </div>

        {/* Dados Cadastrais */}
        <div className="mb-4">
          <h2 className="text-sm font-bold uppercase border-b border-gray-400 pb-1 mb-2">
            1. Identificação do Paciente
          </h2>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><strong>Nome:</strong> {patient.name}</div>
            <div><strong>Telefone:</strong> {formatPhoneBR(patient.phone)}</div>
            <div><strong>Nascimento:</strong> {formatDateBR(patient.birthDate)} ({age} anos)</div>
            <div><strong>Convênio / Modalidade:</strong> {patient.healthInsurance || "Particular"}</div>
            <div className="col-span-2"><strong>Data e Hora do Cadastro:</strong> {formatDateTimeBR(patient.createdAt)}</div>
            {(patient.emergencyContact || patient.emergencyPhone) && (
              <div><strong>Contato Emergência:</strong> {patient.emergencyContact || "—"} ({patient.emergencyPhone ? formatPhoneBR(patient.emergencyPhone) : "—"})</div>
            )}
            {patient.cep && <div><strong>CEP:</strong> {formatCep(patient.cep)}</div>}
            {patient.address && <div className="col-span-2"><strong>Endereço:</strong> {patient.address}</div>}
            {patient.customFields && patient.customFields.length > 0 && patient.customFields.map((cf, idx) => (
              <div key={idx}><strong>{cf.label}:</strong> {cf.type === 'date' ? formatDateBR(cf.value) : cf.value}</div>
            ))}
          </div>
        </div>

        {/* Turmas e Frequência */}
        <div className="mb-4">
          <h2 className="text-sm font-bold uppercase border-b border-gray-400 pb-1 mb-2">
            2. Turmas Regulares & Assiduidade
          </h2>
          <div className="text-xs space-y-1">
            <div>
              <strong>Turma(s) Ativa(s):</strong>{" "}
              {activeTurmas.length > 0
                ? activeTurmas.map((t) => `${t.title} (${t.dayLabels} ${t.startTime})`).join("; ")
                : "Sem turma fixa recorrente"}
            </div>
            <div>
              <strong>Taxa de Assiduidade:</strong> {attendanceStats.rate}% ({attendanceStats.presents} presenças, {attendanceStats.absences} faltas em {attendanceStats.total} aulas)
            </div>
            {activePackageSummary && (
              <div>
                <strong>Saldo de Plano:</strong> {activePackageSummary.primaryName} — {activePackageSummary.remaining} de {activePackageSummary.total} sessões restantes (Validade: {formatDateBR(activePackageSummary.expiryDate)})
              </div>
            )}
          </div>
        </div>

        {/* Resumo Clínico */}
        {clinicalRecord && (
          <div className="mb-6">
            <h2 className="text-sm font-bold uppercase border-b border-gray-400 pb-1 mb-2">
              3. Resumo Clínico & Metas Terapêuticas
            </h2>
            <div className="text-xs space-y-2">
              <div>
                <strong>Queixa Principal:</strong>
                <div
                  className="mt-1 text-gray-800 [&_p]:mb-1 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4"
                  dangerouslySetInnerHTML={{
                    __html:
                      chiefComplaintText ||
                      clinicalRecord.chiefComplaint ||
                      "Não informada",
                  }}
                />
              </div>
              <div><strong>Escala EVA de Dor Atual:</strong> {currentPainEva !== null ? `${currentPainEva}/10` : "Não informada"} ({clinicalRecord.painLocation || "Sem localização"})</div>
              <div><strong>História da Moléstia Atual:</strong> {clinicalRecord.hpi}</div>
              <div><strong>Metas Terapêuticas:</strong> {clinicalRecord.clinicalGoals}</div>
              {clinicalRecord.medications && <div><strong>Medicações:</strong> {clinicalRecord.medications}</div>}
            </div>
          </div>
        )}

        {/* Rodapé Institucional da Clínica */}
        <div className="mt-8 pt-4 border-t border-gray-300 text-center text-xs text-gray-600 space-y-1 print:text-[11px]">
          <p className="font-medium text-gray-800">{clinicAddress}</p>
          <div className="flex items-center justify-center gap-3 text-gray-600 flex-wrap">
            <span>Tel / WhatsApp: {clinicPhone}</span>
            <span>•</span>
            <span>
              Site:{" "}
              <span className="font-semibold text-gray-900">
                {clinicWebsite}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Documento Timbrado Oficial para Impressão e Geração de PDF da Queixa Principal */}
      <div
        id="printable-chief-complaint"
        style={{ width: "794px" }}
        className={`${
          printTarget === "chief-complaint" ? "print:block" : "print:hidden"
        } fixed -left-[99999px] top-0 bg-white text-black p-10 font-sans z-[-100] print:static print:left-auto print:p-8 print:w-full`}
      >
        {/* Cabeçalho Oficial Timbrado da Clínica */}
        <div className="border-b-2 border-primary/40 pb-4 mb-5 flex items-center justify-between">
          <div className="flex items-center">
            {clinicLogoUrl ? (
              <img
                src={clinicLogoUrl}
                alt={clinicDisplayName}
                crossOrigin="anonymous"
                className="h-16 max-h-20 w-auto object-contain"
              />
            ) : (
              <div>
                <h1 className="text-xl font-bold uppercase tracking-wide text-black">
                  {clinicDisplayName}
                </h1>
                <p className="text-xs text-gray-600 mt-0.5">
                  {clinicSubtitle}
                </p>
              </div>
            )}
          </div>

          <div className="text-right text-xs text-gray-600">
            <div className="font-semibold text-gray-900">Registro Clínico Timbrado</div>
            <div className="mt-0.5">Data de Emissão: {formatDateBR(getTodayDateString())}</div>
          </div>
        </div>

        {/* Box de Identificação do Paciente */}
        <div className="bg-gray-50 border border-gray-300 rounded-lg p-3.5 mb-5 text-xs">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            <div>
              <span className="text-gray-500 font-semibold text-[10px] block uppercase">Paciente</span>
              <span className="font-bold text-sm text-black">{patient.name}</span>
            </div>
            <div>
              <span className="text-gray-500 font-semibold text-[10px] block uppercase">Telefone / WhatsApp</span>
              <span className="font-medium text-black">{formatPhoneBR(patient.phone)}</span>
            </div>
            <div>
              <span className="text-gray-500 font-semibold text-[10px] block uppercase">Nascimento / Idade</span>
              <span className="font-medium text-black">
                {formatDateBR(patient.birthDate)} {age !== null && `(${age} anos)`}
              </span>
            </div>
            <div>
              <span className="text-gray-500 font-semibold text-[10px] block uppercase">Convênio / Modalidade</span>
              <span className="font-medium text-black">{patient.healthInsurance || "Particular"}</span>
            </div>
          </div>
        </div>

        {/* Título Central da Seção */}
        <div className="text-center my-4">
          <h2 className="text-base font-extrabold uppercase tracking-wide border-b border-gray-400 pb-1.5 inline-block px-8">
            Queixa Principal & Avaliação Clínica
          </h2>
        </div>

        {/* Conteúdo Rico Formatado da Queixa Principal */}
        <div
          className="text-xs leading-relaxed text-gray-900 my-6 min-h-[220px]
            [&_h1]:text-lg [&_h1]:font-bold [&_h1]:mb-2 [&_h1]:mt-3
            [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mb-2 [&_h2]:mt-2.5
            [&_p]:mb-2.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3
            [&_li]:mb-1 [&_strong]:font-bold [&_em]:italic [&_u]:underline
            [&_hr]:my-3 [&_hr]:border-gray-300"
          dangerouslySetInnerHTML={{
            __html:
              chiefComplaintText ||
              "<p class='italic text-gray-500'>Nenhuma queixa principal registrada para este paciente.</p>",
          }}
        />

        {/* Rodapé Oficial da Clínica */}
        <div className="mt-10 pt-4 border-t border-gray-300 text-center text-xs text-gray-600 space-y-1 print:text-[11px]">
          <p className="font-medium text-gray-800">{clinicAddress}</p>
          <div className="flex items-center justify-center gap-3 text-gray-600 flex-wrap">
            <span>Tel / WhatsApp: {clinicPhone}</span>
            <span>•</span>
            <span>
              Site:{" "}
              <span className="font-semibold text-gray-900">
                {clinicWebsite}
              </span>
            </span>
          </div>
        </div>
      </div>
    </>
  )
}
