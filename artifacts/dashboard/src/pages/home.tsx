import { useGetBotStats, useGetBotActivity, getGetBotStatsQueryKey, getGetBotActivityQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Server, Users, Clock, Zap, Terminal } from "lucide-react";
import { formatUptime, formatNumber } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";

export default function Home() {
  const { data: stats, isLoading: statsLoading } = useGetBotStats({
    query: {
      queryKey: getGetBotStatsQueryKey(),
      refetchInterval: 30000,
    }
  });

  const { data: activity, isLoading: activityLoading } = useGetBotActivity({
    query: {
      queryKey: getGetBotActivityQueryKey(),
      refetchInterval: 30000,
    }
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Real-time overview of bot operations.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatCard 
          title="Servers" 
          value={stats?.guildCount ? formatNumber(stats.guildCount) : undefined} 
          icon={Server} 
          isLoading={statsLoading} 
        />
        <StatCard 
          title="Users" 
          value={stats?.userCount ? formatNumber(stats.userCount) : undefined} 
          icon={Users} 
          isLoading={statsLoading} 
        />
        <StatCard 
          title="Commands" 
          value={stats?.commandsExecuted ? formatNumber(stats.commandsExecuted) : undefined} 
          icon={Terminal} 
          isLoading={statsLoading} 
        />
        <StatCard 
          title="Uptime" 
          value={stats?.uptime ? formatUptime(stats.uptime) : undefined} 
          icon={Clock} 
          isLoading={statsLoading} 
        />
        <StatCard 
          title="Ping" 
          value={stats?.ping ? `${stats.ping}ms` : undefined} 
          icon={Zap} 
          isLoading={statsLoading} 
          valueColor={stats && stats.ping > 200 ? "text-destructive" : stats && stats.ping > 100 ? "text-yellow-500" : "text-primary"}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
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
                Array(5).fill(0).map((_, i) => (
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
                    <div className={`mt-0.5 rounded-full p-1.5 ${entry.success ? "bg-primary/20 text-primary" : "bg-destructive/20 text-destructive"}`}>
                      <Terminal className="h-4 w-4" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="font-medium text-foreground">
                        <span className="text-primary mr-1">/{entry.command}</span>
                        <span className="text-muted-foreground font-normal">used by</span> {entry.username}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        in {entry.guildName} • {formatDistanceToNow(new Date(entry.executedAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-muted-foreground py-8">No recent activity</div>
              )}
            </div>
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
  icon: any; 
  isLoading: boolean;
  valueColor?: string;
}) {
  return (
    <Card className="border-card-border bg-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <div className={`text-2xl font-bold ${valueColor}`}>{value || "-"}</div>
        )}
      </CardContent>
    </Card>
  );
}
