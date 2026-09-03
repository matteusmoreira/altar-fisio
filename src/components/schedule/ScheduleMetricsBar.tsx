import React, { useMemo } from "react"
import type { Schedule } from "@/types"
import { Calendar, Users, CheckCircle2, TrendingUp } from "lucide-react"

interface ScheduleMetricsBarProps {
  schedules: Schedule[]
  periodLabel?: string
  className?: string
}

export const ScheduleMetricsBar: React.FC<ScheduleMetricsBarProps> = ({
  schedules,
  periodLabel,
  className = "",
}) => {
  const metrics = useMemo(() => {
    const totalSessions = schedules.length
    const totalCapacity = schedules.reduce((acc, s) => acc + (s.maxCapacity || 1), 0)
    const totalEnrolled = schedules.reduce(
      (acc, s) =>
        acc +
        (s.participants || []).filter((p) => p.status !== "justified_absence").length,
      0
    )
    const availableVacancies = Math.max(0, totalCapacity - totalEnrolled)
    const occupancyRate =
      totalCapacity > 0 ? Math.round((totalEnrolled / totalCapacity) * 100) : 0

    // Pacientes únicos
    const uniquePatients = new Set<string>()
    schedules.forEach((s) => {
      s.participants?.forEach((p) => {
        if (p.patientId) uniquePatients.add(p.patientId)
      })
    })

    return {
      totalSessions,
      totalCapacity,
      totalEnrolled,
      availableVacancies,
      occupancyRate,
      uniquePatientsCount: uniquePatients.size,
    }
  }, [schedules])

  return (
    <div
      className={`grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-2xl bg-card border border-border/80 shadow-2xs ${className}`}
    >
      {/* Total de Sessões */}
      <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-muted/30 border border-border/40">
        <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Calendar className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider truncate">
            Sessões
          </p>
          <p className="text-sm sm:text-base font-extrabold text-foreground leading-tight">
            {metrics.totalSessions}
          </p>
        </div>
      </div>

      {/* Alunos Agendados */}
      <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-muted/30 border border-border/40">
        <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
          <Users className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider truncate">
            Alunos / Vagas
          </p>
          <p className="text-sm sm:text-base font-extrabold text-foreground leading-tight">
            {metrics.totalEnrolled}{" "}
            <span className="text-xs font-normal text-muted-foreground">
              / {metrics.totalCapacity}
            </span>
          </p>
        </div>
      </div>

      {/* Vagas Livres */}
      <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-muted/30 border border-border/40">
        <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
          <CheckCircle2 className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider truncate">
            Vagas Livres
          </p>
          <p className="text-sm sm:text-base font-extrabold text-foreground leading-tight">
            {metrics.availableVacancies}
          </p>
        </div>
      </div>

      {/* Taxa de Ocupação Média */}
      <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-muted/30 border border-border/40">
        <div className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
          <TrendingUp className="h-4 w-4" />
        </div>
        <div className="min-w-0 w-full">
          <div className="flex items-center justify-between gap-1">
            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider truncate">
              Ocupação
            </p>
            <span className="text-xs font-bold text-foreground">
              {metrics.occupancyRate}%
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-1.5 mt-1 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                metrics.occupancyRate > 85
                  ? "bg-rose-500"
                  : metrics.occupancyRate > 50
                  ? "bg-emerald-500"
                  : "bg-blue-500"
              }`}
              style={{ width: `${Math.min(100, metrics.occupancyRate)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
