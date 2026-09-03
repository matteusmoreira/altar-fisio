import React, { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, CheckCircle2, UserX, FileText, Ban } from "lucide-react"

interface AbsenceModalProps {
  isOpen: boolean
  onClose: () => void
  studentName: string
  studentPhone?: string
  classNameTitle: string
  initialNotes?: string
  initialDebitPackage?: boolean
  onConfirm: (notes: string, debitPackage: boolean) => Promise<void>
}

const QUICK_REASONS = [
  "Não compareceu sem aviso",
  "Avisou em cima da hora",
  "Problema de saúde / consulta",
  "Imprevisto no trabalho / trânsito",
  "Viagem / compromisso pessoal",
]

export const AbsenceModal: React.FC<AbsenceModalProps> = ({
  isOpen,
  onClose,
  studentName,
  studentPhone,
  classNameTitle,
  initialNotes = "",
  initialDebitPackage = true,
  onConfirm,
}) => {
  const [debitPackage, setDebitPackage] = useState<boolean>(initialDebitPackage)
  const [notes, setNotes] = useState<string>(initialNotes)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Resetar campos ao abrir com novos dados
  React.useEffect(() => {
    if (isOpen) {
      setNotes(initialNotes || "")
      setDebitPackage(initialDebitPackage)
    }
  }, [isOpen, initialNotes, initialDebitPackage])

  const handleConfirm = async () => {
    setIsSubmitting(true)
    try {
      await onConfirm(notes.trim(), debitPackage)
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="pr-10">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
              <UserX className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">Registrar Falta de Aluno</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Controle presencial e débito no plano do paciente
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Card Resumo do Aluno e Turma */}
          <div className="p-3 bg-muted/30 border border-border/80 rounded-xl space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">{studentName}</span>
              <Badge variant="destructive" className="text-[10px] py-0 px-2">
                Falta
              </Badge>
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{classNameTitle}</span>
              {studentPhone && <span>{studentPhone}</span>}
            </div>
          </div>

          {/* Opção de Débito no Plano vs Abono */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground block">
              Como deseja lançar esta falta no plano/mensalidade?
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDebitPackage(true)}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  debitPackage
                    ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary shadow-xs"
                    : "border-border/80 hover:bg-muted/30 text-muted-foreground"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold flex items-center gap-1.5 text-foreground">
                    <CheckCircle2 className={`h-3.5 w-3.5 ${debitPackage ? "text-primary" : "text-muted-foreground"}`} />
                    Debitar do Plano
                  </span>
                  <Badge variant="outline" className="text-[9px] py-0 px-1 font-semibold">
                    Padrão
                  </Badge>
                </div>
                <p className="text-[11px] leading-tight text-muted-foreground">
                  Consome 1 aula contratada do pacote do aluno (falta não justificada).
                </p>
              </button>

              <button
                type="button"
                onClick={() => setDebitPackage(false)}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  !debitPackage
                    ? "border-amber-500 bg-amber-500/10 text-foreground ring-1 ring-amber-500 shadow-xs"
                    : "border-border/80 hover:bg-muted/30 text-muted-foreground"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold flex items-center gap-1.5 text-foreground">
                    <Ban className={`h-3.5 w-3.5 ${!debitPackage ? "text-amber-500" : "text-muted-foreground"}`} />
                    Abonar Falta
                  </span>
                  <Badge variant="warning" className="text-[9px] py-0 px-1 font-semibold">
                    Abono
                  </Badge>
                </div>
                <p className="text-[11px] leading-tight text-muted-foreground">
                  Registra a ausência mas não desconta dos créditos/sessões do aluno.
                </p>
              </button>
            </div>
          </div>

          {/* Motivo / Justificativa da Falta */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3 text-muted-foreground" />
                Motivo ou Observação da Ausência
              </span>
              <span className="text-[10px] text-muted-foreground font-normal">(Opcional)</span>
            </label>

            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Avisou por mensagem que teve imprevisto no trabalho..."
              className="w-full text-xs p-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary resize-none placeholder:text-muted-foreground/60"
            />

            {/* Chips de motivos rápidos */}
            <div className="flex flex-wrap gap-1 pt-1">
              {QUICK_REASONS.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setNotes(reason)}
                  className="text-[10px] px-2 py-0.5 rounded-lg border border-border/80 bg-muted/20 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  {reason}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/60">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="gap-1.5"
          >
            <UserX className="h-3.5 w-3.5" />
            {isSubmitting ? "Salvando..." : "Confirmar Falta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
