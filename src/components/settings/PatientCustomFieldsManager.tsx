import React, { useState, useEffect } from "react"
import { useQuery, useMutation } from "@/lib/staffConvex"
import { api } from "@convex/_generated/api"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select-native"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import {
  ListPlus,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react"
import type { PatientCustomFieldDefinition, PatientCustomFieldType } from "@/types"

interface PatientCustomFieldsManagerProps {
  className?: string
}

export const PatientCustomFieldsManager: React.FC<PatientCustomFieldsManagerProps> = ({
  className = "",
}) => {
  const { role } = useAuth()
  const canManage = role === "admin" || role === "reception"

  const dbFields = useQuery(api.clinic.getPatientCustomFields, {})
  const updateMutation = useMutation(api.clinic.updatePatientCustomFields)

  const [draft, setDraft] = useState<PatientCustomFieldDefinition[]>([])
  const [newLabel, setNewLabel] = useState("")
  const [newType, setNewType] = useState<PatientCustomFieldType>("text")
  const [newOptions, setNewOptions] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null)

  useEffect(() => {
    if (dbFields) {
      setDraft(dbFields as PatientCustomFieldDefinition[])
    }
  }, [dbFields])

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 3500)
  }

  const handleAddField = () => {
    const label = newLabel.trim()
    if (!label) return
    if (draft.some((f) => f.label.toLowerCase() === label.toLowerCase())) {
      showToast("Já existe um campo com este nome.", "error")
      return
    }

    const options =
      newType === "select"
        ? newOptions
            .split(",")
            .map((o) => o.trim())
            .filter(Boolean)
        : undefined

    const newField: PatientCustomFieldDefinition = {
      id: `field_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      label,
      type: newType,
      options,
    }

    setDraft((prev) => [...prev, newField])
    setNewLabel("")
    setNewOptions("")
    setNewType("text")
  }

  const handleRemoveField = (fieldId: string) => {
    setDraft((prev) => prev.filter((f) => f.id !== fieldId))
  }

  const handleSave = async () => {
    if (!canManage) return
    setIsSaving(true)
    try {
      await updateMutation({ fields: draft })
      showToast("Campos livres da clínica salvos com sucesso!", "success")
    } catch (err: any) {
      showToast("Erro ao salvar: " + (err?.message || "Tente novamente"), "error")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card className={`border-border w-full max-w-full min-w-0 overflow-hidden ${className}`}>
      <CardHeader className="p-4 sm:p-5 pb-3 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
              <ListPlus className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base font-bold truncate">Campos Livres dos Pacientes</CardTitle>
              <CardDescription className="text-xs">
                Configure campos personalizados que aparecerão no cadastro de todos os pacientes.
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 pt-0 space-y-4 text-xs min-w-0">
        {feedback && (
          <div
            className={`p-3 rounded-xl flex items-center gap-2 text-xs ${
              feedback.type === "success"
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                : "bg-destructive/10 text-destructive border border-destructive/20"
            }`}
          >
            {feedback.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {canManage && (
          <div className="rounded-xl border border-border/70 bg-muted/20 p-3.5 space-y-3">
            <span className="font-semibold text-foreground block text-xs">Adicionar Novo Campo</span>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-2.5">
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Nome do campo (ex: Profissão, Instagram, Indicação)"
                className="h-9 text-xs"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newType !== "select") {
                    e.preventDefault()
                    handleAddField()
                  }
                }}
              />
              <Select
                value={newType}
                onChange={(e) => setNewType(e.target.value as PatientCustomFieldType)}
                className="h-9 text-xs"
              >
                <option value="text">Texto Curto</option>
                <option value="number">Número</option>
                <option value="date">Data</option>
                <option value="select">Lista de Seleção</option>
              </Select>
            </div>

            {newType === "select" && (
              <Input
                value={newOptions}
                onChange={(e) => setNewOptions(e.target.value)}
                placeholder="Opções separadas por vírgula (ex: Instagram, Google, Indicação de Amigo)"
                className="h-9 text-xs"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleAddField()
                  }
                }}
              />
            )}

            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddField}
                disabled={!newLabel.trim()}
                className="h-8 gap-1.5 px-3 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar Campo
              </Button>
            </div>
          </div>
        )}

        {/* Lista de Campos Configurados */}
        <div className="space-y-2">
          <span className="font-semibold text-muted-foreground block text-xs">
            Campos Ativos ({draft.length})
          </span>

          {draft.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-2">
              Nenhum campo livre configurado. Adicione acima os campos que sua clínica utiliza.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {draft.map((field) => (
                <div
                  key={field.id}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-border bg-card shadow-2xs gap-2"
                >
                  <div className="min-w-0">
                    <span className="font-semibold text-foreground text-xs block truncate">
                      {field.label}
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-muted-foreground uppercase bg-muted/60 px-1.5 py-0.5 rounded font-mono">
                        {field.type === "text"
                          ? "Texto"
                          : field.type === "number"
                          ? "Número"
                          : field.type === "date"
                          ? "Data"
                          : "Lista"}
                      </span>
                      {field.options && field.options.length > 0 && (
                        <span className="text-[10px] text-muted-foreground truncate max-w-[180px]">
                          ({field.options.join(", ")})
                        </span>
                      )}
                    </div>
                  </div>

                  {canManage && (
                    <button
                      type="button"
                      aria-label={`Remover campo ${field.label}`}
                      onClick={() => handleRemoveField(field.id)}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0 transition-colors"
                      title="Excluir campo da clínica"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {canManage && (
          <div className="flex justify-end pt-2 border-t border-border/60">
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="h-9 px-4 text-xs font-semibold gap-1.5"
            >
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              <span>Salvar Campos da Clínica</span>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
