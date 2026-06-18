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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Loader2, Search, Eye, CheckCircle2, XCircle, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import {
  getAdminAvaliacaoDetail,
  listAdminAvaliacaoCriativos,
  listAdminAvaliacaoQueue,
  reviewPerformandoClaim,
  reviewResultadoReport,
  submitAdminCriativoReview,
} from "@/lib/admin.functions";
import type { AvaliacaoQueueItem } from "@/lib/types/intel-review";

const searchSchema = z.object({
  organizationId: z.string().uuid().optional(),
});

export const Route = createFileRoute("/admin/avaliacao")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Admin · Avaliação" }] }),
  component: AdminAvaliacao,
});

const INTEL_BADGE: Record<string, string> = {
  pending: "border-warning/40 text-warning",
  approved: "border-success/40 text-success",
  rejected: "border-destructive/40 text-destructive",
};

function AdminAvaliacao() {
  const { organizationId: orgFilter } = Route.useSearch();
  const [tab, setTab] = useState("fila");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [intelStatus, setIntelStatus] = useState("all");
  const [exportStatus, setExportStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [adminVerdict, setAdminVerdict] = useState<"approved" | "rejected" | "flagged">("approved");
  const [qualityScore, setQualityScore] = useState("3");
  const [adminNotes, setAdminNotes] = useState("");
  const [includeIntel, setIncludeIntel] = useState(false);
  const [queuePriorityFilter, setQueuePriorityFilter] = useState<"all" | "alta">("alta");

  const queryClient = useQueryClient();
  const fetchQueue = useServerFn(listAdminAvaliacaoQueue);
  const fetchCatalog = useServerFn(listAdminAvaliacaoCriativos);
  const fetchDetail = useServerFn(getAdminAvaliacaoDetail);
  const runReviewPerformando = useServerFn(reviewPerformandoClaim);
  const runReviewResultado = useServerFn(reviewResultadoReport);
  const runSubmitReview = useServerFn(submitAdminCriativoReview);

  const { data: queue, isLoading: queueLoading } = useQuery({
    queryKey: ["admin-avaliacao-queue"],
    queryFn: () => fetchQueue(),
  });

  const { data: catalog, isLoading: catalogLoading } = useQuery({
    queryKey: ["admin-avaliacao-catalog", page, query, intelStatus, exportStatus, orgFilter],
    queryFn: () =>
      fetchCatalog({
        data: {
          page,
          pageSize: 30,
          search: query || undefined,
          intelStatus: intelStatus as "all" | "pending" | "approved" | "rejected" | "none",
          exportStatus: exportStatus === "all" ? undefined : exportStatus,
          organizationId: orgFilter,
        },
      }),
    enabled: tab === "catalogo",
  });

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ["admin-avaliacao-detail", selectedId],
    queryFn: () => fetchDetail({ data: { criativoId: selectedId! } }),
    enabled: !!selectedId,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-avaliacao-queue"] });
    queryClient.invalidateQueries({ queryKey: ["admin-avaliacao-catalog"] });
    queryClient.invalidateQueries({ queryKey: ["admin-avaliacao-detail"] });
  };

  const reviewMutation = useMutation({
    mutationFn: async (payload: {
      kind: "performando" | "resultado";
      id: string;
      status: "approved" | "rejected";
    }) => {
      if (payload.kind === "performando") {
        return runReviewPerformando({
          data: { criativoId: payload.id, status: payload.status, notes: reviewNotes || undefined },
        });
      }
      return runReviewResultado({
        data: { resultadoId: payload.id, status: payload.status, notes: reviewNotes || undefined },
      });
    },
    onSuccess: () => {
      toast.success("Avaliação registrada");
      setReviewNotes("");
      invalidateAll();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const submitReviewMutation = useMutation({
    mutationFn: () => {
      if (!selectedId) throw new Error("Sem criativo");
      return runSubmitReview({
        data: {
          criativoId: selectedId,
          verdict: adminVerdict,
          qualityScore: Number(qualityScore),
          notes: adminNotes || undefined,
          includeInIntelligence: includeIntel,
        },
      });
    },
    onSuccess: () => {
      toast.success("Sua avaliação foi salva");
      setAdminNotes("");
      invalidateAll();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const previewUrl = detail ? Object.values(detail.signedUrls)[0] : null;

  function handleQueueAction(item: AvaliacaoQueueItem, status: "approved" | "rejected") {
    reviewMutation.mutate({
      kind: item.kind === "performando" ? "performando" : "resultado",
      id: item.kind === "performando" ? item.criativoId : item.resultadoId,
      status,
    });
  }

  return (
    <div className="container mx-auto px-6 py-8 max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <ClipboardCheck className="size-6 text-primary-glow" /> Avaliação de criativos
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Valide sinais de performance dos usuários antes de alimentar a inteligência da plataforma
          {orgFilter && <span className="text-primary-glow"> · filtro por org</span>}
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="fila">
            Fila de validação
            {(queue?.pendingCount ?? 0) > 0 && (
              <Badge className="ml-2 bg-warning/20 text-warning border-0">{queue?.pendingCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="catalogo">Todos os criativos</TabsTrigger>
        </TabsList>

        <TabsContent value="fila" className="space-y-4 mt-4">
          <div className="flex flex-wrap items-center gap-3">
            <Label className="text-xs text-muted-foreground">Ordenação</Label>
            <Select
              value={queuePriorityFilter}
              onValueChange={(v) => setQueuePriorityFilter(v as "all" | "alta")}
            >
              <SelectTrigger className="w-[220px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alta">Alta prioridade primeiro</SelectItem>
                <SelectItem value="all">Todas as prioridades</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {queueLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="size-8 animate-spin text-primary-glow" />
            </div>
          ) : (queue?.items.length ?? 0) === 0 ? (
            <div className="glass rounded-xl border border-border/40 p-8 text-center text-muted-foreground text-sm">
              Nenhuma pendência — tudo validado.
            </div>
          ) : (queuePriorityFilter === "alta"
              ? queue?.items.filter((i) => i.priorityScore >= 10).length
              : queue?.items.length) === 0 ? (
            <div className="glass rounded-xl border border-border/40 p-8 text-center text-muted-foreground text-sm">
              Nenhum item de alta prioridade na fila. Altere o filtro para ver todos.
            </div>
          ) : (
            <div className="space-y-3">
              {(queuePriorityFilter === "alta"
                ? queue?.items.filter((i) => i.priorityScore >= 10)
                : queue?.items
              )?.map((item) => (
                <div
                  key={item.kind === "performando" ? `p-${item.criativoId}` : `r-${item.resultadoId}`}
                  className="glass rounded-xl border border-border/40 p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Badge variant="outline" className="mb-2">
                        {item.kind === "performando" ? "Claim Performando" : "Métrica reportada"}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`mb-2 ml-2 ${
                          item.priorityLabel === "Alta (CSV/UTM)"
                            ? "border-success/40 text-success"
                            : item.priorityLabel === "Média"
                              ? "border-warning/40 text-warning"
                              : "border-muted-foreground/40 text-muted-foreground"
                        }`}
                      >
                        {item.priorityLabel}
                      </Badge>
                      <p className="font-medium">{item.angulo}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.produto} · {item.organizationName} · {item.userEmail}
                      </p>
                      {item.kind === "resultado" && (
                        <p className="text-sm mt-1">
                          {item.tipo}
                          {item.metrica ? ` · ${item.metrica}` : ""}
                          {item.valor ? `: ${item.valor}` : ""}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {format(new Date(item.submittedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedId(item.criativoId)}
                      >
                        <Eye className="size-3.5 mr-1" /> Ver
                      </Button>
                      <Button
                        size="sm"
                        className="bg-success/20 text-success border border-success/40 hover:bg-success/30"
                        disabled={reviewMutation.isPending}
                        onClick={() => handleQueueAction(item, "approved")}
                      >
                        <CheckCircle2 className="size-3.5 mr-1" /> Aprovar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive border-destructive/40"
                        disabled={reviewMutation.isPending}
                        onClick={() => handleQueueAction(item, "rejected")}
                      >
                        <XCircle className="size-3.5 mr-1" /> Rejeitar
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {queuePriorityFilter === "alta" &&
                (queue?.items.filter((i) => i.priorityScore < 10).length ?? 0) > 0 && (
                  <p className="text-xs text-muted-foreground text-center pt-2">
                    {(queue?.items.filter((i) => i.priorityScore < 10).length ?? 0)} item(ns) de prioridade
                    média/baixa — altere o filtro para ver todos.
                  </p>
                )}
            </div>
          )}
          <div className="space-y-2">
            <Label className="text-xs">Notas para próxima aprovação/rejeição na fila</Label>
            <Textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="Opcional — visível no registro admin"
              rows={2}
            />
          </div>
        </TabsContent>

        <TabsContent value="catalogo" className="space-y-4 mt-4">
          <div className="flex flex-wrap gap-3">
            <form
              className="flex gap-2 flex-1 min-w-[200px] max-w-md"
              onSubmit={(e) => {
                e.preventDefault();
                setQuery(search);
                setPage(1);
              }}
            >
              <Input
                placeholder="Ângulo, produto, UTM..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Button type="submit" variant="outline" size="icon">
                <Search className="size-4" />
              </Button>
            </form>
            <Select value={intelStatus} onValueChange={(v) => { setIntelStatus(v); setPage(1); }}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Intel: todos</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="approved">Aprovado</SelectItem>
                <SelectItem value="rejected">Rejeitado</SelectItem>
                <SelectItem value="none">Sem claim</SelectItem>
              </SelectContent>
            </Select>
            <Select value={exportStatus} onValueChange={(v) => { setExportStatus(v); setPage(1); }}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos exports</SelectItem>
                <SelectItem value="rascunho">Rascunho</SelectItem>
                <SelectItem value="pronto">Pronto</SelectItem>
                <SelectItem value="erro">Erro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {catalogLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="size-8 animate-spin text-primary-glow" />
            </div>
          ) : (
            <>
              <div className="glass rounded-xl border border-border/40 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Ângulo</TableHead>
                      <TableHead>Org / Usuário</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Intel</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Criado</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {catalog?.criativos.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="text-sm max-w-[120px] truncate">{c.produto}</TableCell>
                        <TableCell className="text-sm max-w-[160px] truncate">{c.angulo}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[140px]">
                          <div className="truncate">{c.organizationName}</div>
                          <div className="truncate">{c.userEmail}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{c.status}</Badge>
                        </TableCell>
                        <TableCell>
                          {c.performandoIntelStatus ? (
                            <Badge variant="outline" className={`text-xs ${INTEL_BADGE[c.performandoIntelStatus] ?? ""}`}>
                              {c.performandoIntelStatus}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
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
                <span className="text-muted-foreground">{catalog?.total ?? 0} criativos</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!catalog || page * catalog.pageSize >= catalog.total}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedId} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhe para avaliação</DialogTitle>
          </DialogHeader>
          {detailLoading || !detail ? (
            <Loader2 className="size-6 animate-spin mx-auto my-8" />
          ) : (
            <div className="space-y-5 text-sm">
              <div>
                <p className="font-medium text-base">{detail.criativo.angulo}</p>
                <p className="text-muted-foreground">{detail.criativo.produto}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {detail.organizationName} · {detail.userEmail}
                </p>
                <div className="flex gap-2 flex-wrap mt-2">
                  <Badge>{String(detail.criativo.status)}</Badge>
                  <Badge variant="outline">{String(detail.criativo.export_status)}</Badge>
                  {detail.criativo.performando_intel_status && (
                    <Badge variant="outline" className={INTEL_BADGE[detail.criativo.performando_intel_status]}>
                      intel: {detail.criativo.performando_intel_status}
                    </Badge>
                  )}
                  {detail.scoreTotal != null && (
                    <Badge variant="secondary">Score {detail.scoreTotal}%</Badge>
                  )}
                </div>
              </div>

              {previewUrl && (
                <video src={previewUrl} controls className="w-full rounded-lg max-h-48" />
              )}

              {detail.criativo.performando_intel_status === "pending" && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={reviewMutation.isPending}
                    onClick={() =>
                      reviewMutation.mutate({
                        kind: "performando",
                        id: detail.criativo.id,
                        status: "approved",
                      })
                    }
                  >
                    <CheckCircle2 className="size-4 mr-1" /> Aprovar Performando
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={reviewMutation.isPending}
                    onClick={() =>
                      reviewMutation.mutate({
                        kind: "performando",
                        id: detail.criativo.id,
                        status: "rejected",
                      })
                    }
                  >
                    <XCircle className="size-4 mr-1" /> Rejeitar
                  </Button>
                </div>
              )}

              {detail.resultados.length > 0 && (
                <div className="space-y-2">
                  <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground">
                    Resultados reportados
                  </p>
                  {detail.resultados.map((r) => (
                    <div key={r.id} className="rounded-lg border border-border/40 p-3 space-y-2">
                      <div className="flex justify-between gap-2">
                        <span>
                          {r.tipo}
                          {r.metrica ? ` · ${r.metrica}` : ""}
                          {r.valor ? `: ${r.valor}` : ""}
                        </span>
                        <Badge variant="outline" className={INTEL_BADGE[r.intel_review_status]}>
                          {r.intel_review_status}
                        </Badge>
                      </div>
                      {r.observacao && (
                        <p className="text-xs text-muted-foreground">{r.observacao}</p>
                      )}
                      {r.intel_review_status === "pending" && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={reviewMutation.isPending}
                            onClick={() =>
                              reviewMutation.mutate({
                                kind: "resultado",
                                id: r.id,
                                status: "approved",
                              })
                            }
                          >
                            Aprovar métrica
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={reviewMutation.isPending}
                            onClick={() =>
                              reviewMutation.mutate({
                                kind: "resultado",
                                id: r.id,
                                status: "rejected",
                              })
                            }
                          >
                            Rejeitar
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t border-border/40 pt-4 space-y-3">
                <p className="font-medium">Sua avaliação</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Veredito</Label>
                    <Select value={adminVerdict} onValueChange={(v) => setAdminVerdict(v as typeof adminVerdict)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="approved">Aprovado</SelectItem>
                        <SelectItem value="rejected">Rejeitado</SelectItem>
                        <SelectItem value="flagged">Sinalizar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Nota (1–5)</Label>
                    <Select value={qualityScore} onValueChange={setQualityScore}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Notas internas sobre qualidade do criativo..."
                  rows={3}
                />
                <label className="flex items-center gap-2 text-xs">
                  <Checkbox checked={includeIntel} onCheckedChange={(v) => setIncludeIntel(v === true)} />
                  Incluir na inteligência da plataforma
                </label>
                <Button
                  size="sm"
                  disabled={submitReviewMutation.isPending}
                  onClick={() => submitReviewMutation.mutate()}
                >
                  Salvar avaliação
                </Button>
              </div>

              {detail.adminReviews.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Histórico admin</p>
                  {detail.adminReviews.map((rev) => (
                    <div key={rev.id} className="text-xs rounded bg-muted/20 p-2">
                      <span className="font-medium">{rev.verdict}</span>
                      {rev.quality_score != null && <span> · nota {rev.quality_score}</span>}
                      <span className="text-muted-foreground">
                        {" "}
                        · {format(new Date(rev.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                      </span>
                      {rev.notes && <p className="mt-1 text-muted-foreground">{rev.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
