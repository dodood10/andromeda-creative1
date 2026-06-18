import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Film, Loader2, TrendingUp, Download, Upload } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getVslDashboardStats } from "@/lib/criativos.functions";
import { useWorkspace } from "@/contexts/workspace-context";

export const Route = createFileRoute("/app/vsl/")({
  component: VslCockpit,
});

function VslCockpit() {
  const { projectId } = useWorkspace();
  const fetchStats = useServerFn(getVslDashboardStats);

  const { data: stats, isLoading } = useQuery({
    queryKey: ["vsl-dashboard-stats", projectId],
    queryFn: () => fetchStats({ data: { projectId: projectId! } }),
    enabled: !!projectId,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-8 animate-spin text-primary-glow" />
      </div>
    );
  }

  const next = stats?.nextAction;

  return (
    <div className="space-y-6">
      <Card className="glass p-6 bg-gradient-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Próximo passo</p>
            <p className="text-lg font-semibold mt-1">{next?.label ?? "Gerar sua primeira VSL"}</p>
            <p className="text-sm text-muted-foreground mt-2">
              {stats?.total === 0
                ? "Briefing → ângulos → roteiro VSL completo com hook visual, objeções e CTA."
                : stats?.semExport
                  ? `${stats.semExport} VSL(s) aguardando export no editor.`
                  : stats?.performando
                    ? `${stats.performando} VSL(s) performando — prontas para escala.`
                    : `${stats?.total ?? 0} VSL(s) no projeto · ${stats?.exportados ?? 0} exportada(s).`}
            </p>
          </div>
          {next && (
            <Link to={next.to} search={next.search}>
              <Button className="bg-gradient-primary border-0">
                Continuar <ArrowRight className="size-4 ml-2" />
              </Button>
            </Link>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total VSLs" value={stats?.total ?? 0} />
        <StatCard label="Exportadas" value={stats?.exportados ?? 0} />
        <StatCard label="Pendentes export" value={stats?.semExport ?? 0} highlight={!!stats?.semExport} />
        <StatCard label="Performando" value={stats?.performando ?? 0} highlight={!!stats?.performando} />
      </div>

      {(stats?.showCsvReminder) && (
        <Card className="glass p-4 border border-primary/30 bg-primary/5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Upload className="size-5 text-primary-glow shrink-0" />
            <div>
              <p className="font-medium text-sm">Importe métricas das VSLs</p>
              <p className="text-xs text-muted-foreground">
                VSL exportada há 3+ dias sem CSV — cole o relatório do Ads Manager com utm_content.
              </p>
            </div>
          </div>
          <Link to="/app/historico" search={{ formato: "vsl_curta" }}>
            <Button size="sm" className="bg-gradient-primary border-0">Importar CSV</Button>
          </Link>
        </Card>
      )}

      {(stats?.semExport ?? 0) > 0 && stats?.firstExportPendingId && (
        <Card className="glass p-4 border border-warning/30 bg-warning/5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Download className="size-5 text-warning shrink-0" />
            <div>
              <p className="font-medium text-sm">{stats.semExport} VSL(s) sem export</p>
              <p className="text-xs text-muted-foreground">Abra o editor, gere áudio e exporte o MP4.</p>
            </div>
          </div>
          <Link to="/app/vsl/editor" search={{ criativoId: stats.firstExportPendingId, focus: "audio" }}>
            <Button size="sm" variant="outline">Exportar agora</Button>
          </Link>
        </Card>
      )}

      {(stats?.performando ?? 0) > 0 && stats?.firstPerformandoId && (
        <Card className="glass p-4 border border-success/30 bg-success/5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <TrendingUp className="size-5 text-success shrink-0" />
            <div>
              <p className="font-medium text-sm">Escalar campeão VSL</p>
              <p className="text-xs text-muted-foreground">Gere variações de hook, avatar e CTA a partir do que performa.</p>
            </div>
          </div>
          <Link to="/app/escala" search={{ criativoId: stats.firstPerformandoId }}>
            <Button size="sm" className="bg-gradient-primary border-0">Abrir escala</Button>
          </Link>
        </Card>
      )}

      {(stats?.feed?.length ?? 0) > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Feed VSL</h2>
          {stats!.feed.map((item, i) => (
            <Card key={i} className="glass p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <Badge variant="outline" className="text-[10px] mb-2">{item.tag}</Badge>
                <p className="font-medium">{item.title}</p>
                <p className="text-sm text-muted-foreground mt-1">{item.desc}</p>
              </div>
              <Link to={item.action.to} search={item.action.search}>
                <Button size="sm" variant="outline">Abrir</Button>
              </Link>
            </Card>
          ))}
        </div>
      )}

      <Card className="glass p-6 flex items-center gap-4">
        <Film className="size-10 text-primary-glow shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-medium">Inteligência compartilhada</p>
          <p className="text-sm text-muted-foreground">
            Campeões VSL e criativos curtos ficam no mesmo projeto — use Inteligência e Escala no menu principal.
          </p>
        </div>
        <Link to="/app/inteligencia">
          <Button variant="outline" size="sm">Inteligência</Button>
        </Link>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <Card className={`glass p-4 ${highlight ? "border-primary/40" : ""}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-display font-bold mt-1">{value}</p>
    </Card>
  );
}
