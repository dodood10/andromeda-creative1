import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Search, Eye, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  adminReprocessExport,
  getAdminCriativoDetail,
  listAdminCriativos,
} from "@/lib/admin.functions";

const searchSchema = z.object({
  organizationId: z.string().uuid().optional(),
});

export const Route = createFileRoute("/admin/criativos")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Admin · Criativos" }] }),
  component: AdminCriativos,
});

function AdminCriativos() {
  const { organizationId: orgFilter } = Route.useSearch();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [exportStatus, setExportStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const fetchCriativos = useServerFn(listAdminCriativos);
  const fetchDetail = useServerFn(getAdminCriativoDetail);
  const runReprocess = useServerFn(adminReprocessExport);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-criativos", page, query, status, exportStatus, orgFilter],
    queryFn: () =>
      fetchCriativos({
        data: {
          page,
          pageSize: 30,
          search: query || undefined,
          status: status === "all" ? undefined : status,
          exportStatus: exportStatus === "all" ? undefined : exportStatus,
          organizationId: orgFilter,
        },
      }),
  });

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ["admin-criativo-detail", selectedId],
    queryFn: () => fetchDetail({ data: { criativoId: selectedId! } }),
    enabled: !!selectedId,
  });

  const reprocessMutation = useMutation({
    mutationFn: (criativoId: string) => runReprocess({ data: { criativoId } }),
    onSuccess: () => {
      toast.success("Reprocessamento iniciado — aguarde alguns minutos");
      queryClient.invalidateQueries({ queryKey: ["admin-criativos"] });
      queryClient.invalidateQueries({ queryKey: ["admin-criativo-detail"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const previewUrl = detail
    ? Object.values(detail.signedUrls)[0]
    : null;

  return (
    <div className="container mx-auto px-6 py-8 max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Criativos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Todos os criativos da plataforma
          {orgFilter && <span className="text-primary-glow"> · filtro por org</span>}
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <form
          className="flex gap-2 flex-1 min-w-[200px] max-w-md"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(search);
            setPage(1);
          }}
        >
          <Input placeholder="Ângulo, produto, UTM..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <Button type="submit" variant="outline" size="icon">
            <Search className="size-4" />
          </Button>
        </form>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="Gerado">Gerado</SelectItem>
            <SelectItem value="Subiu">Subiu</SelectItem>
            <SelectItem value="Rodando">Rodando</SelectItem>
            <SelectItem value="Performando">Performando</SelectItem>
            <SelectItem value="Pausado">Pausado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={exportStatus} onValueChange={(v) => { setExportStatus(v); setPage(1); }}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos exports</SelectItem>
            <SelectItem value="rascunho">Rascunho</SelectItem>
            <SelectItem value="renderizando">Renderizando</SelectItem>
            <SelectItem value="pronto">Pronto</SelectItem>
            <SelectItem value="erro">Erro</SelectItem>
          </SelectContent>
        </Select>
      </div>

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
                  <TableHead>Ângulo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Export</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Criado</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.criativos.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="max-w-[200px] truncate text-sm">{c.angulo}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{c.status}</Badge></TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{c.exportStatus ?? "—"}</Badge></TableCell>
                    <TableCell className="text-sm">{c.scoreTotal ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(c.createdAt), "dd/MM/yy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => setSelectedId(c.id)}>
                        <Eye className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{data?.total ?? 0} criativos</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
              <Button variant="outline" size="sm" disabled={!data || page * data.pageSize >= data.total} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
            </div>
          </div>
        </>
      )}

      <Dialog open={!!selectedId} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhe do criativo</DialogTitle>
          </DialogHeader>
          {detailLoading || !detail ? (
            <Loader2 className="size-6 animate-spin mx-auto my-8" />
          ) : (
            <div className="space-y-4 text-sm">
              <p className="font-medium">{detail.criativo.angulo}</p>
              <div className="flex gap-2 flex-wrap">
                <Badge>{String(detail.criativo.status)}</Badge>
                <Badge variant="outline">{String(detail.criativo.export_status)}</Badge>
              </div>
              {previewUrl && (
                <video src={previewUrl} controls className="w-full rounded-lg max-h-48" />
              )}
              <div>
                <p className="text-xs text-muted-foreground mb-1">Score JSON</p>
                <pre className="text-[10px] bg-muted/30 p-2 rounded overflow-auto max-h-32">
                  {JSON.stringify(detail.scoreJson, null, 2)}
                </pre>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Roteiro</p>
                <pre className="text-[10px] bg-muted/30 p-2 rounded overflow-auto max-h-40">
                  {JSON.stringify(detail.roteiro, null, 2)}
                </pre>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={reprocessMutation.isPending}
                onClick={() => selectedId && reprocessMutation.mutate(selectedId)}
              >
                <RefreshCw className="size-4 mr-1" /> Reprocessar export
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
