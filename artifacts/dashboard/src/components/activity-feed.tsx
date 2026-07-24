import { useEffect, useMemo, useRef, useState } from "react";
import type { ActivityEntry } from "@workspace/api-client-react";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertCircle,
  CheckCircle2,
  Radio,
  Server,
  Shield,
  Sparkles,
  Terminal,
  Wrench,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type Filter = "all" | "ok" | "fail";

const MOD_COMMANDS = new Set([
  "ban",
  "kick",
  "mute",
  "unmute",
  "timeout",
  "untimeout",
  "unban",
  "warn",
  "warns",
  "clearwarns",
  "purge",
  "slowmode",
  "lock",
  "unlock",
  "logs",
]);

const FUN_COMMANDS = new Set([
  "8ball",
  "poker",
  "ship",
  "blackjack",
  "wallet",
  "shop",
  "inventory",
  "top",
  "slots",
  "pay",
  "chat",
  "chrome",
  "gig",
  "psycho",
]);

const AVATAR_COLORS = [
  "bg-[#ff2d6b]/20 text-[#ff2d6b] border-[#ff2d6b]/30",
  "bg-[#00f5d4]/20 text-[#00f5d4] border-[#00f5d4]/30",
  "bg-[#f5c518]/20 text-[#f5c518] border-[#f5c518]/30",
  "bg-purple-500/20 text-purple-300 border-purple-500/30",
  "bg-blue-500/20 text-blue-300 border-blue-500/30",
  "bg-orange-500/20 text-orange-300 border-orange-500/30",
];

function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function commandMeta(command: string) {
  const cmd = command.replace(/^\//, "").toLowerCase();
  if (MOD_COMMANDS.has(cmd)) {
    return {
      label: "mod",
      chip: "border-[#ff2d6b]/30 bg-[#ff2d6b]/10 text-[#ff2d6b]",
      Icon: Shield,
    };
  }
  if (FUN_COMMANDS.has(cmd)) {
    return {
      label: "fun",
      chip: "border-[#00f5d4]/30 bg-[#00f5d4]/10 text-[#00f5d4]",
      Icon: Sparkles,
    };
  }
  return {
    label: "util",
    chip: "border-slate-600/50 bg-slate-800/60 text-slate-300",
    Icon: Wrench,
  };
}

function initials(name: string) {
  const clean = name.trim();
  if (!clean) return "??";
  const parts = clean.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

interface ActivityFeedProps {
  activity: ActivityEntry[] | undefined;
  isLoading: boolean;
  isFetching?: boolean;
}

export function ActivityFeed({ activity, isLoading, isFetching }: ActivityFeedProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const [seenIds, setSeenIds] = useState<Set<number>>(() => new Set());
  const listRef = useRef<HTMLDivElement>(null);
  const firstLoad = useRef(true);

  const items = activity ?? [];

  const filtered = useMemo(() => {
    if (filter === "ok") return items.filter((a) => a.success);
    if (filter === "fail") return items.filter((a) => !a.success);
    return items;
  }, [items, filter]);

  const failCount = useMemo(() => items.filter((a) => !a.success).length, [items]);
  const newestId = items[0]?.id;

  // Mark newly arrived rows for a short highlight (skip first paint)
  useEffect(() => {
    if (!items.length) return;
    if (firstLoad.current) {
      firstLoad.current = false;
      setSeenIds(new Set(items.map((i) => i.id)));
      return;
    }
    const timer = window.setTimeout(() => {
      setSeenIds(new Set(items.map((i) => i.id)));
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [newestId, items]);

  // Keep feed pinned to top when new events arrive
  useEffect(() => {
    if (listRef.current && newestId != null) {
      listRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [newestId]);

  return (
    <div className="flex flex-col h-full min-h-[360px] rounded-2xl border border-border bg-card/90 overflow-hidden shadow-[0_8px_28px_rgba(0,0,0,0.22)]">
      {/* Header */}
      <div className="p-3 sm:p-4 border-b border-border/60 flex flex-col gap-3 bg-black/15 flex-shrink-0">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground tracking-wide flex items-center gap-2 min-w-0">
            <Terminal className="w-4 h-4 text-primary flex-shrink-0" />
            <span className="truncate">Live activity</span>
            {items.length > 0 && (
              <span className="text-[10px] font-mono font-normal text-muted-foreground bg-white/5 border border-border px-1.5 py-0.5 rounded-full">
                {items.length}
              </span>
            )}
          </h2>

          <div className="flex items-center gap-2 flex-shrink-0">
            {isFetching && !isLoading && (
              <span className="text-[9px] font-mono text-muted-foreground hidden sm:inline">
                sync
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-secondary border border-secondary/30 bg-secondary/10 px-2 py-0.5 rounded-full">
              <Radio className="w-3 h-3" />
              Live
            </span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1.5">
          {(
            [
              { id: "all", label: "All" },
              { id: "ok", label: "OK" },
              { id: "fail", label: failCount > 0 ? `Fail (${failCount})` : "Fail" },
            ] as const
          ).map((tab) => {
            const active = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`text-[10px] font-mono px-2.5 py-1 rounded-md border transition-colors ${
                  active
                    ? tab.id === "fail"
                      ? "bg-[#f5c518]/15 border-[#f5c518]/40 text-[#f5c518]"
                      : "bg-[#ff2d6b]/15 border-[#ff2d6b]/40 text-[#ff2d6b]"
                    : "bg-transparent border-white/5 text-slate-500 hover:text-slate-300 hover:border-white/10"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Feed */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto p-2 flex flex-col gap-0.5 sakura-scrollbar"
      >
        {isLoading ? (
          <div className="p-3 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12 px-6 text-center text-slate-500">
            <div className="w-12 h-12 rounded-full border border-slate-800 bg-black/40 flex items-center justify-center mb-3">
              <Terminal className="w-5 h-5 opacity-40" />
            </div>
            <p className="text-sm font-mono text-slate-400">
              {filter === "all" ? "No hay actividad todavía" : "Nada en este filtro"}
            </p>
            <p className="text-[11px] text-slate-600 mt-1 max-w-[220px]">
              {filter === "all"
                ? "Cuando alguien use un slash command en Discord, aparecerá aquí en tiempo real."
                : "Prueba con All para ver el resto del stream."}
            </p>
          </div>
        ) : (
          filtered.map((act, index) => {
            const isNew = !seenIds.has(act.id);
            const meta = commandMeta(act.command);
            const MetaIcon = meta.Icon;
            const when = new Date(act.executedAt);
            const relative = formatDistanceToNow(when, { addSuffix: true, locale: es });
            const clock = format(when, "HH:mm:ss");

            return (
              <div
                key={act.id}
                className={`relative flex items-start gap-2.5 sm:gap-3 p-2.5 rounded-lg transition-all duration-500 group border border-transparent cp-rise ${
                  isNew
                    ? "bg-[#ff2d6b]/[0.09] border-[#ff2d6b]/30 shadow-[0_0_20px_rgba(255,45,107,0.12),inset_0_0_0_1px_rgba(255,45,107,0.1)]"
                    : "hover:bg-white/[0.03] hover:border-white/[0.06] hover:shadow-[0_0_16px_rgba(0,245,212,0.06)]"
                }`}
                style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}
              >
                {/* time rail */}
                <div className="hidden sm:flex flex-col items-end w-[3.25rem] shrink-0 pt-0.5">
                  <span className="text-[10px] font-mono text-slate-500 tabular-nums" title={when.toISOString()}>
                    {clock}
                  </span>
                </div>

                {/* avatar */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold font-mono shrink-0 border ${avatarColor(act.username)} opacity-90 group-hover:opacity-100`}
                  title={act.userId}
                >
                  {initials(act.username)}
                </div>

                {/* body */}
                <div className="flex flex-col min-w-0 flex-1 gap-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-medium text-slate-100 truncate max-w-[9rem] sm:max-w-[12rem]">
                      {act.username}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border ${meta.chip}`}
                    >
                      <MetaIcon className="w-2.5 h-2.5" />
                      /{act.command.replace(/^\//, "")}
                    </span>
                    <span className="ml-auto flex items-center gap-1 shrink-0">
                      {act.success ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#22c55e]" aria-label="OK" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-[#f5c518]" aria-label="Fail" />
                      )}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] text-slate-500 min-w-0">
                    <span className="inline-flex items-center gap-1 truncate min-w-0">
                      <Server className="w-2.5 h-2.5 shrink-0 opacity-70" />
                      <span className="truncate">{act.guildName || "DM"}</span>
                    </span>
                    <span className="text-slate-700">·</span>
                    <span className="font-mono text-slate-500 shrink-0 sm:hidden">{clock}</span>
                    <span className="font-mono text-slate-500 shrink-0 hidden sm:inline truncate">
                      {relative}
                    </span>
                    {isNew && (
                      <>
                        <span className="text-slate-700">·</span>
                        <span className="text-[#ff2d6b] font-mono uppercase tracking-wider">new</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer status */}
      {!isLoading && items.length > 0 && (
        <div className="px-3 py-2 border-t border-slate-800/50 bg-black/30 flex items-center justify-between text-[10px] font-mono text-slate-600">
          <span>
            {filtered.length === items.length
              ? `${items.length} eventos recientes`
              : `${filtered.length} / ${items.length} visibles`}
          </span>
          <span className="text-slate-600">auto-refresh 5s</span>
        </div>
      )}
    </div>
  );
}
