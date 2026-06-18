import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { z } from "zod";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, Download, TrendingUp, Play, Loader2, BarChart3, LayoutGrid, List, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  listCriativos,
  updateCriativoStatus,
  reportarResultado,
  exportZipCriativos,
  listResultados,
  importMetricasCsv,
  type CriativoRow,
} from "@/lib/criativos.functions";
import { getSignedExportUrls } from "@/lib/export.functions";
import { useWorkspace } from "@/contexts/workspace-context";
import type { Enums } from "@/integrations/supabase/types";
import { trackMetaMarcarSubiu, trackMetaPerformando } from "@/lib/meta-pixel";
import { AppBreadcrumbs } from "@/components/app-breadcrumbs";
import { MetaUploadGuide } from "@/components/meta-upload-guide";
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

const searchSchema = z.object({
  status: z.enum(["Gerado", "Subiu", "Rodando", "Performando", "Pausado"]).optional(),
  criativoId: z.string().uuid().optional(),
  export: z.enum(["pendente", "pronto"]).optional(),
});

export const Route = createFileRoute("/app/historico")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Meus criativos · Andromeda" },
      { name: "description", content: "Todos os criativos com status, resultados e exportação em lote." },
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

const PIPELINE: CriativoStatus[] = ["Gerado", "Subiu", "Rodando", "Performando"];

const ALL_STATUSES: CriativoStatus[] = ["Gerado", "Subiu", "Rodando", "Performando", "Pausado"];

type ResultadoTipo = "venda" | "lead" | "clique";

type ResultadoRow = {
  id: string;
  criativo_id: string;
  tipo: ResultadoTipo;
  metrica: string | null;
  valor: string | null;
  observacao: string | null;
  created_at: string;
  criativos: { id: string; angulo: string; produto: string; project_id?: string } | null;
};

function Historico() {
  const { status: urlStatus, criativoId: urlCriativoId, export: urlExport } = Route.useSearch();
  const { projectId, loading: wsLoading } = useWorkspace();
  const fetchCriativos = useServerFn(listCriativos);
  const fetchResultados = useServerFn(listResultados);
  const patchStatus = useServerFn(updateCriativoStatus);
  const submitResultado = useServerFn(reportarResultado);
  const runZip = useServerFn(exportZipCriativos);
  const runImportCsv = useServerFn(importMetricasCsv);
  const signExports = useServerFn(getSignedExportUrls);
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [produtoFilter, setProdutoFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState(urlStatus ?? "all");
  const [exportFilter, setExportFilter] = useState(urlExport ?? "all");
  const [reportModal, setReportModal] = useState<{ id: string; angulo: string } | null>(null);
  const [viewResultados, setViewResultados] = useState<{ id: string; angulo: string } | null>(null);
  const [resultadoTipo, setResultadoTipo] = useState<ResultadoTipo>("venda");
  const [metrica, setMetrica] = useState("");
  const [valor, setValor] = useState("");
  const [observacao, setObservacao] = useState("");
  const [zipLoading, setZipLoading] = useState(false);
  const [preview, setPreview] = useState<{ angulo: string; url: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "kanban">("kanban");
  const [csvOpen, setCsvOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [csvLoading, setCsvLoading] = useState(false);
  const [statusConfirm, setStatusConfirm] = useState<{
    id: string;
    angulo: string;
    status: CriativoStatus;
    from: CriativoStatus;
  } | null>(null);

  useEffect(() => {
    if (urlStatus) setStatusFilter(urlStatus);
  }, [urlStatus]);

  useEffect(() => {
    if (urlExport) setExportFilter(urlExport);
  }, [urlExport]);

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["criativos", projectId],
    queryFn: () => fetchCriativos({ data: { projectId: projectId! } }),
    enabled: !!projectId,
  });

  const { data: resultados = [] } = useQuery({
    queryKey: ["resultados", projectId],
    queryFn: () => fetchResultados({ data: { projectId: projectId! } }),
    enabled: !!projectId,
  });

  const resultadosByCriativo = useMemo(() => {
    const map = new Map<string, ResultadoRow[]>();
    for (const r of resultados as ResultadoRow[]) {
      const list = map.get(r.criativo_id) ?? [];
      list.push(r);
      map.set(r.criativo_id, list);
    }
    return map;
  }, [resultados]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (produtoFilter !== "all" && r.produto !== produtoFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (exportFilter === "pendente" && r.export_status === "pronto") return false;
      if (exportFilter === "pendente" && r.status === "Pausado") return false;
      if (exportFilter === "pronto" && r.export_status !== "pronto") return false;
      if (search && !r.observacoes?.toLowerCase().includes(search.toLowerCase()) &&
          !r.angulo.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [rows, produtoFilter, statusFilter, exportFilter, search]);

  const exportaveis = filtered.filter((r) => r.export_status === "pronto");
  const pendentesExport = filtered.filter((r) => r.export_status !== "pronto" && r.status !== "Pausado");

  async function handlePreview(row: CriativoRow) {
    const paths = (row.export_paths as string[]) ?? [];
    if (paths.length === 0) {
      toast.error("Exporte o criativo no editor antes de visualizar");
      return;
    }
    setPreviewLoading(row.id);
    try {
      const { urls } = await signExports({ data: { paths: [paths[0]] } });
      const url = urls[paths[0]];
      if (!url) {
        toast.error("Preview não disponível");
        return;
      }
      setPreview({ angulo: row.angulo, url });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar preview");
    } finally {
      setPreviewLoading(null);
    }
  }

  async function handleExportZip() {
    if (exportaveis.length === 0) {
      toast.error("Nenhum criativo exportado na lista filtrada");
      return;
    }
    setZipLoading(true);
    try {
      const ids = exportaveis.map((r) => r.id);
      const { zipBase64, filename, included, skipped } = await runZip({ data: { criativoIds: ids } });
      const link = document.createElement("a");
      link.href = `data:application/zip;base64,${zipBase64}`;
      link.download = filename;
      link.click();
      toast.success(
        skipped > 0
          ? `ZIP com ${included} criativo(s) — ${skipped} ignorado(s) sem export`
          : "ZIP exportado",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao exportar ZIP");
    } finally {
      setZipLoading(false);
    }
  }

  const statusMutation = useMutation({
    mutationFn: (payload: { id: string; status: CriativoStatus; angulo: string }) =>
      patchStatus({ data: { id: payload.id, status: payload.status } }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["criativos"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      if (vars.status === "Performando") {
        trackMetaPerformando();
        setReportModal({ id: vars.id, angulo: vars.angulo });
      } else if (vars.status === "Subiu") {
        trackMetaMarcarSubiu();
        toast.success("Status atualizado");
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
      queryClient.invalidateQueries({ queryKey: ["resultados"] });
      toast.success("Métrica enviada — será considerada na inteligência após validação da equipe");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao reportar"),
  });

  async function handleDownload(paths: string[], path?: string) {
    try {
      const target = path ? [path] : paths;
      const { urls } = await signExports({ data: { paths: target } });
      const first = target[0];
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

  const highlightedId = urlCriativoId;

  function requestStatusChange(row: CriativoRow, status: CriativoStatus) {
    if (status === row.status) return;
    const needsConfirm =
      status === "Performando" || row.status === "Performando" || status === "Pausado";
    if (needsConfirm) {
      setStatusConfirm({ id: row.id, angulo: row.angulo, status, from: row.status });
      return;
    }
    statusMutation.mutate({ id: row.id, status, angulo: row.angulo });
  }

  async function handleImportCsv() {
    if (!projectId || !csvText.trim()) {
      toast.error("Cole o conteúdo do CSV exportado do Ads Manager");
      return;
    }
    setCsvLoading(true);
    try {
      const { imported, total, autoApproved, performandoAuto } = await runImportCsv({
        data: { projectId, csvText: csvText.trim() },
      });
      let msg = `${imported} de ${total} linhas importadas`;
      if (autoApproved > 0) msg += ` · ${autoApproved} métrica(s) validadas automaticamente`;
      if (performandoAuto > 0) msg += ` · ${performandoAuto} campeão(ões) detectado(s)`;
      toast.success(msg);
      setCsvOpen(false);
      setCsvText("");
      queryClient.invalidateQueries({ queryKey: ["resultados", projectId] });
      queryClient.invalidateQueries({ queryKey: ["inteligencia", projectId] });
      queryClient.invalidateQueries({ queryKey: ["criativos"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao importar CSV");
    } finally {
      setCsvLoading(false);
    }
  }

  return (
    <div className="container mx-auto px-4 md:px-6 py-8 max-w-7xl space-y-6">
      <AppBreadcrumbs items={[{ label: "Projeto", to: "/app" }, { label: "Meus criativos" }]} />
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold">Meus criativos</h1>
          <p className="text-muted-foreground mt-1">
            {filtered.length} criativos · pipeline Gerado → Subiu → Rodando → Performando
          </p>
          {urlExport === "pendente" && (
            <Badge variant="outline" className="mt-2 border-warning/40 text-warning">
              Filtro: sem export ({pendentesExport.length})
            </Badge>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap gap-2 justify-end">
            <MetaUploadGuide />
            <Button variant="outline" size="sm" onClick={() => setCsvOpen(true)}>
              <Upload className="size-4 mr-1.5" /> Importar CSV Meta
            </Button>
          </div>
          <Link to="/app/gerador">
            <Button size="sm" className="bg-gradient-primary border-0">
              Gerar novos ângulos
            </Button>
          </Link>
          <Button
            variant="outline"
            disabled={exportaveis.length === 0 || zipLoading}
            onClick={handleExportZip}
          >
            {zipLoading ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Download className="size-4 mr-1.5" />}
            ZIP ({exportaveis.length} exportados)
          </Button>
          {filtered.length > exportaveis.length && exportaveis.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {filtered.length - exportaveis.length} ignorado(s) sem export
            </span>
          )}
          {exportaveis.length === 0 && filtered.length > 0 && (
            <span className="text-xs text-warning">Nenhum exportado na lista — exporte no editor primeiro</span>
          )}
        </div>
      </div>

      <Card className="glass p-4">
        <div className="flex flex-wrap gap-2 items-center">
          {PIPELINE.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`text-xs px-3 py-1.5 rounded-full border transition ${
                  statusFilter === s ? statusStyle[s] : "border-border/50 text-muted-foreground hover:border-primary/40"
                }`}
              >
                {s} ({rows.filter((r) => r.status === s).length})
              </button>
              {i < PIPELINE.length - 1 && <span className="text-muted-foreground">→</span>}
            </div>
          ))}
        </div>
      </Card>

      <Card className="glass p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <p className="text-sm text-muted-foreground">Filtros</p>
          <div className="hidden md:flex gap-1">
            <Button
              size="sm"
              variant={viewMode === "table" ? "secondary" : "ghost"}
              className="min-h-11"
              onClick={() => setViewMode("table")}
            >
              <List className="size-4 mr-1" /> Tabela
            </Button>
            <Button
              size="sm"
              variant={viewMode === "kanban" ? "secondary" : "ghost"}
              className="min-h-11"
              onClick={() => setViewMode("kanban")}
            >
              <LayoutGrid className="size-4 mr-1" /> Kanban
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por ângulo ou observações..."
              className="pl-9 min-h-11"
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
          <Select value={exportFilter} onValueChange={setExportFilter}>
            <SelectTrigger><SelectValue placeholder="Export" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os exports</SelectItem>
              <SelectItem value="pendente">Sem export</SelectItem>
              <SelectItem value="pronto">Exportados</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Preview · {preview?.angulo}</DialogTitle>
          </DialogHeader>
          {preview?.url && (
            <video src={preview.url} controls className="w-full rounded-lg aspect-[9/16] bg-black" />
          )}
        </DialogContent>
      </Dialog>

      <ResultadoDialog
        open={!!reportModal}
        title={`Reportar resultado · ${reportModal?.angulo ?? ""}`}
        escalarCriativoId={reportModal?.id}
        resultadoTipo={resultadoTipo}
        setResultadoTipo={setResultadoTipo}
        metrica={metrica}
        setMetrica={setMetrica}
        valor={valor}
        setValor={setValor}
        observacao={observacao}
        setObservacao={setObservacao}
        onClose={() => setReportModal(null)}
        onSubmit={() => reportMutation.mutate()}
        pending={reportMutation.isPending}
      />

      <Dialog open={!!viewResultados} onOpenChange={(open) => !open && setViewResultados(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resultados · {viewResultados?.angulo}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 max-h-80 overflow-auto">
            {(resultadosByCriativo.get(viewResultados?.id ?? "") ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum resultado reportado ainda.</p>
            ) : (
              (resultadosByCriativo.get(viewResultados?.id ?? "") ?? []).map((r) => (
                <div key={r.id} className="p-3 rounded-lg border border-border/50 text-sm">
                  <div className="flex justify-between">
                    <Badge variant="outline">{r.tipo}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(r.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  {(r.metrica || r.valor) && (
                    <p className="mt-2 font-medium">
                      {r.metrica}{r.metrica && r.valor ? ": " : ""}{r.valor}
                    </p>
                  )}
                  {r.observacao && <p className="text-muted-foreground mt-1">{r.observacao}</p>}
                </div>
              ))
            )}
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              if (viewResultados) {
                setReportModal({ id: viewResultados.id, angulo: viewResultados.angulo });
                setViewResultados(null);
              }
            }}
          >
            Adicionar novo resultado
          </Button>
          {viewResultados?.id && (
            <Link
              to="/app/escala"
              search={{ criativoId: viewResultados.id }}
              className="block"
              onClick={() => setViewResultados(null)}
            >
              <Button className="w-full bg-gradient-primary border-0">
                <TrendingUp className="size-4 mr-1.5" /> Escalar
              </Button>
            </Link>
          )}
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
          <>
            <div className="md:hidden p-4 space-y-3">
              {filtered.map((r) => (
                <CriativoCard
                  key={r.id}
                  row={r}
                  highlighted={r.id === highlightedId}
                  resultadosCount={(resultadosByCriativo.get(r.id) ?? []).length}
                  onStatusChange={(status) => requestStatusChange(r, status)}
                  onDownload={handleDownload}
                  onViewResultados={() => setViewResultados({ id: r.id, angulo: r.angulo })}
                  onPreview={() => handlePreview(r)}
                  previewLoading={previewLoading === r.id}
                />
              ))}
            </div>

            {viewMode === "kanban" ? (
              <div className="hidden md:grid grid-cols-4 gap-3 p-4">
                {PIPELINE.map((colStatus) => (
                  <div key={colStatus} className="space-y-2">
                    <p className={`text-xs font-semibold px-2 py-1 rounded-full border w-fit ${statusStyle[colStatus]}`}>
                      {colStatus}
                    </p>
                    {filtered
                      .filter((r) => r.status === colStatus)
                      .map((r) => (
                        <CriativoCard
                          key={r.id}
                          row={r}
                          compact
                          highlighted={r.id === highlightedId}
                          resultadosCount={(resultadosByCriativo.get(r.id) ?? []).length}
                          onStatusChange={(status) => requestStatusChange(r, status)}
                          onDownload={handleDownload}
                          onViewResultados={() => setViewResultados({ id: r.id, angulo: r.angulo })}
                          onPreview={() => handlePreview(r)}
                          previewLoading={previewLoading === r.id}
                        />
                      ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-border/50">
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Ângulo</TableHead>
                      <TableHead>Formato</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Resultados</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r) => (
                      <CriativoRowItem
                        key={r.id}
                        row={r}
                        highlighted={r.id === highlightedId}
                        resultadosCount={(resultadosByCriativo.get(r.id) ?? []).length}
                        onStatusChange={(status) => requestStatusChange(r, status)}
                        onDownload={handleDownload}
                        onViewResultados={() => setViewResultados({ id: r.id, angulo: r.angulo })}
                        onPreview={() => handlePreview(r)}
                        previewLoading={previewLoading === r.id}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}
      </Card>

      <AlertDialog open={!!statusConfirm} onOpenChange={(open) => !open && setStatusConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar mudança de status</AlertDialogTitle>
            <AlertDialogDescription>
              {statusConfirm?.status === "Performando"
                ? `Marcar "${statusConfirm.angulo}" como Performando? Reporte métricas no próximo passo para alimentar inteligência e escala.`
                : `Alterar "${statusConfirm?.angulo}" de ${statusConfirm?.from} para ${statusConfirm?.status}?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!statusConfirm) return;
                statusMutation.mutate({
                  id: statusConfirm.id,
                  status: statusConfirm.status,
                  angulo: statusConfirm.angulo,
                });
                setStatusConfirm(null);
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={csvOpen} onOpenChange={setCsvOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Importar métricas do Ads Manager</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Exporte um relatório CSV do Meta Ads com colunas de anúncio, utm_content, gasto, CPA, ROAS e hook rate.
            O Andromeda associa por utm_content ou nome do ângulo. Métricas fortes podem marcar criativos como Performando automaticamente.
          </p>
          <Textarea
            rows={8}
            placeholder="Cole o CSV aqui..."
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            className="font-mono text-xs"
          />
          <Button onClick={() => void handleImportCsv()} disabled={csvLoading} className="w-full">
            {csvLoading ? <Loader2 className="size-4 animate-spin" /> : "Importar"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ResultadoDialog({
  open,
  title,
  escalarCriativoId,
  resultadoTipo,
  setResultadoTipo,
  metrica,
  setMetrica,
  valor,
  setValor,
  observacao,
  setObservacao,
  onClose,
  onSubmit,
  pending,
}: {
  open: boolean;
  title: string;
  escalarCriativoId?: string;
  resultadoTipo: ResultadoTipo;
  setResultadoTipo: (v: ResultadoTipo) => void;
  metrica: string;
  setMetrica: (v: string) => void;
  valor: string;
  setValor: (v: string) => void;
  observacao: string;
  setObservacao: (v: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  pending: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
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
          <Button className="w-full bg-gradient-primary border-0" onClick={onSubmit} disabled={pending}>
            Salvar resultado
          </Button>
          {escalarCriativoId && (
            <Link
              to="/app/escala"
              search={{ criativoId: escalarCriativoId }}
              className="block"
              onClick={onClose}
            >
              <Button variant="outline" className="w-full">
                <TrendingUp className="size-4 mr-1.5" /> Escalar agora
              </Button>
            </Link>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CriativoCard({
  row,
  compact,
  highlighted,
  resultadosCount,
  onStatusChange,
  onDownload,
  onViewResultados,
  onPreview,
  previewLoading,
}: {
  row: CriativoRow;
  compact?: boolean;
  highlighted?: boolean;
  resultadosCount: number;
  onStatusChange: (status: CriativoStatus) => void;
  onDownload: (paths: string[], path?: string) => void;
  onViewResultados: () => void;
  onPreview: () => void;
  previewLoading?: boolean;
}) {
  const dataFmt = format(new Date(row.created_at), "dd/MM", { locale: ptBR });
  const paths = (row.export_paths as string[]) ?? [];

  return (
    <Card
      className={`p-4 space-y-3 ${highlighted ? "ring-2 ring-primary/40 bg-primary/5" : ""} ${compact ? "text-sm" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium truncate">{row.angulo}</p>
          <p className="text-xs text-muted-foreground truncate">
            {row.produto} · {row.formato} · {dataFmt}
          </p>
        </div>
        <button
          type="button"
          onClick={onPreview}
          disabled={previewLoading}
          className="size-11 shrink-0 rounded-lg bg-gradient-to-br from-primary/40 to-accent/30 flex items-center justify-center"
        >
          {previewLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Play className="size-4 fill-current" />
          )}
        </button>
      </div>
      <Select value={row.status} onValueChange={(v) => onStatusChange(v as CriativoStatus)}>
        <SelectTrigger className="min-h-11 w-full">
          <Badge variant="outline" className={statusStyle[row.status]}>{row.status}</Badge>
        </SelectTrigger>
        <SelectContent>
          {ALL_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {row.status === "Performando" && row.performando_intel_status === "pending" && (
        <p className="text-[10px] text-warning">Validação em até 24h</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="ghost" className="min-h-11" onClick={onViewResultados}>
          <BarChart3 className="size-3.5 mr-1" />
          {resultadosCount > 0 ? resultadosCount : "Resultados"}
        </Button>
        {paths.length > 0 && (
          <Button size="sm" variant="outline" className="min-h-11" onClick={() => onDownload(paths)}>
            <Download className="size-3.5" />
          </Button>
        )}
        <Link to="/app/editor" search={{ criativoId: row.id }}>
          <Button size="sm" variant="outline" className="min-h-11">Editor</Button>
        </Link>
        {row.export_status !== "pronto" && (
          <Link to="/app/editor" search={{ criativoId: row.id, focus: "score" }}>
            <Button size="sm" className="min-h-11 bg-gradient-primary border-0">Exportar</Button>
          </Link>
        )}
        {row.status === "Performando" && (
          <Link to="/app/escala" search={{ criativoId: row.id }}>
            <Button size="sm" variant="outline" className="min-h-11">
              <TrendingUp className="size-3.5 mr-1" /> Escalar
            </Button>
          </Link>
        )}
      </div>
    </Card>
  );
}

function CriativoRowItem({
  row,
  highlighted,
  resultadosCount,
  onStatusChange,
  onDownload,
  onViewResultados,
  onPreview,
  previewLoading,
}: {
  row: CriativoRow;
  highlighted?: boolean;
  resultadosCount: number;
  onStatusChange: (status: CriativoStatus) => void;
  onDownload: (paths: string[], path?: string) => void;
  onViewResultados: () => void;
  onPreview: () => void;
  previewLoading?: boolean;
}) {
  const dataFmt = format(new Date(row.created_at), "dd/MM", { locale: ptBR });
  const paths = (row.export_paths as string[]) ?? [];

  return (
    <TableRow className={`border-border/30 ${highlighted ? "bg-primary/10" : ""}`}>
      <TableCell>
        <button
          type="button"
          onClick={onPreview}
          disabled={previewLoading}
          className="size-9 rounded bg-gradient-to-br from-primary/40 to-accent/30 flex items-center justify-center hover:ring-2 ring-primary/40 transition"
        >
          {previewLoading ? (
            <Loader2 className="size-3 animate-spin text-primary-foreground" />
          ) : (
            <Play className="size-3 text-primary-foreground fill-current" />
          )}
        </button>
      </TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">{dataFmt}</TableCell>
      <TableCell className="font-medium">{row.produto}</TableCell>
      <TableCell>{row.angulo}</TableCell>
      <TableCell className="text-muted-foreground">{row.formato}</TableCell>
      <TableCell>
        <Select value={row.status} onValueChange={(v) => onStatusChange(v as CriativoStatus)}>
          <SelectTrigger className="h-8 w-[130px] border-0 bg-transparent p-0 shadow-none">
            <div className="flex flex-col gap-1 items-start">
              <Badge variant="outline" className={statusStyle[row.status]}>{row.status}</Badge>
              {row.status === "Performando" && row.performando_intel_status === "pending" && (
                <Badge variant="outline" className="text-[10px] border-warning/40 text-warning">
                  aguardando validação
                </Badge>
              )}
              {row.status === "Performando" && row.performando_intel_status === "rejected" && (
                <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive">
                  não validado
                </Badge>
              )}
            </div>
          </SelectTrigger>
          <SelectContent>
            {ALL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Button size="sm" variant="ghost" onClick={onViewResultados} className="h-8 px-2">
          <BarChart3 className="size-3.5 mr-1" />
          {resultadosCount > 0 ? `${resultadosCount}` : "—"}
        </Button>
      </TableCell>
      <TableCell className="text-right space-x-2">
        {paths.length > 0 ? (
          paths.length === 1 ? (
            <Button size="sm" variant="outline" onClick={() => onDownload(paths)}>
              <Download className="size-3.5" />
            </Button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  <Download className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {paths.map((p) => (
                  <DropdownMenuItem key={p} onClick={() => onDownload(paths, p)}>
                    {p.includes("4x5") ? "Baixar 4:5" : "Baixar 9:16"}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        ) : null}
        <Link to="/app/editor" search={{ criativoId: row.id }}>
          <Button size="sm" variant="ghost">Editor</Button>
        </Link>
        {row.export_status !== "pronto" && row.status !== "Pausado" && (
          <Link to="/app/editor" search={{ criativoId: row.id, focus: "score" }}>
            <Button size="sm" variant="outline" className="border-warning/40 text-warning">
              Exportar
            </Button>
          </Link>
        )}
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
