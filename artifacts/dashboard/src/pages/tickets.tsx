import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Ticket,
  Search,
  RefreshCw,
  Settings2,
  Send,
  Lock,
  Loader2,
  CheckCircle2,
  CircleDot,
  Hand,
  X,
  Hash,
  Shield,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/dash/page-header";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type TicketRow = {
  id: number;
  guildId: string;
  guildName: string | null;
  channelId: string;
  userId: string;
  username: string;
  category: string;
  subject: string | null;
  status: string;
  claimedBy: string | null;
  claimedByName: string | null;
  closedBy: string | null;
  closedByName: string | null;
  closeReason: string | null;
  createdAt: string;
  closedAt: string | null;
};

type TicketStats = {
  open: number;
  claimed: number;
  closed: number;
  active: number;
  total: number;
};

type GuildTicketRow = {
  id: string;
  name: string;
  iconUrl: string | null;
  memberCount: number;
  configured: boolean;
  activeTickets: number;
  config: {
    categoryId: string | null;
    staffRoleId: string | null;
    logChannelId: string | null;
    maxOpen: number;
    deleteAfterCloseSec: number;
    panelTitle: string;
    panelDescription: string;
  };
};

type ConfigDetail = {
  guildId: string;
  name: string;
  iconUrl: string | null;
  config: GuildTicketRow["config"];
  categories: { id: string; name: string }[];
  textChannels: { id: string; name: string }[];
  roles: { id: string; name: string; color: string }[];
};

const STATUS_STYLE: Record<string, string> = {
  open: "text-emerald-300 bg-emerald-500/15 border-emerald-500/30",
  claimed: "text-cyan-300 bg-cyan-500/15 border-cyan-500/30",
  closed: "text-slate-400 bg-white/5 border-white/10",
};

const CAT_LABEL: Record<string, string> = {
  soporte: "Soporte",
  reporte: "Reporte",
  apelacion: "Apelación",
  otro: "Otro",
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export default function TicketsPage() {
  const { toast } = useToast();
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [stats, setStats] = useState<TicketStats | null>(null);
  const [guilds, setGuilds] = useState<GuildTicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "open" | "claimed" | "closed">(
    "active",
  );
  const [tab, setTab] = useState<"list" | "config">("list");

  // Config drawer
  const [configGuildId, setConfigGuildId] = useState<string | null>(null);
  const [configDetail, setConfigDetail] = useState<ConfigDetail | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [saving, setSaving] = useState(false);
  const [panelChannel, setPanelChannel] = useState("none");
  const [draft, setDraft] = useState<GuildTicketRow["config"] | null>(null);
  const [closingId, setClosingId] = useState<number | null>(null);

  const load = useCallback(
    async (soft = false) => {
      if (soft) setRefreshing(true);
      else setLoading(true);
      try {
        const statusQ =
          statusFilter === "all" ? "" : `?status=${statusFilter}&limit=150`;
        // Partial load: one failing endpoint must not break the whole page
        const results = await Promise.allSettled([
          api<TicketRow[]>(`/api/tickets${statusQ || "?limit=150"}`),
          api<TicketStats>("/api/tickets/stats"),
          api<GuildTicketRow[]>("/api/tickets/guilds"),
        ]);
        if (results[0].status === "fulfilled") setTickets(results[0].value);
        if (results[1].status === "fulfilled") setStats(results[1].value);
        if (results[2].status === "fulfilled") setGuilds(results[2].value);

        const failed = results.filter((r) => r.status === "rejected");
        if (failed.length === results.length) {
          const reason =
            failed[0].status === "rejected"
              ? failed[0].reason
              : new Error("Error");
          throw reason instanceof Error ? reason : new Error(String(reason));
        }
        if (failed.length > 0 && !soft) {
          toast({
            title: "Carga parcial de tickets",
            description: "Algunos datos no se pudieron cargar; reintenta en un momento.",
            variant: "destructive",
          });
        }
      } catch (e) {
        toast({
          title: "Error al cargar tickets",
          description: e instanceof Error ? e.message : "Error",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [statusFilter, toast],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => void load(true), 60000);
    return () => clearInterval(id);
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return tickets;
    return tickets.filter(
      (t) =>
        t.username.toLowerCase().includes(q) ||
        t.guildName?.toLowerCase().includes(q) ||
        t.subject?.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.userId.includes(q) ||
        String(t.id).includes(q),
    );
  }, [tickets, search]);

  const openConfig = async (guildId: string) => {
    setConfigGuildId(guildId);
    setLoadingConfig(true);
    setConfigDetail(null);
    setDraft(null);
    setPanelChannel("none");
    try {
      const d = await api<ConfigDetail>(`/api/tickets/guilds/${guildId}/config`);
      setConfigDetail(d);
      setDraft({ ...d.config });
    } catch (e) {
      toast({
        title: "No se pudo cargar la config",
        description: e instanceof Error ? e.message : "Error",
        variant: "destructive",
      });
      setConfigGuildId(null);
    } finally {
      setLoadingConfig(false);
    }
  };

  const saveConfig = async () => {
    if (!configGuildId || !draft) return;
    setSaving(true);
    try {
      await api(`/api/tickets/guilds/${configGuildId}/config`, {
        method: "PATCH",
        body: JSON.stringify(draft),
      });
      toast({ title: "Configuración guardada" });
      void load(true);
      const d = await api<ConfigDetail>(
        `/api/tickets/guilds/${configGuildId}/config`,
      );
      setConfigDetail(d);
      setDraft({ ...d.config });
    } catch (e) {
      toast({
        title: "Error al guardar",
        description: e instanceof Error ? e.message : "Error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const publishPanel = async () => {
    if (!configGuildId || panelChannel === "none") {
      toast({
        title: "Elige un canal",
        description: "Selecciona dónde publicar el panel.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      // save first so panel text is current
      if (draft) {
        await api(`/api/tickets/guilds/${configGuildId}/config`, {
          method: "PATCH",
          body: JSON.stringify(draft),
        });
      }
      await api(`/api/tickets/guilds/${configGuildId}/panel`, {
        method: "POST",
        body: JSON.stringify({ channelId: panelChannel }),
      });
      toast({
        title: "Panel publicado",
        description: "El menú de tickets ya está en el canal.",
      });
    } catch (e) {
      toast({
        title: "No se pudo publicar",
        description: e instanceof Error ? e.message : "Error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const closeTicket = async (id: number) => {
    setClosingId(id);
    try {
      await api(`/api/tickets/${id}/close`, {
        method: "POST",
        body: JSON.stringify({ reason: "Cerrado desde el dashboard" }),
      });
      toast({ title: "Ticket cerrado" });
      void load(true);
    } catch (e) {
      toast({
        title: "Error al cerrar",
        description: e instanceof Error ? e.message : "Error",
        variant: "destructive",
      });
    } finally {
      setClosingId(null);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6 max-w-[1400px]">
      <PageHeader
        icon={Ticket}
        title="Tickets"
        description="Soporte por servidor: lista de tickets, config y panel de apertura."
        actions={
          <div className="flex items-center gap-3">
            {stats && (
              <div className="hidden sm:flex items-center gap-3 text-right font-mono text-xs">
                <div>
                  <div className="text-lg font-semibold text-emerald-300">
                    {stats.active}
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    activos
                  </div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-foreground">
                    {stats.total}
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    total
                  </div>
                </div>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-2 font-mono text-xs rounded-xl"
              onClick={() => void load(true)}
              disabled={refreshing}
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", refreshing && "animate-spin")}
              />
              Refresh
            </Button>
          </div>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Open",
            value: stats?.open ?? "—",
            color: "text-emerald-300",
            icon: CircleDot,
          },
          {
            label: "Claimed",
            value: stats?.claimed ?? "—",
            color: "text-cyan-300",
            icon: Hand,
          },
          {
            label: "Closed",
            value: stats?.closed ?? "—",
            color: "text-slate-400",
            icon: Lock,
          },
          {
            label: "Guilds cfg",
            value: guilds.filter((g) => g.configured).length,
            color: "text-primary",
            icon: CheckCircle2,
          },
        ].map((k) => (
          <div
            key={k.label}
            className="rounded-2xl border border-border bg-card/90 px-4 py-3"
          >
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              <k.icon className="h-3.5 w-3.5" />
              {k.label}
            </div>
            <div className={cn("text-2xl font-semibold font-mono mt-1", k.color)}>
              {k.value}
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(
          [
            ["list", "Lista de tickets"],
            ["config", "Config por servidor"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-mono border transition-colors",
              tab === id
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "list" && (
        <>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar usuario, servidor, asunto…"
                className="pl-9 h-10 rounded-xl font-mono text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["active", "Activos"],
                  ["open", "Open"],
                  ["claimed", "Claimed"],
                  ["closed", "Closed"],
                  ["all", "Todos"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setStatusFilter(id)}
                  className={cn(
                    "px-2.5 py-1.5 rounded-lg text-[11px] font-mono border",
                    statusFilter === id
                      ? "border-secondary/40 bg-secondary/10 text-secondary"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card/90 overflow-hidden">
            {loading ? (
              <div className="p-4 space-y-3">
                {Array(6)
                  .fill(0)
                  .map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-xl" />
                  ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center">
                <Ticket className="h-8 w-8 mx-auto mb-3 text-muted-foreground opacity-40" />
                <p className="text-sm font-mono text-muted-foreground">
                  No hay tickets con este filtro
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[720px]">
                  <thead>
                    <tr className="border-b border-border text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      <th className="text-left px-4 py-3">ID</th>
                      <th className="text-left px-4 py-3">Usuario</th>
                      <th className="text-left px-4 py-3">Servidor</th>
                      <th className="text-left px-4 py-3">Cat.</th>
                      <th className="text-left px-4 py-3">Estado</th>
                      <th className="text-left px-4 py-3">Asunto</th>
                      <th className="text-left px-4 py-3">Creado</th>
                      <th className="text-right px-4 py-3">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((t) => (
                      <tr
                        key={t.id}
                        className="border-b border-border/60 hover:bg-white/[0.02]"
                      >
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          #{t.id}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">
                            {t.username}
                          </div>
                          <div className="text-[10px] font-mono text-muted-foreground">
                            {t.userId}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground max-w-[140px] truncate">
                          {t.guildName ?? t.guildId}
                        </td>
                        <td className="px-4 py-3 text-xs font-mono">
                          {CAT_LABEL[t.category] ?? t.category}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "inline-flex px-2 py-0.5 rounded-md text-[10px] font-mono border uppercase",
                              STATUS_STYLE[t.status] ?? STATUS_STYLE.closed,
                            )}
                          >
                            {t.status}
                          </span>
                          {t.claimedByName && (
                            <div className="text-[10px] font-mono text-cyan-400/80 mt-0.5">
                              → {t.claimedByName}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate">
                          {t.subject ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-[11px] font-mono text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(new Date(t.createdAt), {
                            addSuffix: true,
                            locale: es,
                          })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {t.status !== "closed" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1.5 text-[11px] font-mono rounded-lg border-primary/30 hover:bg-primary/10"
                              disabled={closingId === t.id}
                              onClick={() => void closeTicket(t.id)}
                            >
                              {closingId === t.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Lock className="h-3 w-3" />
                              )}
                              Cerrar
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {tab === "config" && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {loading
            ? Array(6)
                .fill(0)
                .map((_, i) => (
                  <Skeleton key={i} className="h-36 rounded-2xl" />
                ))
            : guilds.map((g) => (
                <div
                  key={g.id}
                  className={cn(
                    "rounded-2xl border bg-card/90 p-4 transition-all",
                    g.configured
                      ? "border-primary/25 hover:border-primary/40"
                      : "border-border",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl overflow-hidden border border-border bg-black/40 flex-shrink-0">
                      {g.iconUrl ? (
                        <img
                          src={g.iconUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-xs font-mono text-primary">
                          {g.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate">{g.name}</div>
                      <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                        {g.configured ? (
                          <span className="text-emerald-400">configurado</span>
                        ) : (
                          <span className="text-amber-400">sin setup</span>
                        )}
                        {" · "}
                        {g.activeTickets} activos
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full mt-3 gap-2 font-mono text-xs rounded-xl"
                    onClick={() => void openConfig(g.id)}
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                    Configurar tickets
                  </Button>
                </div>
              ))}
        </div>
      )}

      {/* Config modal */}
      {configGuildId && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            aria-label="Cerrar"
            onClick={() => setConfigGuildId(null)}
          />
          <div className="relative z-10 w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-2xl p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3 mb-5">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-xl overflow-hidden border border-border bg-black/40 flex-shrink-0">
                  {configDetail?.iconUrl ? (
                    <img
                      src={configDetail.iconUrl}
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
                  <h2 className="text-base font-semibold truncate">
                    {configDetail?.name ?? "Cargando…"}
                  </h2>
                  <p className="text-[11px] font-mono text-muted-foreground">
                    Configuración de tickets
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfigGuildId(null)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {loadingConfig || !draft || !configDetail ? (
              <div className="flex flex-col items-center py-16 gap-3">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
                <p className="text-xs font-mono text-muted-foreground">
                  Cargando…
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <Field label="Categoría de tickets">
                  <select
                    value={draft.categoryId ?? "none"}
                    onChange={(e) =>
                      setDraft((d) =>
                        d
                          ? {
                              ...d,
                              categoryId:
                                e.target.value === "none"
                                  ? null
                                  : e.target.value,
                            }
                          : d,
                      )
                    }
                    className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm font-mono"
                  >
                    <option value="none">— Seleccionar —</option>
                    {configDetail.categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Rol staff">
                  <select
                    value={draft.staffRoleId ?? "none"}
                    onChange={(e) =>
                      setDraft((d) =>
                        d
                          ? {
                              ...d,
                              staffRoleId:
                                e.target.value === "none"
                                  ? null
                                  : e.target.value,
                            }
                          : d,
                      )
                    }
                    className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm font-mono"
                  >
                    <option value="none">— Seleccionar —</option>
                    {configDetail.roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        @{r.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Canal de logs / transcripts">
                  <select
                    value={draft.logChannelId ?? "none"}
                    onChange={(e) =>
                      setDraft((d) =>
                        d
                          ? {
                              ...d,
                              logChannelId:
                                e.target.value === "none"
                                  ? null
                                  : e.target.value,
                            }
                          : d,
                      )
                    }
                    className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm font-mono"
                  >
                    <option value="none">— Ninguno —</option>
                    {configDetail.textChannels.map((c) => (
                      <option key={c.id} value={c.id}>
                        #{c.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Max abiertos / user">
                    <Input
                      type="number"
                      min={1}
                      max={5}
                      value={draft.maxOpen}
                      onChange={(e) =>
                        setDraft((d) =>
                          d
                            ? {
                                ...d,
                                maxOpen: Math.min(
                                  5,
                                  Math.max(1, Number(e.target.value) || 1),
                                ),
                              }
                            : d,
                        )
                      }
                      className="h-10 rounded-xl font-mono"
                    />
                  </Field>
                  <Field label="Borrar canal (seg)">
                    <Input
                      type="number"
                      min={0}
                      max={300}
                      value={draft.deleteAfterCloseSec}
                      onChange={(e) =>
                        setDraft((d) =>
                          d
                            ? {
                                ...d,
                                deleteAfterCloseSec: Math.min(
                                  300,
                                  Math.max(0, Number(e.target.value) || 0),
                                ),
                              }
                            : d,
                        )
                      }
                      className="h-10 rounded-xl font-mono"
                    />
                  </Field>
                </div>

                <Field label="Título del panel">
                  <Input
                    value={draft.panelTitle}
                    onChange={(e) =>
                      setDraft((d) =>
                        d ? { ...d, panelTitle: e.target.value } : d,
                      )
                    }
                    className="h-10 rounded-xl font-mono text-sm"
                  />
                </Field>

                <Field label="Descripción del panel">
                  <textarea
                    value={draft.panelDescription}
                    onChange={(e) =>
                      setDraft((d) =>
                        d ? { ...d, panelDescription: e.target.value } : d,
                      )
                    }
                    rows={4}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-mono resize-y"
                  />
                </Field>

                <div className="rounded-xl border border-border bg-black/20 p-3 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                    <Hash className="h-3.5 w-3.5" />
                    Publicar panel en canal
                  </div>
                  <select
                    value={panelChannel}
                    onChange={(e) => setPanelChannel(e.target.value)}
                    className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm font-mono"
                  >
                    <option value="none">— Elegir canal —</option>
                    {configDetail.textChannels.map((c) => (
                      <option key={c.id} value={c.id}>
                        #{c.name}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full gap-2 font-mono text-xs rounded-xl"
                    disabled={saving || panelChannel === "none"}
                    onClick={() => void publishPanel()}
                  >
                    <Send className="h-3.5 w-3.5" />
                    Publicar panel
                  </Button>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    className="flex-1 rounded-xl font-mono text-xs"
                    onClick={() => setConfigGuildId(null)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    className="flex-1 gap-2 rounded-xl font-mono text-xs"
                    disabled={saving}
                    onClick={() => void saveConfig()}
                  >
                    {saving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Settings2 className="h-3.5 w-3.5" />
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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider block mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}
