import React, { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Phone,
  Send,
  RotateCcw,
  AlertCircle,
  Loader2,
  Sparkles,
} from 'lucide-react'
import { formatPhoneBR } from '@/lib/utils'
import { formatSpecialtyName } from '../../../shared/clinicalSpecialties'

export interface WhatsAppScheduleItem {
  date: string
  dayOfWeek: number
  startTime: string
  endTime: string
  specialty?: string
  roomName?: string
  professionalName?: string
}

interface WhatsAppSummaryModalProps {
  open: boolean
  onClose: () => void
  onSend: (customMessage: string) => Promise<void>
  patientName: string
  patientPhone?: string
  clinicName?: string
  noticeHours?: number
  items: WhatsAppScheduleItem[]
  isLoading?: boolean
  initialCustomMessage?: string
  title?: string
  templateContent?: string
  templateTitle?: string
}

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function buildDefaultMessage(
  patientName: string,
  clinicName: string,
  noticeHours: number,
  items: WhatsAppScheduleItem[],
  templateContent?: string
): string {
  const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
  const first = sorted[0]
  const specialty = first?.specialty ? formatSpecialtyName(first.specialty, null, first.roomName) : 'Sessão'
  const prof = first?.professionalName || 'Dr(a). Fisioterapeuta'
  const room = first?.roomName || 'Sala de Atendimento'

  const lines = sorted.map((s) => {
    const [y, m, d] = s.date.split('-').map(Number)
    const dateObj = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
    const dayName = DAY_NAMES[dateObj.getUTCDay()]
    const formattedDate = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`
    return `• ${dayName}, ${formattedDate} às ${s.startTime}`
  })

  // Se houver um modelo personalizado ativo vinculado em Modelos de Lembretes
  if (templateContent?.trim()) {
    const [y, m, d] = (first?.date || '').split('-').map(Number)
    const dateObj = first?.date ? new Date(Date.UTC(y, m - 1, d, 12, 0, 0)) : null
    const dayName = dateObj ? DAY_NAMES[dateObj.getUTCDay()] : ''
    const formattedDate = dateObj ? `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}` : ''
    const singleDateStr = `${dayName}, ${formattedDate}`

    const vars: Record<string, string> = {
      paciente: patientName,
      clinica: clinicName,
      servico: specialty,
      atividade: specialty,
      profissional: prof,
      sala: room,
      data: singleDateStr,
      horario: first?.startTime || '',
      horario_fim: first?.endTime || '',
      regras: `Caso precise desmarcar ou reagendar, faça com no mínimo *${noticeHours}h de antecedência* pelo Portal para liberar seu crédito de reposição automático.`,
      datas: sorted.length > 1 ? `(${sorted.length} sessões)\n${lines.join('\n')}` : `${singleDateStr} às ${first?.startTime || ''}`,
      lista_agendamentos: lines.join('\n'),
    }

    let interpolated = templateContent.trim()
    for (const [k, v] of Object.entries(vars)) {
      const reg = new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'gi')
      interpolated = interpolated.replace(reg, v)
    }

    // Se foram marcadas múltiplas sessões e o template não possui a tag {{datas}} nem a lista, anexa ao final
    if (sorted.length > 1 && !/\{\{\s*(datas|lista_agendamentos)\s*\}\}/i.test(templateContent) && lines.length > 0 && !interpolated.includes(lines[0])) {
      interpolated += `\n\n🗓 *Datas e Horários Marcados:* (${sorted.length} sessões)\n${lines.join('\n')}`
    }

    return interpolated
  }

  if (items.length === 0) {
    return `Olá, *${patientName}*! 🎉\n\nConfirmamos seu agendamento na *${clinicName}*.\n\nNos vemos na clínica!`
  }

  if (sorted.length === 1) {
    const [y, m, d] = first.date.split('-').map(Number)
    const dateObj = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
    const dayName = DAY_NAMES[dateObj.getUTCDay()]
    const formattedDate = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`

    return `Olá, *${patientName}*! 🎉\n\nConfirmamos seu agendamento na *${clinicName}*:\n\n📌 *Atividade:* ${specialty}\n📅 *Data:* ${dayName}, ${formattedDate}\n⏰ *Horário:* ${first.startTime} às ${first.endTime}\n👨‍⚕️ *Profissional:* ${prof}\n📍 *Local:* ${room}\n\n⚠️ *Regra de Desmarcação:* Caso precise desmarcar ou reagendar, faça com no mínimo *${noticeHours}h de antecedência* pelo Portal para liberar seu crédito de reposição automático.\n\nNos vemos na clínica!`
  }

  return `Olá, *${patientName}*! 🎉\n\nConfirmamos seus agendamentos na *${clinicName}*:\n\n📌 *Atividade:* ${specialty}\n👨‍⚕️ *Profissional:* ${prof}\n📍 *Local:* ${room}\n\n🗓 *Datas e Horários Marcados:* (${sorted.length} sessões)\n${lines.join('\n')}\n\n⚠️ *Regra de Desmarcação:* Caso precise desmarcar ou reagendar, faça com no mínimo *${noticeHours}h de antecedência* pelo Portal para liberar seu crédito de reposição automático.\n\nNos vemos na clínica!`
}

export function WhatsAppSummaryModal({
  open,
  onClose,
  onSend,
  patientName,
  patientPhone,
  clinicName = 'Altar Fisio',
  noticeHours = 2,
  items,
  isLoading = false,
  initialCustomMessage,
  title,
  templateContent,
  templateTitle,
}: WhatsAppSummaryModalProps) {
  const defaultText = useMemo(
    () => initialCustomMessage || buildDefaultMessage(patientName, clinicName, noticeHours, items, templateContent),
    [initialCustomMessage, patientName, clinicName, noticeHours, items, templateContent]
  )

  const [message, setMessage] = useState(defaultText)
  const [isSending, setIsSending] = useState(false)

  // Sincroniza o texto quando o modal abre ou as propriedades mudam
  useEffect(() => {
    if (open) {
      setMessage(defaultText)
    }
  }, [open, defaultText])

  const handleReset = () => {
    setMessage(defaultText)
  }

  const handleSend = async () => {
    if (!message.trim() || isSending) return
    setIsSending(true)
    try {
      await onSend(message.trim())
      onClose()
    } finally {
      setIsSending(false)
    }
  }

  const hasPhone = Boolean(patientPhone && patientPhone.replace(/\D/g, '').length >= 10)

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden border-border rounded-2xl shadow-2xl">
        {/* Cabeçalho */}
        <div className="bg-gradient-to-r from-emerald-600/10 via-emerald-600/5 to-transparent border-b border-border/70 p-5 sm:p-6 pb-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-600/15 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
              <Phone className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                <span>{title || 'Enviar Resumo por WhatsApp'}</span>
                <Badge variant="outline" className="bg-emerald-600/10 text-emerald-700 border-emerald-600/30 text-[10px] font-semibold">
                  1 mensagem
                </Badge>
              </DialogTitle>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                <span className="font-semibold text-foreground">{patientName}</span>
                <span>•</span>
                {hasPhone ? (
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                    {formatPhoneBR(patientPhone!)}
                  </span>
                ) : (
                  <span className="text-amber-600 font-medium flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> Sem telefone cadastrado
                  </span>
                )}
                <span>•</span>
                <span className="text-muted-foreground font-medium">
                  {items.length} {items.length === 1 ? 'sessão' : 'sessões'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Conteúdo Principal com Scroll */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {/* Card de Informação sobre Edição */}
          <div className="flex items-center justify-between text-xs bg-muted/40 p-2.5 rounded-xl border border-border/60">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span>
                {templateTitle ? (
                  <>
                    Baseado no modelo <strong className="text-foreground">"{templateTitle}"</strong> (Modelos de Lembretes). Edite livremente:
                  </>
                ) : (
                  'Você pode editar qualquer texto abaixo antes de enviar:'
                )}
              </span>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="h-6 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground shrink-0"
              title="Restaurar mensagem padrão inicial"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Restaurar</span>
            </Button>
          </div>

          {/* Área de Edição da Mensagem */}
          <div className="space-y-1.5">
            <textarea
              value={message}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)}
              disabled={isSending || isLoading}
              className="w-full min-h-[260px] max-h-[45vh] font-sans text-xs sm:text-sm leading-relaxed rounded-xl border border-border bg-background focus:outline-hidden focus:ring-2 focus:ring-emerald-500 shadow-inner resize-y p-3.5 text-foreground placeholder:text-muted-foreground"
              placeholder="Digite a mensagem que será enviada para o paciente..."
            />
            <div className="flex justify-between text-[11px] text-muted-foreground px-1">
              <span>Será enviado via instância WhatsApp conectada (Uazapi).</span>
              <span>{message.length} caracteres</span>
            </div>
          </div>

          {!hasPhone && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Este paciente não possui telefone válido com DDD cadastrado. O WhatsApp não poderá ser entregue. Atualize o cadastro antes de enviar.
              </span>
            </div>
          )}
        </div>

        {/* Rodapé de Ações */}
        <DialogFooter className="p-4 sm:p-5 border-t border-border/70 bg-muted/20 flex flex-col-reverse sm:flex-row gap-2 sm:gap-0 justify-between items-center">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSending || isLoading}
            className="text-xs h-9 w-full sm:w-auto"
          >
            Não Enviar WhatsApp
          </Button>

          <Button
            type="button"
            onClick={handleSend}
            disabled={!hasPhone || isSending || isLoading || !message.trim()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs h-9 w-full sm:w-auto font-semibold shadow-xs"
          >
            {isSending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Enviando WhatsApp...</span>
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                <span>Enviar Resumo por WhatsApp</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
