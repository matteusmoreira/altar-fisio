import React, { useState } from "react"
import { useQuery, useAction, useMutation } from "convex/react"
import { api } from "@convex/_generated/api"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
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
  Smartphone,
  Plus,
  Key,
  QrCode,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Star,
  PowerOff,
  Radio,
  ExternalLink,
  Loader2,
  ShieldCheck,
  Info,
} from "lucide-react"

export const WhatsAppInstanceManager: React.FC = () => {
  const instances = useQuery(api.whatsapp.listInstances) || []
  const createInstanceAction = useAction(api.whatsapp.createInstanceAction)
  const connectExistingTokenAction = useAction(api.whatsapp.connectExistingTokenAction)
  const getQrCodeAction = useAction(api.whatsapp.getQrCodeAction)
  const syncAllAction = useAction(api.whatsapp.syncAllInstancesStatusAction)
  const disconnectAction = useAction(api.whatsapp.disconnectInstanceAction)
  const deleteAction = useAction(api.whatsapp.deleteInstanceAction)
  const setDefaultMutation = useMutation(api.whatsapp.setDefaultInstance)

  // Estados de Modais
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isConnectTokenModalOpen, setIsConnectTokenModalOpen] = useState(false)
  const [isQrModalOpen, setIsQrModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  // Formulários
  const [newInstanceName, setNewInstanceName] = useState("")
  const [tokenInput, setTokenInput] = useState("")
  const [tokenInstanceName, setTokenInstanceName] = useState("")

  // Instância selecionada para QR ou Exclusão
  const [selectedInstance, setSelectedInstance] = useState<any | null>(null)
  const [currentQrCode, setCurrentQrCode] = useState<string | null>(null)

  // Loadings
  const [isLoading, setIsLoading] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null)

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 4500)
  }

  // 1. Criar Nova Instância
  const handleCreateInstance = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newInstanceName.trim()) return

    setIsLoading(true)
    try {
      const res = await createInstanceAction({ name: newInstanceName.trim() })
      if (res.success && res.instance) {
        showToast(`Instância "${newInstanceName}" criada com sucesso!`)
        setIsCreateModalOpen(false)
        setNewInstanceName("")

        // Se gerou QR Code, abre direto
        if (res.instance.qrcode) {
          setSelectedInstance(res.instance)
          setCurrentQrCode(res.instance.qrcode)
          setIsQrModalOpen(true)
        }
      } else {
        showToast(res.error || "Erro ao criar instância na Uazapi", "error")
      }
    } catch (err: any) {
      showToast(err?.message || "Falha na comunicação com o servidor", "error")
    } finally {
      setIsLoading(false)
    }
  }

  // 2. Conectar Instância Existente por Token
  const handleConnectByToken = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tokenInput.trim()) return

    setIsLoading(true)
    try {
      const res = await connectExistingTokenAction({
        token: tokenInput.trim(),
        name: tokenInstanceName.trim() || undefined,
      })

      if (res.success && res.instance) {
        showToast(`Instância conectada com sucesso!`)
        setIsConnectTokenModalOpen(false)
        setTokenInput("")
        setTokenInstanceName("")

        if (res.instance.qrcode && res.instance.status !== "connected") {
          setSelectedInstance(res.instance)
          setCurrentQrCode(res.instance.qrcode)
          setIsQrModalOpen(true)
        }
      } else {
        showToast(res.error || "Token não encontrado ou inválido", "error")
      }
    } catch (err: any) {
      showToast(err?.message || "Falha ao validar token", "error")
    } finally {
      setIsLoading(false)
    }
  }

  // 3. Abrir e Atualizar QR Code
  const handleOpenQrCode = async (inst: any) => {
    setSelectedInstance(inst)
    setCurrentQrCode(inst.qrcode || null)
    setIsQrModalOpen(true)
    setIsLoading(true)

    try {
      const res = await getQrCodeAction({ token: inst.token })
      if (res.success && res.qrcode) {
        setCurrentQrCode(res.qrcode)
      }
    } catch (err: any) {
      // Mantém o qr code anterior caso haja
    } finally {
      setIsLoading(false)
    }
  }

  // 4. Definir Instância Padrão
  const handleSetDefault = async (instId: any) => {
    try {
      await setDefaultMutation({ instanceId: instId })
      showToast("Instância definida como padrão para envios automáticos!")
    } catch (err: any) {
      showToast("Erro ao definir como padrão", "error")
    }
  }

  // 5. Desconectar Sessão
  const handleDisconnect = async (token: string) => {
    setIsLoading(true)
    try {
      await disconnectAction({ token })
      showToast("Sessão do WhatsApp desconectada.")
    } catch (err: any) {
      showToast("Erro ao desconectar", "error")
    } finally {
      setIsLoading(false)
    }
  }

  // 6. Excluir Instância
  const handleDeleteInstance = async () => {
    if (!selectedInstance) return
    setIsLoading(true)
    try {
      await deleteAction({ token: selectedInstance.token })
      showToast(`Instância "${selectedInstance.name}" excluída com sucesso.`)
      setIsDeleteModalOpen(false)
      setSelectedInstance(null)
    } catch (err: any) {
      showToast("Erro ao excluir instância", "error")
    } finally {
      setIsLoading(false)
    }
  }

  // 7. Sincronizar Tudo
  const handleSyncAll = async () => {
    setIsSyncing(true)
    try {
      const res = await syncAllAction({})
      showToast(`${res.count} instâncias sincronizadas com a Uazapi!`)
    } catch (err: any) {
      showToast("Erro ao sincronizar status", "error")
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between border animate-in fade-in slide-in-from-top-2 ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800"
              : "bg-red-50 text-red-900 border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            )}
            <span className="text-sm font-medium">{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-xs opacity-70 hover:opacity-100">
            ✕
          </button>
        </div>
      )}

      {/* Cabeçalho com Ações Rápidas */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-5 rounded-2xl border shadow-sm">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-emerald-500" />
            Instâncias de WhatsApp (Uazapi)
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Gerencie conexões do WhatsApp da clínica, crie novas linhas ou conecte números existentes por token.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncAll}
            disabled={isSyncing}
            className="gap-1.5 h-9"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
            Atualizar Status
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsConnectTokenModalOpen(true)}
            className="gap-1.5 h-9"
          >
            <Key className="w-3.5 h-3.5 text-amber-500" />
            Conectar por Token
          </Button>

          <Button
            size="sm"
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 h-9 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Nova Instância
          </Button>
        </div>
      </div>

      {/* Grid de Instâncias */}
      {instances.length === 0 ? (
        <Card className="border-dashed py-12 text-center">
          <CardContent className="space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center mx-auto text-emerald-600">
              <Radio className="w-7 h-7" />
            </div>
            <div className="max-w-md mx-auto">
              <h4 className="font-semibold text-base">Nenhuma instância cadastrada</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Conecte o WhatsApp da sua clínica criando uma nova instância com QR Code ou inserindo um token de uma instância já existente.
              </p>
            </div>
            <div className="flex justify-center gap-3 pt-2">
              <Button onClick={() => setIsCreateModalOpen(true)} className="bg-emerald-600 text-white gap-2">
                <Plus className="w-4 h-4" /> Criar Primeira Instância
              </Button>
              <Button variant="outline" onClick={() => setIsConnectTokenModalOpen(true)} className="gap-2">
                <Key className="w-4 h-4 text-amber-500" /> Conectar por Token
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {instances.map((inst) => {
            const isConnected = inst.status === "connected"
            const isConnecting = inst.status === "connecting"

            return (
              <Card
                key={inst._id}
                className={`relative transition-all overflow-hidden border ${
                  inst.isDefault
                    ? "border-emerald-500/50 shadow-md ring-1 ring-emerald-500/20"
                    : "hover:border-border/80"
                }`}
              >
                {inst.isDefault && (
                  <div className="absolute top-0 right-0 bg-emerald-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-bl-lg shadow-sm flex items-center gap-1">
                    <Star className="w-2.5 h-2.5 fill-current" /> PADRÃO
                  </div>
                )}

                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    {inst.profilePicUrl ? (
                      <img
                        src={inst.profilePicUrl}
                        alt={inst.name}
                        className="w-12 h-12 rounded-full object-cover border-2 border-emerald-500/30"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center font-bold text-base text-muted-foreground border">
                        {inst.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base truncate font-semibold">{inst.name}</CardTitle>
                      </div>
                      <CardDescription className="truncate text-xs">
                        {inst.profileName || inst.ownerNumber || "WhatsApp Altar Fisio"}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 text-xs">
                  {/* Status & Detalhes */}
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50 border">
                    <span className="text-muted-foreground">Status da Conexão:</span>
                    <Badge
                      variant="outline"
                      className={`gap-1 font-medium ${
                        isConnected
                          ? "border-emerald-500 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30"
                          : isConnecting
                          ? "border-amber-500 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30"
                          : "border-zinc-400 text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isConnected ? "bg-emerald-500 animate-pulse" : isConnecting ? "bg-amber-500" : "bg-zinc-400"
                        }`}
                      />
                      {isConnected ? "Conectado" : isConnecting ? "Aguardando QR" : "Desconectado"}
                    </Badge>
                  </div>

                  {/* Número vinculado */}
                  {inst.ownerNumber && (
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Número:</span>
                      <span className="font-mono font-medium text-foreground">
                        +{inst.ownerNumber}
                      </span>
                    </div>
                  )}

                  {/* Token (mascarado) */}
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Token:</span>
                    <span className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded text-foreground truncate max-w-[170px]">
                      {inst.token.slice(0, 8)}...{inst.token.slice(-6)}
                    </span>
                  </div>

                  {/* Ações da Instância */}
                  <div className="pt-2 border-t flex flex-wrap items-center justify-between gap-1.5">
                    {!isConnected && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenQrCode(inst)}
                        className="h-8 text-xs gap-1 border-amber-500/50 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                      >
                        <QrCode className="w-3.5 h-3.5" /> Ler QR Code
                      </Button>
                    )}

                    {isConnected && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDisconnect(inst.token)}
                        className="h-8 text-xs gap-1 text-muted-foreground hover:text-red-500"
                      >
                        <PowerOff className="w-3.5 h-3.5" /> Desconectar
                      </Button>
                    )}

                    {!inst.isDefault && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSetDefault(inst._id)}
                        className="h-8 text-xs gap-1 text-muted-foreground hover:text-emerald-600"
                      >
                        <Star className="w-3.5 h-3.5" /> Tornar Padrão
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSelectedInstance(inst)
                        setIsDeleteModalOpen(true)
                      }}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600 ml-auto"
                      title="Excluir Instância"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* MODAL 1: CRIAR NOVA INSTÂNCIA */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-emerald-600" />
              Criar Nova Instância WhatsApp
            </DialogTitle>
            <DialogDescription>
              Crie uma nova sessão WhatsApp diretamente no servidor Uazapi. Você poderá conectar o número escaneando o QR Code logo em seguida.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateInstance} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Nome da Instância</label>
              <Input
                placeholder="Ex: Recepção Altar Fisio, Dr. Marcelo"
                value={newInstanceName}
                onChange={(e) => setNewInstanceName(e.target.value)}
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Um nome para identificar facilmente esta linha de WhatsApp na clínica.
              </p>
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading} className="bg-emerald-600 text-white gap-2">
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Criar e Gerar QR Code
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: CONECTAR POR TOKEN EXISTENTE */}
      <Dialog open={isConnectTokenModalOpen} onOpenChange={setIsConnectTokenModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-amber-500" />
              Conectar Instância Existente por Token
            </DialogTitle>
            <DialogDescription>
              Se você já possui uma instância criada no painel Uazapi, informe o token para importá-la para o sistema.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConnectByToken} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Token da Instância (Obrigatório)</label>
              <Input
                placeholder="Ex: 283f70c2-5b39-4718-87ca-f5955632e32c"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                required
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Nome de Exibição (Opcional)</label>
              <Input
                placeholder="Ex: WhatsApp Comercial"
                value={tokenInstanceName}
                onChange={(e) => setTokenInstanceName(e.target.value)}
              />
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setIsConnectTokenModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading} className="bg-emerald-600 text-white gap-2">
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Validar e Conectar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: EXIBIÇÃO DE QR CODE */}
      <Dialog open={isQrModalOpen} onOpenChange={setIsQrModalOpen}>
        <DialogContent className="sm:max-w-md text-center">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-center gap-2">
              <QrCode className="w-5 h-5 text-emerald-600" />
              Pareamento do WhatsApp
            </DialogTitle>
            <DialogDescription>
              Abra o WhatsApp no seu celular, vá em <b>Aparelhos Conectados &gt; Conectar um Aparelho</b> e aponte a câmera para o QR Code abaixo.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 flex flex-col items-center justify-center space-y-4">
            {isLoading ? (
              <div className="w-64 h-64 border rounded-2xl flex flex-col items-center justify-center gap-3 bg-muted/40">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                <p className="text-xs text-muted-foreground">Carregando QR Code oficial...</p>
              </div>
            ) : currentQrCode ? (
              <div className="p-4 bg-white rounded-2xl shadow-inner border inline-block">
                <img
                  src={currentQrCode.startsWith("data:") ? currentQrCode : `data:image/png;base64,${currentQrCode}`}
                  alt="QR Code WhatsApp"
                  className="w-56 h-56 object-contain"
                />
              </div>
            ) : (
              <div className="w-64 h-64 border rounded-2xl flex flex-col items-center justify-center gap-3 bg-muted/40 p-4 text-center">
                <AlertCircle className="w-8 h-8 text-amber-500" />
                <p className="text-xs text-muted-foreground">
                  QR Code indisponível ou a instância já pode estar conectada.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => selectedInstance && handleOpenQrCode(selectedInstance)}
                  className="text-xs gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Tentar Novamente
                </Button>
              </div>
            )}

            <div className="text-xs text-muted-foreground max-w-xs text-center flex items-center gap-1.5 justify-center">
              <Info className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              O QR Code é atualizado automaticamente a cada 20 segundos pela Uazapi.
            </div>
          </div>

          <DialogFooter className="sm:justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => selectedInstance && handleOpenQrCode(selectedInstance)}
              disabled={isLoading}
              className="gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              Atualizar QR
            </Button>
            <Button size="sm" onClick={() => setIsQrModalOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 4: CONFIRMAR EXCLUSÃO DE INSTÂNCIA */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              Excluir Instância
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir a instância <b>{selectedInstance?.name}</b>?
              <br />
              Isso desconectará a linha do WhatsApp e removerá as configurações associadas.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)} disabled={isLoading}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteInstance}
              disabled={isLoading}
              className="gap-2"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirmar Exclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
