import {
  useGetBotStats,
  useGetBotActivity,
  useGetCommandStats,
  useListGuilds,
  useListWarns,
  getGetBotStatsQueryKey,
  getGetBotActivityQueryKey,
  getGetCommandStatsQueryKey,
  getListGuildsQueryKey,
  getListWarnsQueryKey,
} from "@workspace/api-client-react";
import {
  Server,
  Users,
  Command,
  Zap,
  ShieldAlert,
  Clock,
  Terminal,
  Database,
  Activity,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { formatUptime, formatNumber } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

// ── Helpers ──────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-[#ff2d6b]/20 text-[#ff2d6b]",
  "bg-[#00f5d4]/20 text-[#00f5d4]",
  "bg-[#f5c518]/20 text-[#f5c518]",
  "bg-purple-500/20 text-purple-400",
  "bg-blue-500/20 text-blue-400",
];
const avatarColor = (name: string) => AVATAR_COLORS[name.length % AVATAR_COLORS.length];

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Home() {
  const { data: stats, isLoading: statsLoading } = useGetBotStats({
    query: { queryKey: getGetBotStatsQueryKey(), refetchInterval: 15000 },
  });

  const { data: activity, isLoading: activityLoading } = useGetBotActivity({
    query: { queryKey: getGetBotActivityQueryKey(), refetchInterval: 15000 },
  });

  const { data: commandStats, isLoading: commandsLoading } = useGetCommandStats({
    query: { queryKey: getGetCommandStatsQueryKey(), refetchInterval: 30000 },
  });

  const { data: guilds } = useListGuilds({
    query: { queryKey: getListGuildsQueryKey(), refetchInterval: 60000 },
  });

  const { data: warns } = useListWarns({
    query: { queryKey: getListWarnsQueryKey(), refetchInterval: 60000 },
  });

  const topCommands = commandStats?.slice(0, 5) ?? [];
  const topGuilds = (guilds ?? [])
    .slice()
    .sort((a, b) => b.memberCount - a.memberCount)
    .slice(0, 3);
  const warningCount = Array.isArray(warns) ? warns.length : 0;
  const ping = stats?.ping ?? -1;

  // ── Stat cards ──────────────────────────────────────────────────────────────
  const statCards = [
    {
      label: "CONNECTED GUILDS",
      value: stats ? formatNumber(stats.guildCount) : null,
      delta: stats ? `${stats.guildCount} total` : null,
      trend: "neutral" as const,
      icon: Server,
    },
    {
      label: "TOTAL USERS",
      value: stats ? formatNumber(stats.userCount) : null,
      delta: "across all servers",
      trend: "up" as const,
      icon: Users,
    },
    {
      label: "COMMANDS RUN",
      value: stats ? formatNumber(stats.commandsExecuted) : null,
      delta: "all time",
      trend: "up" as const,
      icon: Command,
    },
    {
      label: "WEBSOCKET PING",
      value: ping >= 0 ? `${ping}ms` : "—",
      delta: ping < 0 ? "offline" : ping < 100 ? "excellent" : ping < 200 ? "good" : "degraded",
      trend: (ping < 0 ? "down" : ping < 200 ? "up" : "neutral") as "up" | "down" | "neutral",
      icon: Zap,
    },
    {
      label: "WARNINGS ISSUED",
      value: warningCount > 0 ? String(warningCount) : "—",
      delta: "total logged",
      trend: "neutral" as const,
      icon: ShieldAlert,
    },
    {
      label: "SYSTEM UPTIME",
      value: stats?.uptime != null ? formatUptime(stats.uptime) : null,
      delta: "99.9% stable",
      trend: "up" as const,
      icon: Clock,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <header className="-mx-8 -mt-8 px-6 py-4 bg-gradient-to-r from-[#ff2d6b]/10 via-[#ff2d6b]/5 to-transparent border-b border-[#ff2d6b]/10 flex items-center gap-4">
        <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <span className="text-[#ff2d6b]">/</span>{" "}
          {statsLoading ? (
            <Skeleton className="h-5 w-24 inline-block rounded-md" />
          ) : (
            stats?.botName ?? "Zero Two"
          )}
          <span className="text-xs font-mono font-normal text-slate-500 ml-2 px-2 py-0.5 rounded-full bg-black/40 border border-white/5">
            {stats?.botTag ?? "02#1325"}
          </span>
        </h1>

        <div className="h-4 w-px bg-slate-800 mx-1" />

        <div className="flex items-center gap-2 px-3 py-1 bg-[#00f5d4]/10 border border-[#00f5d4]/20 rounded-full">
          <span className="w-2 h-2 rounded-full bg-[#00f5d4] animate-pulse shadow-[0_0_8px_#00f5d4]" />
          <span className="text-[10px] font-bold tracking-wider text-[#00f5d4] uppercase">
            {ping >= 0 ? "System Active" : "Offline"}
          </span>
        </div>

        <div className="flex items-center gap-2 px-3 py-1 bg-black/20 border border-white/5 rounded-full">
          <Activity className="w-3 h-3 text-slate-400" />
          <span className="text-[10px] font-mono text-slate-300">{ping >= 0 ? `${ping}ms` : "—"}</span>
        </div>
      </header>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((card, i) => (
          <StatCard key={i} {...card} isLoading={statsLoading && card.value === null} />
        ))}
      </div>

      {/* Lower Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Activity Feed */}
        <div className="lg:col-span-5 flex flex-col bg-[#0a0f1a] border border-slate-800/60 rounded-xl overflow-hidden relative min-h-[420px]">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-[#ff2d6b] to-transparent opacity-50" />
          <div className="p-4 border-b border-slate-800/60 flex items-center justify-between bg-black/20">
            <h2 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
              <Terminal className="w-4 h-4 text-[#ff2d6b]" />
              LIVE ACTIVITY
            </h2>
            <span className="text-[10px] font-mono text-[#00f5d4] border border-[#00f5d4]/20 bg-[#00f5d4]/10 px-2 py-0.5 rounded">
              Streaming
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-0.5 sakura-scrollbar">
            {activityLoading ? (
              <div className="p-4 space-y-2">
                {Array(6).fill(0).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-lg" />
                ))}
              </div>
            ) : !activity || activity.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-16 text-slate-500">
                <Terminal className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm font-mono">No activity yet</p>
              </div>
            ) : (
              activity.slice(0, 20).map((act: any, i: number) => {
                const user = act.user ?? act.username ?? "unknown";
                const action = act.action ?? act.event ?? "—";
                const guild = act.guild ?? act.guildName ?? "";
                const ts = act.time ?? (act.createdAt ? new Date(act.createdAt).toLocaleTimeString("en-GB") : "");
                const ok = act.result === "win" || act.result === "ok" || act.result === true;
                return (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-2 hover:bg-white/[0.03] rounded-lg transition-colors group"
                  >
                    <span className="text-xs font-mono text-slate-500 w-16 shrink-0">{ts}</span>
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold font-mono ${avatarColor(user)} shrink-0 border border-current opacity-80 group-hover:opacity-100`}
                    >
                      {user.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-200 truncate">{user}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#050810] border border-slate-800 text-slate-300 shrink-0">
                          /{action}
                        </span>
                        {ok ? (
                          <CheckCircle2 className="w-3 h-3 text-[#22c55e] ml-auto shrink-0" />
                        ) : (
                          <AlertCircle className="w-3 h-3 text-[#f5c518] ml-auto shrink-0" />
                        )}
                      </div>
                      {guild && (
                        <span className="text-[10px] text-slate-500 truncate mt-0.5">via {guild}</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Top Commands */}
        <div className="lg:col-span-4 flex flex-col bg-[#0a0f1a] border border-slate-800/60 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800/60 bg-black/20">
            <h2 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
              <Command className="w-4 h-4 text-[#00f5d4]" />
              COMMAND FREQUENCY
            </h2>
          </div>
          <div className="flex-1 p-4">
            {commandsLoading ? (
              <div className="space-y-3 pt-2">
                {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-8 w-full rounded" />)}
              </div>
            ) : topCommands.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-16 text-slate-500">
                <Command className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm font-mono">No command data yet</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={topCommands}
                  layout="vertical"
                  margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="sakuraBarGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#ff2d6b" stopOpacity={0.85} />
                      <stop offset="100%" stopColor="#00f5d4" stopOpacity={0.85} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke="#1e293b" opacity={0.4} />
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="command"
                    type="category"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#94a3b8", fontSize: 12, fontFamily: "JetBrains Mono, monospace" }}
                    width={80}
                  />
                  <RechartsTooltip
                    cursor={{ fill: "rgba(255,255,255,0.02)" }}
                    contentStyle={{
                      backgroundColor: "#0a0f1a",
                      borderColor: "#334155",
                      borderRadius: "8px",
                      fontFamily: "JetBrains Mono, monospace",
                      fontSize: "12px",
                    }}
                    itemStyle={{ color: "#00f5d4" }}
                    formatter={(v: number) => [formatNumber(v), "uses"]}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={22}>
                    {topCommands.map((_: any, idx: number) => (
                      <Cell key={idx} fill="url(#sakuraBarGrad)" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Active Nodes */}
        <div className="lg:col-span-3 flex flex-col bg-[#0a0f1a] border border-slate-800/60 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800/60 bg-black/20">
            <h2 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
              <Database className="w-4 h-4 text-[#f5c518]" />
              ACTIVE NODES
            </h2>
          </div>
          <div className="flex flex-col gap-3 p-4">
            {topGuilds.length === 0 ? (
              <>
                {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
              </>
            ) : (
              topGuilds.map((guild: any, i: number) => (
                <div
                  key={i}
                  className="flex flex-col p-3 rounded-lg bg-[#050810] border border-white/5 relative overflow-hidden group hover:border-white/10 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2 relative z-10">
                    <span className="text-sm font-bold text-slate-200 truncate">{guild.name}</span>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <span className="w-2 h-2 rounded-full bg-[#22c55e] shadow-[0_0_8px_#22c55e]" />
                      <span className="text-[10px] uppercase font-bold tracking-wider text-[#22c55e]">healthy</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono text-slate-500 relative z-10">
                    <span>{formatNumber(guild.memberCount)} members</span>
                    <span className="uppercase text-[9px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10">
                      {guild.id?.slice(0, 6) ?? "guild"}
                    </span>
                  </div>
                  <div className="absolute bottom-0 right-0 w-16 h-16 rounded-full blur-xl -mr-8 -mb-8 pointer-events-none opacity-20 group-hover:opacity-30 transition-opacity bg-[#22c55e]" />
                </div>
              ))
            )}

            {topGuilds.length > 0 && (
              <a
                href="./guilds"
                className="mt-1 w-full py-2.5 rounded-lg border border-dashed border-slate-700 text-xs font-bold text-slate-400 uppercase tracking-widest hover:border-[#ff2d6b]/50 hover:text-[#ff2d6b] transition-colors flex items-center justify-center gap-2"
              >
                View All Nodes
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── StatCard ──────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  delta,
  trend,
  icon: Icon,
  isLoading,
}: {
  label: string;
  value: string | null;
  delta: string | null;
  trend: "up" | "down" | "neutral";
  icon: React.ElementType;
  isLoading: boolean;
}) {
  return (
    <div className="bg-[#0a0f1a] border border-slate-800/60 rounded-xl p-4 flex flex-col relative overflow-hidden group hover:border-[#ff2d6b]/30 transition-colors">
      <div className="absolute top-0 right-0 w-24 h-24 bg-[#ff2d6b]/5 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none group-hover:bg-[#ff2d6b]/10 transition-colors" />
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
        <Icon className="w-4 h-4 text-slate-600 group-hover:text-[#ff2d6b]/70 transition-colors" />
      </div>
      <div className="text-2xl font-bold font-mono text-white mb-1">
        {isLoading ? <Skeleton className="h-8 w-20 rounded" /> : (value ?? "—")}
      </div>
      <div className="flex items-center gap-1 mt-auto">
        <span
          className={`text-xs font-mono font-medium ${
            trend === "up"
              ? "text-[#22c55e]"
              : trend === "down"
              ? "text-[#f5c518]"
              : "text-slate-400"
          }`}
        >
          {delta ?? ""}
        </span>
      </div>
    </div>
  );
}
