import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Brain, TrendingUp, TrendingDown, BarChart3, Loader2, ArrowRight } from "lucide-react";
import { getInteligenciaNicho } from "@/lib/criativos.functions";
import { useWorkspace } from "@/contexts/workspace-context";

export const Route = createFileRoute("/app/inteligencia")({
  head: () => ({
    meta: [{ title: "Inteligência de nicho · Andromeda" }],
  }),
  component: Inteligencia,
});

function Inteligencia() {
  const { projectId, currentProject, loading: wsLoading } = useWorkspace();
  const fetchIntel = useServerFn(getInteligenciaNicho);

  const { data, isLoading } = useQuery({
    queryKey: ["inteligencia", projectId],
    queryFn: () => fetchIntel({ data: { projectId: projectId! } }),
    enabled: !!projectId,
  });

  const resumo = data?.resumo;

  return (
    <div className="container mx-auto px-6 py-8 max-w-6xl space-y-8">
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
        <Link to="/app">
          <Button variant="outline">Voltar ao dashboard</Button>
        </Link>
      </div>

      {wsLoading || isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-8 animate-spin text-primary-glow" />
        </div>
      ) : !data ? (
        <Card className="glass p-8 text-center text-muted-foreground">
          Selecione um projeto para ver inteligência.
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Criativos" value={resumo?.total ?? 0} />
            <StatCard label="Performando" value={resumo?.performando ?? 0} accent="success" />
            <StatCard label="Rodando" value={resumo?.rodando ?? 0} accent="accent" />
            <StatCard
              label="Hook rate médio (est.)"
              value={resumo?.hookRateMedio != null ? `${resumo.hookRateMedio}%` : "—"}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="glass p-6 space-y-4">
              <h2 className="font-semibold flex items-center gap-2">
                <BarChart3 className="size-4 text-primary-glow" /> Métricas reportadas
              </h2>
              {data.metricasReportadas.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma métrica ainda. Marque criativos como Performando e reporte CPA/ROAS no histórico.
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
              <h2 className="font-semibold">Feedback negativo esperado (ângulos)</h2>
              <div className="grid grid-cols-3 gap-3 text-center">
                {(["baixo", "medio", "alto"] as const).map((k) => (
                  <div key={k} className="p-3 rounded-lg bg-background/40 border border-border/40">
                    <div className="text-2xl font-display font-bold">{data.feedbackDistribuicao[k]}</div>
                    <div className="text-xs text-muted-foreground capitalize">{k}</div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Distribuição dos sinais Andromeda nos ângulos gerados deste projeto.
              </p>
            </Card>
          </div>

          <Card className="glass p-6 space-y-4">
            <h2 className="font-semibold flex items-center gap-2">
              <TrendingUp className="size-4 text-success" /> Ângulos campeões
            </h2>
            {data.topAngulos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum criativo Performando ainda.{" "}
                <Link to="/app/historico" search={{ status: "Rodando" }} className="text-primary-glow underline">
                  Acompanhe os que estão rodando
                </Link>
              </p>
            ) : (
              <div className="space-y-2">
                {data.topAngulos.map((a) => (
                  <div key={a.angulo} className="flex justify-between items-center p-3 rounded-lg border border-border/40">
                    <span className="font-medium truncate pr-4">{a.angulo}</span>
                    <Badge className="bg-success/20 text-success border-success/40 shrink-0">
                      {a.performando} performando / {a.total} total
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="glass p-6 space-y-4">
            <h2 className="font-semibold">Resultados recentes</h2>
            {data.resultadosRecentes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Reporte resultados no histórico para alimentar esta visão.</p>
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
              <p className="font-medium">Próximo passo: escalar campeões</p>
              <p className="text-sm text-muted-foreground mt-1">
                Formatos testados: {data.formatosTestados.join(", ") || "nenhum"} ·{" "}
                {resumo?.exportados ?? 0} exportados
              </p>
            </div>
            <Link to="/app/historico" search={{ status: "Performando" }}>
              <Button className="bg-gradient-primary border-0">
                Ir para escala <ArrowRight className="size-4 ml-1.5" />
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
  accent,
}: {
  label: string;
  value: string | number;
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
    </Card>
  );
}
