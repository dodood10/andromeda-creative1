import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, AlertTriangle, Sparkles, ArrowRight, Flame, Eye, Zap, Loader2 } from "lucide-react";
import { getDashboardStats } from "@/lib/criativos.functions";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/contexts/workspace-context";

export const Route = createFileRoute("/app/")({
  head: () => ({
    meta: [
      { title: "Dashboard · Andromeda" },
      { name: "description", content: "Feed de inteligência diária e status dos criativos." },
    ],
  }),
  component: Dashboard,
});

const FEED_ICONS = [Flame, Eye, AlertTriangle] as const;

const STATUS_COLORS: Record<string, string> = {
  Gerado: "bg-muted-foreground/40",
  Subiu: "bg-primary/60",
  Rodando: "bg-accent/70",
  Performando: "bg-success/70",
  Pausado: "bg-destructive/50",
};

const STATUS_LABELS: Record<string, string> = {
  Gerado: "Gerados",
  Subiu: "Subidos",
  Rodando: "Rodando",
  Performando: "Performando",
  Pausado: "Pausados",
};

function Dashboard() {
  const { profile } = useAuth();
  const { projectId, currentProject, loading: wsLoading } = useWorkspace();
  const fetchStats = useServerFn(getDashboardStats);

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats", projectId],
    queryFn: () => fetchStats({ data: { projectId: projectId! } }),
    enabled: !!projectId,
  });

  const hoje = format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: ptBR });
  const nome = profile?.display_name ?? "criador";
  const nicho = currentProject?.nicho ?? profile?.nicho ?? "Seu nicho";

  const statusCols = stats
    ? (["Gerado", "Subiu", "Rodando", "Performando"] as const).map((key) => ({
        title: STATUS_LABELS[key],
        count: stats.counts[key],
        color: STATUS_COLORS[key],
      }))
    : [];

  const volumeTarget = 12;
  const volumeAtual = stats?.ativos ?? 0;
  const volumePct = Math.min(100, Math.round((volumeAtual / volumeTarget) * 100));

  const feedItems = stats?.feed ?? [];

  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold">Bom dia, {nome}</h1>
          <p className="text-muted-foreground mt-1">
            Nicho: <span className="text-foreground">{nicho}</span> · {hoje}
          </p>
        </div>
        <Link to="/app/gerador">
          <Button className="bg-gradient-primary shadow-glow border-0">
            <Sparkles className="size-4 mr-1.5" /> Gerar criativo
          </Button>
        </Link>
      </div>

      <Card className="glass bg-gradient-card border-primary/30 p-6 shadow-glow">
        <div className="flex items-start gap-4">
          <div className="size-12 rounded-xl bg-gradient-primary flex items-center justify-center shrink-0">
            <Sparkles className="size-6 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <Badge className="bg-primary/20 text-primary-glow border-0 mb-2">Sugestão do dia</Badge>
            <h2 className="font-display text-xl font-semibold">
              {stats?.sugestao ?? "Carregando sugestões do projeto..."}
            </h2>
            <p className="text-muted-foreground mt-2 max-w-2xl">
              {stats && stats.total === 0
                ? "O gerador cria micropersonas distintas com lógica probabilística para Meta Ads."
                : stats && stats.angulosTestados.length < 3
                  ? `Ângulos testados neste projeto: ${stats.angulosTestados.join(", ") || "nenhum ainda"}.`
                  : "Analise o histórico e escale os criativos marcados como Performando."}
            </p>
          </div>
          <Link to="/app/gerador">
            <Button className="bg-gradient-primary border-0">
              Criar agora <ArrowRight className="size-4 ml-1.5" />
            </Button>
          </Link>
        </div>
      </Card>

      <div>
        <h2 className="font-display text-xl font-semibold mb-4">Feed de inteligência diária</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {feedItems.map((item, i) => {
            const Icon = FEED_ICONS[i % FEED_ICONS.length];
            return (
              <Card key={item.title} className="glass bg-gradient-card p-5 hover:border-primary/40 transition">
                <div className="flex items-center justify-between mb-3">
                  <div className="size-9 rounded-lg bg-primary/15 flex items-center justify-center">
                    <Icon className="size-4 text-primary-glow" />
                  </div>
                  <Badge variant="outline" className="text-[10px] uppercase">{item.tag}</Badge>
                </div>
                <h3 className="font-semibold leading-snug">{item.title}</h3>
                <p className="text-sm text-muted-foreground mt-1.5">{item.desc}</p>
              </Card>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="font-display text-xl font-semibold mb-4">Status dos criativos ativos</h2>
        {wsLoading || isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-8 animate-spin text-primary-glow" />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {statusCols.map((c) => (
              <Card key={c.title} className="glass p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{c.title}</span>
                  <div className={`size-2 rounded-full ${c.color}`} />
                </div>
                <div className="text-3xl font-display font-bold mt-2">{c.count}</div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="glass bg-gradient-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                <Zap className="size-4 text-primary-glow" /> Volume recomendado
              </h3>
              <p className="text-sm text-muted-foreground mt-1">Para R$ 5.000/dia de orçamento</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-display font-bold">
                {volumeAtual} / {volumeTarget}
              </div>
              <div className="text-xs text-muted-foreground">criativos ativos</div>
            </div>
          </div>
          <Progress value={volumePct} className="h-2" />
          <p className="text-xs text-muted-foreground mt-3">
            {volumeAtual < volumeTarget
              ? `Gere mais ${volumeTarget - volumeAtual} para acelerar a fase de validação.`
              : "Volume ideal atingido para esta fase."}
          </p>
        </Card>

        <Card className="glass border-warning/30 p-6">
          <h3 className="font-semibold flex items-center gap-2">
            <AlertTriangle className="size-4 text-warning" /> Alerta de saturação
          </h3>
          <p className="text-sm text-muted-foreground mt-2">
            {stats?.saturacaoAngulo && (stats.saturacaoPct ?? 0) >= 30 ? (
              <>
                O ângulo <span className="text-foreground">"{stats.saturacaoAngulo}"</span> aparece em{" "}
                {stats.saturacaoPct}% dos criativos ativos. Diversifique para evitar fadiga.
              </>
            ) : (
              "Nenhum ângulo dominante detectado nos criativos ativos deste projeto."
            )}
          </p>
          <Link to="/app/inteligencia">
            <Button variant="outline" size="sm" className="mt-4">
              <TrendingUp className="size-3.5 mr-1.5" /> Ver alternativas
            </Button>
          </Link>
        </Card>
      </div>
    </div>
  );
}
