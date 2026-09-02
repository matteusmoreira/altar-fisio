import React, { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Grid,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sliders,
  Columns,
  Maximize2,
  Minimize2,
  CheckCircle2,
  Download,
  Info,
  Eye,
  Crosshair,
} from "lucide-react"
import type { PosturalViewType } from "@/types"

interface BiofotogrametriaModalProps {
  isOpen: boolean
  onClose: () => void
  patientName: string
  photos: {
    anterior?: string
    posterior?: string
    lateralRight?: string
    lateralLeft?: string
  }
  initialView?: PosturalViewType
  onSaveNotes?: (notes: string) => void
  initialNotes?: string
}

export const BiofotogrametriaModal: React.FC<BiofotogrametriaModalProps> = ({
  isOpen,
  onClose,
  patientName,
  photos,
  initialView = "anterior",
  onSaveNotes,
  initialNotes = "",
}) => {
  const [currentView, setCurrentView] = useState<PosturalViewType>(initialView)
  const [showGrid, setShowGrid] = useState(true)
  const [showPlumbLine, setShowPlumbLine] = useState(true)
  const [gridSize, setGridSize] = useState<"compact" | "medium" | "large">("medium")
  const [zoom, setZoom] = useState(1)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isCompareMode, setIsCompareMode] = useState(false)
  const [compareSecondaryView, setCompareSecondaryView] = useState<PosturalViewType>("posterior")

  // Réguas horizontais de nível anatômico (porcentagem de altura do topo: 0 a 100)
  const [guides, setGuides] = useState<{
    shoulders: { active: boolean; pos: number; label: string }
    scapulae: { active: boolean; pos: number; label: string }
    pelvis: { active: boolean; pos: number; label: string }
    knees: { active: boolean; pos: number; label: string }
  }>({
    shoulders: { active: true, pos: 22, label: "Nível dos Ombros (Acrômios)" },
    scapulae: { active: false, pos: 34, label: "Ângulo Inferior das Escápulas" },
    pelvis: { active: true, pos: 48, label: "Cristas Ilíacas / EIAS" },
    knees: { active: true, pos: 72, label: "Interlinha Articular dos Joelhos" },
  })

  const [notes, setNotes] = useState(initialNotes)
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  const commonTags = [
    "Hiperlordose Lombar",
    "Cifose Torácica Acentuada",
    "Ombro D Mais Alto",
    "Ombro E Mais Alto",
    "Antepulsão Pélvica",
    "Retropulsão Pélvica",
    "Joelho Valgo",
    "Joelho Varo",
    "Genu Recurvatum",
    "Pé Pronado Bilateral",
    "Escoliose em C",
    "Escoliose em S",
  ]

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag))
    } else {
      setSelectedTags([...selectedTags, tag])
      if (!notes.includes(tag)) {
        setNotes((prev) => (prev ? `${prev}; ${tag}` : tag))
      }
    }
  }

  const getViewUrl = (view: PosturalViewType): string | undefined => {
    switch (view) {
      case "anterior":
        return photos.anterior
      case "posterior":
        return photos.posterior
      case "lateral_right":
        return photos.lateralRight
      case "lateral_left":
        return photos.lateralLeft
    }
  }

  const getViewTitle = (view: PosturalViewType): string => {
    switch (view) {
      case "anterior":
        return "Vista Anterior (Frontal)"
      case "posterior":
        return "Vista Posterior (Dorsal)"
      case "lateral_right":
        return "Perfil Direito (Lateral D)"
      case "lateral_left":
        return "Perfil Esquerdo (Lateral E)"
    }
  }

  const gridStep = gridSize === "compact" ? 20 : gridSize === "medium" ? 35 : 50

  const activePhotoUrl = getViewUrl(currentView)
  const secondaryPhotoUrl = getViewUrl(compareSecondaryView)

  const handleZoom = (delta: number) => {
    setZoom((prev) => Math.max(0.7, Math.min(2.5, +(prev + delta).toFixed(1))))
  }

  const resetControls = () => {
    setZoom(1)
    setShowGrid(true)
    setShowPlumbLine(true)
    setGuides({
      shoulders: { active: true, pos: 22, label: "Nível dos Ombros (Acrômios)" },
      scapulae: { active: false, pos: 34, label: "Ângulo Inferior das Escápulas" },
      pelvis: { active: true, pos: 48, label: "Cristas Ilíacas / EIAS" },
      knees: { active: true, pos: 72, label: "Interlinha Articular dos Joelhos" },
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={`transition-all duration-200 ${
          isFullscreen
            ? "max-w-[98vw] h-[96vh] p-4 flex flex-col"
            : "max-w-5xl max-h-[90vh] p-4 sm:p-6 flex flex-col"
        }`}
      >
        {/* Header com Navegação de Vistas */}
        <DialogHeader className="border-b border-border pb-3 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                <Crosshair className="h-5 w-5 text-primary" />
                <span>Biofotogrametria Computorizada & Simetria Postural</span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Paciente: <strong className="text-foreground">{patientName}</strong> • Avaliação com
                grade milimetrada e eixos de prumo axial.
              </DialogDescription>
            </div>

            {/* Seletor de Vistas */}
            <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-xl border border-border">
              {(
                [
                  { id: "anterior", label: "Anterior" },
                  { id: "posterior", label: "Posterior" },
                  { id: "lateral_right", label: "Perfil D" },
                  { id: "lateral_left", label: "Perfil E" },
                ] as const
              ).map((v) => (
                <button
                  key={v.id}
                  onClick={() => setCurrentView(v.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    currentView === v.id
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {v.label}
                  {getViewUrl(v.id) && (
                    <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </DialogHeader>

        {/* Barra de Ferramentas de Calibração */}
        <div className="py-2 flex flex-wrap items-center justify-between gap-2 border-b border-border text-xs shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Grade On/Off */}
            <Button
              variant={showGrid ? "default" : "outline"}
              size="sm"
              onClick={() => setShowGrid(!showGrid)}
              className="h-8 gap-1.5 text-xs"
            >
              <Grid className="h-3.5 w-3.5" />
              <span>Grade Quadriculada</span>
            </Button>

            {/* Fio de Prumo On/Off */}
            <Button
              variant={showPlumbLine ? "default" : "outline"}
              size="sm"
              onClick={() => setShowPlumbLine(!showPlumbLine)}
              className="h-8 gap-1.5 text-xs"
            >
              <Crosshair className="h-3.5 w-3.5" />
              <span>Fio de Prumo Central</span>
            </Button>

            {/* Comparativo Lado a Lado */}
            <Button
              variant={isCompareMode ? "secondary" : "outline"}
              size="sm"
              onClick={() => setIsCompareMode(!isCompareMode)}
              className="h-8 gap-1.5 text-xs"
            >
              <Columns className="h-3.5 w-3.5" />
              <span>Comparar 2 Vistas</span>
            </Button>

            {isCompareMode && (
              <select
                value={compareSecondaryView}
                onChange={(e) => setCompareSecondaryView(e.target.value as PosturalViewType)}
                className="h-8 rounded-lg border border-input bg-card px-2 text-xs font-medium"
              >
                <option value="anterior">vs. Anterior</option>
                <option value="posterior">vs. Posterior</option>
                <option value="lateral_right">vs. Perfil D</option>
                <option value="lateral_left">vs. Perfil E</option>
              </select>
            )}
          </div>

          {/* Zoom & Resets */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleZoom(-0.1)}
              disabled={zoom <= 0.7}
              className="h-8 w-8 p-0"
              title="Diminuir Zoom"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <span className="text-[11px] font-mono px-2 text-muted-foreground w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleZoom(0.1)}
              disabled={zoom >= 2.5}
              className="h-8 w-8 p-0"
              title="Aumentar Zoom"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={resetControls}
              className="h-8 w-8 p-0"
              title="Resetar visualização"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="h-8 w-8 p-0"
              title={isFullscreen ? "Janela Normal" : "Maximizar"}
            >
              {isFullscreen ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>

        {/* Área Central de Visualização Fotográfica */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-4 gap-4 py-3 min-h-0">
          {/* Painel do Espelho Biofotogramétrico */}
          <div
            className={`${
              isCompareMode ? "lg:col-span-3" : "lg:col-span-3"
            } rounded-2xl border border-border bg-black/90 relative overflow-hidden flex items-center justify-center select-none shadow-inner`}
          >
            {isCompareMode ? (
              /* Modo Comparativo Lado a Lado */
              <div className="grid grid-cols-2 w-full h-full divide-x divide-white/20">
                {/* Imagem Principal */}
                <div className="relative w-full h-full flex flex-col items-center justify-center p-2 overflow-hidden">
                  <span className="absolute top-2 left-2 z-30 px-2 py-0.5 rounded-md bg-black/70 text-white text-[10px] font-bold border border-white/20 backdrop-blur-xs">
                    {getViewTitle(currentView)}
                  </span>
                  {activePhotoUrl ? (
                    <div
                      className="relative max-h-full max-w-full flex items-center justify-center transition-transform duration-100"
                      style={{ transform: `scale(${zoom})` }}
                    >
                      <img
                        src={activePhotoUrl}
                        alt={getViewTitle(currentView)}
                        className="max-h-[62vh] w-auto object-contain rounded-lg"
                      />
                      {renderOverlays(showGrid, showPlumbLine, gridStep, guides)}
                    </div>
                  ) : (
                    renderEmptyPhotoNotice(getViewTitle(currentView))
                  )}
                </div>

                {/* Imagem Secundária */}
                <div className="relative w-full h-full flex flex-col items-center justify-center p-2 overflow-hidden">
                  <span className="absolute top-2 left-2 z-30 px-2 py-0.5 rounded-md bg-black/70 text-white text-[10px] font-bold border border-white/20 backdrop-blur-xs">
                    {getViewTitle(compareSecondaryView)}
                  </span>
                  {secondaryPhotoUrl ? (
                    <div
                      className="relative max-h-full max-w-full flex items-center justify-center transition-transform duration-100"
                      style={{ transform: `scale(${zoom})` }}
                    >
                      <img
                        src={secondaryPhotoUrl}
                        alt={getViewTitle(compareSecondaryView)}
                        className="max-h-[62vh] w-auto object-contain rounded-lg"
                      />
                      {renderOverlays(showGrid, showPlumbLine, gridStep, guides)}
                    </div>
                  ) : (
                    renderEmptyPhotoNotice(getViewTitle(compareSecondaryView))
                  )}
                </div>
              </div>
            ) : (
              /* Modo Normal / Única Vista */
              <div className="relative w-full h-full flex items-center justify-center p-4 overflow-hidden">
                <span className="absolute top-3 left-3 z-30 px-2.5 py-1 rounded-md bg-black/80 text-white text-xs font-bold border border-white/25 backdrop-blur-xs">
                  {getViewTitle(currentView)}
                </span>

                {activePhotoUrl ? (
                  <div
                    className="relative max-h-full max-w-full flex items-center justify-center transition-transform duration-100"
                    style={{ transform: `scale(${zoom})` }}
                  >
                    <img
                      src={activePhotoUrl}
                      alt={getViewTitle(currentView)}
                      className="max-h-[68vh] w-auto object-contain rounded-lg shadow-2xl"
                    />
                    {renderOverlays(showGrid, showPlumbLine, gridStep, guides)}
                  </div>
                ) : (
                  renderEmptyPhotoNotice(getViewTitle(currentView))
                )}
              </div>
            )}
          </div>

          {/* Painel Lateral: Réguas Anatômicas & Notas Biomecânicas */}
          <div className="lg:col-span-1 flex flex-col justify-between gap-3 overflow-y-auto pr-1 text-xs">
            {/* Réguas Anatômicas Horizontais */}
            <div className="p-3 rounded-xl border border-border bg-card/60 space-y-2.5">
              <span className="font-bold text-foreground text-[11px] uppercase tracking-wider block flex items-center gap-1.5">
                <Sliders className="h-3.5 w-3.5 text-primary" />
                <span>Réguas de Nivelamento</span>
              </span>

              <div className="space-y-2">
                {Object.entries(guides).map(([key, guide]) => (
                  <div key={key} className="space-y-1 bg-muted/40 p-2 rounded-lg border border-border/50">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-semibold text-foreground flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={guide.active}
                          onChange={(e) =>
                            setGuides((prev: any) => ({
                              ...prev,
                              [key]: { ...prev[key], active: e.target.checked },
                            }))
                          }
                          className="accent-primary h-3.5 w-3.5 rounded"
                        />
                        <span>{guide.label}</span>
                      </label>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {guide.pos}%
                      </span>
                    </div>

                    {guide.active && (
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={guide.pos}
                        onChange={(e) =>
                          setGuides((prev: any) => ({
                            ...prev,
                            [key]: { ...prev[key], pos: Number(e.target.value) },
                          }))
                        }
                        className="w-full accent-primary h-1.5 cursor-pointer"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Tags Rápidas de Desvios Posturais */}
            <div className="p-3 rounded-xl border border-border bg-card/60 space-y-2">
              <span className="font-bold text-foreground text-[11px] uppercase tracking-wider block">
                Achados Clínicos Frequentes
              </span>
              <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto">
                {commonTags.map((tag) => {
                  const isSelected = selectedTags.includes(tag)
                  return (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`text-[10px] px-2 py-0.5 rounded-md border font-medium transition-colors ${
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                      }`}
                    >
                      {tag}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Síntese Biomecânica da Avaliação */}
            <div className="space-y-1.5">
              <label className="font-bold text-foreground text-[11px] uppercase tracking-wider block">
                Conclusão & Diagnóstico Fisioterapêutico
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Escoliose estruturada torácica com convexidade à direita; assimetria de triângulo de tales e rotação de vértebras..."
                className="w-full rounded-xl border border-input bg-card p-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <Button
              onClick={() => {
                if (onSaveNotes) onSaveNotes(notes)
                onClose()
              }}
              className="gap-2 w-full font-semibold shadow-xs"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Salvar Laudo e Concluir</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function renderEmptyPhotoNotice(title: string) {
  return (
    <div className="text-center p-8 text-white/60 space-y-2">
      <Info className="h-8 w-8 mx-auto text-white/40" />
      <p className="font-semibold text-white/80">Foto da {title} não cadastrada</p>
      <p className="text-[11px] text-white/50 max-w-xs mx-auto">
        Faça o upload da foto correspondente na ficha do paciente para habilitar a análise fotogramétrica.
      </p>
    </div>
  )
}

function renderOverlays(
  showGrid: boolean,
  showPlumbLine: boolean,
  gridStep: number,
  guides: any
) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-lg">
      {/* Grade Quadriculada SVG */}
      {showGrid && (
        <svg className="absolute inset-0 w-full h-full opacity-40">
          <defs>
            <pattern id="posturalGrid" width={gridStep} height={gridStep} patternUnits="userSpaceOnUse">
              <path
                d={`M ${gridStep} 0 L 0 0 0 ${gridStep}`}
                fill="none"
                stroke="#06b6d4"
                strokeWidth="0.75"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#posturalGrid)" />
        </svg>
      )}

      {/* Fio de Prumo Central Axial (Linha Vermelha com Mira) */}
      {showPlumbLine && (
        <>
          <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)] -translate-x-1/2 z-10" />
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 h-3 w-3 rounded-full border-2 border-rose-500 bg-rose-500/30" />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 h-3 w-3 rounded-full border-2 border-rose-500 bg-rose-500/30" />
        </>
      )}

      {/* Réguas Horizontais Anatômicas */}
      {Object.entries(guides).map(([key, g]: [string, any]) => {
        if (!g.active) return null
        return (
          <div
            key={key}
            className="absolute left-0 right-0 z-20 flex items-center pointer-events-none"
            style={{ top: `${g.pos}%` }}
          >
            <div className="w-full h-0.5 bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.9)]" />
            <span className="absolute right-2 -top-4 px-1.5 py-0.5 rounded bg-amber-400 text-black font-bold text-[9px] uppercase tracking-wider shadow-sm">
              {g.label.split("(")[0]}
            </span>
          </div>
        )
      })}
    </div>
  )
}
