import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, AlertTriangle, Sparkles, ArrowRight, Flame, Eye, Zap, Loader2, Brain, Upload } from "lucide-react";
import { getDashboardStats } from "@/lib/criativos.functions";
import { getPlanUsage } from "@/lib/plan.functions";
import { getNicheDailyIntel } from "@/lib/niche-intel.functions";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/contexts/workspace-context";
import type { AppLink } from "@/lib/app-links";
import { ActivationChecklist } from "@/components/activation-checklist";
import { UpgradeBanner } from "@/components/upgrade-banner";
import { ContinueWizardBanner } from "@/components/continue-wizard-banner";
import { EscalaLineageCard } from "@/components/escala-lineage-card";

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

const STATUS_LINKS: Record<string, AppLink> = {
  Gerado: { to: "/app/historico", search: { status: "Gerado" } },
  Subiu: { to: "/app/historico", search: { status: "Subiu" } },
  Rodando: { to: "/app/historico", search: { status: "Rodando" } },
  Performando: { to: "/app/historico", search: { status: "Performando" } },
};

function greetingForHour() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function Dashboard() {
  const { profile } = useAuth();
  const { projectId, currentProject, organizationId, loading: wsLoading } = useWorkspace();
  const fetchStats = useServerFn(getDashboardStats);
  const fetchPlanUsage = useServerFn(getPlanUsage);
  const fetchNicheIntel = useServerFn(getNicheDailyIntel);

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats", projectId],
    queryFn: () => fetchStats({ data: { projectId: projectId! } }),
    enabled: !!projectId,
  });

  const { data: planUsage } = useQuery({
    queryKey: ["plan-usage", organizationId],
    queryFn: () => fetchPlanUsage({ data: { organizationId: organizationId! } }),
    enabled: !!organizationId,
    staleTime: 60_000,
  });

  const nichoRaw = currentProject?.nicho ?? profile?.nicho ?? "";
  const { data: nicheIntel } = useQuery({
    queryKey: ["niche-daily-intel", nichoRaw],
    queryFn: () => fetchNicheIntel({ data: { nicho: nichoRaw } }),
    enabled: nichoRaw.length > 2,
    staleTime: 6 * 60 * 60 * 1000,
  });

  const hoje = format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: ptBR });
  const nome = profile?.display_name ?? "criador";
  const nicho = currentProject?.nicho ?? profile?.nicho ?? "Seu nicho";

  const statusCols = stats
    ? (["Gerado", "Subiu", "Rodando", "Performando"] as const).map((key) => ({
        title: STATUS_LABELS[key],
        count: stats.counts[key],
        color: STATUS_COLORS[key],
        link: STATUS_LINKS[key],
      }))
    : [];

  const volumeTarget = stats?.volumeTarget ?? 12;
  const volumeAtual = stats?.ativos ?? 0;
  const volumePct = Math.min(100, Math.round((volumeAtual / volumeTarget) * 100));

  const feedItems = stats?.feed ?? [];
  const nextAction = stats?.nextAction;
  const [calibrationDismissed, setCalibrationDismissed] = useState(false);

  const calibrationAckKey =
    projectId && stats?.calibrationNotice?.calibratedAt
      ? `andromeda_calib_ack_${projectId}`
      : null;

  useEffect(() => {
    if (!calibrationAckKey || !stats?.calibrationNotice?.calibratedAt) {
      setCalibrationDismissed(false);
      return;
    }
    const acked = localStorage.getItem(calibrationAckKey);
    setCalibrationDismissed(acked === stats.calibrationNotice.calibratedAt);
  }, [calibrationAckKey, stats?.calibrationNotice?.calibratedAt]);

  function dismissCalibrationBanner() {
    if (calibrationAckKey && stats?.calibrationNotice?.calibratedAt) {
      localStorage.setItem(calibrationAckKey, stats.calibrationNotice.calibratedAt);
    }
    setCalibrationDismissed(true);
  }

  const showCalibrationBanner =
    !calibrationDismissed &&
    stats?.calibrationNotice &&
    stats.exportados > 0;

  const [csvReminderDismissed, setCsvReminderDismissed] = useState(false);
  const csvReminderKey = projectId ? `andromeda_csv_reminder_${projectId}` : null;

  useEffect(() => {
    if (!csvReminderKey) return;
    setCsvReminderDismissed(localStorage.getItem(csvReminderKey) === "1");
  }, [csvReminderKey, stats?.showCsvReminder]);

  function dismissCsvReminder() {
    if (csvReminderKey) localStorage.setItem(csvReminderKey, "1");
    setCsvReminderDismissed(true);
  }

  const activationSteps = stats
    ? [
        {
          id: "angulos",
          label: "Gerar seus primeiros 5 ângulos",
          done: (stats.geracoesCount ?? 0) > 0,
          action: { to: "/app/gerador" as const, label: "Ir ao gerador" },
        },
        {
          id: "rascunho",
          label: "Criar um rascunho no editor",
          done: stats.total > 0,
          action:
            stats.firstExportPendingId || stats.firstCriativoId
              ? {
                  to: "/app/editor" as const,
                  search: {
                    criativoId: (stats.firstExportPendingId ?? stats.firstCriativoId)!,
                    focus: "audio" as const,
                  },
                  label: "Abrir editor",
                }
              : { to: "/app/gerador" as const, label: "Criar rascunho" },
        },
        {
          id: "export",
          label: "Exportar seu primeiro MP4",
          done: (stats.exportados ?? 0) > 0,
          action: stats.firstExportPendingId
            ? { to: "/app/editor" as const, search: { criativoId: stats.firstExportPendingId }, label: "Exportar agora" }
            : { to: "/app/historico" as const, search: { export: "pendente" as const }, label: "Ver pendentes" },
        },
        {
          id: "subiu",
          label: "Marcar criativo como Subiu no pipeline",
          done: stats.marcouSubiu ?? false,
          action: { to: "/app/historico" as const, label: "Abrir pipeline" },
        },
        {
          id: "csv",
          label: "Importar CSV do Meta (recomendado)",
          done: stats.temCsvImport ?? false,
          action: { to: "/app/historico" as const, label: "Importar CSV" },
        },
      ].filter((step) => step.id !== "csv" || (stats.exportados ?? 0) > 0)
    : [];

  return (
    <div className="container mx-auto px-4 md:px-6 py-8 max-w-7xl space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">{greetingForHour()}, {nome}</h1>
          <p className="text-muted-foreground mt-1">
            Nicho: <span className="text-foreground">{nicho}</span> · {hoje}
          </p>
        </div>
        <Link to="/app/gerador">
          <Button className="w-full sm:w-auto min-h-11 bg-gradient-primary shadow-glow border-0">
            <Sparkles className="size-4 mr-1.5" /> Gerar criativo
          </Button>
        </Link>
      </div>

      {nextAction && (
        <Card className="glass bg-gradient-card border-primary/30 p-6 shadow-glow">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-4">
              <div className="size-12 rounded-xl bg-gradient-primary flex items-center justify-center shrink-0">
                <Zap className="size-6 text-primary-foreground" />
              </div>
              <div>
                <Badge className="bg-primary/20 text-primary-glow border-0 mb-2">Próxima ação</Badge>
                <h2 className="font-display text-xl font-semibold">{nextAction.label}</h2>
                <p className="text-muted-foreground mt-1 text-sm max-w-xl">
                  {stats?.sugestao ?? "Uma ação clara por vez acelera o retorno no Meta."}
                </p>
              </div>
            </div>
            <Link to={nextAction.to} search={nextAction.search}>
              <Button className="bg-gradient-primary border-0">
                Fazer agora <ArrowRight className="size-4 ml-1.5" />
              </Button>
            </Link>
          </div>
        </Card>
      )}

      {showCalibrationBanner && stats?.calibrationNotice && (
        <Card className="glass p-4 border border-success/30 bg-success/5 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm space-y-1">
            <p>
              <strong>Dados validados</strong>
              {stats.calibrationNotice.samples > 0 && (
                <>
                  {" "}— hook rate calibrado com {stats.calibrationNotice.samples} resultado(s) reais
                  {stats.calibrationNotice.hookBiasPp != null
                    ? ` (ajuste ${stats.calibrationNotice.hookBiasPp > 0 ? "+" : ""}${stats.calibrationNotice.hookBiasPp} pp)`
                    : ""}
                </>
              )}
              {(stats.calibrationNotice.cpaMedio != null || stats.calibrationNotice.roasMedio != null) && (
                <>
                  {stats.calibrationNotice.samples > 0 ? " · " : " — "}
                  {stats.calibrationNotice.cpaMedio != null && `CPA médio R$ ${stats.calibrationNotice.cpaMedio.toFixed(2)}`}
                  {stats.calibrationNotice.cpaMedio != null && stats.calibrationNotice.roasMedio != null && " · "}
                  {stats.calibrationNotice.roasMedio != null && `ROAS ${stats.calibrationNotice.roasMedio.toFixed(2)}`}
                </>
              )}
              . A próxima geração já usa essa calibração.
            </p>
            {stats.calibrationNotice.conversionNotes && (
              <p className="text-xs text-muted-foreground">{stats.calibrationNotice.conversionNotes}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Link to="/app/gerador">
              <Button size="sm" className="bg-gradient-primary border-0">Gerar com calibração</Button>
            </Link>
            <Button size="sm" variant="ghost" onClick={dismissCalibrationBanner}>
              Ok
            </Button>
          </div>
        </Card>
      )}

      {stats?.showCsvReminder && !csvReminderDismissed && (
        <Card className="glass p-4 border border-primary/30 bg-primary/5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm flex items-center gap-2">
            <Upload className="size-4 text-primary-glow shrink-0" />
            Criativos no ar há 3+ dias — importe o CSV do Meta com coluna{" "}
            <code className="text-xs font-mono bg-muted px-1 rounded">utm_content</code>{" "}
            para calibrar hook rate e CPA automaticamente.
          </p>
          <div className="flex gap-2">
            <Link to="/app/historico">
              <Button size="sm" className="bg-gradient-primary border-0">Importar CSV</Button>
            </Link>
            <Button size="sm" variant="ghost" onClick={dismissCsvReminder}>
              Depois
            </Button>
          </div>
        </Card>
      )}

      {planUsage && !planUsage.canGerar && (
        <UpgradeBanner message="Você atingiu o limite de gerações do plano grátis este mês." upgradeTo="/app/plano" />
      )}

      <ContinueWizardBanner />

      {stats?.exportSubiuReminderId && stats.exportSubiuReminderId !== stats.staleExportReminderId && (
        <Card className="glass p-4 border border-primary/30 bg-primary/5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm flex items-center gap-2">
            <Sparkles className="size-4 text-primary-glow shrink-0" />
            Export pronto — marque como <strong>Subiu</strong> após subir no Meta para avançar no pipeline.
          </p>
          <Link to="/app/historico" search={{ criativoId: stats.exportSubiuReminderId }}>
            <Button size="sm" className="bg-gradient-primary border-0">Marcar Subiu</Button>
          </Link>
        </Card>
      )}

      {stats?.rodandoMetricsReminderCount ? (
        <Card className="glass p-4 border border-accent/30 bg-accent/5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm flex items-center gap-2">
            <AlertTriangle className="size-4 text-accent shrink-0" />
            {stats.rodandoMetricsReminderCount} criativo(s) em <strong>Rodando</strong> há 7+ dias sem métricas — reporte CPA/ROAS para calibrar a IA.
          </p>
          <Link to="/app/historico" search={{ status: "Rodando" }}>
            <Button size="sm" variant="outline">Reportar métricas</Button>
          </Link>
        </Card>
      ) : null}

      {stats?.staleExportReminderId && (
        <Card className="glass p-4 border border-warning/40 bg-warning/10 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm flex items-center gap-2">
            <AlertTriangle className="size-4 text-warning shrink-0" />
            Export pronto há mais de 48h — marque como Subiu após subir no Meta.
          </p>
          <Link to="/app/historico" search={{ criativoId: stats.staleExportReminderId }}>
            <Button size="sm" variant="outline">Marcar agora</Button>
          </Link>
        </Card>
      )}

      {stats?.firstPerformandoId && (
        <Card className="glass p-4 border border-success/30 bg-success/5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm flex items-center gap-2">
            <TrendingUp className="size-4 text-success shrink-0" />
            Você tem um criativo performando — gere variações para escalar.
          </p>
          <Link to="/app/escala" search={{ criativoId: stats.firstPerformandoId }}>
            <Button size="sm" className="bg-gradient-primary border-0">Ir para escala</Button>
          </Link>
        </Card>
      )}

      {stats?.escalaLineage && stats.escalaLineage.length > 0 && (
        <EscalaLineageCard lineage={stats.escalaLineage} />
      )}

      {stats && activationSteps.length > 0 && <ActivationChecklist steps={activationSteps} />}

      {stats?.total === 0 && !isLoading && (
        <Card className="glass p-8 text-center space-y-4 border border-primary/20">
          <h2 className="font-display text-xl font-semibold">Bem-vindo ao Andromeda</h2>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Em 3 passos você terá ângulos, rascunho e export. Comece pelo gerador com a URL do seu produto.
          </p>
          <Link to="/app/gerador">
            <Button className="min-h-11 bg-gradient-primary border-0">Gerar meus primeiros 5 ângulos</Button>
          </Link>
        </Card>
      )}

      <div>
        <h2 className="font-display text-xl font-semibold mb-1">Feed de ações e inteligência</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Ações do seu projeto + panorama diário do nicho {nicho !== "Seu nicho" ? `(${nicho})` : ""}.
        </p>

        {(nicheIntel?.insights?.length ?? 0) > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {nicheIntel!.insights.map((item) => (
              <Card key={item.title} className="glass bg-gradient-card p-5 border border-primary/20">
                <div className="flex items-center justify-between mb-3">
                  <div className="size-9 rounded-lg bg-primary/15 flex items-center justify-center">
                    <Brain className="size-4 text-primary-glow" />
                  </div>
                  <Badge variant="outline" className="text-[10px] uppercase">{item.tag}</Badge>
                </div>
                <h3 className="font-semibold leading-snug">{item.title}</h3>
                <p className="text-sm text-muted-foreground mt-1.5">{item.desc}</p>
              </Card>
            ))}
          </div>
        )}

        {stats?.nicheComparison && stats.nicheComparison.lines.length > 0 && (
          <Card className="glass p-5 border border-primary/20 mb-6">
            <h3 className="font-semibold text-sm mb-3">
              Seu projeto vs. nicho ({stats.nicheComparison.nicho})
            </h3>
            <div className="grid gap-3 sm:grid-cols-3">
              {stats.nicheComparison.lines.map((line) => (
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
                    Você: {line.project} · Nicho: {line.niche}
                  </p>
                  <p className="text-xs mt-2">{line.hint}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {feedItems.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {feedItems.map((item, i) => {
            const Icon = FEED_ICONS[i % FEED_ICONS.length];
            return (
              <Link key={item.title} to={item.action.to} search={item.action.search}>
                <Card className="glass bg-gradient-card p-5 hover:border-primary/40 transition cursor-pointer h-full">
                  <div className="flex items-center justify-between mb-3">
                    <div className="size-9 rounded-lg bg-primary/15 flex items-center justify-center">
                      <Icon className="size-4 text-primary-glow" />
                    </div>
                    <Badge variant="outline" className="text-[10px] uppercase">{item.tag}</Badge>
                  </div>
                  <h3 className="font-semibold leading-snug">{item.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1.5">{item.desc}</p>
                  <span className="text-xs text-primary-glow mt-3 inline-flex items-center gap-1">
                    Ver detalhes <ArrowRight className="size-3" />
                  </span>
                </Card>
              </Link>
            );
          })}
        </div>
        )}
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
              <Link key={c.title} to={c.link.to} search={c.link.search}>
                <Card className="glass p-5 hover:border-primary/40 transition cursor-pointer">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{c.title}</span>
                    <div className={`size-2 rounded-full ${c.color}`} />
                  </div>
                  <div className="text-3xl font-display font-bold mt-2">{c.count}</div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {volumeAtual < volumeTarget ? (
          <Link to="/app/gerador">
            <Card className="glass bg-gradient-card p-6 hover:border-primary/40 transition cursor-pointer h-full">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold flex items-center gap-2">
                  <Zap className="size-4 text-primary-glow" /> Volume recomendado
                </h3>
                <p className="text-sm text-muted-foreground mt-1">Meta de criativos ativos no projeto</p>
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
          </Link>
        ) : (
          <Link to="/app/historico">
            <Card className="glass bg-gradient-card p-6 hover:border-primary/40 transition cursor-pointer h-full">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold flex items-center gap-2">
                    <Zap className="size-4 text-primary-glow" /> Volume recomendado
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">Meta de criativos ativos no projeto</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-display font-bold">
                    {volumeAtual} / {volumeTarget}
                  </div>
                  <div className="text-xs text-muted-foreground">criativos ativos</div>
                </div>
              </div>
              <Progress value={volumePct} className="h-2" />
              <p className="text-xs text-muted-foreground mt-3">Volume ideal atingido para esta fase.</p>
            </Card>
          </Link>
        )}

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
              <TrendingUp className="size-3.5 mr-1.5" /> Ver inteligência do nicho
            </Button>
          </Link>
        </Card>
      </div>

      {(stats?.semExport ?? 0) > 0 && (
        <Card className="glass border-primary/30 p-4 flex items-center justify-between flex-wrap gap-3">
          <p className="text-sm">
            <span className="font-semibold">{stats?.semExport}</span> criativo(s) aguardando export no editor.
          </p>
          <Link
            to={stats?.firstExportPendingId ? "/app/editor" : "/app/historico"}
            search={stats?.firstExportPendingId ? { criativoId: stats.firstExportPendingId } : { export: "pendente" }}
          >
            <Button size="sm" variant="outline">
              Exportar agora <ArrowRight className="size-3.5 ml-1" />
            </Button>
          </Link>
        </Card>
      )}
    </div>
  );
}
