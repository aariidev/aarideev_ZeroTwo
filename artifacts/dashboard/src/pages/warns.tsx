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
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldAlert className="h-8 w-8 text-primary" />
            Warnings
          </h1>
          <p className="text-muted-foreground mt-1">Review and manage user infractions across all servers.</p>
        </div>
        {!isLoading && warns && warns.length > 0 && (
          <div className="text-right">
            <div className="text-2xl font-bold text-foreground">{warns.length}</div>
            <div className="text-xs text-muted-foreground">total warnings</div>
          </div>
        )}
      </div>

      <Card className="border-card-border bg-card">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-primary" />
              Recent Warnings
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filter by user, mod, reason..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9 bg-sidebar border-border text-sm"
                data-testid="input-filter-warns"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filtered.length > 0 ? (
            <div className="rounded-md border border-border overflow-hidden">
              <Table>
                <TableHeader className="bg-sidebar">
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead>User</TableHead>
                    <TableHead>Moderator</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((warn) => (
                    <TableRow key={warn.id} className="border-border hover:bg-sidebar/50">
                      <TableCell className="font-medium">{warn.username}</TableCell>
                      <TableCell className="text-muted-foreground">{warn.moderatorName}</TableCell>
                      <TableCell className="max-w-[280px] truncate text-sm" title={warn.reason}>{warn.reason}</TableCell>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                        {format(new Date(warn.createdAt), "MMM d, yyyy HH:mm")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8"
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
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
              <p>No warnings match "{search}"</p>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <ShieldAlert className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
              <p>No warnings have been issued yet.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={pendingDeleteId !== null} onOpenChange={(open) => { if (!open) setPendingDeleteId(null); }}>
        <AlertDialogContent className="bg-card border-card-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Warning</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Are you sure you want to remove the warning for{" "}
              <span className="font-semibold text-foreground">{pendingWarn?.username}</span>?
              {pendingWarn && (
                <span className="block mt-1 text-xs italic">"{pendingWarn.reason}"</span>
              )}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => pendingDeleteId !== null && deleteMutation.mutate({ id: pendingDeleteId })}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
