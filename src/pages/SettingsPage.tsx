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
  Sparkles,
  Send,
  Mail,
  Smartphone,
  ShieldCheck,
  AlertCircle,
  Loader2,
} from "lucide-react"

export const SettingsPage: React.FC = () => {
  const { theme, setPreset, setMode, updateClinicInfo } = useTheme()
  const { testUazapiConnection, testResendConnection, auditLogs } = useClinicData()


  const convexSettings = useQuery(api.clinic.getSettings)
  const updateSettingsMutation = useMutation(api.clinic.updateSettings)

  const [clinicName, setClinicName] = useState(theme.clinicName)
  const [clinicSubtitle, setClinicSubtitle] = useState(theme.clinicSubtitle)
  const [phone, setPhone] = useState("(11) 98765-4321")
  const [address, setAddress] = useState("Av. Paulista, 1000 - Bela Vista, São Paulo - SP")

  // Regras de negócio
  const [noticeHours, setNoticeHours] = useState(2)
  const [expiryDays, setExpiryDays] = useState(30)

  // Chaves de API & Endpoints
  const [uazapiEndpoint, setUazapiEndpoint] = useState("https://api.uazapi.com")
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    updateClinicInfo(clinicName, clinicSubtitle)

    try {
      await updateSettingsMutation({
        clinicName,
        clinicSubtitle,
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
        uazapiEndpoint,
        uazapiToken,
        uazapiInstanceId,
        resendApiKey,
        resendFromEmail,
      })
      showToast("Configurações e credenciais salvas no Convex com sucesso!")
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

          <CardContent className="p-5 pt-0 space-y-3 text-xs">
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
                  placeholder="https://api.uazapi.com"
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
