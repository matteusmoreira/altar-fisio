import React from "react"

export interface DrMarceloSignatureProps {
  signatureImageUrl?: string
  showStamp?: boolean
  signatureLabel?: string
  professionalName?: string
  crefito?: string
  address?: string
  className?: string
  compact?: boolean
}

export const DrMarceloSignature: React.FC<DrMarceloSignatureProps> = ({
  signatureImageUrl,
  showStamp = true,
  signatureLabel,
  professionalName = "Dr. Marcelo S. Santos",
  crefito = "Crefito 2: 40008-F",
  address = "Rodovia Amaral Peixoto, nº 4473, Sala 302, Centro, Rio das Ostras",
  className = "",
  compact = false,
}) => {
  return (
    <div className={`flex flex-col items-center justify-center text-center select-none ${className}`}>
      {/* Área da Rubrica / Assinatura em Caneta Azul */}
      <div className="relative h-16 sm:h-20 w-56 flex items-center justify-center -mb-2">
        {signatureImageUrl ? (
          <img
            src={signatureImageUrl}
            alt={`Assinatura ${professionalName}`}
            className="max-h-full max-w-full object-contain filter contrast-125"
          />
        ) : (
          <div className="relative w-full h-full flex items-center justify-center">
            {/* Rubrica Vetorial Estilizada em Azul Tinteiro */}
            <svg
              viewBox="0 0 240 70"
              className="w-full h-full text-[#1e3a8a] drop-shadow-xs transform -rotate-1"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Traçado cursivo do Dr. Marcelo com laçada e cauda fluida */}
              <path
                d="M 25 45 C 28 32, 34 18, 42 16 C 50 14, 45 42, 38 52 C 34 57, 28 54, 30 46 C 33 34, 48 30, 58 35 C 64 38, 62 48, 56 50 C 50 52, 47 45, 52 38 C 58 30, 68 28, 76 34 C 84 40, 78 52, 85 52 C 92 52, 98 40, 105 38 C 112 36, 116 48, 124 46 C 132 44, 138 32, 148 30 C 158 28, 152 48, 162 44 C 172 40, 185 24, 198 22 C 210 20, 202 46, 218 42"
                stroke="#1d4ed8"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.95"
              />
              {/* Laço superior característico e sublinhado de fechamento */}
              <path
                d="M 38 18 C 55 12, 110 8, 160 14 C 185 17, 215 25, 230 35"
                stroke="#2563eb"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeDasharray="200"
                strokeDashoffset="0"
                opacity="0.75"
              />
              <path
                d="M 20 54 C 65 52, 140 50, 225 48"
                stroke="#1e40af"
                strokeWidth="1.8"
                strokeLinecap="round"
                opacity="0.85"
              />
            </svg>
            {/* Tipografia de apoio da assinatura cursiva */}
            <span
              className="absolute text-[15px] sm:text-[17px] tracking-wide text-[#1e3a8a] font-serif italic font-semibold opacity-90 pointer-events-none"
              style={{
                fontFamily: "'Dancing Script', 'Caveat', 'Brush Script MT', 'Great Vibes', cursive",
                textShadow: "0 0 1px rgba(30, 58, 138, 0.4)",
              }}
            >
              Marcelo S. Santos
            </span>
          </div>
        )}
      </div>

      {/* Linha de Assinatura */}
      <div className="w-56 sm:w-64 border-t border-gray-800 dark:border-gray-300 mt-1 mb-1.5" />

      {/* Rótulo de assinatura (ex: "Assinatura do Fisioterapeuta" ou "Assinatura e Carimbo") */}
      {signatureLabel && (
        <p className="text-[10.5px] sm:text-[11px] font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
          {signatureLabel}
        </p>
      )}

      {/* Carimbo Oficial do Fisioterapeuta */}
      {showStamp ? (
        <div className="space-y-0.5 text-gray-900 dark:text-gray-100">
          <p className="text-[12px] sm:text-[13px] font-bold tracking-tight text-gray-950 dark:text-white">
            {professionalName}
          </p>
          <p className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 tracking-wide uppercase">
            {crefito}
          </p>
          {!compact && address && (
            <p className="text-[9.5px] sm:text-[10px] text-gray-600 dark:text-gray-400 max-w-[280px] leading-tight mt-0.5">
              {address}
            </p>
          )}
        </div>
      ) : (
        <p className="text-[11px] font-medium text-gray-600 dark:text-gray-400">
          Assinatura do Fisioterapeuta
        </p>
      )}
    </div>
  )
}
