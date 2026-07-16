import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

type Accent = "pink" | "cyan" | "amber" | "green" | "slate";

const ACCENT: Record<
  Accent,
  { ring: string; icon: string; glow: string; iconColor: string }
> = {
  pink: {
    ring: "border-primary/25 group-hover:border-primary/45",
    icon: "bg-primary/10",
    glow: "group-hover:shadow-[0_0_28px_var(--zt-glow-pink)]",
    iconColor: "var(--zt-pink)",
  },
  cyan: {
    ring: "border-secondary/25 group-hover:border-secondary/45",
    icon: "bg-secondary/10",
    glow: "group-hover:shadow-[0_0_28px_var(--zt-glow-cyan)]",
    iconColor: "var(--zt-cyan)",
  },
  amber: {
    ring: "border-[color-mix(in_srgb,var(--zt-amber)_35%,transparent)] group-hover:border-[color-mix(in_srgb,var(--zt-amber)_55%,transparent)]",
    icon: "bg-black/30",
    glow: "group-hover:shadow-[0_0_24px_color-mix(in_srgb,var(--zt-amber)_20%,transparent)]",
    iconColor: "var(--zt-amber)",
  },
  green: {
    ring: "border-[color-mix(in_srgb,var(--zt-green)_35%,transparent)] group-hover:border-[color-mix(in_srgb,var(--zt-green)_55%,transparent)]",
    icon: "bg-black/30",
    glow: "group-hover:shadow-[0_0_24px_color-mix(in_srgb,var(--zt-green)_18%,transparent)]",
    iconColor: "var(--zt-green)",
  },
  slate: {
    ring: "border-slate-700/60 group-hover:border-slate-500/50",
    icon: "bg-slate-800/80",
    glow: "group-hover:shadow-[0_0_20px_rgba(148,163,184,0.08)]",
    iconColor: "#cbd5e1",
  },
};

interface KpiCardProps {
  label: string;
  value: string | null;
  hint?: string | null;
  icon: React.ElementType;
  accent?: Accent;
  isLoading?: boolean;
  className?: string;
  footer?: ReactNode;
}

/** KPI tile inspired by 21st.dev stats/dashboard cards */
export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = "pink",
  isLoading,
  className,
  footer,
}: KpiCardProps) {
  const a = ACCENT[accent];

  return (
    <div
      className={cn(
        "group relative flex flex-col rounded-2xl border bg-card/90 p-4 sm:p-5 transition-all duration-200 hover:-translate-y-0.5",
        a.ring,
        a.glow,
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <span className="text-[10px] sm:text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground leading-tight">
          {label}
        </span>
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0",
            a.icon,
          )}
          style={{ color: a.iconColor }}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <div className="text-2xl sm:text-3xl font-semibold font-mono text-white tracking-tight tabular-nums">
        {isLoading ? <Skeleton className="h-8 w-20 rounded-md" /> : (value ?? "—")}
      </div>

      {(hint || footer) && (
        <div className="mt-2 flex items-center justify-between gap-2 min-h-[1.25rem]">
          {hint && (
            <p className="text-[11px] sm:text-xs text-slate-500 font-mono truncate">
              {hint}
            </p>
          )}
          {footer}
        </div>
      )}
    </div>
  );
}
