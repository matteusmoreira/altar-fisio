import React, { useState } from "react"
import { useClinicData } from "@/contexts/ClinicDataContext"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  BookmarkCheck,
  Clock,
  Plus,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
  AlertCircle,
  TrendingUp,
  CreditCard,
  UserCheck,
  ShoppingBag,
  RotateCcw,
  Search,
  Filter,
  DollarSign,
  AlertTriangle,
} from "lucide-react"

export const PackagesPage: React.FC = () => {
  const {
    packages,
    patientPackages,
    services,
    patients,
    renewalAlerts,
    replacementCredits,
    addPackage,
    assignPackageToPatient,
  } = useClinicData()

  // Estados de Filtros e Busca
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "needsRenewal" | "completed">("all")
  const [feedback, setFeedback] = useState<string | null>(null)

  // Modal 1: Criar Pacote de Tabela
  const [isNewPackageModalOpen, setIsNewPackageModalOpen] = useState(false)
  const [pkgName, setPkgName] = useState("")
  const [pkgServiceId, setPkgServiceId] = useState(services[0]?.id || "")
  const [pkgSessionCount, setPkgSessionCount] = useState(8)
  const [pkgValidityDays, setPkgValidityDays] = useState(30)
  const [pkgPrice, setPkgPrice] = useState(380)
  const [pkgDescription, setPkgDescription] = useState("")
  const [isSubmittingPkg, setIsSubmittingPkg] = useState(false)

  // Modal 2: Vender / Atribuir Pacote
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
  const [assignPatientId, setAssignPatientId] = useState(patients[0]?.id || "")
  const [assignPackageId, setAssignPackageId] = useState(packages[0]?.id || "")
  const [assignStartDate, setAssignStartDate] = useState(new Date().toISOString().split("T")[0])
  const [assignPaymentMethod, setAssignPaymentMethod] = useState<
    "pix" | "dinheiro" | "cartao_debito" | "cartao_credito" | "transferencia"
  >("pix")
  const [assignIsPaid, setAssignIsPaid] = useState(true)
  const [isSubmittingAssign, setIsSubmittingAssign] = useState(false)

  // Métricas Consolidadas (KPIs)
  const activePackages = patientPackages.filter((p) => p.status === "active")
  const totalRemainingSessions = activePackages.reduce((sum, p) => sum + p.remainingSessions, 0)
  const totalRevenuePackages = activePackages.reduce((sum, p) => sum + (p.packagePrice || 0), 0)
  const needsRenewalCount = renewalAlerts.length

  // Filtragem da lista de assinaturas
  const filteredSubscriptions = patientPackages.filter((sub) => {
    const term = searchTerm.toLowerCase()
    const matchesSearch =
      (sub.patientName || "").toLowerCase().includes(term) ||
      (sub.packageName || "").toLowerCase().includes(term) ||
      (sub.patientPhone || "").includes(term)

    if (!matchesSearch) return false

    if (statusFilter === "active") return sub.status === "active"
    if (statusFilter === "needsRenewal") return sub.needsRenewal
    if (statusFilter === "completed") return sub.status === "completed"
    return true
  })

  // Quick Action para vender pacote selecionado
  const handleOpenAssignForPackage = (pkgId: string) => {
    setAssignPackageId(pkgId)
    setAssignPatientId(patients[0]?.id || "")
    setAssignStartDate(new Date().toISOString().split("T")[0])
    setAssignIsPaid(true)
    setIsAssignModalOpen(true)
  }

  // Quick Action para renovar pacote do aluno
  const handleRenewForPatient = (patientId: string, packageId: string) => {
    setAssignPatientId(patientId)
    setAssignPackageId(packageId)
    setAssignStartDate(new Date().toISOString().split("T")[0])
    setAssignIsPaid(true)
    setIsAssignModalOpen(true)
  }

  // Submissão de Criação de Pacote
  const handleCreatePackage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pkgName || !pkgServiceId) return
    setIsSubmittingPkg(true)

    try {
      await addPackage({
        name: pkgName,
        serviceId: pkgServiceId,
        sessionCount: Number(pkgSessionCount),
        validityDays: Number(pkgValidityDays),
        price: Number(pkgPrice),
        description: pkgDescription,
        active: true,
      })

      setFeedback(`Plano "${pkgName}" criado com sucesso!`)
      setIsNewPackageModalOpen(false)
      setPkgName("")
      setPkgDescription("")
      setTimeout(() => setFeedback(null), 3500)
    } catch (err: any) {
      alert(err?.message || "Erro ao criar pacote.")
    } finally {
      setIsSubmittingPkg(false)
    }
  }

  // Submissão de Venda de Pacote
  const handleAssignPackage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!assignPatientId || !assignPackageId) return
    setIsSubmittingAssign(true)

    try {
      const res = await assignPackageToPatient({
        patientId: assignPatientId,
        packageId: assignPackageId,
        startDate: assignStartDate,
        paymentMethod: assignPaymentMethod,
        isPaid: assignIsPaid,
      })

      const selectedPatient = patients.find((p) => p.id === assignPatientId)
      const selectedPkg = packages.find((p) => p.id === assignPackageId)

      setFeedback(
        `Pacote "${selectedPkg?.name}" vinculado com sucesso a ${selectedPatient?.name}! Validade até ${res.expiryDate}.`
      )
      setIsAssignModalOpen(false)
      setTimeout(() => setFeedback(null), 4000)
    } catch (err: any) {
      alert(err?.message || "Erro ao vender pacote.")
    } finally {
      setIsSubmittingAssign(false)
    }
  }

  // Pacote selecionado no modal de venda
  const currentSelectedPkg = packages.find((p) => p.id === assignPackageId)

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Toast Feedback */}
      {feedback && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm font-medium animate-fade-in">
          <CheckCircle2 className="h-4 w-4" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <BookmarkCheck className="h-6 w-6 text-primary" />
            <span>Planos, Pacotes & Gestão Comercial</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Controle de créditos de sessões, aquisição de planos pelos pacientes e alertas automáticos de renovação.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              if (services.length > 0 && !pkgServiceId) {
                setPkgServiceId(services[0].id)
              }
              setIsNewPackageModalOpen(true)
            }}
            className="gap-1.5 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Novo Pacote de Tabela</span>
          </Button>

          <Button
            onClick={() => {
              if (patients.length > 0 && !assignPatientId) setAssignPatientId(patients[0].id)
              if (packages.length > 0 && !assignPackageId) setAssignPackageId(packages[0].id)
              setIsAssignModalOpen(true)
            }}
            className="gap-1.5 text-xs"
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            <span>Vender / Atribuir Pacote</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Pacotes Ativos
            </CardTitle>
            <Layers className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-foreground">{activePackages.length}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Alunos com planos regulares em andamento
            </p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Saldo Total de Sessões
            </CardTitle>
            <Clock className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {totalRemainingSessions} <span className="text-xs font-normal text-muted-foreground">sessões</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Créditos contratados a realizar na clínica
            </p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Alertas de Renovação
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {needsRenewalCount} <span className="text-xs font-normal text-muted-foreground">alunos</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              &le; 2 sessões ou expiração em 7 dias
            </p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Receita em Pacotes Ativos
            </CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-foreground">
              R$ {totalRevenuePackages.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Valor nominal dos planos em vigor
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Seção de Alertas de Renovação Próxima (Etapa 5.4) */}
      {renewalAlerts.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold text-amber-900 dark:text-amber-200 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <span>Radar de Retenção: Alunos com Renovação Imediata ({renewalAlerts.length})</span>
              </CardTitle>
              <Badge variant="warning" className="text-[10px]">
                Ação Comercial
              </Badge>
            </div>
            <CardDescription className="text-xs text-amber-800/80 dark:text-amber-300/80">
              Alunos com 1 ou 2 sessões restantes ou planos próximos do vencimento. Renove antes da próxima aula!
            </CardDescription>
          </CardHeader>

          <CardContent className="p-4 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {renewalAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="p-3.5 rounded-xl border border-amber-500/20 bg-background flex flex-col justify-between gap-3 shadow-2xs"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-sm text-foreground">{alert.patientName}</h4>
                        <p className="text-[11px] text-muted-foreground">{alert.patientPhone || "Sem contato"}</p>
                      </div>
                      <Badge
                        variant={alert.remainingSessions <= 1 ? "destructive" : "warning"}
                        className="text-[10px] shrink-0 font-semibold"
                      >
                        {alert.reason}
                      </Badge>
                    </div>

                    <p className="text-xs font-medium text-foreground mt-2">
                      {alert.packageName}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Restam <span className="font-bold text-foreground">{alert.remainingSessions}</span> de{" "}
                      {alert.totalSessions} sessões • Vence em: {alert.expiryDate}
                    </p>
                  </div>

                  <Button
                    size="sm"
                    onClick={() => handleRenewForPatient(alert.patientId, alert.packageId)}
                    className="w-full text-xs gap-1.5 h-8 bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Renovar Plano Agora</span>
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Planos Oferecidos pela Clínica (Tabela de Preços) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-primary" />
              <span>Planos & Pacotes Oferecidos pela Clínica</span>
            </h2>
            <p className="text-xs text-muted-foreground">
              Grade de serviços cadastrados com valores, limites de sessão e regras de validade.
            </p>
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            {packages.length} plano(s)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {packages.map((pkg) => {
            const pricePerSession = pkg.sessionCount > 0 ? (pkg.price / pkg.sessionCount).toFixed(2) : "0.00"

            return (
              <Card
                key={pkg.id}
                className="border-border flex flex-col justify-between hover:border-primary/50 transition-all shadow-xs"
              >
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                      {pkg.modality === "turma" ? "Turma até 4" : "Individual"}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {pkg.validityDays} dias
                    </Badge>
                  </div>
                  <CardTitle className="text-sm font-bold text-foreground">
                    {pkg.name}
                  </CardTitle>
                  <CardDescription className="text-xs mt-1 line-clamp-2">
                    {pkg.description || `${pkg.sessionCount} sessões de atendimento fisioterapêutico.`}
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-4 pt-0 space-y-3">
                  <div className="border-t border-border/60 pt-2">
                    <div className="text-xl font-bold text-foreground">
                      R$ {pkg.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      R$ {pricePerSession} por sessão ({pkg.sessionCount} sessões)
                    </p>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenAssignForPackage(pkg.id)}
                    className="w-full text-xs gap-1.5 h-8 border-primary/30 hover:bg-primary/5 text-primary"
                  >
                    <ShoppingBag className="h-3.5 w-3.5" />
                    <span>Vender Este Plano</span>
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Pacotes em Andamento dos Pacientes (Acompanhamento e Saldos) */}
      <Card className="border-border shadow-xs">
        <CardHeader className="p-4 pb-3 border-b border-border">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                <Layers className="h-4 w-4 text-primary" />
                <span>Pacotes Ativos & Histórico dos Alunos</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Acompanhamento em tempo real de sessões contratadas, consumidas no check-in e saldo restante.
              </CardDescription>
            </div>

            {/* Filtros e Busca */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar paciente ou plano..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-8 pl-8 text-xs w-48 sm:w-56"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs text-foreground focus:outline-none"
              >
                <option value="all">Todos ({patientPackages.length})</option>
                <option value="active">Ativos ({activePackages.length})</option>
                <option value="needsRenewal">Precisam Renovar ({needsRenewalCount})</option>
                <option value="completed">Concluídos</option>
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 pt-2 divide-y divide-border">
          {filteredSubscriptions.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              Nenhum pacote de paciente encontrado com os filtros selecionados.
            </div>
          ) : (
            filteredSubscriptions.map((sub) => {
              const pct = sub.totalSessions > 0 ? Math.round((sub.usedSessions / sub.totalSessions) * 100) : 0
              const remaining = sub.remainingSessions
              const isNeedsRenewal = sub.needsRenewal

              return (
                <div
                  key={sub.id}
                  className="py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 first:pt-2 last:pb-0"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-foreground">{sub.patientName}</h4>
                      {isNeedsRenewal && (
                        <Badge variant="warning" className="text-[9px] py-0 px-1.5">
                          Renovação Próxima
                        </Badge>
                      )}
                      {sub.status === "completed" && (
                        <Badge variant="secondary" className="text-[9px] py-0 px-1.5">
                          Concluído
                        </Badge>
                      )}
                      {sub.status === "expired" && (
                        <Badge variant="destructive" className="text-[9px] py-0 px-1.5">
                          Expirado
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {sub.packageName} • Início: {sub.startDate} • Vence em:{" "}
                      <span className="font-medium text-foreground">{sub.expiryDate}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-4 w-full md:w-96">
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between text-[11px] text-muted-foreground font-medium">
                        <span>
                          {sub.usedSessions} de {sub.totalSessions} usadas ({pct}%)
                        </span>
                        <span className="font-bold text-foreground">
                          {remaining} restante{remaining !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            remaining <= 2 ? "bg-amber-500" : "bg-primary"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRenewForPatient(sub.patientId, sub.packageId)}
                      className="h-8 text-xs shrink-0 gap-1 border-border hover:border-primary"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>Renovar</span>
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      {/* Banco de Créditos de Reposição */}
      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-bold text-amber-800 dark:text-amber-300 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>Banco de Créditos de Reposição ({replacementCredits.length} total)</span>
          </CardTitle>
          <CardDescription className="text-xs">
            Histórico de créditos liberados por cancelamentos com aviso prévio mínimo de 2 horas.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-4 pt-2">
          {replacementCredits.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-2">
              Nenhum crédito de reposição registrado no momento.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {replacementCredits.map((credit) => (
                <div
                  key={credit.id}
                  className="p-3 rounded-xl border border-amber-500/20 bg-background flex flex-col justify-between gap-2 text-xs"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-foreground">
                        {credit.patientName}
                      </span>
                      <Badge
                        variant={credit.status === "available" ? "warning" : "outline"}
                        className="text-[9px]"
                      >
                        {credit.status === "available" ? "Disponível" : "Utilizado"}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Data da Falta: {credit.originDate}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Vencimento: {credit.expiryDate}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal 1: Criar Novo Pacote de Tabela */}
      <Dialog open={isNewPackageModalOpen} onOpenChange={setIsNewPackageModalOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreatePackage}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-primary" />
                <span>Novo Pacote / Plano Comercial</span>
              </DialogTitle>
              <DialogDescription>
                Cadastre um novo plano de tabela disponível para venda aos pacientes.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 py-3 text-xs">
              <div className="space-y-1">
                <label className="font-medium text-foreground">Nome do Pacote</label>
                <Input
                  value={pkgName}
                  onChange={(e) => setPkgName(e.target.value)}
                  placeholder="Ex: Pilates 2x/Semana (Trimestral) ou Fisio 10 Sessões"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-medium text-foreground">Serviço Vinculado</label>
                <select
                  value={pkgServiceId}
                  onChange={(e) => setPkgServiceId(e.target.value)}
                  className="w-full h-10 rounded-lg border border-input bg-background px-3 text-xs"
                  required
                >
                  {services.map((svc) => (
                    <option key={svc.id} value={svc.id}>
                      {svc.name} ({svc.modality === "turma" ? "Turma" : "Individual"} - {svc.specialty.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-medium text-foreground">Quantidade de Sessões</label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={pkgSessionCount}
                    onChange={(e) => setPkgSessionCount(Number(e.target.value))}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-foreground">Validade (em dias)</label>
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={pkgValidityDays}
                    onChange={(e) => setPkgValidityDays(Number(e.target.value))}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-medium text-foreground">Preço Total de Tabela (R$)</label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={pkgPrice}
                  onChange={(e) => setPkgPrice(Number(e.target.value))}
                  required
                />
                <p className="text-[10px] text-muted-foreground">
                  Média de R$ {(pkgPrice / (pkgSessionCount || 1)).toFixed(2)} por sessão.
                </p>
              </div>

              <div className="space-y-1">
                <label className="font-medium text-foreground">Descrição (Opcional)</label>
                <Input
                  value={pkgDescription}
                  onChange={(e) => setPkgDescription(e.target.value)}
                  placeholder="Ex: Inclui avaliação postural e acesso ao estúdio."
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsNewPackageModalOpen(false)}
                disabled={isSubmittingPkg}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmittingPkg}>
                {isSubmittingPkg ? "Salvando..." : "Criar Pacote"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal 2: Vender / Atribuir Pacote ao Paciente */}
      <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleAssignPackage}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-primary" />
                <span>Venda e Atribuição de Pacote</span>
              </DialogTitle>
              <DialogDescription>
                Vincule um plano ao paciente com lançamento automático na gestão financeira.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 py-3 text-xs">
              <div className="space-y-1">
                <label className="font-medium text-foreground">Paciente / Aluno</label>
                <select
                  value={assignPatientId}
                  onChange={(e) => setAssignPatientId(e.target.value)}
                  className="w-full h-10 rounded-lg border border-input bg-background px-3 text-xs"
                  required
                >
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-medium text-foreground">Plano / Pacote Escolhido</label>
                <select
                  value={assignPackageId}
                  onChange={(e) => setAssignPackageId(e.target.value)}
                  className="w-full h-10 rounded-lg border border-input bg-background px-3 text-xs"
                  required
                >
                  {packages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name} — {pkg.sessionCount} sessões (R$ {pkg.price.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-medium text-foreground">Data de Início</label>
                  <Input
                    type="date"
                    value={assignStartDate}
                    onChange={(e) => setAssignStartDate(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-foreground">Forma de Pagamento</label>
                  <select
                    value={assignPaymentMethod}
                    onChange={(e) => setAssignPaymentMethod(e.target.value as any)}
                    className="w-full h-10 rounded-lg border border-input bg-background px-3 text-xs"
                  >
                    <option value="pix">PIX</option>
                    <option value="cartao_credito">Cartão de Crédito</option>
                    <option value="cartao_debito">Cartão de Débito</option>
                    <option value="dinheiro">Dinheiro</option>
                    <option value="transferencia">Transferência</option>
                  </select>
                </div>
              </div>

              {/* Status de Pagamento */}
              <div className="p-3 rounded-xl border border-border bg-muted/30 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-medium text-foreground flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={assignIsPaid}
                      onChange={(e) => setAssignIsPaid(e.target.checked)}
                      className="rounded text-primary focus:ring-primary h-4 w-4"
                    />
                    <span>Pagamento Realizado no Ato</span>
                  </label>
                  <Badge variant={assignIsPaid ? "success" : "warning"}>
                    {assignIsPaid ? "Receita Paga" : "A Receber (Pendente)"}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Lança automaticamente a transação de R${" "}
                  {currentSelectedPkg?.price ? currentSelectedPkg.price.toFixed(2) : "0.00"} no fluxo de caixa da clínica.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAssignModalOpen(false)}
                disabled={isSubmittingAssign}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmittingAssign}>
                {isSubmittingAssign ? "Processando Venda..." : "Confirmar Venda"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
