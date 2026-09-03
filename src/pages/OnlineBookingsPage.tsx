import React, { useState, useMemo } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@convex/_generated/api"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select } from "@/components/ui/select-native"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  CalendarCheck,
  Search,
  Filter,
  Check,
  X,
  Eye,
  Send,
  Download,
  FileSpreadsheet,
  ExternalLink,
  Phone,
  Clock,
  User,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  RotateCcw,
} from "lucide-react"
import { formatDateBR } from "@/lib/dateUtils"
import { exportSingleBookingToXls, exportAllBookingsToXls } from "@/lib/exportToXls"

export const OnlineBookingsPage: React.FC = () => {
  const publicBookings = useQuery(api.bookingBuilder.listPublicBookings, {})
  const updateStatus = useMutation(api.bookingBuilder.updatePublicBookingStatus)

  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selectedBookingForModal, setSelectedBookingForModal] = useState<any>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setFeedback(msg)
    setTimeout(() => setFeedback(null), 3500)
  }

  // Estatísticas Rápidas
  const stats = useMemo(() => {
    const list = publicBookings || []
    return {
      total: list.length,
      pending: list.filter((b) => b.status === "pending_approval").length,
      confirmed: list.filter((b) => b.status === "confirmed").length,
      rejected: list.filter((b) => b.status === "rejected").length,
    }
  }, [publicBookings])

  // Filtragem Dinâmica
  const filteredBookings = useMemo(() => {
    return (publicBookings || []).filter((b) => {
      const matchStatus = statusFilter === "all" || b.status === statusFilter
      const term = searchTerm.toLowerCase()
      const matchSearch =
        !term ||
        b.patientName.toLowerCase().includes(term) ||
        b.patientPhone.includes(term) ||
        b.patientCpf.includes(term)
      return matchStatus && matchSearch
    })
  }, [publicBookings, statusFilter, searchTerm])

  // Aprovar Agendamento
  const handleApprove = async (bookingId: string) => {
    try {
      await updateStatus({
        bookingId: bookingId as any,
        status: "confirmed",
      })
      showToast("Agendamento aprovado com sucesso! Vaga confirmada na agenda.")
    } catch (err: any) {
      showToast("Erro ao aprovar: " + (err?.message || "Tente novamente"))
    }
  }

  // Recusar Agendamento
  const handleReject = async (bookingId: string) => {
    const reason = prompt("Informe o motivo da recusa (opcional):")
    if (reason === null) return
    try {
      await updateStatus({
        bookingId: bookingId as any,
        status: "rejected",
        rejectionReason: reason || undefined,
      })
      showToast("Agendamento recusado.")
    } catch (err: any) {
      showToast("Erro ao recusar: " + (err?.message || "Tente novamente"))
    }
  }

  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/agendar` : "https://altarfisio.com.br/agendar"

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Toast Feedback */}
      {feedback && (
        <div className="fixed top-4 right-4 z-50 bg-foreground text-background px-4 py-3 rounded-2xl shadow-xl text-xs font-semibold flex items-center gap-2 animate-scale-in">
          <Sparkles className="h-4 w-4 text-primary" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Header da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <CalendarCheck className="h-6 w-6 text-primary" />
            <span>Agendamentos Online</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Gerencie todas as solicitações realizadas pelos pacientes através do Portal Público (/agendar)
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(publicUrl, "_blank")}
            className="rounded-xl text-xs font-semibold gap-1.5 h-9"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>Ver Página Pública</span>
          </Button>

          <Button
            size="sm"
            onClick={() => exportAllBookingsToXls(filteredBookings)}
            disabled={filteredBookings.length === 0}
            className="rounded-xl text-xs font-bold gap-1.5 h-9 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Exportar Lista em XLS</span>
          </Button>
        </div>
      </div>

      {/* Cards de Métricas / KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/70 shadow-xs rounded-2xl">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Total Recebido
              </div>
              <div className="text-2xl font-extrabold text-foreground mt-1">{stats.total}</div>
            </div>
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <CalendarCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-200/60 dark:border-amber-900/40 shadow-xs rounded-2xl bg-amber-500/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-600">
                Aguardando Aprovação
              </div>
              <div className="text-2xl font-extrabold text-amber-600 mt-1">{stats.pending}</div>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center font-bold">
              <AlertCircle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-200/60 dark:border-emerald-900/40 shadow-xs rounded-2xl bg-emerald-500/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">
                Confirmados
              </div>
              <div className="text-2xl font-extrabold text-emerald-600 mt-1">{stats.confirmed}</div>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center font-bold">
              <Check className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-xs rounded-2xl">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Recusados
              </div>
              <div className="text-2xl font-extrabold text-muted-foreground mt-1">{stats.rejected}</div>
            </div>
            <div className="h-10 w-10 rounded-xl bg-muted text-muted-foreground flex items-center justify-center font-bold">
              <X className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Busca e Filtros */}
      <Card className="border-border/70 shadow-sm rounded-2xl">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nome do paciente, telefone ou CPF..."
                className="pl-10 h-10 rounded-xl text-xs bg-background"
              />
            </div>

            <div className="flex items-center gap-2">
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 rounded-xl text-xs bg-background min-w-[170px]"
              >
                <option value="all">Todos os Status ({stats.total})</option>
                <option value="pending_approval">Aguardando Aprovação ({stats.pending})</option>
                <option value="confirmed">Confirmados ({stats.confirmed})</option>
                <option value="rejected">Recusados ({stats.rejected})</option>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Listagem de Agendamentos */}
      <Card className="border-border/70 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="p-5 border-b border-border/50 bg-muted/20 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-bold text-foreground">
            Solicitações Registradas ({filteredBookings.length})
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            Sincronizado em tempo real com o banco de dados
          </span>
        </CardHeader>

        <CardContent className="p-0">
          {!publicBookings ? (
            <div className="py-12 text-center text-xs text-muted-foreground animate-pulse">
              Carregando agendamentos online...
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="py-14 text-center text-xs text-muted-foreground space-y-2">
              <CalendarCheck className="h-8 w-8 mx-auto text-muted-foreground/40" />
              <p>Nenhum agendamento online encontrado com os filtros atuais.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {filteredBookings.map((b) => (
                <div
                  key={b._id}
                  className="p-4 sm:p-5 hover:bg-muted/30 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">
                      {b.patientName.slice(0, 2).toUpperCase()}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-foreground">{b.patientName}</span>
                        <Badge
                          variant="outline"
                          className={
                            b.status === "confirmed"
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-300 font-semibold"
                              : b.status === "pending_approval"
                              ? "bg-amber-500/10 text-amber-600 border-amber-300 font-semibold"
                              : "bg-destructive/10 text-destructive border-destructive/30 font-semibold"
                          }
                        >
                          {b.status === "confirmed"
                            ? "Confirmado"
                            : b.status === "pending_approval"
                            ? "Aguardando Aprovação"
                            : "Recusado"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Solicitado em {new Date(b.createdAt).toLocaleDateString("pt-BR")}
                        </span>
                      </div>

                      <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3 text-primary" />
                          {b.patientPhone}
                        </span>
                        <span>•</span>
                        <span>CPF: {b.patientCpf}</span>
                        <span>•</span>
                        <span className="font-semibold text-foreground">
                          {formatDateBR(b.date)} às {b.startTime}
                        </span>
                        <span>•</span>
                        <span>{b.roomName || "Sala Principal"}</span>
                      </div>

                      {b.notes && (
                        <p className="text-[11px] text-muted-foreground/80 italic mt-0.5">
                          "{b.notes}"
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedBookingForModal(b)}
                      className="rounded-xl text-xs font-semibold gap-1.5 h-8"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Ver Respostas</span>
                    </Button>

                    {b.status === "pending_approval" && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleApprove(b._id)}
                          className="rounded-xl text-xs font-bold gap-1 h-8 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>Aprovar</span>
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReject(b._id)}
                          className="rounded-xl text-xs font-semibold gap-1 h-8 text-destructive hover:bg-destructive/10"
                        >
                          <X className="h-3.5 w-3.5" />
                          <span>Recusar</span>
                        </Button>
                      </>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const cleanPhone = b.patientPhone.replace(/\D/g, "")
                        window.open(`https://wa.me/55${cleanPhone}`, "_blank")
                      }}
                      className="rounded-xl text-xs font-semibold gap-1.5 h-8 text-emerald-600 hover:bg-emerald-500/10"
                    >
                      <Send className="h-3 w-3" />
                      <span>WhatsApp</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODAL: VER RESPOSTAS DA TRIAGEM COM BOTÃO DE EXPORTAR XLS */}
      <Dialog
        open={!!selectedBookingForModal}
        onOpenChange={(open) => !open && setSelectedBookingForModal(null)}
      >
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2">
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  Ficha da Triagem Clínica Online
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Respostas enviadas pelo paciente no portal público
                </DialogDescription>
              </div>

              {selectedBookingForModal && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportSingleBookingToXls(selectedBookingForModal)}
                  className="rounded-xl text-xs font-semibold gap-1.5 h-8 border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 shrink-0"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  <span>Exportar em XLS</span>
                </Button>
              )}
            </div>
          </DialogHeader>

          {selectedBookingForModal && (
            <div className="space-y-4 py-2 text-xs">
              <div className="p-3.5 rounded-xl bg-muted/30 border border-border/70 space-y-1">
                <div className="font-bold text-sm text-foreground">
                  {selectedBookingForModal.patientName}
                </div>
                <div className="text-muted-foreground">
                  WhatsApp: {selectedBookingForModal.patientPhone} • CPF:{" "}
                  {selectedBookingForModal.patientCpf}
                </div>
                <div className="text-primary font-medium mt-1">
                  {formatDateBR(selectedBookingForModal.date)} às{" "}
                  {selectedBookingForModal.startTime} ({selectedBookingForModal.roomName})
                </div>
              </div>

              <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                {selectedBookingForModal.answers?.map((ans: any, i: number) => (
                  <div key={i} className="p-3 rounded-xl bg-card border border-border/60 space-y-1">
                    <div className="font-semibold text-foreground text-[11px]">{ans.questionLabel}</div>
                    <div className="text-primary font-medium text-xs whitespace-pre-wrap">
                      {ans.answer || "Não informado"}
                    </div>
                  </div>
                ))}

                {selectedBookingForModal.notes && (
                  <div className="p-3 rounded-xl bg-card border border-border/60 space-y-1">
                    <div className="font-semibold text-foreground text-[11px]">
                      Observações Adicionais:
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {selectedBookingForModal.notes}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="flex items-center justify-between sm:justify-between w-full">
            {selectedBookingForModal && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportSingleBookingToXls(selectedBookingForModal)}
                className="rounded-xl text-xs font-semibold gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Baixar Planilha XLS</span>
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedBookingForModal(null)}
              className="rounded-xl text-xs"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
