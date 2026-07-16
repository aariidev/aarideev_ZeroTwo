import { useState } from "react";
import { useListWarns, useDeleteWarn, getListWarnsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2, AlertTriangle, ShieldAlert, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export default function Warns() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  const { data: warns, isLoading } = useListWarns(undefined, {
    query: { queryKey: getListWarnsQueryKey(), refetchInterval: 30000 }
  });

  const deleteMutation = useDeleteWarn({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListWarnsQueryKey() });
        toast({ title: "Warning removed", description: "The warning has been successfully deleted." });
        setPendingDeleteId(null);
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to delete the warning.", variant: "destructive" });
        setPendingDeleteId(null);
      }
    }
  });

  const filtered = warns?.filter(w =>
    w.username.toLowerCase().includes(search.toLowerCase()) ||
    w.moderatorName.toLowerCase().includes(search.toLowerCase()) ||
    w.reason.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const pendingWarn = warns?.find(w => w.id === pendingDeleteId);

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-primary font-display flex items-center gap-2 glow-text">
            <ShieldAlert className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            INFRACTIONS_DB
          </h1>
          <p className="text-muted-foreground mt-1 font-mono-custom text-sm">Review and manage user infractions across all servers.</p>
        </div>
        {!isLoading && warns && warns.length > 0 && (
          <div className="text-right">
            <div className="text-xl sm:text-2xl font-bold text-foreground font-mono-custom">{warns.length}</div>
            <div className="text-xs text-primary font-mono-custom">total_warnings</div>
          </div>
        )}
      </div>

      <Card className="border-card-border bg-card rounded-none corner-bracket glow-primary">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2 font-display text-primary">
              <AlertTriangle className="h-5 w-5 text-primary" />
              Recent Warnings
            </CardTitle>
            <div className="relative w-full sm:w-64 sm:ml-auto">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-primary" />
              <Input
                placeholder="Filter by user, mod, reason..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9 bg-sidebar border-primary/50 text-sm font-mono-custom rounded-none focus-visible:ring-primary"
                data-testid="input-filter-warns"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-none" />)}
            </div>
          ) : filtered.length > 0 ? (
            <div className="rounded-none border border-primary/30 overflow-x-auto bg-[#050505]">
              <Table className="min-w-[560px]">
                <TableHeader className="bg-sidebar border-b border-primary/30">
                  <TableRow className="border-none hover:bg-transparent">
                    <TableHead className="text-primary font-mono-custom">USER</TableHead>
                    <TableHead className="text-primary font-mono-custom">MODERATOR</TableHead>
                    <TableHead className="text-primary font-mono-custom">REASON</TableHead>
                    <TableHead className="text-primary font-mono-custom whitespace-nowrap">DATE</TableHead>
                    <TableHead className="text-right text-primary font-mono-custom">ACTIONS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((warn) => (
                    <TableRow key={warn.id} className="border-b border-primary/10 hover:bg-primary/5">
                      <TableCell className="font-bold text-foreground font-mono-custom whitespace-nowrap">@{warn.username}</TableCell>
                      <TableCell className="text-zinc-400 font-mono-custom text-xs whitespace-nowrap">@{warn.moderatorName}</TableCell>
                      <TableCell className="max-w-[160px] sm:max-w-[280px] truncate text-sm font-mono-custom text-[#00f5d4]" title={warn.reason}>{warn.reason}</TableCell>
                      <TableCell className="text-zinc-500 text-xs font-mono-custom whitespace-nowrap">
                        [{format(new Date(warn.createdAt), "MMM d, yy HH:mm")}]
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 rounded-none"
                          onClick={() => setPendingDeleteId(warn.id)}
                          data-testid={`button-delete-warn-${warn.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : search ? (
            <div className="text-center py-12 text-primary font-mono-custom">
              <Search className="h-10 w-10 mx-auto text-primary/30 mb-3" />
              <p>No warnings match "{search}"</p>
            </div>
          ) : (
            <div className="text-center py-12 text-primary font-mono-custom">
              <ShieldAlert className="h-12 w-12 mx-auto text-primary/30 mb-3" />
              <p>No warnings have been issued yet.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={pendingDeleteId !== null} onOpenChange={(open) => { if (!open) setPendingDeleteId(null); }}>
        <AlertDialogContent className="bg-[#050505] border border-destructive rounded-none shadow-[0_0_15px_rgba(255,0,0,0.3)] mx-4 sm:mx-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-destructive">PURGE_WARNING_DATA</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400 font-mono-custom text-xs">
              Are you sure you want to remove the warning for{" "}
              <span className="font-bold text-foreground">@{pendingWarn?.username}</span>?
              {pendingWarn && (
                <span className="block mt-2 p-2 border border-destructive/30 bg-destructive/5 text-destructive font-mono-custom">"{pendingWarn.reason}"</span>
              )}
              <br/>
              <span className="text-destructive/80 mt-2 block">[!] This action cannot be undone.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="border-border rounded-none font-mono-custom hover:bg-zinc-800 w-full sm:w-auto">CANCEL</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-none font-mono-custom font-bold w-full sm:w-auto"
              onClick={() => pendingDeleteId !== null && deleteMutation.mutate({ id: pendingDeleteId })}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              CONFIRM_PURGE
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
