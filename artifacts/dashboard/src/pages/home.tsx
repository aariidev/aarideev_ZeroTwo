import { useGetBotStats, useGetBotActivity, useGetCommandStats, getGetBotStatsQueryKey, getGetBotActivityQueryKey, getGetCommandStatsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Server, Users, Clock, Zap, Terminal, BarChart2 } from "lucide-react";
import { formatUptime, formatNumber } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";

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
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Real-time overview of bot operations.</p>
        </div>
        <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
          isOnline
            ? "border-green-500/30 bg-green-500/10 text-green-400"
            : "border-zinc-500/30 bg-zinc-500/10 text-zinc-400"
        }`}>
          <span className={`h-2 w-2 rounded-full ${isOnline ? "bg-green-500 animate-pulse" : "bg-zinc-500"}`} />
          {isOnline ? "Online" : "Offline"}
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
        <Card className="col-span-4 border-card-border bg-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activityLoading ? (
                Array(6).fill(0).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))
              ) : activity && activity.length > 0 ? (
                activity.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-4 text-sm border-b border-border/50 pb-4 last:border-0 last:pb-0">
                    <div className={`mt-0.5 rounded-full p-1.5 flex-shrink-0 ${entry.success ? "bg-primary/20 text-primary" : "bg-destructive/20 text-destructive"}`}>
                      <Terminal className="h-4 w-4" />
                    </div>
                    <div className="flex-1 space-y-1 min-w-0">
                      <p className="font-medium text-foreground">
                        <span className="text-primary mr-1">/{entry.command}</span>
                        <span className="text-muted-foreground font-normal">used by</span>{" "}
                        <span>{entry.username}</span>
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        in {entry.guildName} • {formatDistanceToNow(new Date(entry.executedAt), { addSuffix: true })}
                      </p>
                    </div>
                    {!entry.success && (
                      <span className="text-xs text-destructive bg-destructive/10 rounded px-1.5 py-0.5 flex-shrink-0">failed</span>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center text-muted-foreground py-8">No recent activity</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3 border-card-border bg-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-primary" />
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
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                      width={70}
                    />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--muted)/0.1)" }}
                      contentStyle={{
                        background: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "6px",
                        color: "hsl(var(--popover-foreground))",
                        fontSize: "12px",
                      }}
                      formatter={(value: number) => [formatNumber(value), "uses"]}
                    />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} maxBarSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-[260px] items-center justify-center text-muted-foreground text-sm">
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
    <Card className="border-card-border bg-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <div className={`text-2xl font-bold ${valueColor}`}>{value ?? "—"}</div>
        )}
      </CardContent>
    </Card>
  );
}
