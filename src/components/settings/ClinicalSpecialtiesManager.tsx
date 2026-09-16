import React, { useState, useEffect } from "react"
import { useQuery, useMutation } from "@/lib/staffConvex"
import { api } from "@convex/_generated/api"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
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
  variant?: "card" | "dialog" | "embedded"
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
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null)

  const isLoading = specialtiesFromDb === undefined

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

  // Persistência imediata com fallback para rascunho
  const persistChanges = async (newSpecialties: ClinicalSpecialty[], successMessage: string) => {
    if (!canManage) {
      showToast("error", "Apenas administradores podem gerenciar especialidades.")
      return false
    }

    setIsSaving(true)
    try {
      await updateSpecialtiesMutation({
        specialties: newSpecialties.map((s) => ({
          id: s.id,
          name: s.name.trim(),
          description: s.description,
        })),
      })
      setDraft(newSpecialties)
      showToast("success", successMessage)
      onSaved?.()
      return true
    } catch (err: any) {
      const errorMsg = err?.data || err?.message || "Erro ao salvar especialidades clínicas."
      showToast("error", errorMsg)
      return false
    } finally {
      setIsSaving(false)
      setActionInProgressId(null)
    }
  }

  const handleAddSpecialty = async () => {
    const trimmed = newSpecialtyName.trim()
    if (!trimmed) {
      showToast("error", "Informe o nome da nova especialidade clínica.")
      return
    }

    const baseId = slugifySpecialtyId(trimmed)
    if (draft.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
      showToast("error", `A especialidade "${trimmed}" já está cadastrada.`)
      return
    }

    let finalId = baseId
    let counter = 2
    while (draft.some((s) => s.id.toLowerCase() === finalId.toLowerCase())) {
      finalId = `${baseId}_${counter}`
      counter++
    }

    const updated = [...draft, { id: finalId, name: trimmed }]
    setDraft(updated)
    setNewSpecialtyName("")
    setActionInProgressId("new")
    persistChanges(updated, `Especialidade "${trimmed}" adicionada com sucesso!`)
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

    if (draft.some((s) => s.id !== id && s.name.toLowerCase() === trimmed.toLowerCase())) {
      showToast("error", `Já existe outra especialidade com o nome "${trimmed}".`)
      return
    }

    const updated = draft.map((item) => (item.id === id ? { ...item, name: trimmed } : item))
    setDraft(updated)
    setEditingId(null)
    setEditingName("")
    setActionInProgressId(id)
    persistChanges(updated, `Especialidade atualizada para "${trimmed}"!`)
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditingName("")
  }

  const handleRemoveSpecialty = (id: string, name: string) => {
    if (draft.length <= 1) {
      showToast("error", "A clínica deve possuir pelo menos uma especialidade clínica cadastrada.")
      return
    }

    const updated = draft.filter((item) => item.id !== id)
    setDraft(updated)
    setActionInProgressId(id)
    persistChanges(updated, `Especialidade "${name}" excluída com sucesso!`)
  }

  const handleSaveAll = async () => {
    if (draft.length === 0) {
      showToast("error", "Adicione pelo menos uma especialidade clínica antes de salvar.")
      return
    }
    await persistChanges(draft, "Especialidades clínicas salvas com sucesso!")
  }

  const content = (
    <div className="space-y-4">
      {feedback && (
        <div
          role={feedback.type === "error" ? "alert" : "status"}
          className={`flex items-center gap-2 p-3 rounded-xl text-xs font-medium animate-fade-in ${
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

      {/* Formulário de Adicionar Nova Especialidade */}
      {canManage && (
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            aria-label="Nome da nova especialidade clínica"
            placeholder="Ex.: Osteopatia, Acupuntura, Fisioterapia Pélvica..."
            value={newSpecialtyName}
            onChange={(e) => setNewSpecialtyName(e.target.value)}
            disabled={isLoading || isSaving}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                handleAddSpecialty()
              }
            }}
            className="h-10 text-xs sm:text-sm flex-1"
          />
          <Button
            type="button"
            onClick={handleAddSpecialty}
            disabled={isLoading || isSaving || !newSpecialtyName.trim()}
            className="h-10 shrink-0 gap-1.5 px-4 text-xs font-semibold shadow-xs"
          >
            {isSaving && actionInProgressId === "new" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            Adicionar
          </Button>
        </div>
      )}

      {/* Lista de Especialidades Cadastradas */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Especialidades ativas ({draft.length})
          </p>
          {isSaving && (
            <span className="flex items-center gap-1 text-[11px] text-primary font-medium">
              <Loader2 className="h-3 w-3 animate-spin" />
              Sincronizando com o banco...
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-8 rounded-xl border border-dashed text-muted-foreground text-xs gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span>Carregando especialidades da clínica...</span>
          </div>
        ) : draft.length === 0 ? (
          <div className="p-6 text-center border border-dashed rounded-xl text-xs text-muted-foreground">
            Nenhuma especialidade clínica cadastrada.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {draft.map((item) => {
              const isEditingThis = editingId === item.id
              const isItemBusy = isSaving && actionInProgressId === item.id

              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 p-3 rounded-xl border border-border bg-card/70 hover:border-primary/40 transition-all text-xs shadow-2xs"
                >
                  {isEditingThis ? (
                    <div className="flex items-center gap-1.5 flex-1">
                      <Input
                        aria-label={`Editar nome da especialidade ${item.name}`}
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        disabled={isSaving}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            handleSaveEdit(item.id)
                          } else if (e.key === "Escape") {
                            handleCancelEdit()
                          }
                        }}
                        className="h-8 text-xs flex-1"
                        autoFocus
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSaveEdit(item.id)}
                        disabled={isSaving}
                        className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 shrink-0"
                        aria-label="Confirmar edição"
                      >
                        {isItemBusy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={handleCancelEdit}
                        disabled={isSaving}
                        className="h-8 w-8 p-0 text-muted-foreground hover:bg-muted shrink-0"
                        aria-label="Cancelar edição"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="p-1.5 rounded-lg bg-primary/10 text-primary shrink-0">
                          <Stethoscope className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="font-semibold text-foreground truncate block" title={item.name}>
                            {item.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            ID: {item.id}
                          </span>
                        </div>
                      </div>

                      {canManage && (
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleStartEdit(item)}
                            disabled={isSaving}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
                            aria-label={`Editar ${item.name}`}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemoveSpecialty(item.id, item.name)}
                            disabled={isSaving || draft.length <= 1}
                            className="h-8 w-8 p-0 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 disabled:opacity-30"
                            aria-label={`Excluir ${item.name}`}
                          >
                            {isItemBusy ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
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

      {/* Ações / Botão Salvar Geral */}
      <div className="flex items-center justify-between gap-2 pt-3 border-t border-border/60">
        <p className="text-[11px] text-muted-foreground">
          {canManage ? "As alterações salvam automaticamente no banco." : "Modo somente leitura."}
        </p>

        <div className="flex items-center gap-2">
          {onClose && (
            <Button
              type="button"
              variant="outline"
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
              disabled={isSaving || isLoading}
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
    </div>
  )

  if (variant === "dialog" || variant === "embedded") {
    return <div className={`p-1 space-y-4 ${className}`}>{content}</div>
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

/**
 * Diálogo modal dedicado e espaçoso para gerenciamento de especialidades clínicas.
 * Evita sobreposições e quebras de layout em formulários complexos.
 */
export const ClinicalSpecialtiesDialog: React.FC<{
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
}> = ({ open, onOpenChange, onSaved }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader className="space-y-1">
          <DialogTitle className="flex items-center gap-2.5 text-xl font-bold text-foreground">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Stethoscope className="h-5 w-5" />
            </div>
            <span>Gerenciar Especialidades Clínicas</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Adicione, edite nomes ou exclua especialidades clínicas de atendimento. As alterações são sincronizadas em tempo real.
          </DialogDescription>
        </DialogHeader>
        <div className="pt-2">
          <ClinicalSpecialtiesManager
            variant="dialog"
            onClose={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
