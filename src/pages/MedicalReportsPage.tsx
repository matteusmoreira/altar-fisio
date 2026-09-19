import React, { useState, useMemo, useEffect, useRef } from "react"
import { useQuery, useMutation } from "@/lib/staffConvex"
import { api } from "@convex/_generated/api"
import { useTheme } from "@/contexts/ThemeContext"
import { useAuth } from "@/contexts/AuthContext"
import { useClinicData } from "@/contexts/ClinicDataContext"
import { formatDateBR, getTodayDateString } from "@/lib/dateUtils"
import { OFFICIAL_REPORT_TEMPLATES, type ReportTemplateDef } from "@/components/reports/reportTemplates"
import { PrintableReportSheet } from "@/components/reports/PrintableReportSheet"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  FileText,
  Printer,
  Save,
  CheckCircle2,
  Clock,
  Search,
  User,
  History,
  Sparkles,
  Award,
  Layers,
  FileCheck2,
  RotateCcw,
  Trash2,
  Plus,
  Eye,
  Sliders,
  AlertCircle,
  HelpCircle,
  Upload,
} from "lucide-react"

const QUICK_CID_SUGGESTIONS = [
  { code: "M54.5", label: "Dor lombar baixa" },
  { code: "M54.2", label: "Cervicalgia" },
  { code: "M41.9", label: "Escoliose" },
  { code: "S83.0", label: "Luxação da rótula / joelho" },
  { code: "M75.1", label: "Síndrome do manguito rotador" },
  { code: "M51.1", label: "Hérnia de disco com radiculopatia" },
  { code: "M25.5", label: "Dor articular" },
]

export interface MedicalReportsPageProps {
  initialPatientId?: string
}

export const MedicalReportsPage: React.FC<MedicalReportsPageProps> = ({ initialPatientId }) => {
  const { theme } = useTheme()
  const { user } = useAuth()
  const { patients, professionals } = useClinicData()

  const clinicSettings = useQuery(api.clinic.getSettings)
  const clinicalReports = useQuery(api.clinical.listClinicalReports, {})
  const customTemplates = useQuery(api.clinical.listReportCustomTemplates, {})

  const createReportMutation = useMutation(api.clinical.createClinicalReport)
  const deleteReportMutation = useMutation(api.clinical.deleteClinicalReport)
  const saveTemplateMutation = useMutation(api.clinical.saveReportCustomTemplate)
  const deleteTemplateMutation = useMutation(api.clinical.deleteReportCustomTemplate)

  // Tabs de navegação: "emission" (Emissão Rápida), "history" (Histórico), "templates" (Modelos)
  const [activeTab, setActiveTab] = useState<"emission" | "history" | "templates">("emission")

  // Estado do Template Selecionado
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>("laudo_fisio_3x")

  // Estado do Paciente
  const [selectedPatientId, setSelectedPatientId] = useState<string>(initialPatientId || "")
  const [patientInputName, setPatientInputName] = useState<string>("")
  const [isWalkInPatient, setIsWalkInPatient] = useState<boolean>(false)
  const [patientSearchTerm, setPatientSearchTerm] = useState<string>("")
  const [isPatientDropdownOpen, setIsPatientDropdownOpen] = useState<boolean>(false)

  // Metadados do Documento
  const [docDate, setDocDate] = useState<string>(formatDateBR(new Date()))
  const [sessionDate, setSessionDate] = useState<string>(formatDateBR(new Date()))
  const [cidCode, setCidCode] = useState<string>("M54.5 (Dor lombar baixa)")
  const [startTime, setStartTime] = useState<string>("08:00")
  const [endTime, setEndTime] = useState<string>("09:00")
  const [paperSize, setPaperSize] = useState<"a4" | "a5">("a4")
  const [showWatermark, setShowWatermark] = useState<boolean>(true)
  const [signatureImageUrl, setSignatureImageUrl] = useState<string | undefined>(undefined)

  // Corpo do Texto Editável
  const [bodyText, setBodyText] = useState<string>(
    OFFICIAL_REPORT_TEMPLATES[0].defaultText
  )

  // Feedback de salvamento
  const [isSaving, setIsSaving] = useState(false)
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null)

  // Histórico: busca e filtro
  const [historySearch, setHistorySearch] = useState("")
  const [historyFilterType, setHistoryFilterType] = useState<string>("all")

  // Modal / Criação de Novo Template
  const [newTemplateTitle, setNewTemplateTitle] = useState("")
  const [newTemplateCategory, setNewTemplateCategory] = useState<"laudo" | "declaracao">("laudo")
  const [newTemplateContent, setNewTemplateContent] = useState("")
  const [newTemplateCid, setNewTemplateCid] = useState("")
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false)

  // Sincroniza paciente inicial se fornecido
  useEffect(() => {
    if (initialPatientId && patients.length > 0) {
      const found = patients.find((p) => p.id === initialPatientId)
      if (found) {
        setSelectedPatientId(found.id)
        setPatientInputName(found.name)
        setIsWalkInPatient(false)
      }
    }
  }, [initialPatientId, patients])

  // Template ativo atual
  const activeTemplate = useMemo<ReportTemplateDef>(() => {
    const foundOfficial = OFFICIAL_REPORT_TEMPLATES.find((t) => t.key === selectedTemplateKey)
    if (foundOfficial) return foundOfficial

    if (customTemplates && Array.isArray(customTemplates)) {
      const foundCustom = customTemplates.find((t) => t._id === selectedTemplateKey)
      if (foundCustom) {
        return {
          key: foundCustom._id,
          title: foundCustom.type === "declaracao" ? "CLÍNICA DE FISIOTERAPIA" : "LAUDO",
          subtitle: foundCustom.type === "declaracao" ? "Declaração de Comparecimento" : undefined,
          category: foundCustom.type as any,
          badgeLabel: foundCustom.title,
          shortDesc: foundCustom.title,
          defaultText: foundCustom.content,
          defaultCid: foundCustom.cidDefault,
          hasTimeRange: foundCustom.type === "declaracao",
          hasDoubleBorder: foundCustom.type === "declaracao",
        }
      }
    }

    return OFFICIAL_REPORT_TEMPLATES[0]
  }, [selectedTemplateKey, customTemplates])

  // Troca de modelo e inicialização do texto
  const handleSelectTemplate = (templateKey: string) => {
    setSelectedTemplateKey(templateKey)
    const target =
      OFFICIAL_REPORT_TEMPLATES.find((t) => t.key === templateKey) ||
      (customTemplates?.find((t) => t._id === templateKey)
        ? {
            defaultText: customTemplates.find((t) => t._id === templateKey)!.content,
            defaultCid: customTemplates.find((t) => t._id === templateKey)!.cidDefault || "",
          }
        : null)

    if (target) {
      setBodyText(target.defaultText)
      if (target.defaultCid !== undefined) {
        setCidCode(target.defaultCid)
      }
    }
  }

  // Nome final do paciente para exibição
  const effectivePatientName = useMemo(() => {
    if (isWalkInPatient) return patientInputName
    const p = patients.find((pat) => pat.id === selectedPatientId)
    return p ? p.name : patientInputName
  }, [isWalkInPatient, selectedPatientId, patientInputName, patients])

  // Lista filtrada de pacientes para autocomplete
  const filteredPatients = useMemo(() => {
    if (!patientSearchTerm.trim()) return patients.slice(0, 8)
    const term = patientSearchTerm.toLowerCase()
    return patients
      .filter((p) => p.name.toLowerCase().includes(term) || (p.phone && p.phone.includes(term)))
      .slice(0, 10)
  }, [patients, patientSearchTerm])

  // Profissional Dr. Marcelo ou ativo
  const activeProfessional = useMemo(() => {
    const marcelo = professionals.find((p) => p.name.toLowerCase().includes("marcelo"))
    return marcelo || professionals[0] || {
      id: "dr_marcelo",
      name: "Dr. Marcelo S. Santos",
      crefito: "Crefito 2: 40008-F",
    }
  }, [professionals])

  // Salvar no Histórico
  const handleSaveToHistory = async () => {
    setIsSaving(true)
    setSaveFeedback(null)
    try {
      await createReportMutation({
        patientId: isWalkInPatient ? undefined : (selectedPatientId as any),
        patientName: effectivePatientName,
        professionalId: activeProfessional?.id as any,
        type: activeTemplate.category === "declaracao" ? "certificate" : "report",
        modelKey: selectedTemplateKey,
        title: activeTemplate.title,
        date: getTodayDateString(),
        timeRange: activeTemplate.hasTimeRange ? `das ${startTime} às ${endTime} horas` : undefined,
        paperSize,
        showWatermark,
        signatureImageUrl,
        conclusion: bodyText,
        diagnosticCid: cidCode,
        customNotes: `Emitido via Central de Laudos (${activeTemplate.badgeLabel})`,
      })
      setSaveFeedback("Laudo salvo com sucesso no histórico da clínica!")
      setTimeout(() => setSaveFeedback(null), 4000)
    } catch (err: any) {
      console.error("Erro ao salvar laudo:", err)
      setSaveFeedback("Erro ao salvar laudo: " + (err.message || "Tente novamente."))
    } finally {
      setIsSaving(false)
    }
  }

  // Disparo de Impressão
  const handlePrint = async () => {
    // Se o usuário desejar salvar automaticamente ao imprimir:
    try {
      if (effectivePatientName.trim()) {
        await handleSaveToHistory()
      }
    } catch {}
    window.print()
  }

  // Salvar novo modelo personalizado
  const handleCreateCustomTemplate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTemplateTitle.trim() || !newTemplateContent.trim()) return

    setIsSaving(true)
    try {
      await saveTemplateMutation({
        title: newTemplateTitle.trim(),
        type: newTemplateCategory,
        content: newTemplateContent.trim(),
        cidDefault: newTemplateCid.trim() || undefined,
      })
      setNewTemplateTitle("")
      setNewTemplateContent("")
      setNewTemplateCid("")
      setIsCreatingTemplate(false)
      setSaveFeedback("Novo modelo personalizado salvo com sucesso!")
      setTimeout(() => setSaveFeedback(null), 3500)
    } catch (err: any) {
      setSaveFeedback("Erro ao criar modelo: " + (err.message || "Tente novamente."))
    } finally {
      setIsSaving(false)
    }
  }

  // Carregar laudo do histórico para reimpressão
  const handleLoadFromHistory = (report: any) => {
    setPatientInputName(report.patientName || "")
    if (report.patientId) {
      setSelectedPatientId(report.patientId)
      setIsWalkInPatient(false)
    } else {
      setIsWalkInPatient(true)
    }
    if (report.modelKey) {
      setSelectedTemplateKey(report.modelKey)
    }
    if (report.conclusion) {
      setBodyText(report.conclusion)
    }
    if (report.diagnosticCid) {
      setCidCode(report.diagnosticCid)
    }
    if (report.paperSize) {
      setPaperSize(report.paperSize as any)
    }
    setActiveTab("emission")
  }

  // Filtragem de relatórios no histórico
  const filteredReports = useMemo(() => {
    if (!clinicalReports) return []
    return clinicalReports.filter((r) => {
      const matchSearch =
        !historySearch.trim() ||
        (r.patientName && r.patientName.toLowerCase().includes(historySearch.toLowerCase())) ||
        (r.title && r.title.toLowerCase().includes(historySearch.toLowerCase())) ||
        (r.diagnosticCid && r.diagnosticCid.toLowerCase().includes(historySearch.toLowerCase()))

      const matchType =
        historyFilterType === "all" ||
        (historyFilterType === "report" && r.type === "report") ||
        (historyFilterType === "certificate" && r.type === "certificate")

      return matchSearch && matchType
    })
  }, [clinicalReports, historySearch, historyFilterType])

  return (
    <div className="p-3 sm:p-5 lg:p-6 w-full max-w-7xl mx-auto space-y-5">
      {/* ========================================================================= */}
      {/* CABEÇALHO DO MÓDULO (OCULTADO NA IMPRESSÃO)                               */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-xs border border-primary/20">
            <FileCheck2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Laudos & Declarações
              </h1>
              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-xs">
                Dr. Marcelo
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Emissão rápida dos laudos e declarações da clínica com visual idêntico ao papel, carimbo e assinatura.
            </p>
          </div>
        </div>

        {/* Abas de Ação */}
        <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-xl border border-border shrink-0 self-start sm:self-auto">
          <Button
            type="button"
            variant={activeTab === "emission" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("emission")}
            className="text-xs h-8 gap-1.5 font-medium"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Emissão Rápida</span>
          </Button>
          <Button
            type="button"
            variant={activeTab === "history" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("history")}
            className="text-xs h-8 gap-1.5 font-medium"
          >
            <History className="h-3.5 w-3.5" />
            <span>Histórico Salvo</span>
            {clinicalReports && clinicalReports.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-background/80 text-[10px] font-bold">
                {clinicalReports.length}
              </span>
            )}
          </Button>
          <Button
            type="button"
            variant={activeTab === "templates" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("templates")}
            className="text-xs h-8 gap-1.5 font-medium"
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Modelos & Templates</span>
          </Button>
        </div>
      </div>

      {/* Feedback Toast / Alerta */}
      {saveFeedback && (
        <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-semibold flex items-center justify-between animate-fade-in print:hidden">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{saveFeedback}</span>
          </div>
          <button
            onClick={() => setSaveFeedback(null)}
            className="text-emerald-700 hover:text-emerald-950 dark:hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 1: EMISSÃO RÁPIDA (FORMULÁRIO + PREVIEW AO VIVO)                       */}
      {/* ========================================================================= */}
      {activeTab === "emission" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* PAINEL DE CONTROLE E EDIÇÃO (ESQUERDA - 5 COLUNAS) */}
          <div className="lg:col-span-5 space-y-4 print:hidden">
            {/* 1. SELEÇÃO DE MODELO DOS PAPÉIS FÍSICOS */}
            <Card className="border-border shadow-xs">
              <CardHeader className="p-4 pb-2.5">
                <CardTitle className="text-sm font-bold flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span>1. Escolha o Modelo Físico da Clínica</span>
                  </span>
                  <Badge variant="outline" className="text-[10px] uppercase font-bold">
                    {activeTemplate.badgeLabel}
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  Modelos fiéis aos blocos de receituário e declarações do consultório.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-1 space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {OFFICIAL_REPORT_TEMPLATES.map((tpl) => {
                    const isSelected = selectedTemplateKey === tpl.key
                    return (
                      <button
                        key={tpl.key}
                        type="button"
                        onClick={() => handleSelectTemplate(tpl.key)}
                        className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5 ${
                          isSelected
                            ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary shadow-xs"
                            : "border-border bg-card/60 hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-[11px] font-bold leading-tight line-clamp-1">
                            {tpl.badgeLabel}
                          </span>
                          {isSelected && (
                            <CheckCircle2 className="h-3 w-3 text-primary shrink-0" />
                          )}
                        </div>
                        <p className="text-[10px] leading-tight line-clamp-2 opacity-80">
                          {tpl.shortDesc}
                        </p>
                      </button>
                    )
                  })}
                </div>

                {/* Modelos Customizados Adicionais se existirem */}
                {customTemplates && customTemplates.length > 0 && (
                  <div className="pt-2 border-t border-border">
                    <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">
                      Modelos Salvos pela Clínica:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {customTemplates.map((ct) => (
                        <button
                          key={ct._id}
                          type="button"
                          onClick={() => handleSelectTemplate(ct._id)}
                          className={`px-2.5 py-1 rounded-lg text-xs border transition-all ${
                            selectedTemplateKey === ct._id
                              ? "bg-primary text-primary-foreground border-primary font-semibold"
                              : "border-border bg-card hover:bg-muted/60 text-muted-foreground"
                          }`}
                        >
                          {ct.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 2. SELEÇÃO DO PACIENTE */}
            <Card className="border-border shadow-xs">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                    <User className="h-4 w-4 text-primary" />
                    <span>2. Paciente / Destinatário</span>
                  </CardTitle>
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer text-muted-foreground hover:text-foreground">
                    <input
                      type="checkbox"
                      checked={isWalkInPatient}
                      onChange={(e) => {
                        setIsWalkInPatient(e.target.checked)
                        if (e.target.checked) {
                          setSelectedPatientId("")
                        }
                      }}
                      className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                    />
                    <span>Paciente avulso (sem cadastro)</span>
                  </label>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-1 space-y-2.5">
                {isWalkInPatient ? (
                  <div>
                    <label className="block text-[11px] font-semibold text-foreground mb-1">
                      Nome Completo do Paciente Avulso
                    </label>
                    <Input
                      value={patientInputName}
                      onChange={(e) => setPatientInputName(e.target.value)}
                      placeholder="Digite o nome completo do paciente..."
                      className="h-9 text-xs font-semibold"
                      autoFocus
                    />
                  </div>
                ) : (
                  <div className="relative">
                    <label className="block text-[11px] font-semibold text-foreground mb-1">
                      Buscar Paciente na Carteira da Clínica
                    </label>
                    <div className="relative">
                      <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={patientSearchTerm || (selectedPatientId ? effectivePatientName : "")}
                        onChange={(e) => {
                          setPatientSearchTerm(e.target.value)
                          setIsPatientDropdownOpen(true)
                          if (!e.target.value) {
                            setSelectedPatientId("")
                          }
                        }}
                        onFocus={() => setIsPatientDropdownOpen(true)}
                        placeholder="Digite o nome ou telefone do paciente cadastrado..."
                        className="h-9 pl-8 text-xs font-semibold"
                      />
                    </div>

                    {/* Dropdown de Autocomplete */}
                    {isPatientDropdownOpen && filteredPatients.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-card border border-border rounded-xl shadow-lg max-h-48 overflow-y-auto p-1 space-y-0.5">
                        {filteredPatients.map((p) => (
                          <div
                            key={p.id}
                            onClick={() => {
                              setSelectedPatientId(p.id)
                              setPatientInputName(p.name)
                              setPatientSearchTerm("")
                              setIsPatientDropdownOpen(false)
                            }}
                            className="px-2.5 py-1.5 rounded-lg text-xs cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors flex items-center justify-between"
                          >
                            <span className="font-semibold text-foreground">{p.name}</span>
                            <span className="text-[11px] text-muted-foreground">{p.phone}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 3. PARÂMETROS ESPECÍFICOS & EDIÇÃO DO TEXTO */}
            <Card className="border-border shadow-xs">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                  <Sliders className="h-4 w-4 text-primary" />
                  <span>3. Dados do Documento & Texto Editável</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-1 space-y-3">
                {/* Linha de Data e CID (para Laudos) */}
                {!activeTemplate.hasTimeRange && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-foreground mb-1">
                        CID-10 / Diagnóstico
                      </label>
                      <Input
                        value={cidCode}
                        onChange={(e) => setCidCode(e.target.value)}
                        placeholder="Ex: M54.5"
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-foreground mb-1">
                        Data de Emissão
                      </label>
                      <Input
                        value={docDate}
                        onChange={(e) => setDocDate(e.target.value)}
                        placeholder="DD/MM/AAAA"
                        className="h-8 text-xs font-semibold"
                      />
                    </div>
                  </div>
                )}

                {/* Sugestões Rápidas de CID */}
                {!activeTemplate.hasTimeRange && (
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[10px] text-muted-foreground mr-1">Rápidos:</span>
                    {QUICK_CID_SUGGESTIONS.slice(0, 4).map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => setCidCode(`${c.code} (${c.label})`)}
                        className="px-1.5 py-0.5 rounded bg-muted text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                      >
                        {c.code}
                      </button>
                    ))}
                  </div>
                )}

                {/* Parâmetros da Declaração de Comparecimento */}
                {activeTemplate.hasTimeRange && (
                  <div className="space-y-2 bg-muted/20 p-2.5 rounded-xl border border-border">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-foreground mb-0.5">
                          Data do Atendimento
                        </label>
                        <Input
                          value={sessionDate}
                          onChange={(e) => setSessionDate(e.target.value)}
                          placeholder="DD/MM/AAAA"
                          className="h-8 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-foreground mb-0.5">
                          Horário Início
                        </label>
                        <Input
                          type="time"
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          className="h-8 text-xs text-center"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-foreground mb-0.5">
                          Horário Fim
                        </label>
                        <Input
                          type="time"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          className="h-8 text-xs text-center"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Caixa de Texto do Laudo (Editável diretamente) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-semibold text-foreground">
                      Texto do Laudo (Totalmente Editável)
                    </label>
                    <button
                      type="button"
                      onClick={() => setBodyText(activeTemplate.defaultText)}
                      className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1"
                    >
                      <RotateCcw className="h-2.5 w-2.5" />
                      <span>Restaurar Texto Original</span>
                    </button>
                  </div>
                  <textarea
                    rows={4}
                    value={bodyText}
                    onChange={(e) => setBodyText(e.target.value)}
                    placeholder="Edite o conteúdo que sairá impresso na folha do paciente..."
                    className="w-full p-2.5 rounded-xl border border-border bg-background text-xs resize-y focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed font-medium"
                  />
                </div>

                {/* Barra de Ajustes Físicos de Impressão */}
                <div className="pt-2 border-t border-border flex flex-wrap items-center justify-between gap-3 text-xs">
                  {/* Seletor A4 / A5 */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-muted-foreground">Papel:</span>
                    <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/30">
                      <button
                        type="button"
                        onClick={() => setPaperSize("a4")}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all ${
                          paperSize === "a4"
                            ? "bg-card text-foreground shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        A4 (Padrão)
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaperSize("a5")}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all ${
                          paperSize === "a5"
                            ? "bg-card text-foreground shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        A5 (Meia folha)
                      </button>
                    </div>
                  </div>

                  {/* Toggle Marca d'água */}
                  <label className="flex items-center gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground">
                    <input
                      type="checkbox"
                      checked={showWatermark}
                      onChange={(e) => setShowWatermark(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                    />
                    <span className="text-[11px] font-semibold">Marca d'água</span>
                  </label>
                </div>
              </CardContent>
            </Card>

            {/* BOTÕES DE DISPARO RÁPIDO */}
            <div className="flex items-center gap-2 pt-1">
              <Button
                type="button"
                onClick={handlePrint}
                className="flex-1 h-11 bg-primary text-primary-foreground font-bold shadow-md hover:bg-primary/90 text-sm gap-2 rounded-xl"
              >
                <Printer className="h-4 w-4" />
                <span>Imprimir Agora</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleSaveToHistory}
                disabled={isSaving}
                className="h-11 px-4 font-semibold text-xs border-border gap-1.5 rounded-xl hover:bg-muted/80"
                title="Salvar no histórico sem imprimir"
              >
                <Save className="h-4 w-4 text-muted-foreground" />
                <span>{isSaving ? "Salvando..." : "Salvar"}</span>
              </Button>
            </div>
          </div>

          {/* PREVIEW EM TEMPO REAL (DIREITA - 7 COLUNAS) */}
          <div className="lg:col-span-7 bg-muted/20 border border-border rounded-2xl p-4 sm:p-6 overflow-y-auto max-h-[85vh] flex flex-col items-center justify-start print:p-0 print:m-0 print:border-none print:bg-white">
            <div className="w-full flex items-center justify-between pb-3 mb-3 border-b border-border text-xs print:hidden">
              <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5 text-primary" />
                <span>Visualização Real da Folha Impressa</span>
              </span>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px] font-mono">
                  {paperSize === "a4" ? "Formato A4 (210 × 297 mm)" : "Formato A5 (148 × 210 mm)"}
                </Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handlePrint}
                  className="h-7 px-2 text-xs font-semibold gap-1 text-primary hover:bg-primary/10"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Imprimir</span>
                </Button>
              </div>
            </div>

            {/* FOLHA TIMBRADA VETORIAL */}
            <div className="w-full flex justify-center">
              <PrintableReportSheet
                id="printable-report-sheet"
                template={activeTemplate}
                patientName={effectivePatientName}
                cidCode={cidCode}
                dateStr={docDate}
                sessionDateStr={sessionDate}
                startTime={startTime}
                endTime={endTime}
                bodyText={bodyText}
                paperSize={paperSize}
                showWatermark={showWatermark}
                signatureImageUrl={signatureImageUrl}
                clinicLogoUrl={theme.logoUrl || clinicSettings?.logoUrl}
                clinicName={theme.clinicName || clinicSettings?.clinicName || "Clinica Dr Marcelo"}
                clinicSubtitle={
                  theme.clinicSubtitle ||
                  clinicSettings?.clinicSubtitle ||
                  "Fisioterapia, Studio de Pilates & RPG"
                }
                professionalName={activeProfessional.name}
                crefito={activeProfessional.crefito}
                phone1={theme.phone || clinicSettings?.phone || "(22) 9 9999-1417"}
                phone2="(22) 2764-2491"
                addressLine1={
                  theme.address ||
                  clinicSettings?.address ||
                  "Rodovia Amaral Peixoto, nº 4473 - 3º andar, sala 302"
                }
                addressLine2="Edifício Comercial Porto Florido II - Centro, Rio das Ostras - RJ"
                isDraftPreview={true}
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 2: HISTÓRICO DE LAUDOS E DOCUMENTOS SALVOS                             */}
      {/* ========================================================================= */}
      {activeTab === "history" && (
        <Card className="border-border shadow-xs">
          <CardHeader className="p-4 pb-3 border-b border-border">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <History className="h-4 w-4 text-primary" />
                  <span>Histórico de Laudos & Declarações Emitidos</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Consulte, reimprima ou remova qualquer documento emitido na clínica.
                </CardDescription>
              </div>

              {/* Filtros rápidos de busca */}
              <div className="flex items-center gap-2">
                <div className="relative w-48 sm:w-64">
                  <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    placeholder="Buscar por paciente ou CID..."
                    className="h-8 pl-8 text-xs"
                  />
                </div>
                <select
                  value={historyFilterType}
                  onChange={(e) => setHistoryFilterType(e.target.value)}
                  className="h-8 px-2 rounded-lg border border-border bg-background text-xs font-semibold"
                >
                  <option value="all">Todos os Tipos</option>
                  <option value="report">Apenas Laudos</option>
                  <option value="certificate">Apenas Declarações</option>
                </select>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {filteredReports.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground space-y-2">
                <FileText className="h-8 w-8 mx-auto text-muted-foreground/50" />
                <p className="text-sm font-semibold">Nenhum laudo emitido até o momento.</p>
                <p className="text-xs">
                  Utilize a aba "Emissão Rápida" para gerar e salvar o primeiro documento da clínica.
                </p>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setActiveTab("emission")}
                  className="text-xs mt-2"
                >
                  Ir para Emissão Rápida
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto w-full">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">Data</th>
                      <th className="py-2.5 px-4 font-semibold">Paciente</th>
                      <th className="py-2.5 px-4 font-semibold">Tipo de Documento</th>
                      <th className="py-2.5 px-4 font-semibold">Diagnóstico (CID)</th>
                      <th className="py-2.5 px-4 font-semibold">Profissional</th>
                      <th className="py-2.5 px-4 text-right font-semibold">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredReports.map((r) => {
                      const isCert = r.type === "certificate"
                      return (
                        <tr key={r._id} className="hover:bg-muted/20 transition-colors">
                          <td className="py-3 px-4 font-medium whitespace-nowrap">
                            {r.date || formatDateBR(r.createdAt)}
                          </td>
                          <td className="py-3 px-4 font-bold text-foreground">
                            {r.patientName || (r.patientId ? "Paciente Cadastrado" : "Não informado")}
                          </td>
                          <td className="py-3 px-4">
                            <Badge
                              variant="outline"
                              className={
                                isCert
                                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20 text-[10px]"
                                  : "bg-primary/10 text-primary border-primary/20 text-[10px]"
                              }
                            >
                              {isCert ? "Declaração de Comparecimento" : "Laudo Fisioterapêutico"}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-muted-foreground">
                            {r.diagnosticCid || "—"}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {r.signedProfessionalName || "Dr. Marcelo"}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap space-x-1.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleLoadFromHistory(r)}
                              className="h-7 px-2 text-xs font-semibold gap-1 text-primary hover:bg-primary/10"
                              title="Carregar para reimprimir ou editar"
                            >
                              <Printer className="h-3 w-3" />
                              <span>Reimprimir</span>
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                if (window.confirm("Deseja realmente remover este laudo do histórico?")) {
                                  try {
                                    await deleteReportMutation({ id: r._id })
                                    setSaveFeedback("Laudo removido com sucesso.")
                                  } catch (err: any) {
                                    setSaveFeedback("Erro ao remover: " + err.message)
                                  }
                                }
                              }}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              title="Excluir do histórico"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* ABA 3: MODELOS & TEMPLATES DA CLÍNICA                                      */}
      {/* ========================================================================= */}
      {activeTab === "templates" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-foreground">Biblioteca de Modelos</h3>
              <p className="text-xs text-muted-foreground">
                Modelos prontos da clínica e templates customizados salvos pela equipe.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => setIsCreatingTemplate(!isCreatingTemplate)}
              className="text-xs gap-1.5 font-semibold"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{isCreatingTemplate ? "Fechar Formulário" : "Novo Modelo Personalizado"}</span>
            </Button>
          </div>

          {/* Formulário de Criação de Template */}
          {isCreatingTemplate && (
            <Card className="border-primary/30 bg-primary/5 shadow-xs animate-fade-in">
              <form onSubmit={handleCreateCustomTemplate}>
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-bold text-primary">
                    Cadastrar Novo Modelo de Documento
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-1 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-foreground mb-1">
                        Título do Modelo
                      </label>
                      <Input
                        value={newTemplateTitle}
                        onChange={(e) => setNewTemplateTitle(e.target.value)}
                        placeholder="Ex: Laudo Pós-Operatório Joelho"
                        className="h-8 text-xs font-semibold"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-foreground mb-1">
                        Categoria
                      </label>
                      <select
                        value={newTemplateCategory}
                        onChange={(e) => setNewTemplateCategory(e.target.value as any)}
                        className="w-full h-8 px-2 rounded-lg border border-border bg-background text-xs font-semibold"
                      >
                        <option value="laudo">Laudo Fisioterapêutico</option>
                        <option value="declaracao">Declaração de Comparecimento</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-foreground mb-1">
                        CID Padrão (Opcional)
                      </label>
                      <Input
                        value={newTemplateCid}
                        onChange={(e) => setNewTemplateCid(e.target.value)}
                        placeholder="Ex: M54.5"
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-foreground mb-1">
                      Texto Padrão do Modelo
                    </label>
                    <textarea
                      rows={3}
                      value={newTemplateContent}
                      onChange={(e) => setNewTemplateContent(e.target.value)}
                      placeholder="Digite o texto que servirá de base ao selecionar esse modelo..."
                      className="w-full p-2 rounded-lg border border-border bg-background text-xs resize-none focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed"
                      required
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsCreatingTemplate(false)}
                      className="text-xs"
                    >
                      Cancelar
                    </Button>
                    <Button type="submit" size="sm" disabled={isSaving} className="text-xs font-bold">
                      {isSaving ? "Salvando..." : "Salvar Modelo"}
                    </Button>
                  </div>
                </CardContent>
              </form>
            </Card>
          )}

          {/* Grade dos 5 Modelos Oficiais das Fotos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {OFFICIAL_REPORT_TEMPLATES.map((tpl) => (
              <Card key={tpl.key} className="border-border shadow-xs hover:border-primary/40 transition-all">
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold text-foreground">
                      {tpl.badgeLabel}
                    </CardTitle>
                    <Badge variant="outline" className="text-[10px] bg-muted">
                      Modelo Oficial Físico
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">{tpl.shortDesc}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-1 space-y-3">
                  <p className="text-xs text-muted-foreground leading-relaxed italic bg-muted/20 p-2.5 rounded-lg border border-border/50">
                    "{tpl.defaultText}"
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    {tpl.defaultCid ? (
                      <span className="text-[11px] font-mono text-muted-foreground">
                        CID Padrão: <b>{tpl.defaultCid}</b>
                      </span>
                    ) : (
                      <span />
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        handleSelectTemplate(tpl.key)
                        setActiveTab("emission")
                      }}
                      className="text-xs h-8 gap-1.5 font-semibold text-primary hover:bg-primary/10"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      <span>Usar para Emitir</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Modelos Customizados Salvos */}
            {customTemplates &&
              customTemplates.map((ct) => (
                <Card key={ct._id} className="border-primary/20 shadow-xs">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-bold text-foreground">
                        {ct.title}
                      </CardTitle>
                      <Badge variant="secondary" className="text-[10px]">
                        Personalizado
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-1 space-y-3">
                    <p className="text-xs text-muted-foreground leading-relaxed italic bg-muted/20 p-2.5 rounded-lg border border-border/50">
                      "{ct.content}"
                    </p>
                    <div className="flex items-center justify-between pt-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          if (window.confirm(`Excluir o modelo "${ct.title}"?`)) {
                            await deleteTemplateMutation({ id: ct._id })
                          }
                        }}
                        className="text-xs text-destructive hover:bg-destructive/10 h-8 px-2"
                      >
                        Excluir Modelo
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          handleSelectTemplate(ct._id)
                          setActiveTab("emission")
                        }}
                        className="text-xs h-8 gap-1.5 font-semibold text-primary hover:bg-primary/10"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        <span>Usar para Emitir</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
