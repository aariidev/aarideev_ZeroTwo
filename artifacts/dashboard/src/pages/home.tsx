import { useEffect } from "react";
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
  Database,
  ArrowUpRight,
} from "lucide-react";
import { Link } from "wouter";
import { formatUptime, formatNumber } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivityFeed } from "@/components/activity-feed";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { ConnectionStrip } from "@/components/dash/connection-strip";
import { KpiCard } from "@/components/dash/kpi-card";
import { SectionShell } from "@/components/dash/section-shell";
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

export default function Home() {
  const { user, isOwner } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("welcome") !== "1" || !user) return;
    const name = user.globalName || user.username;
    toast({
      title: `Hola, ${name}`,
      description: isOwner
        ? "Sesión owner activa · ves todos los servidores del bot."
        : "Sesión iniciada · solo ves tus servidores (donde eres staff/admin).",
    });
    params.delete("welcome");
    const qs = params.toString();
    const next = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", next);
  }, [user, isOwner, toast]);

  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
  } = useGetBotStats({
    query: {
      queryKey: getGetBotStatsQueryKey(),
      refetchInterval: 5000,
      retry: 1,
    },
  });

  const {
    data: activity,
    isLoading: activityLoading,
    isFetching: activityFetching,
  } = useGetBotActivity({
    query: { queryKey: getGetBotActivityQueryKey(), refetchInterval: 5000 },
  });

  const { data: commandStats, isLoading: commandsLoading } = useGetCommandStats({
    query: { queryKey: getGetCommandStatsQueryKey(), refetchInterval: 30000 },
  });

  const { data: guilds } = useListGuilds({
    query: {
      queryKey: getListGuildsQueryKey(),
      refetchInterval: 120000,
      staleTime: 60000,
    },
  });

  const { data: warns } = useListWarns(undefined, {
    query: {
      queryKey: getListWarnsQueryKey(),
      refetchInterval: 60000,
    },
  });

  const topCommands = commandStats?.slice(0, 6) ?? [];
  const topGuilds = (guilds ?? [])
    .slice()
    .sort((a, b) => b.memberCount - a.memberCount)
    .slice(0, 4);
  const warningCount = Array.isArray(warns) ? warns.length : 0;
  const ping = stats?.ping ?? -1;
  const isOnline =
    !statsError &&
    stats !== undefined &&
    ((stats as { online?: boolean }).online === true ||
      (typeof stats.ping === "number" && stats.ping >= 0));

  const kpis = [
    {
      label: "Guilds",
      value: stats ? formatNumber(stats.guildCount) : null,
      hint: "servidores conectados",
      icon: Server,
      accent: "pink" as const,
    },
    {
      label: "Users",
      value: stats ? formatNumber(stats.userCount) : null,
      hint: "en caché del bot",
      icon: Users,
      accent: "cyan" as const,
    },
    {
      label: "Commands",
      value: stats ? formatNumber(stats.commandsExecuted) : null,
      hint: "ejecuciones totales",
      icon: Command,
      accent: "pink" as const,
    },
    {
      label: "Ping",
      value: ping >= 0 ? `${ping}ms` : "—",
      hint:
        ping < 0
          ? "offline"
          : ping < 100
            ? "excelente"
            : ping < 200
              ? "bueno"
              : "degradado",
      icon: Zap,
      accent: (ping >= 0 && ping < 200 ? "green" : "amber") as "green" | "amber",
    },
    {
      label: "Warnings",
      value: warningCount > 0 ? String(warningCount) : "0",
      hint: "en base de datos",
      icon: ShieldAlert,
      accent: "amber" as const,
    },
    {
      label: "Uptime",
      value: stats?.uptime != null ? formatUptime(stats.uptime) : null,
      hint: "proceso actual",
      icon: Clock,
      accent: "cyan" as const,
    },
  ];

  return (
    <div className="flex flex-col gap-5 sm:gap-6 max-w-[1400px]">
      <ConnectionStrip
        botName={stats?.botName}
        botTag={(stats as { botTag?: string })?.botTag}
        botAvatar={stats?.botAvatar}
        online={isOnline}
        ping={ping}
        guildCount={stats?.guildCount}
        apiError={statsError}
      />

      {/* KPI grid — 21st-style stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        {kpis.map((kpi) => (
          <KpiCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            hint={kpi.hint}
            icon={kpi.icon}
            accent={kpi.accent}
            isLoading={statsLoading && kpi.value === null}
          />
        ))}
      </div>

      {/* Bento lower grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 sm:gap-5">
        <div className="xl:col-span-5 min-h-[360px] flex flex-col">
          <ActivityFeed
            activity={activity}
            isLoading={activityLoading}
            isFetching={activityFetching}
          />
        </div>

        <SectionShell
          title="Command frequency"
          icon={Command}
          accent="cyan"
          className="xl:col-span-4 min-h-[360px]"
          bodyClassName="p-3 sm:p-4"
        >
          {commandsLoading ? (
            <div className="space-y-3 pt-2">
              {Array(5)
                .fill(0)
                .map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full rounded-lg" />
                ))}
            </div>
          ) : topCommands.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[240px] text-slate-500">
              <Command className="w-8 h-8 mb-3 opacity-30" />
              <p className="text-sm font-mono">Sin datos aún</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={topCommands}
                layout="vertical"
                margin={{ top: 4, right: 12, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="kpiBarGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#ff2d6b" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#00f5d4" stopOpacity={0.85} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal
                  vertical={false}
                  stroke="#1e293b"
                  opacity={0.45}
                />
                <XAxis type="number" hide />
                <YAxis
                  dataKey="command"
                  type="category"
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: "#94a3b8",
                    fontSize: 11,
                    fontFamily: "JetBrains Mono, monospace",
                  }}
                  width={78}
                />
                <RechartsTooltip
                  cursor={{ fill: "rgba(255,255,255,0.03)" }}
                  contentStyle={{
                    backgroundColor: "#0a0f1a",
                    borderColor: "#334155",
                    borderRadius: "12px",
                    fontFamily: "JetBrains Mono, monospace",
                    fontSize: "12px",
                  }}
                  itemStyle={{ color: "#00f5d4" }}
                  formatter={(v: number) => [formatNumber(v), "uses"]}
                />
                <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={18}>
                  {topCommands.map((_, idx) => (
                    <Cell key={idx} fill="url(#kpiBarGrad)" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionShell>

        <SectionShell
          title="Top servers"
          icon={Database}
          accent="amber"
          className="xl:col-span-3 min-h-[360px]"
          action={
            <Link
              href="/guilds"
              className="text-[10px] font-mono text-slate-500 hover:text-[#ff2d6b] inline-flex items-center gap-0.5 transition-colors"
            >
              Ver todos
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          }
          bodyClassName="p-3 sm:p-4 flex flex-col gap-2.5"
        >
          {topGuilds.length === 0 ? (
            <div className="flex flex-col gap-2.5">
              {Array(3)
                .fill(0)
                .map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-xl" />
                ))}
            </div>
          ) : (
            topGuilds.map((guild) => (
              <div
                key={guild.id}
                className="flex items-center gap-3 rounded-xl border border-white/[0.04] bg-[#050810]/80 p-3 hover:border-[#00f5d4]/25 hover:bg-[#050810] transition-colors"
              >
                <div className="h-9 w-9 rounded-lg overflow-hidden border border-white/10 flex-shrink-0 bg-slate-900 flex items-center justify-center">
                  {guild.iconUrl ? (
                    <img
                      src={guild.iconUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-[10px] font-mono text-slate-400">
                      {guild.name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-100 truncate">
                    {guild.name}
                  </p>
                  <p className="text-[11px] font-mono text-slate-500">
                    {formatNumber(guild.memberCount)} members
                  </p>
                </div>
                <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e] shadow-[0_0_6px_#22c55e] flex-shrink-0" />
              </div>
            ))
          )}
        </SectionShell>
      </div>
    </div>
  );
}
