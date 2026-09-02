import React, { useState, useMemo } from "react"
import { useClinicData } from "@/contexts/ClinicDataContext"
import { useTheme } from "@/contexts/ThemeContext"
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
  Bell,
  Send,
  MessageSquare,
  Mail,
  CheckCircle2,
  Clock,
  Sparkles,
  Smartphone,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  Calendar,
  AlertCircle,
  Eye,
  Info,
  Loader2,
  FileCheck,
} from "lucide-react"
import type { NotificationLog } from "@/types"

export const NotificationsPage: React.FC = () => {
  const {
    notificationLogs,
    notificationStats,
    schedules,
    sendWhatsAppReminder,
    sendEmailReceipt,
    triggerUpcomingRemindersNow,
    testUazapiConnection,
    testResendConnection,
  } = useClinicData()

  // Feedback Toast
  const [feedback, setFeedback] = useState<string | null>(null)
  const showToast = (msg: string) => {
    setFeedback(msg)
    setTimeout(() => setFeedback(null), 4000)
  }

  // Estados de Teste Manual
  const [testTab, setTestTab] = useState<"whatsapp" | "email">("whatsapp")
  const [testName, setTestName] = useState("Juliana Mendes da Silva")
  const [testNumber, setTestNumber] = useState("(11) 98877-6655")
  const [testEmail, setTestEmail] = useState("juliana.mendes@email.com")
  const [testSubject, setTestSubject] = useState("Confirmação de Atendimento — Altar Fisio")
  const [isSendingTest, setIsSendingTest] = useState(false)

  // Estado do Botão de Varredura Manual
  const [isScanning, setIsScanning] = useState(false)

  // Filtros de Logs
  const [channelFilter, setChannelFilter] = useState<"all" | "whatsapp_uazapi" | "email_resend">("all")
  const [statusFilter, setStatusFilter] = useState<"all" | "sent" | "failed" | "queued">("all")
  const [searchQuery, setSearchQuery] = useState("")

  // Modal de Detalhes do Log
  const [selectedLog, setSelectedLog] = useState<NotificationLog | null>(null)

  // Filtragem dos Logs
  const filteredLogs = useMemo(() => {
    return notificationLogs.filter((log) => {
      const matchChannel = channelFilter === "all" || log.channel === channelFilter
      const matchStatus = statusFilter === "all" || log.status === statusFilter
      const q = searchQuery.toLowerCase().trim()
      const matchSearch =
        !q ||
        log.recipientName.toLowerCase().includes(q) ||
        log.recipientContact.toLowerCase().includes(q) ||
        log.content.toLowerCase().includes(q) ||
        log.triggerType.toLowerCase().includes(q)

      return matchChannel && matchStatus && matchSearch
    })
  }, [notificationLogs, channelFilter, statusFilter, searchQuery])

  // Disparo de Teste de WhatsApp
  const handleSendWhatsAppTest = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSendingTest(true)
    const mockSchedule = schedules[0] || {
      title: "Sessão de Pilates Aparelhos",
      startTime: "08:00",
      date: new Date().toISOString().split("T")[0],
      professionalName: "Dra. Camila Duarte",
      roomName: "Studio Pilates Aparelhos",
    }

    try {
      const res = await sendWhatsAppReminder(mockSchedule as any, {
        name: testName,
        phone: testNumber,
      })
      showToast(`Lembrete WhatsApp disparado para ${testName} (${testNumber})!`)
    } catch (err: any) {
      showToast(`Erro ao disparar: ${err?.message || "Verifique as configurações"}`)
    } finally {
      setIsSendingTest(false)
    }
  }

  // Disparo de Teste de E-mail
  const handleSendEmailTest = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSendingTest(true)

    try {
      const res = await sendEmailReceipt(
        testName,
        testEmail,
        380,
        "Mensalidade Studio Pilates (Plano Mensal)",
        "pix"
      )
      showToast(`E-mail de comprovante enviado com sucesso para ${testEmail}!`)
    } catch (err: any) {
      showToast(`Erro ao disparar: ${err?.message || "Verifique as configurações"}`)
    } finally {
      setIsSendingTest(false)
    }
  }

  // Executar Varredura de Lembretes Agora (Manual)
  const handleTriggerManualScan = async () => {
    setIsScanning(true)
    try {
      const res = await triggerUpcomingRemindersNow()
      if (res?.success) {
        const sent24 = res.reminders24h?.sentCount ?? 0
        const sent2 = res.reminders2h?.sentCount ?? 0
        showToast(`Varredura concluída! Disparados: ${sent24} lembretes (24h) e ${sent2} lembretes (2h).`)
      } else {
        showToast("Varredura manual concluída com sucesso.")
      }
    } catch (err: any) {
      showToast(`Aviso na varredura: ${err?.message || "Falha ao escanear a grade"}`)
    } finally {
      setIsScanning(false)
    }
  }

  const getTriggerLabel = (type: string) => {
    switch (type) {
      case "lembrete_24h":
        return { label: "Lembrete 24h", variant: "default" as const, color: "bg-blue-500/10 text-blue-600 border-blue-500/20" }
      case "lembrete_2h":
        return { label: "Lembrete 2h", variant: "warning" as const, color: "bg-amber-500/10 text-amber-600 border-amber-500/20" }
      case "credito_reposicao":
        return { label: "Crédito de Reposição", variant: "success" as const, color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" }
      case "recibo_pagamento":
        return { label: "Recibo Financeiro", variant: "default" as const, color: "bg-purple-500/10 text-purple-600 border-purple-500/20" }
      case "teste_uazapi":
      case "teste_resend":
        return { label: "Teste Conexão", variant: "outline" as const, color: "bg-muted text-muted-foreground border-border" }
      default:
        return { label: "Manual", variant: "outline" as const, color: "bg-muted text-foreground border-border" }
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {feedback && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm font-medium animate-fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Bell className="h-6 w-6 text-primary" />
            <span>Motor de Notificações Omnicanal</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Automação de lembretes pré-sessão via <strong>WhatsApp (UAZAPI)</strong> e e-mails transacionais via <strong>Resend</strong>.
          </p>
        </div>

        <Button
          onClick={handleTriggerManualScan}
          disabled={isScanning}
          className="gap-2 shadow-sm font-semibold text-xs h-9 self-start sm:self-auto"
        >
          {isScanning ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          <span>Executar Varredura de Lembretes Agora</span>
        </Button>
      </div>

      {/* 1. KPIs Consolidados do Motor de Disparos */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <Card className="p-4 border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Total Notificações</span>
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Bell className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">{notificationStats.total}</div>
          <span className="text-[10px] text-muted-foreground">Histórico acumulado</span>
        </Card>

        <Card className="p-4 border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">WhatsApp (UAZAPI)</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
              <Smartphone className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-600">{notificationStats.whatsappCount}</div>
          <span className="text-[10px] text-muted-foreground">Mensagens disparadas</span>
        </Card>

        <Card className="p-4 border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">E-mails (Resend)</span>
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-600">
              <Mail className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-sky-600">{notificationStats.emailCount}</div>
          <span className="text-[10px] text-muted-foreground">Recibos e avisos</span>
        </Card>

        <Card className="p-4 border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Taxa de Sucesso</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-600">{notificationStats.successRate}%</div>
          <span className="text-[10px] text-muted-foreground">{notificationStats.totalSent} entregues / {notificationStats.totalFailed} falhas</span>
        </Card>

        <Card className="p-4 border-border col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Disparos Hoje</span>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600">
              <Calendar className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-purple-600">{notificationStats.todayCount}</div>
          <span className="text-[10px] text-muted-foreground">Próximas 24h & 2h</span>
        </Card>
      </div>

      {/* 2. Painel de Automações & Crons do Servidor */}
      <Card className="border-border overflow-hidden">
        <CardHeader className="p-5 pb-3 bg-muted/20 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-base font-bold">Automações Ativas & Crons do Convex</CardTitle>
                <CardDescription className="text-xs">
                  Rotinas agendadas no servidor executadas de forma independente do navegador.
                </CardDescription>
              </div>
            </div>
            <Badge variant="success" className="text-[10px]">
              Motor Ativo 24/7
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-5 text-xs grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-3.5 rounded-xl border border-border bg-card space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-blue-500" />
                <span>Lembrete 24h Antes</span>
              </span>
              <Badge variant="outline" className="text-[9px]">Diário 08:00 BRT</Badge>
            </div>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              Escaneia todos os agendamentos do dia seguinte e envia mensagem no WhatsApp com dados da aula, local e lembrete da política de cancelamento de 2h.
            </p>
          </div>

          <div className="p-3.5 rounded-xl border border-border bg-card space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-amber-500" />
                <span>Lembrete 2h Antes</span>
              </span>
              <Badge variant="outline" className="text-[9px]">A cada 30 min</Badge>
            </div>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              Avisa o paciente 2 horas antes da sessão com lembrete de pontualidade e recomendação de meias antiderrapantes para aulas de Pilates.
            </p>
          </div>

          <div className="p-3.5 rounded-xl border border-border bg-card space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                <span>Reposições & Recibos</span>
              </span>
              <Badge variant="outline" className="text-[9px]">Tempo Real</Badge>
            </div>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              Disparo instantâneo no WhatsApp ao gerar crédito de reposição e envio automático de comprovante por E-mail (Resend) após baixa no caixa.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 3. Playground de Teste Rápido (WhatsApp & Resend) */}
      <Card className="border-border">
        <CardHeader className="p-5 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold">Simulador & Testes de Disparo</CardTitle>
              <CardDescription className="text-xs">
                Valide as mensagens formatadas e a comunicação com os gateways em tempo real.
              </CardDescription>
            </div>
            <Tabs value={testTab} onValueChange={(v) => setTestTab(v as any)}>
              <TabsList className="h-8">
                <TabsTrigger value="whatsapp" className="text-xs gap-1.5 h-7">
                  <Smartphone className="h-3 w-3" />
                  <span>WhatsApp</span>
                </TabsTrigger>
                <TabsTrigger value="email" className="text-xs gap-1.5 h-7">
                  <Mail className="h-3 w-3" />
                  <span>E-mail</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>

        <CardContent className="p-5 pt-0">
          {testTab === "whatsapp" ? (
            <form onSubmit={handleSendWhatsAppTest} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Nome do Paciente</label>
                  <Input
                    value={testName}
                    onChange={(e) => setTestName(e.target.value)}
                    placeholder="Nome completo"
                    className="h-9 text-xs"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Telefone WhatsApp (Com DDD)</label>
                  <Input
                    value={testNumber}
                    onChange={(e) => setTestNumber(e.target.value)}
                    placeholder="(11) 98877-6655"
                    className="h-9 text-xs"
                    required
                  />
                </div>
              </div>

              {/* Preview da Mensagem */}
              <div className="p-3 bg-muted/30 border border-border rounded-xl space-y-1">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Preview do Lembrete Formatado:
                </span>
                <p className="font-mono text-[11px] text-foreground whitespace-pre-line leading-relaxed bg-background p-2.5 rounded-lg border border-border/60">
                  {`Olá, *${testName}*! 👋

Este é um lembrete do seu atendimento na *Altar Fisio*:
📅 *Data:* ${new Date().toISOString().split("T")[0]}
⏰ *Horário:* 08:00
👨‍⚕️ *Profissional:* Dra. Camila Duarte
📍 *Local:* Studio Pilates Aparelhos

⚠️ *Aviso importante:* Caso precise desmarcar, avise com antecedência para liberar seu crédito de reposição.

Estamos ansiosos para te receber! ✨`}
                </p>
              </div>

              <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={isSendingTest} className="gap-2 text-xs">
                  {isSendingTest ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  <span>Disparar WhatsApp de Teste</span>
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSendEmailTest} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Nome do Paciente</label>
                  <Input
                    value={testName}
                    onChange={(e) => setTestName(e.target.value)}
                    placeholder="Nome completo"
                    className="h-9 text-xs"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">E-mail do Destinatário</label>
                  <Input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="paciente@email.com"
                    className="h-9 text-xs"
                    required
                  />
                </div>
              </div>

              <div className="p-3 bg-muted/30 border border-border rounded-xl space-y-1">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Template de Comprovante Resend:
                </span>
                <p className="text-muted-foreground text-[11px]">
                  O e-mail conterá o cabeçalho oficial da Altar Fisio, tabela de discriminação de valores (R$ 380,00), data de quitação e carimbo fiscal para convênios.
                </p>
              </div>

              <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={isSendingTest} className="gap-2 text-xs">
                  {isSendingTest ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                  <span>Disparar E-mail de Teste</span>
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* 4. Tabela de Logs de Disparo em Tempo Real */}
      <Card className="border-border overflow-hidden">
        <CardHeader className="p-4 border-b border-border bg-muted/20">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <span>Histórico de Logs de Notificações</span>
                <Badge variant="outline" className="text-[10px]">
                  {filteredLogs.length} registros
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                Auditoria completa de todos os disparos efetuados pelo sistema
              </CardDescription>
            </div>

            {/* Filtros da Tabela */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar paciente ou contato..."
                  className="h-8 pl-8 text-xs w-44 sm:w-56"
                />
              </div>

              <select
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value as any)}
                className="h-8 rounded-lg border border-input bg-background px-2 text-xs text-foreground focus:outline-none"
              >
                <option value="all">Todos Canais</option>
                <option value="whatsapp_uazapi">WhatsApp</option>
                <option value="email_resend">E-mail</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="h-8 rounded-lg border border-input bg-background px-2 text-xs text-foreground focus:outline-none"
              >
                <option value="all">Todos Status</option>
                <option value="sent">Enviado</option>
                <option value="failed">Falha</option>
                <option value="queued">Na Fila</option>
              </select>
            </div>
          </div>
        </CardHeader>

        <div className="divide-y divide-border overflow-x-auto">
          {filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              Nenhum log encontrado com os filtros selecionados.
            </div>
          ) : (
            filteredLogs.map((log) => {
              const isWhatsapp = log.channel === "whatsapp_uazapi"
              const trig = getTriggerLabel(log.triggerType)

              return (
                <div
                  key={log.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <div
                      className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isWhatsapp
                          ? "bg-emerald-500/10 text-emerald-600"
                          : "bg-sky-500/10 text-sky-600"
                      }`}
                    >
                      {isWhatsapp ? (
                        <MessageSquare className="h-4 w-4" />
                      ) : (
                        <Mail className="h-4 w-4" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-bold text-foreground truncate">{log.recipientName}</span>
                        <span className="text-[11px] text-muted-foreground">({log.recipientContact})</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${trig.color}`}>
                          {trig.label}
                        </span>
                      </div>
                      <p className="text-muted-foreground text-[11px] mt-0.5 line-clamp-1 max-w-xl">
                        {log.content}
                      </p>
                      {log.errorMessage && (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 block mt-0.5 font-mono">
                          {log.errorMessage}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>

                    <Badge
                      variant={
                        log.status === "sent"
                          ? "success"
                          : log.status === "failed"
                          ? "destructive"
                          : "warning"
                      }
                      className="text-[9px] py-0"
                    >
                      {log.status === "sent"
                        ? "Enviado"
                        : log.status === "failed"
                        ? "Falha"
                        : "Na Fila"}
                    </Badge>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={() => setSelectedLog(log)}
                      title="Ver mensagem completa"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </Card>

      {/* Modal de Detalhes do Log */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" />
              <span>Detalhes da Notificação</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Registro auditável gravado pelo motor omnicanal.
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-3 text-xs py-2">
              <div className="p-3 rounded-xl bg-muted/30 border border-border space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Destinatário:</span>
                  <strong className="text-foreground">{selectedLog.recipientName}</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Canal / Contato:</span>
                  <span className="font-mono text-foreground">{selectedLog.recipientContact} ({selectedLog.channel})</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Gatilho:</span>
                  <span className="font-semibold text-primary">{selectedLog.triggerType}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Data e Hora:</span>
                  <span className="text-foreground">{new Date(selectedLog.timestamp).toLocaleString("pt-BR")}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant={selectedLog.status === "sent" ? "success" : "destructive"} className="text-[10px]">
                    {selectedLog.status.toUpperCase()}
                  </Badge>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Conteúdo da Mensagem:</label>
                <div className="p-3 bg-muted/20 border border-border rounded-xl font-mono text-[11px] whitespace-pre-line leading-relaxed max-h-48 overflow-y-auto">
                  {selectedLog.content}
                </div>
              </div>

              {selectedLog.errorMessage && (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-[11px]">
                  <strong>Informação do Gateway:</strong> {selectedLog.errorMessage}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSelectedLog(null)} className="text-xs">
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
