import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Brain,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Loader2,
  ArrowRight,
  Sparkles,
  Shield,
  AlertTriangle,
} from "lucide-react";
import { getInteligenciaNicho, getIntelReviewStatus } from "@/lib/criativos.functions";
import { useWorkspace } from "@/contexts/workspace-context";
import { ImportBibliotecaButton } from "@/components/import-biblioteca-dialog";
import { ColarTranscricaoButton } from "@/components/colar-transcricao-dialog";
import { ReferenceTranscriptionsList } from "@/components/reference-transcriptions-list";
import { ReferenceComboPanel } from "@/components/reference-combo-panel";
import { AppBreadcrumbs } from "@/components/app-breadcrumbs";

export const Route = createFileRoute("/app/inteligencia")({
  head: () => ({
    meta: [{ title: "Inteligência de nicho · Andromeda" }],
  }),
  component: Inteligencia,
});

const FEED_ICONS = [Sparkles, TrendingUp, AlertTriangle] as const;

function Inteligencia() {
  const { projectId, currentProject, loading: wsLoading } = useWorkspace();
  const fetchIntel = useServerFn(getInteligenciaNicho);
  const fetchReviewStatus = useServerFn(getIntelReviewStatus);

  const { data, isLoading } = useQuery({
    queryKey: ["inteligencia", projectId],
    queryFn: () => fetchIntel({ data: { projectId: projectId! } }),
    enabled: !!projectId,
  });

  const { data: reviewStatus } = useQuery({
    queryKey: ["intel-review-status", projectId],
    queryFn: () => fetchReviewStatus({ data: { projectId: projectId! } }),
    enabled: !!projectId,
  });

  const resumo = data?.resumo;

  return (
    <div className="container mx-auto px-6 py-8 max-w-6xl space-y-8">
      <AppBreadcrumbs items={[{ label: "Dashboard", to: "/app" }, { label: "Inteligência" }]} />
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold flex items-center gap-3">
            <Brain className="size-7 text-primary-glow" /> Inteligência de nicho
          </h1>
          <p className="text-muted-foreground mt-1">
            Dados reais do projeto <span className="text-foreground">{currentProject?.name}</span>
            {currentProject?.nicho ? ` · ${currentProject.nicho}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <ColarTranscricaoButton />
          <ImportBibliotecaButton />
          <Link to="/app">
            <Button variant="outline">Voltar ao dashboard</Button>
          </Link>
        </div>
      </div>

      {wsLoading || isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-8 animate-spin text-primary-glow" />
        </div>
      ) : !data ? (
        <Card className="glass p-8 text-center text-muted-foreground">
          Selecione um projeto para ver inteligência.
        </Card>
      ) : (resumo?.total ?? 0) === 0 && !(resumo?.referenciasTranscricao ?? 0) ? (
        <Card className="glass p-8 space-y-6 border border-primary/20">
          <h2 className="font-display text-xl font-semibold">Sua inteligência começa com dados reais</h2>
          <p className="text-sm text-muted-foreground">
            Cole transcrições de anúncios que venderam, importe campeões em vídeo ou gere na plataforma.
          </p>
          <ol className="space-y-4 text-sm">
            <li className="flex gap-3">
              <span className="size-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-xs font-bold">1</span>
              <div>
                <p className="font-medium">Cole transcrições ou importe campeões</p>
                <p className="text-muted-foreground">
                  Só o texto já alimenta o gerador; MP4s escalados enriquecem ainda mais.
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="size-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-xs font-bold">2</span>
              <div>
                <p className="font-medium">Marque Performando e reporte métricas</p>
                <p className="text-muted-foreground">
                  No histórico, atualize o status e registre CPA ou ROAS. A equipe valida antes de usar na IA.
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="size-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-xs font-bold">3</span>
              <div>
                <p className="font-medium">Volte aqui para insights e escala</p>
                <p className="text-muted-foreground">Dados validados calibram o gerador e a escala.</p>
              </div>
            </li>
          </ol>
          <div className="flex flex-wrap gap-2">
            <ColarTranscricaoButton variant="default" size="default" className="min-h-11 bg-gradient-primary border-0" />
            <ImportBibliotecaButton variant="outline" size="default" className="min-h-11" />
            <Link to="/app/gerador">
              <Button variant="outline" className="min-h-11">Gerar ângulos</Button>
            </Link>
            <Link to="/app/historico">
              <Button variant="outline" className="min-h-11">Abrir histórico</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <>
          {(resumo?.referenciasTranscricao ?? 0) > 0 && (
            <Card className="glass p-4 border border-primary/20 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Transcrições de referência</p>
                <p className="text-xs text-muted-foreground">
                  {resumo?.referenciasTranscricao} texto(s) alimentando o gerador neste projeto
                </p>
              </div>
              <ColarTranscricaoButton />
            </Card>
          )}

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard label="Criativos" value={resumo?.total ?? 0} sub={
              (resumo?.importados ?? 0) > 0
                ? `${resumo?.importados} importados · ${resumo?.geradosNaPlataforma} gerados`
                : undefined
            } />
            <StatCard
              label="Performando"
              value={resumo?.performando ?? 0}
              sub={`${resumo?.performandoValidados ?? 0} validados pela equipe`}
              accent="success"
            />
            <StatCard label="Rodando" value={resumo?.rodando ?? 0} accent="accent" />
            <StatCard
              label="Hook rate médio (IA)"
              value={resumo?.hookRateMedioEstimado != null ? `${resumo.hookRateMedioEstimado}%` : "—"}
            />
            <StatCard
              label="Hook rate médio (real)"
              value={resumo?.hookRateMedioReal != null ? `${resumo.hookRateMedioReal}%` : "—"}
              sub="métricas validadas"
            />
          </div>

          {(data.intelSettings?.cpa_medio_validado != null ||
            data.intelSettings?.roas_medio_validado != null) && (
            <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
              <StatCard
                label="CPA médio (validado)"
                value={
                  data.intelSettings?.cpa_medio_validado != null
                    ? `R$ ${data.intelSettings.cpa_medio_validado.toFixed(2)}`
                    : "—"
                }
                sub={
                  data.intelSettings?.calibration_samples_conversion
                    ? `${data.intelSettings.calibration_samples_conversion} amostra(s)`
                    : "campeões aprovados"
                }
              />
              <StatCard
                label="ROAS médio (validado)"
                value={
                  data.intelSettings?.roas_medio_validado != null
                    ? data.intelSettings.roas_medio_validado.toFixed(2)
                    : "—"
                }
                sub={data.intelSettings?.conversion_bias_notes ?? undefined}
              />
            </div>
          )}

          {data.nicheComparison && data.nicheComparison.lines.length > 0 && (
            <Card className="glass p-5 border border-primary/20">
              <h2 className="font-semibold text-sm mb-3">
                Benchmark do nicho ({data.nicheComparison.nicho})
              </h2>
              <div className="grid gap-3 sm:grid-cols-3">
                {data.nicheComparison.lines.map((line) => (
                  <div
                    key={line.metric}
                    className={`rounded-lg border p-3 text-sm ${
                      line.verdict === "better"
                        ? "border-success/40 bg-success/5"
                        : line.verdict === "worse"
                          ? "border-warning/40 bg-warning/5"
                          : "border-border/50"
                    }`}
                  >
                    <p className="font-medium">{line.metric}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Projeto: {line.project} · Nicho: {line.niche}
                    </p>
                    <p className="text-xs mt-2 text-muted-foreground">{line.hint}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {(data.pendentesValidacao.performando > 0 || data.pendentesValidacao.resultados > 0) && (
            <Card className="glass p-4 border border-warning/30 bg-warning/5 space-y-3">
              <p className="text-sm font-medium text-warning flex items-center gap-2">
                <Shield className="size-4" /> Aguardando validação da equipe
              </p>
              <p className="text-xs text-muted-foreground">
                {data.pendentesValidacao.performando > 0 &&
                  `${data.pendentesValidacao.performando} claim(s) Performando`}
                {data.pendentesValidacao.performando > 0 && data.pendentesValidacao.resultados > 0 && " · "}
                {data.pendentesValidacao.resultados > 0 &&
                  `${data.pendentesValidacao.resultados} métrica(s) reportada(s)`}
                {" — "}
                Somente dados <strong className="text-foreground font-medium">aprovados pela equipe</strong> entram
                no gerador e na calibração.
              </p>
              {reviewStatus && reviewStatus.totalPending > 0 && (
                <div className="text-xs space-y-2 border-t border-warning/20 pt-3">
                  <p className="font-medium text-foreground">Sua posição na fila</p>
                  <p className="text-muted-foreground">{reviewStatus.estimateText}</p>
                  {reviewStatus.oldestPending.length > 0 && (
                    <ul className="space-y-1">
                      {reviewStatus.oldestPending.map((item) => (
                        <li key={`${item.kind}-${item.criativoId}`} className="flex flex-wrap gap-2 items-center">
                          <Badge variant="outline" className="text-[10px]">
                            {item.priorityLabel}
                          </Badge>
                          <span className="text-muted-foreground truncate max-w-[240px]">{item.angulo}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-muted-foreground">
                    Para acelerar: {reviewStatus.accelerateTips.join(" · ")}
                  </p>
                </div>
              )}
            </Card>
          )}

          {data.contextPreview && (
            <Card className="glass p-6 space-y-3 border border-primary/25">
              <h2 className="font-semibold flex items-center gap-2">
                <Brain className="size-4 text-primary-glow" /> Inteligência geral (transcrições)
              </h2>
              <p className="text-xs text-muted-foreground">
                Copy de anúncios que você colou; entra direto no gerador de ângulos.
              </p>
              <pre className="text-xs whitespace-pre-wrap font-mono bg-background/50 border border-border/40 rounded-lg p-4 max-h-64 overflow-y-auto text-muted-foreground">
                {data.contextPreview}
              </pre>
            </Card>
          )}

          {(data.referenceTranscriptions?.length ?? 0) > 0 && (
            <>
              <ReferenceComboPanel
                items={data.referenceTranscriptions ?? []}
                activeCombo={data.referenceCombo}
              />
              <ReferenceTranscriptionsList items={data.referenceTranscriptions ?? []} />
            </>
          )}

          {data.performanceContextPreview && (
            <Card className="glass p-6 space-y-3 border border-success/25">
              <h2 className="font-semibold flex items-center gap-2">
                <Shield className="size-4 text-success" /> Performance validada
              </h2>
              <p className="text-xs text-muted-foreground">
                Campeões e métricas aprovados pela equipe — calibração numérica e anti-repetição.
              </p>
              <pre className="text-xs whitespace-pre-wrap font-mono bg-background/50 border border-border/40 rounded-lg p-4 max-h-64 overflow-y-auto text-muted-foreground">
                {data.performanceContextPreview}
              </pre>
            </Card>
          )}

          {data.nicheInsights.length > 0 && (
            <Card className="glass p-6 space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h2 className="font-semibold flex items-center gap-2">
                  <Sparkles className="size-4 text-primary-glow" /> O que escala no nicho hoje
                </h2>
                {data.nicheInsightsCached && (
                  <Badge variant="outline" className="text-xs">Atualizado hoje</Badge>
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {data.nicheInsights.map((item, i) => {
                  const Icon = FEED_ICONS[i % FEED_ICONS.length];
                  return (
                    <div key={item.title} className="p-4 rounded-lg border border-border/40 bg-background/30 space-y-2">
                      <div className="flex items-center gap-2">
                        <Icon className="size-4 text-primary-glow shrink-0" />
                        <Badge variant="outline" className="text-[10px]">{item.tag}</Badge>
                      </div>
                      <p className="font-medium text-sm">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {(data.intelSettings?.hook_rate_bias_pp != null ||
            (data.sinaisCalibration?.length ?? 0) > 0) && (
            <Card className="glass p-6 space-y-4 border border-primary/20">
              <h2 className="font-semibold flex items-center gap-2">
                <TrendingDown className="size-4 text-primary-glow" /> Calibração hook rate (estimado vs real)
              </h2>
              {data.intelSettings?.hook_rate_bias_pp != null && (
                <p className="text-sm text-muted-foreground">
                  Bias do projeto: estimativas{" "}
                  {data.intelSettings.hook_rate_bias_pp > 0
                    ? `subestimaram em ~${data.intelSettings.hook_rate_bias_pp}pp`
                    : data.intelSettings.hook_rate_bias_pp < 0
                      ? `superestimaram em ~${Math.abs(data.intelSettings.hook_rate_bias_pp)}pp`
                      : "alinhadas com o real"}
                  {data.intelSettings.calibration_samples
                    ? ` (${data.intelSettings.calibration_samples} amostra(s) validadas)`
                    : ""}
                  .
                </p>
              )}
              {(data.sinaisCalibration?.length ?? 0) > 0 && (
                <div className="space-y-2">
                  {data.sinaisCalibration!.map((s) => (
                    <div
                      key={s.angulo}
                      className="flex flex-wrap justify-between gap-2 p-3 rounded-lg border border-border/40 text-sm"
                    >
                      <span className="font-medium truncate pr-4">{s.angulo}</span>
                      <span className="text-muted-foreground font-mono text-xs">
                        est. {s.hookRateEstimado ?? "—"} → real {s.hookRateReal ?? "—"}
                        {s.delta ? ` (${s.delta})` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="glass p-6 space-y-4">
              <h2 className="font-semibold flex items-center gap-2">
                <BarChart3 className="size-4 text-primary-glow" /> Métricas validadas
              </h2>
              {data.metricasReportadas.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma métrica validada ainda. Reporte no histórico e aguarde aprovação da equipe.
                </p>
              ) : (
                <div className="space-y-3">
                  {data.metricasReportadas.map((m) => (
                    <div key={m.metrica} className="flex justify-between items-center p-3 rounded-lg bg-background/40 border border-border/40">
                      <div>
                        <div className="font-medium">{m.metrica}</div>
                        <div className="text-xs text-muted-foreground">{m.amostras} registro(s)</div>
                      </div>
                      <div className="text-right font-mono text-sm">{m.ultimo ?? "—"}</div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="glass p-6 space-y-4">
              <h2 className="font-semibold">Estilos campeões (validados)</h2>
              {data.estilosCampeoes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum estilo com campeão validado ainda.
                </p>
              ) : (
                <div className="space-y-2">
                  {data.estilosCampeoes.map((e) => (
                    <div key={e.estilo} className="flex justify-between p-3 rounded-lg border border-border/40 text-sm">
                      <span className="font-medium">{e.estilo.replace(/_/g, " ")}</span>
                      <Badge className="bg-success/20 text-success border-success/40">{e.count} campeão(ões)</Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {data.importQuality && (
            <Card className="glass p-6 space-y-3">
              <h2 className="font-semibold">Qualidade dos imports</h2>
              <p className="text-sm text-muted-foreground">
                {data.importQuality.comTranscricao} de {data.importQuality.total} com transcrição completa
                {data.importQuality.parcial > 0
                  ? ` · ${data.importQuality.parcial} com análise parcial (configure FFMPEG_SERVICE_URL para melhorar)`
                  : ""}
              </p>
            </Card>
          )}

          {(data.variationFailures.length > 0 || data.failedPatterns.length > 0) && (
            <Card className="glass p-6 space-y-4 border border-destructive/20">
              <h2 className="font-semibold flex items-center gap-2 text-destructive">
                <AlertTriangle className="size-4" /> Padrões a evitar
              </h2>
              {data.variationFailures.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Variações de escala sem sucesso</p>
                  {data.variationFailures.map((v) => (
                    <div key={v.variacaoId} className="text-sm p-2 rounded border border-border/40">
                      <span className="font-mono">{v.variacaoId}</span>
                      <span className="text-muted-foreground"> — {v.count} tentativa(s)</span>
                    </div>
                  ))}
                </div>
              )}
              {data.failedPatterns.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Estilos sem campeão validado</p>
                  {data.failedPatterns.map((f) => (
                    <div key={f.estilo} className="text-sm p-2 rounded border border-border/40">
                      {f.estilo.replace(/_/g, " ")} — {f.count} criativo(s), 0 performando validado
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          <Card className="glass p-6 space-y-4">
            <h2 className="font-semibold flex items-center gap-2">
              <TrendingUp className="size-4 text-success" /> Ângulos campeões (validados)
            </h2>
            {data.topAngulos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum campeão validado pela equipe ainda.{" "}
                <Link to="/app/historico" search={{ status: "Performando" }} className="text-primary-glow underline">
                  Ver Performando pendentes
                </Link>
              </p>
            ) : (
              <div className="space-y-2">
                {data.topAngulos.map((a) => (
                  <div key={a.angulo} className="flex justify-between items-center p-3 rounded-lg border border-border/40">
                    <span className="font-medium truncate pr-4">{a.angulo}</span>
                    <Badge className="bg-success/20 text-success border-success/40 shrink-0">
                      {a.performando} validado(s) / {a.total} total
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {data.micropersonasEvitar.length > 0 && (
            <Card className="glass p-6 space-y-3">
              <h2 className="font-semibold">Micropersonas que a IA não vai repetir</h2>
              <div className="flex flex-wrap gap-2">
                {data.micropersonasEvitar.map((mp) => (
                  <Badge key={mp} variant="outline" className="text-xs">{mp}</Badge>
                ))}
              </div>
            </Card>
          )}

          <Card className="glass p-6 space-y-4">
            <h2 className="font-semibold">Resultados recentes (validados)</h2>
            {data.resultadosRecentes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum resultado validado ainda.</p>
            ) : (
              <div className="space-y-2">
                {data.resultadosRecentes.map((r, i) => (
                  <div key={i} className="flex flex-wrap justify-between gap-2 p-3 rounded-lg bg-background/30 text-sm">
                    <span className="font-medium">{r.angulo}</span>
                    <span className="text-muted-foreground">
                      {r.tipo}
                      {r.metrica && r.valor ? ` · ${r.metrica}: ${r.valor}` : ""}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {format(new Date(r.created_at), "dd/MM/yy", { locale: ptBR })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="glass border-primary/30 p-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-medium">{data.nextAction.label}</p>
              <p className="text-sm text-muted-foreground mt-1">{data.nextAction.description}</p>
              <p className="text-xs text-muted-foreground mt-2">
                Formatos testados: {data.formatosTestados.join(", ") || "nenhum"} · {resumo?.exportados ?? 0} exportados
              </p>
            </div>
            <Link
              to={data.nextAction.to}
              search={"search" in data.nextAction ? data.nextAction.search : undefined}
            >
              <Button className="bg-gradient-primary border-0">
                Próximo passo <ArrowRight className="size-4 ml-1.5" />
              </Button>
            </Link>
          </Card>
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: "success" | "accent";
}) {
  const Icon = accent === "success" ? TrendingUp : accent === "accent" ? TrendingDown : BarChart3;
  return (
    <Card className="glass p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className={`size-4 ${accent === "success" ? "text-success" : "text-primary-glow"}`} />
      </div>
      <div className="text-3xl font-display font-bold">{value}</div>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </Card>
  );
}
