import { useGetBotStats, useGetBotActivity, useGetCommandStats, getGetBotStatsQueryKey, getGetBotActivityQueryKey, getGetCommandStatsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Server, Users, Clock, Zap, Terminal, BarChart2 } from "lucide-react";
import { formatUptime, formatNumber } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { TerminalConsole } from "@/components/terminal-console";

export default function Home() {
  const { data: stats, isLoading: statsLoading } = useGetBotStats({
    query: { queryKey: getGetBotStatsQueryKey(), refetchInterval: 15000 }
  });

  const { data: activity, isLoading: activityLoading } = useGetBotActivity({
    query: { queryKey: getGetBotActivityQueryKey(), refetchInterval: 15000 }
  });

  const { data: commandStats, isLoading: commandsLoading } = useGetCommandStats({
    query: { queryKey: getGetCommandStatsQueryKey(), refetchInterval: 30000 }
  });

  const isOnline = stats !== undefined && stats.ping >= 0;
  const topCommands = commandStats?.slice(0, 5) || [];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground font-display">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Real-time overview of bot operations.</p>
        </div>
        <div className={`flex items-center gap-2 border px-3 py-1.5 text-xs font-semibold font-display ${
          isOnline
            ? "border-[#00f5d4]/50 bg-[#00f5d4]/10 text-[#00f5d4] glow-cyan"
            : "border-zinc-500/30 bg-zinc-500/10 text-zinc-400"
        }`}>
          <span className={`h-2 w-2 rounded-none ${isOnline ? "bg-[#00f5d4] animate-pulse" : "bg-zinc-500"}`} />
          {isOnline ? "ONLINE" : "OFFLINE"}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatCard
          title="Servers"
          value={stats !== undefined ? formatNumber(stats.guildCount) : undefined}
          icon={Server}
          isLoading={statsLoading}
        />
        <StatCard
          title="Users"
          value={stats !== undefined ? formatNumber(stats.userCount) : undefined}
          icon={Users}
          isLoading={statsLoading}
        />
        <StatCard
          title="Commands"
          value={stats !== undefined ? formatNumber(stats.commandsExecuted) : undefined}
          icon={Terminal}
          isLoading={statsLoading}
        />
        <StatCard
          title="Uptime"
          value={stats?.uptime !== undefined ? formatUptime(stats.uptime) : undefined}
          icon={Clock}
          isLoading={statsLoading}
        />
        <StatCard
          title="Ping"
          value={stats?.ping !== undefined ? `${stats.ping}ms` : undefined}
          icon={Zap}
          isLoading={statsLoading}
          valueColor={
            stats?.ping === undefined ? "text-foreground"
            : stats.ping < 0 ? "text-zinc-400"
            : stats.ping > 200 ? "text-destructive"
            : stats.ping > 100 ? "text-yellow-500"
            : "text-primary"
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-7">
        <div className="col-span-4 flex flex-col space-y-2">
          <h2 className="text-lg flex items-center gap-2 font-display text-primary glow-text">
            <Activity className="h-5 w-5" />
            Live Activity Feed
          </h2>
          {activityLoading ? (
            <Skeleton className="h-[400px] w-full rounded-none" />
          ) : (
            <TerminalConsole activity={activity || []} />
          )}
        </div>

        <Card className="col-span-3 border-card-border bg-card rounded-none corner-bracket glow-cyan">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 font-display text-[#00f5d4]">
              <BarChart2 className="h-5 w-5" />
              Top Commands
            </CardTitle>
          </CardHeader>
          <CardContent>
            {commandsLoading ? (
              <div className="space-y-3">
                {Array(5).fill(0).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-8" />
                  </div>
                ))}
              </div>
            ) : topCommands.length > 0 ? (
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topCommands} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="command"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12, fontFamily: "var(--app-font-mono)" }}
                      width={70}
                    />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--muted)/0.1)" }}
                      contentStyle={{
                        background: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--primary))",
                        borderRadius: "0px",
                        color: "hsl(var(--popover-foreground))",
                        fontSize: "12px",
                        fontFamily: "var(--app-font-mono)",
                        boxShadow: "0 0 10px hsl(var(--primary)/0.5)",
                      }}
                      formatter={(value: number) => [formatNumber(value), "uses"]}
                    />
                    <Bar dataKey="count" radius={[0, 0, 0, 0]} maxBarSize={24}>
                      {topCommands.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={`hsl(340, 95%, ${50 + index * 5}%)`} className="glow-primary" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-[260px] items-center justify-center text-muted-foreground text-sm font-mono-custom">
                No commands executed yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  isLoading,
  valueColor = "text-foreground"
}: {
  title: string;
  value?: string;
  icon: React.ElementType;
  isLoading: boolean;
  valueColor?: string;
}) {
  return (
    <Card className="border-card-border bg-card rounded-none corner-bracket glow-primary">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground font-display">{title}</CardTitle>
        <Icon className="h-4 w-4 text-primary" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <div className={`text-2xl font-bold font-mono-custom ${valueColor}`}>{value ?? "—"}</div>
        )}
      </CardContent>
    </Card>
  );
}
