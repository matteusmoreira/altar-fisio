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

// Helper to convert HEX to HSL values "H S% L%"
function hexToHsl(hex: string): { light: string; dark: string } {
  let c = hex.replace("#", "")
  if (c.length === 3) {
    c = c.split("").map((x) => x + x).join("")
  }
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

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const convexSettings = useQuery(api.clinic.getSettings)

  const [localTheme, setLocalTheme] = useState<ClinicThemeConfig>(() => {
    try {
      const saved = localStorage.getItem("altar_fisio_theme")
      if (saved) {
        return JSON.parse(saved)
      }
    } catch {
      // ignore
    }
    return defaultTheme
  })

  // Derivação reativa sem render cascata: dados do servidor têm precedência sobre cache local
  const theme: ClinicThemeConfig = useMemo(() => {
    return {
      mode: convexSettings?.mode ?? localTheme.mode,
      preset: (convexSettings?.colorPreset as ColorPreset) ?? localTheme.preset,
      customHex: convexSettings?.primaryColor ?? localTheme.customHex,
      clinicName: convexSettings?.clinicName ?? localTheme.clinicName,
      clinicSubtitle: convexSettings?.clinicSubtitle ?? localTheme.clinicSubtitle,
      logoUrl: convexSettings?.logoUrl !== undefined ? convexSettings.logoUrl : localTheme.logoUrl,
    }
  }, [convexSettings, localTheme])

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

    try {
      localStorage.setItem("altar_fisio_theme", JSON.stringify(theme))
    } catch {
      // ignore
    }
  }, [theme])

  const setMode = (mode: "light" | "dark") => {
    setLocalTheme((prev) => ({ ...prev, mode }))
  }

  const toggleMode = () => {
    setLocalTheme((prev) => ({ ...prev, mode: prev.mode === "light" ? "dark" : "light" }))
  }

  const setPreset = (preset: ColorPreset, customHex?: string) => {
    setLocalTheme((prev) => ({
      ...prev,
      preset,
      customHex: customHex || prev.customHex,
    }))
  }

  const updateClinicInfo = (clinicName: string, clinicSubtitle: string, logoUrl?: string) => {
    setLocalTheme((prev) => ({
      ...prev,
      clinicName,
      clinicSubtitle,
      ...(logoUrl !== undefined ? { logoUrl } : {}),
    }))
  }

  const updateLogoUrl = (logoUrl?: string) => {
    setLocalTheme((prev) => ({ ...prev, logoUrl }))
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
