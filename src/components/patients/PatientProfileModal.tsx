import React, { useState, useMemo } from "react"
import { useClinicData } from "@/contexts/ClinicDataContext"
import type { Patient, AttendanceStatus, Specialty } from "@/types"
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
import { formatDateBR, getTodayDateString } from "@/lib/dateUtils"
import { formatPhoneBR, cleanPhoneDigits } from "@/lib/utils"
import {
  User,
  Phone,
  Mail,
  Calendar,
  MapPin,
  HeartPulse,
  Shield,
  FileText,
  DollarSign,
  Layers,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Printer,
  ExternalLink,
  Edit2,
  ArrowRight,
  Sparkles,
  Activity,
  Award,
  CalendarDays,
  ShieldAlert,
  ChevronRight,
  TrendingUp,
  Image as ImageIcon,
  CheckCheck,
  Building,
} from "lucide-react"

interface PatientProfileModalProps {
  patient: Patient | null
  isOpen: boolean
  onClose: () => void
  onEdit: (patient: Patient) => void
  onNavigateToClinical?: (patientId: string) => void
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
}) => {
  const {
    schedules,
    patientPackages,
    packages,
    replacementCredits,
    transactions,
    clinicalReports,
    getClinicalRecord,
    getEvolutions,
  } = useClinicData()

  const [activeTab, setActiveTab] = useState<
    "overview" | "classes" | "clinical" | "financial" | "reports"
  >("overview")
  const [attendanceFilter, setAttendanceFilter] = useState<
    "all" | "present" | "absence" | "replacement" | "scheduled"
  >("all")
  const [selectedPhotoZoom, setSelectedPhotoZoom] = useState<{
    url: string
    title: string
  } | null>(null)

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

  // Agendamentos e Presenças do Paciente
  const patientSchedules = useMemo(() => {
    if (!patient) return []
    return schedules
      .filter((s) => s.participants.some((p) => p.patientId === patient.id))
      .map((s) => {
        const participant = s.participants.find((p) => p.patientId === patient.id)!
        return {
          scheduleId: s.id,
          title: s.title,
          type: s.type,
          specialty: s.specialty,
          date: s.date,
          startTime: s.startTime,
          endTime: s.endTime,
          roomName: s.roomName,
          roomColor: s.roomColor,
          professionalName: s.professionalName,
          recurringGroupId: s.recurringGroupId,
          status: participant.status,
          checkedInAt: participant.checkedInAt,
          notes: participant.notes,
        }
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime))
  }, [schedules, patient])

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

  // Identificação de Turmas Fixas / Regulares
  const activeTurmas = useMemo(() => {
    if (!patient) return []
    const today = getTodayDateString()

    // Filtra agendamentos do tipo "turma"
    const turmaSchedules = patientSchedules.filter((s) => s.type === "turma")

    // Agrupa por assinatura única: título + horário + sala + profissional
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
      const key = `${s.title}|${s.startTime}|${s.endTime}|${s.roomName}`
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
  const clinicalRecord = useMemo(() => {
    if (!patient) return undefined
    return getClinicalRecord(patient.id)
  }, [getClinicalRecord, patient])

  const evolutions = useMemo(() => {
    if (!patient) return []
    return getEvolutions(patient.id)
  }, [getEvolutions, patient])

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

  // Transações Financeiras do Paciente
  const patientTransactions = useMemo(() => {
    if (!patient) return []
    return transactions
      .filter((t) => t.patientId === patient.id)
      .sort((a, b) => b.dueDate.localeCompare(a.dueDate))
  }, [transactions, patient])

  // Documentos & Laudos
  const patientReports = useMemo(() => {
    if (!patient) return []
    return clinicalReports
      .filter((cr) => cr.patientId === patient.id)
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [clinicalReports, patient])

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
    `Olá, ${patient.name}! Entramos em contato da clínica Altar Fisio.`
  )}`

  const handlePrint = () => {
    window.print()
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="w-full sm:max-w-4xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden border-border rounded-2xl shadow-2xl">
          {/* Header Superior Estilizado */}
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-border/70 p-5 sm:p-6 pb-4">
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
                    {clinicalRecord ? (
                      <Badge
                        variant="outline"
                        className="text-[11px] text-indigo-500 border-indigo-500/30 bg-indigo-500/10"
                      >
                        Prontuário Ativo
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[11px] text-muted-foreground">
                        Sem Prontuário
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap font-mono">
                    <span>CPF: {patient.documentCpf}</span>
                    <span>•</span>
                    <span>{formatPhoneBR(patient.phone)}</span>
                    {age !== null && (
                      <>
                        <span>•</span>
                        <span className="font-sans font-medium text-foreground/80">
                          {age} anos ({formatDateBR(patient.birthDate)})
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Botões de Ação Rápida */}
              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
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

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handlePrint}
                  className="gap-1.5 text-xs h-9 shadow-2xs"
                  title="Imprimir Ficha Completa em PDF (A4)"
                >
                  <Printer className="h-3.5 w-3.5 text-primary" />
                  <span className="hidden sm:inline">Imprimir PDF</span>
                </Button>

                <Button
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
                </Button>
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
                  <Award className="h-3.5 w-3.5 text-indigo-500" />
                  <span>Saldo de Pacote</span>
                </div>
                <div className="text-xs font-bold text-foreground mt-1 truncate">
                  {activePackageSummary ? (
                    <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                      {activePackageSummary.remaining} de {activePackageSummary.total} sessões
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
            className="flex-1 flex flex-col overflow-hidden"
          >
            <div className="px-5 sm:px-6 pt-2 border-b border-border bg-muted/20">
              <TabsList className="bg-transparent h-10 p-0 space-x-2 sm:space-x-4 border-b-0">
                <TabsTrigger
                  value="overview"
                  className="data-[state=active]:bg-background data-[state=active]:shadow-2xs rounded-lg px-3 py-1.5 text-xs font-medium"
                >
                  <User className="h-3.5 w-3.5 mr-1.5 text-primary" />
                  <span>Visão Geral</span>
                </TabsTrigger>

                <TabsTrigger
                  value="classes"
                  className="data-[state=active]:bg-background data-[state=active]:shadow-2xs rounded-lg px-3 py-1.5 text-xs font-medium"
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
                  value="clinical"
                  className="data-[state=active]:bg-background data-[state=active]:shadow-2xs rounded-lg px-3 py-1.5 text-xs font-medium"
                >
                  <HeartPulse className="h-3.5 w-3.5 mr-1.5 text-rose-500" />
                  <span>Prontuário & SOAP</span>
                  {evolutions.length > 0 && (
                    <Badge variant="secondary" className="ml-1.5 text-[9px] px-1 py-0 h-4">
                      {evolutions.length}
                    </Badge>
                  )}
                </TabsTrigger>

                <TabsTrigger
                  value="financial"
                  className="data-[state=active]:bg-background data-[state=active]:shadow-2xs rounded-lg px-3 py-1.5 text-xs font-medium"
                >
                  <DollarSign className="h-3.5 w-3.5 mr-1.5 text-emerald-600" />
                  <span>Pacotes & Financeiro</span>
                </TabsTrigger>

                <TabsTrigger
                  value="reports"
                  className="data-[state=active]:bg-background data-[state=active]:shadow-2xs rounded-lg px-3 py-1.5 text-xs font-medium"
                >
                  <FileText className="h-3.5 w-3.5 mr-1.5 text-indigo-500" />
                  <span>Laudos & Documentos</span>
                  {patientReports.length > 0 && (
                    <Badge variant="secondary" className="ml-1.5 text-[9px] px-1 py-0 h-4">
                      {patientReports.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Conteúdo com Scroll Suave */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
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
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-muted-foreground block text-[11px]">Nome Completo</span>
                          <span className="font-semibold text-foreground text-sm">{patient.name}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[11px]">CPF</span>
                          <span className="font-mono font-medium text-foreground">{patient.documentCpf}</span>
                        </div>
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
                          <span className="text-muted-foreground block text-[11px]">E-mail</span>
                          <span className="text-foreground truncate block font-medium">
                            {patient.email || "Não informado"}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/50">
                        <div>
                          <span className="text-muted-foreground block text-[11px]">Data de Nascimento</span>
                          <span className="text-foreground font-medium">
                            {formatDateBR(patient.birthDate)} {age !== null && `(${age} anos)`}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[11px]">Gênero</span>
                          <span className="text-foreground font-medium">
                            {patient.gender || "Não informado"}
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-border/50">
                        <span className="text-muted-foreground block text-[11px]">Endereço Residencial</span>
                        <span className="text-foreground font-medium flex items-start gap-1.5 mt-0.5">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                          <span>{patient.address || "Endereço não cadastrado"}</span>
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Convênio, Emergência & Observações */}
                  <Card className="border-border shadow-xs">
                    <CardHeader className="p-4 pb-3 border-b border-border/60">
                      <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <Shield className="h-3.5 w-3.5 text-indigo-500" />
                        <span>Convênio, Emergência & Notas</span>
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

                      <div className="pt-2 border-t border-border/50">
                        <span className="text-muted-foreground block text-[11px]">Observações Cadastrais</span>
                        <p className="text-xs text-foreground/90 bg-muted/30 p-2.5 rounded-xl border border-border/50 mt-1 whitespace-pre-wrap min-h-[60px]">
                          {patient.notes || "Nenhuma observação interna cadastrada para este paciente."}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-border/50 text-[11px] text-muted-foreground flex items-center justify-between">
                        <span>Cadastrado em:</span>
                        <span className="font-medium text-foreground">
                          {formatDateBR(patient.createdAt)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
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
                      <div className="max-h-[320px] overflow-y-auto">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold uppercase text-[10px] sticky top-0">
                            <tr>
                              <th className="p-2.5 pl-3.5">Data & Horário</th>
                              <th className="p-2.5">Turma / Modalidade</th>
                              <th className="p-2.5">Profissional & Sala</th>
                              <th className="p-2.5 text-right pr-3.5">Status de Presença</th>
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
                                  <div className="text-[10px] text-muted-foreground capitalize">
                                    {item.type === "turma" ? "Aula em Grupo" : "Individual"} • {item.specialty}
                                  </div>
                                </td>
                                <td className="p-2.5 text-muted-foreground">
                                  <div className="text-foreground font-medium">
                                    {item.professionalName}
                                  </div>
                                  <div className="text-[10px]">{item.roomName}</div>
                                </td>
                                <td className="p-2.5 text-right pr-3.5 whitespace-nowrap">
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
              {/* ABA 3: PRONTUÁRIO CLÍNICO & EVOLUÇÕES SOAP                */}
              {/* ========================================================= */}
              <TabsContent value="clinical" className="m-0 space-y-6">
                {/* Card de Anamnese e Queixa Principal */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <HeartPulse className="h-4 w-4 text-rose-500" />
                      <span>Anamnese & Avaliação Biomecânica</span>
                    </h3>
                    {onNavigateToClinical && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          onClose()
                          onNavigateToClinical(patient.id)
                        }}
                        className="text-xs gap-1.5 h-7 shadow-2xs"
                      >
                        <ExternalLink className="h-3 w-3 text-primary" />
                        <span>Abrir no Módulo de Prontuário</span>
                      </Button>
                    )}
                  </div>

                  {!clinicalRecord ? (
                    <Card className="p-6 text-center border-dashed border-border bg-muted/10">
                      <HeartPulse className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-foreground">
                        Nenhum prontuário registrado para este paciente
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Acesse a aba Prontuários para cadastrar a anamnese inicial e metas terapêuticas.
                      </p>
                    </Card>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Queixa Principal & HMA */}
                      <Card className="border-border shadow-xs">
                        <CardHeader className="p-4 pb-2 border-b border-border/60">
                          <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            Queixa Principal & História da Moléstia
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-3 text-xs">
                          <div>
                            <span className="text-muted-foreground text-[11px] block">Queixa Principal</span>
                            <p className="font-semibold text-foreground mt-0.5 bg-rose-500/5 p-2 rounded-lg border border-rose-500/20 text-sm">
                              {clinicalRecord.chiefComplaint || "Não informada"}
                            </p>
                          </div>

                          <div>
                            <span className="text-muted-foreground text-[11px] block">História da Moléstia Atual (HMA)</span>
                            <p className="text-foreground/90 mt-0.5 whitespace-pre-wrap bg-muted/30 p-2.5 rounded-lg border border-border/50">
                              {clinicalRecord.hpi || "Sem histórico detalhado informado."}
                            </p>
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/50">
                            <div>
                              <span className="text-muted-foreground text-[11px] block">Local da Dor</span>
                              <span className="font-medium text-foreground">
                                {clinicalRecord.painLocation || "Não especificado"}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground text-[11px] block">Escala EVA Inicial</span>
                              <Badge variant="outline" className="font-bold text-rose-600 border-rose-600/30">
                                {clinicalRecord.painScaleEva}/10
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Histórico Pregresso & Metas */}
                      <Card className="border-border shadow-xs">
                        <CardHeader className="p-4 pb-2 border-b border-border/60">
                          <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            Metas, Medicações & Antecedentes
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-3 text-xs">
                          <div>
                            <span className="text-muted-foreground text-[11px] block">Metas Terapêuticas</span>
                            <p className="text-foreground/90 font-medium mt-0.5 bg-emerald-600/5 p-2.5 rounded-lg border border-emerald-600/20">
                              {clinicalRecord.clinicalGoals || "Nenhuma meta definida"}
                            </p>
                          </div>

                          <div>
                            <span className="text-muted-foreground text-[11px] block">Medicações em Uso</span>
                            <p className="text-foreground mt-0.5">
                              {clinicalRecord.medications || "Nenhuma medicação relatada"}
                            </p>
                          </div>

                          <div>
                            <span className="text-muted-foreground text-[11px] block">Histórico Patológico Pregresso</span>
                            <p className="text-foreground mt-0.5">
                              {clinicalRecord.medicalHistory || "Nenhuma comorbidade relatada"}
                            </p>
                          </div>

                          {clinicalRecord.posturalNotes && (
                            <div className="pt-2 border-t border-border/50">
                              <span className="text-muted-foreground text-[11px] block">Notas Posturais</span>
                              <p className="text-foreground/85 text-[11px] mt-0.5">
                                {clinicalRecord.posturalNotes}
                              </p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>

                {/* Fotos Posturais Padronizadas (4 Vistas) */}
                {clinicalRecord &&
                  (clinicalRecord.anteriorPhotoUrl ||
                    clinicalRecord.posteriorPhotoUrl ||
                    clinicalRecord.lateralRightPhotoUrl ||
                    clinicalRecord.lateralLeftPhotoUrl ||
                    clinicalRecord.lateralPhotoUrl) && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <ImageIcon className="h-4 w-4 text-indigo-500" />
                        <span>Avaliação Postural Padronizada</span>
                      </h3>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                          {
                            url: clinicalRecord.anteriorPhotoUrl,
                            title: "Vista Anterior",
                          },
                          {
                            url: clinicalRecord.posteriorPhotoUrl,
                            title: "Vista Posterior",
                          },
                          {
                            url:
                              clinicalRecord.lateralRightPhotoUrl ||
                              clinicalRecord.lateralPhotoUrl,
                            title: "Lateral Direita",
                          },
                          {
                            url: clinicalRecord.lateralLeftPhotoUrl,
                            title: "Lateral Esquerda",
                          },
                        ].map((photo, idx) =>
                          photo.url ? (
                            <div
                              key={idx}
                              onClick={() => setSelectedPhotoZoom({ url: photo.url!, title: photo.title })}
                              className="group cursor-pointer rounded-xl overflow-hidden border border-border bg-muted/20 relative shadow-2xs hover:border-primary/50 transition-all"
                            >
                              <div className="aspect-[3/4] overflow-hidden bg-black/5">
                                <img
                                  src={photo.url}
                                  alt={photo.title}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                              </div>
                              <div className="p-2 text-center bg-background/90 text-xs font-semibold text-foreground border-t border-border">
                                {photo.title}
                              </div>
                            </div>
                          ) : (
                            <div
                              key={idx}
                              className="rounded-xl border border-dashed border-border/70 aspect-[3/4] flex flex-col items-center justify-center p-3 text-center bg-muted/5 text-muted-foreground"
                            >
                              <ImageIcon className="h-6 w-6 opacity-30 mb-1" />
                              <span className="text-[11px] font-medium">{photo.title}</span>
                              <span className="text-[9px] opacity-70">Não anexada</span>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}

                {/* Linha do Tempo de Evoluções SOAP do CREFITO */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Activity className="h-4 w-4 text-emerald-600" />
                      <span>Evoluções Clínicas Diárias (SOAP — CREFITO)</span>
                    </h3>
                    <Badge variant="outline" className="text-xs">
                      {evolutions.length} evolução(ões)
                    </Badge>
                  </div>

                  {evolutions.length === 0 ? (
                    <Card className="p-6 text-center border-dashed border-border bg-muted/10">
                      <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-foreground">
                        Nenhuma evolução registrada para este paciente
                      </p>
                    </Card>
                  ) : (
                    <div className="space-y-3">
                      {evolutions.map((evo) => (
                        <Card key={evo.id} className="border-border shadow-xs p-4 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-2.5">
                            <div className="flex items-center gap-2">
                              <Badge variant="default" className="text-xs font-bold">
                                {formatDateBR(evo.date)}
                              </Badge>
                              {evo.techniqueCategory && (
                                <Badge variant="outline" className="text-xs font-medium">
                                  {evo.techniqueCategory}
                                </Badge>
                              )}
                              {evo.painScaleAfter !== undefined && (
                                <Badge
                                  variant="outline"
                                  className="text-[11px] font-bold text-rose-500 border-rose-500/30"
                                >
                                  Dor pós: {evo.painScaleAfter}/10
                                </Badge>
                              )}
                            </div>

                            <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                              <span>
                                Fisioterapeuta: <strong>{evo.professionalName}</strong> ({evo.crefito})
                              </span>
                              {evo.isLocked && (
                                <span className="text-emerald-600 flex items-center gap-1 font-semibold" title="Assinatura auditável inalterável">
                                  <CheckCheck className="h-3.5 w-3.5" />
                                  <span>Assinado</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Grid do SOAP */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            <div className="bg-muted/20 p-2.5 rounded-xl border border-border/50">
                              <span className="font-bold text-primary block mb-1">
                                [S] Subjetivo:
                              </span>
                              <p className="text-foreground/90 whitespace-pre-wrap">
                                {evo.subjective || "Sem queixas relatadas."}
                              </p>
                            </div>

                            <div className="bg-muted/20 p-2.5 rounded-xl border border-border/50">
                              <span className="font-bold text-emerald-600 dark:text-emerald-400 block mb-1">
                                [O] Objetivo:
                              </span>
                              <p className="text-foreground/90 whitespace-pre-wrap">
                                {evo.objective || "Exercícios e manobras executadas."}
                              </p>
                            </div>

                            <div className="bg-muted/20 p-2.5 rounded-xl border border-border/50">
                              <span className="font-bold text-indigo-600 dark:text-indigo-400 block mb-1">
                                [A] Avaliação:
                              </span>
                              <p className="text-foreground/90 whitespace-pre-wrap">
                                {evo.assessment || "Resposta ao tratamento."}
                              </p>
                            </div>

                            <div className="bg-muted/20 p-2.5 rounded-xl border border-border/50">
                              <span className="font-bold text-amber-600 dark:text-amber-400 block mb-1">
                                [P] Plano:
                              </span>
                              <p className="text-foreground/90 whitespace-pre-wrap">
                                {evo.plan || "Planejamento para a próxima sessão."}
                              </p>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* ========================================================= */}
              {/* ABA 4: PACOTES, PLANOS & EXTRATO FINANCEIRO               */}
              {/* ========================================================= */}
              <TabsContent value="financial" className="m-0 space-y-6">
                {/* Pacotes e Planos Contratados */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Award className="h-4 w-4 text-indigo-500" />
                    <span>Planos & Pacotes Adquiridos</span>
                  </h3>

                  {patientPackagesList.length === 0 ? (
                    <Card className="p-6 text-center border-dashed border-border bg-muted/10">
                      <Award className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-foreground">
                        Nenhum pacote contratado no histórico
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        O paciente opera com sessões avulsas ou ainda não possui plano vinculado.
                      </p>
                    </Card>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {patientPackagesList.map((pkg) => (
                        <Card key={pkg.id} className="border-border shadow-xs p-4 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="font-bold text-sm text-foreground">
                                {pkg.packageName}
                              </h4>
                              <span className="text-[11px] text-muted-foreground">
                                Vigência: {formatDateBR(pkg.startDate)} até {formatDateBR(pkg.expiryDate)}
                              </span>
                            </div>
                            <Badge
                              variant={pkg.status === "active" ? "default" : "outline"}
                              className={`text-[10px] ${
                                pkg.status === "active"
                                  ? "bg-emerald-600/15 text-emerald-600 border-emerald-600/30"
                                  : pkg.status === "completed"
                                  ? "bg-muted text-muted-foreground"
                                  : "text-destructive border-destructive/30"
                              }`}
                            >
                              {pkg.status === "active"
                                ? "Vigente"
                                : pkg.status === "completed"
                                ? "Concluído"
                                : "Expirado"}
                            </Badge>
                          </div>

                          {/* Barra de Progresso de Sessões */}
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-xs">
                              <span className="font-semibold text-foreground">
                                {pkg.remainingSessions} sessões restantes
                              </span>
                              <span className="text-muted-foreground text-[11px]">
                                {pkg.usedSessions} de {pkg.totalSessions} utilizadas ({pkg.progressPercent}%)
                              </span>
                            </div>

                            <div className="w-full bg-muted/60 h-2.5 rounded-full overflow-hidden border border-border/50">
                              <div
                                className={`h-full transition-all rounded-full ${
                                  pkg.remainingSessions <= 2
                                    ? "bg-amber-500"
                                    : "bg-emerald-600 dark:bg-emerald-500"
                                }`}
                                style={{ width: `${pkg.progressPercent}%` }}
                              />
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>

                {/* Extrato Financeiro */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-emerald-600" />
                    <span>Extrato Financeiro & Mensalidades</span>
                  </h3>

                  {patientTransactions.length === 0 ? (
                    <Card className="p-6 text-center border-dashed border-border bg-muted/10">
                      <DollarSign className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-foreground">
                        Nenhum registro financeiro vinculado
                      </p>
                    </Card>
                  ) : (
                    <div className="border border-border rounded-xl overflow-hidden shadow-xs">
                      <div className="max-h-[300px] overflow-y-auto">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold uppercase text-[10px] sticky top-0">
                            <tr>
                              <th className="p-2.5 pl-3.5">Vencimento</th>
                              <th className="p-2.5">Descrição & Categoria</th>
                              <th className="p-2.5">Forma</th>
                              <th className="p-2.5">Valor</th>
                              <th className="p-2.5 text-right pr-3.5">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {patientTransactions.map((tx) => (
                              <tr key={tx.id} className="hover:bg-muted/20 transition-colors">
                                <td className="p-2.5 pl-3.5 font-medium text-foreground whitespace-nowrap">
                                  {formatDateBR(tx.dueDate)}
                                </td>
                                <td className="p-2.5">
                                  <div className="font-semibold text-foreground">
                                    {tx.description}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground">
                                    {tx.category}
                                  </div>
                                </td>
                                <td className="p-2.5 text-muted-foreground capitalize">
                                  {tx.paymentMethod ? tx.paymentMethod.replace("_", " ") : "—"}
                                </td>
                                <td className="p-2.5 font-bold text-foreground whitespace-nowrap">
                                  R$ {tx.amount.toFixed(2)}
                                </td>
                                <td className="p-2.5 text-right pr-3.5 whitespace-nowrap">
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] ${
                                      tx.status === "paid"
                                        ? "bg-emerald-600/10 text-emerald-600 border-emerald-600/30 font-semibold"
                                        : tx.status === "pending"
                                        ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                                        : "text-muted-foreground"
                                    }`}
                                  >
                                    {tx.status === "paid"
                                      ? "Pago"
                                      : tx.status === "pending"
                                      ? "Pendente"
                                      : "Cancelado"}
                                  </Badge>
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
              {/* ABA 5: LAUDOS, DOCUMENTOS & TERMOS                       */}
              {/* ========================================================= */}
              <TabsContent value="reports" className="m-0 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <FileText className="h-4 w-4 text-indigo-500" />
                    <span>Laudos Clínicos, Atestados & Recibos Emitidos</span>
                  </h3>
                </div>

                {patientReports.length === 0 ? (
                  <Card className="p-8 text-center border-dashed border-border bg-muted/10">
                    <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-foreground">
                      Nenhum laudo ou atestado emitido para este paciente
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Os documentos oficiais emitidos com assinatura e rastreabilidade COFFITO aparecerão aqui.
                    </p>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {patientReports.map((report) => (
                      <Card key={report.id} className="border-border shadow-xs p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="font-bold text-xs text-foreground">
                              {report.title}
                            </h4>
                            <span className="text-[11px] text-muted-foreground">
                              Data: {formatDateBR(report.date)}
                            </span>
                          </div>
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {report.type === "report"
                              ? "Laudo"
                              : report.type === "certificate"
                              ? "Atestado"
                              : report.type === "receipt"
                              ? "Recibo"
                              : "TCLE"}
                          </Badge>
                        </div>

                        <div className="pt-2 border-t border-border/50 text-[11px] text-muted-foreground flex items-center justify-between">
                          <span>
                            Resp: <strong>{report.signedProfessionalName}</strong>
                          </span>
                          <span className="font-mono text-[10px]">
                            Hash: {report.documentHash.slice(0, 8)}...
                          </span>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
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

      {/* Documento Oculto para Impressão Nativa A4 */}
      <div id="printable-patient-sheet" className="hidden print:block font-sans text-black p-6">
        <div className="border-b-2 border-black pb-4 mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold uppercase tracking-wide">
              Altar Fisio — Clínica de Fisioterapia & Pilates
            </h1>
            <p className="text-xs text-gray-600 mt-0.5">
              Ficha Clínica Cadastral & Resumo Integrado do Paciente
            </p>
          </div>
          <div className="text-right text-xs">
            <div>Data de Emissão: {formatDateBR(getTodayDateString())}</div>
            <div className="font-bold text-sm text-gray-800">Doc ID: {patient.id.slice(0, 10)}</div>
          </div>
        </div>

        {/* Dados Cadastrais */}
        <div className="mb-4">
          <h2 className="text-sm font-bold uppercase border-b border-gray-400 pb-1 mb-2">
            1. Identificação do Paciente
          </h2>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><strong>Nome:</strong> {patient.name}</div>
            <div><strong>CPF:</strong> {patient.documentCpf}</div>
            <div><strong>Telefone:</strong> {formatPhoneBR(patient.phone)}</div>
            <div><strong>E-mail:</strong> {patient.email || "Não informado"}</div>
            <div><strong>Nascimento:</strong> {formatDateBR(patient.birthDate)} ({age} anos)</div>
            <div><strong>Gênero:</strong> {patient.gender || "Não informado"}</div>
            <div><strong>Convênio / Modalidade:</strong> {patient.healthInsurance || "Particular"}</div>
            <div><strong>Contato Emergência:</strong> {patient.emergencyContact || "—"} ({patient.emergencyPhone || "—"})</div>
            <div className="col-span-2"><strong>Endereço:</strong> {patient.address || "Não informado"}</div>
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
            <div className="text-xs space-y-1.5">
              <div><strong>Queixa Principal:</strong> {clinicalRecord.chiefComplaint}</div>
              <div><strong>Escala EVA de Dor Atual:</strong> {currentPainEva !== null ? `${currentPainEva}/10` : "Não informada"} ({clinicalRecord.painLocation || "Sem localização"})</div>
              <div><strong>História da Moléstia Atual:</strong> {clinicalRecord.hpi}</div>
              <div><strong>Metas Terapêuticas:</strong> {clinicalRecord.clinicalGoals}</div>
              {clinicalRecord.medications && <div><strong>Medicações:</strong> {clinicalRecord.medications}</div>}
            </div>
          </div>
        )}

        {/* Assinatura */}
        <div className="mt-12 pt-4 border-t border-gray-400 flex justify-between text-xs text-gray-700">
          <div>
            Assinatura do Paciente / Responsável Legal
          </div>
          <div className="text-right">
            Fisioterapeuta Responsável Técnico • CREFITO
          </div>
        </div>
      </div>
    </>
  )
}
