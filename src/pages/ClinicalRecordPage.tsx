import React, { useState, useRef, useEffect } from "react"
import { useClinicData } from "@/contexts/ClinicDataContext"
import { useAuth } from "@/contexts/AuthContext"
import type { ClinicalEvolution, PosturalViewType, ClinicalDocumentType, ClinicalReport } from "@/types"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select-native"
import { formatDateBR, getTodayDateString } from "@/lib/dateUtils"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  FileText,
  Plus,
  CheckCircle2,
  Calendar,
  Activity,
  Award,
  Image as ImageIcon,
  HeartPulse,
  Lock,
  Camera,
  Upload,
  Crosshair,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Maximize2,
  Sliders,
  Flame,
  Check,
  Search,
  ArrowLeft,
  Edit2,
  Trash2,
  AlertTriangle,
  UserCheck,
  UserX,
  Phone,
  Clock,
  Layers,
  ChevronRight,
  Printer,
  Edit3,
} from "lucide-react"
import { PainEvolutionChart } from "@/components/clinical/PainEvolutionChart"
import { BiofotogrametriaModal } from "@/components/clinical/BiofotogrametriaModal"
import { DocumentGeneratorModal } from "@/components/clinical/DocumentGeneratorModal"
import { LgpdConsentModal } from "@/components/clinical/LgpdConsentModal"
import { ViewModeToggle } from "@/components/ui/view-mode-toggle"

interface ClinicalRecordPageProps {
  initialPatientId?: string
}

export const ClinicalRecordPage: React.FC<ClinicalRecordPageProps> = ({
  initialPatientId,
}) => {
  const { user, canAccessClinical } = useAuth()
  const {
    patients,
    professionals,
    clinicalOverview,
    getClinicalRecord,
    saveClinicalRecord,
    deleteClinicalRecord,
    getEvolutions,
    addSoapEvolution,
    updateSoapEvolution,
    deleteSoapEvolution,
    uploadPosturalPhoto,
    getPainEvolutionHistory,
    getClinicalReports,
    createClinicalReport,
    updateClinicalReport,
    deleteClinicalReport,
    logAuditAction,
    savePatientConsent,
  } = useClinicData()

  // Modo de visualização: "overview" (Central de Prontuários) ou "patient" (Ficha Individual)
  const [viewMode, setViewMode] = useState<"overview" | "patient">(
    initialPatientId ? "patient" : "overview"
  )
  const [selectedPatientId, setSelectedPatientId] = useState(
    initialPatientId || patients[0]?.id || ""
  )

  // Filtros na Central de Prontuários
  const [overviewSearch, setOverviewSearch] = useState("")
  const [overviewFilter, setOverviewFilter] = useState<"all" | "has_record" | "no_record" | "high_pain">("all")
  const [overviewLayoutMode, setOverviewLayoutMode] = useState<"grid" | "list">(() => {
    const saved = localStorage.getItem("altar_records_view_mode")
    return saved === "list" || saved === "grid" ? saved : "grid"
  })

  const handleOverviewLayoutChange = (mode: "grid" | "list") => {
    setOverviewLayoutMode(mode)
    localStorage.setItem("altar_records_view_mode", mode)
  }

  // Abas na Ficha do Paciente
  const [activeTab, setActiveTab] = useState("evolutions")
  const [isEvolutionModalOpen, setIsEvolutionModalOpen] = useState(false)
  const [isDocModalOpen, setIsDocModalOpen] = useState(false)
  const [isLgpdModalOpen, setIsLgpdModalOpen] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState<string | null>(null)

  // Estados de Gestão de Laudos e Documentos (CRUD)
  const [selectedReportToEdit, setSelectedReportToEdit] = useState<ClinicalReport | null>(null)
  const [docModalInitialType, setDocModalInitialType] = useState<ClinicalDocumentType>("report")
  const [isDeleteReportOpen, setIsDeleteReportOpen] = useState(false)
  const [reportToDelete, setReportToDelete] = useState<ClinicalReport | null>(null)
  const [isDeletingReport, setIsDeletingReport] = useState(false)

  // Modal de Edição de Evolução SOAP
  const [editingEvolution, setEditingEvolution] = useState<ClinicalEvolution | null>(null)
  const [editSubjective, setEditSubjective] = useState("")
  const [editObjective, setEditObjective] = useState("")
  const [editAssessment, setEditAssessment] = useState("")
  const [editPlan, setEditPlan] = useState("")
  const [editDate, setEditDate] = useState("")
  const [editPainScaleAfter, setEditPainScaleAfter] = useState<number>(2)
  const [editTechniqueCategory, setEditTechniqueCategory] = useState("Pilates")
  const [isSubmittingEditEvo, setIsSubmittingEditEvo] = useState(false)

  // Modal de Exclusão de Evolução SOAP
  const [deletingEvolution, setDeletingEvolution] = useState<ClinicalEvolution | null>(null)
  const [isDeletingEvo, setIsDeletingEvo] = useState(false)

  // Modal de Exclusão de Prontuário
  const [deletingRecordPatientId, setDeletingRecordPatientId] = useState<string | null>(null)
  const [isDeletingRecord, setIsDeletingRecord] = useState(false)

  // Biofotogrametria Modal State
  const [isBioModalOpen, setIsBioModalOpen] = useState(false)
  const [bioModalView, setBioModalView] = useState<PosturalViewType>("anterior")

  // Refs para inputs de arquivos das 4 vistas
  const anteriorInputRef = useRef<HTMLInputElement>(null)
  const posteriorInputRef = useRef<HTMLInputElement>(null)
  const lateralRightInputRef = useRef<HTMLInputElement>(null)
  const lateralLeftInputRef = useRef<HTMLInputElement>(null)

  // SOAP Form State (Novo)
  const [subjective, setSubjective] = useState("")
  const [objective, setObjective] = useState("")
  const [assessment, setAssessment] = useState("")
  const [plan, setPlan] = useState("")
  const [selectedProfId, setSelectedProfId] = useState(
    user?.professionalId || professionals[0]?.id || ""
  )
  const [painScaleAfter, setPainScaleAfter] = useState(2)
  const [techniqueCategory, setTechniqueCategory] = useState<string>("Pilates")

  // Anamnese Form State
  const currentRecord = getClinicalRecord(selectedPatientId)
  const [chiefComplaint, setChiefComplaint] = useState(
    currentRecord?.chiefComplaint || "Lombalgia com irradiação para membro inferior direito."
  )
  const [hpi, setHpi] = useState(
    currentRecord?.hpi || "Dor iniciada há 3 meses após esforço repetitivo."
  )
  const [medicalHistory, setMedicalHistory] = useState(
    currentRecord?.medicalHistory || "Sedentarismo, sem histórico cirúrgico."
  )
  const [medications, setMedications] = useState(
    currentRecord?.medications || "Anti-inflamatório sob demanda."
  )
  const [painScaleEva, setPainScaleEva] = useState(currentRecord?.painScaleEva || 5)
  const [painLocation, setPainLocation] = useState(
    currentRecord?.painLocation || "Lombar baixa L4-L5 e glúteo direito."
  )
  const [clinicalGoals, setClinicalGoals] = useState(
    currentRecord?.clinicalGoals || "Alívio da dor, fortalecimento do core e reeducação postural."
  )
  const [posturalNotes, setPosturalNotes] = useState(
    currentRecord?.posturalNotes || "Desvio lateral em escoliose em C tóraco-lombar."
  )

  const patient = patients.find((p) => p.id === selectedPatientId)
  const evolutions = getEvolutions(selectedPatientId).sort((a, b) => b.timestamp - a.timestamp)
  const painPoints = getPainEvolutionHistory(selectedPatientId)
  const patientReports = selectedPatientId ? getClinicalReports(selectedPatientId) : []

  const handleOpenNewReport = (docType: ClinicalDocumentType = "report") => {
    setSelectedReportToEdit(null)
    setDocModalInitialType(docType)
    setIsDocModalOpen(true)
  }

  const handleEditReport = (report: ClinicalReport) => {
    setSelectedReportToEdit(report)
    setDocModalInitialType(report.type)
    setIsDocModalOpen(true)
  }

  const handleSaveReport = async (reportData: any) => {
    if (reportData.id) {
      await updateClinicalReport(reportData.id, reportData)
      setFeedback("Laudo clínico atualizado com sucesso!")
    } else {
      await createClinicalReport(reportData)
      setFeedback("Novo laudo clínico salvo no prontuário!")
    }
    setTimeout(() => setFeedback(null), 3500)
  }

  const handleDeleteReportClick = (report: ClinicalReport) => {
    setReportToDelete(report)
    setIsDeleteReportOpen(true)
  }

  const handleConfirmDeleteReport = async () => {
    if (!reportToDelete) return
    setIsDeletingReport(true)
    try {
      await deleteClinicalReport(reportToDelete.id)
      setIsDeleteReportOpen(false)
      setReportToDelete(null)
      setFeedback("Laudo excluído com sucesso!")
      setTimeout(() => setFeedback(null), 3500)
    } catch (err) {
      console.error("Erro ao excluir laudo:", err)
    } finally {
      setIsDeletingReport(false)
    }
  }

  // Sincroniza formulário ao trocar de paciente
  useEffect(() => {
    if (currentRecord) {
      setChiefComplaint(currentRecord.chiefComplaint)
      setHpi(currentRecord.hpi)
      setMedicalHistory(currentRecord.medicalHistory)
      setMedications(currentRecord.medications)
      setPainScaleEva(currentRecord.painScaleEva)
      setPainLocation(currentRecord.painLocation)
      setClinicalGoals(currentRecord.clinicalGoals)
      setPosturalNotes(currentRecord.posturalNotes || "")
    } else {
      setChiefComplaint("")
      setHpi("")
      setMedicalHistory("")
      setMedications("")
      setPainScaleEva(0)
      setPainLocation("")
      setClinicalGoals("")
      setPosturalNotes("")
    }
  }, [selectedPatientId, currentRecord])

  // Auditoria COFFITO / LGPD ao carregar prontuário
  useEffect(() => {
    if (patient && user) {
      logAuditAction({
        action: "view_clinical_record",
        patientId: patient.id,
        patientName: patient.name,
        details: `Visualização da ficha clínica e prontuário COFFITO do paciente ${patient.name}.`,
      })
    }
  }, [selectedPatientId, user])

  const showToast = (msg: string) => {
    setFeedback(msg)
    setTimeout(() => setFeedback(null), 3500)
  }

  // Filtragem da Central de Prontuários
  const filteredOverview = clinicalOverview.filter((item) => {
    const term = overviewSearch.toLowerCase()
    const matchesSearch =
      item.patientName.toLowerCase().includes(term) ||
      item.patientCpf.includes(term) ||
      item.patientPhone.includes(term)

    if (!matchesSearch) return false

    if (overviewFilter === "has_record" && !item.hasRecord) return false
    if (overviewFilter === "no_record" && item.hasRecord) return false
    if (overviewFilter === "high_pain" && (!item.painScaleEva || item.painScaleEva < 7)) return false

    return true
  })

  // Abertura de ficha clínica
  const handleOpenPatientRecord = (patientId: string) => {
    setSelectedPatientId(patientId)
    setViewMode("patient")
  }

  // Salvar Anamnese
  const handleSaveAnamnesis = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPatientId) return

    saveClinicalRecord({
      patientId: selectedPatientId,
      chiefComplaint,
      hpi,
      medicalHistory,
      medications,
      painScaleEva,
      painLocation,
      clinicalGoals,
      posturalNotes,
      updatedAt: Date.now(),
      anteriorPhotoUrl: currentRecord?.anteriorPhotoUrl,
      anteriorStorageId: currentRecord?.anteriorStorageId,
      posteriorPhotoUrl: currentRecord?.posteriorPhotoUrl,
      posteriorStorageId: currentRecord?.posteriorStorageId,
      lateralRightPhotoUrl: currentRecord?.lateralRightPhotoUrl,
      lateralRightStorageId: currentRecord?.lateralRightStorageId,
      lateralLeftPhotoUrl: currentRecord?.lateralLeftPhotoUrl,
      lateralLeftStorageId: currentRecord?.lateralLeftStorageId,
      lateralPhotoUrl: currentRecord?.lateralPhotoUrl,
      posturalDate: currentRecord?.posturalDate || getTodayDateString(),
    })

    showToast("Anamnese e Avaliação Clínica salvas com sucesso!")
  }

  // Submeter Nova Evolução SOAP
  const handleAddEvolution = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPatientId || !subjective || !plan) {
      alert("Por favor, preencha os campos obrigatórios do método SOAP.")
      return
    }

    const prof = professionals.find((p) => p.id === selectedProfId) || professionals[0]
    const today = getTodayDateString()

    addSoapEvolution({
      patientId: selectedPatientId,
      patientName: patient?.name || "Paciente",
      professionalId: prof.id,
      professionalName: prof.name,
      crefito: prof.crefito,
      date: today,
      subjective,
      objective,
      assessment,
      plan,
      painScaleAfter,
      techniqueCategory,
    })


    setIsEvolutionModalOpen(false)
    setSubjective("")
    setObjective("")
    setAssessment("")
    setPlan("")
    setPainScaleAfter(2)
    showToast("Evolução SOAP registrada com sucesso!")
  }

  // Abrir Modal de Edição de Evolução
  const handleOpenEditEvolution = (evo: ClinicalEvolution) => {
    setEditingEvolution(evo)
    setEditSubjective(evo.subjective)
    setEditObjective(evo.objective)
    setEditAssessment(evo.assessment)
    setEditPlan(evo.plan)
    setEditDate(evo.date)
    setEditPainScaleAfter(evo.painScaleAfter ?? 2)
    setEditTechniqueCategory(evo.techniqueCategory || "Pilates")
  }

  // Salvar Edição de Evolução
  const handleSaveEditEvolution = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingEvolution) return
    setIsSubmittingEditEvo(true)

    try {
      await updateSoapEvolution(editingEvolution.id, {
        subjective: editSubjective,
        objective: editObjective,
        assessment: editAssessment,
        plan: editPlan,
        date: editDate,
        painScaleAfter: editPainScaleAfter,
        techniqueCategory: editTechniqueCategory,
      })
      showToast("Evolução SOAP atualizada com sucesso!")
      setEditingEvolution(null)
    } catch (err: any) {
      alert("Erro ao atualizar evolução: " + (err?.message || "Tente novamente."))
    } finally {
      setIsSubmittingEditEvo(false)
    }
  }

  // Confirmar Exclusão de Evolução
  const handleConfirmDeleteEvolution = async () => {
    if (!deletingEvolution) return
    setIsDeletingEvo(true)
    try {
      await deleteSoapEvolution(deletingEvolution.id, selectedPatientId)
      showToast("Evolução SOAP excluída com sucesso.")
      setDeletingEvolution(null)
    } catch (err: any) {
      alert("Erro ao excluir evolução: " + (err?.message || "Tente novamente."))
    } finally {
      setIsDeletingEvo(false)
    }
  }

  // Confirmar Exclusão de Prontuário
  const handleConfirmDeleteRecord = async () => {
    if (!deletingRecordPatientId) return
    setIsDeletingRecord(true)
    try {
      await deleteClinicalRecord(deletingRecordPatientId)
      showToast("Prontuário clínico excluído com sucesso.")
      setDeletingRecordPatientId(null)
    } catch (err: any) {
      alert("Erro ao excluir prontuário: " + (err?.message || "Tente novamente."))
    } finally {
      setIsDeletingRecord(false)
    }
  }

  // Templates de SOAP
  const applySoapTemplate = (type: "pilates" | "rpg" | "fisio") => {
    if (type === "pilates") {
      setTechniqueCategory("Pilates em Aparelhos")
      setSubjective("Paciente relata melhora de 50% na tensão lombar matinal. Sem queixas de dor aguda hoje.")
      setObjective("Realizou exercícios no Reformer (Footwork com carga média) e Cadillac (Spine Stretch). ADM de coluna satisfatória, ativação satisfatória do Powerhouse.")
      setAssessment("Boa evolução no controle motor e alinhamento pélvico. Ausência de compensações antálgicas.")
      setPlan("Progredir para exercícios de estabilização lombo-pélvica com apoio unilateral na próxima sessão.")
      setPainScaleAfter(1)
    } else if (type === "rpg") {
      setTechniqueCategory("RPG Souchard")
      setSubjective("Refere dor em queimação na região interescapular após longo período sentado no trabalho.")
      setObjective("Postura de rã no chão com braços abertos por 25 min. Tração axial suave de coluna cervical. Respiração diafragmática paradoxal corrigida.")
      setAssessment("Liberação satisfatória da cadeia respiratória anterior e diminuição da antepulsão de ombros.")
      setPlan("Manter postura sentada com membros inferiores fletidos e orientar ergonomia do posto de trabalho.")
      setPainScaleAfter(2)
    } else {
      setTechniqueCategory("Fisioterapia Manual & Cinesio")
      setSubjective("Relata dor ao final do arco de abdução do ombro (EVA 6).")
      setObjective("Teste de Neer positivo. Realizada mobilização articular Glenoumeral grau III, liberação miofascial de trapézio e infraespinal.")
      setAssessment("Ganho de 15 graus de abdução ativa sem dor imediata após intervenção.")
      setPlan("Iniciar fortalecimento isométrico do manguito rotador e crioterapia domiciliar 20min.")
      setPainScaleAfter(3)
    }
  }

  // Upload de Fotos
  const handlePhotoUpload = async (view: PosturalViewType, file: File) => {
    setIsUploadingPhoto(view)
    try {
      await uploadPosturalPhoto(selectedPatientId, view, file)
      showToast(`Foto da vista ${view} atualizada com sucesso!`)
    } catch (err) {
      alert("Erro ao fazer upload da foto. Tente novamente.")
    } finally {
      setIsUploadingPhoto(null)
    }
  }

  const openBioModalFor = (view: PosturalViewType) => {
    setBioModalView(view)
    setIsBioModalOpen(true)
  }

  // Cores EVA
  const getEvaColor = (val: number) => {
    if (val <= 2) return "text-emerald-500 bg-emerald-500/10 border-emerald-500/30"
    if (val <= 5) return "text-amber-500 bg-amber-500/10 border-amber-500/30"
    if (val <= 8) return "text-orange-500 bg-orange-500/10 border-orange-500/30"
    return "text-rose-600 bg-rose-600/10 border-rose-600/30"
  }

  if (!canAccessClinical) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto min-h-[60vh] flex flex-col justify-center items-center text-center animate-fade-in">
        <div className="h-16 w-16 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20 mb-4 shadow-sm">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Acesso Restrito ao Prontuário Clínico</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-md">
          Em estrita conformidade com a <strong>Resolução COFFITO nº 414/2012</strong> e a LGPD sobre dados sensíveis de saúde, o prontuário eletrônico e a biofotogrametria são acessíveis exclusivamente por fisioterapeutas com registro CREFITO ativo e pela administração técnica médica.
        </p>
        <div className="mt-4 px-3.5 py-1.5 rounded-full bg-muted border border-border text-xs text-muted-foreground font-medium">
          Perfil Conectado: <strong>{user?.name}</strong> ({user?.role})
        </div>
      </div>
    )
  }

  // =========================================================================
  // MODO 1: CENTRAL DE PRONTUÁRIOS (VISÃO GERAL / DIRETÓRIO DE PRONTUÁRIOS)
  // =========================================================================
  if (viewMode === "overview") {
    const totalRecords = clinicalOverview.filter((c) => c.hasRecord).length
    const totalEvos = clinicalOverview.reduce((sum, c) => sum + c.evolutionsCount, 0)
    const severePain = clinicalOverview.filter((c) => c.painScaleEva && c.painScaleEva >= 7).length

    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
        {feedback && (
          <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm font-medium animate-fade-in">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{feedback}</span>
          </div>
        )}

        {/* Header da Central */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <FileText className="h-6 w-6 text-primary" />
              <span>Central Geral de Prontuários & Evoluções</span>
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Diretório consolidado de fichas clínicas, anamneses e evoluções diárias conforme Resolução COFFITO nº 414/2012.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                if (patients.length > 0) {
                  setSelectedPatientId(patients[0].id)
                  setViewMode("patient")
                }
              }}
              className="gap-2 shadow-sm"
            >
              <HeartPulse className="h-4 w-4" />
              <span>Abrir Ficha Individual</span>
            </Button>
          </div>
        </div>

        {/* KPIs da Central */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-border shadow-xs">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Total de Pacientes
              </CardTitle>
              <FileText className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold text-foreground">{clinicalOverview.length}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Cadastrados na base da clínica
              </p>
            </CardContent>
          </Card>

          <Card className="border-border shadow-xs">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Prontuários Ativos
              </CardTitle>
              <UserCheck className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {totalRecords}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Com anamnese inicial preenchida
              </p>
            </CardContent>
          </Card>

          <Card className="border-border shadow-xs">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Total de Evoluções SOAP
              </CardTitle>
              <Activity className="h-4 w-4 text-indigo-500" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                {totalEvos}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Atendimentos com carimbo e assinatura
              </p>
            </CardContent>
          </Card>

          <Card className="border-border shadow-xs">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Casos com Dor Intensa (EVA &ge; 7)
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-rose-500" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                {severePain}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Atenção prioritária no plano de tratamento
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Barra de Filtros e Busca */}
        <Card className="p-4 border-border shadow-xs">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={overviewSearch}
                onChange={(e) => setOverviewSearch(e.target.value)}
                placeholder="Buscar prontuário por paciente, CPF ou WhatsApp..."
                className="pl-10 h-10 text-xs sm:text-sm"
              />
            </div>

            <div className="flex items-center gap-2.5">
              <div className="w-56 sm:w-64 flex-1 sm:flex-initial">
                <Select
                  value={overviewFilter}
                  onChange={(e) => setOverviewFilter(e.target.value as any)}
                >
                  <option value="all">Todos os Pacientes ({clinicalOverview.length})</option>
                  <option value="has_record">Com Prontuário Ativo ({totalRecords})</option>
                  <option value="no_record">Sem Prontuário Iniciado</option>
                  <option value="high_pain">Dor Intensa (EVA &ge; 7)</option>
                </Select>
              </div>

              <ViewModeToggle viewMode={overviewLayoutMode} onChange={handleOverviewLayoutChange} />
            </div>
          </div>
        </Card>

        {/* Tabela / Grid de Prontuários */}
        {filteredOverview.length === 0 ? (
          <Card className="p-12 text-center border-border shadow-xs">
            <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-foreground">Nenhum registro clínico encontrado</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Ajuste os filtros de busca ou selecione um paciente para iniciar o prontuário.
            </p>
          </Card>
        ) : overviewLayoutMode === "grid" ? (
          /* MODO GRADE */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
            {filteredOverview.map((item) => (
              <Card
                key={item.patientId}
                className="border-border hover:border-primary/40 transition-all flex flex-col justify-between shadow-xs"
              >
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-2xl bg-primary/15 text-primary flex items-center justify-center font-bold text-base shadow-2xs">
                        {item.patientName.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-foreground leading-tight">
                          {item.patientName}
                        </h3>
                        <p className="text-xs font-mono text-muted-foreground mt-0.5">
                          CPF: {item.patientCpf}
                        </p>
                      </div>
                    </div>

                    <Badge
                      variant={item.hasRecord ? "default" : "outline"}
                      className={`text-[10px] shrink-0 font-semibold ${
                        item.hasRecord
                          ? "bg-emerald-600/10 text-emerald-600 border-emerald-600/30"
                          : "text-muted-foreground"
                      }`}
                    >
                      {item.hasRecord ? "Prontuário Ativo" : "Sem Ficha"}
                    </Badge>
                  </div>

                  {item.chiefComplaint ? (
                    <p className="text-xs text-foreground/90 font-medium pt-3 line-clamp-2">
                      &ldquo;{item.chiefComplaint}&rdquo;
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground italic pt-3">
                      Anamnese inicial pendente de preenchimento.
                    </p>
                  )}
                </CardHeader>

                <CardContent className="p-5 pt-0 space-y-3">
                  <div className="p-3 rounded-xl bg-muted/40 border border-border flex items-center justify-between text-xs">
                    <div>
                      <span className="text-muted-foreground text-[11px] block">Evoluções SOAP</span>
                      <span className="font-bold text-foreground">
                        {item.evolutionsCount} atendimento{item.evolutionsCount !== 1 ? "s" : ""}
                      </span>
                    </div>

                    {item.painScaleEva !== null && item.painScaleEva !== undefined ? (
                      <div className="text-right">
                        <span className="text-muted-foreground text-[11px] block">Dor EVA</span>
                        <span className={`font-bold px-2 py-0.5 rounded-full border text-[11px] ${getEvaColor(item.painScaleEva)}`}>
                          EVA {item.painScaleEva}/10
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-[11px]">EVA não avaliada</span>
                    )}
                  </div>

                  <div className="pt-2 border-t border-border space-y-2">
                    <Button
                      size="sm"
                      onClick={() => handleOpenPatientRecord(item.patientId)}
                      className="w-full text-xs gap-1.5 h-8.5 shadow-xs"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <span>Abrir Prontuário Completo</span>
                    </Button>

                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedPatientId(item.patientId)
                          setIsEvolutionModalOpen(true)
                        }}
                        className="text-xs h-7.5 px-2.5 gap-1 text-primary border-primary/30 hover:bg-primary/5 flex-1"
                      >
                        <Plus className="h-3 w-3" />
                        <span>Nova Evolução</span>
                      </Button>

                      {item.hasRecord && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeletingRecordPatientId(item.patientId)}
                          className="text-xs h-7.5 px-2 text-muted-foreground hover:text-destructive"
                          title="Excluir prontuário deste paciente"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          /* MODO LISTA (100% RESPONSIVO) */
          <div className="bg-card rounded-2xl border border-border shadow-xs overflow-hidden animate-fade-in">
            {/* Tabela para Desktop e Tablet (>= 640px) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-muted/40 border-b border-border/70 text-muted-foreground font-semibold">
                    <th className="p-3 pl-4">Paciente</th>
                    <th className="p-3">Queixa Principal / Hipótese</th>
                    <th className="p-3">Evoluções SOAP</th>
                    <th className="p-3">Escala EVA</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 pr-4 text-right">Ações Rápidas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredOverview.map((item) => (
                    <tr
                      key={item.patientId}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="p-3 pl-4">
                        <div className="flex items-center gap-3">
                          <div
                            onClick={() => handleOpenPatientRecord(item.patientId)}
                            className="h-9 w-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center font-bold text-xs shrink-0 cursor-pointer hover:bg-primary/25 transition-colors"
                            title="Abrir Prontuário"
                          >
                            {item.patientName.charAt(0)}
                          </div>
                          <div>
                            <div
                              onClick={() => handleOpenPatientRecord(item.patientId)}
                              className="font-bold text-sm text-foreground hover:text-primary cursor-pointer transition-colors"
                            >
                              {item.patientName}
                            </div>
                            <div className="text-[11px] font-mono text-muted-foreground">
                              CPF: {item.patientCpf}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="p-3 max-w-xs">
                        {item.chiefComplaint ? (
                          <div className="text-xs text-foreground/90 font-medium truncate" title={item.chiefComplaint}>
                            &ldquo;{item.chiefComplaint}&rdquo;
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground italic">
                            Anamnese pendente
                          </span>
                        )}
                      </td>

                      <td className="p-3 whitespace-nowrap">
                        <span className="font-semibold text-foreground">
                          {item.evolutionsCount} atendimento{item.evolutionsCount !== 1 ? "s" : ""}
                        </span>
                      </td>

                      <td className="p-3 whitespace-nowrap">
                        {item.painScaleEva !== null && item.painScaleEva !== undefined ? (
                          <span className={`font-bold px-2 py-0.5 rounded-full border text-[11px] ${getEvaColor(item.painScaleEva)}`}>
                            EVA {item.painScaleEva}/10
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">Não avaliada</span>
                        )}
                      </td>

                      <td className="p-3 whitespace-nowrap">
                        <Badge
                          variant={item.hasRecord ? "default" : "outline"}
                          className={`text-[10px] font-semibold ${
                            item.hasRecord
                              ? "bg-emerald-600/10 text-emerald-600 border-emerald-600/30"
                              : "text-muted-foreground"
                          }`}
                        >
                          {item.hasRecord ? "Prontuário Ativo" : "Sem Ficha"}
                        </Badge>
                      </td>

                      <td className="p-3 pr-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenPatientRecord(item.patientId)}
                            className="h-8 px-2.5 text-xs gap-1 text-primary border-primary/30 hover:bg-primary/5"
                            title="Abrir Prontuário Completo"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            <span className="hidden lg:inline">Abrir Prontuário</span>
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedPatientId(item.patientId)
                              setIsEvolutionModalOpen(true)
                            }}
                            className="h-8 px-2.5 text-xs gap-1 text-muted-foreground hover:text-foreground"
                            title="Nova Evolução SOAP"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span className="hidden lg:inline">Evolução</span>
                          </Button>

                          {item.hasRecord && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setDeletingRecordPatientId(item.patientId)}
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              title="Excluir Prontuário"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cards Condensados para Mobile (< 640px) */}
            <div className="sm:hidden divide-y divide-border/60">
              {filteredOverview.map((item) => (
                <div key={item.patientId} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div
                        onClick={() => handleOpenPatientRecord(item.patientId)}
                        className="h-10 w-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center font-bold text-sm shrink-0 cursor-pointer"
                      >
                        {item.patientName.charAt(0)}
                      </div>
                      <div>
                        <div
                          onClick={() => handleOpenPatientRecord(item.patientId)}
                          className="font-bold text-sm text-foreground hover:text-primary cursor-pointer leading-tight"
                        >
                          {item.patientName}
                        </div>
                        <div className="text-xs font-mono text-muted-foreground mt-0.5">
                          CPF: {item.patientCpf}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <Badge
                        variant={item.hasRecord ? "default" : "outline"}
                        className={`text-[9px] font-semibold ${
                          item.hasRecord
                            ? "bg-emerald-600/10 text-emerald-600 border-emerald-600/30"
                            : "text-muted-foreground"
                        }`}
                      >
                        {item.hasRecord ? "Ativo" : "Sem Ficha"}
                      </Badge>
                      {item.painScaleEva !== null && item.painScaleEva !== undefined && (
                        <span className={`font-bold px-1.5 py-0.5 rounded-full border text-[9px] ${getEvaColor(item.painScaleEva)}`}>
                          EVA {item.painScaleEva}
                        </span>
                      )}
                    </div>
                  </div>

                  {item.chiefComplaint && (
                    <p className="text-xs text-muted-foreground line-clamp-1 italic">
                      &ldquo;{item.chiefComplaint}&rdquo;
                    </p>
                  )}

                  <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-border/50">
                    <Button
                      size="sm"
                      onClick={() => handleOpenPatientRecord(item.patientId)}
                      className="h-8 px-2.5 text-xs gap-1 flex-1 font-semibold"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <span>Prontuário</span>
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedPatientId(item.patientId)
                        setIsEvolutionModalOpen(true)
                      }}
                      className="h-8 px-2.5 text-xs gap-1 text-primary border-primary/30 hover:bg-primary/5"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Evolução</span>
                    </Button>

                    {item.hasRecord && (
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => setDeletingRecordPatientId(item.patientId)}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                        title="Excluir"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal de Exclusão de Prontuário */}
        <Dialog open={!!deletingRecordPatientId} onOpenChange={(open) => !open && setDeletingRecordPatientId(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <div className="h-10 w-10 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-2">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <DialogTitle>Excluir Prontuário Clínico</DialogTitle>
              <DialogDescription>
                Tem certeza que deseja excluir toda a ficha de anamnese e avaliações deste paciente?
                Os dados de evolução e fotos posturais serão desvinculados do prontuário.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setDeletingRecordPatientId(null)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmDeleteRecord}
                disabled={isDeletingRecord}
              >
                {isDeletingRecord ? "Excluindo..." : "Confirmar Exclusão"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // =========================================================================
  // MODO 2: FICHA CLÍNICA INDIVIDUAL DO PACIENTE (COM VOLTAR PARA CENTRAL)
  // =========================================================================
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Toast Feedback */}
      {feedback && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm font-medium animate-fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Top Bar com Botão Voltar para Central */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode("overview")}
            className="gap-1.5 text-xs font-semibold shadow-xs"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Central de Prontuários</span>
          </Button>

          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <span>Ficha Clínica: {patient?.name}</span>
            </h1>
          </div>
        </div>

        {/* Seletor Rápido de Paciente */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground shrink-0">Trocar Paciente:</span>
          <div className="min-w-[220px]">
            <Select
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {/* Banner Resumo do Paciente Ativo com Selo COFFITO */}
      {patient && (
        <Card className="bg-gradient-to-r from-primary/10 via-card to-card border-primary/20 shadow-xs">
          <CardContent className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="h-12 w-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg shadow-sm">
                {patient.name.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold text-foreground">
                    {patient.name}
                  </h2>
                  <Badge variant="outline" className="text-[10px]">
                    {patient.healthInsurance || "Particular"}
                  </Badge>
                  <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    <ShieldCheck className="h-3 w-3" />
                    COFFITO Nº 414/2012
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-0.5">
                  <span>CPF: {patient.documentCpf}</span>
                  <span>WhatsApp: {patient.phone}</span>
                  <span>Nasc: {formatDateBR(patient.birthDate)}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsLgpdModalOpen(true)}
                className="gap-1.5 text-xs font-semibold shadow-xs text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Termos LGPD</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOpenNewReport("report")}
                className="gap-1.5 text-xs font-semibold shadow-xs"
              >
                <FileText className="h-3.5 w-3.5 text-primary" />
                <span>Emitir Laudo / PDF</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setBioModalView("anterior")
                  setIsBioModalOpen(true)
                }}
                className="gap-1.5 text-xs font-semibold shadow-xs"
              >
                <Crosshair className="h-3.5 w-3.5 text-primary" />
                <span>Espelho Postural</span>
              </Button>

              <Button
                onClick={() => setIsEvolutionModalOpen(true)}
                className="gap-2 font-semibold shadow-sm"
              >
                <Plus className="h-4 w-4" />
                <span>Nova Evolução SOAP</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs de Prontuário Clínico */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 max-w-2xl w-full">
          <TabsTrigger value="evolutions" className="text-xs">
            Evoluções SOAP ({evolutions.length})
          </TabsTrigger>
          <TabsTrigger value="anamnesis" className="text-xs">
            Anamnese Clínica
          </TabsTrigger>
          <TabsTrigger value="postural" className="text-xs">
            Avaliação Postural (4 Vistas)
          </TabsTrigger>
          <TabsTrigger value="reports" className="text-xs flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            <span>Laudos & Docs ({patientReports.length})</span>
          </TabsTrigger>
        </TabsList>

        {/* ABA 1: EVOLUÇÕES DIÁRIAS (SOAP) */}
        <TabsContent value="evolutions" className="space-y-6">
          <PainEvolutionChart
            points={painPoints}
            initialPain={currentRecord?.painScaleEva || 5}
            patientName={patient?.name}
          />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <span>Histórico Oficial de Atendimentos Fisioterapêuticos</span>
              </h3>
              <span className="text-[11px] text-muted-foreground">
                {evolutions.length} registro(s) autenticado(s)
              </span>
            </div>

            {evolutions.length === 0 ? (
              <Card className="p-12 text-center">
                <Activity className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-foreground">Nenhuma evolução registrada</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  Registre a conduta e resposta terapêutica de cada sessão no padrão oficial COFFITO SOAP.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEvolutionModalOpen(true)}
                  className="mt-4 gap-2 text-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Registrar Primeira Evolução</span>
                </Button>
              </Card>
            ) : (
              <div className="space-y-4">
                {evolutions.map((evo) => (
                  <Card
                    key={evo.id}
                    className="border-border hover:border-primary/40 transition-colors shadow-xs"
                  >
                    <CardHeader className="p-4 pb-3 bg-muted/20 border-b border-border flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="h-7 px-2.5 rounded-md bg-primary/10 text-primary font-bold text-xs flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{formatDateBR(evo.date)}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(evo.timestamp).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {evo.techniqueCategory && (
                          <Badge variant="secondary" className="text-[10px] font-semibold">
                            {evo.techniqueCategory}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {evo.painScaleAfter !== undefined && (
                          <span
                            className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${getEvaColor(
                              evo.painScaleAfter
                            )}`}
                          >
                            Dor pós: EVA {evo.painScaleAfter}/10
                          </span>
                        )}

                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                          <Lock className="h-3 w-3" />
                          <span>COFFITO Assinado</span>
                        </div>

                        <Badge variant="outline" className="text-[10px] font-mono">
                          {evo.crefito}
                        </Badge>

                        {/* Botões Editar / Excluir Evolução */}
                        <div className="flex items-center gap-1 pl-2 border-l border-border">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenEditEvolution(evo)}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                            title="Editar evolução SOAP"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeletingEvolution(evo)}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            title="Excluir evolução SOAP"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 space-y-3 text-xs">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="p-3 rounded-xl bg-background border border-border space-y-1">
                          <span className="font-bold text-primary uppercase text-[10px] tracking-wider block">
                            [S] Subjetivo (Relato do Paciente)
                          </span>
                          <p className="text-muted-foreground leading-relaxed">
                            {evo.subjective || "Sem queixas reportadas pelo paciente."}
                          </p>
                        </div>

                        <div className="p-3 rounded-xl bg-background border border-border space-y-1">
                          <span className="font-bold text-primary uppercase text-[10px] tracking-wider block">
                            [O] Objetivo (Exame Físico & Exercícios)
                          </span>
                          <p className="text-muted-foreground leading-relaxed">
                            {evo.objective || "Exercícios terapêuticos sem intercorrências."}
                          </p>
                        </div>

                        <div className="p-3 rounded-xl bg-background border border-border space-y-1">
                          <span className="font-bold text-primary uppercase text-[10px] tracking-wider block">
                            [A] Avaliação (Raciocínio Clínico)
                          </span>
                          <p className="text-muted-foreground leading-relaxed">
                            {evo.assessment || "Boa resposta motora e estabilização postural."}
                          </p>
                        </div>

                        <div className="p-3 rounded-xl bg-background border border-border space-y-1">
                          <span className="font-bold text-primary uppercase text-[10px] tracking-wider block">
                            [P] Plano Terapêutico & Conduta
                          </span>
                          <p className="text-muted-foreground leading-relaxed">
                            {evo.plan}
                          </p>
                        </div>
                      </div>

                      {evo.signatureHash && (
                        <div className="pt-2 flex items-center justify-between text-[10px] text-muted-foreground border-t border-border/60">
                          <span>Assinado por: <strong>{evo.professionalName}</strong> ({evo.crefito})</span>
                          <span className="font-mono text-muted-foreground/60">{evo.signatureHash}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ABA 2: ANAMNESE CLÍNICA */}
        <TabsContent value="anamnesis" className="space-y-6">
          <Card className="border-border shadow-xs">
            <CardHeader className="p-5 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                    <HeartPulse className="h-5 w-5 text-primary" />
                    <span>Ficha de Avaliação & Anamnese Fisioterapêutica</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Dados basais para acompanhamento longitudinal, metas clínicas e escala analógica visual de dor.
                  </CardDescription>
                </div>

                <Badge variant="outline" className="text-[10px] gap-1 font-mono">
                  <ShieldCheck className="h-3 w-3 text-emerald-600" />
                  <span>COFFITO Nº 414</span>
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-5 pt-2">
              <form onSubmit={handleSaveAnamnesis} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Queixa Principal (QP) *</label>
                  <Input
                    required
                    value={chiefComplaint}
                    onChange={(e) => setChiefComplaint(e.target.value)}
                    placeholder="Ex: Dor lombar ao permanecer em pé por mais de 20 minutos"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-foreground">
                    História da Moléstia Atual (HMA)
                  </label>
                  <textarea
                    rows={3}
                    value={hpi}
                    onChange={(e) => setHpi(e.target.value)}
                    placeholder="Mecanismo de lesão, tempo de evolução, fatores de piora e alívio..."
                    className="w-full rounded-xl border border-input bg-card p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="font-semibold text-foreground">Histórico Patológico Pregresso</label>
                    <textarea
                      rows={2}
                      value={medicalHistory}
                      onChange={(e) => setMedicalHistory(e.target.value)}
                      placeholder="Cirurgias prévias, comorbidades (DM, HAS), fraturas..."
                      className="w-full rounded-xl border border-input bg-card p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-foreground">Medicamentos em Uso</label>
                    <textarea
                      rows={2}
                      value={medications}
                      onChange={(e) => setMedications(e.target.value)}
                      placeholder="Analgésicos, relaxantes musculares, anti-hipertensivos..."
                      className="w-full rounded-xl border border-input bg-card p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                {/* Escala Analógica Visual (EVA) */}
                <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-foreground flex items-center gap-2 text-xs">
                      <Flame className="h-4 w-4 text-rose-500" />
                      <span>Intensidade Basal da Dor (Escala EVA de 0 a 10)</span>
                    </label>
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${getEvaColor(painScaleEva)}`}>
                      EVA {painScaleEva}/10
                    </span>
                  </div>

                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="1"
                    value={painScaleEva}
                    onChange={(e) => setPainScaleEva(Number(e.target.value))}
                    className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                  />

                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>0: Sem Dor</span>
                    <span>3: Leve</span>
                    <span>5: Moderada</span>
                    <span>7: Intensa</span>
                    <span>10: Pior Dor Possível</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Localização da Dor & Irradiação</label>
                  <Input
                    value={painLocation}
                    onChange={(e) => setPainLocation(e.target.value)}
                    placeholder="Ex: Coluna lombar L4-S1 com irradiação posterior da coxa direita"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Metas & Objetivos Terapêuticos</label>
                  <Input
                    value={clinicalGoals}
                    onChange={(e) => setClinicalGoals(e.target.value)}
                    placeholder="Ex: Retorno à prática esportiva, alívio da dor na flexão anterior, estabilidade do core"
                  />
                </div>

                {/* Botões de Ação na Anamnese */}
                <div className="pt-4 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDeletingRecordPatientId(selectedPatientId)}
                    className="text-xs text-destructive border-destructive/30 hover:bg-destructive/10 gap-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Excluir Prontuário deste Paciente</span>
                  </Button>

                  <Button type="submit" className="gap-2 font-semibold shadow-xs">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Salvar Anamnese & Avaliação Clínica</span>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA 3: AVALIAÇÃO POSTURAL COMPUTADORIZADA */}
        <TabsContent value="postural" className="space-y-6">
          <input
            type="file"
            ref={anteriorInputRef}
            className="hidden"
            accept="image/*"
            onChange={(e) => e.target.files?.[0] && handlePhotoUpload("anterior", e.target.files[0])}
          />
          <input
            type="file"
            ref={posteriorInputRef}
            className="hidden"
            accept="image/*"
            onChange={(e) => e.target.files?.[0] && handlePhotoUpload("posterior", e.target.files[0])}
          />
          <input
            type="file"
            ref={lateralRightInputRef}
            className="hidden"
            accept="image/*"
            onChange={(e) => e.target.files?.[0] && handlePhotoUpload("lateral_right", e.target.files[0])}
          />
          <input
            type="file"
            ref={lateralLeftInputRef}
            className="hidden"
            accept="image/*"
            onChange={(e) => e.target.files?.[0] && handlePhotoUpload("lateral_left", e.target.files[0])}
          />

          <Card className="border-border shadow-xs">
            <CardHeader className="p-5 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                    <Crosshair className="h-5 w-5 text-primary" />
                    <span>Biofotogrametria & Simetrografia Postural (4 Vistas)</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Avaliação postural computadorizada com malha milimetrada e cálculo de assimetrias.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-5 pt-2 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <PosturalCard
                  title="1. Vista Anterior"
                  subtitle="Alinhamento frontal e cintura escapular"
                  photoUrl={currentRecord?.anteriorPhotoUrl}
                  isUploading={isUploadingPhoto === "anterior"}
                  onUploadClick={() => anteriorInputRef.current?.click()}
                  onInspectClick={() => openBioModalFor("anterior")}
                />

                <PosturalCard
                  title="2. Vista Posterior"
                  subtitle="Escápulas e triângulo de tales"
                  photoUrl={currentRecord?.posteriorPhotoUrl}
                  isUploading={isUploadingPhoto === "posterior"}
                  onUploadClick={() => posteriorInputRef.current?.click()}
                  onInspectClick={() => openBioModalFor("posterior")}
                />

                <PosturalCard
                  title="3. Perfil Direito"
                  subtitle="Curvaturas sagitais D"
                  photoUrl={currentRecord?.lateralRightPhotoUrl ?? currentRecord?.lateralPhotoUrl}
                  isUploading={isUploadingPhoto === "lateral_right"}
                  onUploadClick={() => lateralRightInputRef.current?.click()}
                  onInspectClick={() => openBioModalFor("lateral_right")}
                />

                <PosturalCard
                  title="4. Perfil Esquerdo"
                  subtitle="Curvaturas sagitais E"
                  photoUrl={currentRecord?.lateralLeftPhotoUrl}
                  isUploading={isUploadingPhoto === "lateral_left"}
                  onUploadClick={() => lateralLeftInputRef.current?.click()}
                  onInspectClick={() => openBioModalFor("lateral_left")}
                />
              </div>

              <div className="space-y-1.5 pt-2">
                <label className="font-semibold text-foreground flex items-center gap-1.5">
                  <Sliders className="h-3.5 w-3.5 text-primary" />
                  <span>Laudo e Conclusões da Avaliação Postural</span>
                </label>
                <textarea
                  rows={3}
                  value={posturalNotes}
                  onChange={(e) => setPosturalNotes(e.target.value)}
                  placeholder="Ex: Assimetria escapular com elevação do acrômio direito em 1,5cm..."
                  className="w-full rounded-xl border border-input bg-card p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveAnamnesis} className="gap-2 font-semibold shadow-xs">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Salvar Dados Posturais</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA 4: LAUDOS CLÍNICOS E DOCUMENTOS OFICIAIS (CRUD COMPLETO) */}
        <TabsContent value="reports" className="space-y-4">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <span>Central de Laudos & Documentos Clínicos</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Histórico de laudos de evolução, relatórios periciais, atestados e termos salvos com rastreabilidade e assinatura digital COFFITO.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => handleOpenNewReport("report")}
                    size="sm"
                    className="gap-1.5 font-semibold text-xs shadow-xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Novo Laudo Clínico</span>
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-3 pt-0">
              {patientReports.length === 0 ? (
                <div className="p-12 text-center border border-dashed border-border rounded-xl space-y-3 bg-muted/10">
                  <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
                    <FileText className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-foreground">Nenhum laudo clínico emitido</h4>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                      Emita laudos de evolução, relatórios de alta ou atestados personalizados com carimbo CREFITO e código de autenticidade.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenNewReport("report")}
                    className="gap-1.5 text-xs font-semibold"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Emitir Primeiro Laudo</span>
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {patientReports.map((rep) => {
                    const isReport = rep.type === "report"
                    const isCert = rep.type === "certificate"
                    const isReceipt = rep.type === "receipt"

                    return (
                      <div
                        key={rep.id}
                        className="rounded-xl border border-border bg-card p-4 shadow-xs hover:border-primary/40 hover:shadow-md transition-all space-y-3 flex flex-col justify-between"
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-0.5 flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge
                                  variant="secondary"
                                  className={`text-[10px] font-semibold ${
                                    isReport
                                      ? "bg-primary/10 text-primary border-primary/20"
                                      : isCert
                                      ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20"
                                      : isReceipt
                                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                                      : "bg-muted text-muted-foreground"
                                  }`}
                                >
                                  {isReport
                                    ? "Laudo de Evolução"
                                    : isCert
                                    ? "Atestado / Declaração"
                                    : isReceipt
                                    ? "Recibo de Convênio"
                                    : "Termo TCLE"}
                                </Badge>
                                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  <span>{formatDateBR(rep.date)}</span>
                                </span>
                              </div>
                              <h4 className="text-sm font-bold text-foreground truncate mt-1">
                                {rep.title}
                              </h4>
                            </div>
                          </div>

                          <div className="text-xs text-muted-foreground space-y-1">
                            <p className="flex items-center gap-1.5 font-medium text-foreground/90 text-[11px]">
                              <HeartPulse className="h-3 w-3 text-primary shrink-0" />
                              <span>{rep.signedProfessionalName} • {rep.crefito}</span>
                            </p>

                            {isReport && (
                              <div className="space-y-1 pt-1 text-[11px]">
                                {rep.painScaleEva !== undefined && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-semibold text-foreground">Dor EVA:</span>
                                    <span className="text-amber-600 font-bold">{rep.painScaleEva}/10</span>
                                    {rep.painLocation && <span className="text-muted-foreground">({rep.painLocation})</span>}
                                  </div>
                                )}
                                {rep.chiefComplaint && (
                                  <p className="line-clamp-2 text-foreground/80">
                                    <span className="font-semibold text-foreground">Queixa:</span> {rep.chiefComplaint}
                                  </p>
                                )}
                                {rep.conclusion && (
                                  <p className="line-clamp-2 text-foreground/75 bg-muted/30 p-1.5 rounded text-[10px]">
                                    <span className="font-semibold text-foreground">Parecer:</span> {rep.conclusion}
                                  </p>
                                )}
                              </div>
                            )}

                            {isCert && (
                              <p className="text-[11px] text-foreground/80">
                                <span className="font-semibold text-foreground">Tipo:</span> {rep.purpose === "comparecimento" ? "Comparecimento" : rep.purpose === "repouso" ? "Repouso" : "Tratamento Contínuo"}
                                {rep.diagnosticCid && <span> • CID: {rep.diagnosticCid}</span>}
                              </p>
                            )}

                            {isReceipt && (
                              <p className="text-[11px] text-foreground/80">
                                <span className="font-semibold text-foreground">Valor:</span> R$ {rep.receiptAmount?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} • {rep.sessionsCount} sessões
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-2">
                          <span className="text-[9px] font-mono text-muted-foreground truncate max-w-[150px]">
                            {rep.documentHash}
                          </span>

                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditReport(rep)}
                              className="h-7 px-2 text-[11px] gap-1 text-primary hover:bg-primary/10 border-primary/20"
                              title="Editar conteúdo do laudo"
                            >
                              <Edit3 className="h-3 w-3" />
                              <span>Editar</span>
                            </Button>

                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedReportToEdit(rep)
                                setDocModalInitialType(rep.type)
                                setIsDocModalOpen(true)
                              }}
                              className="h-7 px-2 text-[11px] gap-1 text-foreground"
                              title="Visualizar e Imprimir Folha A4 em PDF"
                            >
                              <Printer className="h-3 w-3" />
                              <span>Imprimir</span>
                            </Button>

                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteReportClick(rep)}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              title="Excluir laudo"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* MODAL: NOVA EVOLUÇÃO SOAP */}
      <Dialog open={isEvolutionModalOpen} onOpenChange={setIsEvolutionModalOpen}>
        <DialogContent className="sm:max-w-2xl">
          <form onSubmit={handleAddEvolution}>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <DialogTitle>Nova Evolução Diária (SOAP)</DialogTitle>
                <Badge variant="outline" className="text-[10px] text-emerald-600 bg-emerald-500/10">
                  COFFITO Nº 414/2012
                </Badge>
              </div>
              <DialogDescription className="text-xs">
                Registro fisioterapêutico oficial com assinatura digital inalterável e carimbo CREFITO.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-3 text-xs max-h-[70vh] overflow-y-auto px-1">
              <div className="p-3 rounded-xl border border-primary/30 bg-primary/5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground text-[11px] flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    <span>Acelerador de Preenchimento (Templates Rápidos)</span>
                  </span>
                  <span className="text-[10px] text-muted-foreground">Clique para preencher a conduta</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => applySoapTemplate("pilates")}
                    className="p-2 rounded-lg border border-border bg-card hover:border-primary hover:bg-primary/5 text-left transition-colors"
                  >
                    <span className="font-bold text-foreground block text-[11px]">Studio Pilates</span>
                    <span className="text-[10px] text-muted-foreground block truncate">
                      Reformer, Cadillac, Core
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => applySoapTemplate("rpg")}
                    className="p-2 rounded-lg border border-border bg-card hover:border-primary hover:bg-primary/5 text-left transition-colors"
                  >
                    <span className="font-bold text-foreground block text-[11px]">RPG Souchard</span>
                    <span className="text-[10px] text-muted-foreground block truncate">
                      Postura rã, tração axial
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => applySoapTemplate("fisio")}
                    className="p-2 rounded-lg border border-border bg-card hover:border-primary hover:bg-primary/5 text-left transition-colors"
                  >
                    <span className="font-bold text-foreground block text-[11px]">Fisioterapia</span>
                    <span className="text-[10px] text-muted-foreground block truncate">
                      ADM, Cinesio, Crio
                    </span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Fisioterapeuta Responsável</label>
                  <Select
                    value={selectedProfId}
                    onChange={(e) => setSelectedProfId(e.target.value)}
                  >
                    {professionals.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.crefito})
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Modalidade Terapêutica</label>
                  <Input
                    value={techniqueCategory}
                    onChange={(e) => setTechniqueCategory(e.target.value)}
                    placeholder="Ex: Pilates Aparelhos, RPG, Fisioterapia..."
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-primary text-[11px] uppercase tracking-wider block">
                  [S] Subjetivo (Relato do Paciente) *
                </label>
                <textarea
                  required
                  rows={2}
                  value={subjective}
                  onChange={(e) => setSubjective(e.target.value)}
                  placeholder="Como o paciente refere estar hoje, relato de dores ou atividades recentes..."
                  className="w-full rounded-xl border border-input bg-card p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-primary text-[11px] uppercase tracking-wider block">
                  [O] Objetivo (Exercícios & Resposta)
                </label>
                <textarea
                  rows={3}
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  placeholder="Exercícios executados, cargas, aparelhos, testes e amplitude de movimento..."
                  className="w-full rounded-xl border border-input bg-card p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-primary text-[11px] uppercase tracking-wider block">
                  [A] Avaliação (Raciocínio Clínico)
                </label>
                <textarea
                  rows={2}
                  value={assessment}
                  onChange={(e) => setAssessment(e.target.value)}
                  placeholder="Resposta à intervenção, evolução em relação às sessões anteriores..."
                  className="w-full rounded-xl border border-input bg-card p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-primary text-[11px] uppercase tracking-wider block">
                  [P] Plano Terapêutico (Conduta Futura) *
                </label>
                <textarea
                  required
                  rows={2}
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  placeholder="Conduta planejada para a próxima sessão, progressão de carga ou exercícios domiciliares..."
                  className="w-full rounded-xl border border-input bg-card p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="p-3 rounded-xl border border-border bg-muted/20 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-foreground text-[11px]">
                    Escala de Dor Pós-Sessão (EVA)
                  </label>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${getEvaColor(painScaleAfter)}`}>
                    EVA {painScaleAfter}/10
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="1"
                  value={painScaleAfter}
                  onChange={(e) => setPainScaleAfter(Number(e.target.value))}
                  className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEvolutionModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Salvar e Assinar (COFFITO)</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: EDITAR EVOLUÇÃO SOAP */}
      <Dialog open={!!editingEvolution} onOpenChange={(open) => !open && setEditingEvolution(null)}>
        <DialogContent className="sm:max-w-2xl">
          <form onSubmit={handleSaveEditEvolution}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit2 className="h-5 w-5 text-primary" />
                <span>Editar Evolução Diária (SOAP)</span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Atualize o relato, condutas executadas ou reclassificação da dor.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 py-3 text-xs max-h-[70vh] overflow-y-auto px-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Data da Sessão</label>
                  <Input
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Modalidade</label>
                  <Input
                    value={editTechniqueCategory}
                    onChange={(e) => setEditTechniqueCategory(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-primary text-[11px] uppercase tracking-wider block">
                  [S] Subjetivo
                </label>
                <textarea
                  required
                  rows={2}
                  value={editSubjective}
                  onChange={(e) => setEditSubjective(e.target.value)}
                  className="w-full rounded-xl border border-input bg-card p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-primary text-[11px] uppercase tracking-wider block">
                  [O] Objetivo
                </label>
                <textarea
                  rows={3}
                  value={editObjective}
                  onChange={(e) => setEditObjective(e.target.value)}
                  className="w-full rounded-xl border border-input bg-card p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-primary text-[11px] uppercase tracking-wider block">
                  [A] Avaliação
                </label>
                <textarea
                  rows={2}
                  value={editAssessment}
                  onChange={(e) => setEditAssessment(e.target.value)}
                  className="w-full rounded-xl border border-input bg-card p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-primary text-[11px] uppercase tracking-wider block">
                  [P] Plano
                </label>
                <textarea
                  required
                  rows={2}
                  value={editPlan}
                  onChange={(e) => setEditPlan(e.target.value)}
                  className="w-full rounded-xl border border-input bg-card p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="p-3 rounded-xl border border-border bg-muted/20 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-foreground text-[11px]">
                    Escala de Dor Pós-Sessão (EVA)
                  </label>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${getEvaColor(editPainScaleAfter)}`}>
                    EVA {editPainScaleAfter}/10
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="1"
                  value={editPainScaleAfter}
                  onChange={(e) => setEditPainScaleAfter(Number(e.target.value))}
                  className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingEvolution(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmittingEditEvo}>
                {isSubmittingEditEvo ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: EXCLUIR EVOLUÇÃO SOAP */}
      <Dialog open={!!deletingEvolution} onOpenChange={(open) => !open && setDeletingEvolution(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="h-10 w-10 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-2">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <DialogTitle>Excluir Evolução SOAP</DialogTitle>
            <DialogDescription>
              Deseja realmente excluir a evolução do dia <strong>{formatDateBR(deletingEvolution?.date)}</strong>?
              Esta ação removerá este registro do prontuário do paciente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeletingEvolution(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDeleteEvolution}
              disabled={isDeletingEvo}
            >
              {isDeletingEvo ? "Excluindo..." : "Confirmar Exclusão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modais de Suporte Postural, Documentos e LGPD */}
      <BiofotogrametriaModal
        isOpen={isBioModalOpen}
        onClose={() => setIsBioModalOpen(false)}
        patientName={patient?.name || "Paciente"}
        initialView={bioModalView}
        photos={{
          anterior: currentRecord?.anteriorPhotoUrl,
          posterior: currentRecord?.posteriorPhotoUrl,
          lateralRight: currentRecord?.lateralRightPhotoUrl ?? currentRecord?.lateralPhotoUrl,
          lateralLeft: currentRecord?.lateralLeftPhotoUrl,
        }}
      />


      <DocumentGeneratorModal
        open={isDocModalOpen}
        onOpenChange={setIsDocModalOpen}
        patient={patient}
        clinicalRecord={currentRecord}
        evolutions={evolutions}
        professionals={professionals}
        currentProfessional={professionals.find((p) => p.id === selectedProfId) || professionals[0]}
        reportToEdit={selectedReportToEdit}
        initialDocType={docModalInitialType}
        onSaveReport={handleSaveReport}
      />

      {/* MODAL: CONFIRMAR EXCLUSÃO DE LAUDO CLÍNICO */}
      <Dialog open={isDeleteReportOpen} onOpenChange={setIsDeleteReportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="h-10 w-10 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-2">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <DialogTitle>Excluir Laudo Clínico</DialogTitle>
            <DialogDescription className="text-xs">
              Deseja realmente excluir permanentemente o laudo{" "}
              <strong>"{reportToDelete?.title}"</strong> emitido em{" "}
              {reportToDelete?.date ? formatDateBR(reportToDelete.date) : ""}? Esta ação removerá este documento oficial do histórico do paciente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteReportOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleConfirmDeleteReport}
              disabled={isDeletingReport}
            >
              {isDeletingReport ? "Excluindo..." : "Confirmar Exclusão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {patient && (
        <LgpdConsentModal
          open={isLgpdModalOpen}
          onOpenChange={setIsLgpdModalOpen}
          patient={patient}
          onSaveConsent={savePatientConsent}
        />
      )}

    </div>
  )
}

function PosturalCard({
  title,
  subtitle,
  photoUrl,
  isUploading,
  onUploadClick,
  onInspectClick,
}: {
  title: string
  subtitle: string
  photoUrl?: string
  isUploading: boolean
  onUploadClick: () => void
  onInspectClick: () => void
}) {
  return (
    <div className="border border-border rounded-xl p-3 flex flex-col justify-between bg-card hover:border-primary/50 transition-colors shadow-2xs">
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="font-bold text-foreground text-xs">{title}</span>
          <Badge variant={photoUrl ? "default" : "outline"} className="text-[9px]">
            {photoUrl ? "Fotografada" : "Pendente"}
          </Badge>
        </div>
        <span className="text-[10px] text-muted-foreground block mb-2">{subtitle}</span>

        <div className="h-44 rounded-lg bg-muted/40 border border-dashed border-border flex items-center justify-center overflow-hidden relative group">
          {photoUrl ? (
            <>
              <img
                src={photoUrl}
                alt={title}
                className="h-full w-full object-cover rounded-lg"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={onInspectClick}
                  className="h-8 text-xs gap-1"
                >
                  <Maximize2 className="h-3 w-3" />
                  <span>Simetrografia</span>
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center p-3">
              <Camera className="h-6 w-6 text-muted-foreground/40 mx-auto mb-1" />
              <span className="text-[11px] text-muted-foreground block">Sem foto cadastrada</span>
            </div>
          )}
        </div>
      </div>

      <div className="pt-2.5 flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={onUploadClick}
          disabled={isUploading}
          className="w-full text-xs gap-1.5 h-8 border-border"
        >
          <Upload className="h-3 w-3" />
          <span>{isUploading ? "Enviando..." : photoUrl ? "Substituir Foto" : "Carregar Foto"}</span>
        </Button>

        {photoUrl && (
          <Button
            size="sm"
            variant="outline"
            onClick={onInspectClick}
            className="text-xs h-8 px-2 border-primary/30 text-primary hover:bg-primary/10"
            title="Abrir biofotogrametria com malha"
          >
            <Crosshair className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  )
}
