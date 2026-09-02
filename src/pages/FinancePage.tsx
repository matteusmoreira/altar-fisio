import React, { useState } from "react"
import { useClinicData } from "@/contexts/ClinicDataContext"
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
  DollarSign,
  TrendingUp,
  TrendingDown,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Printer,
  Calendar,
  Wallet,
  Award,
  Search,
  ChevronDown,
  ChevronUp,
  FileText,
  Mail,
  Receipt,
  XCircle,
  Smartphone,
} from "lucide-react"
import type { FinancialTransaction, ProfessionalCommissionReport } from "@/types"

export const FinancePage: React.FC = () => {
  const {
    transactions,
    cashFlowSummary,
    commissionReports,
    closedCommissions,
    selectedFinanceMonth,
    setSelectedFinanceMonth,
    addTransaction,
    markTransactionPaid,
    cancelTransaction,
    closeProfessionalCommission,
    patients,
    professionals,
    sendEmailReceipt,
    sendWhatsAppReceipt,
  } = useClinicData()

  const todayStr = new Date().toISOString().split("T")[0]

  // Tabs & Filters
  const [activeTab, setActiveTab] = useState<string>("cashflow")
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all")
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "pending" | "overdue">("all")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")

  // Feedback Toast
  const [feedback, setFeedback] = useState<string | null>(null)
  const showFeedback = (msg: string) => {
    setFeedback(msg)
    setTimeout(() => setFeedback(null), 3500)
  }

  // Modal 1: Novo Lançamento
  const [isNewTxModalOpen, setIsNewTxModalOpen] = useState(false)
  const [newType, setNewType] = useState<"income" | "expense">("income")
  const [newCategory, setNewCategory] = useState("Mensalidade Pilates")
  const [newDescription, setNewDescription] = useState("")
  const [newAmount, setNewAmount] = useState<number>(380)
  const [newDueDate, setNewDueDate] = useState(todayStr)
  const [newPaymentMethod, setNewPaymentMethod] = useState<any>("pix")
  const [newStatus, setNewStatus] = useState<"paid" | "pending">("paid")
  const [newPatientId, setNewPatientId] = useState<string>(patients[0]?.id || "")
  const [newProfessionalId, setNewProfessionalId] = useState<string>("")

  // Modal 2: Baixa Rápida de Pagamento
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false)
  const [settleTx, setSettleTx] = useState<FinancialTransaction | null>(null)
  const [settleDate, setSettleDate] = useState(todayStr)
  const [settleMethod, setSettleMethod] = useState<any>("pix")

  // Modal 3: Recibo Oficial do Paciente
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false)
  const [receiptTx, setReceiptTx] = useState<FinancialTransaction | null>(null)

  // Modal 4: Fechamento de Comissão
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false)
  const [closingReport, setClosingReport] = useState<ProfessionalCommissionReport | null>(null)
  const [closingPaymentStatus, setClosingPaymentStatus] = useState<"paid" | "pending">("paid")
  const [closingNotes, setClosingNotes] = useState("")

  // Modal 5: Extrato do Profissional para Impressão
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false)
  const [statementReport, setStatementReport] = useState<ProfessionalCommissionReport | null>(null)

  // Accordion de Atendimentos Detalhados por profissional
  const [expandedProfId, setExpandedProfId] = useState<string | null>(null)

  // Filtragem de Transações
  const filteredTransactions = transactions.filter((t) => {
    // Filtro de mês de referência (se não for "all")
    if (selectedFinanceMonth !== "all") {
      const refDate = t.paymentDate || t.dueDate
      if (!refDate.startsWith(selectedFinanceMonth)) return false
    }
    // Tipo
    if (typeFilter !== "all" && t.type !== typeFilter) return false
    // Status
    const isOverdue = t.status === "pending" && t.dueDate < todayStr
    if (statusFilter === "paid" && t.status !== "paid") return false
    if (statusFilter === "pending" && (t.status !== "pending" || isOverdue)) return false
    if (statusFilter === "overdue" && !isOverdue) return false
    // Categoria
    if (categoryFilter !== "all" && t.category !== categoryFilter) return false
    // Busca texto
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchDesc = t.description.toLowerCase().includes(q)
      const matchCat = t.category.toLowerCase().includes(q)
      const matchPatient = (t.patientName || "").toLowerCase().includes(q)
      const matchProf = (t.professionalName || "").toLowerCase().includes(q)
      if (!matchDesc && !matchCat && !matchPatient && !matchProf) return false
    }
    return true
  })

  // Categorias distintas para o filtro
  const availableCategories = Array.from(new Set(transactions.map((t) => t.category)))

  // Ações de formulário
  const handleCreateTx = async (e: React.FormEvent) => {
    e.preventDefault()
    const pat = patients.find((p) => p.id === newPatientId)
    const prof = professionals.find((pr) => pr.id === newProfessionalId)

    await addTransaction({
      type: newType,
      category: newCategory,
      description: newDescription || (newType === "income" ? `${newCategory} - ${pat?.name || "Paciente"}` : newCategory),
      amount: Number(newAmount),
      dueDate: newDueDate,
      paymentDate: newStatus === "paid" ? newDueDate : undefined,
      paymentMethod: newPaymentMethod,
      status: newStatus,
      patientId: newType === "income" ? newPatientId : undefined,
      patientName: newType === "income" ? pat?.name : undefined,
      professionalId: newType === "expense" && newProfessionalId ? newProfessionalId : undefined,
      professionalName: newType === "expense" && prof ? prof.name : undefined,
      receiptIssued: newStatus === "paid",
    })

    setIsNewTxModalOpen(false)
    setNewDescription("")
    showFeedback("Lançamento financeiro registrado com sucesso no caixa!")
  }

  const handleConfirmSettle = async () => {
    if (!settleTx) return
    await markTransactionPaid(settleTx.id, settleDate, settleMethod)
    setIsSettleModalOpen(false)
    setSettleTx(null)
    showFeedback("Baixa de pagamento confirmada e registrada no fluxo de caixa!")
  }

  const handleConfirmCloseCommission = async () => {
    if (!closingReport) return
    await closeProfessionalCommission({
      professionalId: closingReport.professionalId,
      periodMonthYear: selectedFinanceMonth === "all" ? todayStr.slice(0, 7) : selectedFinanceMonth,
      totalAttendances: closingReport.totalAttendedSessions,
      totalGrossAmount: closingReport.estimatedRevenue,
      totalCommissionAmount: closingReport.commissionPayable,
      status: closingPaymentStatus,
      notes: closingNotes || undefined,
      autoCreateExpense: true,
    })

    setIsCloseModalOpen(false)
    setClosingReport(null)
    setClosingNotes("")
    showFeedback(`Fechamento de comissões de ${closingReport.professionalName} aprovado com sucesso!`)
  }

  // Contagem de títulos em atraso
  const overdueCount = transactions.filter(
    (t) => t.status === "pending" && t.dueDate < todayStr
  ).length

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Toast Feedback */}
      {feedback && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 text-sm font-medium animate-fade-in border border-emerald-500">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Header Principal com Seletor de Período */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-5 rounded-2xl border border-border shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <span>Gestão Financeira & Repasses</span>
                <Badge variant="outline" className="text-[10px] uppercase font-mono tracking-wider">
                  Fase 6
                </Badge>
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Fluxo de caixa, conciliação rápida, DRE operacional e apuração automatizada de comissões da equipe.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Seletor de Mês */}
          <div className="flex items-center gap-2 bg-muted/30 px-3 py-1.5 rounded-xl border border-border text-xs">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold text-muted-foreground">Período:</span>
            <select
              value={selectedFinanceMonth}
              onChange={(e) => setSelectedFinanceMonth(e.target.value)}
              className="bg-transparent font-bold text-foreground focus:outline-none cursor-pointer"
            >
              <option value="2026-09">Setembro / 2026</option>
              <option value="2026-08">Agosto / 2026</option>
              <option value="2026-07">Julho / 2026</option>
              <option value="all">Todo o Histórico</option>
            </select>
          </div>

          <Button onClick={() => setIsNewTxModalOpen(true)} className="gap-2 text-xs h-9">
            <Plus className="h-4 w-4" />
            <span>Novo Lançamento</span>
          </Button>
        </div>
      </div>

      {/* Cards de Métricas e KPIs do Caixa (DRE Sintético) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Entradas Realizadas */}
        <Card className="border-border shadow-sm hover:border-emerald-500/40 transition-colors">
          <CardHeader className="p-4 pb-1">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs text-muted-foreground font-medium">Entradas Realizadas</CardTitle>
              <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="h-3.5 w-3.5" />
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              R$ {cashFlowSummary.totalIncome.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Recebido no período (liquidados)
            </p>
          </CardContent>
        </Card>

        {/* Despesas Pagas */}
        <Card className="border-border shadow-sm hover:border-rose-500/40 transition-colors">
          <CardHeader className="p-4 pb-1">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs text-muted-foreground font-medium">Despesas Operacionais</CardTitle>
              <span className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
                <TrendingDown className="h-3.5 w-3.5" />
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-xl sm:text-2xl font-bold text-rose-600 dark:text-rose-400">
              R$ {cashFlowSummary.totalExpense.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Custos, aluguel, manutenção e repasses
            </p>
          </CardContent>
        </Card>

        {/* Saldo Operacional em Caixa */}
        <Card className="border-border shadow-sm hover:border-primary/40 transition-colors">
          <CardHeader className="p-4 pb-1">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs text-muted-foreground font-medium">Saldo em Caixa</CardTitle>
              <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
                <Wallet className="h-3.5 w-3.5" />
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div
              className={`text-xl sm:text-2xl font-bold ${
                cashFlowSummary.balance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
              }`}
            >
              R$ {cashFlowSummary.balance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Resultado operacional líquido
            </p>
          </CardContent>
        </Card>

        {/* A Receber & Inadimplência */}
        <Card className="border-border shadow-sm hover:border-amber-500/40 transition-colors">
          <CardHeader className="p-4 pb-1">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs text-muted-foreground font-medium">A Receber / Pendente</CardTitle>
              <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Clock className="h-3.5 w-3.5" />
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400">
              R$ {cashFlowSummary.pendingIncome.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
            <div className="flex items-center justify-between mt-1 text-[11px]">
              {cashFlowSummary.overdueIncome > 0 ? (
                <span className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  <span>R$ {cashFlowSummary.overdueIncome.toFixed(2)} em atraso</span>
                </span>
              ) : (
                <span className="text-muted-foreground">Sem pendências vencidas</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Principais: Fluxo de Caixa vs Comissões vs Histórico */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-2">
          <TabsList className="grid grid-cols-3 max-w-md w-full">
            <TabsTrigger value="cashflow" className="text-xs">
              Extrato & Caixa
            </TabsTrigger>
            <TabsTrigger value="commissions" className="text-xs flex items-center gap-1.5">
              <span>Repasses da Equipe</span>
              {commissionReports.some((r) => !r.isClosed && r.totalAttendedSessions > 0) && (
                <span className="h-2 w-2 rounded-full bg-primary" />
              )}
            </TabsTrigger>
            <TabsTrigger value="closed" className="text-xs">
              Fechamentos ({closedCommissions.length})
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ========================================================================= */}
        {/* ABA 1: EXTRATO DE CAIXA, CONTAS A PAGAR/RECEBER E CONCILIAÇÃO             */}
        {/* ========================================================================= */}
        <TabsContent value="cashflow" className="space-y-4 animate-fade-in">
          {/* Barra de Filtros e Busca */}
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-card p-3 rounded-xl border border-border">
            {/* Filtro de Status tipo Pills */}
            <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto text-xs">
              <button
                type="button"
                onClick={() => {
                  setTypeFilter("all")
                  setStatusFilter("all")
                }}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  typeFilter === "all" && statusFilter === "all"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/40 text-muted-foreground hover:bg-muted"
                }`}
              >
                Todas
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter(typeFilter === "income" ? "all" : "income")}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  typeFilter === "income"
                    ? "bg-emerald-600 text-white"
                    : "bg-muted/40 text-muted-foreground hover:bg-muted"
                }`}
              >
                + Receitas
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter(typeFilter === "expense" ? "all" : "expense")}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  typeFilter === "expense"
                    ? "bg-rose-600 text-white"
                    : "bg-muted/40 text-muted-foreground hover:bg-muted"
                }`}
              >
                - Despesas
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter(statusFilter === "paid" ? "all" : "paid")}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  statusFilter === "paid"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/40 text-muted-foreground hover:bg-muted"
                }`}
              >
                Liquidadas
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter(statusFilter === "pending" ? "all" : "pending")}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  statusFilter === "pending"
                    ? "bg-amber-600 text-white"
                    : "bg-muted/40 text-muted-foreground hover:bg-muted"
                }`}
              >
                Pendentes
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter(statusFilter === "overdue" ? "all" : "overdue")}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                  statusFilter === "overdue"
                    ? "bg-rose-600 text-white"
                    : "bg-muted/40 text-rose-600 dark:text-rose-400 hover:bg-muted"
                }`}
              >
                <span>Atrasadas</span>
                {overdueCount > 0 && (
                  <Badge variant="destructive" className="h-4 px-1 text-[9px] py-0">
                    {overdueCount}
                  </Badge>
                )}
              </button>
            </div>

            {/* Busca e Categoria */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative w-full md:w-60">
                <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar paciente, descrição..."
                  className="pl-8 h-8 text-xs"
                />
              </div>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs text-muted-foreground focus:outline-none"
              >
                <option value="all">Todas Categorias</option>
                {availableCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Lista de Movimentações */}
          <Card className="border-border overflow-hidden shadow-sm">
            <CardHeader className="p-4 border-b border-border bg-muted/20 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold">Lançamentos Financeiros</CardTitle>
                <CardDescription className="text-xs">
                  {filteredTransactions.length} registros encontrados no filtro selecionado
                </CardDescription>
              </div>
            </CardHeader>

            <div className="divide-y divide-border">
              {filteredTransactions.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-xs">
                  Nenhuma movimentação financeira encontrada com os filtros atuais.
                </div>
              ) : (
                filteredTransactions.map((t) => {
                  const isIncome = t.type === "income"
                  const isPaid = t.status === "paid"
                  const isOverdue = t.status === "pending" && t.dueDate < todayStr
                  const isCancelled = t.status === "cancelled"

                  return (
                    <div
                      key={t.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/15 transition-colors"
                    >
                      {/* Lado Esquerdo: Ícone + Descrição */}
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-10 w-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                            isCancelled
                              ? "bg-muted text-muted-foreground"
                              : isIncome
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {isIncome ? "+" : "-"}
                        </div>

                        <div className="space-y-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-semibold text-sm text-foreground">
                              {t.description}
                            </h4>
                            <Badge
                              variant={isIncome ? "success" : "destructive"}
                              className="text-[10px] py-0"
                            >
                              {t.category}
                            </Badge>

                            {isOverdue && (
                              <Badge variant="destructive" className="text-[10px] py-0 animate-pulse">
                                Atrasado
                              </Badge>
                            )}

                            {isCancelled && (
                              <Badge variant="outline" className="text-[10px] py-0 text-muted-foreground">
                                Cancelado
                              </Badge>
                            )}
                          </div>

                          <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                            <span>Vencimento: <strong>{t.dueDate}</strong></span>
                            {t.paymentDate && <span>• Pago em: <strong>{t.paymentDate}</strong></span>}
                            <span>• Forma: <strong>{t.paymentMethod.toUpperCase()}</strong></span>
                            {t.patientName && <span>• Paciente: <strong className="text-foreground">{t.patientName}</strong></span>}
                            {t.professionalName && <span>• Profissional: <strong className="text-foreground">{t.professionalName}</strong></span>}
                          </p>
                        </div>
                      </div>

                      {/* Lado Direito: Valores & Ações Rápidas */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 self-end sm:self-auto w-full sm:w-auto">
                        <div className="text-right">
                          <span
                            className={`font-bold text-sm block ${
                              isCancelled
                                ? "line-through text-muted-foreground"
                                : isIncome
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-rose-600 dark:text-rose-400"
                            }`}
                          >
                            {isIncome ? "+ " : "- "}R$ {t.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>

                          <div className="mt-0.5">
                            <Badge
                              variant={isPaid ? "success" : isOverdue ? "destructive" : isCancelled ? "outline" : "warning"}
                              className="text-[9px] py-0"
                            >
                              {isPaid ? "Pago / Liquidado" : isOverdue ? "Atrasado" : isCancelled ? "Cancelado" : "Pendente"}
                            </Badge>
                          </div>
                        </div>

                        {/* Botões de Ação */}
                        <div className="flex items-center gap-1.5">
                          {/* Ação 1: Dar Baixa */}
                          {!isPaid && !isCancelled && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setSettleTx(t)
                                setSettleDate(todayStr)
                                setSettleMethod(t.paymentMethod || "pix")
                                setIsSettleModalOpen(true)
                              }}
                              className="h-8 text-xs font-semibold"
                            >
                              Dar Baixa
                            </Button>
                          )}

                          {/* Ação 2: Visualizar / Imprimir Recibo do Paciente */}
                          {isPaid && isIncome && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setReceiptTx(t)
                                setIsReceiptModalOpen(true)
                              }}
                              className="h-8 text-xs gap-1"
                              title="Visualizar Recibo Oficial"
                            >
                              <Receipt className="h-3.5 w-3.5 text-primary" />
                              <span>Recibo</span>
                            </Button>
                          )}

                          {/* Ação 3: Cancelar */}
                          {!isPaid && !isCancelled && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (confirm(`Deseja realmente cancelar este lançamento de R$ ${t.amount.toFixed(2)}?`)) {
                                  cancelTransaction(t.id)
                                  showFeedback("Lançamento cancelado com sucesso.")
                                }
                              }}
                              className="h-8 text-xs text-muted-foreground hover:text-rose-600"
                              title="Cancelar Lançamento"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </Card>
        </TabsContent>

        {/* ========================================================================= */}
        {/* ABA 2: APURAÇÃO E FECHAMENTO AUTOMATIZADO DE COMISSÕES                   */}
        {/* ========================================================================= */}
        <TabsContent value="commissions" className="space-y-4 animate-fade-in">
          {/* Card Resumo da Folha de Comissões */}
          <Card className="border-border bg-gradient-to-r from-card to-muted/30">
            <CardHeader className="p-4 pb-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Award className="h-5 w-5 text-primary" />
                    <span>Apuração de Repasses — {selectedFinanceMonth === "all" ? "Histórico Geral" : selectedFinanceMonth}</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Cálculo automatizado com base nos atendimentos com presença confirmada dos fisioterapeutas e instrutores.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-3 self-start sm:self-auto bg-background/80 p-2.5 rounded-xl border border-border">
                  <div>
                    <span className="text-[10px] text-muted-foreground block uppercase font-medium">Total de Repasses</span>
                    <span className="font-bold text-base text-primary">
                      R$ {commissionReports.reduce((acc, r) => acc + r.commissionPayable, 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="h-8 w-px bg-border mx-1" />
                  <div>
                    <span className="text-[10px] text-muted-foreground block uppercase font-medium">Atendimentos</span>
                    <span className="font-bold text-base text-foreground">
                      {commissionReports.reduce((acc, r) => acc + r.totalAttendedSessions, 0)} aulas
                    </span>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 pt-2 space-y-4">
              {commissionReports.map((report) => {
                const isExpanded = expandedProfId === report.professionalId

                return (
                  <div
                    key={report.professionalId}
                    className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-3"
                  >
                    {/* Linha Principal do Profissional */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Identificação */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-base text-foreground">
                            {report.professionalName}
                          </h3>
                          <Badge variant="outline" className="text-[10px] font-mono">
                            {report.crefito}
                          </Badge>
                          <Badge
                            variant={report.isClosed ? "success" : "secondary"}
                            className="text-[10px]"
                          >
                            {report.isClosed
                              ? report.closedStatus === "paid"
                                ? "Fechado & Pago"
                                : "Fechado / A Pagar"
                              : "Em Aberto / Apuração"}
                          </Badge>
                        </div>

                        <p className="text-xs text-muted-foreground">
                          Regra Contratual:{" "}
                          <strong className="text-foreground">
                            {report.commissionType === "percentage"
                              ? `${report.commissionRate}% sobre o valor da sessão`
                              : `R$ ${report.commissionRate.toFixed(2)} fixo por aluno atendido`}
                          </strong>
                        </p>

                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {report.specialties.map((spec) => (
                            <Badge key={spec} variant="outline" className="text-[9px] bg-muted/40">
                              {spec}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {/* Métricas do Período */}
                      <div className="flex flex-wrap items-center gap-4 sm:gap-6 self-end md:self-auto">
                        <div className="text-right">
                          <p className="text-[10px] text-muted-foreground uppercase font-medium">Sessões Realizadas</p>
                          <p className="font-bold text-sm text-foreground">
                            {report.totalAttendedSessions} atendimentos
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-[10px] text-muted-foreground uppercase font-medium">Faturamento Estimado</p>
                          <p className="font-semibold text-sm text-muted-foreground">
                            R$ {report.estimatedRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-[10px] text-muted-foreground uppercase font-medium">Repasse Calculado</p>
                          <p className="font-bold text-lg text-primary">
                            R$ {report.commissionPayable.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </p>
                        </div>

                        {/* Botões de Ação do Profissional */}
                        <div className="flex items-center gap-1.5">
                          {!report.isClosed && report.totalAttendedSessions > 0 && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setClosingReport(report)
                                setClosingPaymentStatus("paid")
                                setIsCloseModalOpen(true)
                              }}
                              className="text-xs h-8 font-semibold"
                            >
                              Aprovar Fechamento
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setStatementReport(report)
                              setIsStatementModalOpen(true)
                            }}
                            className="text-xs h-8 gap-1"
                            title="Visualizar Extrato de Repasse"
                          >
                            <FileText className="h-3.5 w-3.5 text-primary" />
                            <span>Extrato</span>
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setExpandedProfId(isExpanded ? null : report.professionalId)}
                            className="text-xs h-8 px-2 text-muted-foreground"
                            title={isExpanded ? "Ocultar sessões" : "Ver sessões"}
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Sanfona: Detalhamento Aula por Aula */}
                    {isExpanded && (
                      <div className="pt-3 border-t border-border space-y-2 animate-fade-in">
                        <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                          Atendimentos Registrados no Período ({report.attendancesList.length})
                        </h5>

                        {report.attendancesList.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic">
                            Nenhum atendimento com presença confirmada encontrado neste período.
                          </p>
                        ) : (
                          <div className="rounded-lg border border-border overflow-hidden">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-muted/40 text-muted-foreground border-b border-border">
                                <tr>
                                  <th className="p-2.5 font-semibold">Data / Hora</th>
                                  <th className="p-2.5 font-semibold">Paciente</th>
                                  <th className="p-2.5 font-semibold">Modalidade / Aula</th>
                                  <th className="p-2.5 font-semibold text-right">Valor Sessão</th>
                                  <th className="p-2.5 font-semibold text-right">Comissão Gerada</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {report.attendancesList.map((att, idx) => (
                                  <tr key={`${att.scheduleId}_${idx}`} className="hover:bg-muted/10">
                                    <td className="p-2.5 font-medium text-foreground">
                                      {att.date} • {att.startTime}
                                    </td>
                                    <td className="p-2.5 text-foreground">{att.patientName}</td>
                                    <td className="p-2.5 text-muted-foreground">
                                      {att.title} ({att.modality})
                                    </td>
                                    <td className="p-2.5 text-right font-medium text-foreground">
                                      R$ {att.sessionRevenue.toFixed(2)}
                                    </td>
                                    <td className="p-2.5 text-right font-bold text-primary">
                                      R$ {att.commissionEarned.toFixed(2)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================================= */}
        {/* ABA 3: HISTÓRICO DE FECHAMENTOS DE COMISSÕES                             */}
        {/* ========================================================================= */}
        <TabsContent value="closed" className="space-y-4 animate-fade-in">
          <Card className="border-border">
            <CardHeader className="p-4 border-b border-border">
              <CardTitle className="text-sm font-bold">Histórico de Fechamentos Mensais</CardTitle>
              <CardDescription className="text-xs">
                Registros formais de apurações aprovadas e lançadas no contas a pagar da clínica.
              </CardDescription>
            </CardHeader>

            <div className="divide-y divide-border">
              {closedCommissions.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-xs">
                  Nenhum fechamento formalizado até o momento. Utilize a aba "Repasses da Equipe" para aprovar o fechamento do mês corrente.
                </div>
              ) : (
                closedCommissions.map((c) => (
                  <div
                    key={c._id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/15"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-sm text-foreground">
                          {c.professionalName}
                        </h4>
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {c.crefito}
                        </Badge>
                        <Badge variant={c.status === "paid" ? "success" : "warning"} className="text-[10px]">
                          {c.status === "paid" ? "Pago no Caixa" : "Pendente de Pagamento"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Competência: <strong>{c.periodMonthYear}</strong> • {c.totalAttendances} atendimentos apurados
                        {c.notes && <span> • Obs: {c.notes}</span>}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 self-end sm:self-auto">
                      <div className="text-right">
                        <span className="text-[10px] text-muted-foreground uppercase font-medium block">Valor do Repasse</span>
                        <span className="font-bold text-base text-primary">
                          R$ {c.totalCommissionAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ========================================================================= */}
      {/* MODAL 1: NOVO LANÇAMENTO FINANCEIRO                                       */}
      {/* ========================================================================= */}
      <Dialog open={isNewTxModalOpen} onOpenChange={setIsNewTxModalOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreateTx}>
            <DialogHeader>
              <DialogTitle>Novo Lançamento Financeiro</DialogTitle>
              <DialogDescription>
                Cadastre uma receita de paciente ou despesa de operação da Altar Fisio.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Tipo de Movimentação</label>
                  <select
                    value={newType}
                    onChange={(e) => {
                      const t = e.target.value as "income" | "expense"
                      setNewType(t)
                      if (t === "income") {
                        setNewCategory("Mensalidade Pilates")
                      } else {
                        setNewCategory("Manutenção Aparelhos")
                      }
                    }}
                    className="w-full h-9 rounded-lg border border-input bg-background px-3 text-xs"
                  >
                    <option value="income">Entrada (Receita)</option>
                    <option value="expense">Saída (Despesa)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Categoria</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full h-9 rounded-lg border border-input bg-background px-3 text-xs"
                  >
                    {newType === "income" ? (
                      <>
                        <option value="Mensalidade Pilates">Mensalidade Pilates</option>
                        <option value="Pacote Fisioterapia">Pacote Fisioterapia</option>
                        <option value="Sessão RPG Avulsa">Sessão RPG Avulsa</option>
                        <option value="Avaliação Postural">Avaliação Postural</option>
                        <option value="Outras Receitas">Outras Receitas</option>
                      </>
                    ) : (
                      <>
                        <option value="Manutenção Aparelhos">Manutenção Aparelhos Pilates</option>
                        <option value="Aluguel & Condomínio">Aluguel & Condomínio</option>
                        <option value="Materiais & Insumos">Materiais & Insumos Descartáveis</option>
                        <option value="Infraestrutura & TI">Infraestrutura, Internet e TI</option>
                        <option value="Repasse de Comissão">Repasse de Comissão</option>
                        <option value="Limpeza & Higiene">Limpeza & Higiene</option>
                        <option value="Outras Despesas">Outras Despesas</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {newType === "income" && (
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Paciente Associado</label>
                  <select
                    value={newPatientId}
                    onChange={(e) => setNewPatientId(e.target.value)}
                    className="w-full h-9 rounded-lg border border-input bg-background px-3 text-xs"
                  >
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.documentCpf})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {newType === "expense" && newCategory === "Repasse de Comissão" && (
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Profissional Beneficiário</label>
                  <select
                    value={newProfessionalId}
                    onChange={(e) => setNewProfessionalId(e.target.value)}
                    className="w-full h-9 rounded-lg border border-input bg-background px-3 text-xs"
                  >
                    <option value="">Selecione o profissional...</option>
                    {professionals.map((pr) => (
                      <option key={pr.id} value={pr.id}>
                        {pr.name} ({pr.crefito})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Descrição</label>
                <Input
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Ex: Mensalidade Pilates 2x/Semana..."
                  className="h-9 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Valor (R$)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newAmount}
                    onChange={(e) => setNewAmount(Number(e.target.value))}
                    className="h-9 text-xs font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Forma de Pagamento</label>
                  <select
                    value={newPaymentMethod}
                    onChange={(e) => setNewPaymentMethod(e.target.value as any)}
                    className="w-full h-9 rounded-lg border border-input bg-background px-3 text-xs"
                  >
                    <option value="pix">PIX (Chave Clínica)</option>
                    <option value="dinheiro">Dinheiro Físico</option>
                    <option value="cartao_credito">Cartão de Crédito</option>
                    <option value="cartao_debito">Cartão de Débito</option>
                    <option value="transferencia">Transferência Bancária</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Data de Vencimento</label>
                  <Input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Status Inicial</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as any)}
                    className="w-full h-9 rounded-lg border border-input bg-background px-3 text-xs"
                  >
                    <option value="paid">Pago / Liquidado Imediatamente</option>
                    <option value="pending">Pendente a Receber / Pagar</option>
                  </select>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsNewTxModalOpen(false)} className="text-xs">
                Cancelar
              </Button>
              <Button type="submit" className="text-xs">
                Salvar Lançamento
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 2: BAIXA RÁPIDA DE PAGAMENTO                                        */}
      {/* ========================================================================= */}
      <Dialog open={isSettleModalOpen} onOpenChange={setIsSettleModalOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Baixa de Pagamento</DialogTitle>
            <DialogDescription>
              Confirme a liquidação do lançamento no caixa da Altar Fisio.
            </DialogDescription>
          </DialogHeader>

          {settleTx && (
            <div className="space-y-3 py-2 text-xs">
              <div className="p-3 bg-muted/30 rounded-xl border border-border space-y-1">
                <p className="font-bold text-foreground text-sm">{settleTx.description}</p>
                <div className="flex justify-between items-center pt-1 text-xs">
                  <span className="text-muted-foreground">Valor:</span>
                  <span className="font-bold text-base text-primary">
                    R$ {settleTx.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Data Efetiva da Liquidação</label>
                <Input
                  type="date"
                  value={settleDate}
                  onChange={(e) => setSettleDate(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Forma de Pagamento Recebida</label>
                <select
                  value={settleMethod}
                  onChange={(e) => setSettleMethod(e.target.value as any)}
                  className="w-full h-9 rounded-lg border border-input bg-background px-3 text-xs"
                >
                  <option value="pix">PIX</option>
                  <option value="dinheiro">Dinheiro Físico</option>
                  <option value="cartao_debito">Cartão de Débito</option>
                  <option value="cartao_credito">Cartão de Crédito</option>
                  <option value="transferencia">Transferência Bancária</option>
                </select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSettleModalOpen(false)} className="text-xs">
              Cancelar
            </Button>
            <Button onClick={handleConfirmSettle} className="text-xs">
              Confirmar Baixa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 3: RECIBO OFICIAL PARA O PACIENTE (IMPRESSÃO / E-MAIL)              */}
      {/* ========================================================================= */}
      <Dialog open={isReceiptModalOpen} onOpenChange={setIsReceiptModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              <span>Recibo de Prestação de Serviços Fisioterapêuticos</span>
            </DialogTitle>
            <DialogDescription>
              Documento comprobatório emitido para reembolso de plano de saúde e controle fiscal.
            </DialogDescription>
          </DialogHeader>

          {receiptTx && (
            <div className="space-y-4 py-2 text-xs">
              {/* Layout do Recibo Impresso */}
              <div className="p-5 border-2 border-dashed border-border rounded-2xl bg-card space-y-4 font-sans print:border-solid">
                <div className="flex justify-between items-start border-b border-border pb-3">
                  <div>
                    <h3 className="font-bold text-base text-foreground tracking-tight">ALTAR FISIO</h3>
                    <p className="text-[11px] text-muted-foreground">Fisioterapia Especializada, Pilates & RPG</p>
                    <p className="text-[11px] text-muted-foreground">Dr. Marcelo Henrique • CREFITO-3 / 184520-F</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-muted-foreground uppercase">Nº Recibo</span>
                    <p className="font-mono font-bold text-xs text-foreground">
                      REC-{receiptTx.id.slice(-6).toUpperCase()}
                    </p>
                  </div>
                </div>

                <div className="space-y-2 text-foreground text-xs leading-relaxed">
                  <p>
                    Recebemos de <strong>{receiptTx.patientName || "Paciente Altar Fisio"}</strong> a quantia de:
                  </p>
                  <div className="p-3 bg-muted/30 rounded-xl text-center">
                    <span className="text-xl font-bold text-primary">
                      R$ {receiptTx.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <p>
                    Referente a: <strong>{receiptTx.description}</strong> ({receiptTx.category}).
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Forma de pagamento: <strong>{receiptTx.paymentMethod.toUpperCase()}</strong> • Data: <strong>{receiptTx.paymentDate || receiptTx.dueDate}</strong>
                  </p>
                </div>

                <div className="pt-6 text-center border-t border-border space-y-1">
                  <div className="w-48 border-b border-foreground/40 mx-auto" />
                  <p className="font-semibold text-foreground text-[11px]">Dr. Marcelo Henrique</p>
                  <p className="text-[10px] text-muted-foreground">Fisioterapeuta Responsável • CREFITO-3 / 184520-F</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2 w-full">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (receiptTx?.patientName) {
                    const pat = patients.find((p) => p.id === receiptTx.patientId)
                    const targetEmail = pat?.email || "paciente@email.com"
                    await sendEmailReceipt(
                      receiptTx.patientName,
                      targetEmail,
                      receiptTx.amount,
                      receiptTx.description,
                      receiptTx.paymentMethod
                    )
                    showFeedback(`Recibo enviado com sucesso para ${targetEmail} via Resend!`)
                  }
                }}
                className="gap-1.5 text-xs text-sky-600 border-sky-500/30 hover:bg-sky-50 dark:hover:bg-sky-950/30"
              >
                <Mail className="h-3.5 w-3.5" />
                <span>Enviar E-mail (Resend)</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (receiptTx?.patientName) {
                    const pat = patients.find((p) => p.id === receiptTx.patientId)
                    const targetPhone = pat?.phone || "(11) 98877-6655"
                    await sendWhatsAppReceipt(
                      receiptTx.patientName,
                      targetPhone,
                      receiptTx.amount,
                      receiptTx.description,
                      receiptTx.paymentMethod
                    )
                    showFeedback(`Comprovante enviado com sucesso para ${receiptTx.patientName} via WhatsApp!`)
                  }
                }}
                className="gap-1.5 text-xs text-emerald-600 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
              >
                <Smartphone className="h-3.5 w-3.5" />
                <span>Enviar WhatsApp</span>
              </Button>
            </div>

            <div className="flex gap-2 self-end sm:self-auto">
              <Button variant="outline" size="sm" onClick={() => setIsReceiptModalOpen(false)} className="text-xs">
                Fechar
              </Button>
              <Button size="sm" onClick={() => window.print()} className="gap-1.5 text-xs">
                <Printer className="h-3.5 w-3.5" />
                <span>Imprimir / PDF</span>
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 4: APROVAÇÃO E FECHAMENTO DE COMISSÃO DO PROFISSIONAL               */}
      {/* ========================================================================= */}
      <Dialog open={isCloseModalOpen} onOpenChange={setIsCloseModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Aprovação de Fechamento Mensal</DialogTitle>
            <DialogDescription>
              Formalize a apuração de comissões e integre a saída ao fluxo de caixa da clínica.
            </DialogDescription>
          </DialogHeader>

          {closingReport && (
            <div className="space-y-3 py-2 text-xs">
              <div className="p-3 bg-muted/30 rounded-xl border border-border space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-sm text-foreground">{closingReport.professionalName}</span>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {closingReport.crefito}
                  </Badge>
                </div>
                <div className="flex justify-between text-muted-foreground text-xs">
                  <span>Atendimentos no mês:</span>
                  <strong className="text-foreground">{closingReport.totalAttendedSessions} sessões</strong>
                </div>
                <div className="flex justify-between text-muted-foreground text-xs">
                  <span>Faturamento gerado:</span>
                  <strong className="text-foreground">R$ {closingReport.estimatedRevenue.toFixed(2)}</strong>
                </div>
                <div className="flex justify-between text-primary text-xs pt-1 border-t border-border font-bold">
                  <span>Repasse a Pagar:</span>
                  <span className="text-base">R$ {closingReport.commissionPayable.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Status do Pagamento no Caixa</label>
                <select
                  value={closingPaymentStatus}
                  onChange={(e) => setClosingPaymentStatus(e.target.value as any)}
                  className="w-full h-9 rounded-lg border border-input bg-background px-3 text-xs"
                >
                  <option value="paid">Pago Imediatamente (Transferência/PIX realizado)</option>
                  <option value="pending">Agendado no Contas a Pagar (Pendente de liquidação)</option>
                </select>
                <p className="text-[10px] text-muted-foreground">
                  Ao aprovar, o sistema lançará automaticamente uma despesa na categoria "Repasse de Comissão".
                </p>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Observações / Notas do Fechamento</label>
                <Input
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  placeholder="Ex: Fechamento regular de Setembro/2026..."
                  className="h-9 text-xs"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCloseModalOpen(false)} className="text-xs">
              Cancelar
            </Button>
            <Button onClick={handleConfirmCloseCommission} className="text-xs">
              Confirmar Fechamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 5: EXTRATO DO PROFISSIONAL PARA IMPRESSÃO                           */}
      {/* ========================================================================= */}
      <Dialog open={isStatementModalOpen} onOpenChange={setIsStatementModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <span>Extrato Mensal de Produtividade & Repasses</span>
            </DialogTitle>
            <DialogDescription>
              Demonstrativo detalhado de atendimentos e comissões para conferência da equipe.
            </DialogDescription>
          </DialogHeader>

          {statementReport && (
            <div className="space-y-4 py-2 text-xs">
              <div className="p-4 border border-border rounded-xl bg-card space-y-3 print:border-black">
                <div className="flex justify-between items-start border-b border-border pb-3">
                  <div>
                    <h3 className="font-bold text-base text-foreground">ALTAR FISIO — RELATÓRIO DE REPASSE</h3>
                    <p className="text-xs text-muted-foreground">
                      Profissional: <strong className="text-foreground">{statementReport.professionalName}</strong> ({statementReport.crefito})
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Competência: <strong>{selectedFinanceMonth === "all" ? "Histórico Geral" : selectedFinanceMonth}</strong>
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-muted-foreground uppercase block font-medium">Repasse Líquido</span>
                    <span className="text-lg font-bold text-primary">
                      R$ {statementReport.commissionPayable.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-bold text-foreground text-xs uppercase">Relação de Sessões Ministradas</h4>
                  <table className="w-full text-left text-xs border border-border rounded-lg overflow-hidden">
                    <thead className="bg-muted/40 text-muted-foreground border-b border-border">
                      <tr>
                        <th className="p-2">Data/Hora</th>
                        <th className="p-2">Paciente</th>
                        <th className="p-2">Modalidade</th>
                        <th className="p-2 text-right">Valor da Sessão</th>
                        <th className="p-2 text-right">Comissão</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {statementReport.attendancesList.map((att, i) => (
                        <tr key={i}>
                          <td className="p-2">{att.date} {att.startTime}</td>
                          <td className="p-2">{att.patientName}</td>
                          <td className="p-2 text-muted-foreground">{att.modality}</td>
                          <td className="p-2 text-right">R$ {att.sessionRevenue.toFixed(2)}</td>
                          <td className="p-2 text-right font-bold text-primary">R$ {att.commissionEarned.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-2 gap-8 pt-8 text-center text-[10px] text-muted-foreground">
                  <div>
                    <div className="border-b border-foreground/30 mb-1" />
                    <p className="font-semibold text-foreground">{statementReport.professionalName}</p>
                    <p>{statementReport.crefito}</p>
                  </div>
                  <div>
                    <div className="border-b border-foreground/30 mb-1" />
                    <p className="font-semibold text-foreground">Dr. Marcelo Henrique</p>
                    <p>Diretor Técnico • CREFITO-3 / 184520-F</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsStatementModalOpen(false)} className="text-xs">
              Fechar
            </Button>
            <Button size="sm" onClick={() => window.print()} className="gap-1.5 text-xs">
              <Printer className="h-3.5 w-3.5" />
              <span>Imprimir Extrato</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
