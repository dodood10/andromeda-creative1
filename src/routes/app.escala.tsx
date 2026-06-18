import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AppBreadcrumbs } from "@/components/app-breadcrumbs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  TrendingUp,
  Upload,
  Sparkles,
  Play,
  Loader2,
  ArrowRight,
  Search,
  AlertTriangle,
  ListOrdered,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/contexts/workspace-context";
import { uploadCriativoMedia } from "@/lib/storage";
import { getCriativo, listCriativos } from "@/lib/criativos.functions";
import { analisarCampeao, gerarVariacoesEscala } from "@/lib/escala.functions";
import { getSignedExportUrls } from "@/lib/export.functions";
import type { EscalaAnalise } from "@/lib/schemas/escala.schema";

const searchSchema = z.object({
  criativoId: z.string().uuid().optional(),
});

export const Route = createFileRoute("/app/escala")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Fase de escala · Andromeda" },
      { name: "description", content: "Analise o campeão e gere variações completas com IA." },
    ],
  }),
  component: Escala,
});

type SelectedVariacao = { variacaoId: string; hookOptionIndex?: number };

const RISCO_COLORS: Record<string, string> = {
  baixo: "bg-success/20 text-success border-success/40",
  medio: "bg-warning/20 text-warning border-warning/40",
  alto: "bg-destructive/20 text-destructive border-destructive/40",
};

function variacaoKey(v: SelectedVariacao) {
  return v.hookOptionIndex != null ? `${v.variacaoId}:${v.hookOptionIndex}` : v.variacaoId;
}

function Escala() {
  const { criativoId } = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { organizationId, projectId } = useWorkspace();
  const queryClient = useQueryClient();
  const fetchCriativo = useServerFn(getCriativo);
  const fetchCriativos = useServerFn(listCriativos);
  const runAnalise = useServerFn(analisarCampeao);
  const runVariacoes = useServerFn(gerarVariacoesEscala);
  const signExports = useServerFn(getSignedExportUrls);

  const { data: campeao } = useQuery({
    queryKey: ["criativo", criativoId],
    queryFn: () => fetchCriativo({ data: { id: criativoId! } }),
    enabled: !!criativoId,
  });

  const { data: performandoRows = [] } = useQuery({
    queryKey: ["criativos-performando", projectId],
    queryFn: async () => {
      const rows = await fetchCriativos({ data: { projectId: projectId! } });
      return rows.filter((r) => r.status === "Performando");
    },
    enabled: !!projectId && !criativoId,
  });

  const aj = (campeao?.angulo_json as { escala_analise?: EscalaAnalise } | null) ?? {};
  const analiseCache = aj.escala_analise;

  const [analise, setAnalise] = useState<EscalaAnalise | null>(analiseCache ?? null);
  const [step, setStep] = useState<"analise" | "geracao">(analiseCache ? "geracao" : "analise");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (analiseCache) {
      setAnalise(analiseCache);
      setStep("geracao");
    }
  }, [analiseCache]);

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const [variacoesCriadas, setVariacoesCriadas] = useState<
    Array<{ tipo: string; hook: string; criativoId?: string; angulo: string }> | null
  >(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const statusOk = ["Performando", "Rodando", "Subiu"].includes(campeao?.status ?? "");
  const intelPending = campeao?.performando_intel_status === "pending";
  const intelApproved =
    campeao?.status !== "Performando" || campeao?.performando_intel_status === "approved";
  const canScale = statusOk && intelApproved;

  const analiseMutation = useMutation({
    mutationFn: (force: boolean) => {
      if (!criativoId) throw new Error("Selecione um criativo");
      return runAnalise({ data: { criativoId, force } });
    },
    onSuccess: (data) => {
      setAnalise(data.analise);
      setStep("geracao");
      queryClient.invalidateQueries({ queryKey: ["criativo", criativoId] });
      toast.success(data.cached ? "Análise carregada do cache" : "Análise do campeão concluída");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro na análise"),
  });

  const toggleVariacao = (v: SelectedVariacao) => {
    const key = variacaoKey(v);
    const next = new Set(selected);
    next.has(key) ? next.delete(key) : next.add(key);
    setSelected(next);
  };

  const selectedList = (): SelectedVariacao[] => {
    const list: SelectedVariacao[] = [];
    for (const key of selected) {
      const [id, idx] = key.split(":");
      list.push({
        variacaoId: id,
        hookOptionIndex: idx != null ? Number(idx) : undefined,
      });
    }
    return list;
  };

  const gerarMutation = useMutation({
    mutationFn: () => {
      if (!criativoId || !organizationId || !projectId) {
        throw new Error("Selecione um criativo campeão no histórico");
      }
      const variacoes = selectedList();
      if (variacoes.length === 0) throw new Error("Selecione ao menos uma variação");
      return runVariacoes({
        data: {
          criativoId,
          variacoes: variacoes as Array<{ variacaoId: "hook-v" | "hook-t" | "avatar" | "formato" | "empilha" | "benef" | "cta"; hookOptionIndex?: number }>,
          organizationId,
          projectId,
        },
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["criativos"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      if (data.variacoes.length === 0) {
        toast.error("Nenhuma variação gerada — verifique ANTHROPIC_API_KEY");
        return;
      }
      if (data.variacoes.length === 1 && data.variacoes[0].criativoId) {
        toast.success("1 variação criada");
        navigate({ to: "/app/editor", search: { criativoId: data.variacoes[0].criativoId } });
      } else {
        setVariacoesCriadas(data.variacoes);
        toast.success(`${data.variacoes.length} variações criadas`);
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao gerar lote"),
  });

  async function loadPreview() {
    const paths = (campeao?.export_paths as string[]) ?? [];
    if (paths.length === 0) return;
    try {
      const { urls } = await signExports({ data: { paths: [paths[0]] } });
      setPreviewUrl(urls[paths[0]] ?? null);
    } catch {
      /* ignore */
    }
  }

  async function handleFileUpload(file: File) {
    if (!user) {
      toast.error("Faça login para enviar vídeos");
      return;
    }
    setUploading(true);
    try {
      const { path } = await uploadCriativoMedia(user.id, file, projectId ?? undefined);
      setUploadedPath(path);
      toast.success("Vídeo enviado para o storage");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro no upload");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="container mx-auto px-4 md:px-6 py-8 max-w-6xl space-y-8">
      <AppBreadcrumbs
        items={[
          { label: "Projeto", to: "/app" },
          { label: "Escala" },
        ]}
      />
      <div>
        <h1 className="text-3xl font-display font-bold flex items-center gap-3">
          <TrendingUp className="size-7 text-primary-glow" /> Fase de escala
        </h1>
        <p className="text-muted-foreground mt-1">
          {campeao
            ? `Escalando: ${campeao.angulo} · ${campeao.produto}`
            : "Pegue o que está performando e gere variações em lote."}
        </p>
      </div>

      {!criativoId && (
        <Card className="glass p-6 space-y-4 border border-primary/20">
          <h2 className="font-semibold">Escolha um criativo campeão</h2>
          {performandoRows.length > 0 ? (
            <>
              <p className="text-sm text-muted-foreground">
                Selecione um criativo marcado como Performando para analisar e gerar variações.
              </p>
              <Select
                onValueChange={(id) => navigate({ to: "/app/escala", search: { criativoId: id } })}
              >
                <SelectTrigger className="min-h-11">
                  <SelectValue placeholder="Selecionar campeão…" />
                </SelectTrigger>
                <SelectContent>
                  {performandoRows.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.angulo} · {r.produto}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Nenhum campeão ainda. Exporte criativos, suba no Meta e marque como Performando no histórico.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link to="/app/historico" search={{ export: "pendente" }}>
                  <Button variant="outline" className="min-h-11">Ver pendentes de export</Button>
                </Link>
                <Link to="/app/historico" search={{ status: "Performando" }}>
                  <Button className="min-h-11 bg-gradient-primary border-0">Abrir histórico</Button>
                </Link>
              </div>
            </>
          )}
        </Card>
      )}

      {criativoId && (
      <div className="space-y-6">
          <Card className="glass bg-gradient-card p-6">
            <div className="flex gap-6">
              <button
                type="button"
                onClick={() => void loadPreview()}
                className="w-32 aspect-[9/16] rounded-xl bg-gradient-to-br from-primary/40 to-accent/30 border border-border flex items-center justify-center shrink-0 overflow-hidden relative group"
              >
                {previewUrl ? (
                  <video src={previewUrl} className="absolute inset-0 w-full h-full object-cover" muted />
                ) : (
                  <Play className="size-6 text-primary-foreground/80 fill-current group-hover:scale-110 transition" />
                )}
              </button>
              <div className="flex-1">
                {campeao ? (
                  <>
                    <Badge className="bg-success/20 text-success border-success/40 mb-2">{campeao.status}</Badge>
                    <h2 className="font-display text-xl font-semibold">{campeao.angulo}</h2>
                    <p className="text-sm text-muted-foreground mt-1">{campeao.produto} · {campeao.formato_saida ?? campeao.formato}</p>
                    {!statusOk && (
                      <div className="mt-3 flex items-start gap-2 text-sm text-warning p-3 rounded-lg bg-warning/10 border border-warning/30">
                        <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                        <span>Este criativo ainda não está marcado como performando — você pode analisar mesmo assim para testar o fluxo.</span>
                      </div>
                    )}
                    {intelPending && (
                      <div className="mt-3 flex items-start gap-2 text-sm text-warning p-3 rounded-lg bg-warning/10 border border-warning/30">
                        <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                        <span>
                          Performando aguardando validação da equipe — a escala com inteligência completa só após aprovação admin.
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <Badge className="bg-muted/20 text-muted-foreground border-border mb-2">Sem criativo selecionado</Badge>
                    <h2 className="font-display text-xl font-semibold">Selecione um campeão no histórico</h2>
                  </>
                )}
              </div>
            </div>
          </Card>

          {/* Passo 1 — Análise */}
          <Card className="glass p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold flex items-center gap-2">
                  <Search className="size-5 text-primary-glow" /> Passo 1 — Análise do campeão
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  4 operações: transcrição, estrutura invisível, pontos de força e menu de 7 variações.
                </p>
              </div>
              <div className="flex gap-2">
                {analise && (
                  <Button variant="outline" size="sm" disabled={analiseMutation.isPending || !criativoId} onClick={() => analiseMutation.mutate(true)}>
                    Reanalisar
                  </Button>
                )}
                <Button
                  className="bg-gradient-primary border-0"
                  disabled={!criativoId || analiseMutation.isPending}
                  onClick={() => analiseMutation.mutate(false)}
                >
                  {analiseMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin mr-1.5" />
                  ) : (
                    <Search className="size-4 mr-1.5" />
                  )}
                  {analise ? "Atualizar análise" : "Analisar campeão"}
                </Button>
              </div>
            </div>

            {analise && (
              <div className="space-y-4 pt-2 border-t border-border/40">
                {analise.transcricao_blocos.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Transcrição por blocos</h3>
                    <div className="space-y-2">
                      {analise.transcricao_blocos.map((b, i) => (
                        <div key={i} className="p-3 rounded-lg bg-background/40 border border-border/40 text-sm">
                          <div className="flex items-center gap-2 text-xs text-primary-glow font-mono mb-1">
                            <span>{b.tempo}</span>
                            {b.tipo && <Badge variant="outline" className="text-[10px]">{b.tipo}</Badge>}
                          </div>
                          <p className="text-muted-foreground">{b.conteudo}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-semibold mb-2">Estrutura invisível</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    <div className="p-3 rounded-lg bg-background/40 border border-border/40">
                      <span className="text-xs text-muted-foreground">Ângulo psicológico</span>
                      <p className="mt-0.5">{analise.estrutura_invisivel.angulo_psicologico}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-background/40 border border-border/40">
                      <span className="text-xs text-muted-foreground">Micropersona alvo</span>
                      <p className="mt-0.5">{analise.estrutura_invisivel.micropersona_alvo}</p>
                    </div>
                    {analise.estrutura_invisivel.vilao_nomeado && (
                      <div className="p-3 rounded-lg bg-background/40 border border-border/40">
                        <span className="text-xs text-muted-foreground">Vilão nomeado</span>
                        <p className="mt-0.5">{analise.estrutura_invisivel.vilao_nomeado}</p>
                      </div>
                    )}
                    {analise.estrutura_invisivel.mecanismo && (
                      <div className="p-3 rounded-lg bg-background/40 border border-border/40">
                        <span className="text-xs text-muted-foreground">Mecanismo</span>
                        <p className="mt-0.5">{analise.estrutura_invisivel.mecanismo}</p>
                      </div>
                    )}
                    {analise.estrutura_invisivel.avatar_falante && (
                      <div className="p-3 rounded-lg bg-background/40 border border-border/40">
                        <span className="text-xs text-muted-foreground">Avatar falante</span>
                        <p className="mt-0.5">{analise.estrutura_invisivel.avatar_falante}</p>
                      </div>
                    )}
                    {analise.estrutura_invisivel.nivel_schwartz && (
                      <div className="p-3 rounded-lg bg-background/40 border border-border/40">
                        <span className="text-xs text-muted-foreground">Schwartz</span>
                        <p className="mt-0.5">{analise.estrutura_invisivel.nivel_schwartz}</p>
                      </div>
                    )}
                  </div>
                  {analise.estrutura_invisivel.gatilhos_por_bloco && (
                    <p className="text-xs text-muted-foreground mt-2 p-3 rounded-lg bg-background/30 border border-border/30">
                      {analise.estrutura_invisivel.gatilhos_por_bloco}
                    </p>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-2">Pontos de força (não tocar)</h3>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
                    {analise.pontos_forca.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {(["baixo_risco", "medio_risco", "alto_risco"] as const).map((k) => (
                    <div key={k} className="p-3 rounded-lg bg-background/40 border border-border/40">
                      <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                        {k === "baixo_risco" ? "Baixo risco" : k === "medio_risco" ? "Médio risco" : "Alto risco"}
                      </div>
                      <ul className="text-xs space-y-1">
                        {analise.variaveis_testaveis[k].map((v, i) => (
                          <li key={i}>{v}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                {analise.ordem_lancamento.length > 0 && (
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                      <ListOrdered className="size-4 text-primary-glow" /> Ordem de lançamento recomendada
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {analise.ordem_lancamento.map((id, i) => (
                        <Badge key={id} variant="outline" className="text-xs">
                          {i + 1}. {id}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Passo 2 — Geração */}
          {analise && step === "geracao" && (
            <div className="space-y-4">
              <h2 className="font-display text-xl font-semibold">Passo 2 — Gerar variações selecionadas</h2>
              <div className="grid grid-cols-1 gap-3">
                {analise.menu_variacoes.map((item) => (
                  <Card key={item.id} className="glass p-4 space-y-3">
                    {item.id === "hook-t" && item.opcoes_hook_textual?.length ? (
                      <>
                        <div className="flex items-start gap-3">
                          <Badge className={RISCO_COLORS[item.nivel_risco] ?? "bg-muted/20"}>{item.nivel_risco}</Badge>
                          <div className="flex-1">
                            <div className="font-medium">{item.nome}</div>
                            <p className="text-sm text-muted-foreground mt-0.5">{item.justificativa_probabilistica}</p>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">Escolha quais hooks textuais gerar (corpo idêntico a partir do 3s):</p>
                        {item.opcoes_hook_textual.map((hook, idx) => {
                          const v: SelectedVariacao = { variacaoId: item.id, hookOptionIndex: idx };
                          const key = variacaoKey(v);
                          return (
                            <label key={key} className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition ${
                              selected.has(key) ? "border border-primary/50 bg-primary/5" : "border border-border/40"
                            }`}>
                              <Checkbox checked={selected.has(key)} onCheckedChange={() => toggleVariacao(v)} className="mt-0.5" />
                              <div className="text-sm">
                                <span className="text-xs text-muted-foreground">Opção {idx + 1}</span>
                                <p className="mt-0.5">{hook}</p>
                              </div>
                            </label>
                          );
                        })}
                      </>
                    ) : (
                      <label className={`flex items-start gap-3 cursor-pointer ${
                        selected.has(item.id) ? "" : ""
                      }`}>
                        <Checkbox
                          checked={selected.has(item.id)}
                          onCheckedChange={() => toggleVariacao({ variacaoId: item.id })}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{item.nome}</span>
                            <Badge className={RISCO_COLORS[item.nivel_risco] ?? "bg-muted/20"}>{item.nivel_risco}</Badge>
                            {item.probabilidade_superar_original && (
                              <span className="text-xs text-primary-glow">{item.probabilidade_superar_original}</span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{item.justificativa_probabilistica}</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 text-xs">
                            <div><span className="text-muted-foreground">Muda:</span> {item.o_que_muda}</div>
                            <div><span className="text-muted-foreground">Permanece:</span> {item.o_que_permanece}</div>
                          </div>
                          {item.hook_rate_estimado && (
                            <p className="text-xs text-muted-foreground mt-1">Hook rate estimado: {item.hook_rate_estimado}</p>
                          )}
                        </div>
                      </label>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          )}
      </div>
      )}

      {criativoId && analise && (
        <div className="sticky bottom-4 flex justify-between items-center glass bg-gradient-card rounded-xl p-4">
          <div className="text-sm">
            <span className="text-muted-foreground">Selecionadas:</span>{" "}
            <span className="font-semibold">{selected.size}</span>
          </div>
          <Button
            className="bg-gradient-primary border-0 shadow-glow"
            disabled={!criativoId || selected.size === 0 || gerarMutation.isPending}
            onClick={() => gerarMutation.mutate()}
          >
            {gerarMutation.isPending ? (
              <Loader2 className="size-4 animate-spin mr-1.5" />
            ) : (
              <Sparkles className="size-4 mr-1.5" />
            )}
            Gerar selecionadas
          </Button>
        </div>
      )}

      <Dialog open={!!variacoesCriadas} onOpenChange={(open) => !open && setVariacoesCriadas(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{variacoesCriadas?.length ?? 0} variações criadas</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-64 overflow-auto py-2">
            {variacoesCriadas?.map((v) =>
              v.criativoId ? (
                <Link
                  key={v.criativoId}
                  to="/app/editor"
                  search={{ criativoId: v.criativoId }}
                  onClick={() => setVariacoesCriadas(null)}
                >
                  <Button variant="outline" className="w-full justify-between h-auto py-2">
                    <span className="text-left truncate">
                      <span className="text-xs text-muted-foreground block">{v.tipo}</span>
                      {v.angulo}
                    </span>
                    <ArrowRight className="size-4 shrink-0" />
                  </Button>
                </Link>
              ) : null,
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
