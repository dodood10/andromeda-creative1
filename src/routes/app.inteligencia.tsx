import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Brain, TrendingUp, TrendingDown } from "lucide-react";

export const Route = createFileRoute("/app/inteligencia")({
  head: () => ({
    meta: [
      { title: "Inteligência de nicho · Andromeda" },
      { name: "description", content: "Benchmarks de hook rate, hold rate, CPM e CTR por nicho." },
    ],
  }),
  component: Inteligencia,
});

const benchmarks = [
  { l: "Hook rate médio", v: "4.8%", delta: "+0.6", up: true },
  { l: "Hold rate 15s", v: "32%", delta: "+2.1", up: true },
  { l: "CPM médio", v: "R$ 18,40", delta: "-1.20", up: true },
  { l: "CTR médio", v: "1.9%", delta: "-0.1", up: false },
];

const padroes = [
  { tipo: "E-commerce físico", obj: "Conversão", ang: "Antes/depois + prova social", perf: "Alto" },
  { tipo: "Infoproduto", obj: "Leads", ang: "Objeção invertida + mecanismo", perf: "Alto" },
  { tipo: "SaaS", obj: "Tráfego", ang: "Demonstração + benefício específico", perf: "Médio" },
  { tipo: "Alto ticket", obj: "Leads", ang: "Autoridade + caso de cliente", perf: "Alto" },
  { tipo: "Saúde e bem-estar", obj: "Conversão", ang: "Dor aguda + mecanismo único", perf: "Alto" },
];

const trend = [40, 55, 48, 62, 58, 70, 75, 68, 82, 78, 88, 95];

function Inteligencia() {
  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold flex items-center gap-3">
            <Brain className="size-7 text-primary-glow" /> Inteligência de nicho
          </h1>
          <p className="text-muted-foreground mt-1">Benchmarks e padrões emergentes atualizados em tempo real.</p>
        </div>
        <Select defaultValue="saude">
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="saude">Saúde e bem-estar</SelectItem>
            <SelectItem value="info">Infoproduto</SelectItem>
            <SelectItem value="ecom">E-commerce físico</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {benchmarks.map((b) => (
          <Card key={b.l} className="glass bg-gradient-card p-5">
            <div className="text-sm text-muted-foreground">{b.l}</div>
            <div className="text-3xl font-display font-bold mt-2">{b.v}</div>
            <div className={`flex items-center gap-1 text-xs mt-2 ${b.up ? "text-success" : "text-destructive"}`}>
              {b.up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
              {b.delta} esta semana
            </div>
          </Card>
        ))}
      </div>

      <Card className="glass bg-gradient-card p-6">
        <h2 className="font-display text-lg font-semibold mb-1">Tendência de hook rate · últimos 12 meses</h2>
        <p className="text-sm text-muted-foreground mb-4">Saúde e bem-estar · Reels 9:16</p>
        <div className="h-48 flex items-end gap-2">
          {trend.map((v, i) => (
            <div key={i} className="flex-1 bg-gradient-to-t from-primary/60 to-accent/60 rounded-t" style={{ height: `${v}%` }} />
          ))}
        </div>
      </Card>

      <Card className="glass bg-gradient-card p-6">
        <h2 className="font-display text-lg font-semibold mb-4">Padrões de ângulo por tipo de produto</h2>
        <div className="space-y-2">
          {padroes.map((p, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-background/40 border border-border/40">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="border-primary/30">{p.tipo}</Badge>
                <span className="text-xs text-muted-foreground">→ {p.obj}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span>{p.ang}</span>
                <Badge className={p.perf === "Alto" ? "bg-success/20 text-success border-success/40" : "bg-warning/20 text-warning border-warning/40"} variant="outline">{p.perf}</Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
