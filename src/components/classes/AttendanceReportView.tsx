import React, { useState, useMemo } from "react"
import { useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import { useClinicData } from "@/contexts/ClinicDataContext"
import { formatDateBR, formatTimeBR, getTodayDateString } from "@/lib/dateUtils"
import { AbsenceModal } from "./AbsenceModal"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Calendar,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  Download,
  FileSpreadsheet,
  Layers,
  ArrowUpDown,
  UserCheck,
  UserX,
  Repeat,
  Info,
  ChevronDown,
  Loader2,
  CalendarDays,
  DoorOpen,
  Sparkles,
  TrendingUp,
} from "lucide-react"

type PeriodPreset = "today" | "yesterday" | "this_week" | "this_month" | "last_month" | "custom"

interface AttendanceReportViewProps {
  onBackToClasses?: () => void
}

export const AttendanceReportView: React.FC<AttendanceReportViewProps> = ({ onBackToClasses }) => {
  const { rooms, professionals, checkIn } = useClinicData()

  // Estado dos Filtros
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("this_month")
  const [startDate, setStartDate] = useState(() => {
    const today = getTodayDateString()
    return `${today.slice(0, 7)}-01` // Início do mês atual
  })
  const [endDate, setEndDate] = useState(() => getTodayDateString())

  const [selectedProfessional, setSelectedProfessional] = useState<string>("all")
  const [selectedRoom, setSelectedRoom] = useState<string>("all")
  const [selectedStatus, setSelectedStatus] = useState<string>("all")
  const [searchStudent, setSearchStudent] = useState<string>("")

  // Modo de visualização: "detailed" (sessão por sessão) ou "students" (consolidado por aluno)
  const [viewMode, setViewMode] = useState<"detailed" | "students">("detailed")

  // Estado para exportação
  const [isExporting, setIsExporting] = useState(false)

  // Estado para edição de falta a partir do relatório
  const [absenceModalState, setAbsenceModalState] = useState<{
    isOpen: boolean
    scheduleId: string
    participantId: string
    studentName: string
    studentPhone?: string
    classNameTitle: string
    currentNotes?: string
    isDebited?: boolean
  }>({
    isOpen: false,
    scheduleId: "",
    participantId: "",
    studentName: "",
    classNameTitle: "",
  })

  // Manipulador de Atalhos de Período
  const handlePresetChange = (preset: PeriodPreset) => {
    setPeriodPreset(preset)
    const today = new Date()
    const y = today.getFullYear()
    const m = today.getMonth()

    if (preset === "today") {
      const todayStr = getTodayDateString()
      setStartDate(todayStr)
      setEndDate(todayStr)
    } else if (preset === "yesterday") {
      const d = new Date(today)
      d.setDate(d.getDate() - 1)
      const yesterdayStr = d.toISOString().split("T")[0]
      setStartDate(yesterdayStr)
      setEndDate(yesterdayStr)
    } else if (preset === "this_week") {
      const currentDay = today.getDay() // 0 = Domingo
      const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay
      const monday = new Date(today)
      monday.setDate(today.getDate() + mondayOffset)
      const saturday = new Date(monday)
      saturday.setDate(monday.getDate() + 5) // Segunda a Sábado

      setStartDate(monday.toISOString().split("T")[0])
      setEndDate(saturday.toISOString().split("T")[0])
    } else if (preset === "this_month") {
      const firstDay = new Date(y, m, 1)
      const lastDay = new Date(y, m + 1, 0)
      setStartDate(firstDay.toISOString().split("T")[0])
      setEndDate(lastDay.toISOString().split("T")[0])
    } else if (preset === "last_month") {
      const firstDay = new Date(y, m - 1, 1)
      const lastDay = new Date(y, m, 0)
      setStartDate(firstDay.toISOString().split("T")[0])
      setEndDate(lastDay.toISOString().split("T")[0])
    }
  }

  // Consulta Reativa ao Backend Convex
  const reportData = useQuery(api.schedules.getAttendanceReport, {
    startDate,
    endDate,
    professionalId: selectedProfessional !== "all" ? (selectedProfessional as any) : undefined,
    roomId: selectedRoom !== "all" ? (selectedRoom as any) : undefined,
    status: selectedStatus !== "all" ? selectedStatus : undefined,
  })

  const isLoading = reportData === undefined

  // Filtragem local por busca de nome de aluno
  const filteredRecords = useMemo(() => {
    if (!reportData?.records) return []
    if (!searchStudent.trim()) return reportData.records
    const term = searchStudent.toLowerCase()
    return reportData.records.filter(
      (r) =>
        r.patientName.toLowerCase().includes(term) ||
        r.patientPhone.toLowerCase().includes(term) ||
        r.scheduleTitle.toLowerCase().includes(term)
    )
  }, [reportData?.records, searchStudent])

  const filteredStudentSummaries = useMemo(() => {
    if (!reportData?.patientSummaries) return []
    if (!searchStudent.trim()) return reportData.patientSummaries
    const term = searchStudent.toLowerCase()
    return reportData.patientSummaries.filter(
      (s) => s.patientName.toLowerCase().includes(term) || s.patientPhone.toLowerCase().includes(term)
    )
  }, [reportData?.patientSummaries, searchStudent])

  // Estatísticas e KPIs calculados
  const stats = reportData?.stats || {
    totalRecords: 0,
    totalPresent: 0,
    totalAbsence: 0,
    totalJustified: 0,
    totalScheduled: 0,
    totalReplacement: 0,
    totalDebitedAbsences: 0,
    totalExcusedAbsences: 0,
    attendanceRate: 0,
  }

  // Exportação para Excel (.xlsx) com múltiplas abas
  const handleExportExcel = async () => {
    if (!reportData) return
    setIsExporting(true)
    try {
      // Import dinâmico da biblioteca XLSX (0 KB no bundle inicial)
      const XLSX = await import("xlsx")

      // Aba 1: Histórico Detalhado
      const detailedRows = filteredRecords.map((r) => {
        let statusLabel = "Agendado"
        if (r.status === "present") statusLabel = "Presente"
        else if (r.status === "absence") statusLabel = "Falta"
        else if (r.status === "justified_absence") statusLabel = "Desmarcado (Reposição)"
        else if (r.status === "replacement") statusLabel = "Reposição"

        let packageDebitLabel = "Não aplicável"
        if (r.status === "present") {
          packageDebitLabel = r.isPackageDebited ? `Debitado (${r.packageName || "Plano"})` : "Sem Pacote / Avulso"
        } else if (r.status === "absence") {
          packageDebitLabel = r.isPackageDebited ? `Falta Debitada (${r.packageName || "Plano"})` : "Falta Abonada (Sem Débito)"
        }

        const checkInTime = r.checkedInAt
          ? formatTimeBR(new Date(r.checkedInAt))
          : "-"

        return {
          Data: formatDateBR(r.date),
          Horário: `${r.startTime} - ${r.endTime}`,
          "Turma / Atendimento": r.scheduleTitle,
          Sala: r.roomName,
          Instrutor: r.professionalName,
          "Nome do Aluno": r.patientName,
          Telefone: r.patientPhone,
          Status: statusLabel,
          "Débito de Plano": packageDebitLabel,
          "Hora do Check-in": checkInTime,
          "Observação / Motivo": r.notes || "-",
        }
      })

      // Aba 2: Resumo Consolidado por Aluno
      const studentRows = filteredStudentSummaries.map((s) => {
        let sit = "Excelente"
        if (s.attendanceRate < 70) sit = "Atenção (Baixa Frequência)"
        else if (s.attendanceRate < 85) sit = "Regular"

        return {
          "Nome do Aluno": s.patientName,
          Telefone: s.patientPhone,
          "Total de Aulas": s.total,
          Presenças: s.presents,
          Faltas: s.absences,
          Reposições: s.replacements,
          "Aulas Concluídas": s.concluded,
          "Taxa de Assiduidade (%)": `${s.attendanceRate}%`,
          Situação: sit,
        }
      })

      // Criar Workbook
      const wb = XLSX.utils.book_new()

      const wsDetailed = XLSX.utils.json_to_sheet(detailedRows)
      const wsStudents = XLSX.utils.json_to_sheet(studentRows)

      // Definir larguras de colunas para formatação agradável
      wsDetailed["!cols"] = [
        { wch: 12 }, // Data
        { wch: 14 }, // Horário
        { wch: 28 }, // Turma
        { wch: 22 }, // Sala
        { wch: 22 }, // Instrutor
        { wch: 28 }, // Aluno
        { wch: 16 }, // Telefone
        { wch: 14 }, // Status
        { wch: 26 }, // Débito
        { wch: 16 }, // Check-in
        { wch: 35 }, // Observação
      ]

      wsStudents["!cols"] = [
        { wch: 28 }, // Aluno
        { wch: 16 }, // Telefone
        { wch: 14 }, // Total
        { wch: 12 }, // Presenças
        { wch: 10 }, // Faltas
        { wch: 12 }, // Reposições
        { wch: 16 }, // Concluídas
        { wch: 22 }, // Taxa
        { wch: 26 }, // Situação
      ]

      XLSX.utils.book_append_sheet(wb, wsDetailed, "Histórico Detalhado")
      XLSX.utils.book_append_sheet(wb, wsStudents, "Consolidado por Aluno")

      // Salvar arquivo
      const filename = `Relatorio_Frequencia_AltarFisio_${startDate}_a_${endDate}.xlsx`
      XLSX.writeFile(wb, filename)
    } catch (err) {
      console.error("Erro ao gerar planilha Excel:", err)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Cabeçalho do Relatório */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-card p-4 rounded-2xl border border-border shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Relatório de Presenças & Faltas</h2>
              <p className="text-xs text-muted-foreground">
                Controle integral de check-ins, frequência e assiduidade dos alunos
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onBackToClasses && (
            <Button variant="outline" size="sm" onClick={onBackToClasses} className="text-xs gap-1">
              <Calendar className="h-3.5 w-3.5" />
              <span>Painel de Turmas</span>
            </Button>
          )}

          <Button
            size="sm"
            onClick={handleExportExcel}
            disabled={isExporting || isLoading || filteredRecords.length === 0}
            className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Gerando Excel...</span>
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5" />
                <span>Exportar Excel (.xlsx)</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Barra de Filtros Inteligentes */}
      <div className="p-4 bg-card rounded-2xl border border-border/80 shadow-xs space-y-3">
        {/* Linha 1: Atalhos Rápidos de Período */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border/60">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground mr-1 flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              Período:
            </span>
            <button
              type="button"
              onClick={() => handlePresetChange("today")}
              className={`text-xs px-2.5 py-1 rounded-xl font-medium transition-colors ${
                periodPreset === "today"
                  ? "bg-primary text-primary-foreground font-bold shadow-xs"
                  : "bg-muted/40 hover:bg-muted text-muted-foreground"
              }`}
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => handlePresetChange("yesterday")}
              className={`text-xs px-2.5 py-1 rounded-xl font-medium transition-colors ${
                periodPreset === "yesterday"
                  ? "bg-primary text-primary-foreground font-bold shadow-xs"
                  : "bg-muted/40 hover:bg-muted text-muted-foreground"
              }`}
            >
              Ontem
            </button>
            <button
              type="button"
              onClick={() => handlePresetChange("this_week")}
              className={`text-xs px-2.5 py-1 rounded-xl font-medium transition-colors ${
                periodPreset === "this_week"
                  ? "bg-primary text-primary-foreground font-bold shadow-xs"
                  : "bg-muted/40 hover:bg-muted text-muted-foreground"
              }`}
            >
              Esta Semana
            </button>
            <button
              type="button"
              onClick={() => handlePresetChange("this_month")}
              className={`text-xs px-2.5 py-1 rounded-xl font-medium transition-colors ${
                periodPreset === "this_month"
                  ? "bg-primary text-primary-foreground font-bold shadow-xs"
                  : "bg-muted/40 hover:bg-muted text-muted-foreground"
              }`}
            >
              Este Mês
            </button>
            <button
              type="button"
              onClick={() => handlePresetChange("last_month")}
              className={`text-xs px-2.5 py-1 rounded-xl font-medium transition-colors ${
                periodPreset === "last_month"
                  ? "bg-primary text-primary-foreground font-bold shadow-xs"
                  : "bg-muted/40 hover:bg-muted text-muted-foreground"
              }`}
            >
              Mês Anterior
            </button>
          </div>

          {/* Seletores de Data Personalizada */}
          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">De:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  setPeriodPreset("custom")
                }}
                className="h-8 px-2 text-xs rounded-xl border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Até:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value)
                  setPeriodPreset("custom")
                }}
                className="h-8 px-2 text-xs rounded-xl border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        {/* Linha 2: Filtros de Instrutor, Sala, Status e Busca */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
          {/* Busca por Aluno */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar aluno ou turma..."
              value={searchStudent}
              onChange={(e) => setSearchStudent(e.target.value)}
              className="pl-8 h-9 text-xs rounded-xl"
            />
          </div>

          {/* Instrutor */}
          <div>
            <select
              value={selectedProfessional}
              onChange={(e) => setSelectedProfessional(e.target.value)}
              className="w-full h-9 px-3 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">Todos os Instrutores</option>
              {professionals
                .filter((p) => p.active)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Sala */}
          <div>
            <select
              value={selectedRoom}
              onChange={(e) => setSelectedRoom(e.target.value)}
              className="w-full h-9 px-3 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">Todas as Salas</option>
              {rooms
                .filter((r) => r.isActive)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full h-9 px-3 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">Todos os Status</option>
              <option value="present">Presente (Confirmado)</option>
              <option value="absence">Falta</option>
              <option value="justified_absence">Desmarcado (Reposição)</option>
              <option value="scheduled">Agendado (Pendente)</option>
              <option value="replacement">Reposição</option>
            </select>
          </div>
        </div>
      </div>

      {/* Cards de Métricas & KPIs de Assiduidade */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Total de Aulas */}
        <div className="p-3.5 bg-card rounded-2xl border border-border/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-semibold">Total Aulas</span>
            <Calendar className="h-4 w-4 text-primary" />
          </div>
          <div className="text-xl font-bold text-foreground">{stats.totalRecords}</div>
          <p className="text-[10px] text-muted-foreground mt-0.5">atendimentos registrados</p>
        </div>

        {/* Presenças */}
        <div className="p-3.5 bg-emerald-500/5 rounded-2xl border border-emerald-500/20 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 mb-1">
            <span className="text-xs font-semibold">Presenças</span>
            <UserCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
            {stats.totalPresent}
          </div>
          <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">
            check-ins confirmados
          </p>
        </div>

        {/* Faltas */}
        <div className="p-3.5 bg-rose-500/5 rounded-2xl border border-rose-500/20 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-rose-700 dark:text-rose-400 mb-1">
            <span className="text-xs font-semibold">Faltas</span>
            <UserX className="h-4 w-4 text-rose-500" />
          </div>
          <div className="text-xl font-bold text-rose-600 dark:text-rose-400">
            {stats.totalAbsence}
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {stats.totalDebitedAbsences} debitadas • {stats.totalExcusedAbsences} abonadas
          </p>
        </div>

        {/* Reposições */}
        <div className="p-3.5 bg-amber-500/5 rounded-2xl border border-amber-500/20 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-700 dark:text-amber-400 mb-1">
            <span className="text-xs font-semibold">Reposições</span>
            <Repeat className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-amber-600 dark:text-amber-400">
            {stats.totalReplacement + stats.totalJustified}
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">créditos gerados/usados</p>
        </div>

        {/* Taxa de Assiduidade Geral */}
        <div className="p-3.5 bg-primary/5 rounded-2xl border border-primary/20 shadow-xs flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-primary mb-1">
            <span className="text-xs font-semibold">Taxa de Assiduidade</span>
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <div className="text-xl font-bold text-primary">
            {stats.attendanceRate}%
          </div>
          {/* Barra de Progresso */}
          <div className="w-full bg-primary/15 h-1.5 rounded-full overflow-hidden mt-1">
            <div
              className="bg-primary h-full transition-all duration-500 rounded-full"
              style={{ width: `${Math.min(100, Math.max(0, stats.attendanceRate))}%` }}
            />
          </div>
        </div>
      </div>

      {/* Barra de Alternância de Abas: Detalhada vs Consolidada */}
      <div className="flex items-center justify-between border-b border-border/80 pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode("detailed")}
            className={`text-xs px-3.5 py-1.5 rounded-xl font-semibold transition-all flex items-center gap-1.5 ${
              viewMode === "detailed"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Histórico Detalhado ({filteredRecords.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode("students")}
            className={`text-xs px-3.5 py-1.5 rounded-xl font-semibold transition-all flex items-center gap-1.5 ${
              viewMode === "students"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>Consolidado por Aluno ({filteredStudentSummaries.length})</span>
          </button>
        </div>

        <span className="text-[11px] text-muted-foreground hidden sm:inline-block">
          Mostrando dados de <strong>{formatDateBR(startDate)}</strong> a <strong>{formatDateBR(endDate)}</strong>
        </span>
      </div>

      {/* Conteúdo da Visualização */}
      {isLoading ? (
        <div className="py-16 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-xs">Carregando dados de frequência da Altar Fisio...</span>
        </div>
      ) : viewMode === "detailed" ? (
        /* VISÃO 1: LISTA DETALHADA SESSÃO POR SESSÃO */
        <div className="bg-card rounded-2xl border border-border/80 shadow-xs overflow-hidden">
          {filteredRecords.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              Nenhum registro de atendimento encontrado para os filtros selecionados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-muted/40 border-b border-border/70 text-muted-foreground font-semibold">
                    <th className="p-3 pl-4">Data & Horário</th>
                    <th className="p-3">Turma & Sala</th>
                    <th className="p-3">Instrutor</th>
                    <th className="p-3">Aluno</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Débito do Plano</th>
                    <th className="p-3">Check-in em</th>
                    <th className="p-3">Observações</th>
                    <th className="p-3 pr-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredRecords.map((r) => {
                    const isPresent = r.status === "present"
                    const isAbsence = r.status === "absence"
                    const isJustified = r.status === "justified_absence"
                    const isReplacement = r.status === "replacement"

                    return (
                      <tr
                        key={r.participantId}
                        className={`hover:bg-muted/30 transition-colors ${
                          isPresent ? "bg-emerald-500/2" : isAbsence ? "bg-rose-500/2" : ""
                        }`}
                      >
                        <td className="p-3 pl-4 whitespace-nowrap">
                          <div className="font-semibold text-foreground">{formatDateBR(r.date)}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {r.startTime} - {r.endTime}
                          </div>
                        </td>

                        <td className="p-3 whitespace-nowrap">
                          <div className="font-medium text-foreground">{r.scheduleTitle}</div>
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <DoorOpen className="h-3 w-3 text-primary" />
                            {r.roomName}
                          </div>
                        </td>

                        <td className="p-3 whitespace-nowrap text-muted-foreground">
                          {r.professionalName}
                        </td>

                        <td className="p-3 whitespace-nowrap">
                          <div className="font-bold text-foreground">{r.patientName}</div>
                          <div className="text-[10px] text-muted-foreground">{r.patientPhone}</div>
                        </td>

                        <td className="p-3 whitespace-nowrap">
                          {isPresent && (
                            <Badge variant="success" className="text-[10px] py-0 px-2 gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Presente
                            </Badge>
                          )}
                          {isAbsence && (
                            <Badge variant="destructive" className="text-[10px] py-0 px-2 gap-1">
                              <XCircle className="h-3 w-3" />
                              Falta
                            </Badge>
                          )}
                          {isJustified && (
                            <Badge variant="outline" className="text-[10px] py-0 px-2 gap-1">
                              <Repeat className="h-3 w-3" />
                              Desmarcado
                            </Badge>
                          )}
                          {isReplacement && (
                            <Badge variant="warning" className="text-[10px] py-0 px-2 gap-1">
                              Reposição
                            </Badge>
                          )}
                          {r.status === "scheduled" && (
                            <Badge variant="secondary" className="text-[10px] py-0 px-2">
                              Agendado
                            </Badge>
                          )}
                        </td>

                        <td className="p-3 whitespace-nowrap">
                          {isPresent ? (
                            r.isPackageDebited ? (
                              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                                1 aula debitada
                              </span>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">Avulso</span>
                            )
                          ) : isAbsence ? (
                            r.isPackageDebited ? (
                              <span className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                                Débito efetuado
                              </span>
                            ) : (
                              <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                                Falta abonada
                              </span>
                            )
                          ) : (
                            <span className="text-[11px] text-muted-foreground">-</span>
                          )}
                        </td>

                        <td className="p-3 whitespace-nowrap text-muted-foreground text-[11px]">
                          {r.checkedInAt ? formatTimeBR(new Date(r.checkedInAt)) : "-"}
                        </td>

                        <td className="p-3 text-[11px] text-muted-foreground max-w-[200px] truncate" title={r.notes}>
                          {r.notes || "-"}
                        </td>

                        <td className="p-3 pr-4 text-right whitespace-nowrap">
                          {/* Ação rápida de ajuste de presença ou falta */}
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant={isPresent ? "default" : "outline"}
                              onClick={() => checkIn(r.scheduleId, r.participantId, isPresent ? "scheduled" : "present")}
                              className="h-6 px-1.5 text-[10px] gap-1"
                              title={isPresent ? "Desfazer presença" : "Confirmar presença"}
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              <span>{isPresent ? "Presente" : "Check-in"}</span>
                            </Button>

                            <Button
                              size="sm"
                              variant={isAbsence ? "destructive" : "ghost"}
                              onClick={() => {
                                setAbsenceModalState({
                                  isOpen: true,
                                  scheduleId: r.scheduleId,
                                  participantId: r.participantId,
                                  studentName: r.patientName,
                                  studentPhone: r.patientPhone,
                                  classNameTitle: r.scheduleTitle,
                                  currentNotes: r.notes,
                                  isDebited: r.isPackageDebited,
                                })
                              }}
                              className="h-6 px-1.5 text-[10px] gap-1"
                              title="Registrar ou ajustar falta"
                            >
                              <XCircle className="h-3 w-3" />
                              <span>{isAbsence ? "Falta" : "Faltou"}</span>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* VISÃO 2: CONSOLIDADO POR ALUNO (RANKING DE ASSIDUIDADE) */
        <div className="bg-card rounded-2xl border border-border/80 shadow-xs overflow-hidden">
          {filteredStudentSummaries.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              Nenhum aluno encontrado para os critérios selecionados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-muted/40 border-b border-border/70 text-muted-foreground font-semibold">
                    <th className="p-3 pl-4">Aluno</th>
                    <th className="p-3">Telefone</th>
                    <th className="p-3 text-center">Total de Aulas</th>
                    <th className="p-3 text-center">Presenças</th>
                    <th className="p-3 text-center">Faltas</th>
                    <th className="p-3 text-center">Reposições</th>
                    <th className="p-3">Taxa de Assiduidade</th>
                    <th className="p-3 pr-4">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredStudentSummaries.map((s) => {
                    const isHigh = s.attendanceRate >= 85
                    const isMedium = s.attendanceRate >= 70 && s.attendanceRate < 85
                    const isLow = s.attendanceRate < 70

                    return (
                      <tr key={s.patientId} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3 pl-4 font-bold text-foreground whitespace-nowrap">
                          {s.patientName}
                        </td>
                        <td className="p-3 text-muted-foreground whitespace-nowrap">
                          {s.patientPhone || "-"}
                        </td>
                        <td className="p-3 text-center font-semibold text-foreground">
                          {s.total}
                        </td>
                        <td className="p-3 text-center font-bold text-emerald-600 dark:text-emerald-400">
                          {s.presents}
                        </td>
                        <td className="p-3 text-center font-bold text-rose-600 dark:text-rose-400">
                          {s.absences}
                        </td>
                        <td className="p-3 text-center text-amber-600 dark:text-amber-400 font-semibold">
                          {s.replacements}
                        </td>
                        <td className="p-3 min-w-[140px]">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs w-8 text-right">
                              {s.attendanceRate}%
                            </span>
                            <div className="flex-1 bg-muted h-2 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  isHigh ? "bg-emerald-500" : isMedium ? "bg-amber-500" : "bg-rose-500"
                                }`}
                                style={{ width: `${s.attendanceRate}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="p-3 pr-4 whitespace-nowrap">
                          {isHigh && (
                            <Badge variant="success" className="text-[10px] py-0 px-2">
                              Excelente
                            </Badge>
                          )}
                          {isMedium && (
                            <Badge variant="warning" className="text-[10px] py-0 px-2">
                              Regular
                            </Badge>
                          )}
                          {isLow && (
                            <Badge variant="destructive" className="text-[10px] py-0 px-2">
                              Atenção
                            </Badge>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal de Falta reutilizável */}
      <AbsenceModal
        isOpen={absenceModalState.isOpen}
        onClose={() => setAbsenceModalState((prev) => ({ ...prev, isOpen: false }))}
        studentName={absenceModalState.studentName}
        studentPhone={absenceModalState.studentPhone}
        classNameTitle={absenceModalState.classNameTitle}
        initialNotes={absenceModalState.currentNotes}
        initialDebitPackage={absenceModalState.isDebited ?? true}
        onConfirm={async (notes, debitPackage) => {
          await checkIn(absenceModalState.scheduleId, absenceModalState.participantId, "absence", {
            notes,
            debitPackageOnAbsence: debitPackage,
          })
        }}
      />
    </div>
  )
}
