import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  icon?: React.ElementType;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

/** 21st-style page header: clear hierarchy + optional actions */
export function PageHeader({
  icon: Icon,
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 sm:gap-4",
        className,
      )}
    >
      <div className="min-w-0 space-y-1.5">
        <div className="flex items-center gap-2.5 min-w-0">
          {Icon && (
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary shadow-[0_0_20px_var(--zt-glow-pink)] flex-shrink-0">
              <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          )}
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold tracking-tight text-foreground truncate">
            {title}
          </h1>
        </div>
        {description && (
          <p className="text-sm text-muted-foreground font-mono pl-0 sm:pl-12 max-w-2xl">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          {actions}
        </div>
      )}
    </div>
  );
}
