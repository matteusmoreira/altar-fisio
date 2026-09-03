import React, { useState } from "react"
import { useClinicData } from "@/contexts/ClinicDataContext"
import type { ClinicPackage } from "@/types"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select-native"
import { formatDateBR, getTodayDateString } from "@/lib/dateUtils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { ServiceFormModal } from "@/components/packages/ServiceFormModal"
import { ServicesCatalogTab } from "@/components/packages/ServicesCatalogTab"
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
  Edit2,
  Trash2,
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
    updatePackage,
    deletePackage,
    deletePatientPackage,
    assignPackageToPatient,
  } = useClinicData()

  // Controle de Abas Principais
  const [activeTab, setActiveTab] = useState<"packages" | "services">("packages")

  // Estados de Filtros e Busca
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "needsRenewal" | "completed">("all")
  const [feedback, setFeedback] = useState<string | null>(null)

  // Modal Rápido de Criação de Serviço (acionado a partir do formulário de pacotes)
  const [isQuickServiceModalOpen, setIsQuickServiceModalOpen] = useState(false)

  // Modal 1: Criar Pacote de Tabela
  const [isNewPackageModalOpen, setIsNewPackageModalOpen] = useState(false)
  const [pkgName, setPkgName] = useState("")
  const [pkgServiceId, setPkgServiceId] = useState(services[0]?.id || "")
  const [pkgSessionCount, setPkgSessionCount] = useState(8)
  const [pkgValidityDays, setPkgValidityDays] = useState(30)
  const [pkgPrice, setPkgPrice] = useState(380)
  const [pkgDescription, setPkgDescription] = useState("")
  const [isSubmittingPkg, setIsSubmittingPkg] = useState(false)

  // Modal 2: Editar Pacote de Tabela
  const [editingPkg, setEditingPkg] = useState<ClinicPackage | null>(null)
  const [editName, setEditName] = useState("")
  const [editServiceId, setEditServiceId] = useState("")
  const [editSessionCount, setEditSessionCount] = useState(8)
  const [editValidityDays, setEditValidityDays] = useState(30)
  const [editPrice, setEditPrice] = useState(380)
  const [editDescription, setEditDescription] = useState("")
  const [editActive, setEditActive] = useState(true)
  const [isSubmittingEditPkg, setIsSubmittingEditPkg] = useState(false)

  // Modal 3: Excluir Pacote de Tabela
  const [deletingPkg, setDeletingPkg] = useState<ClinicPackage | null>(null)
  const [isDeletingPkg, setIsDeletingPkg] = useState(false)

  // Modal 4: Vender / Atribuir Pacote
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
  const [assignPatientId, setAssignPatientId] = useState(patients[0]?.id || "")
  const [assignPackageId, setAssignPackageId] = useState(packages[0]?.id || "")
  const [assignStartDate, setAssignStartDate] = useState(getTodayDateString())
  const [assignPaymentMethod, setAssignPaymentMethod] = useState<
    "pix" | "dinheiro" | "cartao_debito" | "cartao_credito" | "transferencia"
  >("pix")
  const [assignIsPaid, setAssignIsPaid] = useState(true)
  const [isSubmittingAssign, setIsSubmittingAssign] = useState(false)

  // Modal 5: Excluir / Cancelar Pacote de Aluno
  const [deletingPatientPackage, setDeletingPatientPackage] = useState<any | null>(null)
  const [isDeletingPatientPackage, setIsDeletingPatientPackage] = useState(false)

  const showToast = (msg: string) => {
    setFeedback(msg)
    setTimeout(() => setFeedback(null), 3500)
  }

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
    setAssignStartDate(getTodayDateString())
    setAssignIsPaid(true)
    setIsAssignModalOpen(true)
  }

  // Renovar Plano para Paciente
  const handleRenewForPatient = (patientId: string, packageId: string) => {
    setAssignPatientId(patientId)
    setAssignPackageId(packageId)
    setAssignStartDate(getTodayDateString())
    setAssignIsPaid(true)
    setIsAssignModalOpen(true)
  }

  // Criar Pacote Comercial
  const handleCreatePackage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pkgName || !pkgServiceId || pkgPrice <= 0 || pkgSessionCount <= 0) {
      alert("Preencha todos os campos obrigatórios com valores válidos.")
      return
    }

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

      showToast(`Pacote "${pkgName}" cadastrado com sucesso!`)
      setIsNewPackageModalOpen(false)
      setPkgName("")
      setPkgDescription("")
      setPkgPrice(380)
      setPkgSessionCount(8)
    } catch (err: any) {
      alert("Erro ao criar pacote: " + (err?.message || "Tente novamente."))
    } finally {
      setIsSubmittingPkg(false)
    }
  }

  // Abrir Modal de Edição de Pacote
  const handleOpenEditPackage = (pkg: ClinicPackage) => {
    setEditingPkg(pkg)
    setEditName(pkg.name)
    setEditServiceId(pkg.serviceId)
    setEditSessionCount(pkg.sessionCount)
    setEditValidityDays(pkg.validityDays)
    setEditPrice(pkg.price)
    setEditDescription(pkg.description || "")
    setEditActive(pkg.active)
  }

  // Salvar Edição de Pacote
  const handleSaveEditPackage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingPkg) return
    setIsSubmittingEditPkg(true)

    try {
      await updatePackage(editingPkg.id, {
        name: editName,
        serviceId: editServiceId,
        sessionCount: Number(editSessionCount),
        validityDays: Number(editValidityDays),
        price: Number(editPrice),
        description: editDescription,
        active: editActive,
      })
      showToast(`Plano "${editName}" atualizado com sucesso!`)
      setEditingPkg(null)
    } catch (err: any) {
      alert("Erro ao atualizar pacote: " + (err?.message || "Tente novamente."))
    } finally {
      setIsSubmittingEditPkg(false)
    }
  }

  // Confirmar Exclusão de Pacote Comercial
  const handleConfirmDeletePackage = async () => {
    if (!deletingPkg) return
    setIsDeletingPkg(true)
    try {
      await deletePackage(deletingPkg.id)
      showToast(`Plano "${deletingPkg.name}" excluído com sucesso.`)
      setDeletingPkg(null)
    } catch (err: any) {
      alert("Erro ao excluir plano: " + (err?.message || "Tente novamente."))
    } finally {
      setIsDeletingPkg(false)
    }
  }

  // Submeter Venda de Pacote
  const handleAssignPackage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!assignPatientId || !assignPackageId) return

    setIsSubmittingAssign(true)
    try {
      await assignPackageToPatient({
        patientId: assignPatientId,
        packageId: assignPackageId,
        startDate: assignStartDate,
        paymentMethod: assignPaymentMethod,
        isPaid: assignIsPaid,
      })

      const pat = patients.find((p) => p.id === assignPatientId)
      showToast(`Plano vinculado com sucesso para ${pat?.name || "o aluno"}!`)
      setIsAssignModalOpen(false)
    } catch (err: any) {
      alert("Erro ao vincular pacote: " + (err?.message || "Tente novamente."))
    } finally {
      setIsSubmittingAssign(false)
    }
  }

  // Confirmar Cancelamento / Exclusão de Assinatura do Aluno
  const handleConfirmDeletePatientPackage = async () => {
    if (!deletingPatientPackage) return
    setIsDeletingPatientPackage(true)
    try {
      await deletePatientPackage(deletingPatientPackage.id)
      showToast("Assinatura do aluno cancelada/removida com sucesso.")
      setDeletingPatientPackage(null)
    } catch (err: any) {
      alert("Erro ao cancelar assinatura: " + (err?.message || "Tente novamente."))
    } finally {
      setIsDeletingPatientPackage(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Toast Feedback */}
      {feedback && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm font-medium animate-fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Header com Ações Rápidas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <BookmarkCheck className="h-6 w-6 text-primary" />
            <span>Serviços Clínicos & Pacotes Comerciais</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Catálogo completo de procedimentos, planos de sessões de Pilates e Fisioterapia e controle de renovações.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {activeTab === "packages" ? (
            <Button
              variant="outline"
              onClick={() => setIsNewPackageModalOpen(true)}
              className="gap-2 shadow-xs border-primary/30 text-primary hover:bg-primary/5"
            >
              <Plus className="h-4 w-4" />
              <span>Novo Plano Comercial</span>
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => setIsQuickServiceModalOpen(true)}
              className="gap-2 shadow-xs border-primary/30 text-primary hover:bg-primary/5"
            >
              <Plus className="h-4 w-4" />
              <span>Novo Serviço Clínico</span>
            </Button>
          )}

          <Button
            onClick={() => {
              setAssignPatientId(patients[0]?.id || "")
              setAssignPackageId(packages[0]?.id || "")
              setIsAssignModalOpen(true)
            }}
            className="gap-2 shadow-sm"
          >
            <ShoppingBag className="h-4 w-4" />
            <span>Vender / Atribuir Pacote</span>
          </Button>
        </div>
      </div>

      {/* Barra de Navegação em Abas */}
      <div className="flex items-center gap-2 border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab("packages")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === "packages"
              ? "border-primary text-primary bg-primary/5 rounded-t-xl"
              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30 rounded-t-xl"
          }`}
        >
          <ShoppingBag className="h-4 w-4" />
          <span>Planos Comerciais & Saldos</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
            {packages.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("services")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === "services"
              ? "border-primary text-primary bg-primary/5 rounded-t-xl"
              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30 rounded-t-xl"
          }`}
        >
          <Sparkles className="h-4 w-4" />
          <span>Catálogo de Serviços Clínicos</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
            {services.length}
          </span>
        </button>
      </div>

      {activeTab === "services" ? (
        <ServicesCatalogTab
          onCreatePackageForService={(serviceId) => {
            setPkgServiceId(serviceId)
            setActiveTab("packages")
            setIsNewPackageModalOpen(true)
          }}
          onToast={showToast}
        />
      ) : (
        <>
      {/* Cards de Métricas Consolidadas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Alunos com Pacotes Ativos
            </CardTitle>
            <UserCheck className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-foreground">
              {activePackages.length} <span className="text-xs font-normal text-muted-foreground">alunos</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Assinaturas vigentes com saldo positivo
            </p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Total de Sessões em Saldo
            </CardTitle>
            <Sparkles className="h-4 w-4 text-emerald-600" />
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

      {/* Seção de Alertas de Renovação Próxima */}
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
                      {alert.totalSessions} sessões • Vence em: {formatDateBR(alert.expiryDate)}
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

      {/* Planos Oferecidos pela Clínica (CRUD COMPLETO) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-primary" />
              <span>Planos & Pacotes Oferecidos pela Clínica</span>
            </h2>
            <p className="text-xs text-muted-foreground">
              Grade de serviços cadastrados com valores, limites de sessão, edição e regras de validade.
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
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className="text-[10px]">
                        {pkg.validityDays} dias
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleOpenEditPackage(pkg)}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-primary"
                        title="Editar plano"
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeletingPkg(pkg)}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                        title="Excluir plano"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
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

              <div className="w-48 sm:w-56">
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                >
                  <option value="all">Todos ({patientPackages.length})</option>
                  <option value="active">Ativos ({activePackages.length})</option>
                  <option value="needsRenewal">Precisam Renovar ({needsRenewalCount})</option>
                  <option value="completed">Concluídos</option>
                </Select>
              </div>
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
                      {sub.packageName} • Início: {formatDateBR(sub.startDate)} • Vence em:{" "}
                      <span className="font-medium text-foreground">{formatDateBR(sub.expiryDate)}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-3 w-full md:w-[420px]">
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

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRenewForPatient(sub.patientId, sub.packageId)}
                        className="h-8 text-xs gap-1 border-border hover:border-primary"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>Renovar</span>
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeletingPatientPackage(sub)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        title="Cancelar / Excluir pacote do aluno"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {replacementCredits.map((credit) => (
                <div
                  key={credit.id}
                  className="p-3 rounded-xl border border-amber-500/20 bg-background text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground">{credit.patientName}</span>
                    <Badge
                      variant={credit.status === "available" ? "warning" : "outline"}
                      className="text-[9px] py-0 px-1.5"
                    >
                      {credit.status === "available" ? "Disponível" : credit.status === "used" ? "Utilizado" : "Expirado"}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Desmarcado em {formatDateBR(credit.originDate)} • Vence em: <strong>{formatDateBR(credit.expiryDate)}</strong>
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      </>
      )}

      {/* MODAL 1: NOVO PACOTE COMERCIAL */}
      <Dialog open={isNewPackageModalOpen} onOpenChange={setIsNewPackageModalOpen}>
        <DialogContent className="sm:max-w-xl">
          <form onSubmit={handleCreatePackage}>
            <DialogHeader className="space-y-1">
              <DialogTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
                <Plus className="h-5 w-5 text-primary" />
                <span>Novo Pacote / Plano Comercial</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Cadastre um novo plano de tabela disponível para venda aos pacientes.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-foreground/85 mb-1.5">Nome do Pacote *</label>
                <Input
                  value={pkgName}
                  onChange={(e) => setPkgName(e.target.value)}
                  placeholder="Ex: Pilates 2x/Semana (Trimestral) ou Fisio 10 Sessões"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-foreground/85">Serviço Vinculado *</label>
                  <button
                    type="button"
                    onClick={() => setIsQuickServiceModalOpen(true)}
                    className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="h-3 w-3" />
                    <span>+ Novo Serviço</span>
                  </button>
                </div>
                <Select
                  value={pkgServiceId}
                  onChange={(e) => setPkgServiceId(e.target.value)}
                  required
                >
                  {services.map((svc) => (
                    <option key={svc.id} value={svc.id}>
                      {svc.name} ({svc.modality === "turma" ? "Turma" : "Individual"} - {svc.specialty.toUpperCase()})
                    </option>
                  ))}
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground/85 mb-1.5">Quantidade de Sessões *</label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={pkgSessionCount}
                    onChange={(e) => setPkgSessionCount(Number(e.target.value))}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground/85 mb-1.5">Validade (em dias) *</label>
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

              <div>
                <label className="block text-xs font-semibold text-foreground/85 mb-1.5">Preço Total de Tabela (R$) *</label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={pkgPrice}
                  onChange={(e) => setPkgPrice(Number(e.target.value))}
                  required
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Média de R$ {(pkgPrice / (pkgSessionCount || 1)).toFixed(2)} por sessão.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground/85 mb-1.5">Descrição (Opcional)</label>
                <Input
                  value={pkgDescription}
                  onChange={(e) => setPkgDescription(e.target.value)}
                  placeholder="Ex: Inclui avaliação postural e acesso ao estúdio."
                />
              </div>
            </div>

            <DialogFooter className="gap-2 pt-2 sm:space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsNewPackageModalOpen(false)}
                disabled={isSubmittingPkg}
                className="h-10 px-5 rounded-xl font-semibold"
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmittingPkg} className="h-10 px-6 rounded-xl font-semibold shadow-xs">
                {isSubmittingPkg ? "Salvando..." : "Criar Pacote"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: EDITAR PACOTE COMERCIAL */}
      <Dialog open={!!editingPkg} onOpenChange={(open) => !open && setEditingPkg(null)}>
        <DialogContent className="sm:max-w-xl">
          <form onSubmit={handleSaveEditPackage}>
            <DialogHeader className="space-y-1">
              <DialogTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
                <Edit2 className="h-5 w-5 text-primary" />
                <span>Editar Plano Comercial</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Atualize valores, quantidade de sessões e validade deste pacote.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-foreground/85 mb-1.5">Nome do Pacote *</label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-foreground/85">Serviço Vinculado *</label>
                  <button
                    type="button"
                    onClick={() => setIsQuickServiceModalOpen(true)}
                    className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="h-3 w-3" />
                    <span>+ Novo Serviço</span>
                  </button>
                </div>
                <Select
                  value={editServiceId}
                  onChange={(e) => setEditServiceId(e.target.value)}
                  required
                >
                  {services.map((svc) => (
                    <option key={svc.id} value={svc.id}>
                      {svc.name} ({svc.modality === "turma" ? "Turma" : "Individual"} - {svc.specialty.toUpperCase()})
                    </option>
                  ))}
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground/85 mb-1.5">Quantidade de Sessões *</label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={editSessionCount}
                    onChange={(e) => setEditSessionCount(Number(e.target.value))}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground/85 mb-1.5">Validade (em dias) *</label>
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={editValidityDays}
                    onChange={(e) => setEditValidityDays(Number(e.target.value))}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground/85 mb-1.5">Preço Total (R$) *</label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={editPrice}
                  onChange={(e) => setEditPrice(Number(e.target.value))}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground/85 mb-1.5">Descrição</label>
                <Input
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                />
              </div>

              <div className="p-3.5 rounded-xl border border-border bg-muted/20 flex items-center gap-3">
                <input
                  type="checkbox"
                  id="pkg-active"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                  className="rounded border-input text-primary h-4 w-4 cursor-pointer"
                />
                <label htmlFor="pkg-active" className="font-medium text-foreground cursor-pointer text-xs select-none">
                  Plano ativo para novas vendas
                </label>
              </div>
            </div>

            <DialogFooter className="gap-2 pt-2 sm:space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingPkg(null)}
                disabled={isSubmittingEditPkg}
                className="h-10 px-5 rounded-xl font-semibold"
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmittingEditPkg} className="h-10 px-6 rounded-xl font-semibold shadow-xs">
                {isSubmittingEditPkg ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: EXCLUIR PACOTE COMERCIAL */}
      <Dialog open={!!deletingPkg} onOpenChange={(open) => !open && setDeletingPkg(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="h-10 w-10 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-2">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <DialogTitle>Excluir Plano Comercial</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o plano <strong>{deletingPkg?.name}</strong>?
              Esta ação removerá este plano da tabela de preços.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setDeletingPkg(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDeletePackage}
              disabled={isDeletingPkg}
            >
              {isDeletingPkg ? "Excluindo..." : "Confirmar Exclusão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 4: VENDER / ATRIBUIR PACOTE */}
      <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
        <DialogContent className="sm:max-w-xl">
          <form onSubmit={handleAssignPackage}>
            <DialogHeader className="space-y-1">
              <DialogTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
                <ShoppingBag className="h-5 w-5 text-primary" />
                <span>Venda e Atribuição de Pacote</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Vincule um plano ao paciente com lançamento automático na gestão financeira.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-foreground/85 mb-1.5">Paciente / Aluno *</label>
                <Select
                  value={assignPatientId}
                  onChange={(e) => setAssignPatientId(e.target.value)}
                  required
                >
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.phone})
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground/85 mb-1.5">Plano / Pacote Escolhido *</label>
                <Select
                  value={assignPackageId}
                  onChange={(e) => setAssignPackageId(e.target.value)}
                  required
                >
                  {packages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name} — {pkg.sessionCount} sessões (R$ {pkg.price.toFixed(2)})
                    </option>
                  ))}
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground/85 mb-1.5">Data de Início *</label>
                  <Input
                    type="date"
                    value={assignStartDate}
                    onChange={(e) => setAssignStartDate(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground/85 mb-1.5">Forma de Pagamento</label>
                  <Select
                    value={assignPaymentMethod}
                    onChange={(e) => setAssignPaymentMethod(e.target.value as any)}
                  >
                    <option value="pix">PIX Instantâneo</option>
                    <option value="cartao_credito">Cartão de Crédito</option>
                    <option value="cartao_debito">Cartão de Débito</option>
                    <option value="dinheiro">Dinheiro Físico</option>
                    <option value="transferencia">Transferência TED</option>
                  </Select>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-border bg-muted/20 flex items-center gap-3">
                <input
                  type="checkbox"
                  id="assign-paid"
                  checked={assignIsPaid}
                  onChange={(e) => setAssignIsPaid(e.target.checked)}
                  className="rounded border-input text-primary h-4 w-4 cursor-pointer"
                />
                <label htmlFor="assign-paid" className="font-medium text-foreground cursor-pointer text-xs select-none">
                  Pagamento já recebido (Lança receita confirmada no caixa)
                </label>
              </div>
            </div>

            <DialogFooter className="gap-2 pt-2 sm:space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAssignModalOpen(false)}
                disabled={isSubmittingAssign}
                className="h-10 px-5 rounded-xl font-semibold"
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmittingAssign} className="h-10 px-6 rounded-xl font-semibold shadow-xs">
                {isSubmittingAssign ? "Processando..." : "Confirmar Venda do Pacote"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 5: EXCLUIR / CANCELAR PACOTE DO ALUNO */}
      <Dialog open={!!deletingPatientPackage} onOpenChange={(open) => !open && setDeletingPatientPackage(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="h-10 w-10 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-2">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <DialogTitle>Cancelar / Excluir Assinatura</DialogTitle>
            <DialogDescription>
              Deseja cancelar o pacote <strong>{deletingPatientPackage?.packageName}</strong> do paciente{" "}
              <strong>{deletingPatientPackage?.patientName}</strong>?
              O saldo de {deletingPatientPackage?.remainingSessions} sessões será desativado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setDeletingPatientPackage(null)}>
              Fechar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDeletePatientPackage}
              disabled={isDeletingPatientPackage}
            >
              {isDeletingPatientPackage ? "Cancelando..." : "Confirmar Cancelamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL RÁPIDO: CRIAR SERVIÇO A PARTIR DO MODAL DE PACOTE */}
      <ServiceFormModal
        open={isQuickServiceModalOpen}
        onOpenChange={setIsQuickServiceModalOpen}
        onSuccess={(newId, newName) => {
          setPkgServiceId(newId)
          setEditServiceId(newId)
          showToast(`Serviço "${newName}" cadastrado e selecionado!`)
        }}
      />
    </div>
  )
}
