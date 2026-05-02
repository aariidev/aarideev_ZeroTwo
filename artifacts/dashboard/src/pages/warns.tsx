import { useListWarns, useDeleteWarn, getListWarnsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trash2, AlertTriangle, ShieldAlert } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export default function Warns() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: warns, isLoading } = useListWarns(undefined, {
    query: {
      queryKey: getListWarnsQueryKey(),
      refetchInterval: 30000,
    }
  });

  const deleteMutation = useDeleteWarn({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListWarnsQueryKey() });
        toast({
          title: "Warning removed",
          description: "The warning has been successfully deleted.",
        });
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to delete the warning.",
          variant: "destructive",
        });
      }
    }
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <ShieldAlert className="h-8 w-8 text-primary" />
          Warnings
        </h1>
        <p className="text-muted-foreground mt-1">Review and manage user infractions across all servers.</p>
      </div>

      <Card className="border-card-border bg-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-primary" />
            Recent Warnings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {Array(5).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : warns && warns.length > 0 ? (
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
                  {warns.map((warn) => (
                    <TableRow key={warn.id} className="border-border hover:bg-sidebar/50">
                      <TableCell className="font-medium">{warn.username}</TableCell>
                      <TableCell className="text-muted-foreground">{warn.moderatorName}</TableCell>
                      <TableCell className="max-w-[300px] truncate" title={warn.reason}>{warn.reason}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(warn.createdAt), "MMM d, yyyy HH:mm")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                          onClick={() => deleteMutation.mutate({ id: warn.id })}
                          disabled={deleteMutation.isPending}
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
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <ShieldAlert className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
              <p>No warnings have been issued yet.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
