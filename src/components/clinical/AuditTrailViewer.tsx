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
} from "lucide-react"
import type { AuditLog } from "@/types"

interface AuditTrailViewerProps {
  logs: AuditLog[]
}

export const AuditTrailViewer: React.FC<AuditTrailViewerProps> = ({ logs = [] }) => {
  const [searchTerm, setSearchTerm] = useState("")
  const [actionFilter, setActionFilter] = useState("all")

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.patientName && log.patientName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.details && log.details.toLowerCase().includes(searchTerm.toLowerCase())) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesAction = actionFilter === "all" || log.action.includes(actionFilter)

    return matchesSearch && matchesAction
  })

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

  const exportAuditCsv = () => {
    const headers = ["Data/Hora", "Usuario", "Perfil", "Acao", "Paciente", "Detalhes", "IP"]
    const rows = filteredLogs.map((l) => [
      new Date(l.timestamp).toLocaleString("pt-BR"),
      l.userName,
      l.userRole,
      l.action,
      l.patientName || "N/A",
      `"${(l.details || "").replace(/"/g, '""')}"`,
      l.ipAddress || "N/A",
    ])
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", `trilha_auditoria_lgpd_${Date.now()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={exportAuditCsv}
              className="text-xs h-8 gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Exportar CSV</span>
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
            <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold sticky top-0">
              <tr>
                <th className="py-2.5 px-3">Data / Hora</th>
                <th className="py-2.5 px-3">Operador</th>
                <th className="py-2.5 px-3">Ação</th>
                <th className="py-2.5 px-3">Paciente</th>
                <th className="py-2.5 px-3">Detalhes</th>
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
  )
}
