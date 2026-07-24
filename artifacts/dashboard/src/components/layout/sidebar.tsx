import { Link, useLocation } from "wouter";
import {
  Activity,
  Server,
  Terminal,
  AlertTriangle,
  FileText,
  Shield,
  Settings,
  Ticket,
  FlaskConical,
} from "lucide-react";
import { useGetBotStats, getGetBotStatsQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { AccountMenu } from "@/components/account-menu";
import { cn } from "@/lib/utils";

type NavLink = {
  href: string;
  label: string;
  icon: React.ElementType;
  exact?: boolean;
  ownerOnly?: boolean;
};

const ALL_LINKS: NavLink[] = [
  { href: "/", label: "Dashboard", icon: Activity, exact: true },
  { href: "/guilds", label: "Servers", icon: Server },
  { href: "/commands", label: "Commands", icon: Terminal },
  { href: "/warns", label: "Warnings", icon: AlertTriangle },
  { href: "/tickets", label: "Tickets", icon: Ticket },
  { href: "/beta", label: "Beta Lab", icon: FlaskConical },
  { href: "/logs", label: "Logs", icon: FileText },
  // Visible ONLY if isOwner (OWNER_IDS) — never for admins/viewers
  { href: "/dev", label: "Dev Panel", icon: Shield, ownerOnly: true },
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
      <div
        className={cn(
          "group relative flex items-center justify-center w-11 h-11 rounded-xl cursor-pointer transition-all duration-200",
          active
            ? "bg-primary/15 text-primary"
            : "text-slate-400 hover:text-slate-100 hover:bg-white/5",
        )}
      >
        {active && (
          <span className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-r-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.7)]" />
        )}
        <Icon
          className={cn(
            "relative z-10 w-5 h-5 transition-colors",
            active && "drop-shadow-[0_0_6px_hsl(var(--primary)/0.65)]",
          )}
        />
        {/* Tooltip — portaled-like high z via fixed-ish stacking */}
        <div className="absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-[#0a0f1a] border border-white/10 text-slate-200 text-xs font-medium rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap z-[60] shadow-xl">
          <span className="font-mono tracking-wide">{label}</span>
        </div>
      </div>
    </Link>
  );
}

export function Sidebar() {
  const [location] = useLocation();
  const { isOwner } = useAuth();

  const { data: stats, isError } = useGetBotStats({
    query: {
      queryKey: getGetBotStatsQueryKey(),
      refetchInterval: 5000,
      retry: 1,
    },
  });

  const isOnline =
    !isError &&
    stats !== undefined &&
    ((stats as { online?: boolean }).online === true ||
      (typeof stats.ping === "number" && stats.ping >= 0));

  const botAvatar = stats?.botAvatar ?? null;
  const botName = stats?.botName ?? "02";

  const links = ALL_LINKS.filter(
    (l) => !("ownerOnly" in l && l.ownerOnly) || isOwner,
  );

  return (
    <aside className="w-[72px] h-screen flex-shrink-0 flex flex-col items-center py-5 bg-sidebar border-r border-sidebar-border z-30 relative">
      {/* Bot avatar — clean, no decorative rings */}
      <div className="relative mb-6 flex-shrink-0" title={botName}>
        <div
          className="w-11 h-11 rounded-2xl p-[1.5px] shadow-[0_0_18px_var(--zt-glow-pink)]"
          style={{
            background: `linear-gradient(135deg, var(--zt-pink), var(--zt-cyan))`,
          }}
        >
          <div className="w-full h-full bg-sidebar rounded-2xl flex items-center justify-center overflow-hidden">
            {botAvatar ? (
              <img
                src={botAvatar}
                alt={botName}
                className="w-full h-full object-cover"
                draggable={false}
              />
            ) : (
              <span className="font-bold text-xs text-white font-mono">02</span>
            )}
          </div>
        </div>
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-sidebar",
            isOnline
              ? "shadow-[0_0_8px_var(--zt-cyan)]"
              : "bg-zinc-500",
          )}
          style={isOnline ? { backgroundColor: "var(--zt-cyan)" } : undefined}
        />
      </div>

      <nav className="flex-1 w-full flex flex-col items-center gap-1 relative z-10 overflow-y-auto overflow-x-visible px-0">
        {links.map((link) => {
          const isActive = link.exact
            ? location === link.href
            : location.startsWith(link.href);
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

      <div className="relative z-20 flex flex-col items-center gap-3 pt-3 pb-1 flex-shrink-0">
        <SidebarItem
          icon={Settings}
          label="Settings"
          active={location === "/settings"}
          href="/settings"
        />
        <AccountMenu />
      </div>
    </aside>
  );
}
