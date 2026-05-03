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
  "8ball": "fun", coinflip: "fun", roll: "fun",
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

  const chartConfig = { count: { label: "Uses", color: "hsl(var(--chart-1))" } };
  const chartData = stats?.slice(0, 10).map(s => ({ command: s.command, count: s.count })) || [];

  const filtered = stats?.filter(s =>
    s.command.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const totalUses = stats?.reduce((acc, s) => acc + s.count, 0) || 0;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Terminal className="h-8 w-8 text-primary" />
            Commands
          </h1>
          <p className="text-muted-foreground mt-1">Command execution statistics and usage frequency.</p>
        </div>
        {!isLoading && stats && (
          <div className="text-right">
            <div className="text-2xl font-bold text-foreground">{formatNumber(totalUses)}</div>
            <div className="text-xs text-muted-foreground">total executions</div>
          </div>
        )}
      </div>

      <Card className="border-card-border bg-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-primary" />
            Top 10 Commands
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : stats && stats.length > 0 ? (
            <div className="h-[300px] w-full">
              <ChartContainer config={chartConfig} className="h-full w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="command" tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} maxBarSize={60} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">No command data available</div>
          )}
        </CardContent>
      </Card>

      <Card className="border-card-border bg-card">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Terminal className="h-5 w-5 text-primary" />
              All Commands
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filter commands..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9 bg-sidebar border-border text-sm"
                data-testid="input-filter-commands"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : filtered.length > 0 ? (
            <div className="rounded-md border border-border overflow-hidden">
              <Table>
                <TableHeader className="bg-sidebar">
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Command</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Total Uses</TableHead>
                    <TableHead className="text-right">Last Used</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((stat, index) => {
                    const category = CATEGORY_MAP[stat.command] || "utility";
                    return (
                      <TableRow key={stat.command} className="border-border hover:bg-sidebar/50">
                        <TableCell className="text-muted-foreground text-xs w-10">{index + 1}</TableCell>
                        <TableCell className="font-medium text-primary">/{stat.command}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[category]}`}>
                            {category}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono">{formatNumber(stat.count)}</TableCell>
                        <TableCell className="text-right text-muted-foreground text-sm">
                          {formatDistanceToNow(new Date(stat.lastUsed), { addSuffix: true })}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : search ? (
            <div className="text-center py-8 text-muted-foreground">No commands match "{search}"</div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">No commands have been executed yet.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
