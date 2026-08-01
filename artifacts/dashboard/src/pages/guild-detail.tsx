import { useState, useMemo, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { useListGuilds, getListGuildsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Settings2, FileText, AlertTriangle, Ticket,
  Loader2, Save, Hash, Bot, EyeOff, Paperclip, Bell,
  UserPlus, CheckSquare, Square, Shield, Users, ChevronRight,
} from "lucide-react";


// ─── Types ────────────────────────────────────────────────────────────────────

type GuildChannel = { id: string; name: string; type: string };
type GuildRole    = { id: string; name: string; color: string; position: number };
type EventMeta    = { key: string; label: string; category?: string; description?: string };
type CategoryMeta = { id: string; label: string; events: EventMeta[] };

type LogSettingsDraft = {
  channelId: string | null;
  events: string[];
  ignoreBots: boolean;
  ignoreWebhooks: boolean;
  ignoreChannels: string[];
  joinAlertDays: number;
  includeAttachments: boolean;
  pingRoleId: string | null;
};

type GuildSettings = {
  guildId: string;
  name: string;
  iconUrl: string | null;
  memberCount?: number;
  settings?: LogSettingsDraft;
  logChannelId: string | null;
  logEvents: string[];
  ignoreBots?: boolean;
  ignoreWebhooks?: boolean;
  ignoreChannels?: string[];
  joinAlertDays?: number;
  includeAttachments?: boolean;
  pingRoleId?: string | null;
  channels: GuildChannel[];
  roles?: GuildRole[];
  availableEvents: EventMeta[];
  categories?: CategoryMeta[];
};

type GuildRow = {
  id: string;
  name: string;
  memberCount: number;
  iconUrl?: string | null;
  canManage?: boolean;
};

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const DEFAULT_DRAFT: LogSettingsDraft = {
  channelId: null, events: [], ignoreBots: true, ignoreWebhooks: true,
  ignoreChannels: [], joinAlertDays: 7, includeAttachments: true, pingRoleId: null,
};

function settingsToDraft(s: GuildSettings): LogSettingsDraft {
  const n = s.settings;
  return {
    channelId: n?.channelId ?? s.logChannelId ?? null,
    events: n?.events?.length ? n.events : s.logEvents?.length ? s.logEvents
      : s.availableEvents.map((e) => e.key),
    ignoreBots: n?.ignoreBots ?? s.ignoreBots ?? true,
    ignoreWebhooks: n?.ignoreWebhooks ?? s.ignoreWebhooks ?? true,
    ignoreChannels: n?.ignoreChannels ?? s.ignoreChannels ?? [],
    joinAlertDays: n?.joinAlertDays ?? s.joinAlertDays ?? 7,
    includeAttachments: n?.includeAttachments ?? s.includeAttachments ?? true,
    pingRoleId: n?.pingRoleId ?? s.pingRoleId ?? null,
  };
}


async function fetchSettings(guildId: string): Promise<GuildSettings> {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25_000);
  try {
    const res = await fetch(`${BASE}/api/guilds/${guildId}/settings`, {
      credentials: "include",
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({} as { error?: string }));
      throw new Error(err.error ?? `HTTP ${res.status}`);
    }
    return res.json();
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError")
      throw new Error("La config tardó demasiado. Reintenta.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function saveSettings(guildId: string, draft: LogSettingsDraft) {
  const res = await fetch(`${BASE}/api/guilds/${guildId}/settings`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      logChannelId: draft.channelId,
      logEvents: draft.events,
      ignoreBots: draft.ignoreBots,
      ignoreWebhooks: draft.ignoreWebhooks,
      ignoreChannels: draft.ignoreChannels,
      joinAlertDays: draft.joinAlertDays,
      includeAttachments: draft.includeAttachments,
      pingRoleId: draft.pingRoleId,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error ?? `HTTP ${res.status}`);
  }
  return res.json();
}


// ─── Tabs config ──────────────────────────────────────────────────────────────

type TabId = "overview" | "logs" | "warns" | "tickets";

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "General",  icon: Settings2     },
  { id: "logs",     label: "Logs",     icon: FileText      },
  { id: "warns",    label: "Warns",    icon: AlertTriangle },
  { id: "tickets",  label: "Tickets",  icon: Ticket        },
];

// ─── Guild Header ─────────────────────────────────────────────────────────────

function GuildHeader({
  guild, settings, onBack,
}: {
  guild: GuildRow | undefined;
  settings: GuildSettings | null;
  onBack: () => void;
}) {
  const name     = settings?.name     ?? guild?.name     ?? "Servidor";
  const iconUrl  = settings?.iconUrl  ?? guild?.iconUrl  ?? null;
  const members  = guild?.memberCount ?? 0;

  return (
    <div className="flex items-center gap-4 mb-6">
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground rounded-xl px-3"
        onClick={onBack}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Servidores
      </Button>

      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Avatar className="h-10 w-10 border border-border flex-shrink-0 rounded-xl">
          <AvatarImage src={iconUrl || ""} alt={name} />
          <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold rounded-xl">
            {name.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-foreground truncate leading-tight">{name}</h1>
          {members > 0 && (
            <div className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground">
              <Users className="h-3 w-3" />
              {members.toLocaleString()} miembros
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


// ─── Tab: Overview ────────────────────────────────────────────────────────────

function OverviewTab({ settings }: { settings: GuildSettings }) {
  const logChannel = settings.channels.find((c) => c.id === settings.logChannelId);
  const evCount    = settings.logEvents?.length ?? 0;

  const stats = [
    { label: "Canal de logs",   value: logChannel ? `#${logChannel.name}` : "—" },
    { label: "Eventos activos", value: evCount > 0 ? `${evCount} eventos` : "—" },
    { label: "Ignorar bots",    value: settings.ignoreBots ? "Sí" : "No" },
    { label: "Alerta joins",    value: settings.joinAlertDays ? `${settings.joinAlertDays} días` : "Off" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card/80 p-4">
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1">{s.label}</div>
            <div className="text-sm font-mono font-medium text-foreground truncate">{s.value}</div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-card/80 p-4 text-sm font-mono text-muted-foreground">
        Selecciona la pestaña <span className="text-foreground font-semibold">Logs</span> para
        editar los ajustes de registro. Más opciones (warns, tickets) próximamente.
      </div>
    </div>
  );
}


// ─── Tab: Logs ────────────────────────────────────────────────────────────────

function LogsTab({
  guildId, settings, onSaved,
}: {
  guildId: string;
  settings: GuildSettings;
  onSaved: (updated: GuildSettings) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<LogSettingsDraft>(() => settingsToDraft(settings));
  const [saving, setSaving]               = useState(false);
  const [showIgnoreChannels, setShowIgnoreChannels] = useState(false);

  const categories: CategoryMeta[] = useMemo(() => {
    if (settings.categories?.length) return settings.categories;
    const map = new Map<string, EventMeta[]>();
    for (const ev of settings.availableEvents ?? []) {
      const cat = ev.category ?? "other";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(ev);
    }
    return Array.from(map.entries()).map(([id, events]) => ({ id, label: id, events }));
  }, [settings]);

  const totalEvents   = settings.availableEvents?.length ?? 0;
  const enabledCount  = draft.events.length;

  const toggleEvent = (key: string) =>
    setDraft((p) => ({
      ...p,
      events: p.events.includes(key) ? p.events.filter((k) => k !== key) : [...p.events, key],
    }));

  const setCategoryEvents = (keys: string[], enabled: boolean) =>
    setDraft((p) => {
      const set = new Set(p.events);
      for (const k of keys) enabled ? set.add(k) : set.delete(k);
      return { ...p, events: Array.from(set) };
    });

  const toggleIgnoreChannel = (id: string) =>
    setDraft((p) => ({
      ...p,
      ignoreChannels: p.ignoreChannels.includes(id)
        ? p.ignoreChannels.filter((c) => c !== id)
        : [...p.ignoreChannels, id],
    }));

  const handleSave = async () => {
    if (draft.events.length === 0) {
      toast({ title: "Selecciona al menos un evento", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await saveSettings(guildId, {
        ...draft,
        channelId: draft.channelId === "none" ? null : draft.channelId,
        pingRoleId: !draft.pingRoleId || draft.pingRoleId === "none" ? null : draft.pingRoleId,
      });
      toast({ title: "Configuración guardada", description: "Logs del servidor actualizados." });
      void queryClient.invalidateQueries({ queryKey: getListGuildsQueryKey() });
      const updated = await fetchSettings(guildId);
      setDraft(settingsToDraft(updated));
      onSaved(updated);
    } catch (e) {
      toast({ title: "Error al guardar", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };


  return (
    <div className="space-y-6 max-w-2xl">
      {/* Canal */}
      <section>
        <label className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider block mb-2">
          Canal de logs
        </label>
        <select
          value={draft.channelId ?? "none"}
          onChange={(e) => setDraft((d) => ({ ...d, channelId: e.target.value === "none" ? null : e.target.value }))}
          className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm font-mono text-foreground"
        >
          <option value="none">— Desactivado —</option>
          {settings.channels.map((ch) => (
            <option key={ch.id} value={ch.id}>#{ch.name}</option>
          ))}
        </select>
      </section>

      {/* Eventos */}
      <section>
        <div className="flex items-center justify-between gap-2 mb-2">
          <label className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
            Eventos a registrar
            {totalEvents > 0 && <span className="ml-2 text-secondary">{enabledCount}/{totalEvents}</span>}
          </label>
          <div className="flex gap-1">
            <Button type="button" variant="ghost" size="sm" className="h-7 text-[10px] font-mono px-2"
              onClick={() => setDraft((d) => ({ ...d, events: settings.availableEvents.map((e) => e.key) }))}>
              Todos
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-7 text-[10px] font-mono px-2"
              onClick={() => setDraft((d) => ({ ...d, events: [] }))}>
              Ninguno
            </Button>
          </div>
        </div>
        <div className="space-y-3">
          {categories.map((cat) => {
            const keys   = cat.events.map((e) => e.key);
            const allOn  = keys.every((k) => draft.events.includes(k));
            const someOn = !allOn && keys.some((k) => draft.events.includes(k));
            return (
              <div key={cat.id} className="rounded-xl border border-border bg-black/20 overflow-hidden">
                <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/60 bg-white/[0.02]">
                  <span className="text-xs font-mono font-medium text-foreground">
                    {cat.label}
                    <span className="text-muted-foreground ml-1.5">
                      ({keys.filter((k) => draft.events.includes(k)).length}/{keys.length})
                    </span>
                  </span>
                  <button type="button"
                    className="inline-flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground hover:text-primary"
                    onClick={() => setCategoryEvents(keys, !allOn)}>
                    {allOn ? <CheckSquare className="h-3.5 w-3.5 text-primary" />
                      : someOn ? <CheckSquare className="h-3.5 w-3.5 text-secondary opacity-60" />
                      : <Square className="h-3.5 w-3.5" />}
                    {allOn ? "Quitar cat." : "Toda cat."}
                  </button>
                </div>
                <div className="p-1.5 space-y-0.5">
                  {cat.events.map((ev) => (
                    <label key={ev.key} className="flex items-center justify-between gap-3 px-2.5 py-2 rounded-lg hover:bg-white/[0.03] cursor-pointer">
                      <div className="min-w-0">
                        <div className="text-sm text-foreground">{ev.label}</div>
                        {ev.description && <div className="text-[10px] font-mono text-muted-foreground truncate">{ev.description}</div>}
                      </div>
                      <Switch checked={draft.events.includes(ev.key)} onCheckedChange={() => toggleEvent(ev.key)} />
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>


      {/* Filtros */}
      <section className="space-y-3">
        <label className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider block">Filtros y opciones</label>
        <div className="rounded-xl border border-border bg-black/20 p-2 space-y-0.5">
          {[
            { icon: Bot,       label: "Ignorar bots",     desc: "No registrar acciones / mensajes de bots",   key: "ignoreBots"        },
            { icon: EyeOff,    label: "Ignorar webhooks", desc: "Omitir deletes/edits de webhooks",            key: "ignoreWebhooks"    },
            { icon: Paperclip, label: "Incluir adjuntos", desc: "Links de archivos en mensajes borrados",      key: "includeAttachments"},
          ].map(({ icon: Icon, label, desc, key }) => (
            <label key={key} className="flex items-center justify-between gap-3 px-2.5 py-2.5 rounded-lg hover:bg-white/[0.03] cursor-pointer">
              <div className="flex items-start gap-2.5 min-w-0">
                <Icon className="h-4 w-4 text-secondary mt-0.5 flex-shrink-0" />
                <div><div className="text-sm text-foreground">{label}</div><div className="text-[10px] font-mono text-muted-foreground">{desc}</div></div>
              </div>
              <Switch
                checked={(draft as any)[key]}
                onCheckedChange={(v: boolean) => setDraft((d) => ({ ...d, [key]: v }))}
              />
            </label>
          ))}
        </div>

        {/* Join alert */}
        <div className="rounded-xl border border-border bg-black/20 px-3.5 py-3">
          <div className="flex items-start gap-2.5 mb-2">
            <UserPlus className="h-4 w-4 text-secondary mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-sm text-foreground">Alerta de cuenta nueva</div>
              <div className="text-[10px] font-mono text-muted-foreground">Marcar joins con cuenta más nueva que N días (0 = off)</div>
            </div>
          </div>
          <div className="flex items-center gap-2 pl-6">
            <Input type="number" min={0} max={365} value={draft.joinAlertDays}
              onChange={(e) => setDraft((d) => ({ ...d, joinAlertDays: Math.max(0, Math.min(365, Number(e.target.value) || 0)) }))}
              className="h-9 w-24 font-mono text-sm rounded-lg" />
            <span className="text-xs font-mono text-muted-foreground">días</span>
          </div>
        </div>

        {/* Ping role */}
        <div className="rounded-xl border border-border bg-black/20 px-3.5 py-3">
          <div className="flex items-start gap-2.5 mb-2">
            <Bell className="h-4 w-4 text-secondary mt-0.5 flex-shrink-0" />
            <div><div className="text-sm text-foreground">Rol a mencionar</div><div className="text-[10px] font-mono text-muted-foreground">Opcional: pings en cada log</div></div>
          </div>
          <select value={draft.pingRoleId ?? "none"}
            onChange={(e) => setDraft((d) => ({ ...d, pingRoleId: e.target.value === "none" ? null : e.target.value }))}
            className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm font-mono text-foreground">
            <option value="none">— Sin mención —</option>
            {(settings.roles ?? []).map((r) => <option key={r.id} value={r.id}>@{r.name}</option>)}
          </select>
        </div>

        {/* Ignore channels */}
        <div className="rounded-xl border border-border bg-black/20 px-3.5 py-3">
          <button type="button" className="w-full flex items-center justify-between gap-2 text-left"
            onClick={() => setShowIgnoreChannels((v) => !v)}>
            <div className="flex items-start gap-2.5 min-w-0">
              <Hash className="h-4 w-4 text-secondary mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-sm text-foreground">Canales ignorados</div>
                <div className="text-[10px] font-mono text-muted-foreground">
                  No loguear delete/edit en estos canales
                  {draft.ignoreChannels.length ? ` · ${draft.ignoreChannels.length} seleccionados` : ""}
                </div>
              </div>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground">{showIgnoreChannels ? "▲" : "▼"}</span>
          </button>
          {showIgnoreChannels && (
            <div className="mt-2 max-h-40 overflow-y-auto space-y-0.5 rounded-lg border border-border/50 p-1.5">
              {settings.channels.map((ch) => (
                <label key={ch.id} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-white/[0.03] cursor-pointer">
                  <span className="text-xs font-mono text-foreground truncate">#{ch.name}</span>
                  <Switch checked={draft.ignoreChannels.includes(ch.id)} onCheckedChange={() => toggleIgnoreChannel(ch.id)} />
                </label>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Save */}
      <div className="flex gap-2 pt-2">
        <Button className="flex-1 gap-2 rounded-xl font-mono text-sm" onClick={() => void handleSave()} disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Guardar cambios
        </Button>
      </div>
    </div>
  );
}


// ─── Tab: Coming soon placeholder ────────────────────────────────────────────

function ComingSoonTab({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
      <div className="h-12 w-12 rounded-2xl border border-border bg-card/80 flex items-center justify-center mb-1">
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-mono text-foreground font-medium">{label}</p>
      <p className="text-xs font-mono text-muted-foreground">Próximamente disponible en el panel</p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function GuildDetail() {
  const { id: guildId } = useParams<{ id: string }>();
  const [, navigate]    = useLocation();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [settings, setSettings]   = useState<GuildSettings | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const { toast } = useToast();

  const { data: guildsData } = useListGuilds({
    query: { queryKey: getListGuildsQueryKey(), staleTime: 60_000 },
  });
  const guild = (guildsData as GuildRow[] | undefined)?.find((g) => g.id === guildId);

  // Load settings on mount
  const loadSettings = useCallback(async () => {
    if (!guildId) return;
    setLoading(true);
    setError(null);
    try {
      const s = await fetchSettings(guildId);
      setSettings(s);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al cargar";
      setError(msg);
      toast({ title: "Error al cargar la configuración", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [guildId, toast]);

  // Load on first render
  useState(() => { void loadSettings(); });

  if (!guildId) {
    navigate("/guilds");
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-0">
      <GuildHeader guild={guild} settings={settings} onBack={() => navigate("/guilds")} />

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border mb-6 overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2.5 text-sm font-mono whitespace-nowrap border-b-2 -mb-px transition-colors",
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
          <p className="text-xs font-mono text-muted-foreground">Cargando configuración…</p>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-6 text-center">
          <p className="text-sm font-mono text-red-400 mb-3">{error}</p>
          <Button variant="outline" size="sm" className="rounded-xl font-mono text-xs" onClick={() => void loadSettings()}>
            Reintentar
          </Button>
        </div>
      ) : settings ? (
        <>
          {activeTab === "overview" && <OverviewTab settings={settings} />}
          {activeTab === "logs"     && <LogsTab guildId={guildId} settings={settings} onSaved={setSettings} />}
          {activeTab === "warns"    && <ComingSoonTab label="Gestión de Warns" />}
          {activeTab === "tickets"  && <ComingSoonTab label="Sistema de Tickets" />}
        </>
      ) : null}
    </div>
  );
}
