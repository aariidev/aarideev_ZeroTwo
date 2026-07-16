import { Activity, Crown, Radio, Wifi, WifiOff } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

interface ConnectionStripProps {
  botName?: string | null;
  botTag?: string | null;
  botAvatar?: string | null;
  online: boolean;
  ping: number;
  guildCount?: number;
  apiError?: boolean;
}

/** Top connection status — Discord gateway + your session */
export function ConnectionStrip({
  botName,
  botTag,
  botAvatar,
  online,
  ping,
  guildCount,
  apiError,
}: ConnectionStripProps) {
  const { user, isOwner } = useAuth();
  const displayName = botName ?? "Zero Two";

  return (
    <div className="rounded-2xl border border-border bg-card/90 p-3.5 sm:p-4 shadow-[0_8px_32px_rgba(0,0,0,0.28)]">
      <div className="flex flex-wrap items-center gap-3 sm:gap-4">
        {/* Bot identity */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="relative flex-shrink-0">
            <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl overflow-hidden ring-1 ring-border bg-sidebar shadow-[0_0_16px_var(--zt-glow-pink)]">
              {botAvatar ? (
                <img
                  src={botAvatar}
                  alt={displayName}
                  className="h-full w-full object-cover"
                  draggable={false}
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center font-mono text-xs text-white">
                  02
                </div>
              )}
            </div>
            <span
              className={cn(
                "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card",
                online ? "shadow-[0_0_8px_var(--zt-cyan)]" : "bg-zinc-500",
              )}
              style={online ? { backgroundColor: "var(--zt-cyan)" } : undefined}
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-base sm:text-lg font-semibold text-white truncate">
                {displayName}
              </h1>
              {botTag && (
                <span className="hidden sm:inline text-[10px] font-mono text-slate-500 border border-white/10 rounded-full px-2 py-0.5">
                  {botTag}
                </span>
              )}
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 truncate">
              Overview · gateway y sesión
            </p>
          </div>
        </div>

        {/* Status pills */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <StatusPill
            ok={!apiError && online}
            icon={apiError ? WifiOff : online ? Wifi : WifiOff}
            label={
              apiError
                ? "API down"
                : online
                  ? "Gateway online"
                  : "Gateway offline"
            }
          />
          <StatusPill
            ok={online && ping >= 0}
            icon={Activity}
            label={online && ping >= 0 ? `${ping}ms` : "— ms"}
            muted
          />
          {typeof guildCount === "number" && (
            <StatusPill
              ok
              icon={Radio}
              label={`${guildCount} guilds`}
              muted
            />
          )}
          {user && (
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/30 pl-1 pr-2.5 py-1">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt=""
                  className="h-6 w-6 rounded-full object-cover"
                />
              ) : (
                <div className="h-6 w-6 rounded-full bg-slate-800" />
              )}
              <span className="text-[11px] font-mono text-slate-300 max-w-[7rem] truncate">
                {user.globalName || user.username}
              </span>
              {isOwner && (
                <Crown className="h-3 w-3 text-[#f5c518] flex-shrink-0" />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusPill({
  ok,
  icon: Icon,
  label,
  muted,
}: {
  ok: boolean;
  icon: React.ElementType;
  label: string;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-mono",
        muted
          ? "border-border bg-black/25 text-muted-foreground"
          : ok
            ? "border-secondary/30 bg-secondary/10 text-secondary"
            : "border-red-500/30 bg-red-500/10 text-red-300",
      )}
    >
      <Icon className="h-3 w-3 flex-shrink-0" />
      {label}
    </div>
  );
}
