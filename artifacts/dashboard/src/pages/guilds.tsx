import { useListGuilds, getListGuildsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/format";
import { formatDistanceToNow } from "date-fns";
import { Users, Server } from "lucide-react";

export default function Guilds() {
  const { data: guilds, isLoading } = useListGuilds({
    query: {
      queryKey: getListGuildsQueryKey(),
      refetchInterval: 30000,
    }
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Server className="h-8 w-8 text-primary" />
          Servers
        </h1>
        <p className="text-muted-foreground mt-1">All Discord servers the bot is currently monitoring.</p>
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
        ) : guilds && guilds.length > 0 ? (
          guilds.map((guild) => (
            <Card key={guild.id} className="border-card-border bg-card hover:bg-sidebar transition-colors">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <Avatar className="h-12 w-12 border border-card-border">
                    <AvatarImage src={guild.iconUrl || ""} alt={guild.name} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {guild.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col space-y-1 overflow-hidden">
                    <span className="font-semibold text-foreground truncate" title={guild.name}>
                      {guild.name}
                    </span>
                    <div className="flex items-center text-xs text-muted-foreground gap-1">
                      <Users className="h-3 w-3" />
                      {formatNumber(guild.memberCount)} members
                    </div>
                    <div className="text-xs text-muted-foreground pt-1">
                      Joined {formatDistanceToNow(new Date(guild.joinedAt), { addSuffix: true })}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
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
