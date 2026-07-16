import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Sidebar } from "./sidebar";
import { Activity, Server, Terminal, AlertTriangle, FileText, Shield } from "lucide-react";

const NAV_LINKS = [
  { href: "/",         label: "Home",     icon: Activity,      exact: true },
  { href: "/guilds",   label: "Servers",  icon: Server },
  { href: "/commands", label: "Commands", icon: Terminal },
  { href: "/warns",    label: "Warnings", icon: AlertTriangle },
  { href: "/logs",     label: "Logs",     icon: FileText },
  { href: "/dev",      label: "Dev",      icon: Shield },
];

function BottomNav() {
  const [location] = useLocation();
  return (
    <nav className="flex lg:hidden fixed bottom-0 inset-x-0 bg-[#03050a]/95 backdrop-blur-sm border-t border-[#ff2d6b]/20 z-50 safe-area-inset-bottom">
      {NAV_LINKS.map((link) => {
        const isActive = link.exact ? location === link.href : location.startsWith(link.href);
        const Icon = link.icon;
        return (
          <Link key={link.href} href={link.href} className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 min-w-0">
            <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? "text-[#ff2d6b]" : "text-slate-500"}`} />
            <span className={`text-[9px] font-medium tracking-wide truncate ${isActive ? "text-[#ff2d6b]" : "text-slate-500"}`}>
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
    <div className="flex h-screen bg-background text-foreground dark overflow-hidden">
      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">
        <div className="p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <BottomNav />
    </div>
  );
}
