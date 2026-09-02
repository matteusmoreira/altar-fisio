import React, { useState } from "react"
import {
  TrendingDown,
  TrendingUp,
  Minus,
  HeartPulse,
  Info,
  Calendar,
  UserCheck,
} from "lucide-react"
import type { PainDataPoint } from "@/types"

interface PainEvolutionChartProps {
  points: PainDataPoint[]
  initialPain?: number
  patientName?: string
}

export const PainEvolutionChart: React.FC<PainEvolutionChartProps> = ({
  points,
  initialPain = 5,
  patientName,
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<PainDataPoint | null>(null)
  const [hoveredPos, setHoveredPos] = useState<{ x: number; y: number } | null>(null)

  // Classificação semântica da dor na escala EVA (0 a 10)
  const getPainMeta = (val: number) => {
    if (val <= 2) {
      return {
        label: "Dor Leve / Conforto",
        color: "text-emerald-500",
        bg: "bg-emerald-500/10",
        border: "border-emerald-500/30",
        dotFill: "#10b981",
      }
    }
    if (val <= 5) {
      return {
        label: "Dor Moderada",
        color: "text-amber-500",
        bg: "bg-amber-500/10",
        border: "border-amber-500/30",
        dotFill: "#f59e0b",
      }
    }
    if (val <= 8) {
      return {
        label: "Dor Intensa",
        color: "text-orange-500",
        bg: "bg-orange-500/10",
        border: "border-orange-500/30",
        dotFill: "#f97316",
      }
    }
    return {
      label: "Dor Insuportável",
      color: "text-rose-600",
      bg: "bg-rose-600/10",
      border: "border-rose-600/30",
      dotFill: "#e11d48",
    }
  }

  // Métricas analíticas
  const baselinePain = points.length > 0 ? points[0].painLevel : initialPain
  const currentPain = points.length > 0 ? points[points.length - 1].painLevel : initialPain
  const painDiff = baselinePain - currentPain
  const percentImprovement = baselinePain > 0 ? Math.round((painDiff / baselinePain) * 100) : 0

  // Média recente (últimas 3 sessões ou disponíveis)
  const recentPoints = points.slice(-3)
  const recentAvg =
    recentPoints.length > 0
      ? (recentPoints.reduce((acc, p) => acc + p.painLevel, 0) / recentPoints.length).toFixed(1)
      : currentPain.toFixed(1)

  // Configurações do gráfico SVG
  const width = 760
  const height = 240
  const padLeft = 55
  const padRight = 45
  const padTop = 30
  const padBottom = 45

  const chartWidth = width - padLeft - padRight
  const chartHeight = height - padTop - padBottom

  // Mapeamento de coordenadas (EVA de 0 a 10, y=0 no topo)
  const getY = (pain: number) => {
    const clamped = Math.max(0, Math.min(10, pain))
    return padTop + chartHeight - (clamped / 10) * chartHeight
  }

  const getX = (index: number, total: number) => {
    if (total <= 1) return padLeft + chartWidth / 2
    return padLeft + (index / (total - 1)) * chartWidth
  }

  // Montagem da curva Bézier suave
  const coordinates = points.map((p, idx) => ({
    x: getX(idx, points.length),
    y: getY(p.painLevel),
    point: p,
  }))

  let pathD = ""
  let areaD = ""

  if (coordinates.length === 1) {
    const c = coordinates[0]
    pathD = `M ${c.x - 30} ${c.y} L ${c.x + 30} ${c.y}`
    areaD = `M ${c.x - 30} ${c.y} L ${c.x + 30} ${c.y} L ${c.x + 30} ${getY(0)} L ${c.x - 30} ${getY(0)} Z`
  } else if (coordinates.length > 1) {
    pathD = `M ${coordinates[0].x} ${coordinates[0].y}`
    for (let i = 0; i < coordinates.length - 1; i++) {
      const p0 = coordinates[i]
      const p1 = coordinates[i + 1]
      const mx = (p0.x + p1.x) / 2
      pathD += ` C ${mx} ${p0.y}, ${mx} ${p1.y}, ${p1.x} ${p1.y}`
    }

    const first = coordinates[0]
    const last = coordinates[coordinates.length - 1]
    const zeroY = getY(0)
    areaD = `${pathD} L ${last.x} ${zeroY} L ${first.x} ${zeroY} Z`
  }

  return (
    <div className="space-y-4">
      {/* Cards de Métricas Clínicas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl border border-border bg-card/60 shadow-2xs">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
            Dor Inicial (Anamnese)
          </span>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-2xl font-bold text-foreground">EVA {baselinePain}</span>
            <span className="text-xs text-muted-foreground">/ 10</span>
          </div>
          <span className="text-[10px] text-muted-foreground">Ponto de partida do tratamento</span>
        </div>

        <div className="p-3.5 rounded-xl border border-border bg-card/60 shadow-2xs">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
            Dor Atual (Última Sessão)
          </span>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-2xl font-bold text-primary">EVA {currentPain}</span>
            <span className="text-xs text-muted-foreground">/ 10</span>
          </div>
          <span className={`text-[10px] font-semibold ${getPainMeta(currentPain).color}`}>
            {getPainMeta(currentPain).label}
          </span>
        </div>

        <div className="p-3.5 rounded-xl border border-border bg-card/60 shadow-2xs">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
            Redução da Dor
          </span>
          <div className="flex items-center gap-1.5 mt-1.5">
            {percentImprovement > 0 ? (
              <>
                <TrendingDown className="h-5 w-5 text-emerald-500" />
                <span className="text-2xl font-bold text-emerald-500">-{percentImprovement}%</span>
              </>
            ) : percentImprovement < 0 ? (
              <>
                <TrendingUp className="h-5 w-5 text-rose-500" />
                <span className="text-2xl font-bold text-rose-500">+{Math.abs(percentImprovement)}%</span>
              </>
            ) : (
              <>
                <Minus className="h-5 w-5 text-muted-foreground" />
                <span className="text-2xl font-bold text-muted-foreground">0%</span>
              </>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground">
            {percentImprovement > 0 ? "Evolução clínica favorável" : "Quadro estável"}
          </span>
        </div>

        <div className="p-3.5 rounded-xl border border-border bg-card/60 shadow-2xs">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
            Média Recente (EVA)
          </span>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-2xl font-bold text-foreground">{recentAvg}</span>
            <span className="text-xs text-muted-foreground">/ 10</span>
          </div>
          <span className="text-[10px] text-muted-foreground">
            Baseado em {recentPoints.length} registro(s)
          </span>
        </div>
      </div>

      {/* Gráfico SVG Vetorial */}
      <div className="relative rounded-2xl border border-border bg-card p-4 shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3 px-1">
          <div>
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <HeartPulse className="h-4 w-4 text-primary" />
              <span>Linha do Tempo da Escala Analógica Visual (EVA)</span>
            </h4>
            <p className="text-[11px] text-muted-foreground">
              Acompanhamento de regressão da dor sessão a sessão {patientName ? `para ${patientName}` : ""}.
            </p>
          </div>

          <div className="flex items-center gap-3 text-[10px] font-medium text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> 0-2 Leve
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> 3-5 Moderada
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-orange-500" /> 6-8 Intensa
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-600" /> 9-10 Insuportável
            </span>
          </div>
        </div>

        {points.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground flex flex-col items-center">
            <Info className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="font-semibold text-foreground">Sem registros de dor pós-sessão</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Cadastre a primeira evolução SOAP com a nota EVA para iniciar o monitoramento gráfico.
            </p>
          </div>
        ) : (
          <div className="relative w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-auto min-w-[580px] select-none"
            >
              <defs>
                <linearGradient id="painAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary, #0d9488)" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="var(--color-primary, #0d9488)" stopOpacity="0.01" />
                </linearGradient>
              </defs>

              {/* Linhas de referência horizontais da Escala EVA */}
              {[10, 8, 5, 2, 0].map((val) => {
                const y = getY(val)
                return (
                  <g key={val}>
                    <line
                      x1={padLeft}
                      y1={y}
                      x2={width - padRight}
                      y2={y}
                      stroke="currentColor"
                      strokeOpacity="0.12"
                      strokeDasharray={val === 0 ? "none" : "3,3"}
                      strokeWidth={val === 0 ? "1.5" : "1"}
                    />
                    <text
                      x={padLeft - 10}
                      y={y + 3.5}
                      textAnchor="end"
                      className="fill-muted-foreground text-[10px] font-mono"
                    >
                      {val}
                    </text>
                  </g>
                )
              })}

              {/* Área com Gradiente */}
              {areaD && <path d={areaD} fill="url(#painAreaGrad)" />}

              {/* Linha Curva da Dor */}
              {pathD && (
                <path
                  d={pathD}
                  fill="none"
                  stroke="var(--color-primary, #0d9488)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Pontos de Cada Sessão */}
              {coordinates.map((c, i) => {
                const meta = getPainMeta(c.point.painLevel)
                const isHovered = hoveredPoint === c.point
                return (
                  <g
                    key={i}
                    className="cursor-pointer transition-transform duration-150"
                    onMouseEnter={() => {
                      setHoveredPoint(c.point)
                      setHoveredPos({ x: c.x, y: c.y })
                    }}
                    onMouseLeave={() => {
                      setHoveredPoint(null)
                      setHoveredPos(null)
                    }}
                  >
                    {/* Anel de destaque no hover */}
                    {isHovered && (
                      <circle
                        cx={c.x}
                        cy={c.y}
                        r="12"
                        fill={meta.dotFill}
                        fillOpacity="0.2"
                        className="animate-pulse"
                      />
                    )}

                    {/* Ponto principal */}
                    <circle
                      cx={c.x}
                      cy={c.y}
                      r={isHovered ? "6.5" : "5"}
                      fill={meta.dotFill}
                      stroke="var(--color-card, #ffffff)"
                      strokeWidth="2.5"
                    />

                    {/* Rótulo da data abaixo do eixo X */}
                    <text
                      x={c.x}
                      y={height - 15}
                      textAnchor="middle"
                      className="fill-muted-foreground text-[9.5px] font-mono"
                    >
                      {c.point.date.slice(5)}
                    </text>

                    {/* Número EVA sobre o ponto */}
                    <text
                      x={c.x}
                      y={c.y - 10}
                      textAnchor="middle"
                      className="fill-foreground text-[10px] font-bold"
                    >
                      {c.point.painLevel}
                    </text>
                  </g>
                )
              })}
            </svg>

            {/* Tooltip Flutuante Interativo */}
            {hoveredPoint && hoveredPos && (
              <div
                className="absolute z-20 pointer-events-none p-3 rounded-xl bg-popover/95 text-popover-foreground border border-border shadow-xl backdrop-blur-md text-xs space-y-1 max-w-[240px] animate-fade-in"
                style={{
                  left: `${(hoveredPos.x / width) * 100}%`,
                  top: `${Math.max(10, (hoveredPos.y / height) * 100 - 35)}%`,
                  transform: "translate(-50%, -100%)",
                }}
              >
                <div className="flex items-center justify-between gap-2 border-b border-border pb-1">
                  <span className="font-bold text-foreground text-[11px]">
                    {hoveredPoint.sessionLabel}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold border ${getPainMeta(hoveredPoint.painLevel).bg} ${getPainMeta(hoveredPoint.painLevel).color} ${getPainMeta(hoveredPoint.painLevel).border}`}
                  >
                    EVA {hoveredPoint.painLevel}/10
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-primary" />
                  <span>Data: {hoveredPoint.date}</span>
                </div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <UserCheck className="h-3 w-3 text-primary" />
                  <span>Prof.: {hoveredPoint.professionalName}</span>
                </div>
                {hoveredPoint.technique && (
                  <div className="text-[10px] text-primary font-semibold pt-0.5">
                    Mod.: {hoveredPoint.technique}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
