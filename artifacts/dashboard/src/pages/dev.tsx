import { useState, useEffect, useCallback } from "react";
import { Terminal, Shield, Megaphone, GitCommit, Trash2, Power, AlertTriangle, CheckCircle2, XCircle, Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const DEV_USER_ID = "819080793447333918";
const TOKEN_KEY = "zt_dev_token";
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type ChangelogType = "feature" | "fix" | "improvement" | "breaking";

interface ChangelogEntry {
  id: number;
  version: string;
  title: string;
  description: string;
  type: string;
  createdAt: string;
}

interface DevStatus {
  devUserId: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  botOnline: boolean;
  guildsCount: number;
}

async function devFetch(path: string, token: string, options?: RequestInit) {
  return fetch(`${BASE}/api/dev${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-dev-token": token,
      ...(options?.headers ?? {}),
    },
  });
}

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  feature:     { label: "FEATURE",     color: "text-cyan-400 border-cyan-400/30 bg-cyan-400/10" },
  fix:         { label: "FIX",         color: "text-green-400 border-green-400/30 bg-green-400/10" },
  improvement: { label: "IMPROVEMENT", color: "text-yellow-400 border-yellow-400/30 bg-yellow-400/10" },
  breaking:    { label: "BREAKING",    color: "text-red-400 border-red-400/30 bg-red-400/10" },
};

export default function DevPanel() {
  const { toast } = useToast();

  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) ?? "");
  const [tokenInput, setTokenInput] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authed, setAuthed] = useState(false);

  const [status, setStatus] = useState<DevStatus | null>(null);
  const [changelogs, setChangelogs] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // Maintenance form
  const [maintenanceMsg, setMaintenanceMsg] = useState("");
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);

  // Announce form
  const [announceTitle, setAnnounceTitle] = useState("");
  const [announceMsg, setAnnounceMsg] = useState("");
  const [announceLoading, setAnnounceLoading] = useState(false);

  // Changelog form
  const [clVersion, setClVersion] = useState("");
  const [clTitle, setClTitle] = useState("");
  const [clDesc, setClDesc] = useState("");
  const [clType, setClType] = useState<ChangelogType>("feature");
  const [clLoading, setClLoading] = useState(false);

  const fetchData = useCallback(async (t: string) => {
    setLoading(true);
    try {
      const [statusRes, logsRes] = await Promise.all([
        devFetch("/status", t),
        devFetch("/changelogs", t),
      ]);

      if (statusRes.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        setToken("");
        setAuthed(false);
        setLoading(false);
        return;
      }

      if (statusRes.ok) {
        const s = await statusRes.json();
        setStatus(s);
        setMaintenanceMsg(s.maintenanceMessage);
      }
      if (logsRes.ok) {
        setChangelogs(await logsRes.json());
      }
      setAuthed(true);
    } catch {
      // network error
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-auth if token is in localStorage
  useEffect(() => {
    if (token) {
      fetchData(token);
    }
  }, [token, fetchData]);

  const handleLogin = async () => {
    if (!tokenInput.trim()) return;
    setAuthLoading(true);
    try {
      const res = await devFetch("/status", tokenInput.trim());
      if (res.ok) {
        localStorage.setItem(TOKEN_KEY, tokenInput.trim());
        setToken(tokenInput.trim());
        setTokenInput("");
        toast({ title: "Acceso concedido", description: "Bienvenido al panel de desarrollo." });
      } else {
        toast({ title: "Token inválido", description: "Verifica tu DEV_TOKEN.", variant: "destructive" });
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setAuthed(false);
    setStatus(null);
    setChangelogs([]);
  };

  const toggleMaintenance = async () => {
    if (!status) return;
    setMaintenanceLoading(true);
    try {
      const res = await devFetch("/maintenance", token, {
        method: "POST",
        body: JSON.stringify({ enabled: !status.maintenanceMode, message: maintenanceMsg || undefined }),
      });
      if (res.ok) {
        const data = await res.json();
        setStatus((s) => s ? { ...s, maintenanceMode: data.maintenanceMode } : s);
        toast({
          title: data.maintenanceMode ? "Modo mantenimiento ACTIVADO" : "Modo mantenimiento DESACTIVADO",
        });
      }
    } finally {
      setMaintenanceLoading(false);
    }
  };

  const sendAnnouncement = async () => {
    if (!announceTitle.trim() || !announceMsg.trim()) return;
    setAnnounceLoading(true);
    try {
      const res = await devFetch("/announce", token, {
        method: "POST",
        body: JSON.stringify({ title: announceTitle, message: announceMsg }),
      });
      if (res.ok) {
        const data = await res.json();
        toast({ title: `Anuncio enviado`, description: `${data.sent}/${data.total} servidores recibieron el mensaje.` });
        setAnnounceTitle("");
        setAnnounceMsg("");
      } else {
        toast({ title: "Error al enviar", variant: "destructive" });
      }
    } finally {
      setAnnounceLoading(false);
    }
  };

  const postChangelog = async () => {
    if (!clVersion.trim() || !clTitle.trim() || !clDesc.trim()) return;
    setClLoading(true);
    try {
      const res = await devFetch("/changelogs", token, {
        method: "POST",
        body: JSON.stringify({ version: clVersion, title: clTitle, description: clDesc, type: clType }),
      });
      if (res.ok) {
        const entry = await res.json();
        setChangelogs((prev) => [entry, ...prev]);
        toast({ title: "Changelog publicado" });
        setClVersion("");
        setClTitle("");
        setClDesc("");
        setClType("feature");
      }
    } finally {
      setClLoading(false);
    }
  };

  const deleteChangelog = async (id: number) => {
    const res = await devFetch(`/changelogs/${id}`, token, { method: "DELETE" });
    if (res.ok) {
      setChangelogs((prev) => prev.filter((c) => c.id !== id));
      toast({ title: "Entrada eliminada" });
    }
  };

  // ── Auth gate ──────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="relative border border-primary/30 bg-card p-10 w-full max-w-md" style={{ boxShadow: "0 0 30px hsl(340 95% 60% / 0.15)" }}>
          {/* Corner brackets */}
          <span className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-primary" />
          <span className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-primary" />
          <span className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-primary" />
          <span className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-primary" />

          <div className="text-center mb-8">
            <Lock className="h-12 w-12 text-primary mx-auto mb-4" />
            <h1 className="text-2xl font-display text-primary tracking-widest">ACCESO RESTRINGIDO</h1>
            <p className="text-muted-foreground text-sm mt-2 font-mono">dev_user_id: {DEV_USER_ID}</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground font-mono mb-1 block">DEV_TOKEN</label>
              <Input
                type="password"
                placeholder="Introduce tu token de acceso..."
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                className="font-mono bg-sidebar border-primary/30 focus-visible:ring-primary"
              />
            </div>
            <Button
              className="w-full font-display tracking-widest"
              onClick={handleLogin}
              disabled={authLoading || !tokenInput.trim()}
            >
              {authLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Terminal className="h-4 w-4 mr-2" />}
              AUTENTICAR
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Dev Panel ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-display text-primary tracking-widest flex items-center gap-3">
            <Terminal className="h-8 w-8" />
            DEV_CONSOLE
          </h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">
            uid: {DEV_USER_ID} · session active
          </p>
        </div>
        <div className="flex items-center gap-3">
          {status && (
            <div className={`flex items-center gap-2 border px-3 py-1.5 text-xs font-mono ${
              status.botOnline
                ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-400"
                : "border-red-500/30 bg-red-500/10 text-red-400"
            }`}>
              <span className={`h-2 w-2 rounded-full ${status.botOnline ? "bg-cyan-500 animate-pulse" : "bg-red-500"}`} />
              BOT {status.botOnline ? "ONLINE" : "OFFLINE"}
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-foreground font-mono text-xs">
            [LOGOUT]
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Maintenance Mode */}
        <DevCard icon={Power} title="MAINTENANCE_MODE" glowColor="primary">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-mono">Estado actual</p>
                <div className={`flex items-center gap-2 mt-1 font-display text-sm tracking-widest ${
                  status?.maintenanceMode ? "text-red-400" : "text-green-400"
                }`}>
                  {status?.maintenanceMode
                    ? <><XCircle className="h-4 w-4" /> ACTIVO</>
                    : <><CheckCircle2 className="h-4 w-4" /> INACTIVO</>
                  }
                </div>
              </div>
              <div className="text-xs text-muted-foreground font-mono text-right">
                <div>{status?.guildsCount ?? 0} servers afectados</div>
              </div>
            </div>

            <div>
              <label className="text-xs font-mono text-muted-foreground block mb-1">Mensaje de mantenimiento</label>
              <Textarea
                value={maintenanceMsg}
                onChange={(e) => setMaintenanceMsg(e.target.value)}
                placeholder="ZeroTwo está en mantenimiento..."
                className="font-mono text-sm bg-sidebar border-border resize-none h-20"
              />
            </div>

            <Button
              className={`w-full font-display tracking-widest text-sm ${
                status?.maintenanceMode
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-destructive hover:bg-destructive/80 text-white"
              }`}
              onClick={toggleMaintenance}
              disabled={maintenanceLoading}
            >
              {maintenanceLoading
                ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                : <Power className="h-4 w-4 mr-2" />
              }
              {status?.maintenanceMode ? "DESACTIVAR MANTENIMIENTO" : "ACTIVAR MANTENIMIENTO"}
            </Button>

            {status?.maintenanceMode && (
              <div className="flex items-center gap-2 border border-red-500/30 bg-red-500/10 p-3 text-red-400 text-xs font-mono">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                El bot rechaza todos los comandos en este momento.
              </div>
            )}
          </div>
        </DevCard>

        {/* Announce */}
        <DevCard icon={Megaphone} title="BROADCAST_ANNOUNCE" glowColor="cyan">
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground font-mono">
              Envía un embed a todos los servidores donde está el bot.
            </p>
            <div>
              <label className="text-xs font-mono text-muted-foreground block mb-1">TÍTULO</label>
              <Input
                value={announceTitle}
                onChange={(e) => setAnnounceTitle(e.target.value)}
                placeholder="Nueva actualización disponible..."
                className="font-mono text-sm bg-sidebar border-border"
              />
            </div>
            <div>
              <label className="text-xs font-mono text-muted-foreground block mb-1">MENSAJE</label>
              <Textarea
                value={announceMsg}
                onChange={(e) => setAnnounceMsg(e.target.value)}
                placeholder="Descripción del anuncio..."
                className="font-mono text-sm bg-sidebar border-border resize-none h-24"
              />
            </div>
            <Button
              className="w-full font-display tracking-widest text-sm"
              style={{ background: "hsl(190 100% 40%)", color: "#000" }}
              onClick={sendAnnouncement}
              disabled={announceLoading || !announceTitle.trim() || !announceMsg.trim()}
            >
              {announceLoading
                ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                : <Megaphone className="h-4 w-4 mr-2" />
              }
              ENVIAR A {status?.guildsCount ?? "?"} SERVIDORES
            </Button>
          </div>
        </DevCard>
      </div>

      {/* Changelog */}
      <DevCard icon={GitCommit} title="CHANGELOG_MANAGER" glowColor="primary">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* New entry form */}
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground font-mono">Nueva entrada de changelog</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-mono text-muted-foreground block mb-1">VERSION</label>
                <Input
                  value={clVersion}
                  onChange={(e) => setClVersion(e.target.value)}
                  placeholder="v2.1.0"
                  className="font-mono text-sm bg-sidebar border-border"
                />
              </div>
              <div>
                <label className="text-xs font-mono text-muted-foreground block mb-1">TYPE</label>
                <select
                  value={clType}
                  onChange={(e) => setClType(e.target.value as ChangelogType)}
                  className="w-full h-9 bg-sidebar border border-border text-foreground text-sm font-mono px-2 rounded-none"
                >
                  <option value="feature">feature</option>
                  <option value="fix">fix</option>
                  <option value="improvement">improvement</option>
                  <option value="breaking">breaking</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-mono text-muted-foreground block mb-1">TÍTULO</label>
              <Input
                value={clTitle}
                onChange={(e) => setClTitle(e.target.value)}
                placeholder="Descripción breve del cambio"
                className="font-mono text-sm bg-sidebar border-border"
              />
            </div>

            <div>
              <label className="text-xs font-mono text-muted-foreground block mb-1">DESCRIPCIÓN</label>
              <Textarea
                value={clDesc}
                onChange={(e) => setClDesc(e.target.value)}
                placeholder="Detalle completo de los cambios..."
                className="font-mono text-sm bg-sidebar border-border resize-none h-28"
              />
            </div>

            <Button
              className="w-full font-display tracking-widest text-sm"
              onClick={postChangelog}
              disabled={clLoading || !clVersion.trim() || !clTitle.trim() || !clDesc.trim()}
            >
              {clLoading
                ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                : <GitCommit className="h-4 w-4 mr-2" />
              }
              PUBLICAR CHANGELOG
            </Button>
          </div>

          {/* Changelog history */}
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground font-mono text-sm">Cargando...</div>
            ) : changelogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground font-mono text-sm">
                Sin entradas todavía
              </div>
            ) : (
              changelogs.map((cl) => {
                const cfg = TYPE_CONFIG[cl.type] ?? TYPE_CONFIG.feature;
                return (
                  <div key={cl.id} className="relative border border-border bg-sidebar p-4 group">
                    <span className="absolute top-0 left-0 w-3 h-3 border-t border-l border-primary" />
                    <span className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-primary" />

                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-display text-primary text-xs tracking-wider">{cl.version}</span>
                        <span className={`text-xs border px-1.5 py-0.5 font-mono ${cfg.color}`}>{cfg.label}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive/50 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        onClick={() => deleteChangelog(cl.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>

                    <p className="text-sm font-medium text-foreground mb-1">{cl.title}</p>
                    <p className="text-xs text-muted-foreground font-mono leading-relaxed">{cl.description}</p>
                    <p className="text-xs text-muted-foreground/50 font-mono mt-2">
                      {format(new Date(cl.createdAt), "MMM d yyyy HH:mm")}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </DevCard>

      {/* System Info */}
      {status && (
        <DevCard icon={Shield} title="SYSTEM_INFO" glowColor="cyan">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "dev_user_id", value: DEV_USER_ID },
              { label: "guilds_monitored", value: String(status.guildsCount) },
              { label: "maintenance_mode", value: status.maintenanceMode ? "true" : "false" },
              { label: "bot_status", value: status.botOnline ? "online" : "offline" },
            ].map(({ label, value }) => (
              <div key={label} className="border border-border bg-sidebar p-3">
                <p className="text-xs text-muted-foreground font-mono mb-1">{label}</p>
                <p className="text-sm font-mono text-foreground break-all">{value}</p>
              </div>
            ))}
          </div>
        </DevCard>
      )}
    </div>
  );
}

function DevCard({
  icon: Icon,
  title,
  glowColor,
  children,
}: {
  icon: React.ElementType;
  title: string;
  glowColor: "primary" | "cyan";
  children: React.ReactNode;
}) {
  const glow = glowColor === "primary"
    ? "border-primary/30"
    : "border-cyan-500/30";
  const titleColor = glowColor === "primary" ? "text-primary" : "text-cyan-400";

  return (
    <div className={`relative border ${glow} bg-card p-6`}>
      <span className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary" />
      <span className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary" />

      <div className={`flex items-center gap-2 font-display text-sm tracking-widest mb-5 ${titleColor}`}>
        <Icon className="h-4 w-4" />
        {title}
      </div>

      {children}
    </div>
  );
}
