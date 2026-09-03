import React, { useState } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@convex/_generated/api"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Sparkles,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  Layers,
  MessageSquare,
  Smartphone,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Image as ImageIcon,
  Link,
  Clock,
  Check,
  Star,
  Copy,
  Info,
} from "lucide-react"

interface ButtonItem {
  text: string
  actionType: "reply" | "url"
  payload: string
}

interface CarouselCardItem {
  title: string
  description: string
  imageUrl: string
  buttonText: string
  buttonType: "reply" | "url"
  buttonPayload: string
}

const cleanLineBreaks = (text: string): string => {
  if (!text) return ""
  return text
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
}

export const MessageTemplateBuilder: React.FC = () => {
  const templates = useQuery(api.whatsapp.listTemplates, {}) || []
  const clinicSettings = useQuery(api.clinic.getSettings)
  const saveTemplateMutation = useMutation(api.whatsapp.saveTemplate)
  const deleteTemplateMutation = useMutation(api.whatsapp.deleteTemplate)
  const assignReminderMutation = useMutation(api.whatsapp.assignReminderTemplate)

  // Estado do Editor
  const [editingTemplateId, setEditingTemplateId] = useState<any | null>(null)
  const [title, setTitle] = useState("")
  const [category, setCategory] = useState<"reminder_24h" | "reminder_2h" | "booking_confirmation" | "broadcast" | "custom">("reminder_24h")
  const [type, setType] = useState<"text" | "button" | "list" | "carousel">("button")
  const [content, setContent] = useState(
    "Olá, *{{paciente}}*! 👋\n\nEste é um lembrete do seu atendimento amanhã na *{{clinica}}*:\n\n📅 *Data:* {{data}}\n⏰ *Horário:* {{horario}}\n👨‍⚕️ *Profissional:* {{profissional}}\n📍 *Local:* {{sala}}\n\n{{regras}}"
  )
  const [footerText, setFooterText] = useState("Altar Fisio • Cuidado e Movimento")

  // Botões
  const [buttons, setButtons] = useState<ButtonItem[]>([
    { text: "Confirmar Presença", actionType: "reply", payload: "confirmar" },
    { text: "Desmarcar com Antecedência", actionType: "reply", payload: "desmarcar" },
    { text: "Localização no Maps", actionType: "url", payload: "https://maps.google.com" },
  ])

  // Carrossel
  const [carouselCards, setCarouselCards] = useState<CarouselCardItem[]>([
    {
      title: "Instruções do Atendimento",
      description: "Chegue com 10 minutos de antecedência e use roupas confortáveis.",
      imageUrl: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600",
      buttonText: "Confirmar",
      buttonType: "reply",
      buttonPayload: "confirmar",
    },
    {
      title: "Localização da Clínica",
      description: "Av. Paulista, 1000 - Bela Vista, São Paulo - SP",
      imageUrl: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=600",
      buttonText: "Como Chegar",
      buttonType: "url",
      buttonPayload: "https://maps.google.com",
    },
  ])

  // Menu de Lista
  const [listButtonText, setListButtonText] = useState("Ver Opções de Atendimento")

  // Preview State
  const [previewCardIndex, setPreviewCardIndex] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setFeedback(msg)
    setTimeout(() => setFeedback(null), 3500)
  }

  // Inserir variável no texto
  const insertVariable = (varName: string) => {
    setContent((prev) => `${prev} {{${varName}}}`)
  }

  // Adicionar botão
  const handleAddButton = () => {
    if (buttons.length >= 3) {
      showToast("O WhatsApp permite no máximo 3 botões rápidos.")
      return
    }
    setButtons([...buttons, { text: "Novo Botão", actionType: "reply", payload: "opcao" }])
  }

  const handleRemoveButton = (idx: number) => {
    setButtons(buttons.filter((_, i) => i !== idx))
  }

  const handleUpdateButton = (idx: number, field: keyof ButtonItem, val: string) => {
    const updated = [...buttons]
    updated[idx] = { ...updated[idx], [field]: val }
    setButtons(updated)
  }

  // Adicionar Cartão ao Carrossel
  const handleAddCarouselCard = () => {
    if (carouselCards.length >= 10) return
    setCarouselCards([
      ...carouselCards,
      {
        title: "Novo Cartão",
        description: "Descrição do serviço ou orientação...",
        imageUrl: "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=600",
        buttonText: "Saiba Mais",
        buttonType: "url",
        buttonPayload: "https://altarfisio.com.br",
      },
    ])
  }

  const handleRemoveCarouselCard = (idx: number) => {
    setCarouselCards(carouselCards.filter((_, i) => i !== idx))
    if (previewCardIndex >= carouselCards.length - 1) {
      setPreviewCardIndex(Math.max(0, carouselCards.length - 2))
    }
  }

  const handleUpdateCarouselCard = (idx: number, field: keyof CarouselCardItem, val: string) => {
    const updated = [...carouselCards]
    updated[idx] = { ...updated[idx], [field]: val }
    setCarouselCards(updated)
  }

  // Carregar Template para Edição
  const handleSelectTemplate = (t: any) => {
    setEditingTemplateId(t._id)
    setTitle(t.title)
    setCategory(t.category)
    setType(t.type)
    setContent(cleanLineBreaks(t.content))
    setFooterText(cleanLineBreaks(t.footerText || ""))
    if (t.buttons) setButtons(t.buttons)
    if (t.carouselCards) setCarouselCards(t.carouselCards)
    if (t.listButtonText) setListButtonText(t.listButtonText)
  }

  // Novo Template em Branco
  const handleResetForm = () => {
    setEditingTemplateId(null)
    setTitle("")
    setCategory("custom")
    setType("button")
    setContent("Olá, *{{paciente}}*! Digite sua mensagem aqui...")
    setFooterText("Altar Fisio")
    setButtons([{ text: "Confirmar", actionType: "reply", payload: "confirmar" }])
  }

  // Salvar Template
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      showToast("Informe um título para o template.")
      return
    }

    setIsSaving(true)
    try {
      const cleanContent = cleanLineBreaks(content)
      const cleanFooter = footerText.trim() ? cleanLineBreaks(footerText.trim()) : undefined

      await saveTemplateMutation({
        id: editingTemplateId || undefined,
        title: title.trim(),
        category,
        type,
        content: cleanContent,
        footerText: cleanFooter,
        buttons: type === "button" ? buttons : undefined,
        listButtonText: type === "list" ? listButtonText : undefined,
        carouselCards: type === "carousel" ? carouselCards : undefined,
      })

      showToast("Template salvo com sucesso!")
      setEditingTemplateId(null)
    } catch (err: any) {
      showToast("Erro ao salvar: " + (err?.message || "Tente novamente"))
    } finally {
      setIsSaving(false)
    }
  }

  // Excluir Template
  const handleDelete = async (id: any) => {
    try {
      await deleteTemplateMutation({ id })
      showToast("Template excluído.")
      if (editingTemplateId === id) handleResetForm()
    } catch (err: any) {
      showToast("Erro ao excluir template")
    }
  }

  // Vincular a lembretes e confirmações automáticas
  const handleAssignReminder = async (target: "reminder_24h" | "reminder_2h" | "booking_confirmation", templateId?: any) => {
    try {
      await assignReminderMutation({ target, templateId })
      const label =
        target === "reminder_24h"
          ? "Lembrete 24h"
          : target === "reminder_2h"
          ? "Lembrete 2h"
          : "Confirmação ao Agendar"
      showToast(`Template vinculado com sucesso ao ${label}!`)
    } catch (err: any) {
      showToast("Erro ao vincular template")
    }
  }

  // Formatador simples para Preview do WhatsApp (*negrito*, _itálico_)
  const renderFormattedPreview = (txt: string) => {
    const mockReplacements: Record<string, string> = {
      "{{paciente}}": "Juliana Mendes",
      "{{data}}": "04/09/2026",
      "{{horario}}": "08:00",
      "{{horario_fim}}": "09:00",
      "{{servico}}": "Pilates Studio (Aparelhos)",
      "{{atividade}}": "Pilates Studio (Aparelhos)",
      "{{profissional}}": "Dra. Camila Duarte",
      "{{sala}}": "Studio Pilates Aparelhos",
      "{{clinica}}": "Altar Fisio",
      "{{regras}}": "Desmarcações com menos de 2h de antecedência não geram crédito de reposição.",
      "{{dica}}": " 🧦 Lembre-se de trazer suas meias antiderrapantes!",
      "{{telefone_clinica}}": "(11) 98765-4321",
    }

    let processed = cleanLineBreaks(txt)
    for (const [k, v] of Object.entries(mockReplacements)) {
      processed = processed.split(k).join(v)
    }

    const lines = processed.split("\n")
    return lines.map((line, lineIdx) => {
      // Linha vazia entre parágrafos (espaçamento estilo WhatsApp)
      if (line === "") {
        return <div key={lineIdx} className="h-3.5" />
      }

      // Bold *texto* e Italic _texto_
      const parts = line.split(/(\*[^*]+\*|_[^_]+_)/g)
      return (
        <div key={lineIdx} className="min-h-[1.25em]">
          {parts.map((part, pIdx) => {
            if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
              return (
                <strong key={pIdx} className="font-semibold text-zinc-900 dark:text-zinc-50">
                  {part.slice(1, -1)}
                </strong>
              )
            }
            if (part.startsWith("_") && part.endsWith("_") && part.length > 2) {
              return (
                <em key={pIdx} className="italic">
                  {part.slice(1, -1)}
                </em>
              )
            }
            return part
          })}
        </div>
      )
    })
  }

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {feedback && (
        <div className="p-3.5 bg-emerald-50 text-emerald-900 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between text-xs font-medium animate-in fade-in">
          <span>{feedback}</span>
          <button onClick={() => setFeedback(null)}>✕</button>
        </div>
      )}

      {/* Cartão de Atribuição Rápida de Lembretes Automáticos */}
      <Card className="bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border-emerald-500/20">
        <CardContent className="p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <Star className="w-4 h-4 text-emerald-600 fill-emerald-600" />
              Lembretes Automáticos com WhatsApp Interativo
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Escolha quais modelos interativos da biblioteca serão disparados automaticamente nas confirmações e lembretes das sessões.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            {/* Confirmação Imediata ao Agendar */}
            <div className="flex items-center gap-2 bg-background/80 p-2 rounded-lg border shadow-xs">
              <span className="font-medium text-muted-foreground">Ao Agendar:</span>
              <select
                className="bg-transparent font-semibold text-blue-700 dark:text-blue-400 outline-none cursor-pointer max-w-[160px] truncate"
                value={clinicSettings?.activeConfirmationTemplateId || ""}
                onChange={(e) => handleAssignReminder("booking_confirmation", e.target.value ? (e.target.value as any) : undefined)}
              >
                <option value="">Texto Padrão da Clínica</option>
                {templates.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.title} ({t.type})
                  </option>
                ))}
              </select>
            </div>

            {/* Lembrete 24h */}
            <div className="flex items-center gap-2 bg-background/80 p-2 rounded-lg border shadow-xs">
              <span className="font-medium text-muted-foreground">Lembrete 24h:</span>
              <select
                className="bg-transparent font-semibold text-emerald-700 dark:text-emerald-400 outline-none cursor-pointer max-w-[160px] truncate"
                value={clinicSettings?.activeReminder24hTemplateId || ""}
                onChange={(e) => handleAssignReminder("reminder_24h", e.target.value ? (e.target.value as any) : undefined)}
              >
                <option value="">Texto Padrão da Clínica</option>
                {templates.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.title} ({t.type})
                  </option>
                ))}
              </select>
            </div>

            {/* Lembrete 2h */}
            <div className="flex items-center gap-2 bg-background/80 p-2 rounded-lg border shadow-xs">
              <span className="font-medium text-muted-foreground">Lembrete 2h:</span>
              <select
                className="bg-transparent font-semibold text-teal-700 dark:text-teal-400 outline-none cursor-pointer max-w-[160px] truncate"
                value={clinicSettings?.activeReminder2hTemplateId || ""}
                onChange={(e) => handleAssignReminder("reminder_2h", e.target.value ? (e.target.value as any) : undefined)}
              >
                <option value="">Texto Padrão da Clínica</option>
                {templates.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.title} ({t.type})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grid Principal: Lista + Construtor + Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* COLUNA ESQUERDA: LISTA DE TEMPLATES SALVOS (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-emerald-500" />
              Modelos Salvos ({templates.length})
            </h4>
            <Button size="sm" variant="outline" onClick={handleResetForm} className="h-8 text-xs gap-1">
              <Plus className="w-3.5 h-3.5" /> Novo Modelo
            </Button>
          </div>

          <div className="space-y-2.5 max-h-[700px] overflow-y-auto pr-1">
            {templates.length === 0 ? (
              <div className="p-6 text-center border rounded-xl bg-muted/30 text-xs text-muted-foreground">
                Nenhum template salvo ainda. Crie seu primeiro modelo ao lado com botões ou carrossel!
              </div>
            ) : (
              templates.map((t) => {
                const isSelected = editingTemplateId === t._id
                const isConfDefault = clinicSettings?.activeConfirmationTemplateId === t._id
                const is24hDefault = clinicSettings?.activeReminder24hTemplateId === t._id
                const is2hDefault = clinicSettings?.activeReminder2hTemplateId === t._id

                return (
                  <div
                    key={t._id}
                    onClick={() => handleSelectTemplate(t)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-xs"
                        : "hover:border-border/80 bg-card"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h5 className="font-semibold text-xs truncate">{t.title}</h5>
                      <Badge variant="outline" className="text-[10px] uppercase font-bold py-0">
                        {t.type}
                      </Badge>
                    </div>

                    <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1 whitespace-pre-line">
                      {cleanLineBreaks(t.content)}
                    </p>

                    <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t text-[11px]">
                      <div className="flex flex-wrap items-center gap-1">
                        {isConfDefault && (
                          <Badge className="bg-blue-600 text-white text-[9px] py-0">Ao Agendar Ativo</Badge>
                        )}
                        {is24hDefault && (
                          <Badge className="bg-emerald-600 text-white text-[9px] py-0">24h Ativo</Badge>
                        )}
                        {is2hDefault && (
                          <Badge className="bg-teal-600 text-white text-[9px] py-0">2h Ativo</Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-1 ml-auto">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(t._id)
                          }}
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-red-600"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* COLUNA CENTRAL: FORMULÁRIO DO CONSTRUTOR (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-emerald-600" />
                {editingTemplateId ? "Editar Modelo" : "Criar Novo Modelo de Mensagem"}
              </CardTitle>
              <CardDescription className="text-xs">
                Configure os textos, botões interativos e cartões de carrossel.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSave} className="space-y-4 text-xs">
                {/* Título & Categoria */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-foreground">Título do Modelo</label>
                    <Input
                      placeholder="Ex: Lembrete 24h com Confirmação"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-foreground">Categoria</label>
                    <select
                      value={category}
                      onChange={(e: any) => {
                        const newCat = e.target.value
                        setCategory(newCat)
                        if (newCat === "booking_confirmation" && !editingTemplateId) {
                          if (!title) setTitle("Confirmação Imediata de Agendamento")
                          setContent(
                            "Olá, *{{paciente}}*! 🎉\n\nSeu agendamento na *{{clinica}}* foi realizado com sucesso!\n\n📌 *Atividade:* {{servico}}\n📅 *Data:* {{data}}\n⏰ *Horário:* {{horario}}\n👨‍⚕️ *Profissional:* {{profissional}}\n📍 *Local:* {{sala}}\n\n{{regras}}\n\nEsperamos por você!"
                          )
                          setButtons([
                            { text: "Confirmar Presença", actionType: "reply", payload: "confirmar" },
                            { text: "Ver Localização Maps", actionType: "url", payload: "https://maps.google.com" },
                          ])
                        }
                      }}
                      className="w-full h-8 px-2.5 rounded-md border bg-background text-xs outline-none"
                    >
                      <option value="booking_confirmation">Confirmação ao Agendar (Imediata)</option>
                      <option value="reminder_24h">Lembrete de Véspera (24h)</option>
                      <option value="reminder_2h">Lembrete Imediato (2h)</option>
                      <option value="broadcast">Disparador em Massa</option>
                      <option value="custom">Geral / Personalizado</option>
                    </select>
                  </div>
                </div>

                {/* Seletor de Formato (Texto, Botões, Lista, Carrossel) */}
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Formato da Mensagem WhatsApp</label>
                  <div className="grid grid-cols-4 gap-1.5 p-1 bg-muted rounded-lg text-center">
                    {(["text", "button", "list", "carousel"] as const).map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => setType(fmt)}
                        className={`py-1.5 text-[11px] font-medium rounded-md transition-all ${
                          type === fmt
                            ? "bg-card text-foreground shadow-xs font-bold"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {fmt === "text" && "Texto"}
                        {fmt === "button" && "Botões"}
                        {fmt === "list" && "Lista"}
                        {fmt === "carousel" && "Carrossel"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Variáveis Dinâmicas */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-foreground">Tags Inteligentes (Clique para inserir)</label>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {[
                      { label: "+ Paciente", val: "paciente" },
                      { label: "+ Data", val: "data" },
                      { label: "+ Horário", val: "horario" },
                      { label: "+ Atividade / Serviço", val: "servico" },
                      { label: "+ Profissional", val: "profissional" },
                      { label: "+ Sala", val: "sala" },
                      { label: "+ Clínica", val: "clinica" },
                      { label: "+ Regras de Reposição", val: "regras" },
                    ].map((v) => (
                      <button
                        key={v.val}
                        type="button"
                        onClick={() => insertVariable(v.val)}
                        className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-[10px] font-medium hover:bg-emerald-100"
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Corpo do Texto */}
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Texto Principal</label>
                  <textarea
                    rows={6}
                    className="w-full p-2.5 rounded-lg border bg-background font-mono text-xs outline-none focus:ring-1 focus:ring-emerald-500 whitespace-pre-wrap leading-relaxed"
                    value={content}
                    onChange={(e) => setContent(cleanLineBreaks(e.target.value))}
                    placeholder="Escreva a mensagem usando *negrito* e tags..."
                    required
                  />
                </div>

                {/* Rodapé Opcional */}
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Texto de Rodapé (Opcional)</label>
                  <Input
                    placeholder="Ex: Altar Fisio • (11) 98765-4321"
                    value={footerText}
                    onChange={(e) => setFooterText(cleanLineBreaks(e.target.value))}
                    className="h-8 text-xs"
                  />
                </div>

                {/* CONTEÚDO ESPECÍFICO DE CADA FORMATO */}
                {type === "button" && (
                  <div className="space-y-2 pt-2 border-t">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground">Botões de Ação Rápida ({buttons.length}/3)</span>
                      {buttons.length < 3 && (
                        <Button type="button" size="sm" variant="outline" onClick={handleAddButton} className="h-6 text-[11px] gap-1">
                          <Plus className="w-3 h-3" /> Adicionar Botão
                        </Button>
                      )}
                    </div>

                    <div className="space-y-2">
                      {buttons.map((b, idx) => (
                        <div key={idx} className="p-2.5 rounded-lg bg-muted/40 border space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <Input
                              placeholder="Texto do Botão (Ex: Confirmar Presença)"
                              value={b.text}
                              onChange={(e) => handleUpdateButton(idx, "text", e.target.value)}
                              className="h-7 text-xs flex-1"
                              required
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemoveButton(idx)}
                              className="h-7 w-7 p-0 text-red-500"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <select
                              value={b.actionType}
                              onChange={(e: any) => handleUpdateButton(idx, "actionType", e.target.value)}
                              className="h-7 px-2 rounded border bg-background text-[11px]"
                            >
                              <option value="reply">Resposta de Texto (Reply)</option>
                              <option value="url">Abrir Link / WhatsApp</option>
                            </select>

                            <Input
                              placeholder={b.actionType === "url" ? "https://..." : "ID de resposta (ex: confirmar)"}
                              value={b.payload}
                              onChange={(e) => handleUpdateButton(idx, "payload", e.target.value)}
                              className="h-7 text-[11px]"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {type === "carousel" && (
                  <div className="space-y-2 pt-2 border-t">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground">Cartões do Carrossel ({carouselCards.length})</span>
                      <Button type="button" size="sm" variant="outline" onClick={handleAddCarouselCard} className="h-6 text-[11px] gap-1">
                        <Plus className="w-3 h-3" /> Adicionar Cartão
                      </Button>
                    </div>

                    <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                      {carouselCards.map((card, idx) => (
                        <div key={idx} className="p-2.5 rounded-lg bg-muted/40 border space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-[11px] text-muted-foreground">Cartão #{idx + 1}</span>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemoveCarouselCard(idx)}
                              className="h-6 w-6 p-0 text-red-500"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>

                          <Input
                            placeholder="Título do Cartão"
                            value={card.title}
                            onChange={(e) => handleUpdateCarouselCard(idx, "title", e.target.value)}
                            className="h-7 text-xs"
                          />

                          <Input
                            placeholder="Descrição breve..."
                            value={card.description}
                            onChange={(e) => handleUpdateCarouselCard(idx, "description", e.target.value)}
                            className="h-7 text-xs"
                          />

                          <Input
                            placeholder="URL da Imagem (https://...)"
                            value={card.imageUrl}
                            onChange={(e) => handleUpdateCarouselCard(idx, "imageUrl", e.target.value)}
                            className="h-7 text-xs"
                          />

                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              placeholder="Texto do Botão"
                              value={card.buttonText}
                              onChange={(e) => handleUpdateCarouselCard(idx, "buttonText", e.target.value)}
                              className="h-7 text-xs"
                            />
                            <Input
                              placeholder="Link (https://...)"
                              value={card.buttonPayload}
                              onChange={(e) => handleUpdateCarouselCard(idx, "buttonPayload", e.target.value)}
                              className="h-7 text-xs"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {type === "list" && (
                  <div className="space-y-2 pt-2 border-t">
                    <span className="font-bold text-foreground">Menu de Lista</span>
                    <div className="space-y-1">
                      <label className="text-[11px] text-muted-foreground">Texto do Botão de Abertura da Lista</label>
                      <Input
                        value={listButtonText}
                        onChange={(e) => setListButtonText(e.target.value)}
                        placeholder="Ex: Ver Horários Disponíveis"
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                )}

                {/* Botões de Ação */}
                <div className="pt-3 border-t flex items-center justify-end gap-2">
                  {editingTemplateId && (
                    <Button type="button" variant="outline" size="sm" onClick={handleResetForm}>
                      Cancelar
                    </Button>
                  )}
                  <Button type="submit" size="sm" disabled={isSaving} className="bg-emerald-600 text-white gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {editingTemplateId ? "Atualizar Modelo" : "Salvar Modelo"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* COLUNA DIREITA: PREVIEW EM TEMPO REAL ESTILO WHATSAPP (3 cols) */}
        <div className="lg:col-span-3 sticky top-4">
          <div className="rounded-3xl border shadow-xl bg-zinc-950 p-2 text-zinc-100 max-w-[320px] mx-auto">
            {/* Topo do Smartphone */}
            <div className="flex justify-between items-center px-4 py-1.5 text-[11px] text-zinc-400">
              <span>09:41</span>
              <div className="w-12 h-3 bg-zinc-800 rounded-full mx-auto" />
              <span>100%</span>
            </div>

            {/* Cabeçalho do Chat WhatsApp */}
            <div className="bg-emerald-700 dark:bg-emerald-900 text-white p-2.5 rounded-t-2xl flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs">
                AF
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold truncate">Altar Fisio</div>
                <div className="text-[10px] text-emerald-200">online</div>
              </div>
            </div>

            {/* Tela de Conversa (Wallpaper WhatsApp) */}
            <div
              className="p-3 min-h-[440px] flex flex-col justify-end space-y-2 rounded-b-2xl"
              style={{
                backgroundColor: "#efeae2",
                backgroundImage: "radial-gradient(#d1c7b7 0.75px, transparent 0.75px)",
                backgroundSize: "16px 16px",
              }}
            >
              {/* Balão do WhatsApp */}
              <div className="bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 p-3 rounded-2xl rounded-tr-none shadow-sm text-xs space-y-2 border border-black/5">
                {/* Texto Principal formatado */}
                <div className="text-[11px] leading-relaxed select-none">
                  {renderFormattedPreview(content)}
                </div>

                {/* Rodapé do Balão */}
                {footerText && (
                  <div className="text-[10px] text-zinc-400 border-t pt-1 select-none whitespace-pre-line">
                    {cleanLineBreaks(footerText)}
                  </div>
                )}

                {/* Hora e Checkmark */}
                <div className="flex justify-end items-center gap-1 text-[9px] text-zinc-400 select-none">
                  <span>10:30</span>
                  <Check className="w-3 h-3 text-sky-500" />
                </div>
              </div>

              {/* Botões Interativos Embaixo do Balão */}
              {type === "button" && buttons.length > 0 && (
                <div className="space-y-1 pt-1">
                  {buttons.map((b, i) => (
                    <div
                      key={i}
                      className="bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 font-semibold text-center py-2 px-3 rounded-xl shadow-xs border border-emerald-500/20 text-xs flex items-center justify-center gap-1.5 select-none hover:bg-emerald-50/50"
                    >
                      {b.actionType === "url" && <ExternalLink className="w-3 h-3 text-muted-foreground" />}
                      {b.text || "Botão"}
                    </div>
                  ))}
                </div>
              )}

              {/* Menu de Lista Preview */}
              {type === "list" && (
                <div className="pt-1">
                  <div className="bg-white dark:bg-zinc-800 text-emerald-600 font-semibold text-center py-2 px-3 rounded-xl shadow-xs border border-emerald-500/20 text-xs flex items-center justify-center gap-1.5 select-none">
                    <Layers className="w-3.5 h-3.5" />
                    {listButtonText || "Ver Opções"}
                  </div>
                </div>
              )}

              {/* Carrossel Preview */}
              {type === "carousel" && carouselCards.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="bg-white dark:bg-zinc-800 rounded-xl overflow-hidden shadow-xs border text-xs">
                    {carouselCards[previewCardIndex]?.imageUrl && (
                      <img
                        src={carouselCards[previewCardIndex].imageUrl}
                        alt="Preview"
                        className="w-full h-24 object-cover"
                      />
                    )}
                    <div className="p-2 space-y-1">
                      <div className="font-bold text-[11px] truncate">
                        {carouselCards[previewCardIndex]?.title || "Título"}
                      </div>
                      <div className="text-[10px] text-zinc-500 line-clamp-2">
                        {carouselCards[previewCardIndex]?.description || "Descrição..."}
                      </div>
                      <div className="pt-1 text-center font-semibold text-emerald-600 text-[11px] border-t">
                        {carouselCards[previewCardIndex]?.buttonText || "Ação"}
                      </div>
                    </div>
                  </div>

                  {carouselCards.length > 1 && (
                    <div className="flex items-center justify-between px-1 text-[10px] text-zinc-500">
                      <button
                        onClick={() => setPreviewCardIndex((p) => Math.max(0, p - 1))}
                        disabled={previewCardIndex === 0}
                        className="p-1 disabled:opacity-30"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <span>
                        {previewCardIndex + 1} de {carouselCards.length}
                      </span>
                      <button
                        onClick={() => setPreviewCardIndex((p) => Math.min(carouselCards.length - 1, p + 1))}
                        disabled={previewCardIndex === carouselCards.length - 1}
                        className="p-1 disabled:opacity-30"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
