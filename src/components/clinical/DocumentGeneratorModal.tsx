import React, { useState, useMemo, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select } from "@/components/ui/select-native"
import { useTheme } from "@/contexts/ThemeContext"
import { formatDateExtendedBR, formatDateBR, getTodayDateString } from "@/lib/dateUtils"
import {
  FileText,
  Printer,
  Copy,
  Check,
  ShieldCheck,
  Award,
  HeartPulse,
  Receipt,
  FileCheck2,
  Sparkles,
  Save,
  CheckCircle2,
  RotateCcw,
  Sliders,
  Stethoscope,
  Clock,
  Activity,
  Edit3,
} from "lucide-react"
import type {
  Patient,
  Professional,
  ClinicalRecord,
  ClinicalEvolution,
  ClinicalDocumentType,
  ClinicalReport,
} from "@/types"

export interface DocumentGeneratorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  patient?: Patient
  professionals: Professional[]
  currentProfessional?: Professional
  clinicalRecord?: ClinicalRecord | null
  evolutions?: ClinicalEvolution[]
  reportToEdit?: ClinicalReport | null
  initialDocType?: ClinicalDocumentType
  onDocumentPrinted?: (docType: ClinicalDocumentType, title: string) => void
  onSaveReport?: (reportData: {
    id?: string
    patientId: string
    professionalId: string
    type: ClinicalDocumentType
    title: string
    date: string
    chiefComplaint?: string
    painScaleEva?: number
    painLocation?: string
    hpi?: string
    clinicalGoals?: string
    diagnosticCid?: string
    evolutionSummary?: string
    conclusion?: string
    customNotes?: string
    purpose?: string
    receiptAmount?: number
    sessionsCount?: number
    paymentMethod?: string
    serviceDescription?: string
    documentHash?: string
  }) => Promise<any> | void
}

export const DocumentGeneratorModal: React.FC<DocumentGeneratorModalProps> = ({
  open,
  onOpenChange,
  patient,
  professionals,
  currentProfessional,
  clinicalRecord,
  evolutions = [],
  reportToEdit,
  initialDocType,
  onDocumentPrinted,
  onSaveReport,
}) => {
  const { theme } = useTheme()
  const [selectedDocType, setSelectedDocType] = useState<ClinicalDocumentType>("report")
  const [selectedProfId, setSelectedProfId] = useState<string>(
    currentProfessional?.id || professionals[0]?.id || ""
  )
  const [copied, setCopied] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Campos customizáveis para o Atestado / Declaração
  const [sessionDate, setSessionDate] = useState<string>(getTodayDateString())
  const [startTime, setStartTime] = useState("08:00")
  const [endTime, setEndTime] = useState("09:00")
  const [specialty, setSpecialty] = useState("Pilates Clínico & Reabilitação Funcional")
  const [purpose, setPurpose] = useState<"comparecimento" | "tratamento_continuo" | "repouso">(
    "comparecimento"
  )
  const [cidCode, setCidCode] = useState("M54.5 (Dor lombar baixa)")
  const [restDays, setRestDays] = useState("1")
  const [customNotes, setCustomNotes] = useState(
    "Paciente encontra-se em programa ativo de cinesioterapia com boa tolerância aos exercícios."
  )

  // Campos customizáveis para o Termo TCLE & LGPD
  const [tcleDate, setTcleDate] = useState<string>(getTodayDateString())
  const [tcleHasRepresentative, setTcleHasRepresentative] = useState(false)
  const [tcleRepresentativeName, setTcleRepresentativeName] = useState("")
  const [tcleRepresentativeCpf, setTcleRepresentativeCpf] = useState("")
  const [tcleRepresentativeKinship, setTcleRepresentativeKinship] = useState("Mãe / Responsável Legal")
  const [tcleIncludeBiofoto, setTcleIncludeBiofoto] = useState(true)
  const [tcleIncludeScientific, setTcleIncludeScientific] = useState(false)
  const [tcleCustomNotes, setTcleCustomNotes] = useState("")

  // Campos customizáveis para o Recibo de Reembolso
  const [receiptAmount, setReceiptAmount] = useState<number>(380)
  const [sessionsCount, setSessionsCount] = useState<number>(4)
  const [paymentMethodText, setPaymentMethodText] = useState("PIX")
  const [serviceDescription, setServiceDescription] = useState(
    "Sessões de Fisioterapia Traumato-Ortopédica e Reabilitação Postural"
  )

  // Campos customizáveis para o Laudo de Evolução Clínica (CRUD Completo)
  const [reportTitle, setReportTitle] = useState("Laudo de Evolução Clínica e Biomecânica")
  const [reportDate, setReportDate] = useState<string>(getTodayDateString())
  const [reportChiefComplaint, setReportChiefComplaint] = useState("")
  const [reportPainScaleEva, setReportPainScaleEva] = useState<number>(5)
  const [reportPainLocation, setReportPainLocation] = useState("")
  const [reportHpi, setReportHpi] = useState("")
  const [reportClinicalGoals, setReportClinicalGoals] = useState("")
  const [reportDiagnosticCid, setReportDiagnosticCid] = useState("M54.5 (Dor lombar baixa)")
  const [reportIncludeEvolutionsCount, setReportIncludeEvolutionsCount] = useState<number>(3)
  const [reportEvolutionSummary, setReportEvolutionSummary] = useState("")
  const [reportConclusion, setReportConclusion] = useState("")

  const activeProf =
    professionals.find((p) => p.id === selectedProfId) || currentProfessional || professionals[0]

  // Sincronização inicial e recarregamento quando reportToEdit muda
  useEffect(() => {
    if (open) {
      setSaveSuccess(false)
      if (reportToEdit) {
        setSelectedDocType(reportToEdit.type || "report")
        setSelectedProfId(reportToEdit.professionalId || currentProfessional?.id || professionals[0]?.id || "")
        setReportTitle(reportToEdit.title || "Laudo de Evolução Clínica e Biomecânica")
        setReportDate(reportToEdit.date || getTodayDateString())
        setReportChiefComplaint(reportToEdit.chiefComplaint || clinicalRecord?.chiefComplaint || "")
        setReportPainScaleEva(reportToEdit.painScaleEva ?? clinicalRecord?.painScaleEva ?? 5)
        setReportPainLocation(reportToEdit.painLocation || clinicalRecord?.painLocation || "")
        setReportHpi(reportToEdit.hpi || clinicalRecord?.hpi || "")
        setReportClinicalGoals(reportToEdit.clinicalGoals || clinicalRecord?.clinicalGoals || "")
        setReportDiagnosticCid(reportToEdit.diagnosticCid || "M54.5 (Dor lombar baixa)")
        setReportEvolutionSummary(reportToEdit.evolutionSummary || "")
        setReportConclusion(
          reportToEdit.conclusion ||
            "Paciente apresenta boa resposta terapêutica e tolerância aos exercícios fisioterapêuticos. Recomenda-se a continuidade do plano de tratamento."
        )
        if (reportToEdit.customNotes) setCustomNotes(reportToEdit.customNotes)
        if (reportToEdit.receiptAmount) setReceiptAmount(reportToEdit.receiptAmount)
        if (reportToEdit.sessionsCount) setSessionsCount(reportToEdit.sessionsCount)
        if (reportToEdit.paymentMethod) setPaymentMethodText(reportToEdit.paymentMethod)
        if (reportToEdit.serviceDescription) setServiceDescription(reportToEdit.serviceDescription)
        if (reportToEdit.purpose) setPurpose(reportToEdit.purpose as any)
        if (reportToEdit.type === "tcle" && reportToEdit.customNotes) {
          setTcleCustomNotes(reportToEdit.customNotes)
        }
      } else {
        if (initialDocType) {
          setSelectedDocType(initialDocType)
        }
        setTcleDate(getTodayDateString())
        setTcleHasRepresentative(false)
        setTcleRepresentativeName("")
        setTcleRepresentativeCpf("")
        setTcleIncludeBiofoto(true)
        setTcleIncludeScientific(false)
        setTcleCustomNotes("")
        setReportTitle("Laudo de Evolução Clínica e Biomecânica")
        setReportDate(getTodayDateString())
        setReportChiefComplaint(clinicalRecord?.chiefComplaint || "Lombalgia e tensão postural.")
        setReportPainScaleEva(clinicalRecord?.painScaleEva ?? 5)
        setReportPainLocation(clinicalRecord?.painLocation || "Lombar")
        setReportHpi(
          clinicalRecord?.hpi ||
            "Quadro com início insidioso relacionado a posturas mantidas no trabalho de escritório."
        )
        setReportClinicalGoals(
          clinicalRecord?.clinicalGoals ||
            "Estabilização segmentar vertebral e melhora da flexibilidade global da cadeia posterior."
        )
        setReportDiagnosticCid("M54.5 (Dor lombar baixa)")
        setReportEvolutionSummary("")
        setReportConclusion(
          "Paciente apresenta boa resposta terapêutica e tolerância aos exercícios prescritos. Observa-se redução progressiva do quadro álgico e melhora nos padrões de recrutamento motor lombo-pélvico. Recomenda-se a manutenção do protocolo por mais 8 semanas."
        )
        setReportIncludeEvolutionsCount(3)
      }
    }
  }, [open, reportToEdit, initialDocType, clinicalRecord, currentProfessional, professionals])

  // Função para redefinir campos do laudo com base na anamnese atual
  const handleResetToAnamnesis = () => {
    setReportTitle("Laudo de Evolução Clínica e Biomecânica")
    setReportChiefComplaint(clinicalRecord?.chiefComplaint || "Lombalgia e tensão postural.")
    setReportPainScaleEva(clinicalRecord?.painScaleEva ?? 5)
    setReportPainLocation(clinicalRecord?.painLocation || "Lombar")
    setReportHpi(
      clinicalRecord?.hpi ||
        "Quadro com início insidioso relacionado a posturas mantidas no trabalho."
    )
    setReportClinicalGoals(
      clinicalRecord?.clinicalGoals ||
        "Estabilização segmentar vertebral e melhora da flexibilidade global."
    )
    setReportDiagnosticCid("M54.5 (Dor lombar baixa)")
    setReportEvolutionSummary("")
    setReportConclusion(
      "Paciente apresenta boa resposta terapêutica e tolerância aos exercícios prescritos. Recomenda-se a continuidade do tratamento para consolidação dos ganhos funcionais."
    )
    setReportIncludeEvolutionsCount(3)
  }

  const docHash = useMemo(() => {
    if (reportToEdit?.documentHash) return reportToEdit.documentHash
    const cleanCrefito = activeProf?.crefito ? activeProf.crefito.replace(/[^A-Za-z0-9]/g, "") : "CREFITO"
    return `COFFITO-${cleanCrefito}-${Date.now().toString(36).toUpperCase()}`
  }, [activeProf?.crefito, selectedDocType, reportToEdit?.documentHash])

  const getDocumentTitle = () => {
    switch (selectedDocType) {
      case "certificate":
        return purpose === "comparecimento"
          ? "Atestado de Comparecimento"
          : "Declaração de Tratamento Fisioterapêutico"
      case "receipt":
        return "Recibo para Reembolso de Convênio"
      case "tcle":
        return "Termo de Consentimento Livre e Esclarecido (TCLE / LGPD)"
      case "report":
        return reportTitle || "Laudo de Evolução Clínica e Biomecânica"
    }
  }

  const handleSave = async () => {
    if (!onSaveReport || !patient) return
    setIsSaving(true)
    try {
      let payload: any = {
        id: reportToEdit?.id,
        patientId: patient.id,
        professionalId: selectedProfId || activeProf.id,
        type: selectedDocType,
        title: getDocumentTitle(),
        date: selectedDocType === "report" ? reportDate : sessionDate,
        documentHash: reportToEdit?.documentHash || docHash,
      }

      if (selectedDocType === "report") {
        payload = {
          ...payload,
          title: reportTitle,
          chiefComplaint: reportChiefComplaint,
          painScaleEva: reportPainScaleEva,
          painLocation: reportPainLocation,
          hpi: reportHpi,
          clinicalGoals: reportClinicalGoals,
          diagnosticCid: reportDiagnosticCid,
          evolutionSummary: reportEvolutionSummary,
          conclusion: reportConclusion,
          customNotes,
        }
      } else if (selectedDocType === "certificate") {
        payload = {
          ...payload,
          purpose,
          diagnosticCid: cidCode,
          customNotes,
          serviceDescription: specialty,
        }
      } else if (selectedDocType === "receipt") {
        payload = {
          ...payload,
          receiptAmount,
          sessionsCount,
          paymentMethod: paymentMethodText,
          serviceDescription,
        }
      } else if (selectedDocType === "tcle") {
        payload = {
          ...payload,
          date: tcleDate,
          customNotes: tcleCustomNotes || "Termo de Consentimento Livre e Esclarecido (TCLE & LGPD) registrado e emitido digitalmente.",
        }
      }

      await onSaveReport(payload)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      console.error("Erro ao salvar laudo clínico:", err)
    } finally {
      setIsSaving(false)
    }
  }

  const handlePrint = async () => {
    if (onSaveReport && patient) {
      await handleSave()
    }
    if (onDocumentPrinted) {
      onDocumentPrinted(selectedDocType, getDocumentTitle())
    }
    window.print()
  }

  const handleCopyText = () => {
    const el = document.getElementById("document-print-body")
    if (el) {
      navigator.clipboard.writeText(el.innerText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[92vh] max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 pb-3 border-b border-border bg-card/60 shrink-0">
          <div className="flex items-center justify-between pr-10">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <FileCheck2 className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-base font-bold text-foreground">
                    Central de Emissão de Documentos Clínicos
                  </DialogTitle>
                  {reportToEdit && (
                    <Badge variant="secondary" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20 flex items-center gap-1">
                      <Edit3 className="h-2.5 w-2.5" />
                      <span>Modo Edição</span>
                    </Badge>
                  )}
                </div>
                <DialogDescription className="text-xs text-muted-foreground">
                  Emissão, personalização e arquivamento de laudos em conformidade com o COFFITO, CREFITO-3 e LGPD.
                </DialogDescription>
              </div>
            </div>
            {patient && (
              <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20 shrink-0">
                Paciente: {patient.name.split(" ")[0]} ({patient.documentCpf})
              </Badge>
            )}
          </div>

          {/* Seleção do Tipo de Documento */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3">
            <Button
              type="button"
              variant={selectedDocType === "report" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedDocType("report")}
              className="text-xs h-9 justify-start gap-1.5 font-semibold"
            >
              <FileText className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Laudo de Evolução</span>
            </Button>
            <Button
              type="button"
              variant={selectedDocType === "certificate" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedDocType("certificate")}
              className="text-xs h-9 justify-start gap-1.5 font-medium"
            >
              <Award className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Atestado / Declaração</span>
            </Button>
            <Button
              type="button"
              variant={selectedDocType === "receipt" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedDocType("receipt")}
              className="text-xs h-9 justify-start gap-1.5 font-medium"
            >
              <Receipt className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Recibo de Convênio</span>
            </Button>
            <Button
              type="button"
              variant={selectedDocType === "tcle" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedDocType("tcle")}
              className="text-xs h-9 justify-start gap-1.5 font-medium"
            >
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Termo TCLE & LGPD</span>
            </Button>
          </div>
        </DialogHeader>

        {/* Corpo: Painel Dividido (Configurações Rápidas à Esquerda, Visualização A4 à Direita) */}
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
          {/* Coluna de Configuração e Edição (Ocultada na Impressão) */}
          <div className="md:col-span-4 p-4 border-r border-border bg-muted/20 overflow-y-auto space-y-3.5 text-xs print:hidden h-full">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-foreground flex items-center gap-1.5">
                <Sliders className="h-3.5 w-3.5 text-primary" />
                <span>
                  {selectedDocType === "report" && "Parâmetros & Edição do Laudo"}
                  {selectedDocType === "certificate" && "Parâmetros do Atestado"}
                  {selectedDocType === "receipt" && "Parâmetros do Recibo"}
                  {selectedDocType === "tcle" && "Parâmetros do Termo TCLE"}
                </span>
              </h4>
              {selectedDocType === "report" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleResetToAnamnesis}
                  className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground gap-1"
                  title="Redefinir campos a partir da anamnese clínica atual"
                >
                  <RotateCcw className="h-2.5 w-2.5" />
                  <span>Puxar da Anamnese</span>
                </Button>
              )}
            </div>

            {/* Fisioterapeuta Responsável */}
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                Profissional Emissor (CREFITO)
              </label>
              <Select
                value={selectedProfId}
                onChange={(e) => setSelectedProfId(e.target.value)}
              >
                {professionals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.crefito}
                  </option>
                ))}
              </Select>
            </div>

            {/* FORMULÁRIO DE EDIÇÃO: LAUDO DE EVOLUÇÃO CLÍNICA & BIOMECÂNICA */}
            {selectedDocType === "report" && (
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-foreground mb-1">
                    Título do Laudo
                  </label>
                  <Input
                    value={reportTitle}
                    onChange={(e) => setReportTitle(e.target.value)}
                    placeholder="Ex: Laudo de Evolução Clínica e Biomecânica"
                    className="h-8 text-xs font-semibold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                      Data do Documento
                    </label>
                    <Input
                      type="date"
                      value={reportDate}
                      onChange={(e) => setReportDate(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                      CID-10 / Diagnóstico
                    </label>
                    <Input
                      value={reportDiagnosticCid}
                      onChange={(e) => setReportDiagnosticCid(e.target.value)}
                      placeholder="Ex: M54.5"
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-foreground mb-1">
                    Queixa Principal / Motivo Clínico
                  </label>
                  <textarea
                    rows={2}
                    value={reportChiefComplaint}
                    onChange={(e) => setReportChiefComplaint(e.target.value)}
                    placeholder="Descreva a queixa e sintomatologia principal..."
                    className="w-full p-2 rounded-lg border border-border bg-background text-xs resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                      Escala de Dor Inicial (EVA: 0 a 10)
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        max={10}
                        value={reportPainScaleEva}
                        onChange={(e) => setReportPainScaleEva(Math.max(0, Math.min(10, parseInt(e.target.value) || 0)))}
                        className="h-8 text-xs w-16 text-center font-bold"
                      />
                      <span className="text-[11px] text-muted-foreground">/ 10</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                      Região / Local Anatômico
                    </label>
                    <Input
                      value={reportPainLocation}
                      onChange={(e) => setReportPainLocation(e.target.value)}
                      placeholder="Ex: Coluna Lombar"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                    História da Moléstia Atual (HPI)
                  </label>
                  <textarea
                    rows={2}
                    value={reportHpi}
                    onChange={(e) => setReportHpi(e.target.value)}
                    placeholder="Início, tempo de evolução, fatores de piora ou alívio..."
                    className="w-full p-2 rounded-lg border border-border bg-background text-xs resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                    Metas Terapêuticas Estabelecidas
                  </label>
                  <textarea
                    rows={2}
                    value={reportClinicalGoals}
                    onChange={(e) => setReportClinicalGoals(e.target.value)}
                    placeholder="Metas de ADM, força muscular, controle álgico e postural..."
                    className="w-full p-2 rounded-lg border border-border bg-background text-xs resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-medium text-muted-foreground">
                      Exibição das Sessões SOAP
                    </label>
                    <span className="text-[10px] text-primary">
                      {evolutions.length} sessão(ões) no histórico
                    </span>
                  </div>
                  <Select
                    value={String(reportIncludeEvolutionsCount)}
                    onChange={(e) => setReportIncludeEvolutionsCount(parseInt(e.target.value) || 0)}
                  >
                    <option value="3">Incluir últimas 3 sessões detalhadas</option>
                    <option value="5">Incluir últimas 5 sessões detalhadas</option>
                    <option value="10">Incluir últimas 10 sessões detalhadas</option>
                    <option value="0">Não listar sessões (Apenas texto de síntese)</option>
                  </Select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                    Síntese Geral das Sessões (Opcional)
                  </label>
                  <textarea
                    rows={2}
                    value={reportEvolutionSummary}
                    onChange={(e) => setReportEvolutionSummary(e.target.value)}
                    placeholder="Resumo livre da evolução do paciente durante o tratamento..."
                    className="w-full p-2 rounded-lg border border-border bg-background text-xs resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-foreground mb-1">
                    Parecer Conclusivo & Recomendações do Fisioterapeuta
                  </label>
                  <textarea
                    rows={3}
                    value={reportConclusion}
                    onChange={(e) => setReportConclusion(e.target.value)}
                    placeholder="Conclusão clínica, recomendações de continuidade, alta ou encaminhamento..."
                    className="w-full p-2 rounded-lg border border-border bg-background text-xs resize-none focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                    Observações Adicionais (Opcional)
                  </label>
                  <textarea
                    rows={2}
                    value={customNotes}
                    onChange={(e) => setCustomNotes(e.target.value)}
                    placeholder="Notas adicionais sobre o atendimento ou orientações domiciliares..."
                    className="w-full p-2 rounded-lg border border-border bg-background text-xs resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            )}

            {/* Customizações específicas para Atestado */}
            {selectedDocType === "certificate" && (
              <>
                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                    Tipo de Atestado
                  </label>
                  <Select
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value as any)}
                  >
                    <option value="comparecimento">Comparecimento (Trabalho / Escola)</option>
                    <option value="tratamento_continuo">Declaração de Tratamento Contínuo</option>
                    <option value="repouso">Atestado de Dispensa / Repouso</option>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                      Data da Sessão
                    </label>
                    <Input
                      type="date"
                      value={sessionDate}
                      onChange={(e) => setSessionDate(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  {purpose === "repouso" ? (
                    <div>
                      <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                        Dias de Repouso
                      </label>
                      <Input
                        type="number"
                        value={restDays}
                        onChange={(e) => setRestDays(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                        Horário (De - Até)
                      </label>
                      <div className="flex items-center gap-1">
                        <Input
                          type="text"
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          className="h-8 text-xs px-1 text-center"
                        />
                        <span>-</span>
                        <Input
                          type="text"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          className="h-8 text-xs px-1 text-center"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                    Modalidade do Atendimento
                  </label>
                  <Input
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                    CID-10 (Opcional)
                  </label>
                  <Input
                    value={cidCode}
                    onChange={(e) => setCidCode(e.target.value)}
                    className="h-8 text-xs font-mono"
                    placeholder="Ex: M54.5"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                    Observações / Conduta
                  </label>
                  <textarea
                    rows={2}
                    value={customNotes}
                    onChange={(e) => setCustomNotes(e.target.value)}
                    className="w-full p-2 rounded-lg border border-border bg-background text-xs resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </>
            )}

            {/* Customizações específicas para Recibo de Convênio */}
            {selectedDocType === "receipt" && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                      Valor Total (R$)
                    </label>
                    <Input
                      type="number"
                      value={receiptAmount}
                      onChange={(e) => setReceiptAmount(parseFloat(e.target.value) || 0)}
                      className="h-8 text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                      Qtd. Sessões
                    </label>
                    <Input
                      type="number"
                      value={sessionsCount}
                      onChange={(e) => setSessionsCount(parseInt(e.target.value) || 1)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                    Forma de Liquidação
                  </label>
                  <Input
                    value={paymentMethodText}
                    onChange={(e) => setPaymentMethodText(e.target.value)}
                    className="h-8 text-xs"
                    placeholder="Ex: PIX / Transferência"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                    Discriminação dos Serviços
                  </label>
                  <textarea
                    rows={3}
                    value={serviceDescription}
                    onChange={(e) => setServiceDescription(e.target.value)}
                    className="w-full p-2 rounded-lg border border-border bg-background text-xs resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </>
            )}

            {/* Customizações específicas para Termo TCLE & LGPD */}
            {selectedDocType === "tcle" && (
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                    Data do Termo
                  </label>
                  <Input
                    type="date"
                    value={tcleDate}
                    onChange={(e) => setTcleDate(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="p-2.5 rounded-lg border border-border bg-background space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tcleHasRepresentative}
                      onChange={(e) => setTcleHasRepresentative(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                    />
                    <span className="text-[11px] font-medium text-foreground">
                      Paciente menor de idade / representado
                    </span>
                  </label>

                  {tcleHasRepresentative && (
                    <div className="space-y-2 pt-2 border-t border-border/60">
                      <div>
                        <label className="block text-[10px] text-muted-foreground mb-0.5">
                          Nome do Responsável Legal
                        </label>
                        <Input
                          value={tcleRepresentativeName}
                          onChange={(e) => setTcleRepresentativeName(e.target.value)}
                          placeholder="Ex: Maria Mendes da Silva"
                          className="h-7 text-xs"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-muted-foreground mb-0.5">
                            CPF do Responsável
                          </label>
                          <Input
                            value={tcleRepresentativeCpf}
                            onChange={(e) => setTcleRepresentativeCpf(e.target.value)}
                            placeholder="000.000.000-00"
                            className="h-7 text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-muted-foreground mb-0.5">
                            Parentesco / Vínculo
                          </label>
                          <Input
                            value={tcleRepresentativeKinship}
                            onChange={(e) => setTcleRepresentativeKinship(e.target.value)}
                            placeholder="Ex: Mãe / Tutora"
                            className="h-7 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-2.5 rounded-lg border border-border bg-background space-y-2">
                  <span className="block text-[11px] font-semibold text-foreground">
                    Cláusulas & Autorizações
                  </span>
                  <label className="flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={tcleIncludeBiofoto}
                      onChange={(e) => setTcleIncludeBiofoto(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                    />
                    <span className="text-[11px] text-foreground">
                      Autorização Biofotogrametria Postural
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={tcleIncludeScientific}
                      onChange={(e) => setTcleIncludeScientific(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                    />
                    <span className="text-[11px] text-foreground">
                      Fins didáticos / acadêmicos anonimizados
                    </span>
                  </label>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                    Observações Adicionais (Opcional)
                  </label>
                  <textarea
                    rows={2}
                    value={tcleCustomNotes}
                    onChange={(e) => setTcleCustomNotes(e.target.value)}
                    placeholder="Condições médicas específicas ou ressalvas..."
                    className="w-full p-2 rounded-lg border border-border bg-background text-xs resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            )}

            {/* Dica de Impressão */}
            <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/10 text-[11px] text-muted-foreground space-y-1">
              <p className="font-semibold text-primary flex items-center gap-1">
                <Printer className="h-3.5 w-3.5" />
                <span>Pronto para Salvar em PDF</span>
              </p>
              <p>
                Ao clicar em "Imprimir / PDF", selecione o destino como <strong>"Salvar como PDF"</strong> no navegador para gerar o arquivo com resolução A4 vetorial.
              </p>
            </div>
          </div>

          {/* Coluna da Folha A4 (Preview e Alvo de Impressão) */}
          <div className="md:col-span-8 p-4 md:p-6 bg-muted/40 overflow-y-auto flex justify-center items-start h-full print:p-0 print:bg-white print:overflow-visible">
            <div
              id="printable-document"
              className="w-full max-w-[650px] h-fit bg-card text-foreground border border-border shadow-lg rounded-xl p-8 md:p-10 space-y-6 font-sans text-xs leading-relaxed my-2 print:m-0 print:p-0 print:border-none print:shadow-none print:max-w-none print:w-full print:bg-white print:text-black print:rounded-none"
            >
              {/* Cabeçalho Oficial Timbrado */}
              <div className="border-b-2 border-primary/30 pb-4 flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center font-bold print:border print:border-black overflow-hidden">
                      {theme.logoUrl ? (
                        <img
                          src={theme.logoUrl}
                          alt={theme.clinicName}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <HeartPulse className="h-5 w-5 text-primary print:text-black" />
                      )}
                    </div>
                    <div>
                      <h2 className="text-base font-bold tracking-tight text-foreground uppercase print:text-black">
                        {theme.clinicName || "Altar Fisio"}
                      </h2>
                      <p className="text-[10px] text-muted-foreground tracking-wider uppercase font-medium print:text-gray-600">
                        {theme.clinicSubtitle || "Clínica de Fisioterapia, Studio de Pilates & RPG"}
                      </p>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground print:text-gray-600">
                    {activeProf.name} • {activeProf.crefito}
                  </p>
                </div>

                <div className="text-right text-[10px] text-muted-foreground space-y-0.5 print:text-gray-600">
                  <p className="font-medium text-foreground print:text-black">CNPJ: 45.123.789/0001-90</p>
                  <p>Av. Paulista, 1000 - Cj. 42 • Bela Vista</p>
                  <p>São Paulo - SP • CEP 01310-100</p>
                  <p>Tel/WhatsApp: (11) 99123-4567</p>
                </div>
              </div>

              {/* Título Central do Documento */}
              <div className="text-center py-1">
                <h1 className="text-base font-extrabold uppercase tracking-wide text-foreground border-b border-border/60 pb-2 inline-block px-6 print:text-black print:border-black">
                  {getDocumentTitle()}
                </h1>
              </div>

              {/* Corpo Dinâmico por Tipo de Documento */}
              <div id="document-print-body" className="space-y-4 text-justify leading-relaxed">
                {/* 1. MODELO: LAUDO DE EVOLUÇÃO CLÍNICA E BIOMECÂNICA (DINÂMICO E EDITÁVEL) */}
                {selectedDocType === "report" && (
                  <>
                    <div className="border border-border rounded-lg p-3 space-y-2 text-xs bg-muted/10 print:border-gray-400">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[10px] text-muted-foreground block uppercase font-semibold">
                            Paciente / Identificação:
                          </span>
                          <p className="font-bold text-foreground print:text-black">
                            {patient?.name || "Paciente Selecionado"}
                          </p>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            CPF: {patient?.documentCpf || "000.000.000-00"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block uppercase font-semibold">
                            Escala de Dor Inicial (EVA):
                          </span>
                          <p className="font-bold text-amber-600 print:text-black text-sm">
                            {reportPainScaleEva} / 10{" "}
                            {reportPainLocation && <span className="text-xs font-normal text-muted-foreground print:text-black">• Local: {reportPainLocation}</span>}
                          </p>
                        </div>
                      </div>

                      {reportChiefComplaint && (
                        <div>
                          <span className="text-[10px] text-muted-foreground block uppercase font-semibold">
                            Queixa Principal / Motivo do Tratamento:
                          </span>
                          <p className="font-medium text-[11px] text-foreground print:text-black">
                            {reportChiefComplaint}
                          </p>
                        </div>
                      )}

                      {reportDiagnosticCid && (
                        <div>
                          <span className="text-[10px] text-muted-foreground block uppercase font-semibold">
                            Classificação Internacional de Doenças (CID-10 / Diagnóstico Cinesiológico):
                          </span>
                          <p className="font-mono text-[11px] font-semibold text-foreground print:text-black">
                            {reportDiagnosticCid}
                          </p>
                        </div>
                      )}

                      {reportHpi && (
                        <div>
                          <span className="text-[10px] text-muted-foreground block uppercase font-semibold">
                            História da Moléstia Atual (HPI):
                          </span>
                          <p className="text-muted-foreground print:text-gray-800 text-[11px]">
                            {reportHpi}
                          </p>
                        </div>
                      )}

                      {reportClinicalGoals && (
                        <div>
                          <span className="text-[10px] text-muted-foreground block uppercase font-semibold">
                            Metas Terapêuticas Estabelecidas:
                          </span>
                          <p className="font-medium text-[11px] text-foreground print:text-black">
                            {reportClinicalGoals}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Síntese Geral (se preenchida) */}
                    {reportEvolutionSummary && (
                      <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 space-y-1 print:border print:border-gray-300">
                        <span className="text-[10px] text-primary font-bold uppercase block print:text-black">
                          Síntese do Progresso Terapêutico:
                        </span>
                        <p className="text-[11px] leading-relaxed text-foreground print:text-black">
                          {reportEvolutionSummary}
                        </p>
                      </div>
                    )}

                    {/* Evoluções SOAP Detalhadas */}
                    {reportIncludeEvolutionsCount > 0 && evolutions.length > 0 && (
                      <div>
                        <h4 className="font-bold text-xs uppercase text-foreground mb-1.5 print:text-black flex items-center justify-between">
                          <span>Registro das Últimas Sessões (Padrão SOAP - COFFITO):</span>
                          <span className="text-[10px] text-muted-foreground font-normal print:text-black">
                            Mostrando {Math.min(reportIncludeEvolutionsCount, evolutions.length)} sessão(ões)
                          </span>
                        </h4>
                        <div className="space-y-2 text-[11px]">
                          {evolutions.slice(0, reportIncludeEvolutionsCount).map((evo, i) => (
                            <div key={evo.id || i} className="p-2.5 border border-border rounded bg-card print:border-gray-300 space-y-1">
                              <div className="flex justify-between font-semibold text-xs border-b border-border/50 pb-1 mb-1">
                                <span>Sessão {evo.date} • {evo.techniqueCategory || "Pilates Clínico"}</span>
                                <span className="text-amber-600 print:text-black">
                                  EVA pós: {evo.painScaleAfter !== undefined ? `${evo.painScaleAfter}/10` : "N/A"}
                                </span>
                              </div>
                              <p><strong>Objetivo:</strong> {evo.objective}</p>
                              <p><strong>Avaliação / Resposta:</strong> {evo.assessment}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Parecer Conclusivo do Fisioterapeuta */}
                    {reportConclusion && (
                      <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-1 print:border print:border-gray-400">
                        <span className="text-[10px] font-bold uppercase text-foreground print:text-black block">
                          Parecer e Conduta Fisioterapêutica:
                        </span>
                        <p className="text-[11px] leading-relaxed font-medium text-foreground print:text-black">
                          {reportConclusion}
                        </p>
                      </div>
                    )}

                    {/* Observações Adicionais */}
                    {customNotes && (
                      <p className="text-[11px] text-muted-foreground print:text-gray-700">
                        <strong>Observações Complementares:</strong> {customNotes}
                      </p>
                    )}
                  </>
                )}

                {/* 2. MODELO: ATESTADO DE COMPARECIMENTO / DECLARAÇÃO */}
                {selectedDocType === "certificate" && (
                  <>
                    <p>
                      Atesto para os devidos fins a quem interessar que o(a) paciente{" "}
                      <strong className="font-bold text-foreground print:text-black">
                        {patient?.name || "Paciente Selecionado"}
                      </strong>
                      , portador(a) do CPF nº{" "}
                      <span className="font-mono font-semibold">
                        {patient?.documentCpf || "000.000.000-00"}
                      </span>
                      {patient?.healthInsurance && (
                        <span> (Convênio: {patient.healthInsurance})</span>
                      )}
                      {purpose === "comparecimento" && (
                        <>
                          , compareceu a esta unidade de saúde no dia{" "}
                          <strong>{formatDateExtendedBR(sessionDate)}</strong>, no período compreendido entre{" "}
                          <strong>{startTime}</strong> e <strong>{endTime}</strong>, estando sob assistência e conduta fisioterapêutica na modalidade de{" "}
                          <strong>{specialty}</strong>.
                        </>
                      )}
                      {purpose === "tratamento_continuo" && (
                        <>
                          , encontra-se em acompanhamento fisioterapêutico regular nesta clínica para reabilitação funcional e reeducação biomecânica na modalidade de{" "}
                          <strong>{specialty}</strong>, com frequência prevista de 2 a 3 sessões semanais.
                        </>
                      )}
                      {purpose === "repouso" && (
                        <>
                          , foi avaliado(a) nesta data e necessita de dispensa de suas atividades laborais e repouso pelo período de{" "}
                          <strong>{restDays} dia(s)</strong> a contar desta data, para recuperação musculoesquelética e controle álgico.
                        </>
                      )}
                    </p>

                    {cidCode && (
                      <p className="p-2.5 rounded-lg bg-muted/40 border border-border text-xs print:border print:border-gray-300">
                        <strong>Classificação Internacional de Doenças (CID-10):</strong>{" "}
                        <span className="font-mono font-semibold">{cidCode}</span>
                        <span className="block text-[10px] text-muted-foreground mt-0.5 print:text-gray-600">
                          (Diagnóstico cinesiológico funcional conforme Resolução COFFITO nº 414/2012).
                        </span>
                      </p>
                    )}

                    {customNotes && (
                      <p>
                        <strong>Observações Terapêuticas:</strong> {customNotes}
                      </p>
                    )}
                  </>
                )}

                {/* 3. MODELO: RECIBO DE REEMBOLSO DE CONVÊNIO */}
                {selectedDocType === "receipt" && (
                  <>
                    <div className="p-3 bg-muted/30 border border-border rounded-lg text-xs space-y-1 print:border print:border-gray-300">
                      <p className="text-[11px] text-muted-foreground font-semibold uppercase">
                        Finalidade do Documento:
                      </p>
                      <p className="font-medium">
                        Recibo oficial discriminado para solicitação de Reembolso junto à Operadora de Plano de Saúde ou comprovação em Declaração de Ajuste Anual do IRPF.
                      </p>
                    </div>

                    <p>
                      Recebi(emos) do(a) Sr(a).{" "}
                      <strong className="font-bold text-foreground print:text-black">
                        {patient?.name || "Paciente Selecionado"}
                      </strong>
                      , inscrito(a) no CPF/MF sob o nº{" "}
                      <strong className="font-mono">{patient?.documentCpf || "000.000.000-00"}</strong>, a quantia líquida de{" "}
                      <strong className="text-sm font-bold text-primary print:text-black">
                        R$ {receiptAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </strong>
                      , referente à realização de{" "}
                      <strong>{sessionsCount} sessão(ões)</strong> de{" "}
                      <span>{serviceDescription}</span>.
                    </p>

                    <div className="border border-border rounded-lg overflow-hidden text-xs print:border-gray-400">
                      <div className="bg-muted/50 px-3 py-1.5 font-bold border-b border-border flex justify-between print:bg-gray-100">
                        <span>Discriminação do Atendimento</span>
                        <span>Detalhes</span>
                      </div>
                      <div className="p-3 space-y-1.5">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Procedimento:</span>
                          <span className="font-medium text-right">{serviceDescription}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Sessões computadas:</span>
                          <span className="font-medium">{sessionsCount} sessões presenciais</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Valor médio unitário:</span>
                          <span className="font-medium">
                            R$ {(receiptAmount / (sessionsCount || 1)).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                            })}{" "}
                            / sessão
                          </span>
                        </div>
                        <div className="flex justify-between border-t border-border pt-1">
                          <span className="text-muted-foreground">Forma de Liquidação:</span>
                          <span className="font-medium uppercase">{paymentMethodText}</span>
                        </div>
                      </div>
                    </div>

                    <p className="text-[11px] text-muted-foreground print:text-gray-600">
                      Declaramos para os devidos fins que o valor acima foi devidamente quitado e o atendimento prestado diretamente por profissional fisioterapeuta habilitado com registro ativo no Conselho Regional de Fisioterapia e Terapia Ocupacional (CREFITO-3).
                    </p>
                  </>
                )}

                {/* 4. MODELO: TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO (TCLE) & LGPD */}
                {selectedDocType === "tcle" && (
                  <>
                    <p className="text-[11px] leading-relaxed">
                      Pelo presente instrumento, eu,{" "}
                      <strong>
                        {tcleHasRepresentative && tcleRepresentativeName
                          ? `${tcleRepresentativeName} (inscrito(a) no CPF/MF sob o nº ${tcleRepresentativeCpf || "_________________"}, na qualidade de ${tcleRepresentativeKinship} do(a) paciente ${patient?.name || "Paciente"}, CPF nº ${patient?.documentCpf || "_________________"})`
                          : patient?.name || "_________________________________"}
                      </strong>
                      {!tcleHasRepresentative && (
                        <>
                          , portador(a) do CPF/MF nº{" "}
                          <span className="font-mono font-semibold">
                            {patient?.documentCpf || "_________________"}
                          </span>
                        </>
                      )}
                      , declaro que recebi todos os esclarecimentos e manifesto plena concordância com as diretrizes e procedimentos a seguir discriminados:
                    </p>

                    <div className="space-y-3 text-[11px]">
                      <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-1.5 print:border print:border-gray-300">
                        <p className="font-bold text-foreground print:text-black">
                          1. Consentimento para Avaliação e Tratamento Fisioterapêutico:
                        </p>
                        <p className="text-muted-foreground print:text-gray-700 leading-relaxed">
                          Fui devidamente orientado(a) pelo fisioterapeuta responsável sobre os procedimentos cinesioterapêuticos, exercícios no Studio de Pilates, manobras de RPG e recursos eletrotermofototerapêuticos a serem empregados, compreendendo seus objetivos terapêuticos e possíveis respostas mecânicas adaptativas (dor muscular transitória benigna).
                        </p>
                      </div>

                      {tcleIncludeBiofoto && (
                        <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-1.5 print:border print:border-gray-300">
                          <p className="font-bold text-foreground print:text-black">
                            2. Autorização para Biofotogrametria Postural Computadorizada:
                          </p>
                          <p className="text-muted-foreground print:text-gray-700 leading-relaxed">
                            Autorizo expressamente o registro de fotografias posturais (vistas anterior, posterior e laterais) com espelho quadriculado, estritamente para avaliação biomecânica, mensuração de assimetrias e acompanhamento comparativo de evolução. Estas imagens são sigilosas e integram meu prontuário clínico.
                          </p>
                        </div>
                      )}

                      <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-1.5 print:border print:border-gray-300">
                        <p className="font-bold text-foreground print:text-black">
                          {tcleIncludeBiofoto ? "3" : "2"}. Tratamento de Dados Pessoais e Sensíveis de Saúde (LGPD):
                        </p>
                        <p className="text-muted-foreground print:text-gray-700 leading-relaxed">
                          Concordo com a coleta e armazenamento de meus dados pessoais e histórico clínico de saúde pela <strong>Altar Fisio</strong>, conforme a Lei nº 13.709/2018 (Lei Geral de Proteção de Dados - LGPD) e a Resolução COFFITO nº 414/2012, para a finalidade exclusiva de prestação de assistência fisioterapêutica e cumprimento de deveres regulatórios.
                        </p>
                      </div>

                      {tcleIncludeScientific && (
                        <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-1.5 print:border print:border-gray-300">
                          <p className="font-bold text-foreground print:text-black">
                            {tcleIncludeBiofoto ? "4" : "3"}. Autorização para Fins Didáticos e Científicos:
                          </p>
                          <p className="text-muted-foreground print:text-gray-700 leading-relaxed">
                            Autorizo a utilização de dados clínicos anonimizados e registros biomecânicos em estudos de caso, publicações técnico-científicas e atividades de formação profissional, com garantia de preservação irrestrita do meu anonimato.
                          </p>
                        </div>
                      )}

                      {tcleCustomNotes && (
                        <div className="p-3 rounded-lg border border-border bg-muted/10 space-y-1 text-muted-foreground print:text-gray-700 print:border print:border-gray-300">
                          <strong className="text-foreground print:text-black block text-[10px] uppercase">
                            Observações e Condições Particulares:
                          </strong>
                          <p className="leading-relaxed">{tcleCustomNotes}</p>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Data e Local */}
              <div className="pt-4 text-right text-xs">
                <p>
                  São Paulo - SP,{" "}
                  {formatDateExtendedBR(
                    selectedDocType === "report"
                      ? reportDate
                      : selectedDocType === "tcle"
                      ? tcleDate
                      : sessionDate
                  )}.
                </p>
              </div>

              {/* Bloco de Assinaturas e Carimbo Profissional */}
              <div className="pt-6 border-t border-border grid grid-cols-2 gap-8 text-center text-xs">
                {/* Assinatura do Paciente (quando TCLE) ou Carimbo Auxiliar */}
                {selectedDocType === "tcle" ? (
                  <div>
                    <div className="border-b border-foreground/60 w-52 mx-auto h-10 mb-1"></div>
                    <p className="font-semibold text-foreground print:text-black">
                      {tcleHasRepresentative && tcleRepresentativeName
                        ? tcleRepresentativeName
                        : patient?.name || "Assinatura do Paciente"}
                    </p>
                    <p className="text-[10px] text-muted-foreground print:text-gray-600">
                      {tcleHasRepresentative && tcleRepresentativeName
                        ? `${tcleRepresentativeKinship} de ${patient?.name || "Paciente"}`
                        : "Assinatura do Paciente / Responsável Legal"}
                    </p>
                    <p className="text-[9px] text-muted-foreground font-mono">
                      CPF:{" "}
                      {tcleHasRepresentative && tcleRepresentativeCpf
                        ? tcleRepresentativeCpf
                        : patient?.documentCpf || "000.000.000-00"}
                    </p>
                  </div>
                ) : (
                  <div className="text-left text-[10px] text-muted-foreground space-y-1 print:text-gray-600">
                    <p className="font-bold text-foreground print:text-black uppercase">Autenticidade e Rastreabilidade:</p>
                    <p>Documento emitido digitalmente pela plataforma clínica Altar Fisio.</p>
                    <p className="font-mono text-[9px]">Código Hash: {reportToEdit?.documentHash || docHash}</p>
                  </div>
                )}

                {/* Assinatura do Fisioterapeuta com Carimbo e CREFITO */}
                <div>
                  <div className="border-b border-foreground/60 w-56 mx-auto h-10 mb-1 flex items-end justify-center pb-1">
                    <span className="font-serif italic text-sm text-primary/80 print:text-black font-semibold">
                      {activeProf.name}
                    </span>
                  </div>
                  <p className="font-bold text-foreground print:text-black">{activeProf.name}</p>
                  <p className="text-[10px] text-primary font-semibold print:text-black">{activeProf.crefito}</p>
                  <p className="text-[9px] text-muted-foreground print:text-gray-600">Fisioterapeuta Responsável • Altar Fisio</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé de Ações do Modal */}
        <div className="p-3.5 border-t border-border bg-card flex items-center justify-between print:hidden shrink-0">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyText}
              className="text-xs h-9 gap-1.5"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? "Copiado!" : "Copiar Texto"}</span>
            </Button>
            {saveSuccess && (
              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Salvo no prontuário!</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs h-9"
            >
              Fechar
            </Button>

            {onSaveReport && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
                className="text-xs h-9 gap-1.5 font-semibold text-primary border-primary/30 hover:bg-primary/10"
              >
                <Save className="h-3.5 w-3.5" />
                <span>
                  {isSaving
                    ? "Salvando..."
                    : reportToEdit
                    ? "Atualizar Laudo"
                    : selectedDocType === "report"
                    ? "Salvar Laudo"
                    : "Salvar Documento"}
                </span>
              </Button>
            )}

            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handlePrint}
              disabled={isSaving}
              className="text-xs h-9 gap-2 shadow-sm font-semibold px-4"
            >
              <Printer className="h-4 w-4" />
              <span>Imprimir / Salvar em PDF</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
