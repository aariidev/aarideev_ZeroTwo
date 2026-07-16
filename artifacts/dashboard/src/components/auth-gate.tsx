import { type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import LoginPage from "@/pages/login";
import { Loader2 } from "lucide-react";

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[#050810]">
        <Loader2 className="w-8 h-8 text-[#ff2d6b] animate-spin" />
        <p className="text-xs font-mono text-slate-500 tracking-widest">
          VERIFICANDO SESIÓN…
        </p>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return <>{children}</>;
}
