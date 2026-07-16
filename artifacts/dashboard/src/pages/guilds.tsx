import { useCallback, useEffect, useMemo, useState } from "react";
import { useListGuilds, getListGuildsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { formatNumber } from "@/lib/format";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  Users,
  Server,
  Search,
  ArrowUpDown,
  Settings2,
  Crown,
  X,
  Loader2,
  Hash,
  Save,
  Shield,
  Bot,
  Paperclip,
  Bell,
  EyeOff,
  UserPlus,
  CheckSquare,
  Square,
} from "lucide-react";
import { PageHeader } from "@/components/dash/page-header";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

type SortKey = "name" | "members" | "joined";

type GuildRow = {
  id: string;
  name: string;
  memberCount: number;
  iconUrl?: string | null;
  joinedAt: string;
  canManage?: boolean;
  logChannelId?: string | null;
  logEvents?: string[];
};

type GuildChannel = { id: string; name: string; type: string };
type GuildRole = { id: string; name: string; color: string; position: number };
type EventMeta = {
  key: string;
  label: string;
  category?: string;
  description?: string;
};
type CategoryMeta = {
  id: string;
  label: string;
  events: EventMeta[];
};

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

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const DEFAULT_DRAFT: LogSettingsDraft = {
  channelId: null,
  events: [],
  ignoreBots: true,
  ignoreWebhooks: true,
  ignoreChannels: [],
  joinAlertDays: 7,
  includeAttachments: true,
  pingRoleId: null,
};

function settingsToDraft(s: GuildSettings): LogSettingsDraft {
  const nested = s.settings;
  return {
    channelId: nested?.channelId ?? s.logChannelId ?? null,
    events:
      nested?.events?.length
        ? nested.events
        : s.logEvents?.length
          ? s.logEvents
          : s.availableEvents.map((e) => e.key),
    ignoreBots: nested?.ignoreBots ?? s.ignoreBots ?? true,
    ignoreWebhooks: nested?.ignoreWebhooks ?? s.ignoreWebhooks ?? true,
    ignoreChannels: nested?.ignoreChannels ?? s.ignoreChannels ?? [],
    joinAlertDays: nested?.joinAlertDays ?? s.joinAlertDays ?? 7,
    includeAttachments:
      nested?.includeAttachments ?? s.includeAttachments ?? true,
    pingRoleId: nested?.pingRoleId ?? s.pingRoleId ?? null,
  };
}

async function fetchSettings(guildId: string): Promise<GuildSettings> {
  const res = await fetch(`${BASE}/api/guilds/${guildId}/settings`, {
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
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
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export default function Guilds() {
  const { toast } = useToast();
  const { login } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("members");
  const [sortAsc, setSortAsc] = useState(false);
  const [onlyMine, setOnlyMine] = useState(false);

  const [configId, setConfigId] = useState<string | null>(null);
  const [settings, setSettings] = useState<GuildSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<LogSettingsDraft>(DEFAULT_DRAFT);
  const [showIgnoreChannels, setShowIgnoreChannels] = useState(false);

  const { data: guilds, isLoading, isError, error } = useListGuilds({
    query: { queryKey: getListGuildsQueryKey(), refetchInterval: 30000 },
  });

  const rows = (guilds ?? []) as GuildRow[];

  const openConfig = useCallback(
    async (guildId: string) => {
      setConfigId(guildId);
      setLoadingSettings(true);
      setSettings(null);
      setShowIgnoreChannels(false);
      try {
        const s = await fetchSettings(guildId);
        setSettings(s);
        setDraft(settingsToDraft(s));
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Error al cargar config";
        toast({
          title: "No se pudo abrir la config",
          description: msg,
          variant: "destructive",
        });
        if (
          msg.toLowerCase().includes("reconecta") ||
          msg.toLowerCase().includes("scope")
        ) {
          toast({
            title: "Vuelve a iniciar sesión",
            description: "Necesitamos el scope «guilds» de Discord.",
          });
        }
        setConfigId(null);
      } finally {
        setLoadingSettings(false);
      }
    },
    [toast],
  );

  const closeConfig = () => {
    setConfigId(null);
    setSettings(null);
  };

  const toggleEvent = (key: string) => {
    setDraft((prev) => ({
      ...prev,
      events: prev.events.includes(key)
        ? prev.events.filter((k) => k !== key)
        : [...prev.events, key],
    }));
  };

  const setCategoryEvents = (keys: string[], enabled: boolean) => {
    setDraft((prev) => {
      const set = new Set(prev.events);
      for (const k of keys) {
        if (enabled) set.add(k);
        else set.delete(k);
      }
      return { ...prev, events: Array.from(set) };
    });
  };

  const toggleIgnoreChannel = (id: string) => {
    setDraft((prev) => ({
      ...prev,
      ignoreChannels: prev.ignoreChannels.includes(id)
        ? prev.ignoreChannels.filter((c) => c !== id)
        : [...prev.ignoreChannels, id],
    }));
  };

  const handleSave = async () => {
    if (!configId) return;
    if (draft.events.length === 0) {
      toast({
        title: "Selecciona al menos un evento",
        description: "Si no quieres logs, desactiva el canal.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      await saveSettings(configId, {
        ...draft,
        channelId: draft.channelId === "none" ? null : draft.channelId,
        pingRoleId:
          !draft.pingRoleId || draft.pingRoleId === "none"
            ? null
            : draft.pingRoleId,
      });
      toast({
        title: "Configuración guardada",
        description: "Logs del servidor actualizados.",
      });
      void queryClient.invalidateQueries({ queryKey: getListGuildsQueryKey() });
      const s = await fetchSettings(configId);
      setSettings(s);
      setDraft(settingsToDraft(s));
    } catch (e) {
      toast({
        title: "Error al guardar",
        description: e instanceof Error ? e.message : "Error desconocido",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(key === "name");
    }
  };

  const filtered = useMemo(() => {
    return rows
      .filter((g) => g.name.toLowerCase().includes(search.toLowerCase()))
      .filter((g) => (onlyMine ? g.canManage : true))
      .sort((a, b) => {
        let cmp = 0;
        if (sortKey === "name") cmp = a.name.localeCompare(b.name);
        else if (sortKey === "members") cmp = a.memberCount - b.memberCount;
        else
          cmp =
            new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
        return sortAsc ? cmp : -cmp;
      });
  }, [rows, search, onlyMine, sortKey, sortAsc]);

  const manageableCount = rows.filter((g) => g.canManage).length;

  const categories: CategoryMeta[] = useMemo(() => {
    if (settings?.categories?.length) return settings.categories;
    // Fallback: group flat availableEvents
    const map = new Map<string, EventMeta[]>();
    for (const ev of settings?.availableEvents ?? []) {
      const cat = ev.category ?? "other";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(ev);
    }
    return Array.from(map.entries()).map(([id, events]) => ({
      id,
      label: id,
      events,
    }));
  }, [settings]);

  useEffect(() => {
    if (!configId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeConfig();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [configId]);

  const SortButton = ({ label, k }: { label: string; k: SortKey }) => (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "h-8 text-xs gap-1 font-mono rounded-lg px-2.5",
        sortKey === k
          ? "text-secondary bg-secondary/10 border border-secondary/20"
          : "text-muted-foreground hover:text-foreground",
      )}
      onClick={() => handleSort(k)}
    >
      {label}
      <ArrowUpDown className="h-3 w-3" />
    </Button>
  );

  const enabledCount = draft.events.length;
  const totalEvents = settings?.availableEvents?.length ?? 0;

  return (
    <div className="space-y-5 sm:space-y-6 max-w-[1400px]">
      <PageHeader
        icon={Server}
        title="Servidores"
        description="Servidores donde está el bot. Si eres dueño o admin, puedes configurar logs."
        actions={
          !isLoading ? (
            <div className="text-right">
              <div className="text-2xl font-semibold font-mono text-foreground">
                {rows.length}
              </div>
              <div className="text-[10px] uppercase tracking-widest text-secondary font-mono">
                {manageableCount > 0
                  ? `${manageableCount} gestionables`
                  : "active nodes"}
              </div>
            </div>
          ) : undefined
        }
      />

      {manageableCount === 0 && !isLoading && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-xs font-mono text-amber-100/90">
          No detectamos servidores que gestiones. Si acabas de añadir el scope{" "}
          <code className="text-amber-200">guilds</code>,{" "}
          <button
            type="button"
            className="underline text-amber-200 hover:text-white"
            onClick={() => login()}
          >
            vuelve a iniciar sesión con Discord
          </button>
          .
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 min-w-0 max-w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            placeholder="Buscar servidores…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 bg-card border-border rounded-xl text-sm font-mono focus-visible:ring-primary/40"
          />
        </div>
        <label className="inline-flex items-center gap-2 text-xs font-mono text-muted-foreground cursor-pointer select-none">
          <Switch checked={onlyMine} onCheckedChange={setOnlyMine} />
          Solo mis servidores
        </label>
        <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono flex-wrap">
          <span className="mr-1 text-slate-600">SORT</span>
          <SortButton label="NAME" k="name" />
          <SortButton label="MEMBERS" k="members" />
          <SortButton label="JOINED" k="joined" />
        </div>
      </div>

      {isError && (
        <p className="text-sm text-red-400 font-mono">
          Error al cargar: {(error as Error)?.message ?? "desconocido"}
        </p>
      )}

      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {isLoading
          ? Array(8)
              .fill(0)
              .map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-border bg-card/80 p-4"
                >
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-11 w-11 rounded-xl flex-shrink-0" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-3/4 rounded" />
                      <Skeleton className="h-3 w-1/2 rounded" />
                    </div>
                  </div>
                </div>
              ))
          : filtered.length > 0
            ? filtered.map((guild) => (
                <div
                  key={guild.id}
                  className={cn(
                    "group rounded-2xl border bg-card/90 p-4 transition-all duration-200",
                    guild.canManage
                      ? "border-primary/20 hover:border-primary/40 hover:shadow-[0_0_24px_var(--zt-glow-pink)]"
                      : "border-border hover:border-border",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-11 w-11 border border-border flex-shrink-0 rounded-xl">
                      <AvatarImage src={guild.iconUrl || ""} alt={guild.name} />
                      <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold rounded-xl">
                        {guild.name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0 flex-1 gap-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="font-medium text-foreground truncate text-sm"
                          title={guild.name}
                        >
                          {guild.name}
                        </span>
                        {guild.canManage && (
                          <span title="Puedes gestionar" className="flex-shrink-0">
                            <Crown className="h-3.5 w-3.5 text-amber-400" />
                          </span>
                        )}
                      </div>
                      <div className="flex items-center text-xs text-muted-foreground gap-1.5 font-mono">
                        <Users className="h-3 w-3 flex-shrink-0 text-primary/80" />
                        <span>{formatNumber(guild.memberCount)} users</span>
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground/70">
                        joined{" "}
                        {formatDistanceToNow(new Date(guild.joinedAt), {
                          addSuffix: true,
                          locale: es,
                        })}
                      </span>
                      {guild.logChannelId && (
                        <span className="text-[10px] font-mono text-secondary flex items-center gap-1 mt-0.5">
                          <Hash className="h-3 w-3" />
                          logs activos
                          {guild.logEvents?.length
                            ? ` · ${guild.logEvents.length} eventos`
                            : ""}
                        </span>
                      )}
                    </div>
                  </div>

                  {guild.canManage && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full mt-3 gap-2 font-mono text-xs rounded-xl border-primary/25 hover:bg-primary/10 hover:text-primary"
                      onClick={() => void openConfig(guild.id)}
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                      Configurar logs
                    </Button>
                  )}
                </div>
              ))
            : (
              <div className="col-span-full rounded-2xl border border-dashed border-border py-16 text-center">
                <Server className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-40" />
                <p className="text-sm font-mono text-muted-foreground">
                  No hay servidores con ese filtro
                </p>
              </div>
            )}
      </div>

      {/* Config drawer / modal */}
      {configId && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            aria-label="Cerrar"
            onClick={closeConfig}
          />
          <div className="relative z-10 w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-2xl p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3 mb-5 sticky top-0 bg-card z-10 pb-2 -mt-1 pt-1">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-xl overflow-hidden border border-border flex-shrink-0 bg-black/40">
                  {settings?.iconUrl ? (
                    <img
                      src={settings.iconUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <Shield className="h-4 w-4 text-primary" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-foreground truncate">
                    {settings?.name ?? "Cargando…"}
                  </h2>
                  <p className="text-[11px] font-mono text-muted-foreground">
                    Configuración de logs
                    {totalEvents > 0
                      ? ` · ${enabledCount}/${totalEvents} eventos`
                      : ""}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeConfig}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {loadingSettings || !settings ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
                <p className="text-xs font-mono text-muted-foreground">
                  Cargando configuración…
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Canal */}
                <section>
                  <label className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider block mb-2">
                    Canal de logs
                  </label>
                  <select
                    value={draft.channelId ?? "none"}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        channelId:
                          e.target.value === "none" ? null : e.target.value,
                      }))
                    }
                    className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm font-mono text-foreground"
                  >
                    <option value="none">— Desactivado —</option>
                    {settings.channels.map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        #{ch.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] font-mono text-muted-foreground mt-1.5">
                    El bot necesita enviar mensajes y embeds en ese canal.
                  </p>
                </section>

                {/* Eventos por categoría */}
                <section>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <label className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
                      Eventos a registrar
                    </label>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[10px] font-mono px-2"
                        onClick={() =>
                          setDraft((d) => ({
                            ...d,
                            events: settings.availableEvents.map((e) => e.key),
                          }))
                        }
                      >
                        Todos
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[10px] font-mono px-2"
                        onClick={() => setDraft((d) => ({ ...d, events: [] }))}
                      >
                        Ninguno
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {categories.map((cat) => {
                      const keys = cat.events.map((e) => e.key);
                      const allOn = keys.every((k) => draft.events.includes(k));
                      const someOn =
                        !allOn && keys.some((k) => draft.events.includes(k));
                      return (
                        <div
                          key={cat.id}
                          className="rounded-xl border border-border bg-black/20 overflow-hidden"
                        >
                          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/60 bg-white/[0.02]">
                            <span className="text-xs font-mono font-medium text-foreground">
                              {cat.label}
                              <span className="text-muted-foreground ml-1.5">
                                (
                                {
                                  keys.filter((k) => draft.events.includes(k))
                                    .length
                                }
                                /{keys.length})
                              </span>
                            </span>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground hover:text-primary"
                              onClick={() => setCategoryEvents(keys, !allOn)}
                            >
                              {allOn ? (
                                <CheckSquare className="h-3.5 w-3.5 text-primary" />
                              ) : someOn ? (
                                <CheckSquare className="h-3.5 w-3.5 text-secondary opacity-60" />
                              ) : (
                                <Square className="h-3.5 w-3.5" />
                              )}
                              {allOn ? "Quitar cat." : "Toda cat."}
                            </button>
                          </div>
                          <div className="p-1.5 space-y-0.5">
                            {cat.events.map((ev) => (
                              <label
                                key={ev.key}
                                className="flex items-center justify-between gap-3 px-2.5 py-2 rounded-lg hover:bg-white/[0.03] cursor-pointer"
                              >
                                <div className="min-w-0">
                                  <div className="text-sm text-foreground">
                                    {ev.label}
                                  </div>
                                  {ev.description && (
                                    <div className="text-[10px] font-mono text-muted-foreground truncate">
                                      {ev.description}
                                    </div>
                                  )}
                                </div>
                                <Switch
                                  checked={draft.events.includes(ev.key)}
                                  onCheckedChange={() => toggleEvent(ev.key)}
                                />
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* Opciones avanzadas */}
                <section className="space-y-3">
                  <label className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider block">
                    Filtros y opciones
                  </label>

                  <div className="rounded-xl border border-border bg-black/20 p-2 space-y-0.5">
                    <label className="flex items-center justify-between gap-3 px-2.5 py-2.5 rounded-lg hover:bg-white/[0.03] cursor-pointer">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <Bot className="h-4 w-4 text-secondary mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="text-sm text-foreground">
                            Ignorar bots
                          </div>
                          <div className="text-[10px] font-mono text-muted-foreground">
                            No registrar acciones / mensajes de bots
                          </div>
                        </div>
                      </div>
                      <Switch
                        checked={draft.ignoreBots}
                        onCheckedChange={(v) =>
                          setDraft((d) => ({ ...d, ignoreBots: v }))
                        }
                      />
                    </label>

                    <label className="flex items-center justify-between gap-3 px-2.5 py-2.5 rounded-lg hover:bg-white/[0.03] cursor-pointer">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <EyeOff className="h-4 w-4 text-secondary mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="text-sm text-foreground">
                            Ignorar webhooks
                          </div>
                          <div className="text-[10px] font-mono text-muted-foreground">
                            Omitir deletes/edits de webhooks
                          </div>
                        </div>
                      </div>
                      <Switch
                        checked={draft.ignoreWebhooks}
                        onCheckedChange={(v) =>
                          setDraft((d) => ({ ...d, ignoreWebhooks: v }))
                        }
                      />
                    </label>

                    <label className="flex items-center justify-between gap-3 px-2.5 py-2.5 rounded-lg hover:bg-white/[0.03] cursor-pointer">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <Paperclip className="h-4 w-4 text-secondary mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="text-sm text-foreground">
                            Incluir adjuntos
                          </div>
                          <div className="text-[10px] font-mono text-muted-foreground">
                            Links de archivos en mensajes borrados
                          </div>
                        </div>
                      </div>
                      <Switch
                        checked={draft.includeAttachments}
                        onCheckedChange={(v) =>
                          setDraft((d) => ({ ...d, includeAttachments: v }))
                        }
                      />
                    </label>
                  </div>

                  {/* Join alert */}
                  <div className="rounded-xl border border-border bg-black/20 px-3.5 py-3">
                    <div className="flex items-start gap-2.5 mb-2">
                      <UserPlus className="h-4 w-4 text-secondary mt-0.5 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-foreground">
                          Alerta de cuenta nueva
                        </div>
                        <div className="text-[10px] font-mono text-muted-foreground">
                          Marcar joins con cuenta más nueva que N días (0 =
                          desactivado)
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pl-6">
                      <Input
                        type="number"
                        min={0}
                        max={365}
                        value={draft.joinAlertDays}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            joinAlertDays: Math.max(
                              0,
                              Math.min(365, Number(e.target.value) || 0),
                            ),
                          }))
                        }
                        className="h-9 w-24 font-mono text-sm rounded-lg"
                      />
                      <span className="text-xs font-mono text-muted-foreground">
                        días
                      </span>
                    </div>
                  </div>

                  {/* Ping role */}
                  <div className="rounded-xl border border-border bg-black/20 px-3.5 py-3">
                    <div className="flex items-start gap-2.5 mb-2">
                      <Bell className="h-4 w-4 text-secondary mt-0.5 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-foreground">
                          Rol a mencionar
                        </div>
                        <div className="text-[10px] font-mono text-muted-foreground">
                          Opcional: pings en cada log (útil para staff)
                        </div>
                      </div>
                    </div>
                    <select
                      value={draft.pingRoleId ?? "none"}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          pingRoleId:
                            e.target.value === "none" ? null : e.target.value,
                        }))
                      }
                      className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm font-mono text-foreground ml-0 sm:ml-6 sm:w-[calc(100%-1.5rem)]"
                    >
                      <option value="none">— Sin mención —</option>
                      {(settings.roles ?? []).map((r) => (
                        <option key={r.id} value={r.id}>
                          @{r.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Ignore channels */}
                  <div className="rounded-xl border border-border bg-black/20 px-3.5 py-3">
                    <button
                      type="button"
                      className="w-full flex items-center justify-between gap-2 text-left"
                      onClick={() => setShowIgnoreChannels((v) => !v)}
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <Hash className="h-4 w-4 text-secondary mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="text-sm text-foreground">
                            Canales ignorados
                          </div>
                          <div className="text-[10px] font-mono text-muted-foreground">
                            No loguear delete/edit en estos canales
                            {draft.ignoreChannels.length
                              ? ` · ${draft.ignoreChannels.length} seleccionados`
                              : ""}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {showIgnoreChannels ? "▲" : "▼"}
                      </span>
                    </button>
                    {showIgnoreChannels && (
                      <div className="mt-2 max-h-40 overflow-y-auto space-y-0.5 rounded-lg border border-border/50 p-1.5">
                        {settings.channels.length === 0 ? (
                          <p className="text-[10px] font-mono text-muted-foreground px-2 py-1">
                            Sin canales de texto
                          </p>
                        ) : (
                          settings.channels.map((ch) => (
                            <label
                              key={ch.id}
                              className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-white/[0.03] cursor-pointer"
                            >
                              <span className="text-xs font-mono text-foreground truncate">
                                #{ch.name}
                              </span>
                              <Switch
                                checked={draft.ignoreChannels.includes(ch.id)}
                                onCheckedChange={() =>
                                  toggleIgnoreChannel(ch.id)
                                }
                              />
                            </label>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </section>

                <div className="flex gap-2 pt-1 sticky bottom-0 bg-card pb-1">
                  <Button
                    variant="outline"
                    className="flex-1 rounded-xl font-mono text-xs"
                    onClick={closeConfig}
                  >
                    Cancelar
                  </Button>
                  <Button
                    className="flex-1 gap-2 rounded-xl font-mono text-xs"
                    onClick={() => void handleSave()}
                    disabled={saving}
                  >
                    {saving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                    Guardar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
