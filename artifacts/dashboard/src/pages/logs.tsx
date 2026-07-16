import { useState, useEffect, useCallback } from "react";
import { FileText, Search, RefreshCw, AlertTriangle, Info, XCircle, Shield } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface LogEntry {
  id: number;
  level: string;
  event: string;
  details: Record<string, unknown>;
  guildId: string | null;
  guildName: string | null;
  userId: string | null;
  username: string | null;
  moderatorId: string | null;
  moderatorName: string | null;
  createdAt: string;
}

const LEVEL_CONFIG = {
  info:  { color: "text-cyan-400 border-cyan-400/30 bg-cyan-400/10",  icon: Info,          label: "INFO"  },
  warn:  { color: "text-yellow-400 border-yellow-400/30 bg-yellow-400/10", icon: AlertTriangle, label: "WARN"  },
  error: { color: "text-red-400 border-red-400/30 bg-red-400/10",     icon: XCircle,       label: "ERROR" },
};

const EVENT_LABELS: Record<string, string> = {
  ban: "BAN", kick: "KICK", warn: "WARN", mute: "MUTE", unmute: "UNMUTE",
  timeout: "TIMEOUT", untimeout: "UNTIMEOUT", unban: "UNBAN",
  slowmode: "SLOWMODE", lock: "LOCK", unlock: "UNLOCK",
  purge: "PURGE", clearwarns: "CLEARWARNS",
};

const FILTER_LEVELS = ["all", "info", "warn", "error"];
const FILTER_EVENTS = ["all", "ban", "kick", "warn", "timeout", "untimeout", "unban", "lock", "unlock", "slowmode", "purge"];

export default function Logs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [eventFilter, setEventFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchLogs = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const params = new URLSearchParams({ limit: "200" });
      if (levelFilter !== "all") params.set("level", levelFilter);
      if (eventFilter !== "all") params.set("event", eventFilter);
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`${BASE}/api/logs?${params}`);
      if (res.ok) {
        setLogs(await res.json());
        setLastRefresh(new Date());
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [levelFilter, eventFilter, search]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);
  useEffect(() => {
    const interval = setInterval(() => fetchLogs(true), 15000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  const formatDetails = (details: Record<string, unknown>) => {
    const entries = Object.entries(details).filter(([k]) => !["channelId"].includes(k));
    if (entries.length === 0) return null;
    return entries.map(([k, v]) => `${k}=${String(v)}`).join(" · ");
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display text-primary tracking-widest flex items-center gap-3">
            <FileText className="h-6 w-6 sm:h-8 sm:w-8" />
            SYSTEM_LOGS
          </h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">
            Real-time moderation and system event log.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-muted-foreground hidden sm:inline">
            {formatDistanceToNow(lastRefresh, { addSuffix: true })}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 font-mono text-xs border-border"
            onClick={() => fetchLogs(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
            REFRESH
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by user, server..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 font-mono text-sm bg-card border-border"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <span className="text-xs font-mono text-muted-foreground mr-1">LEVEL:</span>
          {FILTER_LEVELS.map((l) => (
            <button
              key={l}
              onClick={() => setLevelFilter(l)}
              className={`px-2 py-1 text-xs font-mono border transition-colors ${
                levelFilter === l
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
              }`}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <span className="text-xs font-mono text-muted-foreground mr-1">EVENT:</span>
          {FILTER_EVENTS.map((e) => (
            <button
              key={e}
              onClick={() => setEventFilter(e)}
              className={`px-2 py-1 text-xs font-mono border transition-colors ${
                eventFilter === e
                  ? "border-cyan-500/60 bg-cyan-500/10 text-cyan-400"
                  : "border-border text-muted-foreground hover:border-cyan-500/30 hover:text-foreground"
              }`}
            >
              {e.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Terminal log window */}
      <div className="relative border border-border bg-card" style={{ boxShadow: "0 0 20px hsl(340 95% 60% / 0.05)" }}>
        <span className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary" />
        <span className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary" />

        {/* Terminal header */}
        <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 border-b border-border bg-sidebar">
          <Shield className="h-4 w-4 text-primary flex-shrink-0" />
          <span className="font-mono text-xs text-primary truncate">ZeroTwo@DARLING:~$ tail -f /var/log/bot/moderation.log</span>
          <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
            <span className="h-2 w-2 rounded-full bg-red-500/60" />
            <span className="h-2 w-2 rounded-full bg-yellow-500/60" />
            <span className="h-2 w-2 rounded-full bg-green-500/60" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-h-[400px] sm:min-h-[500px] max-h-[60vh] sm:max-h-[70vh] overflow-y-auto font-mono text-xs">
            {loading ? (
              <div className="p-6 space-y-3">
                {Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <FileText className="h-10 w-10 mb-3 opacity-30" />
                <p className="font-mono text-sm">No events logged.</p>
                <p className="font-mono text-xs text-muted-foreground/60 mt-1">
                  Moderation events will appear here.
                </p>
              </div>
            ) : (
              <table className="w-full" style={{ minWidth: 640 }}>
                <thead className="border-b border-border sticky top-0 bg-sidebar z-10">
                  <tr className="text-left text-muted-foreground">
                    <th className="px-3 sm:px-4 py-2 font-mono font-normal w-10">#</th>
                    <th className="px-2 py-2 font-mono font-normal w-36">TIMESTAMP</th>
                    <th className="px-2 py-2 font-mono font-normal w-16">LVL</th>
                    <th className="px-2 py-2 font-mono font-normal w-24">EVENT</th>
                    <th className="px-2 py-2 font-mono font-normal w-28">TARGET</th>
                    <th className="px-2 py-2 font-mono font-normal w-28 hidden sm:table-cell">MODERATOR</th>
                    <th className="px-2 py-2 font-mono font-normal w-36 hidden md:table-cell">SERVER</th>
                    <th className="px-2 py-2 font-mono font-normal hidden lg:table-cell">DETAILS</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, index) => {
                    const cfg = LEVEL_CONFIG[log.level as keyof typeof LEVEL_CONFIG] ?? LEVEL_CONFIG.info;
                    const LevelIcon = cfg.icon;
                    const details = formatDetails(log.details);

                    return (
                      <tr
                        key={log.id}
                        className="border-b border-border/40 hover:bg-sidebar/60 transition-colors"
                      >
                        <td className="px-3 sm:px-4 py-2.5 text-muted-foreground/40">{index + 1}</td>
                        <td className="px-2 py-2.5 text-muted-foreground whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString("en-GB", {
                            month: "2-digit", day: "2-digit",
                            hour: "2-digit", minute: "2-digit", second: "2-digit"
                          })}
                        </td>
                        <td className="px-2 py-2.5">
                          <span className={`inline-flex items-center gap-1 border px-1.5 py-0.5 ${cfg.color}`}>
                            <LevelIcon className="h-3 w-3" />
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-2 py-2.5">
                          <span className="text-primary font-semibold whitespace-nowrap">
                            {EVENT_LABELS[log.event] ?? log.event.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-2 py-2.5 text-foreground">
                          {log.username ? (
                            <span className="truncate max-w-[100px] block">@{log.username}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-2 py-2.5 text-muted-foreground hidden sm:table-cell">
                          {log.moderatorName ?? "—"}
                        </td>
                        <td className="px-2 py-2.5 text-muted-foreground truncate max-w-[160px] hidden md:table-cell">
                          {log.guildName ?? "—"}
                        </td>
                        <td className="px-2 py-2.5 text-muted-foreground/70 truncate max-w-[200px] hidden lg:table-cell">
                          {details ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {!loading && logs.length > 0 && (
          <div className="px-3 sm:px-4 py-2 border-t border-border bg-sidebar flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-mono text-muted-foreground">
              {logs.length} events · auto-refresh 15s
            </span>
            <span className="text-xs font-mono text-muted-foreground/50">
              {refreshing ? "refreshing..." : ""}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
