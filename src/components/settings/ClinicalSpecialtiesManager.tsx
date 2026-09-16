import React, { useState, useEffect } from "react"
import { useQuery, useMutation } from "@/lib/staffConvex"
import { api } from "@convex/_generated/api"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import {
  Stethoscope,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Sparkles,
} from "lucide-react"
import {
  DEFAULT_CLINICAL_SPECIALTIES,
  slugifySpecialtyId,
  type ClinicalSpecialty,
} from "../../../shared/clinicalSpecialties"

interface ClinicalSpecialtiesManagerProps {
  variant?: "card" | "embedded"
  onSaved?: () => void
  onClose?: () => void
  className?: string
}

export const ClinicalSpecialtiesManager: React.FC<ClinicalSpecialtiesManagerProps> = ({
  variant = "card",
  onSaved,
  onClose,
  className = "",
}) => {
  const { isAdmin } = useAuth()
  const canManage = isAdmin

  const specialtiesFromDb = useQuery(api.clinic.getClinicalSpecialties, {})
  const updateSpecialtiesMutation = useMutation(api.clinic.updateClinicalSpecialties)

  const [draft, setDraft] = useState<ClinicalSpecialty[]>([])
  const [newSpecialtyName, setNewSpecialtyName] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null)

  // Sincroniza draft inicial quando as especialidades chegam do banco
  useEffect(() => {
    if (specialtiesFromDb && specialtiesFromDb.length > 0) {
      setDraft(specialtiesFromDb.map((s) => ({ id: s.id, name: s.name, description: s.description })))
    } else if (specialtiesFromDb && specialtiesFromDb.length === 0) {
      setDraft([...DEFAULT_CLINICAL_SPECIALTIES])
    }
  }, [specialtiesFromDb])

  const showToast = (type: "success" | "error", message: string) => {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 4000)
  }

  const handleAddSpecialty = () => {
    const trimmed = newSpecialtyName.trim()
    if (!trimmed) {
      showToast("error", "Informe o nome da nova especialidade clínica.")
      return
    }

    const baseId = slugifySpecialtyId(trimmed)
    if (draft.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
      showToast("error", `A especialidade "${trimmed}" já está na lista.`)
      return
    }

    let finalId = baseId
    let counter = 2
    while (draft.some((s) => s.id.toLowerCase() === finalId.toLowerCase())) {
      finalId = `${baseId}_${counter}`
      counter++
    }

    setDraft((prev) => [...prev, { id: finalId, name: trimmed }])
    setNewSpecialtyName("")
    showToast("success", `Especialidade "${trimmed}" adicionada! Lembre-se de salvar.`)
  }

  const handleStartEdit = (item: ClinicalSpecialty) => {
    setEditingId(item.id)
    setEditingName(item.name)
  }

  const handleSaveEdit = (id: string) => {
    const trimmed = editingName.trim()
    if (!trimmed) {
      showToast("error", "O nome da especialidade não pode ser vazio.")
      return
    }

    setDraft((prev) =>
      prev.map((item) => (item.id === id ? { ...item, name: trimmed } : item))
    )
    setEditingId(null)
    setEditingName("")
    showToast("success", "Nome da especialidade atualizado no rascunho!")
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditingName("")
  }

  const handleRemoveSpecialty = (id: string, name: string) => {
    if (draft.length <= 1) {
      showToast("error", "A clínica deve ter pelo menos uma especialidade clínica cadastrada.")
      return
    }

    setDraft((prev) => prev.filter((item) => item.id !== id))
    showToast("success", `Especialidade "${name}" removida da lista!`)
  }

  const handleSaveAll = async () => {
    if (!canManage) {
      showToast("error", "Apenas administradores podem salvar especialidades.")
      return
    }

    if (draft.length === 0) {
      showToast("error", "Adicione pelo menos uma especialidade clínica antes de salvar.")
      return
    }

    setIsSaving(true)
    try {
      await updateSpecialtiesMutation({
        specialties: draft.map((s) => ({
          id: s.id,
          name: s.name.trim(),
          description: s.description,
        })),
      })
      showToast("success", "Especialidades clínicas salvas com sucesso!")
      onSaved?.()
    } catch (err: any) {
      showToast("error", err?.data || err?.message || "Erro ao salvar especialidades clínicas.")
    } finally {
      setIsSaving(false)
    }
  }

  const content = (
    <div className="space-y-4">
      {feedback && (
        <div
          role={feedback.type === "error" ? "alert" : "status"}
          className={`flex items-center gap-2 p-3 rounded-xl text-xs font-medium ${
            feedback.type === "error"
              ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
          }`}
        >
          {feedback.type === "error" ? (
            <AlertCircle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Formulário de Adicionar */}
      {canManage && (
        <div className="flex gap-2">
          <Input
            aria-label="Nome da nova especialidade clínica"
            placeholder="Ex.: Osteopatia, Acupuntura, Fisioterapia Pélvica..."
            value={newSpecialtyName}
            onChange={(e) => setNewSpecialtyName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                handleAddSpecialty()
              }
            }}
            className="h-9 text-xs"
          />
          <Button
            type="button"
            variant="outline"
            onClick={handleAddSpecialty}
            className="h-9 shrink-0 gap-1.5 px-3 text-xs font-semibold"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar
          </Button>
        </div>
      )}

      {/* Lista de Especialidades Cadastradas */}
      <div className="space-y-2">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Especialidades ativas ({draft.length})
        </p>

        {draft.length === 0 ? (
          <div className="p-4 text-center border border-dashed rounded-xl text-xs text-muted-foreground">
            Nenhuma especialidade clínica cadastrada.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {draft.map((item) => {
              const isEditingThis = editingId === item.id

              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-border bg-card/60 hover:border-primary/30 transition-all text-xs"
                >
                  {isEditingThis ? (
                    <div className="flex items-center gap-1.5 flex-1">
                      <Input
                        aria-label={`Editar nome da especialidade ${item.name}`}
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            handleSaveEdit(item.id)
                          } else if (e.key === "Escape") {
                            handleCancelEdit()
                          }
                        }}
                        className="h-7 text-xs flex-1"
                        autoFocus
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSaveEdit(item.id)}
                        className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                        aria-label="Confirmar edição"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={handleCancelEdit}
                        className="h-7 w-7 p-0 text-muted-foreground hover:bg-muted"
                        aria-label="Cancelar edição"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="p-1 rounded-md bg-primary/10 text-primary shrink-0">
                          <Stethoscope className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-semibold text-foreground truncate" title={item.name}>
                          {item.name}
                        </span>
                      </div>

                      {canManage && (
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleStartEdit(item)}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
                            aria-label={`Editar ${item.name}`}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemoveSpecialty(item.id, item.name)}
                            className="h-7 w-7 p-0 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                            aria-label={`Excluir ${item.name}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Ações / Botão Salvar */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
        {onClose && (
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="h-8 px-3 text-xs"
          >
            Fechar
          </Button>
        )}
        {canManage && (
          <Button
            type="button"
            onClick={handleSaveAll}
            disabled={isSaving}
            className="h-8 px-4 text-xs font-semibold gap-1.5 rounded-lg"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5" />
                Salvar Especialidades
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )

  if (variant === "embedded") {
    return (
      <div className={`p-4 rounded-2xl border border-primary/25 bg-primary/5 space-y-3 ${className}`}>
        <div className="flex items-center justify-between pb-1 border-b border-primary/15">
          <div className="flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-primary" />
            <h4 className="text-xs font-bold text-foreground">Gerenciar Especialidades Clínicas</h4>
          </div>
          <span className="text-[10px] text-muted-foreground">
            Crie, renomeie ou exclua especialidades
          </span>
        </div>
        {content}
      </div>
    )
  }

  return (
    <Card className={`border-border ${className}`}>
      <CardHeader className="p-5 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Stethoscope className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold">Especialidades Clínicas</CardTitle>
              <CardDescription className="text-xs">
                Configure as áreas de atendimento clínico disponíveis na clínica (Fisioterapia, Pilates, RPG, etc.).
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-5 pt-1">{content}</CardContent>
    </Card>
  )
}
