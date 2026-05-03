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
      className={`h-8 text-xs gap-1 ${sortKey === k ? "text-primary" : "text-muted-foreground"}`}
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
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Server className="h-8 w-8 text-primary" />
            Servers
          </h1>
          <p className="text-muted-foreground mt-1">All Discord servers the bot is currently monitoring.</p>
        </div>
        {!isLoading && guilds && (
          <div className="text-right">
            <div className="text-2xl font-bold text-foreground">{guilds.length}</div>
            <div className="text-xs text-muted-foreground">total servers</div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search servers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 bg-card border-border text-sm"
            data-testid="input-filter-guilds"
          />
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          Sort:
          <SortButton label="Name" k="name" />
          <SortButton label="Members" k="members" />
          <SortButton label="Joined" k="joined" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {isLoading ? (
          Array(8).fill(0).map((_, i) => (
            <Card key={i} className="border-card-border bg-card">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : filtered.length > 0 ? (
          filtered.map((guild) => (
            <Card key={guild.id} className="border-card-border bg-card hover:bg-sidebar transition-colors cursor-default">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <Avatar className="h-11 w-11 border border-card-border flex-shrink-0">
                    <AvatarImage src={guild.iconUrl || ""} alt={guild.name} />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
                      {guild.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col space-y-1 overflow-hidden min-w-0">
                    <span className="font-semibold text-foreground truncate text-sm" title={guild.name}>
                      {guild.name}
                    </span>
                    <div className="flex items-center text-xs text-muted-foreground gap-1">
                      <Users className="h-3 w-3 flex-shrink-0" />
                      <span>{formatNumber(guild.memberCount)} members</span>
                    </div>
                    <div className="text-xs text-muted-foreground/70">
                      Joined {formatDistanceToNow(new Date(guild.joinedAt), { addSuffix: true })}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : search ? (
          <div className="col-span-full py-12 text-center text-muted-foreground">
            <Search className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
            <p>No servers match "{search}"</p>
          </div>
        ) : (
          <div className="col-span-full py-12 text-center text-muted-foreground">
            <Server className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p>No servers found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
