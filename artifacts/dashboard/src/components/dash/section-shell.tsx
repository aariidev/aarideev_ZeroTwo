import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionShellProps {
  title: string;
  icon?: React.ElementType;
  accent?: "pink" | "cyan" | "amber";
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

const ICON_COLOR = {
  pink: "var(--zt-pink)",
  cyan: "var(--zt-cyan)",
  amber: "var(--zt-amber)",
} as const;

/** Panel shell: header + content — dashboard card pattern */
export function SectionShell({
  title,
  icon: Icon,
  accent = "pink",
  action,
  children,
  className,
  bodyClassName,
}: SectionShellProps) {
  return (
    <section
      className={cn(
        "flex flex-col rounded-2xl border border-border bg-card/90 overflow-hidden shadow-[0_8px_28px_rgba(0,0,0,0.22)]",
        className,
      )}
    >
      <header className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-border/60 bg-black/15">
        <h2 className="text-sm font-semibold text-foreground tracking-wide flex items-center gap-2 min-w-0">
          {Icon && (
            <Icon
              className="h-4 w-4 flex-shrink-0"
              style={{ color: ICON_COLOR[accent] }}
            />
          )}
          <span className="truncate">{title}</span>
        </h2>
        {action && <div className="flex-shrink-0">{action}</div>}
      </header>
      <div className={cn("flex-1 min-h-0", bodyClassName)}>{children}</div>
    </section>
  );
}
