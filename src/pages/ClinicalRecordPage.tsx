import React, { useState, useRef, useEffect } from "react"

import { useClinicData } from "@/contexts/ClinicDataContext"
import { useAuth } from "@/contexts/AuthContext"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
} from "lucide-react"
import { PainEvolutionChart } from "@/components/clinical/PainEvolutionChart"
import { BiofotogrametriaModal } from "@/components/clinical/BiofotogrametriaModal"
import { DocumentGeneratorModal } from "@/components/clinical/DocumentGeneratorModal"
import { LgpdConsentModal } from "@/components/clinical/LgpdConsentModal"
import type { PosturalViewType, ClinicalDocumentType } from "@/types"


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
    getClinicalRecord,
    saveClinicalRecord,
    getEvolutions,
    addSoapEvolution,
    uploadPosturalPhoto,
    getPainEvolutionHistory,
    logAuditAction,
    savePatientConsent,
  } = useClinicData()

  const [selectedPatientId, setSelectedPatientId] = useState(
    initialPatientId || patients[0]?.id || ""
  )
  const [activeTab, setActiveTab] = useState("evolutions")
  const [isEvolutionModalOpen, setIsEvolutionModalOpen] = useState(false)
  const [isDocModalOpen, setIsDocModalOpen] = useState(false)
  const [isLgpdModalOpen, setIsLgpdModalOpen] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState<string | null>(null)


  // Biofotogrametria Modal State
  const [isBioModalOpen, setIsBioModalOpen] = useState(false)
  const [bioModalView, setBioModalView] = useState<PosturalViewType>("anterior")

  // Refs para inputs de arquivos das 4 vistas
  const anteriorInputRef = useRef<HTMLInputElement>(null)
  const posteriorInputRef = useRef<HTMLInputElement>(null)
  const lateralRightInputRef = useRef<HTMLInputElement>(null)
  const lateralLeftInputRef = useRef<HTMLInputElement>(null)

  // SOAP Form State
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
    currentRecord?.posturalNotes || "Hiperlordose lombar, antepulsão de pelve e ombros protusos."
  )

  const patient = patients.find((p) => p.id === selectedPatientId)
  const evolutions = getEvolutions(selectedPatientId)
  const painPoints = getPainEvolutionHistory(selectedPatientId)

  // Registro automático de trilha de auditoria LGPD ao visualizar prontuário
  useEffect(() => {
    if (selectedPatientId && patient) {
      logAuditAction({
        action: "view_clinical_record",
        patientId: selectedPatientId,
        patientName: patient.name,
        details: `Acesso e consulta ao prontuário clínico e histórico SOAP de ${patient.name}`,
      })
    }
  }, [selectedPatientId, patient, logAuditAction])


  const handleDocumentPrinted = (docType: ClinicalDocumentType, title: string) => {
    if (patient) {
      logAuditAction({
        action: `export_pdf_${docType}`,
        patientId: selectedPatientId,
        patientName: patient.name,
        details: `Emissão e exportação do documento oficial: ${title}`,
      })
    }
  }

  // Atualização sincronizada ao trocar o paciente
  const handlePatientChange = (patientId: string) => {

    setSelectedPatientId(patientId)
    const rec = getClinicalRecord(patientId)
    if (rec) {
      setChiefComplaint(rec.chiefComplaint)
      setHpi(rec.hpi)
      setMedicalHistory(rec.medicalHistory)
      setMedications(rec.medications)
      setPainScaleEva(rec.painScaleEva)
      setPainLocation(rec.painLocation)
      setClinicalGoals(rec.clinicalGoals)
      setPosturalNotes(rec.posturalNotes || "")
    } else {
      setChiefComplaint("")
      setHpi("")
      setMedicalHistory("")
      setMedications("")
      setPainScaleEva(5)
      setPainLocation("")
      setClinicalGoals("")
      setPosturalNotes("")
    }
  }

  // Templates de Preenchimento Rápido (Acelerador de Produtividade do Fisioterapeuta)
  const applySoapTemplate = (type: "pilates" | "rpg" | "fisio") => {
    if (type === "pilates") {
      setTechniqueCategory("Pilates Aparelhos")
      setSubjective(
        "Paciente relata sensação de maior estabilidade lombar e disposição física geral. Sem dores incapacitantes recentes."
      )
      setObjective(
        "No Reformer: Footwork (4 molas) 3x10 reps, Bridging (3 molas) 3x10, Running (2 molas) 2x20. No Cadillac: Série de Tower com mola superior para descompressão da coluna 3x8. Na Chair: Pike prep para fortalecimento do powerhouse."
      )
      setAssessment(
        "Excelente ativação do transverso abdominal e controle pélvico neutro. Ausência de compensações na cintura escapular."
      )
      setPlan(
        "Progredir carga nas molas do Reformer e introduzir sequências unipodais na Chair na próxima aula."
      )
      setPainScaleAfter(1)
    } else if (type === "rpg") {
      setTechniqueCategory("RPG Souchard")
      setSubjective(
        "Queixa de rigidez torácica e cansaço postural na região cervical ao final do expediente de trabalho."
      )
      setObjective(
        "Postura rã no chão com braços abertos (cadeia mestra anterior). Tração cervical manual sustentada. Fechamento de ângulo coxofemoral sincronizado com respiração diafragmática e insistência expiratória máxima."
      )
      setAssessment(
        "Ganho de 2,5 cm de flexibilidade global. Relaxamento notável do tônus de trapézios superiores e esternocleidomastóideos."
      )
      setPlan(
        "Evoluir para postura rã no chão com braços fechados e orientar ergonomia do monitor e apoio lombar no trabalho."
      )
      setPainScaleAfter(2)
    } else {
      setTechniqueCategory("Fisioterapia Ortopédica")
      setSubjective(
        "Relata alívio substancial dos sintomas álgicos locais (EVA 2/10), com desconforto discreto apenas ao subir escadas."
      )
      setObjective(
        "Cinesioterapia ativa-resistida para quadríceps e estabilizadores de quadril com faixa elástica média. Treino proprioceptivo em prancha de equilíbrio monopodal. Crioterapia local por 15 min."
      )
      setAssessment(
        "Amplitude de movimento articular normalizada (ADM 125° de flexão). Boa resposta isométrica sem sinais inflamatórios."
      )
      setPlan(
        "Iniciar treinos funcionais de desaceleração e fortalecimento dinâmico em cadeia cinética fechada."
      )
      setPainScaleAfter(1)
    }
  }

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
    })

    setFeedback("Anamnese clínica e metas terapêuticas salvas com sucesso!")
    setTimeout(() => setFeedback(null), 3000)
  }

  const handleAddEvolution = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPatientId || !patient) return

    const prof = professionals.find((p) => p.id === selectedProfId) || professionals[0]

    addSoapEvolution({
      patientId: selectedPatientId,
      patientName: patient.name,
      professionalId: prof.id,
      professionalName: prof.name,
      crefito: prof.crefito,
      date: new Date().toISOString().split("T")[0],
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
    setFeedback("Evolução SOAP assinada digitalmente com registro COFFITO!")
    setTimeout(() => setFeedback(null), 3500)
  }

  // Upload de Foto Postural com Convex Storage
  const handlePhotoUpload = async (
    viewType: PosturalViewType,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0]
    if (!file || !selectedPatientId) return

    setIsUploadingPhoto(viewType)
    try {
      await uploadPosturalPhoto(selectedPatientId, viewType, file)
      setFeedback("Foto anexada com sucesso!")
      setTimeout(() => setFeedback(null), 3000)
    } catch (err) {
      setFeedback("Erro ao realizar upload da imagem postural.")
      setTimeout(() => setFeedback(null), 3000)
    } finally {
      setIsUploadingPhoto(null)
      e.target.value = ""
    }
  }

  const openBioModalFor = (view: PosturalViewType) => {
    setBioModalView(view)
    setIsBioModalOpen(true)
  }

  // Cores da Escala Analógica Visual (EVA)
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

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Toast Feedback */}
      {feedback && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm font-medium animate-fade-in">
          <CheckCircle2 className="h-4 w-4" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Header & Seletor de Paciente */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <FileText className="h-6 w-6 text-primary" />
            <span>Prontuário Eletrônico & Biofotogrametria</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Conformidade integral com os padrões éticos e legais do COFFITO: registro SOAP inalterável, carimbo CREFITO e avaliação postural computadorizada.
          </p>
        </div>

        {/* Seletor Rápido de Paciente */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">Paciente:</span>
          <select
            value={selectedPatientId}
            onChange={(e) => handlePatientChange(e.target.value)}
            className="h-10 rounded-xl border border-input bg-card px-3 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-xs min-w-[220px]"
          >
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
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
                  <span>Nasc: {patient.birthDate}</span>
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
                onClick={() => setIsDocModalOpen(true)}
                className="gap-1.5 text-xs font-semibold shadow-xs"
              >
                <FileText className="h-3.5 w-3.5 text-primary" />
                <span>Emitir PDF</span>
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
        <TabsList className="grid grid-cols-3 max-w-md w-full">
          <TabsTrigger value="evolutions" className="text-xs">
            Evoluções SOAP ({evolutions.length})
          </TabsTrigger>
          <TabsTrigger value="anamnesis" className="text-xs">
            Anamnese Clínica
          </TabsTrigger>
          <TabsTrigger value="postural" className="text-xs">
            Avaliação Postural (4 Vistas)
          </TabsTrigger>
        </TabsList>

        {/* ========================================================================= */}
        {/* ABA 1: EVOLUÇÕES DIÁRIAS (SOAP) & GRÁFICO HISTÓRICO EVA                   */}
        {/* ========================================================================= */}
        <TabsContent value="evolutions" className="space-y-6">
          {/* Gráfico Histórico Interativo da Dor EVA */}
          <PainEvolutionChart
            points={painPoints}
            initialPain={currentRecord?.painScaleEva || 5}
            patientName={patient?.name}
          />

          {/* Lista de Registros SOAP */}
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
                          <span>{evo.date}</span>
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
                            Dor pós-sessão: EVA {evo.painScaleAfter}/10
                          </span>
                        )}

                        {/* Selo de Imutabilidade COFFITO */}
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                          <Lock className="h-3 w-3" />
                          <span>COFFITO Assinado</span>
                        </div>

                        <Badge variant="outline" className="text-[10px] font-mono">
                          {evo.crefito}
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 space-y-3 text-xs">
                      {/* Grid SOAP de 4 quadrantes */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="p-3 rounded-xl bg-card border border-border/70 space-y-1">
                          <span className="font-bold text-primary flex items-center gap-1 text-[11px] uppercase tracking-wide">
                            [S] Subjetivo (Queixa & Relato)
                          </span>
                          <p className="text-foreground leading-relaxed">{evo.subjective}</p>
                        </div>

                        <div className="p-3 rounded-xl bg-card border border-border/70 space-y-1">
                          <span className="font-bold text-primary flex items-center gap-1 text-[11px] uppercase tracking-wide">
                            [O] Objetivo (Conduta, Aparelhos & Cargas)
                          </span>
                          <p className="text-foreground leading-relaxed">{evo.objective}</p>
                        </div>

                        <div className="p-3 rounded-xl bg-card border border-border/70 space-y-1">
                          <span className="font-bold text-primary flex items-center gap-1 text-[11px] uppercase tracking-wide">
                            [A] Avaliação (Resposta Terapêutica)
                          </span>
                          <p className="text-foreground leading-relaxed">{evo.assessment}</p>
                        </div>

                        <div className="p-3 rounded-xl bg-card border border-border/70 space-y-1">
                          <span className="font-bold text-primary flex items-center gap-1 text-[11px] uppercase tracking-wide">
                            [P] Plano (Próximos Passos)
                          </span>
                          <p className="text-foreground leading-relaxed">{evo.plan}</p>
                        </div>
                      </div>

                      {/* Assinatura Digital & Carimbo Técnico CREFITO */}
                      <div className="pt-2.5 border-t border-border flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1.5 font-medium text-foreground">
                          <Award className="h-3.5 w-3.5 text-primary" />
                          Responsável Técnico: <strong>{evo.professionalName}</strong>
                        </span>
                        <div className="flex items-center gap-3">
                          {evo.signatureHash && (
                            <span className="font-mono text-[9px] text-muted-foreground/80">
                              Hash: {evo.signatureHash}
                            </span>
                          )}
                          <span className="font-mono text-[10px] font-semibold text-primary">
                            {evo.crefito}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ========================================================================= */}
        {/* ABA 2: ANAMNESE CLÍNICA & ESCALA EVA                                       */}
        {/* ========================================================================= */}
        <TabsContent value="anamnesis">
          <Card>
            <form onSubmit={handleSaveAnamnesis}>
              <CardHeader className="p-5 pb-3 border-b border-border/60">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <HeartPulse className="h-4 w-4 text-primary" />
                  <span>Ficha de Anamnese & Avaliação Funcional Especializada</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Registro inicial da queixa, sintomas, medicações e metas terapêuticas.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-5 space-y-4 text-xs">
                {/* Régua EVA de Dor */}
                <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="font-bold uppercase tracking-wider text-[11px] text-foreground flex items-center gap-2">
                      <Flame className="h-4 w-4 text-rose-500" />
                      <span>Escala Analógica Visual de Dor Inicial (EVA)</span>
                    </label>
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full border font-bold ${getEvaColor(
                        painScaleEva
                      )}`}
                    >
                      Nível {painScaleEva} / 10
                    </span>
                  </div>

                  <input
                    type="range"
                    min={0}
                    max={10}
                    value={painScaleEva}
                    onChange={(e) => setPainScaleEva(Number(e.target.value))}
                    className="w-full accent-primary h-2 cursor-pointer"
                  />

                  <div className="flex justify-between text-[10px] text-muted-foreground font-medium px-1">
                    <span>0: Sem dor</span>
                    <span>3: Leve</span>
                    <span>5: Moderada</span>
                    <span>8: Intensa</span>
                    <span>10: Insuportável</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="font-semibold text-foreground">Queixa Principal (QP)</label>
                    <Input
                      value={chiefComplaint}
                      onChange={(e) => setChiefComplaint(e.target.value)}
                      placeholder="Ex: Dor lombar ao permanecer em pé..."
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-foreground">Localização da Dor</label>
                    <Input
                      value={painLocation}
                      onChange={(e) => setPainLocation(e.target.value)}
                      placeholder="Ex: Região lombar baixa L4-L5..."
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-foreground">História da Moléstia Atual (HMA)</label>
                  <textarea
                    rows={2}
                    value={hpi}
                    onChange={(e) => setHpi(e.target.value)}
                    placeholder="Histórico detalhado do início dos sintomas..."
                    className="w-full rounded-xl border border-input bg-card p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="font-semibold text-foreground">Histórico Pregresso / Cirurgias</label>
                    <Input
                      value={medicalHistory}
                      onChange={(e) => setMedicalHistory(e.target.value)}
                      placeholder="Ex: Fraturas, próteses, patologias prévias..."
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-foreground">Medicamentos em Uso</label>
                    <Input
                      value={medications}
                      onChange={(e) => setMedications(e.target.value)}
                      placeholder="Ex: Anti-inflamatórios, relaxante muscular..."
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Metas & Objetivos Terapêuticos</label>
                  <textarea
                    rows={2}
                    value={clinicalGoals}
                    onChange={(e) => setClinicalGoals(e.target.value)}
                    placeholder="Ex: Retorno à corrida sem dor em 6 semanas, ganho de 20° de ADM..."
                    className="w-full rounded-xl border border-input bg-card p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <Button type="submit" className="gap-2 font-semibold">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Salvar Anamnese Clínica</span>
                  </Button>
                </div>
              </CardContent>
            </form>
          </Card>
        </TabsContent>

        {/* ========================================================================= */}
        {/* ABA 3: AVALIAÇÃO POSTURAL & BIOFOTOGRAMETRIA (4 VISTAS)                    */}
        {/* ========================================================================= */}
        <TabsContent value="postural" className="space-y-4">
          <Card>
            <CardHeader className="p-5 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Crosshair className="h-4 w-4 text-primary" />
                  <span>Biofotogrametria Postural Computorizada (4 Vistas)</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Inspeção postural em Vista Anterior, Posterior, Perfil Direito e Perfil Esquerdo com grade quadriculada e eixos de prumo.
                </CardDescription>
              </div>

              <Button
                onClick={() => {
                  setBioModalView("anterior")
                  setIsBioModalOpen(true)
                }}
                className="gap-1.5 font-semibold text-xs shadow-xs self-start sm:self-auto"
              >
                <Maximize2 className="h-3.5 w-3.5" />
                <span>Abrir Espelho Biofotogramétrico</span>
              </Button>
            </CardHeader>

            <CardContent className="p-5 space-y-6 text-xs">
              {/* Inputs Ocultos de Arquivo para as 4 Vistas */}
              <input
                ref={anteriorInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handlePhotoUpload("anterior", e)}
              />
              <input
                ref={posteriorInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handlePhotoUpload("posterior", e)}
              />
              <input
                ref={lateralRightInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handlePhotoUpload("lateral_right", e)}
              />
              <input
                ref={lateralLeftInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handlePhotoUpload("lateral_left", e)}
              />

              {/* Grid das 4 Vistas Fotográficas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Vista Anterior */}
                <PosturalCard
                  title="1. Vista Anterior"
                  subtitle="Ombros, cristas e pés"
                  photoUrl={currentRecord?.anteriorPhotoUrl}
                  isUploading={isUploadingPhoto === "anterior"}
                  onUploadClick={() => anteriorInputRef.current?.click()}
                  onInspectClick={() => openBioModalFor("anterior")}
                />

                {/* 2. Vista Posterior */}
                <PosturalCard
                  title="2. Vista Posterior"
                  subtitle="Escápulas e triângulo de tales"
                  photoUrl={currentRecord?.posteriorPhotoUrl}
                  isUploading={isUploadingPhoto === "posterior"}
                  onUploadClick={() => posteriorInputRef.current?.click()}
                  onInspectClick={() => openBioModalFor("posterior")}
                />

                {/* 3. Perfil Direito */}
                <PosturalCard
                  title="3. Perfil Direito"
                  subtitle="Curvaturas sagitais D"
                  photoUrl={currentRecord?.lateralRightPhotoUrl ?? currentRecord?.lateralPhotoUrl}
                  isUploading={isUploadingPhoto === "lateral_right"}
                  onUploadClick={() => lateralRightInputRef.current?.click()}
                  onInspectClick={() => openBioModalFor("lateral_right")}
                />

                {/* 4. Perfil Esquerdo */}
                <PosturalCard
                  title="4. Perfil Esquerdo"
                  subtitle="Curvaturas sagitais E"
                  photoUrl={currentRecord?.lateralLeftPhotoUrl}
                  isUploading={isUploadingPhoto === "lateral_left"}
                  onUploadClick={() => lateralLeftInputRef.current?.click()}
                  onInspectClick={() => openBioModalFor("lateral_left")}
                />
              </div>

              {/* Observações Biomecânicas e Diagnóstico */}
              <div className="space-y-1.5 pt-2">
                <label className="font-semibold text-foreground flex items-center gap-1.5">
                  <Sliders className="h-3.5 w-3.5 text-primary" />
                  <span>Laudo e Conclusões da Avaliação Postural</span>
                </label>
                <textarea
                  rows={3}
                  value={posturalNotes}
                  onChange={(e) => setPosturalNotes(e.target.value)}
                  placeholder="Ex: Assimetria escapular com elevação do acrômio direito em 1,5cm; antepulsão de cabeça e retificação lombar..."
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
      </Tabs>

      {/* Modal Nova Evolução Diária SOAP */}
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
              {/* Botões de Preenchimento Rápido / Templates */}
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

              {/* Fisioterapeuta Responsável & Modalidade */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Fisioterapeuta Responsável</label>
                  <select
                    value={selectedProfId}
                    onChange={(e) => setSelectedProfId(e.target.value)}
                    className="w-full h-10 rounded-xl border border-input bg-card px-3 text-xs"
                  >
                    {professionals.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.crefito})
                      </option>
                    ))}
                  </select>
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

              {/* [S] Subjetivo */}
              <div className="space-y-1">
                <label className="font-semibold text-primary text-[11px] uppercase tracking-wider block">
                  [S] Subjetivo (Relato de Dores e Percepção do Paciente)
                </label>
                <textarea
                  required
                  rows={2}
                  value={subjective}
                  onChange={(e) => setSubjective(e.target.value)}
                  placeholder="Ex: Paciente relata menor sensação de rigidez matinal e caminhou sem queixas..."
                  className="w-full rounded-xl border border-input bg-card p-2 text-xs"
                />
              </div>

              {/* [O] Objetivo */}
              <div className="space-y-1">
                <label className="font-semibold text-primary text-[11px] uppercase tracking-wider block">
                  [O] Objetivo (Conduta, Exercícios, Aparelhos, Molas & Cargas)
                </label>
                <textarea
                  required
                  rows={2}
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  placeholder="Ex: Reformer: Footwork 4 molas, Running, Eve's Lunge com 1 mola azul..."
                  className="w-full rounded-xl border border-input bg-card p-2 text-xs"
                />
              </div>

              {/* [A] Avaliação */}
              <div className="space-y-1">
                <label className="font-semibold text-primary text-[11px] uppercase tracking-wider block">
                  [A] Avaliação (Resposta Mecânica & Estabilidade)
                </label>
                <textarea
                  required
                  rows={2}
                  value={assessment}
                  onChange={(e) => setAssessment(e.target.value)}
                  placeholder="Ex: Boa tolerância aos exercícios sem queixa álgica imediata. Movimento fluido..."
                  className="w-full rounded-xl border border-input bg-card p-2 text-xs"
                />
              </div>

              {/* [P] Plano */}
              <div className="space-y-1">
                <label className="font-semibold text-primary text-[11px] uppercase tracking-wider block">
                  [P] Plano (Planejamento para a Próxima Sessão & Recomendações)
                </label>
                <textarea
                  required
                  rows={2}
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  placeholder="Ex: Progredir para agachamento unipodal e orientar pausas ergonômicas..."
                  className="w-full rounded-xl border border-input bg-card p-2 text-xs"
                />
              </div>

              {/* Dor Pós-Sessão (EVA) */}
              <div className="p-3 rounded-xl border border-border bg-muted/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground text-[11px]">
                    Dor ao Final da Sessão (Escala EVA: 0 a 10)
                  </span>
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full border font-bold ${getEvaColor(
                      painScaleAfter
                    )}`}
                  >
                    Nível {painScaleAfter} / 10
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={10}
                  value={painScaleAfter}
                  onChange={(e) => setPainScaleAfter(Number(e.target.value))}
                  className="w-full accent-primary h-1.5 cursor-pointer"
                />
              </div>

              {/* Aviso de Imutabilidade COFFITO */}
              <div className="p-2.5 rounded-xl bg-muted/40 border border-border/80 flex items-center gap-2 text-[11px] text-muted-foreground">
                <Lock className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>
                  Ao salvar, este registro receberá carimbo CREFITO e será gravado de forma{" "}
                  <strong className="text-foreground">inalterável</strong> no prontuário do paciente.
                </span>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEvolutionModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="gap-2 font-semibold">
                <Check className="h-4 w-4" />
                <span>Assinar Digitalmente (COFFITO)</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Biofotogrametria Computorizada com Grade e Eixos de Prumo */}
      {isBioModalOpen && (
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
          initialNotes={posturalNotes}
          onSaveNotes={(newNotes) => {
            setPosturalNotes(newNotes)
            if (selectedPatientId) {
              saveClinicalRecord({
                patientId: selectedPatientId,
                chiefComplaint,
                hpi,
                medicalHistory,
                medications,
                painScaleEva,
                painLocation,
                clinicalGoals,
                posturalNotes: newNotes,
                updatedAt: Date.now(),
              })
              setFeedback("Laudo de biofotogrametria salvo!")
              setTimeout(() => setFeedback(null), 3000)
            }
          }}
        />
      )}

      {/* Modal de Emissão de Documentos Oficiais em PDF (Atestados, Recibos, TCLE, Laudo) */}
      <DocumentGeneratorModal
        open={isDocModalOpen}
        onOpenChange={setIsDocModalOpen}
        patient={patient}
        professionals={professionals}
        currentProfessional={professionals.find((p) => p.id === user?.professionalId)}
        clinicalRecord={currentRecord}
        evolutions={evolutions}
        onDocumentPrinted={handleDocumentPrinted}
      />

      {/* Modal de Gestão de Termos de Consentimento e Privacidade LGPD */}
      <LgpdConsentModal
        open={isLgpdModalOpen}
        onOpenChange={setIsLgpdModalOpen}
        patient={patient}
        onSaveConsent={savePatientConsent}
      />
    </div>
  )
}


const PosturalCard: React.FC<{
  title: string
  subtitle: string
  photoUrl?: string
  isUploading: boolean
  onUploadClick: () => void
  onInspectClick: () => void
}> = (props) => {
  return (
    <div className="p-3.5 rounded-2xl border border-border bg-card hover:border-primary/40 transition-all space-y-3 flex flex-col justify-between shadow-xs">
      <div>
        <div className="flex items-center justify-between gap-1 mb-1">
          <span className="font-bold text-foreground text-xs">{props.title}</span>
          {props.photoUrl ? (
            <Badge variant="outline" className="text-[9px] text-emerald-600 bg-emerald-500/10">
              Anexada
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[9px] text-muted-foreground">
              Pendente
            </Badge>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground">{props.subtitle}</p>
      </div>

      {/* Área da Imagem / Thumbnail */}
      <div className="relative aspect-3/4 rounded-xl border border-border/80 bg-muted/20 overflow-hidden flex items-center justify-center group">
        {props.photoUrl ? (
          <>
            <img
              src={props.photoUrl}
              alt={props.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            />
            {/* Overlay com Botão de Inspeção com Grade */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
              <Button
                size="sm"
                onClick={props.onInspectClick}
                className="h-8 gap-1.5 text-xs font-semibold shadow-md w-full"
              >
                <Crosshair className="h-3.5 w-3.5" />
                <span>Inspecionar Grade</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={props.onUploadClick}
                disabled={props.isUploading}
                className="h-7 text-[11px] bg-white/10 text-white hover:bg-white/20 border-white/20 w-full"
              >
                <Upload className="h-3 w-3 mr-1" />
                <span>Trocar Foto</span>
              </Button>
            </div>
          </>
        ) : (
          <div className="text-center p-3 space-y-2">
            <div className="h-10 w-10 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
              <ImageIcon className="h-5 w-5" />
            </div>
            <p className="text-[10px] text-muted-foreground">Nenhuma imagem enviada</p>
          </div>
        )}

        {props.isUploading && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
            <span className="text-xs font-semibold animate-pulse text-primary">Enviando...</span>
          </div>
        )}
      </div>

      {/* Ações do Card */}
      <div className="flex items-center gap-1.5">
        {props.photoUrl ? (
          <Button
            variant="outline"
            size="sm"
            onClick={props.onInspectClick}
            className="w-full text-xs gap-1.5 h-8 font-semibold"
          >
            <Crosshair className="h-3.5 w-3.5 text-primary" />
            <span>Biofotogrametria</span>
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={props.onUploadClick}
            disabled={props.isUploading}
            className="w-full text-xs gap-1.5 h-8 font-semibold"
          >
            <Camera className="h-3.5 w-3.5 text-primary" />
            <span>Anexar Foto</span>
          </Button>
        )}
      </div>
    </div>
  )
}
