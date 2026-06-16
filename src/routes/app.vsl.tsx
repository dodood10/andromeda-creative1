import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Film, Download } from "lucide-react";

export const Route = createFileRoute("/app/vsl")({
  head: () => ({
    meta: [
      { title: "VSL curta · Andromeda" },
      { name: "description", content: "Roteiro de 2 minutos em 6 blocos fixos: hook duplo até CTA com valor." },
    ],
  }),
  component: VSL,
});

const blocos = [
  { t: "0-15s", nome: "Hook duplo", color: "bg-primary/70", txt: "Padrão visual quebra + promessa específica nos primeiros 3 segundos." },
  { t: "15-30s", nome: "Agitação da dor", color: "bg-accent/70", txt: "Cenário concreto da dor. Específico, não genérico." },
  { t: "30-60s", nome: "Mecanismo único", color: "bg-primary/60", txt: "Apresentação do mecanismo que torna a solução possível." },
  { t: "60-90s", nome: "Prova e credibilidade", color: "bg-success/60", txt: "Resultados, depoimentos e provas específicas." },
  { t: "90-110s", nome: "Quebra de objeções", color: "bg-warning/60", txt: "Endereça as 3 maiores objeções de cabeça." },
  { t: "110-120s", nome: "CTA com valor", color: "bg-accent/80", txt: "Oferta + bônus + garantia + urgência real." },
];

function VSL() {
  return (
    <div className="container mx-auto px-6 py-8 max-w-6xl space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold flex items-center gap-3">
            <Film className="size-7 text-primary-glow" /> VSL curta
          </h1>
          <p className="text-muted-foreground mt-1">2 minutos · 6 blocos fixos · sugerida para infoproduto e alto ticket</p>
        </div>
        <Button className="bg-gradient-primary border-0 shadow-glow">
          <Download className="size-4 mr-1.5" /> Exportar VSL
        </Button>
      </div>

      {/* Timeline */}
      <Card className="glass bg-gradient-card p-5">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Timeline de 6 blocos</div>
        <div className="flex gap-1 h-14">
          {blocos.map((b) => (
            <div
              key={b.nome}
              className={`${b.color} rounded flex flex-col justify-center px-3 text-xs text-primary-foreground`}
              style={{ flex: b.t === "30-60s" || b.t === "60-90s" ? 2 : 1 }}
            >
              <div className="font-mono opacity-80">{b.t}</div>
              <div className="font-semibold truncate">{b.nome}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Preview + roteiro */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="glass bg-gradient-card p-5 lg:col-span-1">
          <div className="aspect-[9/16] rounded-xl bg-gradient-to-br from-primary/30 via-background to-accent/20 border border-border flex items-center justify-center">
            <div className="text-center text-muted-foreground text-sm">
              <Film className="size-10 mx-auto mb-2 opacity-50" />
              Preview da VSL
            </div>
          </div>
        </Card>

        <div className="lg:col-span-2 space-y-3">
          {blocos.map((b, i) => (
            <Card key={i} className="glass p-5">
              <div className="flex items-center gap-3 mb-2">
                <Badge variant="outline" className="font-mono text-primary-glow border-primary/40">{b.t}</Badge>
                <h3 className="font-semibold">{b.nome}</h3>
              </div>
              <p className="text-sm text-muted-foreground">{b.txt}</p>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
