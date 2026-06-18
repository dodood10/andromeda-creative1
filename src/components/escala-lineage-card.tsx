import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GitBranch, TrendingUp, ArrowRight } from "lucide-react";
import type { EscalaCampeaoLineage } from "@/lib/escala-lineage";

const VAR_LABELS: Record<string, string> = {
  "hook-v": "Hook visual",
  "hook-t": "Hook textual",
  avatar: "Avatar",
  formato: "Formato",
  empilha: "Empilha",
  benef: "Benefícios",
  cta: "CTA",
};

export function EscalaLineageCard({ lineage }: { lineage: EscalaCampeaoLineage[] }) {
  if (!lineage.length) return null;

  const totalVariacoes = lineage.reduce((n, l) => n + l.variacoes.length, 0);

  return (
    <Card className="glass p-6 space-y-4 border border-accent/30">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-xl font-semibold flex items-center gap-2">
            <GitBranch className="size-5 text-accent" /> Linhagem de escala
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {lineage.length} campeão(ões) · {totalVariacoes} variação(ões) gerada(s) a partir deles
          </p>
        </div>
        <Link to="/app/escala">
          <Button variant="outline" size="sm">
            Abrir escala <ArrowRight className="size-3.5 ml-1" />
          </Button>
        </Link>
      </div>

      <div className="space-y-4">
        {lineage.slice(0, 3).map((row) => (
          <div key={row.campeaoId} className="rounded-lg border border-border/50 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <TrendingUp className="size-4 text-success shrink-0" />
                <span className="font-medium truncate">{row.campeaoAngulo}</span>
                <Badge variant="outline" className="text-[10px] shrink-0">
                  {row.campeaoStatus}
                </Badge>
              </div>
              <Link to="/app/escala" search={{ criativoId: row.campeaoId }}>
                <Button size="sm" variant="ghost" className="h-7 text-xs">
                  Ver campeão
                </Button>
              </Link>
            </div>
            <div className="space-y-2 pl-6 border-l-2 border-accent/30">
              {row.variacoes.map((v) => (
                <div
                  key={v.id}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm"
                >
                  <div className="min-w-0">
                    <span className="font-mono text-xs text-accent">
                      {VAR_LABELS[v.variacaoId] ?? v.variacaoId}
                    </span>
                    {v.diff && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{v.diff}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="text-[10px]">
                      {v.exportStatus === "pronto" ? "exportado" : v.status}
                    </Badge>
                    <Link to="/app/editor" search={{ criativoId: v.id }}>
                      <Button size="sm" variant="link" className="h-auto p-0 text-xs">
                        Editor →
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
