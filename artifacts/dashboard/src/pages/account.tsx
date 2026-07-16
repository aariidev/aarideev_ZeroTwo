import { User, LogOut, Crown, Shield, Link2, IdCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/dash/page-header";

function formatExpires(ms: number): string {
  if (ms <= 0) return "Expirada";
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  if (d > 0) return `${d}d ${h}h restantes`;
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m restantes`;
  return `${Math.max(1, m)}m restantes`;
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-ES", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export default function AccountPage() {
  const { user, session, logout, login, isOwner } = useAuth();

  if (!user) {
    return (
      <div className="max-w-2xl py-16 text-center text-slate-500 font-mono text-sm">
        No hay sesión activa.
      </div>
    );
  }

  const display = user.globalName || user.username;

  return (
    <div className="space-y-6 sm:space-y-8 max-w-2xl">
      <PageHeader
        icon={User}
        title="Mi cuenta"
        description="Sesión de Discord y datos de tu perfil. No es la configuración del dashboard."
      />

      {/* Profile card */}
      <section className="rounded-2xl border border-white/[0.06] bg-[#0a0f1a]/90 p-5 sm:p-6 shadow-[0_8px_28px_rgba(0,0,0,0.22)]">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl overflow-hidden border border-[#ff2d6b]/30 shadow-[0_0_20px_rgba(255,45,107,0.18)] flex-shrink-0">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-black/40 flex items-center justify-center text-sm font-mono">
                {user.username.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold text-white truncate">{display}</p>
            <p className="text-sm font-mono text-slate-500 truncate">
              @{user.username}
            </p>
          </div>
          <span
            className={`flex-shrink-0 inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-full border ${
              isOwner
                ? "text-[#f5c518] border-[#f5c518]/30 bg-[#f5c518]/10"
                : "text-[#00f5d4] border-[#00f5d4]/25 bg-[#00f5d4]/10"
            }`}
          >
            {isOwner ? (
              <Crown className="w-3.5 h-3.5" />
            ) : (
              <Shield className="w-3.5 h-3.5" />
            )}
            {isOwner ? "DEVELOPER" : user.role.toUpperCase()}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12px] font-mono">
          <InfoCell
            icon={IdCard}
            label="Discord ID"
            value={user.id}
          />
          <InfoCell
            icon={Shield}
            label="Rol en el dashboard"
            value={isOwner ? "Developer (tú)" : user.role}
          />
          <InfoCell
            icon={Link2}
            label="Sesión"
            value="Conectada con Discord"
            ok
          />
          <InfoCell
            icon={User}
            label="Expira"
            value={
              session
                ? `${formatExpires(session.expiresInMs)}\n${formatDate(session.expiresAt)}`
                : "—"
            }
          />
        </div>
      </section>

      {/* Actions */}
      <section className="rounded-2xl border border-white/[0.06] bg-[#0a0f1a]/90 p-5 sm:p-6 space-y-3">
        <h2 className="text-sm font-semibold text-white tracking-wide mb-1">
          Acciones de sesión
        </h2>
        <p className="text-xs text-slate-500 font-mono mb-3">
          Reconectar renueva el OAuth. Cerrar sesión borra la cookie de este
          navegador.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 font-mono text-xs border-white/10 rounded-xl"
            onClick={() => login()}
          >
            <Link2 className="h-3.5 w-3.5" />
            Reconectar Discord
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 font-mono text-xs border-red-500/30 text-red-300 hover:bg-red-500/10 hover:text-red-200 rounded-xl"
            onClick={() => void logout()}
          >
            <LogOut className="h-3.5 w-3.5" />
            Cerrar sesión
          </Button>
        </div>
      </section>

      {isOwner && (
        <p className="text-[11px] font-mono text-slate-600">
          Como developer tienes acceso al Dev Panel. Nadie más de la allow-list
          lo ve.
        </p>
      )}
    </div>
  );
}

function InfoCell({
  icon: Icon,
  label,
  value,
  ok,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  ok?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/[0.05] bg-black/30 p-3.5">
      <div className="flex items-center gap-1.5 text-slate-500 mb-1.5">
        <Icon className="w-3 h-3" />
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <p
        className={`text-sm whitespace-pre-line break-all ${
          ok ? "text-[#00f5d4]" : "text-slate-200"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
