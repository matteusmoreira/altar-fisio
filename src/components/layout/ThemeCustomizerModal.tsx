import React, { useState } from "react"
import { useTheme, PRESET_COLORS, type ColorPreset } from "@/contexts/ThemeContext"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Check, Moon, Sun, Palette, Sparkles, Building2 } from "lucide-react"

interface ThemeCustomizerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const ThemeCustomizerModal: React.FC<ThemeCustomizerModalProps> = ({
  open,
  onOpenChange,
}) => {
  const { theme, setMode, setPreset, updateClinicInfo } = useTheme()
  const [customHex, setCustomHex] = useState(theme.customHex || "#10b981")
  const [clinicName, setClinicName] = useState(theme.clinicName)
  const [clinicSubtitle, setClinicSubtitle] = useState(theme.clinicSubtitle)
  const [savedFeedback, setSavedFeedback] = useState(false)

  const handleSaveInfo = (e: React.FormEvent) => {
    e.preventDefault()
    updateClinicInfo(clinicName, clinicSubtitle)
    setSavedFeedback(true)
    setTimeout(() => setSavedFeedback(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Palette className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Identidade Visual & Cores</DialogTitle>
              <DialogDescription>
                Personalize as cores do dashboard e nome da clínica em tempo real.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Modo Claro / Escuro */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Aparência do Tema
            </label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={theme.mode === "light" ? "default" : "outline"}
                className="justify-start gap-2 h-11"
                onClick={() => setMode("light")}
              >
                <Sun className="h-4 w-4 text-amber-500" />
                <span>Modo Claro</span>
                {theme.mode === "light" && <Check className="h-4 w-4 ml-auto" />}
              </Button>
              <Button
                type="button"
                variant={theme.mode === "dark" ? "default" : "outline"}
                className="justify-start gap-2 h-11"
                onClick={() => setMode("dark")}
              >
                <Moon className="h-4 w-4 text-sky-400" />
                <span>Modo Escuro</span>
                {theme.mode === "dark" && <Check className="h-4 w-4 ml-auto" />}
              </Button>
            </div>
          </div>

          {/* Paletas Pré-definidas */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Cor Primária da Clínica
              </label>
              <span className="text-xs text-primary font-medium flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Aplicação instantânea
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {(Object.keys(PRESET_COLORS) as Array<Exclude<ColorPreset, "custom">>).map((key) => {
                const preset = PRESET_COLORS[key]
                const isSelected = theme.preset === key

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPreset(key)}
                    className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-xs font-medium transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm"
                        : "border-border hover:bg-muted/60"
                    }`}
                  >
                    <div
                      className="h-6 w-6 rounded-full flex items-center justify-center shadow-inner"
                      style={{ backgroundColor: preset.hex }}
                    >
                      {isSelected && <Check className="h-3.5 w-3.5 text-white stroke-[3]" />}
                    </div>
                    <span className="truncate w-full text-center text-[11px]">
                      {preset.name}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Seletor Customizado HEX */}
          <div className="space-y-2 p-3 rounded-xl border bg-muted/30">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">Cor Personalizada (HEX)</span>
              {theme.preset === "custom" && (
                <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-primary text-primary-foreground">
                  Ativo
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={customHex}
                onChange={(e) => {
                  setCustomHex(e.target.value)
                  setPreset("custom", e.target.value)
                }}
                className="h-9 w-10 cursor-pointer rounded-lg border border-border bg-transparent p-0.5"
              />
              <Input
                value={customHex}
                onChange={(e) => {
                  setCustomHex(e.target.value)
                  if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
                    setPreset("custom", e.target.value)
                  }
                }}
                placeholder="#10b981"
                className="h-9 text-xs font-mono uppercase"
              />
              <Button
                size="sm"
                variant={theme.preset === "custom" ? "default" : "outline"}
                onClick={() => setPreset("custom", customHex)}
                className="h-9 text-xs shrink-0"
              >
                Aplicar HEX
              </Button>
            </div>
          </div>

          {/* Dados da Clínica */}
          <form onSubmit={handleSaveInfo} className="space-y-3 pt-2 border-t border-border">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" /> Nome e Subtítulo da Clínica
            </label>
            <div className="space-y-2">
              <Input
                value={clinicName}
                onChange={(e) => setClinicName(e.target.value)}
                placeholder="Nome da clínica (ex: Altar Fisio)"
                className="h-9 text-sm"
              />
              <Input
                value={clinicSubtitle}
                onChange={(e) => setClinicSubtitle(e.target.value)}
                placeholder="Subtítulo ou especialidades"
                className="h-9 text-xs text-muted-foreground"
              />
            </div>
            <div className="flex items-center justify-between">
              {savedFeedback ? (
                <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                  <Check className="h-3.5 w-3.5" /> Informações atualizadas!
                </span>
              ) : <span />}
              <Button type="submit" size="sm" variant="outline" className="text-xs">
                Salvar Dados
              </Button>
            </div>
          </form>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Concluído
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
