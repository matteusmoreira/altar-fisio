import React, { useState, useEffect } from "react"
import { useClinicData } from "@/contexts/ClinicDataContext"
import type { ClinicService } from "@/types"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select-native"
import { Sparkles, Clock, DollarSign, UsersRound, AlertCircle } from "lucide-react"

interface ServiceFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  serviceToEdit?: ClinicService | null
  onSuccess?: (serviceId: string, serviceName: string) => void
}

export const ServiceFormModal: React.FC<ServiceFormModalProps> = ({
  open,
  onOpenChange,
  serviceToEdit,
  onSuccess,
}) => {
  const { addService, updateService } = useClinicData()

  const [name, setName] = useState("")
  const [specialty, setSpecialty] = useState<"pilates" | "fisioterapia" | "rpg">("pilates")
  const [modality, setModality] = useState<"individual" | "turma">("turma")
  const [maxCapacity, setMaxCapacity] = useState(4)
  const [durationMinutes, setDurationMinutes] = useState(55)
  const [defaultPrice, setDefaultPrice] = useState(90)
  const [packagePricePerSession, setPackagePricePerSession] = useState<number | "">("")
  const [description, setDescription] = useState("")
  const [active, setActive] = useState(true)
  const [isEvaluation, setIsEvaluation] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const isEditing = !!serviceToEdit

  useEffect(() => {
    if (serviceToEdit) {
      setIsEvaluation(serviceToEdit.isEvaluation === true)
      setName(serviceToEdit.name)
      setSpecialty(serviceToEdit.specialty)
      setModality(serviceToEdit.modality)
      setMaxCapacity(serviceToEdit.maxCapacity ?? (serviceToEdit.modality === "turma" ? 4 : 1))
      setDurationMinutes(serviceToEdit.durationMinutes)
      setDefaultPrice(serviceToEdit.defaultPrice)
      setPackagePricePerSession(serviceToEdit.packagePricePerSession ?? "")
      setDescription(serviceToEdit.description || "")
      setActive(serviceToEdit.active)
    } else {
      setIsEvaluation(false)
      setName("")
      setSpecialty("pilates")
      setModality("turma")
      setMaxCapacity(4)
      setDurationMinutes(55)
      setDefaultPrice(90)
      setPackagePricePerSession("")
      setDescription("")
      setActive(true)
    }
    setErrorMsg(null)
  }, [serviceToEdit, open])

  // Ajustes inteligentes de duração e valor padrão ao mudar especialidade ou modalidade
  const handleSpecialtyChange = (val: "pilates" | "fisioterapia" | "rpg") => {
    setSpecialty(val)
    if (!isEditing) {
      if (val === "pilates") {
        setModality("turma")
        setMaxCapacity(4)
        setDurationMinutes(55)
        setDefaultPrice(90)
      } else if (val === "fisioterapia") {
        setModality("individual")
        setMaxCapacity(1)
        setDurationMinutes(50)
        setDefaultPrice(180)
      } else if (val === "rpg") {
        setModality("individual")
        setMaxCapacity(1)
        setDurationMinutes(60)
        setDefaultPrice(220)
      }
    }
  }

  const handleModalityChange = (value: "individual" | "turma") => {
    setModality(value)
    setMaxCapacity(value === "individual" ? 1 : maxCapacity > 1 ? maxCapacity : 4)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    const trimmedName = name.trim()
    if (!trimmedName) {
      setErrorMsg("Informe o nome do serviço clínico.")
      return
    }

    if (durationMinutes <= 0) {
      setErrorMsg("A duração deve ser maior que 0 minutos.")
      return
    }

    if (defaultPrice < 0) {
      setErrorMsg("O valor padrão da sessão avulsa não pode ser negativo.")
      return
    }

    if (modality === "turma" && (!Number.isInteger(maxCapacity) || maxCapacity < 2 || maxCapacity > 100)) {
      setErrorMsg("A capacidade da turma deve ser um número inteiro entre 2 e 100 alunos.")
      return
    }

    if (packagePricePerSession !== "" && packagePricePerSession < 0) {
      setErrorMsg("O preço por sessão em pacote não pode ser negativo.")
      return
    }

    setIsSubmitting(true)
    try {
      if (isEditing && serviceToEdit) {
        await updateService(serviceToEdit.id, {
          name: trimmedName,
          isEvaluation: modality === "individual" && isEvaluation,
          specialty,
          modality,
          maxCapacity: modality === "turma" ? Number(maxCapacity) : 1,
          durationMinutes: Number(durationMinutes),
          defaultPrice: Number(defaultPrice),
          packagePricePerSession:
            packagePricePerSession === "" ? null : Number(packagePricePerSession),
          description: description.trim() || undefined,
          active,
        })
        onOpenChange(false)
        onSuccess?.(serviceToEdit.id, trimmedName)
      } else {
        const newId = await addService({
          name: trimmedName,
          isEvaluation: modality === "individual" && isEvaluation,
          specialty,
          modality,
          maxCapacity: modality === "turma" ? Number(maxCapacity) : 1,
          durationMinutes: Number(durationMinutes),
          defaultPrice: Number(defaultPrice),
          packagePricePerSession:
            packagePricePerSession === "" ? undefined : Number(packagePricePerSession),
          description: description.trim() || undefined,
          active,
        })
        onOpenChange(false)
        onSuccess?.(newId, trimmedName)
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Ocorreu um erro ao salvar o serviço. Tente novamente.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="pr-10">
            <div className="flex items-center gap-2 mb-1 text-primary">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <DialogTitle className="text-xl font-bold">
                {isEditing ? "Editar Serviço Clínico" : "Novo Serviço Clínico"}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              {isEditing
                ? "Atualize as informações do procedimento, modalidades e preços de tabela."
                : "Cadastre um novo procedimento clínico disponível para agendamentos e planos comerciais."}
            </DialogDescription>
          </DialogHeader>

          {errorMsg && (
            <div className="my-3 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="space-y-4 py-4">
            {/* Nome do Serviço */}
            <div>
              <label className="block text-xs font-semibold text-foreground/85 mb-1.5">
                Nome do Serviço / Procedimento *
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Pilates em Aparelhos, Fisioterapia Ortopédica, RPG..."
                required
                className="h-10 rounded-xl"
              />
            </div>

            {/* Especialidade e Modalidade */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-foreground/85 mb-1.5">
                  Especialidade Clínica *
                </label>
                <Select
                  value={specialty}
                  onChange={(e) => handleSpecialtyChange(e.target.value as any)}
                  required
                >
                  <option value="pilates">Pilates Clínico</option>
                  <option value="fisioterapia">Fisioterapia Geral / Traumato</option>
                  <option value="rpg">Reeducação Postural Global (RPG)</option>
                </Select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground/85 mb-1.5">
                  Modalidade de Atendimento *
                </label>
                <Select
                  value={modality}
                  onChange={(e) => handleModalityChange(e.target.value as "individual" | "turma")}
                  required
                >
                  <option value="individual">Individual (1 paciente por horário)</option>
                  <option value="turma">Turma em Grupo (capacidade configurável)</option>
                </Select>
              </div>
            </div>

            {modality === "turma" && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5">
                <label className="block text-xs font-semibold text-foreground/85 mb-1.5 flex items-center gap-1.5">
                  <UsersRound className="h-3.5 w-3.5 text-primary" />
                  <span>Capacidade da Turma (alunos) *</span>
                </label>
                <Input
                  type="number"
                  min={2}
                  max={100}
                  step={1}
                  value={maxCapacity}
                  onChange={(e) => setMaxCapacity(Number(e.target.value))}
                  required
                  className="h-10 rounded-xl max-w-[180px]"
                />
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  Informe o limite real desta modalidade, por exemplo 6 ou 8 alunos.
                </span>
              </div>
            )}

            {/* Duração e Preços */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-foreground/85 mb-1.5 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Duração da Sessão (minutos) *</span>
                </label>
                <Input
                  type="number"
                  min={15}
                  max={240}
                  step={5}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  required
                  className="h-10 rounded-xl"
                />
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  Padrão comum: 50 a 60 min.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground/85 mb-1.5 flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Preço da Sessão Avulsa (R$) *</span>
                </label>
                <Input
                  type="number"
                  min={0}
                  step={5}
                  value={defaultPrice}
                  onChange={(e) => setDefaultPrice(Number(e.target.value))}
                  required
                  className="h-10 rounded-xl"
                />
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  Valor base avulso de tabela (sem pacote).
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground/85 mb-1.5 flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Preço por Sessão no Pacote (R$)</span>
                </label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={packagePricePerSession}
                  onChange={(e) => setPackagePricePerSession(e.target.value ? Number(e.target.value) : "")}
                  placeholder="Opcional"
                  className="h-10 rounded-xl"
                />
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  Referência para montar pacotes. O total é definido em Pacotes.
                </span>
              </div>
            </div>

            {/* Descrição Opcional */}
            <div>
              <label className="block text-xs font-semibold text-foreground/85 mb-1.5">
                Descrição Clínica / Metodologia (Opcional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Ex: Terapia manual, exercícios posturais ou cinesioterapia aplicada..."
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs shadow-xs placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring resize-none"
              />
            </div>

            {/* Status Ativo */}
            <div className="p-3.5 rounded-xl border border-border bg-muted/20 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-foreground block">
                  Disponível para Agendamento e Venda
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Se desativado, o serviço não poderá receber novas marcações ou novos planos.
                </span>
              </div>
              <input
                type="checkbox"
                id="service-active"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="rounded border-input text-primary h-4 w-4 cursor-pointer"
              />
            </div>
          </div>

          <div className="rounded-lg border p-3 space-y-2"><label className="flex gap-2 text-sm"><input type="checkbox" checked={modality === 'individual' && isEvaluation} disabled={modality !== 'individual'} onChange={e => setIsEvaluation(e.target.checked)} />Avaliação inicial disponível no agendamento público</label><p className="text-xs text-muted-foreground">Somente serviços individuais marcados como avaliação aparecem no /agendar. Tratamentos em grupo são reservados no /portal.</p></div>
        <DialogFooter className="gap-2 pt-2 sm:space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="h-10 px-5 rounded-xl font-semibold"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-10 px-6 rounded-xl font-semibold shadow-xs"
            >
              {isSubmitting
                ? "Salvando..."
                : isEditing
                ? "Salvar Alterações"
                : "Cadastrar Serviço"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
