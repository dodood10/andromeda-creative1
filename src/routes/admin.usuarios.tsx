import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Search, Shield, ShieldOff, Ban, UserCheck } from "lucide-react";
import { toast } from "sonner";
import {
  getAdminUserDetail,
  listAdminUsers,
  setPlatformAdmin,
  setUserSuspended,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/usuarios")({
  head: () => ({ meta: [{ title: "Admin · Usuários" }] }),
  component: AdminUsuarios,
});

function AdminUsuarios() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const fetchUsers = useServerFn(listAdminUsers);
  const fetchDetail = useServerFn(getAdminUserDetail);
  const runSetAdmin = useServerFn(setPlatformAdmin);
  const runSuspend = useServerFn(setUserSuspended);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", page, query],
    queryFn: () => fetchUsers({ data: { page, pageSize: 25, search: query || undefined } }),
  });

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ["admin-user-detail", selectedId],
    queryFn: () => fetchDetail({ data: { userId: selectedId! } }),
    enabled: !!selectedId,
  });

  const adminMutation = useMutation({
    mutationFn: (payload: { userId: string; isPlatformAdmin: boolean }) =>
      runSetAdmin({ data: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-user-detail"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const suspendMutation = useMutation({
    mutationFn: (payload: { userId: string; suspended: boolean }) =>
      runSuspend({ data: payload }),
    onSuccess: (_, vars) => {
      toast.success(vars.suspended ? "Usuário suspenso" : "Suspensão removida");
      queryClient.invalidateQueries({ queryKey: ["admin-user-detail"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  return (
    <div className="container mx-auto px-6 py-8 max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Usuários</h1>
        <p className="text-sm text-muted-foreground mt-1">Contas cadastradas na plataforma</p>
      </div>

      <form
        className="flex gap-2 max-w-md"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(search);
          setPage(1);
        }}
      >
        <Input
          placeholder="Buscar por e-mail ou nome..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button type="submit" variant="outline" size="icon">
          <Search className="size-4" />
        </Button>
      </form>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-8 animate-spin text-primary-glow" />
        </div>
      ) : (
        <>
          <div className="glass rounded-xl border border-border/40 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Gerações</TableHead>
                  <TableHead>Criativos</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.users.map((u) => (
                  <TableRow
                    key={u.id}
                    className="cursor-pointer hover:bg-muted/30"
                    onClick={() => setSelectedId(u.id)}
                  >
                    <TableCell className="font-mono text-xs max-w-[200px] truncate">
                      {u.email || "—"}
                      {u.isPlatformAdmin && (
                        <Badge className="ml-2 text-[10px]" variant="secondary">admin</Badge>
                      )}
                    </TableCell>
                    <TableCell>{u.displayName ?? "—"}</TableCell>
                    <TableCell>{u.geracoes}</TableCell>
                    <TableCell>{u.criativos}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(u.createdAt), "dd/MM/yy", { locale: ptBR })}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() =>
                          adminMutation.mutate({
                            userId: u.id,
                            isPlatformAdmin: !u.isPlatformAdmin,
                          })
                        }
                      >
                        {u.isPlatformAdmin ? (
                          <ShieldOff className="size-4 text-muted-foreground" />
                        ) : (
                          <Shield className="size-4 text-primary-glow" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{data?.total ?? 0} usuários</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!data || page * data.pageSize >= data.total}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        </>
      )}

      <Sheet open={!!selectedId} onOpenChange={(open) => !open && setSelectedId(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Detalhe do usuário</SheetTitle>
          </SheetHeader>
          {detailLoading || !detail ? (
            <div className="flex justify-center py-12">
              <Loader2 className="size-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4 mt-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">E-mail</p>
                <p className="font-mono">{detail.email}</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline">{detail.geracoes} gerações</Badge>
                <Badge variant="outline">{detail.criativos} criativos</Badge>
                {detail.banned && <Badge variant="destructive">Suspenso</Badge>}
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-2">Workspaces</p>
                {detail.organizations.map((o) => (
                  <div key={o.id} className="flex justify-between py-1 border-b border-border/30">
                    <span>{o.name}</span>
                    <Badge variant="secondary" className="text-[10px]">{o.role}</Badge>
                  </div>
                ))}
              </div>
              {detail.latestCriativo && (
                <div>
                  <p className="text-muted-foreground text-xs">Último criativo</p>
                  <p className="font-medium">{detail.latestCriativo.angulo}</p>
                  <Badge variant="outline" className="mt-1">{detail.latestCriativo.status}</Badge>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    suspendMutation.mutate({
                      userId: detail.id,
                      suspended: !detail.banned,
                    })
                  }
                >
                  {detail.banned ? (
                    <><UserCheck className="size-4 mr-1" /> Reativar</>
                  ) : (
                    <><Ban className="size-4 mr-1" /> Suspender</>
                  )}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
