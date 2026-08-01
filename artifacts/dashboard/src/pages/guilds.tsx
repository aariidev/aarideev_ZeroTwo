import { useMemo, useState } from "react";
import { useListGuilds, getListGuildsQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
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
  Hash,
  ChevronRight,
} from "lucide-react";
import { PageHeader } from "@/components/dash/page-header";
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

export default function Guilds() {
  const [, navigate] = useLocation();
  const { login } = useAuth();
  const [search, setSearch]     = useState("");
  const [sortKey, setSortKey]   = useState<SortKey>("members");
  const [sortAsc, setSortAsc]   = useState(false);
  const [onlyMine, setOnlyMine] = useState(true);

  const { data: guilds, isLoading, isError, error } = useListGuilds({
    query: {
      queryKey: getListGuildsQueryKey(),
      refetchInterval: 120_000,
      staleTime: 60_000,
    },
  });

  const rows = (guilds ?? []) as GuildRow[];

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(key === "name"); }
  };

  const filtered = useMemo(() => {
    return rows
      .filter((g) => g.name.toLowerCase().includes(search.toLowerCase()))
      .filter((g) => (onlyMine ? g.canManage : true))
      .sort((a, b) => {
        let cmp = 0;
        if (sortKey === "name")    cmp = a.name.localeCompare(b.name);
        else if (sortKey === "members") cmp = a.memberCount - b.memberCount;
        else cmp = new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
        return sortAsc ? cmp : -cmp;
      });
  }, [rows, search, onlyMine, sortKey, sortAsc]);

  const manageableCount = rows.filter((g) => g.canManage).length;

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

  return (
    <div className="space-y-5 sm:space-y-6 max-w-[1400px]">
      <PageHeader
        icon={Server}
        title="Servidores"
        description="Selecciona un servidor para ver su panel de configuración."
        actions={
          !isLoading ? (
            <div className="text-right">
              <div className="text-2xl font-semibold font-mono text-foreground">
                {rows.length}
              </div>
              <div className="text-[10px] uppercase tracking-widest text-secondary font-mono">
                {manageableCount > 0 ? `${manageableCount} gestionables` : "active nodes"}
              </div>
            </div>
          ) : undefined
        }
      />

      {/* Warnings */}
      {!isLoading && rows.length === 0 && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-xs font-mono text-amber-100/90">
          No hay servidores en común entre tu cuenta y el bot. Solo ves guilds donde{" "}
          <strong>tú eres miembro</strong> y el bot está presente. Si falta el scope{" "}
          <code className="text-amber-200">guilds</code>,{" "}
          <button type="button" className="underline text-amber-200 hover:text-white" onClick={() => login()}>
            vuelve a iniciar sesión con Discord
          </button>
          .
        </div>
      )}
      {manageableCount === 0 && rows.length > 0 && !isLoading && (
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-mono text-muted-foreground">
          Estás en {rows.length} servidor(es) con el bot, pero no tienes permiso de{" "}
          <strong className="text-foreground">Administrador</strong> o{" "}
          <strong className="text-foreground">Gestionar servidor</strong>.
        </div>
      )}

      {/* Filtros */}
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

      {/* Grid */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {isLoading
          ? Array(8).fill(0).map((_, i) => (
              <div key={i} className="rounded-2xl border border-border bg-card/80 p-4">
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
                      ? "border-primary/20 hover:border-primary/40 hover:shadow-[0_0_24px_var(--zt-glow-pink)] cursor-pointer"
                      : "border-border",
                  )}
                  onClick={() => guild.canManage && navigate(`/guilds/${guild.id}`)}
                  role={guild.canManage ? "button" : undefined}
                  tabIndex={guild.canManage ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (guild.canManage && (e.key === "Enter" || e.key === " ")) {
                      navigate(`/guilds/${guild.id}`);
                    }
                  }}
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
                        <span className="font-medium text-foreground truncate text-sm" title={guild.name}>
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
                        {formatDistanceToNow(new Date(guild.joinedAt), { addSuffix: true, locale: es })}
                      </span>
                      {guild.logChannelId && (
                        <span className="text-[10px] font-mono text-secondary flex items-center gap-1 mt-0.5">
                          <Hash className="h-3 w-3" />
                          logs activos
                          {guild.logEvents?.length ? ` · ${guild.logEvents.length} eventos` : ""}
                        </span>
                      )}
                    </div>
                    {guild.canManage && (
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary/60 transition-colors flex-shrink-0 mt-1" />
                    )}
                  </div>

                  {guild.canManage && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full mt-3 gap-2 font-mono text-xs rounded-xl border-primary/25 hover:bg-primary/10 hover:text-primary"
                      onClick={(e) => { e.stopPropagation(); navigate(`/guilds/${guild.id}`); }}
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                      Abrir panel
                    </Button>
                  )}
                </div>
              ))
            : (
              <div className="col-span-full rounded-2xl border border-dashed border-border py-16 text-center">
                <Server className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-40" />
                <p className="text-sm font-mono text-muted-foreground">No hay servidores con ese filtro</p>
              </div>
            )}
      </div>
    </div>
  );
}
