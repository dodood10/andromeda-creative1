import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Download, TrendingUp, Play, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { listCriativos, updateCriativoStatus, reportarResultado, exportZipCriativos, type CriativoRow } from "@/lib/criativos.functions";
import { getSignedExportUrls } from "@/lib/export.functions";
import { useWorkspace } from "@/contexts/workspace-context";
import type { Enums } from "@/integrations/supabase/types";

export const Route = createFileRoute("/app/historico")({
  head: () => ({
    meta: [
      { title: "Histórico · Andromeda" },
      { name: "description", content: "Todos os criativos com status, observações e exportação em lote." },
    ],
  }),
  component: Historico,
});

type CriativoStatus = Enums<"criativo_status">;

const statusStyle: Record<string, string> = {
  Gerado: "bg-muted-foreground/20 text-muted-foreground border-muted-foreground/30",
  Subiu: "bg-primary/20 text-primary-glow border-primary/40",
  Rodando: "bg-accent/20 text-accent border-accent/40",
  Performando: "bg-success/20 text-success border-success/40",
  Pausado: "bg-destructive/20 text-destructive border-destructive/40",
};

const ALL_STATUSES: CriativoStatus[] = ["Gerado", "Subiu", "Rodando", "Performando", "Pausado"];

type ResultadoTipo = "venda" | "lead" | "clique";

function Historico() {
  const { projectId, loading: wsLoading } = useWorkspace();
  const fetchCriativos = useServerFn(listCriativos);
  const patchStatus = useServerFn(updateCriativoStatus);
  const submitResultado = useServerFn(reportarResultado);
  const runZip = useServerFn(exportZipCriativos);
  const signExports = useServerFn(getSignedExportUrls);
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [produtoFilter, setProdutoFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [reportModal, setReportModal] = useState<{ id: string; angulo: string } | null>(null);
  const [resultadoTipo, setResultadoTipo] = useState<ResultadoTipo>("venda");
  const [metrica, setMetrica] = useState("");
  const [valor, setValor] = useState("");
  const [observacao, setObservacao] = useState("");
  const [zipLoading, setZipLoading] = useState(false);

  async function handleExportZip() {
    if (filtered.length === 0) return;
    setZipLoading(true);
    try {
      const ids = filtered.map((r) => r.id);
      const { zipBase64, filename } = await runZip({ data: { criativoIds: ids } });
      const link = document.createElement("a");
      link.href = `data:application/zip;base64,${zipBase64}`;
      link.download = filename;
      link.click();
      toast.success("ZIP exportado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao exportar ZIP");
    } finally {
      setZipLoading(false);
    }
  }

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["criativos", projectId],
    queryFn: () => fetchCriativos({ data: { projectId: projectId! } }),
    enabled: !!projectId,
  });

  const statusMutation = useMutation({
    mutationFn: (payload: { id: string; status: CriativoStatus; angulo: string }) =>
      patchStatus({ data: { id: payload.id, status: payload.status } }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["criativos"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      if (vars.status === "Performando") {
        setReportModal({ id: vars.id, angulo: vars.angulo });
      } else {
        toast.success("Status atualizado");
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao atualizar"),
  });

  const reportMutation = useMutation({
    mutationFn: () => {
      if (!reportModal) throw new Error("Sem criativo");
      return submitResultado({
        data: {
          criativoId: reportModal.id,
          tipo: resultadoTipo,
          metrica: metrica || undefined,
          valor: valor || undefined,
          observacao: observacao || undefined,
        },
      });
    },
    onSuccess: () => {
      setReportModal(null);
      setMetrica("");
      setValor("");
      setObservacao("");
      toast.success("Resultado reportado");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao reportar"),
  });

  async function handleDownload(paths: string[]) {
    try {
      const { urls } = await signExports({ data: { paths } });
      const first = paths[0];
      if (first && urls[first]) window.open(urls[first], "_blank");
      else toast.error("Arquivo não disponível");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao baixar");
    }
  }

  const produtos = useMemo(
    () => [...new Set(rows.map((r) => r.produto))].sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (produtoFilter !== "all" && r.produto !== produtoFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (search && !r.observacoes?.toLowerCase().includes(search.toLowerCase()) &&
          !r.angulo.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [rows, produtoFilter, statusFilter, search]);

  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold">Histórico</h1>
          <p className="text-muted-foreground mt-1">
            {filtered.length} criativos · filtre, atualize status e exporte em lote.
          </p>
        </div>
        <Button variant="outline" disabled={filtered.length === 0 || zipLoading} onClick={handleExportZip}>
          {zipLoading ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Download className="size-4 mr-1.5" />}
          Exportar pacote ZIP
        </Button>
      </div>

      <Card className="glass p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por ângulo ou observações..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={produtoFilter} onValueChange={setProdutoFilter}>
            <SelectTrigger><SelectValue placeholder="Produto" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os produtos</SelectItem>
              {produtos.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {ALL_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Dialog open={!!reportModal} onOpenChange={(open) => !open && setReportModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reportar resultado · {reportModal?.angulo}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Tipo de resultado</Label>
              <Select value={resultadoTipo} onValueChange={(v) => setResultadoTipo(v as ResultadoTipo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="venda">Venda</SelectItem>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="clique">Clique</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Métrica (opcional)</Label>
                <Input placeholder="CPA, ROAS, hook rate..." value={metrica} onChange={(e) => setMetrica(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Valor (opcional)</Label>
                <Input placeholder="R$ 42, 3.2x..." value={valor} onChange={(e) => setValor(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Observação</Label>
              <Textarea rows={3} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
            </div>
            <Button
              className="w-full bg-gradient-primary border-0"
              onClick={() => reportMutation.mutate()}
              disabled={reportMutation.isPending}
            >
              Salvar resultado
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card className="glass overflow-hidden">
        {wsLoading || isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-8 animate-spin text-primary-glow" />
          </div>
        ) : error ? (
          <div className="p-8 text-center text-muted-foreground">
            {error instanceof Error ? error.message : "Erro ao carregar criativos"}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            Nenhum criativo ainda.{" "}
            <Link to="/app/gerador" className="text-primary-glow underline">Gere ângulos</Link> para começar.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/50">
                <TableHead className="w-12"></TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Ângulo</TableHead>
                <TableHead>Formato</TableHead>
                <TableHead>Estilo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <CriativoRowItem
                  key={r.id}
                  row={r}
                  onStatusChange={(status) =>
                    statusMutation.mutate({ id: r.id, status, angulo: r.angulo })
                  }
                  onDownload={handleDownload}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function CriativoRowItem({
  row,
  onStatusChange,
  onDownload,
}: {
  row: CriativoRow;
  onStatusChange: (status: CriativoStatus) => void;
  onDownload: (paths: string[]) => void;
}) {
  const dataFmt = format(new Date(row.created_at), "dd/MM", { locale: ptBR });

  return (
    <TableRow className="border-border/30">
      <TableCell>
        <div className="size-9 rounded bg-gradient-to-br from-primary/40 to-accent/30 flex items-center justify-center">
          <Play className="size-3 text-primary-foreground fill-current" />
        </div>
      </TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">{dataFmt}</TableCell>
      <TableCell className="font-medium">{row.produto}</TableCell>
      <TableCell>{row.angulo}</TableCell>
      <TableCell className="text-muted-foreground">{row.formato}</TableCell>
      <TableCell className="text-muted-foreground">{row.estilo}</TableCell>
      <TableCell>
        <Select value={row.status} onValueChange={(v) => onStatusChange(v as CriativoStatus)}>
          <SelectTrigger className="h-8 w-[130px] border-0 bg-transparent p-0 shadow-none">
            <Badge variant="outline" className={statusStyle[row.status]}>{row.status}</Badge>
          </SelectTrigger>
          <SelectContent>
            {ALL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="text-right space-x-2">
        {(row.export_paths as string[] | null)?.length ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onDownload((row.export_paths as string[]) ?? [])}
          >
            <Download className="size-3.5" />
          </Button>
        ) : null}
        <Link to="/app/editor" search={{ criativoId: row.id }}>
          <Button size="sm" variant="ghost">Editor</Button>
        </Link>
        {row.status === "Performando" && (
          <Link to="/app/escala" search={{ criativoId: row.id }}>
            <Button size="sm" className="bg-gradient-primary border-0">
              <TrendingUp className="size-3.5 mr-1" /> Escalar
            </Button>
          </Link>
        )}
      </TableCell>
    </TableRow>
  );
}
