import React, { useState } from "react"
import { useClinicData } from "@/contexts/ClinicDataContext"
import type { ClinicService } from "@/types"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select-native"
import { ServiceFormModal } from "./ServiceFormModal"
import { DeleteServiceModal } from "./DeleteServiceModal"
import {
  Sparkles,
  Clock,
  DollarSign,
  Plus,
  Search,
  Edit2,
  Trash2,
  Power,
  Layers,
  CheckCircle2,
  Stethoscope,
  Activity,
  BookmarkPlus,
  Tag,
} from "lucide-react"

interface ServicesCatalogTabProps {
  onCreatePackageForService?: (serviceId: string) => void
  onToast?: (msg: string) => void
}

export const ServicesCatalogTab: React.FC<ServicesCatalogTabProps> = ({
  onCreatePackageForService,
  onToast,
}) => {
  const { services, updateService } = useClinicData()

  const [searchTerm, setSearchTerm] = useState("")
  const [specialtyFilter, setSpecialtyFilter] = useState<"all" | "pilates" | "fisioterapia" | "rpg">("all")
  const [modalityFilter, setModalityFilter] = useState<"all" | "individual" | "turma">("all")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all")

  // Modais
  const [isFormModalOpen, setIsFormModalOpen] = useState(false)
  const [serviceToEdit, setServiceToEdit] = useState<ClinicService | null>(null)
  const [serviceToDelete, setServiceToDelete] = useState<ClinicService | null>(null)

  // Estatísticas do Catálogo
  const totalServices = services.length
  const activeServices = services.filter((s) => s.active).length
  const pilatesCount = services.filter((s) => s.specialty === "pilates").length
  const fisioCount = services.filter((s) => s.specialty === "fisioterapia").length
  const rpgCount = services.filter((s) => s.specialty === "rpg").length

  // Filtragem
  const filteredServices = services.filter((svc) => {
    const term = searchTerm.toLowerCase()
    const matchesSearch =
      svc.name.toLowerCase().includes(term) ||
      (svc.description || "").toLowerCase().includes(term)

    if (!matchesSearch) return false

    if (specialtyFilter !== "all" && svc.specialty !== specialtyFilter) return false
    if (modalityFilter !== "all" && svc.modality !== modalityFilter) return false
    if (statusFilter === "active" && !svc.active) return false
    if (statusFilter === "inactive" && svc.active) return false

    return true
  })

  const handleOpenCreate = () => {
    setServiceToEdit(null)
    setIsFormModalOpen(true)
  }

  const handleOpenEdit = (svc: ClinicService) => {
    setServiceToEdit(svc)
    setIsFormModalOpen(true)
  }

  const handleToggleActive = async (svc: ClinicService) => {
    try {
      await updateService(svc.id, { active: !svc.active })
      onToast?.(`Serviço "${svc.name}" foi ${!svc.active ? "ativado" : "desativado"}.`)
    } catch (err: any) {
      alert("Erro ao alterar status: " + (err?.message || "Tente novamente."))
    }
  }

  const getSpecialtyBadge = (spec: string) => {
    switch (spec) {
      case "pilates":
        return (
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
            Pilates
          </span>
        )
      case "fisioterapia":
        return (
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30">
            Fisioterapia
          </span>
        )
      case "rpg":
        return (
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">
            RPG
          </span>
        )
      default:
        return (
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            {spec}
          </span>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Header com Resumo & Ação Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span>Catálogo de Procedimentos & Serviços Clínicos</span>
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Defina os tipos de atendimento da Altar Fisio, durações, modalidades e preços-base de tabela.
          </p>
        </div>

        <Button onClick={handleOpenCreate} className="gap-2 shadow-xs shrink-0">
          <Plus className="h-4 w-4" />
          <span>Novo Serviço Clínico</span>
        </Button>
      </div>

      {/* Cards de Métricas do Catálogo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border shadow-2xs">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Total Cadastrado</p>
              <p className="text-xl font-bold text-foreground">{totalServices}</p>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                {activeServices} ativos
              </p>
            </div>
            <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Layers className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-2xs">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Pilates</p>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{pilatesCount}</p>
              <p className="text-[10px] text-muted-foreground">Aparelhos / Solo</p>
            </div>
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <Activity className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-2xs">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Fisioterapia</p>
              <p className="text-xl font-bold text-sky-600 dark:text-sky-400">{fisioCount}</p>
              <p className="text-[10px] text-muted-foreground">Ortopédica / Reab</p>
            </div>
            <div className="h-9 w-9 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center">
              <Stethoscope className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-2xs">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">RPG</p>
              <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{rpgCount}</p>
              <p className="text-[10px] text-muted-foreground">Postural Global</p>
            </div>
            <div className="h-9 w-9 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
              <Tag className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Filtros e Busca */}
      <Card className="border-border shadow-2xs">
        <CardContent className="p-3.5">
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
            <div className="relative flex-1">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou descrição do procedimento..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 pl-9 text-xs rounded-xl"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Select
                value={specialtyFilter}
                onChange={(e) => setSpecialtyFilter(e.target.value as any)}
                className="text-xs h-9 rounded-xl"
              >
                <option value="all">Todas Especialidades</option>
                <option value="pilates">Pilates</option>
                <option value="fisioterapia">Fisioterapia</option>
                <option value="rpg">RPG</option>
              </Select>

              <Select
                value={modalityFilter}
                onChange={(e) => setModalityFilter(e.target.value as any)}
                className="text-xs h-9 rounded-xl"
              >
                <option value="all">Todas Modalidades</option>
                <option value="individual">Individual</option>
                <option value="turma">Turma</option>
              </Select>

              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="text-xs h-9 rounded-xl"
              >
                <option value="all">Todos Status</option>
                <option value="active">Somente Ativos</option>
                <option value="inactive">Inativos</option>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grade de Cards de Serviços */}
      {filteredServices.length === 0 ? (
        <div className="py-12 text-center rounded-2xl border border-dashed border-border bg-muted/10 p-6 space-y-3">
          <div className="h-12 w-12 rounded-2xl bg-muted text-muted-foreground mx-auto flex items-center justify-center">
            <Sparkles className="h-6 w-6" />
          </div>
          <p className="text-sm font-semibold text-foreground">Nenhum serviço clínico encontrado</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Não há procedimentos correspondentes aos filtros selecionados. Tente ajustar a busca ou cadastre um novo serviço.
          </p>
          <Button size="sm" onClick={handleOpenCreate} className="gap-2 text-xs">
            <Plus className="h-3.5 w-3.5" />
            <span>Cadastrar Novo Serviço</span>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredServices.map((svc) => {
            const hasPackages = !!(svc.packageCount && svc.packageCount > 0)

            return (
              <Card
                key={svc.id}
                className={`border-border flex flex-col justify-between transition-all hover:border-primary/40 shadow-xs ${
                  !svc.active ? "opacity-75 bg-muted/20" : ""
                }`}
              >
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {getSpecialtyBadge(svc.specialty)}
                      <Badge variant="outline" className="text-[10px]">
                        {svc.modality === "turma" ? "Turma (até 4)" : "Individual"}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggleActive(svc)}
                        className={`h-7 w-7 p-0 ${
                          svc.active
                            ? "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                        title={svc.active ? "Desativar serviço" : "Ativar serviço"}
                      >
                        <Power className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleOpenEdit(svc)}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                        title="Editar serviço"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setServiceToDelete(svc)}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        title="Excluir serviço"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <CardTitle className="text-base font-bold text-foreground leading-snug">
                    {svc.name}
                  </CardTitle>

                  <CardDescription className="text-xs line-clamp-2 mt-1 min-h-[32px]">
                    {svc.description || "Procedimento clínico padronizado da Altar Fisio."}
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-4 pt-0 space-y-3">
                  <div className="border-t border-border/70 pt-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{svc.durationMinutes} min</span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-muted-foreground block">Valor Avulso</span>
                      <span className="text-base font-bold text-foreground">
                        R$ {svc.defaultPrice.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Indicador de Planos Vinculados */}
                  <div className="p-2 rounded-lg bg-muted/40 flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Planos vinculados:</span>
                    <span className="font-semibold text-foreground">
                      {svc.packageCount || 0} plano(s)
                    </span>
                  </div>

                  {/* Botão de Ação Rápida */}
                  {onCreatePackageForService && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onCreatePackageForService(svc.id)}
                      className="w-full text-xs gap-1.5 h-8 border-primary/30 text-primary hover:bg-primary/5"
                    >
                      <BookmarkPlus className="h-3.5 w-3.5" />
                      <span>Criar Plano Comercial</span>
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Modais Gerenciados */}
      <ServiceFormModal
        open={isFormModalOpen}
        onOpenChange={setIsFormModalOpen}
        serviceToEdit={serviceToEdit}
        onSuccess={(id, name) => {
          onToast?.(
            serviceToEdit
              ? `Serviço "${name}" atualizado com sucesso!`
              : `Serviço "${name}" cadastrado com sucesso!`
          )
        }}
      />

      <DeleteServiceModal
        service={serviceToDelete}
        onClose={() => setServiceToDelete(null)}
        onSuccess={(msg) => onToast?.(msg)}
      />
    </div>
  )
}
