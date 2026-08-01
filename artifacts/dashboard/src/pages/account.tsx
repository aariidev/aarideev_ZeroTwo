import { useCallback, useEffect, useState } from "react";
import {
  User,
  LogOut,
  Crown,
  Shield,
  Link2,
  IdCard,
  Backpack,
  Loader2,
  Lock,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/dash/page-header";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type GuildRow = {
  id: string;
  name: string;
  iconUrl?: string | null;
};

type EconomyMe = {
  guildId: string;
  userId: string;
  balance: number;
  inventoryPrivate: boolean;
};

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
  const { toast } = useToast();

  const [guilds, setGuilds] = useState<GuildRow[]>([]);
  const [guildsLoading, setGuildsLoading] = useState(true);
  const [guildId, setGuildId] = useState<string>("");
  const [economy, setEconomy] = useState<EconomyMe | null>(null);
  const [ecoLoading, setEcoLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadGuilds = useCallback(async () => {
    setGuildsLoading(true);
    try {
      const res = await fetch(`${BASE}/api/guilds`, { credentials: "include" });
      if (!res.ok) throw new Error("guilds");
      const data = (await res.json()) as GuildRow[];
      const list = Array.isArray(data) ? data : [];
      setGuilds(list);
      setGuildId((prev) => prev || list[0]?.id || "");
    } catch {
      setGuilds([]);
    } finally {
      setGuildsLoading(false);
    }
  }, []);

  const loadEconomy = useCallback(async (gid: string) => {
    if (!gid) {
      setEconomy(null);
      return;
    }
    setEcoLoading(true);
    try {
      const res = await fetch(
        `${BASE}/api/me/economy?guildId=${encodeURIComponent(gid)}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("economy");
      const data = (await res.json()) as EconomyMe;
      setEconomy(data);
    } catch {
      setEconomy(null);
      toast({
        title: "No se pudo cargar la economía",
        description: "Comprueba que el bot esté en ese servidor.",
        variant: "destructive",
      });
    } finally {
      setEcoLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadGuilds();
  }, [loadGuilds]);

  useEffect(() => {
    if (guildId) void loadEconomy(guildId);
  }, [guildId, loadEconomy]);

  const onTogglePrivacy = async (next: boolean) => {
    if (!guildId || saving) return;
    setSaving(true);
    const prev = economy;
    setEconomy((e) => (e ? { ...e, inventoryPrivate: next } : e));
    try {
      const res = await fetch(`${BASE}/api/me/economy`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId, inventoryPrivate: next }),
      });
      if (!res.ok) throw new Error("patch");
      const data = (await res.json()) as { inventoryPrivate: boolean };
      setEconomy((e) =>
        e ? { ...e, inventoryPrivate: data.inventoryPrivate } : e,
      );
      toast({
        title: next ? "Inventario privado" : "Inventario público",
        description: next
          ? "Otros no verán tu mochila en Discord (staff puede auditar)."
          : "Cualquiera puede usar /inventory usuario: contigo.",
      });
    } catch {
      setEconomy(prev);
      toast({
        title: "No se guardó el cambio",
        description: "Inténtalo de nuevo en unos segundos.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

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
        description="Sesión de Discord, perfil y preferencias de economía."
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
          <InfoCell icon={IdCard} label="Discord ID" value={user.id} />
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

      {/* Economy / inventory privacy */}
      <section className="rounded-2xl border border-white/[0.06] bg-[#0a0f1a]/90 p-5 sm:p-6 space-y-4 shadow-[0_8px_28px_rgba(0,0,0,0.22)]">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl border border-[#ff2d6b]/25 bg-[#ff2d6b]/10 flex items-center justify-center flex-shrink-0">
            <Backpack className="w-5 h-5 text-[#ff2d6b]" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-white tracking-wide">
              Economía · Inventario
            </h2>
            <p className="text-xs text-slate-500 font-mono mt-1 leading-relaxed">
              La privacidad es por servidor. Ocultar el inventario no bloquea
              uso de ítems ni un futuro trade — solo la vista pública en Discord.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">
            Servidor
          </label>
          {guildsLoading ? (
            <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Cargando servidores…
            </div>
          ) : guilds.length === 0 ? (
            <p className="text-xs font-mono text-slate-500">
              No hay servidores con el bot disponibles en tu sesión.
            </p>
          ) : (
            <select
              value={guildId}
              onChange={(e) => setGuildId(e.target.value)}
              className={cn(
                "w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5",
                "text-sm text-slate-200 font-mono outline-none",
                "focus:border-[#ff2d6b]/40 focus:ring-1 focus:ring-[#ff2d6b]/20",
              )}
            >
              {guilds.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="rounded-xl border border-white/[0.05] bg-black/30 p-4 flex items-center justify-between gap-4">
          <div className="min-w-0 flex items-start gap-3">
            {economy?.inventoryPrivate ? (
              <Lock className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
            ) : (
              <Globe className="w-4 h-4 text-[#00f5d4] mt-0.5 flex-shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-sm text-white font-medium">
                Ocultar mi inventario a otros
              </p>
              <p className="text-[11px] text-slate-500 font-mono mt-1 leading-relaxed">
                Staff del bot y admins del servidor pueden auditar. Default:
                público.
              </p>
              {economy && !ecoLoading && (
                <p className="text-[11px] font-mono text-slate-600 mt-2">
                  Saldo: {economy.balance.toLocaleString("es-ES")} fichas ·{" "}
                  {economy.inventoryPrivate ? "🔒 privado" : "🌐 público"}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {(ecoLoading || saving) && (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
            )}
            <Switch
              checked={Boolean(economy?.inventoryPrivate)}
              disabled={!guildId || ecoLoading || saving || !economy}
              onCheckedChange={(v) => void onTogglePrivacy(v)}
              aria-label="Ocultar inventario"
            />
          </div>
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
