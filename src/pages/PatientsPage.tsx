import React, { useState } from "react"
import { useClinicData } from "@/contexts/ClinicDataContext"
import type { Patient } from "@/types"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select-native"
import { formatDateBR } from "@/lib/dateUtils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Users,
  Search,
  Plus,
  Phone,
  Mail,
  FileText,
  CheckCircle2,
  Calendar,
  Edit2,
  Trash2,
  UserCheck,
  UserX,
  AlertTriangle,
  HeartPulse,
  Eye,
} from "lucide-react"
import { PatientProfileModal } from "@/components/patients/PatientProfileModal"
import { ViewModeToggle, type ViewMode } from "@/components/ui/view-mode-toggle"

interface PatientsPageProps {
  onNavigateToClinical: (patientId: string) => void
}

export const PatientsPage: React.FC<PatientsPageProps> = ({ onNavigateToClinical }) => {
  const { patients, addPatient, updatePatient, deletePatient, clinicalOverview } = useClinicData()

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem("altar_patients_view_mode")
    return saved === "list" || saved === "grid" ? saved : "grid"
  })

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode)
    localStorage.setItem("altar_patients_view_mode", mode)
  }

  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "has_record">("all")
  const [feedback, setFeedback] = useState<string | null>(null)

  // Modal de Ficha Completa 360°
  const [profilePatient, setProfilePatient] = useState<Patient | null>(null)

  // Modal de Criação / Edição
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPatientId, setEditingPatientId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [cpf, setCpf] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [birthDate, setBirthDate] = useState("1990-01-01")
  const [gender, setGender] = useState("Feminino")
  const [address, setAddress] = useState("")
  const [emergencyContact, setEmergencyContact] = useState("")
  const [emergencyPhone, setEmergencyPhone] = useState("")
  const [healthInsurance, setHealthInsurance] = useState("Particular")
  const [notes, setNotes] = useState("")
  const [active, setActive] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Modal de Exclusão
  const [deletingPatient, setDeletingPatient] = useState<Patient | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const showToast = (msg: string) => {
    setFeedback(msg)
    setTimeout(() => setFeedback(null), 3500)
  }

  // Filtragem
  const filteredPatients = patients.filter((p) => {
    const term = searchTerm.toLowerCase()
    const matchesSearch =
      p.name.toLowerCase().includes(term) ||
      p.documentCpf.includes(term) ||
      p.phone.includes(term) ||
      (p.email && p.email.toLowerCase().includes(term))

    if (!matchesSearch) return false

    const hasRecord = clinicalOverview.some((co) => co.patientId === p.id && co.hasRecord)

    if (statusFilter === "active" && !p.active) return false
    if (statusFilter === "inactive" && p.active) return false
    if (statusFilter === "has_record" && !hasRecord) return false

    return true
  })

  // KPIs
  const totalCount = patients.length
  const activeCount = patients.filter((p) => p.active).length
  const withRecordCount = patients.filter((p) =>
    clinicalOverview.some((co) => co.patientId === p.id && co.hasRecord)
  ).length

  const handleOpenCreate = () => {
    setEditingPatientId(null)
    setName("")
    setCpf("")
    setPhone("")
    setEmail("")
    setBirthDate("1990-01-01")
    setGender("Feminino")
    setAddress("")
    setEmergencyContact("")
    setEmergencyPhone("")
    setHealthInsurance("Particular")
    setNotes("")
    setActive(true)
    setIsModalOpen(true)
  }

  const handleOpenEdit = (patient: Patient) => {
    setEditingPatientId(patient.id)
    setName(patient.name)
    setCpf(patient.documentCpf)
    setPhone(patient.phone)
    setEmail(patient.email || "")
    setBirthDate(patient.birthDate || "1990-01-01")
    setGender(patient.gender || "Feminino")
    setAddress(patient.address || "")
    setEmergencyContact(patient.emergencyContact || "")
    setEmergencyPhone(patient.emergencyPhone || "")
    setHealthInsurance(patient.healthInsurance || "Particular")
    setNotes(patient.notes || "")
    setActive(patient.active)
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !cpf || !phone) {
      alert("Por favor, preencha Nome, CPF e Telefone!")
      return
    }

    setIsSubmitting(true)
    try {
      if (editingPatientId) {
        await updatePatient(editingPatientId, {
          name,
          documentCpf: cpf,
          phone,
          email,
          birthDate,
          gender,
          address,
          emergencyContact,
          emergencyPhone,
          healthInsurance,
          notes,
          active,
        })
        showToast(`Paciente "${name}" atualizado com sucesso!`)
      } else {
        await addPatient({
          name,
          documentCpf: cpf,
          phone,
          email,
          birthDate,
          gender,
          address,
          emergencyContact,
          emergencyPhone,
          healthInsurance,
          notes,
        })
        showToast(`Paciente "${name}" cadastrado com sucesso!`)
      }
      setIsModalOpen(false)
    } catch (err: any) {
      alert("Erro ao salvar paciente: " + (err?.message || "Tente novamente."))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deletingPatient) return
    setIsDeleting(true)
    try {
      await deletePatient(deletingPatient.id)
      showToast(`Paciente "${deletingPatient.name}" removido com sucesso.`)
      setDeletingPatient(null)
    } catch (err: any) {
      alert("Erro ao excluir paciente: " + (err?.message || "Tente novamente."))
    } finally {
      setIsDeleting(false)
    }
  }

  const handleToggleStatus = async (patient: Patient) => {
    try {
      await updatePatient(patient.id, { active: !patient.active })
      showToast(
        patient.active
          ? `Paciente ${patient.name} marcado como inativo.`
          : `Paciente ${patient.name} reativado com sucesso!`
      )
    } catch (err: any) {
      alert("Erro ao atualizar status: " + (err?.message || "Tente novamente."))
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
            <Users className="h-6 w-6 text-primary" />
            <span>Pacientes & Alunos</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Cadastro de pacientes, fichas clínicas integradas e histórico de atendimentos.
          </p>
        </div>

        <Button onClick={handleOpenCreate} className="gap-2 self-start sm:self-auto shadow-sm">
          <Plus className="h-4 w-4" />
          <span>Novo Paciente</span>
        </Button>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Total de Cadastros
            </CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-foreground">{totalCount}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Pacientes e alunos registrados
            </p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Pacientes Ativos
            </CardTitle>
            <UserCheck className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {activeCount}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Em tratamento ou aulas regulares
            </p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Com Prontuário Ativo
            </CardTitle>
            <HeartPulse className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {withRecordCount}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Ficha clínica e anamnese registradas
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
              placeholder="Buscar por nome, CPF, WhatsApp ou e-mail..."
              className="pl-10 h-10 text-xs sm:text-sm"
            />
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-48 sm:w-56 flex-1 sm:flex-initial">
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
              >
                <option value="all">Todos os Pacientes</option>
                <option value="active">Apenas Ativos</option>
                <option value="inactive">Apenas Inativos</option>
                <option value="has_record">Com Prontuário Ativo</option>
              </Select>
            </div>

            <ViewModeToggle viewMode={viewMode} onChange={handleViewModeChange} />
          </div>
        </div>
      </Card>

      {/* Listagem de Pacientes (Grade ou Lista) */}
      {filteredPatients.length === 0 ? (
        <Card className="p-12 text-center border-border shadow-xs">
          <Users className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-foreground">Nenhum paciente encontrado</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Ajuste os filtros de busca ou cadastre um novo paciente na clínica.
          </p>
          <Button onClick={handleOpenCreate} variant="outline" size="sm" className="mt-4 gap-2 text-xs">
            <Plus className="h-3.5 w-3.5" />
            <span>Cadastrar Paciente</span>
          </Button>
        </Card>
      ) : viewMode === "grid" ? (
        /* MODO GRADE */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
          {filteredPatients.map((patient) => {
            const overviewItem = clinicalOverview.find((co) => co.patientId === patient.id)
            const hasRecord = !!overviewItem?.hasRecord

            return (
              <Card
                key={patient.id}
                className={`border-border flex flex-col justify-between hover:border-primary/40 transition-all shadow-xs ${
                  !patient.active ? "opacity-75 bg-muted/20" : ""
                }`}
              >
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        onClick={() => setProfilePatient(patient)}
                        className="h-11 w-11 rounded-2xl bg-primary/15 text-primary flex items-center justify-center font-bold text-base shadow-2xs cursor-pointer hover:bg-primary/25 transition-colors"
                        title="Ver Ficha Completa 360°"
                      >
                        {patient.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3
                            onClick={() => setProfilePatient(patient)}
                            className="font-bold text-sm text-foreground leading-tight hover:text-primary cursor-pointer transition-colors"
                            title="Ver Ficha Completa 360°"
                          >
                            {patient.name}
                          </h3>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setProfilePatient(patient)}
                            className="h-6 w-6 rounded-lg text-primary hover:bg-primary/10 hover:text-primary shrink-0"
                            title="Ver Ficha Completa 360°"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <p className="text-xs font-mono text-muted-foreground mt-0.5">
                          CPF: {patient.documentCpf}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <Badge
                        variant={patient.active ? "default" : "outline"}
                        className={`text-[10px] font-semibold ${
                          patient.active
                            ? "bg-emerald-600/10 text-emerald-600 border-emerald-600/30"
                            : "text-muted-foreground"
                        }`}
                      >
                        {patient.active ? "Ativo" : "Inativo"}
                      </Badge>
                      {hasRecord ? (
                        <Badge variant="outline" className="text-[9px] text-primary border-primary/30 bg-primary/5">
                          Prontuário Ativo
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] text-muted-foreground">
                          Sem Prontuário
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-5 pt-0 space-y-3">
                  {/* Informações de Contato */}
                  <div className="space-y-1 text-xs text-muted-foreground border-t border-border/70 pt-3">
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>{patient.phone}</span>
                    </div>
                    {patient.email && (
                      <div className="flex items-center gap-2 truncate">
                        <Mail className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="truncate">{patient.email}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>Nasc: {formatDateBR(patient.birthDate)} ({patient.gender})</span>
                    </div>
                  </div>

                  {/* Ações do Card */}
                  <div className="pt-3 border-t border-border space-y-2">
                    <Button
                      size="sm"
                      onClick={() => setProfilePatient(patient)}
                      className="w-full text-xs gap-1.5 h-8.5 shadow-xs font-semibold"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Ficha Completa 360°</span>
                    </Button>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onNavigateToClinical(patient.id)}
                        className="text-xs h-8 px-2.5 gap-1 text-muted-foreground hover:text-foreground border-border"
                        title="Ver Prontuário Clínico & Evoluções"
                      >
                        <FileText className="h-3.5 w-3.5 text-rose-500" />
                        <span>Prontuário</span>
                      </Button>

                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleStatus(patient)}
                          className={`text-xs h-8 px-2 border-border ${
                            patient.active
                              ? "text-muted-foreground hover:text-amber-500"
                              : "text-muted-foreground hover:text-emerald-600"
                          }`}
                          title={patient.active ? "Inativar Paciente" : "Reativar Paciente"}
                        >
                          {patient.active ? (
                            <UserX className="h-3.5 w-3.5 text-muted-foreground" />
                          ) : (
                            <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                          )}
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenEdit(patient)}
                          className="text-xs h-8 px-2.5 gap-1 text-primary hover:bg-primary/5 border-primary/30"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          <span>Editar</span>
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDeletingPatient(patient)}
                          className="text-xs h-8 px-2 text-destructive hover:bg-destructive/10 border-destructive/30"
                          title="Excluir paciente"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        /* MODO LISTA (100% RESPONSIVO) */
        <div className="bg-card rounded-2xl border border-border shadow-xs overflow-hidden animate-fade-in">
          {/* Tabela para Desktop e Tablet (>= 640px) */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-muted/40 border-b border-border/70 text-muted-foreground font-semibold">
                  <th className="p-3 pl-4">Paciente</th>
                  <th className="p-3">Contato</th>
                  <th className="p-3">Nascimento / Sexo</th>
                  <th className="p-3">Status & Prontuário</th>
                  <th className="p-3 pr-4 text-right">Ações Rápidas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredPatients.map((patient) => {
                  const overviewItem = clinicalOverview.find((co) => co.patientId === patient.id)
                  const hasRecord = !!overviewItem?.hasRecord

                  return (
                    <tr
                      key={patient.id}
                      className={`hover:bg-muted/30 transition-colors ${
                        !patient.active ? "opacity-75 bg-muted/10" : ""
                      }`}
                    >
                      <td className="p-3 pl-4">
                        <div className="flex items-center gap-3">
                          <div
                            onClick={() => setProfilePatient(patient)}
                            className="h-9 w-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center font-bold text-xs shrink-0 cursor-pointer hover:bg-primary/25 transition-colors"
                            title="Ver Ficha Completa 360°"
                          >
                            {patient.name.charAt(0)}
                          </div>
                          <div>
                            <div
                              onClick={() => setProfilePatient(patient)}
                              className="font-bold text-sm text-foreground hover:text-primary cursor-pointer transition-colors"
                            >
                              {patient.name}
                            </div>
                            <div className="text-[11px] font-mono text-muted-foreground">
                              CPF: {patient.documentCpf}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Phone className="h-3 w-3 text-primary shrink-0" />
                          <span className="font-medium text-foreground">{patient.phone}</span>
                        </div>
                        {patient.email && (
                          <div className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                            {patient.email}
                          </div>
                        )}
                      </td>

                      <td className="p-3 whitespace-nowrap text-muted-foreground">
                        <div>{formatDateBR(patient.birthDate)}</div>
                        <div className="text-[11px] text-muted-foreground/80">{patient.gender}</div>
                      </td>

                      <td className="p-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge
                            variant={patient.active ? "default" : "outline"}
                            className={`text-[10px] font-semibold ${
                              patient.active
                                ? "bg-emerald-600/10 text-emerald-600 border-emerald-600/30"
                                : "text-muted-foreground"
                            }`}
                          >
                            {patient.active ? "Ativo" : "Inativo"}
                          </Badge>
                          {hasRecord ? (
                            <Badge variant="outline" className="text-[9px] text-primary border-primary/30 bg-primary/5">
                              Prontuário Ativo
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] text-muted-foreground">
                              Sem Prontuário
                            </Badge>
                          )}
                        </div>
                      </td>

                      <td className="p-3 pr-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setProfilePatient(patient)}
                            className="h-8 px-2.5 text-xs gap-1 text-primary border-primary/30 hover:bg-primary/5"
                            title="Ver Ficha Completa 360°"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span className="hidden lg:inline">Ficha 360°</span>
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onNavigateToClinical(patient.id)}
                            className="h-8 px-2.5 text-xs gap-1 text-muted-foreground hover:text-foreground border-border"
                            title="Prontuário Clínico"
                          >
                            <FileText className="h-3.5 w-3.5 text-rose-500" />
                            <span className="hidden lg:inline">Prontuário</span>
                          </Button>

                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleToggleStatus(patient)}
                            className={`h-8 w-8 ${
                              patient.active
                                ? "text-muted-foreground hover:text-amber-500"
                                : "text-muted-foreground hover:text-emerald-600"
                            }`}
                            title={patient.active ? "Inativar Paciente" : "Reativar Paciente"}
                          >
                            {patient.active ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                          </Button>

                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleOpenEdit(patient)}
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            title="Editar Paciente"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setDeletingPatient(patient)}
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            title="Excluir Paciente"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Cards Condensados para Mobile (< 640px) */}
          <div className="sm:hidden divide-y divide-border/60">
            {filteredPatients.map((patient) => {
              const overviewItem = clinicalOverview.find((co) => co.patientId === patient.id)
              const hasRecord = !!overviewItem?.hasRecord

              return (
                <div
                  key={patient.id}
                  className={`p-4 space-y-3 ${!patient.active ? "opacity-75 bg-muted/10" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div
                        onClick={() => setProfilePatient(patient)}
                        className="h-10 w-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center font-bold text-sm shrink-0 cursor-pointer"
                      >
                        {patient.name.charAt(0)}
                      </div>
                      <div>
                        <div
                          onClick={() => setProfilePatient(patient)}
                          className="font-bold text-sm text-foreground hover:text-primary cursor-pointer leading-tight"
                        >
                          {patient.name}
                        </div>
                        <div className="text-xs font-mono text-muted-foreground mt-0.5">
                          CPF: {patient.documentCpf}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <Badge
                        variant={patient.active ? "default" : "outline"}
                        className={`text-[9px] font-semibold ${
                          patient.active
                            ? "bg-emerald-600/10 text-emerald-600 border-emerald-600/30"
                            : "text-muted-foreground"
                        }`}
                      >
                        {patient.active ? "Ativo" : "Inativo"}
                      </Badge>
                      {hasRecord ? (
                        <Badge variant="outline" className="text-[9px] text-primary border-primary/30 bg-primary/5">
                          Prontuário
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] text-muted-foreground">
                          Sem Ficha
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/50">
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3 w-3 text-primary shrink-0" />
                      <span>{patient.phone}</span>
                    </div>
                    <span>{formatDateBR(patient.birthDate)}</span>
                  </div>

                  <div className="flex items-center justify-between gap-1.5 pt-1">
                    <Button
                      size="sm"
                      onClick={() => setProfilePatient(patient)}
                      className="h-8 px-2.5 text-xs gap-1 flex-1 font-semibold"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Ficha 360°</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onNavigateToClinical(patient.id)}
                      className="h-8 px-2.5 text-xs gap-1 text-muted-foreground hover:text-foreground"
                    >
                      <FileText className="h-3.5 w-3.5 text-rose-500" />
                      <span>Prontuário</span>
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => handleOpenEdit(patient)}
                      className="h-8 w-8 text-muted-foreground shrink-0"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => setDeletingPatient(patient)}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Modal de Cadastro / Edição */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-xl">
          <form onSubmit={handleSubmit}>
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-xl font-bold text-foreground">
                {editingPatientId ? "Editar Paciente" : "Novo Cadastro de Paciente"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Informe os dados cadastrais, contato de emergência e convênio do paciente.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4 text-sm max-h-[70vh] overflow-y-auto px-1">
              <div>
                <label className="block text-xs font-semibold text-foreground/85 mb-1.5">Nome Completo *</label>
                <Input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome do paciente"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground/85 mb-1.5">CPF *</label>
                  <Input
                    required
                    value={cpf}
                    onChange={(e) => setCpf(e.target.value)}
                    placeholder="000.000.000-00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground/85 mb-1.5">WhatsApp / Telefone *</label>
                  <Input
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(11) 98888-8888"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground/85 mb-1.5">E-mail</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="paciente@exemplo.com"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground/85 mb-1.5">Data de Nascimento</label>
                  <Input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground/85 mb-1.5">Gênero</label>
                  <Select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                  >
                    <option value="Feminino">Feminino</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Outro">Outro</option>
                  </Select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground/85 mb-1.5">Endereço Residencial</label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Rua, Número, Bairro, Cidade"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground/85 mb-1.5">Contato de Emergência</label>
                  <Input
                    value={emergencyContact}
                    onChange={(e) => setEmergencyContact(e.target.value)}
                    placeholder="Nome do contato"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground/85 mb-1.5">Telefone de Emergência</label>
                  <Input
                    value={emergencyPhone}
                    onChange={(e) => setEmergencyPhone(e.target.value)}
                    placeholder="(11) 99999-9999"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground/85 mb-1.5">Plano / Convênio</label>
                <Input
                  value={healthInsurance}
                  onChange={(e) => setHealthInsurance(e.target.value)}
                  placeholder="Particular, Bradesco, Amil..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground/85 mb-1.5">Observações Iniciais</label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Lombalgia crônica, indicação médica..."
                />
              </div>

              <div className="p-3.5 rounded-xl border border-border bg-muted/20 flex items-center gap-3">
                <input
                  type="checkbox"
                  id="pat-active"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="rounded border-input text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                />
                <label htmlFor="pat-active" className="font-medium text-foreground cursor-pointer text-xs select-none">
                  Paciente ativo na clínica
                </label>
              </div>
            </div>

            <DialogFooter className="gap-2 pt-2 sm:space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                className="h-10 px-5 rounded-xl font-semibold"
              >
                Cancelar
              </Button>
              <Button type="submit" className="h-10 px-6 rounded-xl font-semibold shadow-xs">
                {editingPatientId ? "Salvar Alterações" : "Cadastrar Paciente"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação de Exclusão */}
      <Dialog open={!!deletingPatient} onOpenChange={(open) => !open && setDeletingPatient(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="h-10 w-10 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-2">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <DialogTitle>Excluir Paciente</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o cadastro de{" "}
              <strong>{deletingPatient?.name}</strong> (CPF: {deletingPatient?.documentCpf})?
              Esta ação removerá o paciente do sistema.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeletingPatient(null)}
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

      {/* Modal Amplo de Ficha Completa 360° do Paciente */}
      <PatientProfileModal
        patient={profilePatient}
        isOpen={!!profilePatient}
        onClose={() => setProfilePatient(null)}
        onEdit={handleOpenEdit}
        onNavigateToClinical={onNavigateToClinical}
      />
    </div>
  )
}
