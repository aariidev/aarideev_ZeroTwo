import { useState } from "react";
import { useGetCommandStats, getGetCommandStatsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/format";
import { formatDistanceToNow } from "date-fns";
import { Terminal, BarChart2, Search } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const CATEGORY_MAP: Record<string, string> = {
  ping: "utility", avatar: "utility", serverinfo: "utility", userinfo: "utility", help: "utility",
  ban: "moderation", kick: "moderation", mute: "moderation", unmute: "moderation",
  warn: "moderation", warns: "moderation", clearwarns: "moderation", purge: "moderation",
  "8ball": "fun", poker: "fun", ship: "fun",
};

const CATEGORY_COLORS: Record<string, string> = {
  utility: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  moderation: "bg-primary/15 text-primary border-primary/20",
  fun: "bg-green-500/15 text-green-400 border-green-500/20",
};

export default function Commands() {
  const [search, setSearch] = useState("");

  const { data: stats, isLoading } = useGetCommandStats({
    query: { queryKey: getGetCommandStatsQueryKey(), refetchInterval: 30000 }
  });

  const chartConfig = { count: { label: "Uses", color: "url(#colorCount)" } };
  const chartData = stats?.slice(0, 10).map(s => ({ command: s.command, count: s.count })) || [];

  const filtered = stats?.filter(s =>
    s.command.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const totalUses = stats?.reduce((acc, s) => acc + s.count, 0) || 0;

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-primary font-display flex items-center gap-2 glow-text">
            <Terminal className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            COMMAND_DB
          </h1>
          <p className="text-muted-foreground mt-1 font-mono-custom text-sm">Command execution statistics and usage frequency.</p>
        </div>
        {!isLoading && stats && (
          <div className="text-right">
            <div className="text-xl sm:text-2xl font-bold text-foreground font-mono-custom">{formatNumber(totalUses)}</div>
            <div className="text-xs text-primary font-mono-custom">total_executions</div>
          </div>
        )}
      </div>

      <Card className="border-card-border bg-card rounded-none corner-bracket glow-cyan">
        <CardHeader>
          <CardTitle className="text-base sm:text-lg flex items-center gap-2 font-display text-[#00f5d4]">
            <BarChart2 className="h-5 w-5" />
            Top 10 Commands
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[240px] sm:h-[300px] w-full rounded-none" />
          ) : stats && stats.length > 0 ? (
            <div className="h-[240px] sm:h-[300px] w-full">
              <ChartContainer config={chartConfig} className="h-full w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                    <defs>
                      <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(340 95% 60%)" stopOpacity={1}/>
                        <stop offset="100%" stopColor="hsl(280 80% 60%)" stopOpacity={1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="command" tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--primary))", fontFamily: "var(--app-font-mono)", fontSize: 11 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--primary))", fontFamily: "var(--app-font-mono)", fontSize: 11 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill="url(#colorCount)" radius={[0, 0, 0, 0]} maxBarSize={60} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          ) : (
            <div className="h-[240px] sm:h-[300px] flex items-center justify-center text-muted-foreground font-mono-custom">No command data available</div>
          )}
        </CardContent>
      </Card>

      <Card className="border-card-border bg-card rounded-none corner-bracket glow-primary">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2 font-display text-primary">
              <Terminal className="h-5 w-5" />
              All Commands
            </CardTitle>
            <div className="relative w-full sm:w-64 sm:ml-auto">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-primary" />
              <Input
                placeholder="Filter commands..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9 bg-sidebar border-primary/50 text-sm font-mono-custom rounded-none focus-visible:ring-primary"
                data-testid="input-filter-commands"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-none" />)}
            </div>
          ) : filtered.length > 0 ? (
            <div className="rounded-none border border-primary/30 overflow-x-auto bg-[#050505]">
              <Table className="min-w-[540px]">
                <TableHeader className="bg-sidebar border-b border-primary/30">
                  <TableRow className="border-none hover:bg-transparent">
                    <TableHead className="w-10 text-primary font-mono-custom">#</TableHead>
                    <TableHead className="text-primary font-mono-custom">CMD</TableHead>
                    <TableHead className="text-primary font-mono-custom">CAT</TableHead>
                    <TableHead className="text-right text-primary font-mono-custom">USES</TableHead>
                    <TableHead className="text-right text-primary font-mono-custom">LAST_USED</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((stat, index) => {
                    const category = CATEGORY_MAP[stat.command] || "utility";
                    return (
                      <TableRow key={stat.command} className="border-b border-primary/10 hover:bg-primary/5">
                        <TableCell className="text-zinc-500 font-mono-custom text-xs w-10">[{index + 1}]</TableCell>
                        <TableCell className="font-bold text-[#00f5d4] font-mono-custom">/{stat.command}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center rounded-none border px-2 py-0.5 text-[10px] font-bold font-mono-custom uppercase ${CATEGORY_COLORS[category]}`}>
                            {category}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono-custom text-foreground">{formatNumber(stat.count)}</TableCell>
                        <TableCell className="text-right text-zinc-400 text-xs font-mono-custom whitespace-nowrap">
                          {formatDistanceToNow(new Date(stat.lastUsed), { addSuffix: true })}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : search ? (
            <div className="text-center py-8 text-primary font-mono-custom">No commands match "{search}"</div>
          ) : (
            <div className="text-center py-8 text-primary font-mono-custom">No commands have been executed yet.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
