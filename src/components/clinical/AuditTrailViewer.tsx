import React, { useState } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select-native"
import { formatDateTimeBR } from "@/lib/dateUtils"
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  Download,
  Filter,
  Eye,
  FileDown,
  FileEdit,
  UserCheck,
  Clock,
  User,
  Trash2,
  FileSpreadsheet,
  AlertTriangle,
  Loader2,
} from "lucide-react"
import type { AuditLog } from "@/types"

interface AuditTrailViewerProps {
  logs: AuditLog[]
  onClearLogs?: () => Promise<void> | void
}

export const AuditTrailViewer: React.FC<AuditTrailViewerProps> = ({ logs = [], onClearLogs }) => {
  const [searchTerm, setSearchTerm] = useState("")
  const [actionFilter, setActionFilter] = useState("all")
  const [showConfirmClear, setShowConfirmClear] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.patientName && log.patientName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.details && log.details.toLowerCase().includes(searchTerm.toLowerCase())) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesAction = actionFilter === "all" || log.action.includes(actionFilter)

    return matchesSearch && matchesAction
  })

  const getActionLabel = (action: string) => {
    switch (action) {
      case "view_clinical_record":
        return "Visualização Prontuário"
      case "export_pdf_certificate":
      case "export_pdf_receipt":
      case "export_pdf_report":
      case "export_pdf_tcle":
        return "Emissão Documento PDF"
      case "consent_registered":
        return "Consentimento LGPD"
      case "add_soap_evolution":
        return "Evolução SOAP"
      case "save_clinical_record":
        return "Anamnese Atualizada"
      default:
        return action
    }
  }

  const getActionBadge = (action: string) => {
    switch (action) {
      case "view_clinical_record":
        return (
          <Badge variant="outline" className="text-blue-600 border-blue-500/30 gap-1 text-[10px]">
            <Eye className="h-3 w-3" />
            <span>Visualização Prontuário</span>
          </Badge>
        )
      case "export_pdf_certificate":
      case "export_pdf_receipt":
      case "export_pdf_report":
      case "export_pdf_tcle":
        return (
          <Badge className="bg-purple-500/15 text-purple-600 border-purple-500/30 gap-1 text-[10px]">
            <FileDown className="h-3 w-3" />
            <span>Emissão Documento PDF</span>
          </Badge>
        )
      case "consent_registered":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 gap-1 text-[10px]">
            <UserCheck className="h-3 w-3" />
            <span>Consentimento LGPD</span>
          </Badge>
        )
      case "add_soap_evolution":
        return (
          <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 gap-1 text-[10px]">
            <FileEdit className="h-3 w-3" />
            <span>Evolução SOAP</span>
          </Badge>
        )
      case "save_clinical_record":
        return (
          <Badge variant="outline" className="text-indigo-600 border-indigo-500/30 gap-1 text-[10px]">
            <FileEdit className="h-3 w-3" />
            <span>Anamnese Atualizada</span>
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground text-[10px]">
            {action}
          </Badge>
        )
    }
  }

  const handleExportExcel = async () => {
    if (filteredLogs.length === 0) return
    setIsExporting(true)
    try {
      // Import dinâmico da biblioteca XLSX (0 KB no bundle inicial)
      const XLSX = await import("xlsx")

      const rows = filteredLogs.map((l) => ({
        "Data / Hora": formatDateTimeBR(l.timestamp),
        "Operador": l.userName,
        "Perfil": (l.userRole || "").toUpperCase(),
        "Ação": getActionLabel(l.action),
        "Código Ação": l.action,
        "Paciente": l.patientName || "—",
        "Detalhes": l.details || "—",
        "Endereço IP": l.ipAddress || "—",
      }))

      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(rows)

      // Larguras de colunas formatadas para leitura agradável no Excel
      ws["!cols"] = [
        { wch: 20 }, // Data / Hora
        { wch: 24 }, // Operador
        { wch: 14 }, // Perfil
        { wch: 26 }, // Ação
        { wch: 24 }, // Código Ação
        { wch: 28 }, // Paciente
        { wch: 45 }, // Detalhes
        { wch: 16 }, // IP
      ]

      XLSX.utils.book_append_sheet(wb, ws, "Trilha de Auditoria")
      const now = new Date()
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
      XLSX.writeFile(wb, `trilha_auditoria_altarfisio_${dateStr}.xlsx`)
    } catch (err) {
      console.error("Erro ao exportar trilha de auditoria para Excel:", err)
    } finally {
      setIsExporting(false)
    }
  }

  const handleClearConfirm = async () => {
    if (!onClearLogs) return
    setIsClearing(true)
    try {
      await onClearLogs()
      setShowConfirmClear(false)
    } finally {
      setIsClearing(false)
    }
  }

  return (
    <>
      <Card className="border border-border shadow-sm">
        <CardHeader className="p-4 pb-3 border-b border-border">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>Trilha de Auditoria LGPD & COFFITO</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Rastreamento imutável de acessos, alterações clínicas e emissões de documentos em conformidade com a LGPD.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              {onClearLogs && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowConfirmClear(true)}
                  disabled={logs.length === 0 || isClearing}
                  className="text-xs h-8 gap-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-rose-200 dark:border-rose-900/50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Excluir Trilha</span>
                </Button>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                disabled={isExporting || filteredLogs.length === 0}
                className="text-xs h-8 gap-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Gerando XLS...</span>
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Exportar XLS</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-2 pt-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por operador, paciente ou detalhes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>

            <div className="w-48 sm:w-56">
              <Select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
              >
                <option value="all">Todas as Ações</option>
                <option value="view">Visualizações de Prontuário</option>
                <option value="pdf">Emissões de Documentos / PDF</option>
                <option value="consent">Consentimentos LGPD</option>
                <option value="soap">Evoluções SOAP</option>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[420px]">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-card border-b border-border text-muted-foreground font-semibold sticky top-0 z-10 shadow-xs">
                <tr>
                  <th className="py-2.5 px-3 bg-card whitespace-nowrap">Data / Hora</th>
                  <th className="py-2.5 px-3 bg-card whitespace-nowrap">Operador</th>
                  <th className="py-2.5 px-3 bg-card whitespace-nowrap">Ação</th>
                  <th className="py-2.5 px-3 bg-card whitespace-nowrap">Paciente</th>
                  <th className="py-2.5 px-3 bg-card whitespace-nowrap">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground text-xs">
                      Nenhum registro de auditoria encontrado para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground font-mono text-[11px]">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {formatDateTimeBR(log.timestamp)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-medium whitespace-nowrap">
                        <div>
                          <span>{log.userName}</span>
                          <span className="block text-[10px] text-muted-foreground uppercase font-mono">
                            {log.userRole}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">{getActionBadge(log.action)}</td>
                      <td className="py-2.5 px-3 font-medium whitespace-nowrap">
                        {log.patientName || "—"}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground text-[11px] max-w-md truncate">
                        {log.details || "Acesso aos dados do paciente."}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Confirmação para Exclusão da Trilha */}
      {showConfirmClear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-card border border-border shadow-2xl rounded-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-950/50 text-rose-600 shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Excluir Trilha de Auditoria?</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Esta ação apagará permanentemente todos os <strong>{logs.length}</strong> registros de auditoria da clínica.
                  Essa operação é irreversível e não poderá ser desfeita.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowConfirmClear(false)}
                disabled={isClearing}
                className="text-xs h-8"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleClearConfirm}
                disabled={isClearing}
                className="text-xs h-8 gap-1.5 bg-rose-600 hover:bg-rose-700 text-white"
              >
                {isClearing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Excluindo...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Sim, Excluir Trilha</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

