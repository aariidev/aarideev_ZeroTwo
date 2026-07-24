import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Sidebar } from "./sidebar";
import { PageTransition } from "@/components/page-transition";
import { useAuth } from "@/lib/auth";
import {
  Activity,
  Server,
  Terminal,
  AlertTriangle,
  FileText,
  Shield,
  Settings,
  FlaskConical,
} from "lucide-react";

type NavLink = {
  href: string;
  label: string;
  icon: React.ElementType;
  exact?: boolean;
  ownerOnly?: boolean;
};

const ALL_NAV: NavLink[] = [
  { href: "/", label: "Home", icon: Activity, exact: true },
  { href: "/guilds", label: "Servers", icon: Server },
  { href: "/commands", label: "Commands", icon: Terminal },
  { href: "/warns", label: "Warnings", icon: AlertTriangle },
  { href: "/beta", label: "Beta", icon: FlaskConical },
  { href: "/logs", label: "Logs", icon: FileText },
  { href: "/dev", label: "Dev", icon: Shield, ownerOnly: true },
  { href: "/settings", label: "Settings", icon: Settings },
];

function BottomNav() {
  const [location] = useLocation();
  const { isOwner } = useAuth();
  const links = ALL_NAV.filter((l) => !("ownerOnly" in l && l.ownerOnly) || isOwner);

  return (
    <nav className="flex lg:hidden fixed bottom-0 inset-x-0 bg-[#03050a]/95 backdrop-blur-md border-t border-[#ff2d6b]/25 z-50 safe-area-inset-bottom shadow-[0_-8px_32px_rgba(255,45,107,0.08)]">
      {links.map((link) => {
        const isActive = link.exact
          ? location === link.href
          : location.startsWith(link.href);
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 min-w-0 relative"
          >
            {isActive && (
              <span className="absolute top-0 inset-x-3 h-[2px] bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.6)]" />
            )}
            <Icon
              className={`w-5 h-5 flex-shrink-0 transition-all duration-300 ${
                isActive
                  ? "text-primary scale-110"
                  : "text-slate-500"
              }`}
            />
            <span
              className={`text-[9px] font-medium tracking-wide truncate transition-colors duration-300 ${
                isActive ? "text-primary" : "text-slate-500"
              }`}
            >
              {link.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="flex h-screen bg-background text-foreground dark overflow-hidden relative">
      {/* Soft ambient only — no full-screen overlays that confuse UI */}
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-100"
        style={{
          background:
            "radial-gradient(ellipse 70% 45% at 15% -5%, rgba(255,45,107,0.07), transparent 55%), radial-gradient(ellipse 50% 35% at 95% 0%, rgba(0,245,212,0.04), transparent 50%)",
        }}
        aria-hidden
      />

      <div className="hidden lg:flex relative z-30 flex-shrink-0">
        <Sidebar />
      </div>

      <main className="flex-1 overflow-y-auto pb-16 lg:pb-0 relative z-10 sakura-scrollbar">
        <div className="p-4 sm:p-6 lg:p-8">
          <PageTransition>{children}</PageTransition>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
