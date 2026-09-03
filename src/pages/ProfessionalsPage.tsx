import React, { useState } from "react"
import { useClinicData } from "@/contexts/ClinicDataContext"
import type { Professional, Specialty } from "@/types"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
  Stethoscope,
  Plus,
  Search,
  CheckCircle2,
  Edit2,
  Trash2,
  Phone,
  Mail,
  Award,
  DollarSign,
  Percent,
  UserCheck,
  UserX,
  Sparkles,
  AlertTriangle,
} from "lucide-react"

import { ViewModeToggle, type ViewMode } from "@/components/ui/view-mode-toggle"

const ALL_SPECIALTIES: Specialty[] = ["Fisioterapia", "Pilates", "RPG"]

export const ProfessionalsPage: React.FC = () => {
  const { professionals, addProfessional, updateProfessional, deleteProfessional } = useClinicData()

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem("altar_professionals_view_mode")
    return saved === "list" || saved === "grid" ? saved : "grid"
  })

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode)
    localStorage.setItem("altar_professionals_view_mode", mode)
  }

  // Estados de Busca e Filtros
  const [searchTerm, setSearchTerm] = useState("")
  const [specialtyFilter, setSpecialtyFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all")
  const [feedback, setFeedback] = useState<string | null>(null)

  // Modal de Criação / Edição
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [crefito, setCrefito] = useState("")
  const [specialties, setSpecialties] = useState<Specialty[]>(["Fisioterapia"])
  const [commissionType, setCommissionType] = useState<"percentage" | "fixed">("percentage")
  const [commissionValue, setCommissionValue] = useState<number>(40)
  const [active, setActive] = useState<boolean>(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Modal de Exclusão
  const [deletingProf, setDeletingProf] = useState<Professional | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const showToast = (msg: string) => {
    setFeedback(msg)
    setTimeout(() => setFeedback(null), 3500)
  }

  // Filtragem
  const filteredProfessionals = professionals.filter((prof) => {
    const term = searchTerm.toLowerCase()
    const matchesSearch =
      prof.name.toLowerCase().includes(term) ||
      prof.crefito.toLowerCase().includes(term) ||
      prof.email.toLowerCase().includes(term) ||
      prof.phone.includes(term)

    if (!matchesSearch) return false

    if (specialtyFilter !== "all" && !prof.specialties.includes(specialtyFilter as Specialty)) {
      return false
    }

    if (statusFilter === "active" && !prof.active) return false
    if (statusFilter === "inactive" && prof.active) return false

    return true
  })

  // KPIs
  const totalCount = professionals.length
  const activeCount = professionals.filter((p) => p.active).length
  const pilatesCount = professionals.filter((p) => p.specialties.includes("Pilates")).length
  const rpgCount = professionals.filter((p) => p.specialties.includes("RPG")).length

  const handleOpenCreate = () => {
    setEditingId(null)
    setName("")
    setEmail("")
    setPhone("")
    setCrefito("")
    setSpecialties(["Fisioterapia"])
    setCommissionType("percentage")
    setCommissionValue(40)
    setActive(true)
    setIsModalOpen(true)
  }

  const handleOpenEdit = (prof: Professional) => {
    setEditingId(prof.id)
    setName(prof.name)
    setEmail(prof.email)
    setPhone(prof.phone)
    setCrefito(prof.crefito)
    setSpecialties(prof.specialties || ["Fisioterapia"])
    setCommissionType(prof.commissionType || "percentage")
    setCommissionValue(prof.commissionValue || 40)
    setActive(prof.active)
    setIsModalOpen(true)
  }

  const toggleSpecialty = (spec: Specialty) => {
    setSpecialties((prev) =>
      prev.includes(spec) ? prev.filter((s) => s !== spec) : [...prev, spec]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !crefito || !phone) {
      alert("Por favor, preencha Nome, Registro CREFITO e Telefone.")
      return
    }
    if (specialties.length === 0) {
      alert("Selecione pelo menos uma especialidade clínica.")
      return
    }

    setIsSubmitting(true)
    try {
      if (editingId) {
        await updateProfessional(editingId, {
          name,
          email,
          phone,
          crefito,
          specialties,
          commissionType,
          commissionValue: Number(commissionValue),
          active,
        })
        showToast(`Profissional "${name}" atualizado com sucesso!`)
      } else {
        await addProfessional({
          name,
          email,
          phone,
          crefito,
          specialties,
          commissionType,
          commissionValue: Number(commissionValue),
          active,
        })
        showToast(`Profissional "${name}" cadastrado com sucesso!`)
      }
      setIsModalOpen(false)
    } catch (err: any) {
      alert("Erro ao salvar profissional: " + (err?.message || "Tente novamente."))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deletingProf) return
    setIsDeleting(true)
    try {
      await deleteProfessional(deletingProf.id)
      showToast(`Profissional "${deletingProf.name}" removido com sucesso.`)
      setDeletingProf(null)
    } catch (err: any) {
      alert("Erro ao excluir profissional: " + (err?.message || "Tente novamente."))
    } finally {
      setIsDeleting(false)
    }
  }

  const handleToggleStatus = async (prof: Professional) => {
    try {
      await updateProfessional(prof.id, { active: !prof.active })
      showToast(
        prof.active
          ? `Profissional ${prof.name} inativado.`
          : `Profissional ${prof.name} ativado com sucesso!`
      )
    } catch (err: any) {
      alert("Erro ao atualizar status: " + (err?.message || "Tente novamente."))
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

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Stethoscope className="h-6 w-6 text-primary" />
            <span>Profissionais & Equipe Clínica</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Gestão completa de fisioterapeutas, instrutores de Pilates, especialistas em RPG e comissionamento.
          </p>
        </div>

        <Button onClick={handleOpenCreate} className="gap-2 self-start sm:self-auto shadow-sm">
          <Plus className="h-4 w-4" />
          <span>Cadastrar Profissional</span>
        </Button>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Total de Profissionais
            </CardTitle>
            <Stethoscope className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-foreground">{totalCount}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Corpo clínico cadastrado na clínica
            </p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Profissionais Ativos
            </CardTitle>
            <UserCheck className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {activeCount}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Disponíveis para atendimentos e aulas
            </p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Studio Pilates
            </CardTitle>
            <Award className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {pilatesCount}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Instrutores habilitados em aparelhos
            </p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              RPG Souchard
            </CardTitle>
            <Sparkles className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {rpgCount}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Especialistas em Reeducação Postural
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Filtros e Busca */}
      <Card className="p-4 border-border shadow-xs">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome, CREFITO, e-mail ou telefone..."
              className="pl-10 h-10 text-xs sm:text-sm"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="w-48">
              <Select
                value={specialtyFilter}
                onChange={(e) => setSpecialtyFilter(e.target.value)}
              >
                <option value="all">Todas as Especialidades</option>
                <option value="Fisioterapia">Fisioterapia</option>
                <option value="Pilates">Pilates</option>
                <option value="RPG">RPG</option>
              </Select>
            </div>

            <div className="w-36 sm:w-40">
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
              >
                <option value="all">Todos os Status</option>
                <option value="active">Apenas Ativos</option>
                <option value="inactive">Apenas Inativos</option>
              </Select>
            </div>

            <ViewModeToggle viewMode={viewMode} onChange={handleViewModeChange} />
          </div>
        </div>
      </Card>

      {/* Listagem de Profissionais (Grade ou Lista) */}
      {filteredProfessionals.length === 0 ? (
        <Card className="p-12 text-center border-border shadow-xs">
          <Stethoscope className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-foreground">Nenhum profissional encontrado</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Ajuste os filtros de busca ou cadastre um novo membro para o corpo clínico da Altar Fisio.
          </p>
          <Button onClick={handleOpenCreate} variant="outline" size="sm" className="mt-4 gap-2 text-xs">
            <Plus className="h-3.5 w-3.5" />
            <span>Cadastrar Profissional</span>
          </Button>
        </Card>
      ) : viewMode === "grid" ? (
        /* MODO GRADE */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
          {filteredProfessionals.map((prof) => (
            <Card
              key={prof.id}
              className={`border-border flex flex-col justify-between hover:border-primary/40 transition-all shadow-xs ${
                !prof.active ? "opacity-75 bg-muted/20" : ""
              }`}
            >
              <CardHeader className="p-5 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-2xl bg-primary/15 text-primary flex items-center justify-center font-bold text-base shadow-2xs">
                      {prof.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm text-foreground leading-tight">
                          {prof.name}
                        </h3>
                      </div>
                      <p className="text-xs font-mono font-semibold text-primary mt-0.5">
                        {prof.crefito}
                      </p>
                    </div>
                  </div>

                  <Badge
                    variant={prof.active ? "default" : "outline"}
                    className={`text-[10px] shrink-0 font-semibold ${
                      prof.active ? "bg-emerald-600/10 text-emerald-600 border-emerald-600/30" : "text-muted-foreground"
                    }`}
                  >
                    {prof.active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>

                {/* Especialidades */}
                <div className="flex flex-wrap gap-1.5 pt-3">
                  {prof.specialties.map((spec) => (
                    <Badge
                      key={spec}
                      variant="secondary"
                      className="text-[10px] font-semibold py-0.5 px-2 bg-secondary text-secondary-foreground"
                    >
                      {spec}
                    </Badge>
                  ))}
                </div>
              </CardHeader>

              <CardContent className="p-5 pt-0 space-y-3">
                {/* Informações de Contato e Comissão */}
                <div className="space-y-1.5 text-xs text-muted-foreground border-t border-border/70 pt-3">
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>{prof.phone}</span>
                  </div>
                  {prof.email && (
                    <div className="flex items-center gap-2 truncate">
                      <Mail className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="truncate">{prof.email}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 text-primary font-semibold text-xs border border-primary/20">
                      {prof.commissionType === "percentage" ? (
                        <Percent className="h-3.5 w-3.5" />
                      ) : (
                        <DollarSign className="h-3.5 w-3.5" />
                      )}
                      <span>
                        Comissão:{" "}
                        {prof.commissionType === "percentage"
                          ? `${prof.commissionValue}% por atendimento`
                          : `R$ ${prof.commissionValue.toFixed(2)} fixo/aluno`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Botões de Ação do Card */}
                <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleToggleStatus(prof)}
                    className="text-xs h-8 px-2.5 text-muted-foreground hover:text-foreground"
                    title={prof.active ? "Inativar profissional" : "Ativar profissional"}
                  >
                    {prof.active ? (
                      <UserX className="h-3.5 w-3.5 mr-1 text-amber-500" />
                    ) : (
                      <UserCheck className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                    )}
                    <span>{prof.active ? "Inativar" : "Ativar"}</span>
                  </Button>

                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenEdit(prof)}
                      className="text-xs h-8 px-2.5 gap-1 text-primary hover:bg-primary/5 border-primary/30"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      <span>Editar</span>
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDeletingProf(prof)}
                      className="text-xs h-8 px-2.5 gap-1 text-destructive hover:bg-destructive/10 border-destructive/30"
                      title="Excluir profissional"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* MODO LISTA (100% RESPONSIVO) */
        <div className="bg-card rounded-2xl border border-border shadow-xs overflow-hidden animate-fade-in">
          {/* Tabela para Desktop e Tablet (>= 640px) */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-muted/40 border-b border-border/70 text-muted-foreground font-semibold">
                  <th className="p-3 pl-4">Profissional</th>
                  <th className="p-3">Especialidades</th>
                  <th className="p-3">Contato</th>
                  <th className="p-3">Repasse / Comissão</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 pr-4 text-right">Ações Rápidas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredProfessionals.map((prof) => (
                  <tr
                    key={prof.id}
                    className={`hover:bg-muted/30 transition-colors ${
                      !prof.active ? "opacity-75 bg-muted/10" : ""
                    }`}
                  >
                    <td className="p-3 pl-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                          {prof.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-foreground">{prof.name}</div>
                          <div className="text-[11px] font-mono text-primary font-semibold">
                            {prof.crefito}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="p-3">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {prof.specialties.map((spec) => (
                          <Badge
                            key={spec}
                            variant="secondary"
                            className="text-[10px] font-semibold py-0.5 px-2 bg-secondary text-secondary-foreground"
                          >
                            {spec}
                          </Badge>
                        ))}
                      </div>
                    </td>

                    <td className="p-3 whitespace-nowrap text-muted-foreground">
                      <div className="flex items-center gap-1.5 text-foreground font-medium">
                        <Phone className="h-3 w-3 text-primary shrink-0" />
                        <span>{prof.phone}</span>
                      </div>
                      {prof.email && (
                        <div className="text-[11px] text-muted-foreground truncate max-w-[170px]">
                          {prof.email}
                        </div>
                      )}
                    </td>

                    <td className="p-3 whitespace-nowrap">
                      <Badge variant="outline" className="text-[10px] font-semibold bg-primary/5 text-primary border-primary/25">
                        {prof.commissionType === "percentage"
                          ? `${prof.commissionValue}% por atendimento`
                          : `R$ ${prof.commissionValue.toFixed(2)} fixo/aluno`}
                      </Badge>
                    </td>

                    <td className="p-3 whitespace-nowrap">
                      <Badge
                        variant={prof.active ? "default" : "outline"}
                        className={`text-[10px] font-semibold ${
                          prof.active
                            ? "bg-emerald-600/10 text-emerald-600 border-emerald-600/30"
                            : "text-muted-foreground"
                        }`}
                      >
                        {prof.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </td>

                    <td className="p-3 pr-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleStatus(prof)}
                          className={`h-8 px-2.5 text-xs ${
                            prof.active
                              ? "text-muted-foreground hover:text-amber-500"
                              : "text-muted-foreground hover:text-emerald-600"
                          }`}
                          title={prof.active ? "Inativar Profissional" : "Ativar Profissional"}
                        >
                          {prof.active ? (
                            <>
                              <UserX className="h-3.5 w-3.5 mr-1" />
                              <span className="hidden lg:inline">Inativar</span>
                            </>
                          ) : (
                            <>
                              <UserCheck className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                              <span className="hidden lg:inline">Ativar</span>
                            </>
                          )}
                        </Button>

                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleOpenEdit(prof)}
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          title="Editar Profissional"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>

                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setDeletingProf(prof)}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          title="Excluir Profissional"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards Condensados para Mobile (< 640px) */}
          <div className="sm:hidden divide-y divide-border/60">
            {filteredProfessionals.map((prof) => (
              <div
                key={prof.id}
                className={`p-4 space-y-3 ${!prof.active ? "opacity-75 bg-muted/10" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                      {prof.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-bold text-sm text-foreground leading-tight">
                        {prof.name}
                      </div>
                      <div className="text-xs font-mono text-primary font-semibold mt-0.5">
                        {prof.crefito}
                      </div>
                    </div>
                  </div>

                  <Badge
                    variant={prof.active ? "default" : "outline"}
                    className={`text-[9px] font-semibold ${
                      prof.active
                        ? "bg-emerald-600/10 text-emerald-600 border-emerald-600/30"
                        : "text-muted-foreground"
                    }`}
                  >
                    {prof.active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>

                {/* Especialidades */}
                <div className="flex flex-wrap gap-1">
                  {prof.specialties.map((spec) => (
                    <Badge
                      key={spec}
                      variant="secondary"
                      className="text-[9px] font-semibold py-0.5 px-2 bg-secondary text-secondary-foreground"
                    >
                      {spec}
                    </Badge>
                  ))}
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/50">
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3 w-3 text-primary shrink-0" />
                    <span>{prof.phone}</span>
                  </div>
                  <span className="font-semibold text-primary">
                    {prof.commissionType === "percentage"
                      ? `${prof.commissionValue}% comissão`
                      : `R$ ${prof.commissionValue.toFixed(2)}`}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-1.5 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleToggleStatus(prof)}
                    className="h-8 px-2.5 text-xs flex-1 gap-1"
                  >
                    {prof.active ? (
                      <>
                        <UserX className="h-3.5 w-3.5 text-amber-500" />
                        <span>Inativar</span>
                      </>
                    ) : (
                      <>
                        <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Ativar</span>
                      </>
                    )}
                  </Button>

                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => handleOpenEdit(prof)}
                    className="h-8 w-8 text-muted-foreground shrink-0"
                    title="Editar"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>

                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => setDeletingProf(prof)}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                    title="Excluir"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de Cadastro / Edição */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-xl">
          <form onSubmit={handleSubmit}>
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-xl font-bold text-foreground">
                {editingId ? "Editar Profissional" : "Cadastrar Novo Profissional"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Informe os dados cadastrais, registro profissional CREFITO e regras de comissão.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4 text-sm max-h-[68vh] overflow-y-auto px-1">
              <div>
                <label className="block text-xs font-semibold text-foreground/85 mb-1.5">Nome Completo *</label>
                <Input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Dr. Roberto Alencar"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground/85 mb-1.5">Registro CREFITO *</label>
                  <Input
                    required
                    value={crefito}
                    onChange={(e) => setCrefito(e.target.value)}
                    placeholder="CREFITO-3 / 123456-F"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground/85 mb-1.5">WhatsApp / Celular *</label>
                  <Input
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(11) 98888-7777"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground/85 mb-1.5">E-mail Profissional</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="roberto@altarfisio.com.br"
                />
              </div>

              {/* Especialidades */}
              <div className="space-y-2 pt-1">
                <label className="block text-xs font-semibold text-foreground/85">Especialidades Habilitadas *</label>
                <div className="flex flex-wrap gap-2">
                  {ALL_SPECIALTIES.map((spec) => {
                    const isSelected = specialties.includes(spec)
                    return (
                      <button
                        key={spec}
                        type="button"
                        onClick={() => toggleSpecialty(spec)}
                        className={`px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all ${
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary shadow-xs"
                            : "bg-background text-muted-foreground border-input hover:bg-muted"
                        }`}
                      >
                        {isSelected ? "✓ " : "+ "}
                        {spec}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Regras de Comissão */}
              <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-3 pt-3">
                <span className="font-bold text-foreground block text-xs">
                  Regra de Repasse & Comissionamento
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-foreground/85 mb-1.5">Tipo de Repasse</label>
                    <Select
                      value={commissionType}
                      onChange={(e) => setCommissionType(e.target.value as any)}
                    >
                      <option value="percentage">Percentual (%)</option>
                      <option value="fixed">Valor Fixo (R$)</option>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground/85 mb-1.5">
                      {commissionType === "percentage" ? "Porcentagem (%) *" : "Valor por Atendimento (R$) *"}
                    </label>
                    <Input
                      type="number"
                      min={0}
                      step={commissionType === "percentage" ? 1 : 0.5}
                      max={commissionType === "percentage" ? 100 : 1000}
                      required
                      value={commissionValue}
                      onChange={(e) => setCommissionValue(Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>

              {/* Status Ativo */}
              <div className="p-3.5 rounded-xl border border-border bg-muted/20 flex items-center gap-3">
                <input
                  type="checkbox"
                  id="prof-active"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="rounded border-input text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                />
                <label htmlFor="prof-active" className="font-medium text-foreground cursor-pointer text-xs select-none">
                  Profissional ativo (habilitado para agendamentos e turmas)
                </label>
              </div>
            </div>

            <DialogFooter className="gap-2 pt-2 sm:space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
                className="h-10 px-5 rounded-xl font-semibold"
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting} className="h-10 px-6 rounded-xl font-semibold shadow-xs">
                {isSubmitting
                  ? "Salvando..."
                  : editingId
                  ? "Salvar Alterações"
                  : "Cadastrar Profissional"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação de Exclusão */}
      <Dialog open={!!deletingProf} onOpenChange={(open) => !open && setDeletingProf(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="h-10 w-10 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-2">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <DialogTitle>Excluir Profissional</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o cadastro de{" "}
              <strong>{deletingProf?.name}</strong> ({deletingProf?.crefito})?
              Esta ação removerá o profissional do sistema.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeletingProf(null)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Excluindo..." : "Confirmar Exclusão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
