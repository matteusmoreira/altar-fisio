import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

export interface SelectNativeProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  icon?: React.ReactNode
  error?: boolean
}

export const Select = React.forwardRef<HTMLSelectElement, SelectNativeProps>(
  ({ className, children, icon, error, disabled, ...props }, ref) => {
    return (
      <div className="relative w-full">
        {icon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none flex items-center justify-center">
            {icon}
          </div>
        )}
        <select
          ref={ref}
          disabled={disabled}
          className={cn(
            "flex h-10 w-full appearance-none rounded-xl border bg-background py-2 text-sm text-foreground shadow-2xs transition-all duration-200",
            "border-input hover:border-primary/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
            icon ? "pl-10" : "pl-3.5",
            "pr-10 truncate",
            disabled && "cursor-not-allowed opacity-50 bg-muted/30",
            error && "border-destructive focus:border-destructive focus:ring-destructive/20",
            className
          )}
          {...props}
        >
          {children}
        </select>
        <div className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-transform">
          <ChevronDown className="h-4 w-4 opacity-70" />
        </div>
      </div>
    )
  }
)

Select.displayName = "Select"
