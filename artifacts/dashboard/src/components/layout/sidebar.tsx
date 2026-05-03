import { Link, useLocation } from "wouter";
import { Activity, Server, Terminal, AlertTriangle } from "lucide-react";
import { useGetBotStats, getGetBotStatsQueryKey } from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

export function Sidebar() {
  const [location] = useLocation();

  const { data: stats, isLoading } = useGetBotStats({
    query: {
      queryKey: getGetBotStatsQueryKey(),
      refetchInterval: 15000,
    }
  });

  const isOnline = stats !== undefined && stats.ping >= 0;

  const links = [
    { href: "/", label: "Dashboard", icon: Activity, exact: true },
    { href: "/guilds", label: "Servers", icon: Server },
    { href: "/commands", label: "Commands", icon: Terminal },
    { href: "/warns", label: "Warnings", icon: AlertTriangle },
  ];

  return (
    <div className="flex h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="p-6">
        <div className="flex items-center gap-3">
          {isLoading ? (
            <Skeleton className="h-10 w-10 rounded-full" />
          ) : (
            <div className="relative">
              <Avatar className="h-10 w-10 border border-sidebar-border">
                <AvatarImage src={stats?.botAvatar || ""} alt={stats?.botName || "Bot"} />
                <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground">
                  {stats?.botName?.substring(0, 2).toUpperCase() || "ZT"}
                </AvatarFallback>
              </Avatar>
              <span
                className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-sidebar ${isOnline ? "bg-green-500" : "bg-zinc-500"}`}
                title={isOnline ? "Online" : "Offline"}
              />
            </div>
          )}
          <div className="flex flex-col overflow-hidden">
            {isLoading ? (
              <>
                <Skeleton className="h-5 w-24 mb-1" />
                <Skeleton className="h-3 w-16" />
              </>
            ) : (
              <>
                <span className="truncate font-bold tracking-tight text-lg text-sidebar-primary">
                  {stats?.botName || "ZeroTwo"}
                </span>
                <span className={`text-xs font-medium ${isOnline ? "text-green-400" : "text-zinc-400"}`}>
                  {isOnline ? "Online" : "Offline"}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-4 py-4">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = link.exact ? location === link.href : location.startsWith(link.href);

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-sidebar-primary/10 text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
              data-testid={`link-sidebar-${link.label.toLowerCase()}`}
            >
              <Icon className={`h-4 w-4 ${isActive ? "text-sidebar-primary" : "text-sidebar-foreground/50"}`} />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 pb-6">
        <div className="rounded-md border border-sidebar-border bg-sidebar-accent/30 px-3 py-2 text-xs text-sidebar-foreground/50 font-mono">
          v{stats?.version || "2.0.0"}
        </div>
      </div>
    </div>
  );
}
