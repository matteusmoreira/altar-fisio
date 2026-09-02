import React, { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  ShieldCheck,
  ShieldAlert,
  FileCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Camera,
  HeartPulse,
  Lock,
  UserCheck,
  ExternalLink,
} from "lucide-react"
import type { Patient, PatientConsent } from "@/types"

interface LgpdConsentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  patient?: Patient
  consents?: PatientConsent[]
  onSaveConsent: (params: {
    patientId: string
    termType: "tcle_treatment" | "lgpd_data_processing" | "postural_photo_consent"
    accepted: boolean
    signedByName: string
    documentVersion: string
    notes?: string
  }) => Promise<void>
}

export const LgpdConsentModal: React.FC<LgpdConsentModalProps> = ({
  open,
  onOpenChange,
  patient,
  consents = [],
  onSaveConsent,
}) => {
  const [signedByName, setSignedByName] = useState(patient?.name || "")
  const [isSaving, setIsSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Status de cada um dos 3 termos
  const tcleConsent = consents.find((c) => c.termType === "tcle_treatment")
  const lgpdConsent = consents.find((c) => c.termType === "lgpd_data_processing")
  const photoConsent = consents.find((c) => c.termType === "postural_photo_consent")

  const handleToggleTerm = async (
    termType: "tcle_treatment" | "lgpd_data_processing" | "postural_photo_consent",
    currentAccepted: boolean
  ) => {
    if (!patient) return
    setIsSaving(true)
    try {
      await onSaveConsent({
        patientId: patient.id,
        termType,
        accepted: !currentAccepted,
        signedByName: signedByName || patient.name,
        documentVersion: "v1.2-2026",
        notes: "Consentimento registrado eletronicamente pela interface do sistema clínico Altar Fisio.",
      })
      setSuccessMsg("Status de consentimento atualizado com sucesso!")
      setTimeout(() => setSuccessMsg(null), 3000)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSignAll = async () => {
    if (!patient) return
    setIsSaving(true)
    try {
      const signer = signedByName || patient.name
      await onSaveConsent({
        patientId: patient.id,
        termType: "tcle_treatment",
        accepted: true,
        signedByName: signer,
        documentVersion: "v1.2-2026",
      })
      await onSaveConsent({
        patientId: patient.id,
        termType: "lgpd_data_processing",
        accepted: true,
        signedByName: signer,
        documentVersion: "v1.2-2026",
      })
      await onSaveConsent({
        patientId: patient.id,
        termType: "postural_photo_consent",
        accepted: true,
        signedByName: signer,
        documentVersion: "v1.2-2026",
      })
      setSuccessMsg("Todos os termos foram assinados com sucesso!")
      setTimeout(() => setSuccessMsg(null), 3000)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                Consentimento LGPD & Termos Regulatórios
              </DialogTitle>
              <DialogDescription className="text-xs">
                Gestão de consentimentos livres e esclarecidos conforme a Lei nº 13.709/2018 e resoluções do COFFITO.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {patient && (
          <div className="p-3 bg-muted/30 border border-border rounded-xl flex items-center justify-between text-xs">
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">Paciente</span>
              <p className="font-bold text-foreground">{patient.name}</p>
              <p className="font-mono text-muted-foreground text-[11px]">CPF: {patient.documentCpf}</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">Assinante / Titular</span>
              <Input
                value={signedByName}
                onChange={(e) => setSignedByName(e.target.value)}
                placeholder="Nome do assinante"
                className="h-7 text-xs w-48 mt-0.5"
              />
            </div>
          </div>
        )}

        {successMsg && (
          <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs flex items-center gap-2 font-medium">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Lista de Termos */}
        <div className="space-y-3 py-2">
          {/* Termo 1: TCLE Tratamento */}
          <div className="p-3.5 rounded-xl border border-border bg-card space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <HeartPulse className="h-4 w-4 text-primary" />
                <span>1. TCLE — Consentimento de Tratamento Clínico e Pilates</span>
              </div>
              {tcleConsent?.accepted ? (
                <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 gap-1 text-[10px]">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>Aceito</span>
                </Badge>
              ) : (
                <Badge variant="outline" className="text-amber-600 border-amber-500/30 gap-1 text-[10px]">
                  <Clock className="h-3 w-3" />
                  <span>Pendente</span>
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              Autorização para procedimentos de cinesioterapia motora, exercícios em aparelhos de Pilates, trações manuais de RPG e recursos fisioterapêuticos.
            </p>
            {tcleConsent?.accepted && (
              <p className="text-[10px] text-muted-foreground font-mono">
                Assinado por: {tcleConsent.signedByName} em{" "}
                {new Date(tcleConsent.acceptedAt).toLocaleString("pt-BR")} ({tcleConsent.documentVersion})
              </p>
            )}
            <div className="pt-1 flex justify-end">
              <Button
                type="button"
                variant={tcleConsent?.accepted ? "outline" : "default"}
                size="sm"
                disabled={isSaving}
                onClick={() => handleToggleTerm("tcle_treatment", !!tcleConsent?.accepted)}
                className="h-7 text-xs"
              >
                {tcleConsent?.accepted ? "Revogar Termo" : "Registrar Aceite"}
              </Button>
            </div>
          </div>

          {/* Termo 2: Biofotogrametria e Fotos */}
          <div className="p-3.5 rounded-xl border border-border bg-card space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <Camera className="h-4 w-4 text-primary" />
                <span>2. Autorização de Imagem — Biofotogrametria Postural</span>
              </div>
              {photoConsent?.accepted ? (
                <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 gap-1 text-[10px]">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>Aceito</span>
                </Badge>
              ) : (
                <Badge variant="outline" className="text-amber-600 border-amber-500/30 gap-1 text-[10px]">
                  <Clock className="h-3 w-3" />
                  <span>Pendente</span>
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              Autorização para registro fotográfico nas 4 vistas padronizadas (anterior, posterior, lateral direita e esquerda) estritamente para avaliação biomecânica comparativa no prontuário.
            </p>
            {photoConsent?.accepted && (
              <p className="text-[10px] text-muted-foreground font-mono">
                Assinado por: {photoConsent.signedByName} em{" "}
                {new Date(photoConsent.acceptedAt).toLocaleString("pt-BR")} ({photoConsent.documentVersion})
              </p>
            )}
            <div className="pt-1 flex justify-end">
              <Button
                type="button"
                variant={photoConsent?.accepted ? "outline" : "default"}
                size="sm"
                disabled={isSaving}
                onClick={() => handleToggleTerm("postural_photo_consent", !!photoConsent?.accepted)}
                className="h-7 text-xs"
              >
                {photoConsent?.accepted ? "Revogar Termo" : "Registrar Aceite"}
              </Button>
            </div>
          </div>

          {/* Termo 3: LGPD Tratamento de Dados de Saúde */}
          <div className="p-3.5 rounded-xl border border-border bg-card space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <Lock className="h-4 w-4 text-primary" />
                <span>3. Termo de Privacidade & Dados de Saúde (LGPD)</span>
              </div>
              {lgpdConsent?.accepted ? (
                <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 gap-1 text-[10px]">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>Aceito</span>
                </Badge>
              ) : (
                <Badge variant="outline" className="text-amber-600 border-amber-500/30 gap-1 text-[10px]">
                  <Clock className="h-3 w-3" />
                  <span>Pendente</span>
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              Tratamento de dados pessoais e de saúde sensíveis conforme Art. 7º e 11 da LGPD, com armazenamento seguro em nuvem criptografada e acesso estrito por fisioterapeutas cadastrados.
            </p>
            {lgpdConsent?.accepted && (
              <p className="text-[10px] text-muted-foreground font-mono">
                Assinado por: {lgpdConsent.signedByName} em{" "}
                {new Date(lgpdConsent.acceptedAt).toLocaleString("pt-BR")} ({lgpdConsent.documentVersion})
              </p>
            )}
            <div className="pt-1 flex justify-end">
              <Button
                type="button"
                variant={lgpdConsent?.accepted ? "outline" : "default"}
                size="sm"
                disabled={isSaving}
                onClick={() => handleToggleTerm("lgpd_data_processing", !!lgpdConsent?.accepted)}
                className="h-7 text-xs"
              >
                {lgpdConsent?.accepted ? "Revogar Termo" : "Registrar Aceite"}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-border pt-3 flex items-center justify-between sm:justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs h-8"
          >
            Fechar
          </Button>

          <Button
            type="button"
            variant="default"
            size="sm"
            disabled={isSaving}
            onClick={handleSignAll}
            className="text-xs h-8 gap-1.5 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <UserCheck className="h-3.5 w-3.5" />
            <span>Assinar Todos os Termos</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
