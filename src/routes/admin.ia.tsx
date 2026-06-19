import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Zap } from "lucide-react";
import { getAdminApiUsage } from "@/lib/admin.functions";
import { AdminKpiCard } from "@/components/admin/admin-shell";
import { MiniBarChart } from "@/components/admin/mini-bar-chart";

export const Route = createFileRoute("/admin/ia")({
  head: () => ({ meta: [{ title: "Admin · IA & custos" }] }),
  component: AdminIa,
});

function AdminIa() {
  const [days, setDays] = useState("30");
  const fetchUsage = useServerFn(getAdminApiUsage);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-api-usage", days],
    queryFn: () => fetchUsage({ data: { days: Number(days) } }),
  });

  return (
    <div className="container mx-auto px-6 py-8 max-w-6xl space-y-8">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Zap className="size-6 text-primary-glow" /> IA & custos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Uso estimado de API (Anthropic, export, áudio)
          </p>
        </div>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 dias</SelectItem>
            <SelectItem value="30">30 dias</SelectItem>
            <SelectItem value="90">90 dias</SelectItem>
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
            <AdminKpiCard label="Eventos" value={data.totalEvents} />
            <AdminKpiCard label="Tokens (est.)" value={data.totalTokens.toLocaleString("pt-BR")} />
            <AdminKpiCard label="Custo IA (est.)" value={`US$ ${data.estimatedCostUsd}`} />
            <AdminKpiCard label="Erros" value={data.recentErrors.length} sub="no período" />
          </div>

          {data.videoRenders && (
            <Card className="glass p-6 space-y-4">
              <div className="flex items-end justify-between flex-wrap gap-2">
                <div>
                  <h2 className="font-semibold">Custos de vídeo</h2>
                  <p className="text-xs text-muted-foreground">
                    Estimativa baseada em TTS (ElevenLabs), provedor de vídeo e FFmpeg.
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">US$ {data.videoRenders.totalCostUsd.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">
                    {data.videoRenders.done} vídeo(s) · média US$ {data.videoRenders.avgCostUsd.toFixed(3)}
                  </p>
                </div>
              </div>

              {data.videoRenders.byProvider.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  {data.videoRenders.byProvider.map((p) => (
                    <div
                      key={p.provider}
                      className="rounded-lg border border-border/40 p-3 space-y-1"
                    >
                      <p className="font-mono text-xs">{p.provider}</p>
                      <p className="text-lg font-bold">US$ {p.cost.toFixed(2)}</p>
                      <p className="text-[11px] text-muted-foreground">{p.count} render(s)</p>
                    </div>
                  ))}
                </div>
              )}

              {data.videoRenders.recent.length > 0 && (
                <div className="space-y-1 max-h-72 overflow-auto">
                  <p className="text-xs text-muted-foreground pb-1">Últimos renders</p>
                  {data.videoRenders.recent.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between text-xs border-b border-border/20 py-1.5 last:border-0 gap-3"
                    >
                      <span className="font-mono truncate max-w-[200px]">{r.criativoId}</span>
                      <Badge
                        variant={r.status === "done" ? "outline" : r.status === "failed" ? "destructive" : "secondary"}
                        className="text-[10px]"
                      >
                        {r.status}
                      </Badge>
                      <span className="font-mono text-muted-foreground">{r.provider}</span>
                      <span className="text-muted-foreground">
                        {r.durationMs ? `${(r.durationMs / 1000).toFixed(1)}s` : "—"}
                      </span>
                      <span className="font-semibold tabular-nums w-20 text-right">
                        US$ {r.costUsd.toFixed(3)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          <Card className="glass p-6 space-y-4">
            <h2 className="font-semibold">Eventos por dia</h2>
            <MiniBarChart data={data.eventsByDay} color="bg-accent/60" />
          </Card>

          <Card className="glass p-6 space-y-4">
            <h2 className="font-semibold">Por tipo de evento</h2>
            {data.byType.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum evento registrado ainda.</p>
            ) : (
              <div className="space-y-2">
                {data.byType.map((row) => (
                  <div
                    key={row.type}
                    className="flex items-center justify-between text-sm border-b border-border/30 pb-2 last:border-0"
                  >
                    <span className="font-mono text-xs">{row.type}</span>
                    <div className="flex gap-3 items-center">
                      <span className="text-muted-foreground">{row.count}×</span>
                      <span className="text-muted-foreground">{row.tokens.toLocaleString("pt-BR")} tok</span>
                      {row.errors > 0 && (
                        <Badge variant="destructive" className="text-[10px]">{row.errors} erros</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="glass p-6 space-y-4">
            <h2 className="font-semibold">Top usuários por consumo</h2>
            {data.topUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados.</p>
            ) : (
              data.topUsers.map((u) => (
                <div key={u.userId} className="flex justify-between text-sm font-mono text-xs">
                  <span className="truncate max-w-[240px]">{u.userId}</span>
                  <span className="text-muted-foreground">{u.tokens.toLocaleString("pt-BR")} tok</span>
                </div>
              ))
            )}
          </Card>
        </>
      ) : null}
    </div>
  );
}
