import { useState } from "react"
import { useMutation } from "@/lib/staffConvex"
import { api } from "@convex/_generated/api"
import type { FunctionReturnType } from "convex/server"
import { DEFAULT_INSURANCE_PARTNERS, type InsurancePartner } from "../../../shared/bookingInsurance"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"

export function InsuranceEditor({ config }: { config: FunctionReturnType<typeof api.bookingBuilder.getBookingConfig> | undefined }) {
  const update = useMutation(api.bookingBuilder.updateBookingConfig)
  const [editing, setEditing] = useState<InsurancePartner | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const partners = config?.insurancePartners ?? DEFAULT_INSURANCE_PARTNERS
  const save = async (insurancePartners: InsurancePartner[]) => {
    if (!config || busy) return
    setBusy(true)
    setMessage("")
    try {
      await update({ requireApproval: config.requireApproval, steps: config.steps, fields: config.fields,
        welcomeTitle: config.welcomeTitle, welcomeMessage: config.welcomeMessage, successMessage: config.successMessage, insurancePartners })
      setEditing(null)
      setMessage("Convênios salvos. A prévia pública será atualizada.")
    } catch (error: any) { setMessage("Erro ao salvar: " + error.message) }
    finally { setBusy(false) }
  }
  return <Card className="rounded-2xl">
    <CardHeader><CardTitle>Convênios e logos</CardTitle><CardDescription>Cadastre planos, altere o nome e a imagem ou exclua um convênio. Sem logo, o nome aparece no card.</CardDescription></CardHeader>
    <CardContent className="space-y-3">
      <Button disabled={!config || busy || partners.length >= 30} onClick={() => { setMessage(""); setEditing({ id: crypto.randomUUID(), name: "", logo: "" }) }}>Adicionar convênio</Button>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {partners.map(partner => <div key={partner.id} className="min-w-0 rounded-xl border p-3 space-y-3">
          <div className="flex items-center gap-3 min-w-0">
            {partner.logo && <img src={partner.logo} alt={partner.name} className="w-20 h-10 object-contain rounded bg-white p-1" />}
            <span className="text-xs font-semibold break-words">{partner.name}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => { setMessage(""); setEditing(partner) }}>Editar {partner.name}</Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => save(partners.filter(p => p.id !== partner.id))}>Excluir {partner.name}</Button>
          </div>
        </div>)}
      </div>
      {!partners.length && <p className="text-xs text-muted-foreground">Nenhum convênio cadastrado. O paciente poderá informar o nome em “Outro Plano”.</p>}
      <p role="status" className="text-xs">{message}</p>
      <Dialog open={!!editing} onOpenChange={open => { if (!open && !busy) setEditing(null) }}>
        <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Editar convênio e logo</DialogTitle><DialogDescription>Use uma URL HTTPS ou envie PNG, JPG ou WebP de até 150 KB.</DialogDescription></DialogHeader>
          {editing && <div className="space-y-4">
            <label className="block text-sm space-y-1">Nome do convênio<Input aria-label="Nome do convênio" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></label>
            <label className="block text-sm space-y-1">URL da logo (opcional)<Input aria-label="URL da logo" value={editing.logo?.startsWith("data:") ? "" : editing.logo ?? ""} placeholder="https://..." onChange={e => setEditing({ ...editing, logo: e.target.value })} /></label>
            <label className="block text-sm space-y-1">Enviar imagem<Input aria-label="Enviar logo" type="file" accept="image/png,image/jpeg,image/webp" onChange={async e => {
              const file = e.target.files?.[0]
              if (!file) return
              if (file.size > 150 * 1024 || !["image/png", "image/jpeg", "image/webp"].includes(file.type)) { setMessage("Use PNG, JPG ou WebP de até 150 KB."); return }
              const reader = new FileReader()
              reader.onload = () => setEditing(current => current?.id === editing.id ? { ...current, logo: String(reader.result) } : current)
              reader.onerror = () => setMessage("Não foi possível ler a imagem. Tente novamente.")
              reader.readAsDataURL(file)
            }} /></label>
            {editing.logo && <><img src={editing.logo} alt="Prévia da logo" className="h-16 w-full object-contain bg-white rounded-xl p-2" /><Button variant="outline" onClick={() => setEditing({ ...editing, logo: "" })}>Remover logo</Button></>}
            <p role="status" className="text-xs">{message}</p>
            <Button disabled={busy || !editing.name.trim()} onClick={() => {
              const partner = { ...editing, name: editing.name.trim(), logo: editing.logo?.trim() || undefined }
              save(partners.some(p => p.id === partner.id) ? partners.map(p => p.id === partner.id ? partner : p) : [...partners, partner])
            }}>{busy ? "Salvando..." : "Salvar convênio"}</Button>
          </div>}
        </DialogContent>
      </Dialog>
    </CardContent>
  </Card>
}
