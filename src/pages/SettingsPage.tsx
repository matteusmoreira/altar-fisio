import React, { useState, useEffect } from "react"
import { useTheme, PRESET_COLORS, type ColorPreset } from "@/contexts/ThemeContext"
import { useClinicData } from "@/contexts/ClinicDataContext"
import { AuditTrailViewer } from "@/components/clinical/AuditTrailViewer"
import { useQuery, useMutation } from "convex/react"
import { api } from "@convex/_generated/api"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Settings,
  Building,
  Palette,
  Clock,
  Key,
  CheckCircle2,
  Moon,
  Sun,
  Send,
  Mail,
  Smartphone,
  ShieldCheck,
  AlertCircle,
  Loader2,
  CalendarCheck,
  Upload,
  Image as ImageIcon,
  Trash2,
  HeartPulse,
  Link as LinkIcon,
} from "lucide-react"

export const SettingsPage: React.FC = () => {
  const { theme, setPreset, setMode, updateClinicInfo } = useTheme()
  const { testUazapiConnection, testResendConnection, auditLogs } = useClinicData()


  const convexSettings = useQuery(api.clinic.getSettings)
  const updateSettingsMutation = useMutation(api.clinic.updateSettings)
  const generateUploadUrlMutation = useMutation(api.clinic.generateUploadUrl)
  const removeLogoMutation = useMutation(api.clinic.removeLogo)

  const [clinicName, setClinicName] = useState(theme.clinicName)
  const [clinicSubtitle, setClinicSubtitle] = useState(theme.clinicSubtitle)
  const [phone, setPhone] = useState("(11) 98765-4321")
  const [address, setAddress] = useState("Av. Paulista, 1000 - Bela Vista, São Paulo - SP")

  // Logotipo da Clínica
  const [logoUrl, setLogoUrl] = useState<string | undefined>(theme.logoUrl)
  const [logoStorageId, setLogoStorageId] = useState<string | undefined>(undefined)
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [isDraggingLogo, setIsDraggingLogo] = useState(false)
  const [showCustomUrlInput, setShowCustomUrlInput] = useState(false)
  const [customUrlValue, setCustomUrlValue] = useState("")
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Regras de negócio
  const [noticeHours, setNoticeHours] = useState(2)
  const [expiryDays, setExpiryDays] = useState(30)

  // Chaves de API & Endpoints
  const [uazapiEndpoint, setUazapiEndpoint] = useState("https://whatpress.uazapi.com")
  const [uazapiToken, setUazapiToken] = useState("")
  const [uazapiInstanceId, setUazapiInstanceId] = useState("altar_fisio_live")
  const [resendApiKey, setResendApiKey] = useState("")
  const [resendFromEmail, setResendFromEmail] = useState("contato@altarfisio.com.br")

  const [feedback, setFeedback] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isTestingWhatsApp, setIsTestingWhatsApp] = useState(false)
  const [isTestingResend, setIsTestingResend] = useState(false)

  // Sincroniza dados do Convex com os formulários quando carregado
  useEffect(() => {
    if (convexSettings) {
      if (convexSettings.clinicName) setClinicName(convexSettings.clinicName)
      if (convexSettings.clinicSubtitle) setClinicSubtitle(convexSettings.clinicSubtitle)
      if (convexSettings.logoUrl !== undefined) setLogoUrl(convexSettings.logoUrl)
      if (convexSettings.logoStorageId !== undefined) setLogoStorageId(convexSettings.logoStorageId)
      if (convexSettings.phone) setPhone(convexSettings.phone)
      if (convexSettings.address) setAddress(convexSettings.address)
      if (convexSettings.cancellationNoticeHours !== undefined)
        setNoticeHours(convexSettings.cancellationNoticeHours)
      if (convexSettings.replacementExpiryDays !== undefined)
        setExpiryDays(convexSettings.replacementExpiryDays)
      if (convexSettings.uazapiEndpoint) setUazapiEndpoint(convexSettings.uazapiEndpoint)
      if (convexSettings.uazapiToken) setUazapiToken(convexSettings.uazapiToken)
      if (convexSettings.uazapiInstanceId) setUazapiInstanceId(convexSettings.uazapiInstanceId)
      if (convexSettings.resendApiKey) setResendApiKey(convexSettings.resendApiKey)
      if (convexSettings.resendFromEmail) setResendFromEmail(convexSettings.resendFromEmail)
    }
  }, [convexSettings])

  const showToast = (msg: string) => {
    setFeedback(msg)
    setTimeout(() => setFeedback(null), 3500)
  }

  const handleLogoFileUpload = async (file: File) => {
    if (!file) return

    const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"]
    if (!validTypes.includes(file.type)) {
      showToast("Formato inválido! Envie uma imagem PNG, JPG, SVG ou WebP.")
      return
    }

    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      showToast("Arquivo muito grande! O limite máximo para a logo é 5 MB.")
      return
    }

    setIsUploadingLogo(true)
    const localPreviewUrl = URL.createObjectURL(file)
    setLogoUrl(localPreviewUrl)

    try {
      // 1. Obter URL segura para upload do Convex Storage
      const postUrl = await generateUploadUrlMutation()

      // 2. Fazer upload do binário da imagem
      const response = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      })

      if (!response.ok) {
        throw new Error(`Falha no upload HTTP: status ${response.status}`)
      }

      const data = await response.json()
      if (data && data.storageId) {
        setLogoStorageId(data.storageId)
        showToast("Logotipo carregado com sucesso! Clique em 'Salvar Todas as Configurações' para consolidar.")
      }
    } catch (err: any) {
      console.error("Erro no upload da logo:", err)
      showToast("Erro ao fazer upload da logo: " + (err?.message || "Tente novamente."))
    } finally {
      setIsUploadingLogo(false)
    }
  }

  const handleRemoveLogo = async () => {
    if (confirm("Deseja realmente remover o logotipo da clínica e restaurar o ícone padrão?")) {
      setIsUploadingLogo(true)
      try {
        await removeLogoMutation()
        setLogoUrl(undefined)
        setLogoStorageId(undefined)
        updateClinicInfo(clinicName, clinicSubtitle, undefined)
        showToast("Logotipo removido com sucesso!")
      } catch (err: any) {
        showToast("Erro ao remover logo: " + (err?.message || "Tente novamente"))
      } finally {
        setIsUploadingLogo(false)
      }
    }
  }

  const handleApplyCustomUrl = (e: React.FormEvent) => {
    e.preventDefault()
    if (!customUrlValue.trim()) {
      showToast("Insira uma URL válida para a imagem.")
      return
    }
    setLogoUrl(customUrlValue.trim())
    setLogoStorageId(undefined) // Limpa storageId para priorizar a URL direta
    setShowCustomUrlInput(false)
    showToast("URL do logotipo aplicada! Clique em 'Salvar Todas as Configurações' para consolidar.")
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    updateClinicInfo(clinicName, clinicSubtitle, logoUrl)

    try {
      await updateSettingsMutation({
        clinicName,
        clinicSubtitle,
        logoUrl,
        logoStorageId,
        primaryColor:
          theme.customHex ||
          (theme.preset !== "custom" && PRESET_COLORS[theme.preset as keyof typeof PRESET_COLORS]
            ? PRESET_COLORS[theme.preset as keyof typeof PRESET_COLORS].hex
            : "#10b981"),
        colorPreset: theme.preset,
        mode: theme.mode,
        phone,
        address,
        cancellationNoticeHours: noticeHours,
        replacementExpiryDays: expiryDays,
        uazapiEndpoint: uazapiEndpoint.trim().includes("api.uazapi.com")
          ? "https://whatpress.uazapi.com"
          : (uazapiEndpoint.trim().replace(/\/+$/, "").replace(/\/(v1|api)$/i, "") || "https://whatpress.uazapi.com"),
        uazapiToken,
        uazapiInstanceId,
        resendApiKey,
        resendFromEmail,
      })
      showToast("Configurações e logotipo salvos no Convex com sucesso!")
    } catch (err: any) {
      showToast("Erro ao sincronizar com o backend: " + (err?.message || "Tente novamente"))
    } finally {
      setIsSaving(false)
    }
  }

  const handleTestWhatsApp = async () => {
    setIsTestingWhatsApp(true)
    const res = await testUazapiConnection(phone, "Dr. Marcelo")
    setIsTestingWhatsApp(false)
    if (res.success) {
      showToast("Teste de WhatsApp executado com sucesso! Log registrado no histórico.")
    } else {
      showToast("Aviso no teste WhatsApp: " + (res.errorMessage || "Verifique as credenciais"))
    }
  }

  const handleTestResend = async () => {
    setIsTestingResend(true)
    const res = await testResendConnection(resendFromEmail, "Dr. Marcelo")
    setIsTestingResend(false)
    if (res.success) {
      showToast("Teste de E-mail executado com sucesso! Verifique a caixa de entrada.")
    } else {
      showToast("Aviso no teste Resend: " + (res.errorMessage || "Verifique a API Key"))
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6 animate-fade-in">
      {feedback && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm font-medium animate-fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
          <Settings className="h-6 w-6 text-primary" />
          <span>Configurações da Clínica</span>
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Identidade visual, regras de agendamento/reposições e credenciais das integrações omnicanal.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Card 1: Identidade Visual e Cores */}
        <Card className="border-border">
          <CardHeader className="p-5 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Palette className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold">Personalização do Dashboard & Cores</CardTitle>
                  <CardDescription className="text-xs">
                    Escolha a cor primária que define os botões, menus e gráficos da clínica.
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-5 pt-0 space-y-4 text-xs">
            {/* Paletas */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
              {(Object.keys(PRESET_COLORS) as Array<Exclude<ColorPreset, "custom">>).map((key) => {
                const preset = PRESET_COLORS[key]
                const isSelected = theme.preset === key

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPreset(key)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all ${
                      isSelected
                        ? "border-primary bg-primary/10 ring-2 ring-primary/30 shadow-sm"
                        : "border-border hover:bg-muted/60"
                    }`}
                  >
                    <div
                      className="h-6 w-6 rounded-full shadow-inner"
                      style={{ backgroundColor: preset.hex }}
                    />
                    <span className="truncate w-full text-center text-[11px]">
                      {preset.name}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Alternador de Modo Claro / Escuro */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/20">
              <div>
                <span className="font-semibold text-foreground text-xs block">Aparência Visual</span>
                <span className="text-[11px] text-muted-foreground">Alternar entre tema Claro e Escuro</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={theme.mode === "light" ? "default" : "outline"}
                  onClick={() => setMode("light")}
                  className="h-8 text-xs gap-1.5"
                >
                  <Sun className="h-3.5 w-3.5 text-amber-500" />
                  <span>Claro</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={theme.mode === "dark" ? "default" : "outline"}
                  onClick={() => setMode("dark")}
                  className="h-8 text-xs gap-1.5"
                >
                  <Moon className="h-3.5 w-3.5 text-sky-400" />
                  <span>Escuro</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Dados da Clínica */}
        <Card className="border-border">
          <CardHeader className="p-5 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Building className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold">Informações da Clínica</CardTitle>
                <CardDescription className="text-xs">
                  Dados exibidos no cabeçalho, portal do aluno, mensagens e recibos emitidos.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-5 pt-0 space-y-4 text-xs">
            {/* Seção 1: Logotipo da Clínica */}
            <div className="p-4 rounded-2xl border border-border bg-muted/20 space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-foreground text-xs flex items-center gap-1.5">
                    <ImageIcon className="h-4 w-4 text-primary" />
                    <span>Logotipo da Clínica & Identidade Visual</span>
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Exibido no menu lateral, login, portal do aluno, agendamentos online e documentos timbrados.
                  </span>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCustomUrlInput(!showCustomUrlInput)}
                    className="h-7 text-[11px] text-muted-foreground hover:text-foreground gap-1 px-2"
                  >
                    <LinkIcon className="h-3 w-3" />
                    <span>{showCustomUrlInput ? "Ocultar URL" : "Inserir via URL"}</span>
                  </Button>

                  {logoUrl && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRemoveLogo}
                      disabled={isUploadingLogo}
                      className="h-7 text-[11px] text-rose-600 border-rose-500/30 hover:bg-rose-50 dark:hover:bg-rose-950/30 gap-1 px-2"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Remover Logo</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* Inserção por URL Externa (Expansível) */}
              {showCustomUrlInput && (
                <div className="p-3 rounded-xl border border-border bg-card space-y-2 animate-fade-in">
                  <span className="text-[11px] font-semibold text-foreground block">
                    Link Direto da Imagem (Externa / CDN)
                  </span>
                  <div className="flex gap-2">
                    <Input
                      value={customUrlValue}
                      onChange={(e) => setCustomUrlValue(e.target.value)}
                      placeholder="https://sua-clinica.com.br/logo.png"
                      className="h-8 text-xs font-mono"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleApplyCustomUrl}
                      className="h-8 text-xs px-3 shrink-0"
                    >
                      Aplicar
                    </Button>
                  </div>
                </div>
              )}

              {/* Grid: Preview & Upload Drag-and-Drop */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-stretch pt-0.5">
                {/* Visualizador de Previews */}
                <div className="md:col-span-5 flex items-center gap-3.5 p-3.5 rounded-xl border border-border/80 bg-card shadow-xs">
                  {/* Preview Principal */}
                  <div className="relative h-16 w-16 rounded-xl border-2 border-dashed border-primary/20 flex items-center justify-center bg-muted/60 overflow-hidden shrink-0 shadow-inner">
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt="Preview Logo"
                        className="h-full w-full object-contain p-1.5"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-primary/60">
                        <HeartPulse className="h-7 w-7" />
                      </div>
                    )}
                    {isUploadingLogo && (
                      <div className="absolute inset-0 bg-background/85 flex items-center justify-center">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col min-w-0 justify-center">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-foreground truncate">
                        {logoUrl ? "Logotipo Ativo" : "Ícone Padrão Altar"}
                      </span>
                      {logoUrl && (
                        <Badge variant="success" className="text-[9px] py-0 px-1.5">
                          Personalizado
                        </Badge>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {logoUrl ? "Conectado ao sistema" : "Ícone padrão da plataforma"}
                    </span>

                    {/* Preview Contextual da Sidebar */}
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-[10px] font-semibold text-muted-foreground">Na Sidebar:</span>
                      <div className="h-6 w-6 rounded-lg bg-primary/15 text-primary flex items-center justify-center border border-primary/20 overflow-hidden shadow-xs">
                        {logoUrl ? (
                          <img src={logoUrl} alt="Mini" className="h-full w-full object-contain p-0.5" />
                        ) : (
                          <HeartPulse className="h-3.5 w-3.5" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Dropzone de Upload para o Convex Storage */}
                <div className="md:col-span-7">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleLogoFileUpload(file)
                    }}
                  />

                  <div
                    onDragOver={(e) => {
                      e.preventDefault()
                      setIsDraggingLogo(true)
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault()
                      setIsDraggingLogo(false)
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      setIsDraggingLogo(false)
                      const file = e.dataTransfer.files?.[0]
                      if (file) handleLogoFileUpload(file)
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`h-full min-h-[96px] border-2 border-dashed rounded-xl p-3 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                      isDraggingLogo
                        ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                        : "border-border hover:border-primary/50 hover:bg-muted/40"
                    }`}
                  >
                    <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-1">
                      {isUploadingLogo ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                    </div>
                    <span className="text-xs font-semibold text-foreground">
                      {isUploadingLogo
                        ? "Enviando arquivo para o Convex Storage..."
                        : "Clique para selecionar ou arraste o arquivo aqui"}
                    </span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">
                      PNG (transparente), JPG, WebP ou SVG até 5 MB
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Nome da Clínica</label>
                <Input
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                  placeholder="Altar Fisio"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Subtítulo / Especialidades</label>
                <Input
                  value={clinicSubtitle}
                  onChange={(e) => setClinicSubtitle(e.target.value)}
                  placeholder="Fisioterapia Especializada • Studio Pilates • RPG"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">WhatsApp da Clínica (Com DDD)</label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 98765-4321"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Endereço Completo</label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Av. Paulista, 1000 - São Paulo, SP"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Regras de Desmarcação e Reposição */}
        <Card className="border-border">
          <CardHeader className="p-5 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold">Políticas de Reposição & Desmarcações</CardTitle>
                <CardDescription className="text-xs">
                  Regras automatizadas para turmas de Pilates e atendimentos da clínica.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-5 pt-0 space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">
                  Antecedência Mínima para Desmarcar (Horas)
                </label>
                <Input
                  type="number"
                  min={1}
                  value={noticeHours}
                  onChange={(e) => setNoticeHours(Number(e.target.value))}
                />
                <span className="text-[11px] text-muted-foreground">
                  Desmarcações antes deste prazo liberam a vaga e geram crédito de reposição automático.
                </span>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">
                  Validade do Crédito de Reposição (Dias)
                </label>
                <Input
                  type="number"
                  min={7}
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(Number(e.target.value))}
                />
                <span className="text-[11px] text-muted-foreground">
                  Prazo máximo para o aluno agendar e consumir a reposição na grade.
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Integração WhatsApp (UAZAPI) */}
        <Card className="border-border">
          <CardHeader className="p-5 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold">WhatsApp Gateway (UAZAPI)</CardTitle>
                  <CardDescription className="text-xs">
                    Disparo de lembretes de agendamento (24h/2h), avisos de reposição e comprovantes.
                  </CardDescription>
                </div>
              </div>
              <Badge variant={uazapiToken ? "success" : "warning"} className="text-[10px]">
                {uazapiToken ? "Configurado" : "Modo Sandbox (Simulado)"}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-5 pt-0 space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Endpoint / URL da API UAZAPI</label>
                <Input
                  value={uazapiEndpoint}
                  onChange={(e) => setUazapiEndpoint(e.target.value)}
                  placeholder="https://whatpress.uazapi.com"
                  className="font-mono text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">ID da Instância UAZAPI</label>
                <Input
                  value={uazapiInstanceId}
                  onChange={(e) => setUazapiInstanceId(e.target.value)}
                  placeholder="altar_fisio_live"
                  className="font-mono text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-foreground">Token de Autenticação / API Key</label>
              <Input
                type="password"
                value={uazapiToken}
                onChange={(e) => setUazapiToken(e.target.value)}
                placeholder="Insira seu token da UAZAPI (ou deixe vazio para modo sandbox)"
                className="font-mono text-xs"
              />
              <span className="text-[11px] text-muted-foreground">
                Se o token estiver em branco, o sistema executa os disparos no modo simulado, registrando os logs com integridade.
              </span>
            </div>

            <div className="pt-1 flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTestWhatsApp}
                disabled={isTestingWhatsApp}
                className="gap-1.5 text-xs text-emerald-600 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
              >
                {isTestingWhatsApp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                <span>Testar Conexão WhatsApp</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Card 5: Integração E-mail (Resend) */}
        <Card className="border-border">
          <CardHeader className="p-5 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-sky-500/10 text-sky-600">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold">E-mails Transacionais (Resend)</CardTitle>
                  <CardDescription className="text-xs">
                    Envio de recibos de pagamento, comprovantes para convênios e comunicados.
                  </CardDescription>
                </div>
              </div>
              <Badge variant={resendApiKey ? "success" : "warning"} className="text-[10px]">
                {resendApiKey ? "API Ativa" : "Modo Sandbox (Simulado)"}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-5 pt-0 space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Chave de API do Resend (re_...)</label>
                <Input
                  type="password"
                  value={resendApiKey}
                  onChange={(e) => setResendApiKey(e.target.value)}
                  placeholder="re_live_..."
                  className="font-mono text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">E-mail de Envio (From)</label>
                <Input
                  value={resendFromEmail}
                  onChange={(e) => setResendFromEmail(e.target.value)}
                  placeholder="contato@altarfisio.com.br"
                  className="text-xs"
                />
              </div>
            </div>

            <div className="pt-1 flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTestResend}
                disabled={isTestingResend}
                className="gap-1.5 text-xs text-sky-600 border-sky-500/30 hover:bg-sky-50 dark:hover:bg-sky-950/30"
              >
                {isTestingResend ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                <span>Testar Conexão Resend</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Trilha de Auditoria LGPD e COFFITO */}
        <AuditTrailViewer logs={auditLogs} />

        {/* Botão de Salvar Geral */}

        <div className="flex justify-end pt-2">
          <Button type="submit" size="lg" disabled={isSaving} className="gap-2 font-semibold shadow-md">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            <span>Salvar Todas as Configurações</span>
          </Button>
        </div>
      </form>
    </div>
  )
}
