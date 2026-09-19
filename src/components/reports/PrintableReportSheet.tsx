import React from "react"
import { DrMarceloSignature } from "./DrMarceloSignature"
import type { ReportTemplateDef } from "./reportTemplates"

export interface PrintableReportSheetProps {
  id?: string
  template: ReportTemplateDef
  patientName: string
  cidCode?: string
  dateStr: string // DD/MM/AAAA
  sessionDateStr?: string // DD/MM/AAAA (para comparecimento)
  startTime?: string
  endTime?: string
  bodyText: string
  paperSize?: "a4" | "a5"
  showWatermark?: boolean
  signatureImageUrl?: string
  clinicLogoUrl?: string
  clinicName?: string
  clinicSubtitle?: string
  professionalName?: string
  crefito?: string
  phone1?: string
  phone2?: string
  addressLine1?: string
  addressLine2?: string
  isDraftPreview?: boolean
}

export const PrintableReportSheet: React.FC<PrintableReportSheetProps> = ({
  id = "printable-report-sheet",
  template,
  patientName,
  cidCode = "",
  dateStr,
  sessionDateStr,
  startTime = "08:00",
  endTime = "09:00",
  bodyText,
  paperSize = "a4",
  showWatermark = true,
  signatureImageUrl,
  clinicLogoUrl,
  clinicName = "Clinica Dr Marcelo",
  clinicSubtitle = "Fisioterapia, Studio de Pilates & RPG",
  professionalName = "Dr. Marcelo S. Santos",
  crefito = "Crefito 2: 40008-F",
  phone1 = "(22) 9 9999-1417",
  phone2 = "(22) 2764-2491",
  addressLine1 = "Rodovia Amaral Peixoto, nº 4473 - 3º andar, sala 302",
  addressLine2 = "Edifício Comercial Porto Florido II - Centro, Rio das Ostras - RJ",
  isDraftPreview = false,
}) => {
  const isDeclaration = template.category === "declaracao"
  const isA5 = paperSize === "a5"

  // Processamento do texto com substituição de variáveis se houver
  const formattedBody = bodyText
    .replace(/{PACIENTE}/g, patientName.trim() || "_________________________________")
    .replace(/{DATA_SESSAO}/g, sessionDateStr || dateStr || "__/__/____")
    .replace(/{HORA_INICIO}/g, startTime || "__:__")
    .replace(/{HORA_FIM}/g, endTime || "__:__")

  return (
    <div
      id={id}
      className={`relative mx-auto bg-white text-gray-900 overflow-hidden shadow-md print:shadow-none print:m-0 print:border-none transition-all duration-200 box-border ${
        isA5
          ? "w-full max-w-[148mm] min-h-[200mm] sm:min-h-[210mm] p-6 sm:p-8 text-[12px] leading-relaxed"
          : "w-full max-w-[210mm] min-h-[280mm] sm:min-h-[297mm] p-8 sm:p-12 text-[14px] sm:text-[15px] leading-loose"
      }`}
      style={{
        fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      {/* Moldura da Folha (fiel aos blocos de papel da clínica) */}
      {isDeclaration ? (
        <div className="absolute inset-3 sm:inset-4 border-[2px] sm:border-[2.5px] border-gray-900 rounded-3xl pointer-events-none p-1">
          <div className="w-full h-full border border-gray-700/60 rounded-2xl" />
        </div>
      ) : (
        <div className="absolute inset-3 sm:inset-4 border-[1.5px] sm:border-2 border-gray-900 pointer-events-none" />
      )}

      {/* Marca d'Água Circular Translúcida Centralizada (idêntica ao bloco físico) */}
      {showWatermark && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0"
          style={{ opacity: 0.085 }}
        >
          <div className="w-80 h-80 sm:w-96 sm:h-96 rounded-full border-4 border-gray-900 flex flex-col items-center justify-center p-6 text-center transform -rotate-6">
            <span className="text-xs sm:text-sm font-black uppercase tracking-widest text-gray-900">
              Clínica de Fisioterapia
            </span>
            <span className="text-xs sm:text-sm font-semibold tracking-wider text-gray-800 uppercase mt-0.5">
              & Ortopedia
            </span>
            <span
              className="text-2xl sm:text-3xl font-bold my-1 text-gray-950 font-serif italic"
              style={{
                fontFamily: "'Dancing Script', 'Brush Script MT', 'Caveat', cursive",
              }}
            >
              Dr. Marcelo
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs sm:text-sm font-black tracking-widest uppercase text-gray-900">
                RPG
              </span>
              <svg
                className="w-6 h-6 text-gray-900 inline-block"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 2v20M8 7a4 4 0 0 1 8 0c0 3-8 3-8 6a4 4 0 0 0 8 0" />
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo Principal do Documento (z-10 para ficar sobre a marca d'água) */}
      <div className="relative z-10 flex flex-col justify-between h-full min-h-inherit space-y-6 sm:space-y-8">
        {/* ========================================================================= */}
        {/* CABEÇALHO DO DOCUMENTO                                                    */}
        {/* ========================================================================= */}
        <div>
          {isDeclaration ? (
            /* Cabeçalho centralizado da Declaração de Comparecimento */
            <div className="flex flex-col items-center text-center space-y-2 pt-2 sm:pt-4">
              {clinicLogoUrl ? (
                <img
                  src={clinicLogoUrl}
                  alt={clinicName}
                  className="h-14 sm:h-16 w-auto object-contain mb-1"
                />
              ) : (
                /* Emblema circular idêntico ao topo da foto física da Declaração */
                <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-full bg-gray-950 text-white flex flex-col items-center justify-center p-1.5 shadow-xs mb-1">
                  <span className="text-[7.5px] uppercase font-bold tracking-tight text-gray-200">
                    Clínica de Fisioterapia
                  </span>
                  <span className="text-[6.5px] uppercase font-semibold text-gray-400">
                    RPG & PILATES
                  </span>
                  <span
                    className="text-[13px] font-bold text-white font-serif italic leading-none my-0.5"
                    style={{ fontFamily: "'Dancing Script', 'Brush Script MT', cursive" }}
                  >
                    Dr. Marcelo
                  </span>
                  <svg className="w-3.5 h-3.5 text-gray-300" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z" />
                  </svg>
                </div>
              )}
              <h1 className="text-base sm:text-lg font-black tracking-wider uppercase text-gray-900">
                CLÍNICA DE FISIOTERAPIA
              </h1>
              <h2 className="text-sm sm:text-base font-semibold text-gray-800 border-b border-gray-400 pb-1 px-4">
                Declaração de Comparecimento
              </h2>
            </div>
          ) : (
            /* Cabeçalho do Laudo centralizado conforme fotos originais */
            <div className="relative pt-2 sm:pt-3">
              <div className="flex flex-col items-center justify-center text-center">
                <h1 className="text-2xl sm:text-3xl font-black tracking-[0.25em] uppercase text-gray-950 underline decoration-2 underline-offset-8">
                  {template.title}
                </h1>
                {clinicSubtitle && (
                  <span className="text-[11px] sm:text-xs font-medium text-gray-600 mt-2">
                    {clinicSubtitle}
                  </span>
                )}
              </div>
              {clinicLogoUrl && (
                <div className="absolute top-0 right-0 h-10 sm:h-12 flex items-center justify-end">
                  <img
                    src={clinicLogoUrl}
                    alt={clinicName}
                    className="max-h-full w-auto object-contain"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* CORPO DO DOCUMENTO                                                        */}
        {/* ========================================================================= */}
        <div className="flex-1 flex flex-col justify-center space-y-6 sm:space-y-8 my-auto py-4">
          {!isDeclaration && (
            /* Linha do Paciente no Laudo */
            <div className="flex items-baseline gap-2 pt-2">
              <span className="font-extrabold text-sm sm:text-base tracking-wide text-gray-950 uppercase shrink-0">
                SR(A):
              </span>
              <div className="flex-1 border-b-2 border-gray-700 pb-0.5 min-h-[24px]">
                <span className="font-bold text-base sm:text-lg text-gray-950 tracking-wide">
                  {patientName.trim() || (isDraftPreview ? "________________________________________________" : "")}
                </span>
              </div>
            </div>
          )}

          {/* Parágrafo Principal do Laudo ou Declaração */}
          <div className="text-justify text-gray-900 leading-relaxed sm:leading-loose">
            <p className="text-[14px] sm:text-[16px] font-normal indent-6 sm:indent-8 leading-relaxed sm:leading-loose">
              {formattedBody}
            </p>
          </div>

          {/* Metadados: CID e Data do Laudo */}
          {!isDeclaration && (
            <div className="flex items-center justify-between gap-4 pt-4 border-t border-gray-200">
              <div className="flex items-baseline gap-2">
                <span className="font-bold text-xs sm:text-sm text-gray-950 uppercase">
                  CID:
                </span>
                <span className="font-mono font-semibold text-xs sm:text-sm text-gray-800 border-b border-gray-500 min-w-[120px] pb-0.5">
                  {cidCode || "Não especificado"}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-bold text-xs sm:text-sm text-gray-950 uppercase">
                  Data:
                </span>
                <span className="font-semibold text-xs sm:text-sm text-gray-800 border-b border-gray-500 min-w-[120px] text-center pb-0.5">
                  {dateStr || "____/____/________"}
                </span>
              </div>
            </div>
          )}

          {/* Data na Declaração de Comparecimento */}
          {isDeclaration && (
            <div className="flex justify-end pt-2">
              <div className="text-right">
                <span className="text-xs sm:text-sm font-semibold text-gray-800">
                  Data: <span className="font-bold">{dateStr}</span>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* RODAPÉ DO DOCUMENTO: ASSINATURA, CARIMBO E CONTATOS                       */}
        {/* ========================================================================= */}
        <div className="pt-4 border-t border-gray-300">
          <div className="flex flex-col items-center justify-center space-y-3">
            {/* Assinatura em azul caneta e carimbo oficial do Dr. Marcelo */}
            <DrMarceloSignature
              signatureImageUrl={signatureImageUrl}
              professionalName={professionalName}
              crefito={crefito}
              address={addressLine1}
              showStamp={true}
              signatureLabel={isDeclaration ? "Assinatura e Carimbo" : "Assinatura do Fisioterapeuta"}
              compact={isA5}
            />

            {/* Informações de Contato e Endereço Oficial (fiel à foto da clínica) */}
            <div className="text-center pt-2 space-y-0.5 text-gray-600 text-[10px] sm:text-[11px] leading-tight max-w-lg mx-auto">
              <div className="flex items-center justify-center gap-3 font-semibold text-gray-800">
                <span>{phone1}</span>
                <span>•</span>
                <span>{phone2}</span>
              </div>
              <p>{addressLine1}</p>
              {addressLine2 && <p>{addressLine2}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
