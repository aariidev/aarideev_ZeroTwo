import { Link, useLocation } from "wouter";
import { Activity, Server, Terminal, AlertTriangle, FileText, Shield, Settings } from "lucide-react";
import { useGetBotStats, getGetBotStatsQueryKey } from "@workspace/api-client-react";

const links = [
  { href: "/",        label: "Dashboard", icon: Activity,      exact: true },
  { href: "/guilds",  label: "Servers",   icon: Server },
  { href: "/commands",label: "Commands",  icon: Terminal },
  { href: "/warns",   label: "Warnings",  icon: AlertTriangle },
  { href: "/logs",    label: "Logs",      icon: FileText },
  { href: "/dev",     label: "Dev Panel", icon: Shield },
];

function SidebarItem({
  icon: Icon,
  label,
  active,
  href,
}: {
  icon: React.ElementType;
  label: string;
  active: boolean;
  href: string;
}) {
  return (
    <Link href={href}>
      <div className="group relative flex items-center justify-center w-12 h-12 rounded-xl mb-1 cursor-pointer transition-all duration-200">
        <div
          className={`absolute inset-0 rounded-xl transition-all duration-200 border ${
            active
              ? "bg-[#ff2d6b]/10 border-[#ff2d6b]/30 shadow-[0_0_12px_rgba(255,45,107,0.15)]"
              : "border-transparent group-hover:bg-white/5 group-hover:border-white/5"
          }`}
        />
        <Icon
          className={`relative z-10 w-5 h-5 transition-colors duration-200 ${
            active ? "text-[#ff2d6b]" : "text-slate-400 group-hover:text-slate-200"
          }`}
        />
        {/* Tooltip */}
        <div className="absolute left-[calc(100%+12px)] px-2 py-1 bg-[#0a0f1a] border border-[#ff2d6b]/20 text-slate-200 text-xs font-medium rounded opacity-0 -translate-x-1 pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 whitespace-nowrap z-50">
          {label}
        </div>
      </div>
    </Link>
  );
}

export function Sidebar() {
  const [location] = useLocation();

  const { data: stats } = useGetBotStats({
    query: { queryKey: getGetBotStatsQueryKey(), refetchInterval: 15000 },
  });

  const isOnline = stats !== undefined && stats.ping >= 0;

  return (
    <aside className="w-[72px] bg-[#03050a] border-r border-[#ff2d6b]/20 flex flex-col items-center py-6 z-20 shadow-[4px_0_24px_rgba(0,0,0,0.5)] flex-shrink-0 h-screen">
      {/* Bot logo */}
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#ff2d6b] to-[#00f5d4] p-[2px] mb-8 shadow-[0_0_20px_rgba(255,45,107,0.3)] relative">
        <div className="w-full h-full bg-[#050810] rounded-full flex items-center justify-center">
          <span className="font-bold text-xs text-white font-mono">02</span>
        </div>
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#03050a] ${
            isOnline ? "bg-green-500 shadow-[0_0_6px_#22c55e]" : "bg-zinc-500"
          }`}
        />
      </div>

      {/* Nav */}
      <nav className="flex-1 w-full flex flex-col items-center">
        {links.map((link) => {
          const isActive = link.exact ? location === link.href : location.startsWith(link.href);
          return (
            <SidebarItem
              key={link.href}
              icon={link.icon}
              label={link.label}
              active={isActive}
              href={link.href}
            />
          );
        })}
      </nav>

      {/* Settings at bottom */}
      <div className="group relative flex items-center justify-center w-12 h-12 rounded-xl cursor-pointer transition-all duration-200 mt-auto">
        <div className="absolute inset-0 rounded-xl border border-transparent group-hover:bg-white/5 group-hover:border-white/5 transition-all duration-200" />
        <Settings className="relative z-10 w-5 h-5 text-slate-500 group-hover:text-slate-200 transition-colors duration-200" />
        <div className="absolute left-[calc(100%+12px)] px-2 py-1 bg-[#0a0f1a] border border-[#ff2d6b]/20 text-slate-200 text-xs font-medium rounded opacity-0 -translate-x-1 pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 whitespace-nowrap z-50">
          Settings
        </div>
      </div>
    </aside>
  );
}
