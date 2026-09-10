import React, { createContext, useContext, useEffect, useState, useMemo } from "react"
import { useQuery } from "convex/react"
import { api } from "@convex/_generated/api"

export type ColorPreset = "emerald" | "ocean" | "teal" | "indigo" | "rose" | "amber" | "custom"

export interface ClinicThemeConfig {
  mode: "light" | "dark"
  preset: ColorPreset
  customHex?: string
  clinicName: string
  clinicSubtitle: string
  logoUrl?: string
}

export const PRESET_COLORS: Record<
  Exclude<ColorPreset, "custom">,
  { name: string; hex: string; hslLight: string; hslDark: string; bgAccent: string }
> = {
  emerald: {
    name: "Emerald Fisio",
    hex: "#10b981",
    hslLight: "158 64% 38%",
    hslDark: "158 64% 45%",
    bgAccent: "bg-emerald-500",
  },
  ocean: {
    name: "Ocean Blue",
    hex: "#0284c7",
    hslLight: "199 89% 40%",
    hslDark: "199 89% 48%",
    bgAccent: "bg-sky-500",
  },
  teal: {
    name: "Teal Mint",
    hex: "#0d9488",
    hslLight: "174 78% 36%",
    hslDark: "174 78% 42%",
    bgAccent: "bg-teal-500",
  },
  indigo: {
    name: "Amethyst Indigo",
    hex: "#6366f1",
    hslLight: "239 84% 53%",
    hslDark: "239 84% 60%",
    bgAccent: "bg-indigo-500",
  },
  rose: {
    name: "Rose Quartz",
    hex: "#e11d48",
    hslLight: "346 77% 49%",
    hslDark: "346 77% 55%",
    bgAccent: "bg-rose-500",
  },
  amber: {
    name: "Warm Amber",
    hex: "#d97706",
    hslLight: "38 92% 44%",
    hslDark: "38 92% 50%",
    bgAccent: "bg-amber-500",
  },
}

export function normalizeToHex(color: string | undefined, defaultHex = "#10b981"): string {
  if (!color || typeof color !== "string") return defaultHex
  const trimmed = color.trim()

  if (/^#?[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed.startsWith("#") ? trimmed.toLowerCase() : `#${trimmed.toLowerCase()}`
  }

  if (/^#?[0-9a-fA-F]{3}$/.test(trimmed)) {
    const raw = trimmed.replace("#", "")
    const full = raw.split("").map((ch) => ch + ch).join("")
    return `#${full.toLowerCase()}`
  }

  for (const preset of Object.values(PRESET_COLORS)) {
    if (trimmed === preset.hslLight || trimmed === preset.hslDark || trimmed.toLowerCase() === preset.hex.toLowerCase()) {
      return preset.hex
    }
  }

  const cleanHsl = trimmed.replace(/^hsl\(/i, "").replace(/\)$/, "").replace(/,/g, " ")
  const hslMatch = cleanHsl.match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/)
  if (hslMatch) {
    const h = parseFloat(hslMatch[1]) / 360
    const s = parseFloat(hslMatch[2]) / 100
    const l = parseFloat(hslMatch[3]) / 100
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    const hueToRgb = (t: number) => {
      let temp = t
      if (temp < 0) temp += 1
      if (temp > 1) temp -= 1
      if (temp < 1 / 6) return p + (q - p) * 6 * temp
      if (temp < 1 / 2) return q
      if (temp < 2 / 3) return p + (q - p) * (2 / 3 - temp) * 6
      return p
    }
    const r = Math.round(hueToRgb(h + 1 / 3) * 255)
    const g = Math.round(hueToRgb(h) * 255)
    const b = Math.round(hueToRgb(h - 1 / 3) * 255)
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`
  }

  return defaultHex
}

// Helper to convert HEX to HSL values "H S% L%"
function hexToHsl(hex: string): { light: string; dark: string } {
  const normalizedHex = normalizeToHex(hex, "#10b981")
  const c = normalizedHex.replace("#", "")
  const num = parseInt(c, 16)
  if (isNaN(num)) {
    return { light: "158 64% 38%", dark: "158 64% 45%" }
  }

  const r = (num >> 16) / 255
  const g = ((num >> 8) & 0xff) / 255
  const b = (num & 0xff) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      case b:
        h = (r - g) / d + 4
        break
    }
    h /= 6
  }

  const hDeg = Math.round(h * 360)
  const sPct = Math.round(s * 100)
  const lLight = Math.max(25, Math.min(48, Math.round(l * 100)))
  const lDark = Math.max(40, Math.min(65, Math.round(l * 100) + 10))

  return {
    light: `${hDeg} ${sPct}% ${lLight}%`,
    dark: `${hDeg} ${sPct}% ${lDark}%`,
  }
}

interface ThemeContextType {
  theme: ClinicThemeConfig
  setMode: (mode: "light" | "dark") => void
  setPreset: (preset: ColorPreset, customHex?: string) => void
  updateClinicInfo: (name: string, subtitle: string, logoUrl?: string) => void
  updateLogoUrl: (logoUrl?: string) => void
  toggleMode: () => void
}

const defaultTheme: ClinicThemeConfig = {
  mode: "light",
  preset: "emerald",
  customHex: "#10b981",
  clinicName: "Altar Fisio",
  clinicSubtitle: "Dr. Marcelo - Fisio, Pilates & RPG",
  logoUrl: undefined,
}

const LOCAL_STORAGE_KEY = "altar_fisio_theme"

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const convexSettings = useQuery(api.clinic.getSettings)

  const [userOverrides, setUserOverrides] = useState<Partial<ClinicThemeConfig>>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed && typeof parsed === "object") {
          return {
            mode: parsed.mode === "dark" || parsed.mode === "light" ? parsed.mode : undefined,
            preset:
              parsed.preset && (parsed.preset in PRESET_COLORS || parsed.preset === "custom")
                ? parsed.preset
                : undefined,
            customHex: parsed.customHex ? normalizeToHex(parsed.customHex) : undefined,
            clinicName: parsed.clinicName || undefined,
            clinicSubtitle: parsed.clinicSubtitle || undefined,
            logoUrl: parsed.logoUrl,
          }
        }
      }
    } catch {
      // ignore
    }
    return {}
  })

  // Derivação reativa sem render cascata:
  // As escolhas ativas do usuário têm precedência imediata sobre os defaults do servidor.
  // Se o usuário ainda não personalizou uma propriedade, os valores do backend são utilizados.
  const theme: ClinicThemeConfig = useMemo(() => {
    const serverMode = convexSettings?.mode
    const serverPreset = convexSettings?.colorPreset as ColorPreset | undefined
    const serverHex = convexSettings?.primaryColor ? normalizeToHex(convexSettings.primaryColor) : undefined
    const serverName = convexSettings?.clinicName
    const serverSubtitle = convexSettings?.clinicSubtitle
    const serverLogo = convexSettings?.logoUrl

    const mode: "light" | "dark" = userOverrides.mode ?? serverMode ?? defaultTheme.mode
    const preset: ColorPreset =
      userOverrides.preset ??
      (serverPreset && (serverPreset in PRESET_COLORS || serverPreset === "custom")
        ? serverPreset
        : defaultTheme.preset)

    let fallbackHex = defaultTheme.customHex || "#10b981"
    if (preset !== "custom" && PRESET_COLORS[preset as keyof typeof PRESET_COLORS]) {
      fallbackHex = PRESET_COLORS[preset as keyof typeof PRESET_COLORS].hex
    }

    const customHex: string = userOverrides.customHex ?? serverHex ?? fallbackHex
    const clinicName: string = userOverrides.clinicName ?? serverName ?? defaultTheme.clinicName
    const clinicSubtitle: string =
      userOverrides.clinicSubtitle ?? serverSubtitle ?? defaultTheme.clinicSubtitle
    const logoUrl: string | undefined =
      userOverrides.logoUrl !== undefined ? userOverrides.logoUrl : (serverLogo ?? defaultTheme.logoUrl)

    return {
      mode,
      preset,
      customHex,
      clinicName,
      clinicSubtitle,
      logoUrl,
    }
  }, [convexSettings, userOverrides])

  // Apply CSS variables & dark class whenever theme changes
  useEffect(() => {
    const root = document.documentElement

    // Toggle dark class
    if (theme.mode === "dark") {
      root.classList.add("dark")
    } else {
      root.classList.remove("dark")
    }

    // Determine HSL values
    let hslLight = PRESET_COLORS.emerald.hslLight
    let hslDark = PRESET_COLORS.emerald.hslDark

    if (theme.preset === "custom" && theme.customHex) {
      const computed = hexToHsl(theme.customHex)
      hslLight = computed.light
      hslDark = computed.dark
    } else if (theme.preset !== "custom" && PRESET_COLORS[theme.preset]) {
      hslLight = PRESET_COLORS[theme.preset].hslLight
      hslDark = PRESET_COLORS[theme.preset].hslDark
    }

    const activeHsl = theme.mode === "dark" ? hslDark : hslLight

    // Apply to CSS variables
    root.style.setProperty("--primary", activeHsl)
    root.style.setProperty("--ring", activeHsl)
    root.style.setProperty("--sidebar-primary", activeHsl)
    root.style.setProperty("--sidebar-ring", activeHsl)

    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(theme))
    } catch {
      // ignore
    }
  }, [theme])

  const setMode = (mode: "light" | "dark") => {
    setUserOverrides((prev) => {
      const next = { ...prev, mode }
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ ...theme, ...next }))
      } catch {}
      return next
    })
  }

  const toggleMode = () => {
    setUserOverrides((prev) => {
      const currentMode = prev.mode ?? theme.mode
      const nextMode: "light" | "dark" = currentMode === "light" ? "dark" : "light"
      const next: Partial<ClinicThemeConfig> = { ...prev, mode: nextMode }
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ ...theme, ...next }))
      } catch {}
      return next
    })
  }

  const setPreset = (preset: ColorPreset, customHex?: string) => {
    setUserOverrides((prev) => {
      const validHex = customHex
        ? normalizeToHex(customHex)
        : (preset !== "custom" && PRESET_COLORS[preset as keyof typeof PRESET_COLORS]?.hex) ||
          prev.customHex ||
          "#10b981"
      const next = {
        ...prev,
        preset,
        customHex: validHex,
      }
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ ...theme, ...next }))
      } catch {}
      return next
    })
  }

  const updateClinicInfo = (clinicName: string, clinicSubtitle: string, logoUrl?: string) => {
    setUserOverrides((prev) => {
      const next = {
        ...prev,
        clinicName,
        clinicSubtitle,
        ...(logoUrl !== undefined ? { logoUrl } : {}),
      }
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ ...theme, ...next }))
      } catch {}
      return next
    })
  }

  const updateLogoUrl = (logoUrl?: string) => {
    setUserOverrides((prev) => {
      const next = { ...prev, logoUrl }
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ ...theme, ...next }))
      } catch {}
      return next
    })
  }

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setMode,
        setPreset,
        updateClinicInfo,
        updateLogoUrl,
        toggleMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}
