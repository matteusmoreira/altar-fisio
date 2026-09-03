import React from "react"
import { Calendar, CalendarRange, CalendarDays } from "lucide-react"
import { cn } from "@/lib/utils"
import type { SchedulePeriodMode } from "@/types"

interface SchedulePeriodToggleProps {
  period: SchedulePeriodMode
  onChange: (mode: SchedulePeriodMode) => void
  className?: string
}

export const SchedulePeriodToggle: React.FC<SchedulePeriodToggleProps> = ({
  period,
  onChange,
  className,
}) => {
  return (
    <div
      role="group"
      aria-label="Modo de visualização temporal"
      className={cn(
        "inline-flex items-center bg-muted/60 p-1 rounded-xl border border-border shrink-0 select-none shadow-2xs",
        className
      )}
    >
      <button
        type="button"
        onClick={() => onChange("day")}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
          period === "day"
            ? "bg-background text-foreground shadow-2xs"
            : "text-muted-foreground hover:text-foreground"
        )}
        title="Visualização Diária"
        aria-pressed={period === "day"}
      >
        <Calendar className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span>Dia</span>
      </button>

      <button
        type="button"
        onClick={() => onChange("week")}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
          period === "week"
            ? "bg-background text-foreground shadow-2xs"
            : "text-muted-foreground hover:text-foreground"
        )}
        title="Visualização Semanal"
        aria-pressed={period === "week"}
      >
        <CalendarRange className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span>Semana</span>
      </button>

      <button
        type="button"
        onClick={() => onChange("month")}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
          period === "month"
            ? "bg-background text-foreground shadow-2xs"
            : "text-muted-foreground hover:text-foreground"
        )}
        title="Visualização Mensal"
        aria-pressed={period === "month"}
      >
        <CalendarDays className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span>Mês</span>
      </button>
    </div>
  )
}
