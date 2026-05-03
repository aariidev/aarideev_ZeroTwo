import { Link, useLocation } from "wouter";
import { Activity, Server, Terminal, AlertTriangle, Shield, FileText } from "lucide-react";
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
    { href: "/logs", label: "Logs", icon: FileText },
    { href: "/dev", label: "Dev Panel", icon: Shield, dev: true },
  ];

  return (
    <div className="flex h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="p-6">
        <div className="flex items-center gap-3">
          {isLoading ? (
            <Skeleton className="h-10 w-10 rounded-full" />
          ) : (
            <div className="relative">
              <Avatar className="h-10 w-10 border border-sidebar-border corner-bracket rounded-none glow-primary">
                <AvatarImage src={stats?.botAvatar || ""} alt={stats?.botName || "Bot"} className="rounded-none" />
                <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground rounded-none font-display">
                  {stats?.botName?.substring(0, 2).toUpperCase() || "ZT"}
                </AvatarFallback>
              </Avatar>
              <span
                className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-none border border-sidebar ${isOnline ? "bg-green-500 glow-cyan animate-pulse" : "bg-zinc-500"}`}
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
                <span className="truncate font-bold tracking-tight text-lg text-sidebar-primary font-display">
                  {stats?.botName || "ZeroTwo"}
                </span>
                <span className={`text-[10px] font-mono-custom tracking-widest ${isOnline ? "text-[#00f5d4] animate-pulse" : "text-zinc-400"}`}>
                  {isOnline ? "SISTEMA ACTIVO" : "SISTEMA CAIDO"}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
      
      <div className="h-px bg-gradient-to-r from-transparent via-primary to-transparent mx-4 mb-4" />

      <nav className="flex-1 space-y-1 px-4 py-4">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = link.exact ? location === link.href : location.startsWith(link.href);

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 rounded-none px-3 py-2.5 text-sm font-medium transition-colors font-mono-custom border border-transparent ${
                isActive
                  ? "bg-sidebar-primary/10 text-sidebar-primary border-l-sidebar-primary glow-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:border-sidebar-accent-foreground/20"
              }`}
              data-testid={`link-sidebar-${link.label.toLowerCase()}`}
            >
              <Icon className={`h-4 w-4 ${isActive ? "text-sidebar-primary" : "text-sidebar-foreground/50"}`} />
              {isActive ? `> ${link.label}` : link.label}
            </Link>
          );
        })}
      </nav>

      <div className="h-px bg-gradient-to-r from-transparent via-sidebar-border to-transparent mx-4 mb-4" />

      <div className="px-4 pb-6">
        <div className="rounded-none border border-sidebar-border bg-sidebar-accent/30 px-3 py-2 text-xs text-sidebar-foreground/50 font-mono-custom text-center">
          [ ZeroTwo OS v2.1.0 ]
        </div>
      </div>
    </div>
  );
}
