import React, { useState } from "react"
import { useClinicData } from "@/contexts/ClinicDataContext"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
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
  Users,
  Search,
  Plus,
  Phone,
  Mail,
  FileText,
  AlertCircle,
  CheckCircle2,
  Calendar,
} from "lucide-react"

interface PatientsPageProps {
  onNavigateToClinical: (patientId: string) => void
}

export const PatientsPage: React.FC<PatientsPageProps> = ({ onNavigateToClinical }) => {
  const { patients, addPatient } = useClinicData()

  const [searchTerm, setSearchTerm] = useState("")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  // Form State
  const [name, setName] = useState("")
  const [cpf, setCpf] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [birthDate, setBirthDate] = useState("1990-01-01")
  const [gender, setGender] = useState("Feminino")
  const [emergencyContact, setEmergencyContact] = useState("")
  const [emergencyPhone, setEmergencyPhone] = useState("")
  const [healthInsurance, setHealthInsurance] = useState("Particular")
  const [notes, setNotes] = useState("")

  const filteredPatients = patients.filter((p) => {
    const term = searchTerm.toLowerCase()
    return (
      p.name.toLowerCase().includes(term) ||
      p.documentCpf.includes(term) ||
      p.phone.includes(term)
    )
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !cpf || !phone) {
      alert("Por favor, preencha Nome, CPF e Telefone!")
      return
    }

    addPatient({
      name,
      documentCpf: cpf,
      phone,
      email,
      birthDate,
      gender,
      emergencyContact,
      emergencyPhone,
      healthInsurance,
      notes,
    })

    setIsModalOpen(false)
    setName("")
    setCpf("")
    setPhone("")
    setEmail("")
    setNotes("")
    setFeedback("Novo paciente cadastrado com sucesso!")
    setTimeout(() => setFeedback(null), 3000)
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
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
            <Users className="h-6 w-6 text-primary" />
            <span>Pacientes & Alunos</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Cadastro unificado de pacientes para Fisioterapia, Pilates e RPG.
          </p>
        </div>

        <Button onClick={() => setIsModalOpen(true)} className="gap-2 self-start sm:self-auto">
          <Plus className="h-4 w-4" />
          <span>Cadastrar Paciente</span>
        </Button>
      </div>

      {/* Barra de Busca */}
      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome, CPF ou WhatsApp..."
            className="pl-10 h-11 text-sm"
          />
        </div>
      </Card>

      {/* Grid de Pacientes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPatients.map((patient) => (
          <Card key={patient.id} className="border-border hover:border-primary/40 transition-all flex flex-col justify-between">
            <CardHeader className="p-5 pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-sm">
                    {patient.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-foreground leading-tight">
                      {patient.name}
                    </h3>
                    <p className="text-xs text-muted-foreground font-mono">
                      CPF: {patient.documentCpf}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {patient.healthInsurance || "Particular"}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-5 pt-0 space-y-3">
              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-primary" />
                  <span>{patient.phone}</span>
                </div>
                {patient.email && (
                  <div className="flex items-center gap-2 truncate">
                    <Mail className="h-3.5 w-3.5 text-primary" />
                    <span className="truncate">{patient.email}</span>
                  </div>
                )}
                {patient.notes && (
                  <p className="text-[11px] text-muted-foreground/90 italic line-clamp-2 pt-1">
                    "{patient.notes}"
                  </p>
                )}
              </div>

              <div className="pt-2 border-t border-border flex items-center justify-between gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onNavigateToClinical(patient.id)}
                  className="w-full text-xs gap-1.5 h-8 font-medium text-primary hover:text-primary hover:bg-primary/5"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>Ver Prontuário & Evoluções</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Modal Cadastro de Paciente */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Novo Paciente / Aluno</DialogTitle>
              <DialogDescription>
                Preencha os dados cadastrais completos para a ficha da clínica.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-4 text-xs max-h-[65vh] overflow-y-auto px-1">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Nome Completo *</label>
                <Input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Juliana Mendes da Silva"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">CPF *</label>
                  <Input
                    required
                    value={cpf}
                    onChange={(e) => setCpf(e.target.value)}
                    placeholder="000.000.000-00"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">WhatsApp / Celular *</label>
                  <Input
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(11) 98877-6655"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">E-mail</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Data de Nascimento</label>
                  <Input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Gênero</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full h-10 rounded-lg border border-input bg-background px-3 text-xs"
                  >
                    <option value="Feminino">Feminino</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Convênio / Pagamento</label>
                  <Input
                    value={healthInsurance}
                    onChange={(e) => setHealthInsurance(e.target.value)}
                    placeholder="Particular, Bradesco, etc."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Contato de Emergência</label>
                  <Input
                    value={emergencyContact}
                    onChange={(e) => setEmergencyContact(e.target.value)}
                    placeholder="Ex: Carlos (Esposo)"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Tel. de Emergência</label>
                  <Input
                    value={emergencyPhone}
                    onChange={(e) => setEmergencyPhone(e.target.value)}
                    placeholder="(11) 97766-5544"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Observações Clínicas / Queixa</label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Queixa de dor lombar crônica ao ficar sentado..."
                  className="w-full rounded-lg border border-input bg-background p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Cadastrar Paciente</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
