import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, BarChart3 } from "lucide-react";
import type { FormatoIntelSegment } from "@/lib/intel-formato-segment";

export function FormatoIntelPanel({
  segment,
  label,
}: {
  segment: FormatoIntelSegment;
  label: string;
}) {
  if (segment.total === 0) {
    return (
      <Card className="glass p-6 text-sm text-muted-foreground">
        Nenhum criativo <strong className="text-foreground">{label}</strong> neste projeto ainda.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MiniStat label="Total" value={segment.total} />
        <MiniStat label="Performando" value={segment.performando} accent="success" />
        <MiniStat
          label="Hook rate (IA)"
          value={segment.hookRateMedioEstimado != null ? `${segment.hookRateMedioEstimado}%` : "—"}
        />
        {segment.formato === "vsl_curta" ? (
          <>
            <MiniStat
              label="Hold 30s (IA)"
              value={segment.holdRateMedioEstimado != null ? `${segment.holdRateMedioEstimado}%` : "—"}
            />
            <MiniStat
              label="Conclusão (IA)"
              value={segment.taxaConclusaoMedia != null ? `${segment.taxaConclusaoMedia}%` : "—"}
            />
          </>
        ) : (
          <MiniStat label="Exportados" value={segment.exportados} />
        )}
      </div>

      <Card className="glass p-5 space-y-3">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <BarChart3 className="size-4 text-primary-glow" /> Feedback negativo esperado
        </h3>
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline">Baixo: {segment.feedbackDistribuicao.baixo}</Badge>
          <Badge variant="outline">Médio: {segment.feedbackDistribuicao.medio}</Badge>
          <Badge variant="outline">Alto: {segment.feedbackDistribuicao.alto}</Badge>
        </div>
      </Card>

      {segment.topAngulos.length > 0 && (
        <Card className="glass p-5 space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <TrendingUp className="size-4 text-success" /> Campeões {label}
          </h3>
          <div className="space-y-2">
            {segment.topAngulos.map((a) => (
              <div
                key={a.angulo}
                className="flex justify-between items-center p-2 rounded border border-border/40 text-sm"
              >
                <span className="truncate pr-4">{a.angulo}</span>
                <Badge className="bg-success/20 text-success border-success/40 shrink-0">
                  {a.performando} / {a.total}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function MiniStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: "success";
}) {
  return (
    <Card className="glass p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-2xl font-display font-bold ${accent === "success" ? "text-success" : ""}`}>
        {value}
      </p>
    </Card>
  );
}
