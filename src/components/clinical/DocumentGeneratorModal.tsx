import React, { useState, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  FileText,
  Printer,
  Copy,
  Check,
  ShieldCheck,
  Award,
  HeartPulse,
  Receipt,
  FileCheck2,
  Sparkles,
} from "lucide-react"
import type { Patient, Professional, ClinicalRecord, ClinicalEvolution, ClinicalDocumentType } from "@/types"

interface DocumentGeneratorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  patient?: Patient
  professionals: Professional[]
  currentProfessional?: Professional
  clinicalRecord?: ClinicalRecord | null
  evolutions?: ClinicalEvolution[]
  onDocumentPrinted?: (docType: ClinicalDocumentType, title: string) => void
}

export const DocumentGeneratorModal: React.FC<DocumentGeneratorModalProps> = ({
  open,
  onOpenChange,
  patient,
  professionals,
  currentProfessional,
  clinicalRecord,
  evolutions = [],
  onDocumentPrinted,
}) => {
  const [selectedDocType, setSelectedDocType] = useState<ClinicalDocumentType>("certificate")
  const [selectedProfId, setSelectedProfId] = useState<string>(
    currentProfessional?.id || professionals[0]?.id || ""
  )
  const [copied, setCopied] = useState(false)

  // Campos customizáveis para o Atestado / Declaração
  const [sessionDate, setSessionDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  )
  const [startTime, setStartTime] = useState("08:00")
  const [endTime, setEndTime] = useState("09:00")
  const [specialty, setSpecialty] = useState("Pilates Clínico & Reabilitação Funcional")
  const [purpose, setPurpose] = useState<"comparecimento" | "tratamento_continuo" | "repouso">(
    "comparecimento"
  )
  const [cidCode, setCidCode] = useState("M54.5 (Dor lombar baixa)")
  const [restDays, setRestDays] = useState("1")
  const [customNotes, setCustomNotes] = useState(
    "Paciente encontra-se em programa ativo de cinesioterapia com boa tolerância aos exercícios."
  )

  // Campos customizáveis para o Recibo de Reembolso
  const [receiptAmount, setReceiptAmount] = useState<number>(380)
  const [sessionsCount, setSessionsCount] = useState<number>(4)
  const [paymentMethodText, setPaymentMethodText] = useState("PIX")
  const [serviceDescription, setServiceDescription] = useState(
    "Sessões de Fisioterapia Traumato-Ortopédica e Reabilitação Postural"
  )

  const activeProf =
    professionals.find((p) => p.id === selectedProfId) || currentProfessional || professionals[0]

  // Formatação de data em português
  const formatDateExtended = (dateStr: string) => {
    try {
      const parts = dateStr.split("-")
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
      return d.toLocaleDateString("pt-BR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    } catch {
      return dateStr
    }
  }

  const todayExtended = formatDateExtended(new Date().toISOString().split("T")[0])

  const docHash = useMemo(() => {
    const cleanCrefito = activeProf?.crefito ? activeProf.crefito.replace(/[^A-Za-z0-9]/g, "") : "CREFITO"
    return `COFFITO-${cleanCrefito}-${Date.now().toString(36).toUpperCase()}`
  }, [activeProf?.crefito, selectedDocType])

  const handlePrint = () => {
    if (onDocumentPrinted) {
      onDocumentPrinted(selectedDocType, getDocumentTitle())
    }
    window.print()
  }

  const getDocumentTitle = () => {
    switch (selectedDocType) {
      case "certificate":
        return purpose === "comparecimento" ? "Atestado de Comparecimento" : "Declaração de Tratamento Fisioterapêutico"
      case "receipt":
        return "Recibo para Reembolso de Convênio"
      case "tcle":
        return "Termo de Consentimento Livre e Esclarecido (TCLE / LGPD)"
      case "report":
        return "Laudo de Evolução Clínica e Biomecânica"
    }
  }

  const handleCopyText = () => {
    const el = document.getElementById("document-print-body")
    if (el) {
      navigator.clipboard.writeText(el.innerText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="p-5 pb-3 border-b border-border bg-card/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <FileCheck2 className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  Central de Emissão de Documentos Clínicos
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Modelos em conformidade com o COFFITO, CREFITO-3 e LGPD para impressão e exportação em PDF.
                </DialogDescription>
              </div>
            </div>
            {patient && (
              <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">
                Paciente: {patient.name.split(" ")[0]} ({patient.documentCpf})
              </Badge>
            )}
          </div>

          {/* Seleção do Tipo de Documento */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3">
            <Button
              type="button"
              variant={selectedDocType === "certificate" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedDocType("certificate")}
              className="text-xs h-9 justify-start gap-1.5 font-medium"
            >
              <Award className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Atestado / Declaração</span>
            </Button>
            <Button
              type="button"
              variant={selectedDocType === "receipt" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedDocType("receipt")}
              className="text-xs h-9 justify-start gap-1.5 font-medium"
            >
              <Receipt className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Recibo de Convênio</span>
            </Button>
            <Button
              type="button"
              variant={selectedDocType === "tcle" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedDocType("tcle")}
              className="text-xs h-9 justify-start gap-1.5 font-medium"
            >
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Termo TCLE & LGPD</span>
            </Button>
            <Button
              type="button"
              variant={selectedDocType === "report" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedDocType("report")}
              className="text-xs h-9 justify-start gap-1.5 font-medium"
            >
              <FileText className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Laudo de Evolução</span>
            </Button>
          </div>
        </DialogHeader>

        {/* Corpo: Painel Dividido (Configurações Rápidas à Esquerda, Visualização A4 à Direita) */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12">
          {/* Coluna de Configuração (Ocultada na Impressão) */}
          <div className="md:col-span-4 p-4 border-r border-border bg-muted/20 overflow-y-auto space-y-3.5 text-xs print:hidden">
            <h4 className="font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span>Parâmetros do Documento</span>
            </h4>

            {/* Fisioterapeuta Responsável */}
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                Profissional Emissor (CREFITO)
              </label>
              <select
                value={selectedProfId}
                onChange={(e) => setSelectedProfId(e.target.value)}
                className="w-full h-8 px-2 rounded-lg border border-border bg-background text-xs text-foreground focus:ring-1 focus:ring-primary"
              >
                {professionals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.crefito}
                  </option>
                ))}
              </select>
            </div>

            {/* Customizações específicas para Atestado */}
            {selectedDocType === "certificate" && (
              <>
                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                    Tipo de Atestado
                  </label>
                  <select
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value as any)}
                    className="w-full h-8 px-2 rounded-lg border border-border bg-background text-xs text-foreground"
                  >
                    <option value="comparecimento">Comparecimento (Trabalho / Escola)</option>
                    <option value="tratamento_continuo">Declaração de Tratamento Contínuo</option>
                    <option value="repouso">Atestado de Dispensa / Repouso</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                      Data da Sessão
                    </label>
                    <Input
                      type="date"
                      value={sessionDate}
                      onChange={(e) => setSessionDate(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  {purpose === "repouso" ? (
                    <div>
                      <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                        Dias de Repouso
                      </label>
                      <Input
                        type="number"
                        value={restDays}
                        onChange={(e) => setRestDays(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                        Horário (De - Até)
                      </label>
                      <div className="flex items-center gap-1">
                        <Input
                          type="text"
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          className="h-8 text-xs px-1 text-center"
                        />
                        <span>-</span>
                        <Input
                          type="text"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          className="h-8 text-xs px-1 text-center"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                    Modalidade do Atendimento
                  </label>
                  <Input
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                    CID-10 (Opcional)
                  </label>
                  <Input
                    value={cidCode}
                    onChange={(e) => setCidCode(e.target.value)}
                    className="h-8 text-xs font-mono"
                    placeholder="Ex: M54.5"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                    Observações / Conduta
                  </label>
                  <textarea
                    rows={2}
                    value={customNotes}
                    onChange={(e) => setCustomNotes(e.target.value)}
                    className="w-full p-2 rounded-lg border border-border bg-background text-xs resize-none"
                  />
                </div>
              </>
            )}

            {/* Customizações específicas para Recibo de Convênio */}
            {selectedDocType === "receipt" && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                      Valor Total (R$)
                    </label>
                    <Input
                      type="number"
                      value={receiptAmount}
                      onChange={(e) => setReceiptAmount(parseFloat(e.target.value) || 0)}
                      className="h-8 text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                      Qtd. Sessões
                    </label>
                    <Input
                      type="number"
                      value={sessionsCount}
                      onChange={(e) => setSessionsCount(parseInt(e.target.value) || 1)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                    Forma de Liquidação
                  </label>
                  <Input
                    value={paymentMethodText}
                    onChange={(e) => setPaymentMethodText(e.target.value)}
                    className="h-8 text-xs"
                    placeholder="Ex: PIX / Transferência"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                    Discriminação dos Serviços
                  </label>
                  <textarea
                    rows={3}
                    value={serviceDescription}
                    onChange={(e) => setServiceDescription(e.target.value)}
                    className="w-full p-2 rounded-lg border border-border bg-background text-xs resize-none"
                  />
                </div>
              </>
            )}

            {/* Dica de Impressão */}
            <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/10 text-[11px] text-muted-foreground space-y-1">
              <p className="font-semibold text-primary flex items-center gap-1">
                <Printer className="h-3.5 w-3.5" />
                <span>Pronto para Salvar em PDF</span>
              </p>
              <p>
                Ao clicar em "Imprimir / PDF", selecione o destino como <strong>"Salvar como PDF"</strong> no navegador para gerar o arquivo com resolução A4 vetorial.
              </p>
            </div>
          </div>

          {/* Coluna da Folha A4 (Preview e Alvo de Impressão) */}
          <div className="md:col-span-8 p-4 bg-muted/40 overflow-y-auto flex justify-center">
            <div
              id="printable-document"
              className="w-full max-w-[650px] bg-card text-foreground border border-border shadow-md rounded-lg p-8 space-y-6 font-sans text-xs leading-relaxed print:m-0 print:p-0 print:border-none print:shadow-none print:max-w-none print:w-full print:bg-white print:text-black"
            >
              {/* Cabeçalho Oficial Timbrado */}
              <div className="border-b-2 border-primary/30 pb-4 flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center font-bold print:border print:border-black">
                      <HeartPulse className="h-5 w-5 text-primary print:text-black" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold tracking-tight text-foreground uppercase print:text-black">
                        Altar Fisio
                      </h2>
                      <p className="text-[10px] text-muted-foreground tracking-wider uppercase font-medium print:text-gray-600">
                        Clínica de Fisioterapia, Studio de Pilates & RPG
                      </p>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground print:text-gray-600">
                    Dr. Marcelo Henrique • CREFITO-3 / 184520-F
                  </p>
                </div>

                <div className="text-right text-[10px] text-muted-foreground space-y-0.5 print:text-gray-600">
                  <p className="font-medium text-foreground print:text-black">CNPJ: 45.123.789/0001-90</p>
                  <p>Av. Paulista, 1000 - Cj. 42 • Bela Vista</p>
                  <p>São Paulo - SP • CEP 01310-100</p>
                  <p>Tel/WhatsApp: (11) 99123-4567</p>
                </div>
              </div>

              {/* Título Central do Documento */}
              <div className="text-center py-2">
                <h1 className="text-base font-extrabold uppercase tracking-wide text-foreground border-b border-border/60 pb-2 inline-block px-6 print:text-black print:border-black">
                  {getDocumentTitle()}
                </h1>
              </div>

              {/* Corpo Dinâmico por Tipo de Documento */}
              <div id="document-print-body" className="space-y-5 text-justify leading-relaxed">
                {/* 1. MODELO: ATESTADO DE COMPARECIMENTO / DECLARAÇÃO */}
                {selectedDocType === "certificate" && (
                  <>
                    <p>
                      Atesto para os devidos fins a quem interessar que o(a) paciente{" "}
                      <strong className="font-bold text-foreground print:text-black">
                        {patient?.name || "Paciente Selecionado"}
                      </strong>
                      , portador(a) do CPF nº{" "}
                      <span className="font-mono font-semibold">
                        {patient?.documentCpf || "000.000.000-00"}
                      </span>
                      {patient?.healthInsurance && (
                        <span> (Convênio: {patient.healthInsurance})</span>
                      )}
                      {purpose === "comparecimento" && (
                        <>
                          , compareceu a esta unidade de saúde no dia{" "}
                          <strong>{formatDateExtended(sessionDate)}</strong>, no período compreendido entre{" "}
                          <strong>{startTime}</strong> e <strong>{endTime}</strong>, estando sob assistência e conduta fisioterapêutica na modalidade de{" "}
                          <strong>{specialty}</strong>.
                        </>
                      )}
                      {purpose === "tratamento_continuo" && (
                        <>
                          , encontra-se em acompanhamento fisioterapêutico regular nesta clínica para reabilitação funcional e reeducação biomecânica na modalidade de{" "}
                          <strong>{specialty}</strong>, com frequência prevista de 2 a 3 sessões semanais.
                        </>
                      )}
                      {purpose === "repouso" && (
                        <>
                          , foi avaliado(a) nesta data e necessita de dispensa de suas atividades laborais e repouso pelo período de{" "}
                          <strong>{restDays} dia(s)</strong> a contar desta data, para recuperação musculoesquelética e controle álgico.
                        </>
                      )}
                    </p>

                    {cidCode && (
                      <p className="p-2.5 rounded-lg bg-muted/40 border border-border text-xs print:border print:border-gray-300">
                        <strong>Classificação Internacional de Doenças (CID-10):</strong>{" "}
                        <span className="font-mono font-semibold">{cidCode}</span>
                        <span className="block text-[10px] text-muted-foreground mt-0.5 print:text-gray-600">
                          (Diagnóstico cinesiológico funcional conforme Resolução COFFITO nº 414/2012).
                        </span>
                      </p>
                    )}

                    {customNotes && (
                      <p>
                        <strong>Observações Terapêuticas:</strong> {customNotes}
                      </p>
                    )}
                  </>
                )}

                {/* 2. MODELO: RECIBO DE REEMBOLSO DE CONVÊNIO */}
                {selectedDocType === "receipt" && (
                  <>
                    <div className="p-3 bg-muted/30 border border-border rounded-lg text-xs space-y-1 print:border print:border-gray-300">
                      <p className="text-[11px] text-muted-foreground font-semibold uppercase">
                        Finalidade do Documento:
                      </p>
                      <p className="font-medium">
                        Recibo oficial discriminado para solicitação de Reembolso junto à Operadora de Plano de Saúde ou comprovação em Declaração de Ajuste Anual do IRPF.
                      </p>
                    </div>

                    <p>
                      Recebi(emos) do(a) Sr(a).{" "}
                      <strong className="font-bold text-foreground print:text-black">
                        {patient?.name || "Paciente Selecionado"}
                      </strong>
                      , inscrito(a) no CPF/MF sob o nº{" "}
                      <strong className="font-mono">{patient?.documentCpf || "000.000.000-00"}</strong>, a quantia líquida de{" "}
                      <strong className="text-sm font-bold text-primary print:text-black">
                        R$ {receiptAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </strong>
                      , referente à realização de{" "}
                      <strong>{sessionsCount} sessão(ões)</strong> de{" "}
                      <span>{serviceDescription}</span>.
                    </p>

                    <div className="border border-border rounded-lg overflow-hidden text-xs print:border-gray-400">
                      <div className="bg-muted/50 px-3 py-1.5 font-bold border-b border-border flex justify-between print:bg-gray-100">
                        <span>Discriminação do Atendimento</span>
                        <span>Detalhes</span>
                      </div>
                      <div className="p-3 space-y-1.5">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Procedimento:</span>
                          <span className="font-medium text-right">{serviceDescription}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Sessões computadas:</span>
                          <span className="font-medium">{sessionsCount} sessões presenciais</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Valor médio unitário:</span>
                          <span className="font-medium">
                            R 
                            {(receiptAmount / (sessionsCount || 1)).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                            })}{" "}
                            / sessão
                          </span>
                        </div>
                        <div className="flex justify-between border-t border-border pt-1">
                          <span className="text-muted-foreground">Forma de Liquidação:</span>
                          <span className="font-medium uppercase">{paymentMethodText}</span>
                        </div>
                      </div>
                    </div>

                    <p className="text-[11px] text-muted-foreground print:text-gray-600">
                      Declaramos para os devidos fins que o valor acima foi devidamente quitado e o atendimento prestado diretamente por profissional fisioterapeuta habilitado com registro ativo no Conselho Regional de Fisioterapia e Terapia Ocupacional (CREFITO-3).
                    </p>
                  </>
                )}

                {/* 3. MODELO: TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO (TCLE) & LGPD */}
                {selectedDocType === "tcle" && (
                  <>
                    <p className="text-[11px]">
                      Pelo presente instrumento, eu,{" "}
                      <strong>{patient?.name || "_________________________________"}</strong>, CPF nº{" "}
                      <span className="font-mono">{patient?.documentCpf || "_________________"}</span>, declaro que:
                    </p>

                    <div className="space-y-2.5 text-[11px]">
                      <div className="p-2.5 rounded border border-border bg-muted/20 space-y-1">
                        <p className="font-bold text-foreground print:text-black">
                          1. Consentimento para Avaliação e Tratamento Fisioterapêutico:
                        </p>
                        <p className="text-muted-foreground print:text-gray-700">
                          Fui devidamente orientado(a) pelo fisioterapeuta responsável sobre os procedimentos cinesioterapêuticos, exercícios no Studio de Pilates, manobras de RPG e recursos eletrotermofototerapêuticos a serem empregados, compreendendo seus objetivos terapêuticos e possíveis respostas mecânicas adaptativas (dor muscular transitória).
                        </p>
                      </div>

                      <div className="p-2.5 rounded border border-border bg-muted/20 space-y-1">
                        <p className="font-bold text-foreground print:text-black">
                          2. Autorização para Biofotogrametria Postural Computadorizada:
                        </p>
                        <p className="text-muted-foreground print:text-gray-700">
                          Autorizo expressamente o registro de fotografias posturais (vistas anterior, posterior e laterais) com espelho quadriculado, estritamente para avaliação biomecânica, mensuração de assimetrias e acompanhamento comparativo de evolução. Estas imagens são sigilosas e integram meu prontuário clínico.
                        </p>
                      </div>

                      <div className="p-2.5 rounded border border-border bg-muted/20 space-y-1">
                        <p className="font-bold text-foreground print:text-black">
                          3. Tratamento de Dados Pessoais e Sensíveis de Saúde (LGPD):
                        </p>
                        <p className="text-muted-foreground print:text-gray-700">
                          Concordo com a coleta e armazenamento de meus dados pessoais e histórico clínico de saúde pela <strong>Altar Fisio</strong>, conforme a Lei nº 13.709/2018 (Lei Geral de Proteção de Dados - LGPD) e a Resolução COFFITO nº 414/2012, para a finalidade exclusiva de prestação de assistência fisioterapêutica e cumprimento de deveres regulatórios.
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {/* 4. MODELO: LAUDO / RELATÓRIO DE EVOLUÇÃO CLÍNICA */}
                {selectedDocType === "report" && (
                  <>
                    <div className="border border-border rounded-lg p-3 space-y-2 text-xs bg-muted/10 print:border-gray-400">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[10px] text-muted-foreground block uppercase">Queixa Principal:</span>
                          <p className="font-medium">{clinicalRecord?.chiefComplaint || "Lombalgia e tensão postural."}</p>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block uppercase">Escala de Dor Inicial (EVA):</span>
                          <p className="font-bold text-amber-600 print:text-black">
                            {clinicalRecord?.painScaleEva ?? 5} / 10 • Local: {clinicalRecord?.painLocation || "Lombar"}
                          </p>
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] text-muted-foreground block uppercase">História da Moléstia Atual:</span>
                        <p className="text-muted-foreground print:text-gray-800 text-[11px]">
                          {clinicalRecord?.hpi || "Quadro com início insidioso relacionado a posturas mantidas no trabalho."}
                        </p>
                      </div>

                      <div>
                        <span className="text-[10px] text-muted-foreground block uppercase">Metas Terapêuticas Estabelecidas:</span>
                        <p className="font-medium text-[11px]">{clinicalRecord?.clinicalGoals || "Estabilização segmentar vertebral e melhora da flexibilidade global."}</p>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-bold text-xs uppercase text-foreground mb-1.5 print:text-black">
                        Síntese das Últimas Evoluções (Padrão SOAP - COFFITO):
                      </h4>
                      <div className="space-y-2 text-[11px]">
                        {evolutions.slice(0, 3).map((evo, i) => (
                          <div key={evo.id || i} className="p-2 border border-border rounded bg-card print:border-gray-300">
                            <div className="flex justify-between font-semibold text-xs border-b border-border/50 pb-1 mb-1">
                              <span>Sessão {evo.date} • {evo.techniqueCategory || "Pilates Clínico"}</span>
                              <span>EVA pós: {evo.painScaleAfter ?? "N/A"}/10</span>
                            </div>
                            <p><strong>Objetivo:</strong> {evo.objective}</p>
                            <p><strong>Avaliação:</strong> {evo.assessment}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Data e Local */}
              <div className="pt-4 text-right text-xs">
                <p>São Paulo - SP, {todayExtended}.</p>
              </div>

              {/* Bloco de Assinaturas e Carimbo Profissional */}
              <div className="pt-6 border-t border-border grid grid-cols-2 gap-8 text-center text-xs">
                {/* Assinatura do Paciente (quando TCLE) ou Carimbo Auxiliar */}
                {selectedDocType === "tcle" ? (
                  <div>
                    <div className="border-b border-foreground/60 w-48 mx-auto h-10 mb-1"></div>
                    <p className="font-semibold text-foreground print:text-black">{patient?.name}</p>
                    <p className="text-[10px] text-muted-foreground print:text-gray-600">Assinatura do Paciente / Responsável</p>
                    <p className="text-[9px] text-muted-foreground font-mono">CPF: {patient?.documentCpf}</p>
                  </div>
                ) : (
                  <div className="text-left text-[10px] text-muted-foreground space-y-1 print:text-gray-600">
                    <p className="font-bold text-foreground print:text-black uppercase">Autenticidade e Rastreabilidade:</p>
                    <p>Documento emitido digitalmente pela plataforma clínica Altar Fisio.</p>
                    <p className="font-mono text-[9px]">Código Hash: {docHash}</p>
                  </div>
                )}

                {/* Assinatura do Fisioterapeuta com Carimbo e CREFITO */}
                <div>
                  <div className="border-b border-foreground/60 w-56 mx-auto h-10 mb-1 flex items-end justify-center pb-1">
                    <span className="font-serif italic text-sm text-primary/80 print:text-black font-semibold">
                      {activeProf.name}
                    </span>
                  </div>
                  <p className="font-bold text-foreground print:text-black">{activeProf.name}</p>
                  <p className="text-[10px] text-primary font-semibold print:text-black">{activeProf.crefito}</p>
                  <p className="text-[9px] text-muted-foreground print:text-gray-600">Fisioterapeuta Responsável • Altar Fisio</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé de Ações do Modal */}
        <div className="p-4 border-t border-border bg-card flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyText}
              className="text-xs h-9 gap-1.5"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? "Copiado para a área de transferência!" : "Copiar Texto"}</span>
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs h-9"
            >
              Fechar
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handlePrint}
              className="text-xs h-9 gap-2 shadow-sm font-semibold px-4"
            >
              <Printer className="h-4 w-4" />
              <span>Imprimir / Salvar em PDF</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
