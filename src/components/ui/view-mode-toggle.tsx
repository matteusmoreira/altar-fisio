import React from "react"
import { LayoutGrid, List } from "lucide-react"
import { cn } from "@/lib/utils"

export type ViewMode = "grid" | "list"

interface ViewModeToggleProps {
  viewMode: ViewMode
  onChange: (mode: ViewMode) => void
  gridLabel?: string
  listLabel?: string
  className?: string
}

export const ViewModeToggle: React.FC<ViewModeToggleProps> = ({
  viewMode,
  onChange,
  gridLabel = "Grade",
  listLabel = "Lista",
  className,
}) => {
  return (
    <div
      role="group"
      aria-label="Modo de visualização"
      className={cn(
        "inline-flex items-center bg-muted/60 p-1 rounded-xl border border-border shrink-0 select-none shadow-2xs",
        className
      )}
    >
      <button
        type="button"
        onClick={() => onChange("grid")}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
          viewMode === "grid"
            ? "bg-background text-foreground shadow-2xs"
            : "text-muted-foreground hover:text-foreground"
        )}
        title="Visualização em Grade"
        aria-pressed={viewMode === "grid"}
      >
        <LayoutGrid className="h-3.5 w-3.5 shrink-0" />
        <span className="hidden sm:inline">{gridLabel}</span>
      </button>

      <button
        type="button"
        onClick={() => onChange("list")}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
          viewMode === "list"
            ? "bg-background text-foreground shadow-2xs"
            : "text-muted-foreground hover:text-foreground"
        )}
        title="Visualização em Lista"
        aria-pressed={viewMode === "list"}
      >
        <List className="h-3.5 w-3.5 shrink-0" />
        <span className="hidden sm:inline">{listLabel}</span>
      </button>
    </div>
  )
}
