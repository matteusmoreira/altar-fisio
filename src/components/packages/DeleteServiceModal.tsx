import React, { useState } from "react"
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
import { AlertTriangle, ShieldAlert, PowerOff, Trash2 } from "lucide-react"

interface DeleteServiceModalProps {
  service: ClinicService | null
  onClose: () => void
  onSuccess?: (msg: string) => void
}

export const DeleteServiceModal: React.FC<DeleteServiceModalProps> = ({
  service,
  onClose,
  onSuccess,
}) => {
  const { deleteService, updateService } = useClinicData()
  const [isProcessing, setIsProcessing] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  if (!service) return null

  const hasLinkedPackages = !!(service.packageCount && service.packageCount > 0)

  const handleConfirmDelete = async () => {
    setIsProcessing(true)
    setErrorMsg(null)
    try {
      await deleteService(service.id)
      onSuccess?.(`Serviço "${service.name}" excluído com sucesso.`)
      onClose()
    } catch (err: any) {
      setErrorMsg(err?.message || "Não foi possível excluir o serviço.")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDeactivate = async () => {
    setIsProcessing(true)
    setErrorMsg(null)
    try {
      await updateService(service.id, { active: false })
      onSuccess?.(`Serviço "${service.name}" foi desativado com sucesso.`)
      onClose()
    } catch (err: any) {
      setErrorMsg(err?.message || "Não foi possível desativar o serviço.")
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Dialog open={!!service} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="h-11 w-11 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-2">
            {hasLinkedPackages ? <ShieldAlert className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
          </div>
          <DialogTitle className="text-lg font-bold">
            {hasLinkedPackages ? "Serviço com Planos Vinculados" : "Excluir Serviço Clínico"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Você selecionou o serviço <strong>{service.name}</strong>.
          </DialogDescription>
        </DialogHeader>

        {errorMsg && (
          <div className="my-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
            {errorMsg}
          </div>
        )}

        {hasLinkedPackages ? (
          <div className="space-y-3 py-2 text-xs text-foreground/80">
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200">
              <p className="font-semibold mb-1">Proteção de Integridade Clínica & Financeira</p>
              <p className="text-[11px] leading-relaxed">
                Este serviço possui <strong>{service.packageCount} plano(s) comercial(is)</strong> associado(s).
                A exclusão definitiva removeria dados essenciais de pacotes e relatórios históricos de pacientes.
              </p>
            </div>
            <p className="text-muted-foreground text-[11px]">
              <strong>Recomendação:</strong> Desative o serviço. Ele deixará de aparecer para novas vendas ou novos agendamentos, preservando o histórico de quem já possui planos contratados.
            </p>
          </div>
        ) : (
          <div className="py-2 text-xs text-muted-foreground">
            <p>
              Tem certeza que deseja excluir permanentemente o procedimento <strong>{service.name}</strong>?
              Esta ação não poderá ser desfeita.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2 pt-2 sm:space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isProcessing}
            className="h-10 px-4 rounded-xl font-semibold"
          >
            Cancelar
          </Button>

          {hasLinkedPackages ? (
            <Button
              type="button"
              onClick={handleDeactivate}
              disabled={isProcessing}
              className="h-10 px-5 rounded-xl font-semibold bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
            >
              <PowerOff className="h-4 w-4" />
              <span>{isProcessing ? "Desativando..." : "Desativar Serviço"}</span>
            </Button>
          ) : (
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isProcessing}
              className="h-10 px-5 rounded-xl font-semibold gap-1.5"
            >
              <Trash2 className="h-4 w-4" />
              <span>{isProcessing ? "Excluindo..." : "Confirmar Exclusão"}</span>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
