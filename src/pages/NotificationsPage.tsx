import React, { useState, useMemo } from "react"
import { useQuery, useAction } from "convex/react"
import { api } from "@convex/_generated/api"
import { useClinicData } from "@/contexts/ClinicDataContext"
import { useTheme } from "@/contexts/ThemeContext"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select-native"
import { formatDateBR, formatDateTimeBR, getTodayDateString } from "@/lib/dateUtils"
import { formatPhoneBR, cleanPhoneDigits } from "@/lib/utils"
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
import { WhatsAppInstanceManager } from "@/components/whatsapp/WhatsAppInstanceManager"
import { MessageTemplateBuilder } from "@/components/whatsapp/MessageTemplateBuilder"
import { BroadcastSender } from "@/components/whatsapp/BroadcastSender"

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
  const [feedback, setFeedback] = useState<{ message: string; type: "success" | "error" } | null>(null)
  const showToast = (message: string, type: "success" | "error" = "success") => {
    setFeedback({ message, type })
    setTimeout(() => setFeedback(null), 5000)
  }

  // Instâncias UAZAPI e Action de Disparo Direto
  const instances = useQuery(api.whatsapp.listInstances) || []
  const activeWhatsappInstance = useMemo(() => {
    return (
      instances.find((i: any) => i.isDefault && i.status === "connected") ||
      instances.find((i: any) => i.status === "connected") ||
      instances.find((i: any) => i.isDefault) ||
      instances[0] ||
      null
    )
  }, [instances])

  const sendWhatsAppAction = useAction(api.notifications.sendWhatsAppNotificationAction)

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

  // Abas de Navegação Principal
  const [mainTab, setMainTab] = useState<"whatsapp_hub" | "logs" | "automations">("whatsapp_hub")
  const [whatsappSubTab, setWhatsappSubTab] = useState<"instances" | "templates" | "broadcast">("instances")

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

    const rawDigits = cleanPhoneDigits(testNumber)
    if (rawDigits.length < 10) {
      showToast("Informe um número de WhatsApp válido com DDD (mínimo 10 dígitos, ex: (22) 99902-1889)", "error")
      return
    }

    setIsSendingTest(true)

    const formattedMessage = `Olá, *${testName}*! 👋\n\nEste é um lembrete do seu atendimento na *Altar Fisio*:\n📅 *Data:* ${formatDateBR(getTodayDateString())}\n⏰ *Horário:* 08:00\n👨‍⚕️ *Profissional:* Dra. Camila Duarte\n📍 *Local:* Studio Pilates Aparelhos\n\n⚠️ *Aviso importante:* Caso precise desmarcar, avise com antecedência para liberar seu crédito de reposição.\n\nEstamos ansiosos para te receber! ✨`

    try {
      const res = await sendWhatsAppAction({
        recipientName: testName,
        phone: testNumber,
        message: formattedMessage,
        triggerType: "simulador_teste",
      })

      if (res?.success) {
        showToast(`Lembrete WhatsApp de teste disparado com sucesso para ${testNumber}!`, "success")
      } else {
        showToast(`Falha no disparo: ${res?.errorMessage || "Instância do WhatsApp desconectada ou erro no gateway Uazapi"}`, "error")
      }
    } catch (err: any) {
      showToast(`Erro ao disparar: ${err?.message || "Verifique a conexão e as credenciais do WhatsApp"}`, "error")
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
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 text-sm font-medium animate-fade-in ${
            feedback.type === "error"
              ? "bg-rose-600 text-white shadow-rose-900/30 border border-rose-500/40"
              : "bg-emerald-600 text-white shadow-emerald-900/30 border border-emerald-500/40"
          }`}
        >
          {feedback.type === "error" ? (
            <AlertCircle className="h-4 w-4 shrink-0 text-white" />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-white" />
          )}
          <span>{feedback.message}</span>
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

      
      {/* Abas Principais do Módulo */}
      <Tabs value={mainTab} onValueChange={(v: any) => setMainTab(v)} className="space-y-6">
        <TabsList className="bg-muted/70 p-1 rounded-xl h-auto flex flex-wrap gap-1">
          <TabsTrigger
            value="whatsapp_hub"
            className="gap-2 font-semibold py-2 px-3.5 data-[state=active]:bg-card data-[state=active]:shadow-xs text-xs sm:text-sm"
          >
            <Smartphone className="w-4 h-4 text-emerald-500" />
            <span>Central WhatsApp & Disparador Uazapi</span>
          </TabsTrigger>
          <TabsTrigger
            value="logs"
            className="gap-2 font-semibold py-2 px-3.5 data-[state=active]:bg-card data-[state=active]:shadow-xs text-xs sm:text-sm"
          >
            <FileCheck className="w-4 h-4 text-sky-500" />
            <span>Histórico & Auditoria ({notificationStats.total})</span>
          </TabsTrigger>
          <TabsTrigger
            value="automations"
            className="gap-2 font-semibold py-2 px-3.5 data-[state=active]:bg-card data-[state=active]:shadow-xs text-xs sm:text-sm"
          >
            <Sparkles className="w-4 h-4 text-purple-500" />
            <span>Automações & Testes</span>
          </TabsTrigger>
        </TabsList>

        {/* ABA 1: CENTRAL WHATSAPP & DISPARADOR */}
        <TabsContent value="whatsapp_hub" className="space-y-6 focus-visible:outline-none">
          <Tabs value={whatsappSubTab} onValueChange={(v: any) => setWhatsappSubTab(v)} className="space-y-6">
            <TabsList className="bg-muted/40 border p-1 rounded-xl h-auto flex flex-wrap gap-1">
              <TabsTrigger value="instances" className="gap-1.5 text-xs font-semibold py-1.5 px-3">
                <Smartphone className="w-3.5 h-3.5 text-emerald-500" />
                Instâncias & Conexão QR Code
              </TabsTrigger>
              <TabsTrigger value="templates" className="gap-1.5 text-xs font-semibold py-1.5 px-3">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Modelos de Lembretes (Botões / Carrossel)
              </TabsTrigger>
              <TabsTrigger value="broadcast" className="gap-1.5 text-xs font-semibold py-1.5 px-3">
                <Send className="w-3.5 h-3.5 text-sky-500" />
                Disparador em Massa & Recorrência
              </TabsTrigger>
            </TabsList>

            <TabsContent value="instances" className="focus-visible:outline-none">
              <WhatsAppInstanceManager />
            </TabsContent>

            <TabsContent value="templates" className="focus-visible:outline-none">
              <MessageTemplateBuilder />
            </TabsContent>

            <TabsContent value="broadcast" className="focus-visible:outline-none">
              <BroadcastSender />
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* ABA 2: HISTÓRICO & AUDITORIA DE DISPAROS */}
        <TabsContent value="logs" className="space-y-6 focus-visible:outline-none">
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

              <div className="w-36">
                <Select
                  value={channelFilter}
                  onChange={(e) => setChannelFilter(e.target.value as any)}
                >
                  <option value="all">Todos Canais</option>
                  <option value="whatsapp_uazapi">WhatsApp</option>
                  <option value="email_resend">E-mail</option>
                </Select>
              </div>

              <div className="w-36">
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                >
                  <option value="all">Todos Status</option>
                  <option value="sent">Enviado</option>
                  <option value="failed">Falha</option>
                  <option value="queued">Na Fila</option>
                </Select>
              </div>
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
                      {formatDateTimeBR(log.timestamp)}
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
        </TabsContent>

        {/* ABA 3: AUTOMAÇÕES E TESTES */}
        <TabsContent value="automations" className="space-y-6 focus-visible:outline-none">
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
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-foreground">Telefone WhatsApp (Com DDD)</label>
                    <span className="text-[10px] text-muted-foreground font-normal">Máscara (XX) XXXXX-XXXX</span>
                  </div>
                  <Input
                    value={testNumber}
                    onChange={(e) => setTestNumber(formatPhoneBR(e.target.value))}
                    placeholder="(22) 99902-1889"
                    maxLength={16}
                    className="h-9 text-xs font-mono"
                    required
                  />
                </div>
              </div>

              {/* Status da Instância do WhatsApp Conectada */}
              {activeWhatsappInstance && activeWhatsappInstance.status === "connected" ? (
                <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px]">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-medium">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span>
                      Instância UAZAPI Ativa: <strong>{activeWhatsappInstance.name}</strong> ({activeWhatsappInstance.ownerNumber || activeWhatsappInstance.profileName || "Online"})
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                    Conectado
                  </Badge>
                </div>
              ) : (
                <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-300">
                  <div className="flex items-center gap-2 font-medium">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>Nenhuma instância conectada detectada. Conecte seu aparelho via QR Code na aba <strong>Central WhatsApp</strong>.</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30">
                    Aguardando Conexão
                  </Badge>
                </div>
              )}

              {/* Preview da Mensagem */}
              <div className="p-3 bg-muted/30 border border-border rounded-xl space-y-1">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Preview do Lembrete Formatado:
                </span>
                <p className="font-mono text-[11px] text-foreground whitespace-pre-line leading-relaxed bg-background p-2.5 rounded-lg border border-border/60">
                  {`Olá, *${testName}*! 👋

Este é um lembrete do seu atendimento na *Altar Fisio*:
📅 *Data:* ${formatDateBR(getTodayDateString())}
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
        </TabsContent>
      </Tabs>
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
                  <span className="text-foreground">{formatDateTimeBR(selectedLog.timestamp)}</span>
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
