import { useState } from "react";
import { useListGuilds, getListGuildsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/format";
import { formatDistanceToNow } from "date-fns";
import { Users, Server, Search, ArrowUpDown } from "lucide-react";

type SortKey = "name" | "members" | "joined";

export default function Guilds() {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("members");
  const [sortAsc, setSortAsc] = useState(false);

  const { data: guilds, isLoading } = useListGuilds({
    query: { queryKey: getListGuildsQueryKey(), refetchInterval: 30000 }
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(key === "name"); }
  };

  const filtered = (guilds || [])
    .filter(g => g.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "members") cmp = a.memberCount - b.memberCount;
      else cmp = new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
      return sortAsc ? cmp : -cmp;
    });

  const SortButton = ({ label, k }: { label: string; k: SortKey }) => (
    <Button
      variant="ghost"
      size="sm"
      className={`h-8 text-xs gap-1 font-mono-custom rounded-none ${sortKey === k ? "text-[#00f5d4] border-b border-[#00f5d4]" : "text-muted-foreground hover:text-primary"}`}
      onClick={() => handleSort(k)}
    >
      {label}
      <ArrowUpDown className="h-3 w-3" />
    </Button>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary font-display flex items-center gap-2 glow-text">
            <Server className="h-8 w-8 text-primary" />
            NETWORK_NODES
          </h1>
          <p className="text-muted-foreground mt-1 font-mono-custom text-sm">All Discord servers the bot is currently monitoring.</p>
        </div>
        {!isLoading && guilds && (
          <div className="text-right">
            <div className="text-2xl font-bold text-foreground font-mono-custom">{guilds.length}</div>
            <div className="text-xs text-[#00f5d4] font-mono-custom">active_nodes</div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[#00f5d4]" />
          <Input
            placeholder="Search nodes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 bg-[#050505] border-[#00f5d4]/50 text-sm font-mono-custom rounded-none focus-visible:ring-[#00f5d4] text-[#00f5d4]"
            data-testid="input-filter-guilds"
          />
          <span className="absolute right-3 top-2 text-[#00f5d4] animate-pulse font-mono-custom">_</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono-custom">
          SORT_BY:
          <SortButton label="NAME" k="name" />
          <SortButton label="MEMBERS" k="members" />
          <SortButton label="JOINED" k="joined" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {isLoading ? (
          Array(8).fill(0).map((_, i) => (
            <Card key={i} className="border-card-border bg-card rounded-none">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-none" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-3/4 rounded-none" />
                    <Skeleton className="h-3 w-1/2 rounded-none" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : filtered.length > 0 ? (
          filtered.map((guild) => (
            <Card key={guild.id} className="border-card-border bg-card hover:bg-sidebar transition-colors cursor-default rounded-none corner-bracket hover:glow-primary hover:border-primary/50 group">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <Avatar className="h-11 w-11 border border-card-border flex-shrink-0 rounded-none group-hover:border-primary/50 transition-colors">
                    <AvatarImage src={guild.iconUrl || ""} alt={guild.name} className="rounded-none" />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold font-display rounded-none">
                      {guild.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col space-y-1 overflow-hidden min-w-0">
                    <span className="font-semibold text-foreground truncate text-sm font-mono-custom group-hover:text-[#00f5d4] transition-colors" title={guild.name}>
                      {guild.name}
                    </span>
                    <div className="flex items-center text-xs text-muted-foreground gap-1 font-mono-custom">
                      <Users className="h-3 w-3 flex-shrink-0 text-primary" />
                      <span>{formatNumber(guild.memberCount)} users</span>
                    </div>
                    <div className="text-[10px] text-zinc-500 font-mono-custom uppercase">
                      Linked {formatDistanceToNow(new Date(guild.joinedAt), { addSuffix: true })}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : search ? (
          <div className="col-span-full py-12 text-center text-[#00f5d4] font-mono-custom">
            <Search className="h-10 w-10 mx-auto text-[#00f5d4]/30 mb-3" />
            <p>No nodes match "{search}"</p>
          </div>
        ) : (
          <div className="col-span-full py-12 text-center text-[#00f5d4] font-mono-custom">
            <Server className="h-12 w-12 mx-auto text-[#00f5d4]/50 mb-3" />
            <p>No nodes found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
