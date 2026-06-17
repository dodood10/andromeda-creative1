import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { getAdminOverview } from "@/lib/admin.functions";
import { AdminKpiCard } from "@/components/admin/admin-shell";
import { MiniBarChart } from "@/components/admin/mini-bar-chart";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Admin · Overview" }] }),
  component: AdminOverview,
});

type Period = "today" | "7d" | "30d" | "all";

function AdminOverview() {
  const [period, setPeriod] = useState<Period>("30d");
  const fetchOverview = useServerFn(getAdminOverview);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-overview", period],
    queryFn: () => fetchOverview({ data: { period } }),
  });

  return (
    <div className="container mx-auto px-6 py-8 max-w-6xl space-y-8">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">Saúde global da plataforma Andromeda</p>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Hoje</SelectItem>
            <SelectItem value="7d">7 dias</SelectItem>
            <SelectItem value="30d">30 dias</SelectItem>
            <SelectItem value="all">Tudo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="size-8 animate-spin text-primary-glow" />
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <AdminKpiCard label="Usuários" value={data.kpis.totalUsers} sub={`+${data.kpis.newUsers} no período`} />
            <AdminKpiCard label="Gerações IA" value={data.kpis.geracoes} />
            <AdminKpiCard label="Criativos" value={data.kpis.criativos} />
            <AdminKpiCard label="Exports prontos" value={data.kpis.exportsProntos} />
            <AdminKpiCard label="Performando" value={data.kpis.performando} />
            <AdminKpiCard label="Resultados" value={data.kpis.resultados} />
            <AdminKpiCard label="Workspaces" value={data.kpis.organizations} />
          </div>

          <Card className="glass p-6 space-y-4">
            <h2 className="font-semibold">Funil de ativação</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <FunnelStep label="Geraram ângulos" value={data.funnel.usersComGeracao} />
              <FunnelStep label="Criaram rascunho" value={data.funnel.usersComCriativo} />
              <FunnelStep label="Exportaram" value={data.funnel.usersComExport} />
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              {Object.entries(data.funnel.statusCounts).map(([status, count]) => (
                <Badge key={status} variant="outline" className="text-xs">
                  {status}: {count}
                </Badge>
              ))}
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="glass p-6 space-y-3">
              <h2 className="font-semibold">Gerações por dia (14d)</h2>
              <MiniBarChart data={data.charts.geracoesPorDia} color="bg-primary/50" />
            </Card>
            <Card className="glass p-6 space-y-3">
              <h2 className="font-semibold">Exports por dia (14d)</h2>
              <MiniBarChart data={data.charts.exportsPorDia} color="bg-success/50" />
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="glass p-6 space-y-3">
              <h2 className="font-semibold">Top workspaces</h2>
              {data.topOrgs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum dado ainda.</p>
              ) : (
                data.topOrgs.map((o) => (
                  <div key={o.id} className="flex justify-between text-sm border-b border-border/30 pb-2 last:border-0">
                    <span>{o.name}</span>
                    <span className="text-muted-foreground">{o.count} criativos</span>
                  </div>
                ))
              )}
            </Card>

            <Card className="glass p-6 space-y-3">
              <h2 className="font-semibold">Erros de export recentes</h2>
              {data.exportErrors.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum erro recente.</p>
              ) : (
                data.exportErrors.map((e) => (
                  <div key={e.id} className="text-sm border-b border-border/30 pb-2 last:border-0">
                    <p className="font-medium truncate">{e.angulo}</p>
                    <p className="text-xs text-muted-foreground">{e.produto}</p>
                  </div>
                ))
              )}
            </Card>
          </div>

          <Card className="glass p-6 space-y-3">
            <h2 className="font-semibold">Cadastros recentes</h2>
            {data.recentProfiles.map((p) => (
              <div key={p.id} className="flex justify-between text-sm">
                <span className="font-mono text-xs truncate max-w-[280px]">{p.id}</span>
                <span className="text-muted-foreground text-xs">
                  {format(new Date(p.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </span>
              </div>
            ))}
          </Card>
        </>
      ) : null}
    </div>
  );
}

function FunnelStep({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-background/40 border border-border/40 p-4 text-center">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}
