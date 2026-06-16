import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, AlertTriangle, Sparkles, ArrowRight, Flame, Eye, Zap } from "lucide-react";

export const Route = createFileRoute("/app/")({
  head: () => ({
    meta: [
      { title: "Dashboard · Andromeda" },
      { name: "description", content: "Feed de inteligência diária e status dos criativos." },
    ],
  }),
  component: Dashboard,
});

const intel = [
  { icon: Flame, tag: "Escalando", title: "Hook 'pare de gastar com X' em 9:16", desc: "Hook rate 4.2× a média do nicho beleza esta semana." },
  { icon: Eye, tag: "Em alta", title: "Formato podcast 45s para infoproduto", desc: "Andromeda priorizou diversidade conversacional em out/26." },
  { icon: AlertTriangle, tag: "Saturando", title: "Antes/depois com timer cinético", desc: "Apareceu em 38% dos top ads do nicho. Evite por 7 dias." },
];

const statusCols = [
  { title: "Gerados", count: 12, color: "bg-muted-foreground/40" },
  { title: "Subidos", count: 7, color: "bg-primary/60" },
  { title: "Rodando", count: 5, color: "bg-accent/70" },
  { title: "Performando", count: 2, color: "bg-success/70" },
];

function Dashboard() {
  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold">Bom dia, Marcelo</h1>
          <p className="text-muted-foreground mt-1">Nicho: <span className="text-foreground">Saúde e bem-estar</span> · 16 de junho de 2026</p>
        </div>
        <Link to="/app/gerador">
          <Button className="bg-gradient-primary shadow-glow border-0">
            <Sparkles className="size-4 mr-1.5" /> Gerar criativo
          </Button>
        </Link>
      </div>

      {/* Sugestão do dia */}
      <Card className="glass bg-gradient-card border-primary/30 p-6 shadow-glow">
        <div className="flex items-start gap-4">
          <div className="size-12 rounded-xl bg-gradient-primary flex items-center justify-center shrink-0">
            <Sparkles className="size-6 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <Badge className="bg-primary/20 text-primary-glow border-0 mb-2">Sugestão do dia</Badge>
            <h2 className="font-display text-xl font-semibold">
              Você nunca testou objeção invertida em 9:16 para esse produto.
            </h2>
            <p className="text-muted-foreground mt-2 max-w-2xl">
              Essa combinação está em alta no seu nicho esta semana e tem hook rate 2.8× acima da média. Quer criar agora?
            </p>
          </div>
          <Link to="/app/gerador">
            <Button className="bg-gradient-primary border-0">
              Criar agora <ArrowRight className="size-4 ml-1.5" />
            </Button>
          </Link>
        </div>
      </Card>

      {/* Feed de inteligência */}
      <div>
        <h2 className="font-display text-xl font-semibold mb-4">Feed de inteligência diária</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {intel.map((i) => (
            <Card key={i.title} className="glass bg-gradient-card p-5 hover:border-primary/40 transition">
              <div className="flex items-center justify-between mb-3">
                <div className="size-9 rounded-lg bg-primary/15 flex items-center justify-center">
                  <i.icon className="size-4 text-primary-glow" />
                </div>
                <Badge variant="outline" className="text-[10px] uppercase">{i.tag}</Badge>
              </div>
              <h3 className="font-semibold leading-snug">{i.title}</h3>
              <p className="text-sm text-muted-foreground mt-1.5">{i.desc}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* Status dos criativos */}
      <div>
        <h2 className="font-display text-xl font-semibold mb-4">Status dos criativos ativos</h2>
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
      </div>

      {/* Volume + alerta */}
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
              <div className="text-2xl font-display font-bold">7 / 12</div>
              <div className="text-xs text-muted-foreground">criativos ativos</div>
            </div>
          </div>
          <Progress value={58} className="h-2" />
          <p className="text-xs text-muted-foreground mt-3">Gere mais 5 para acelerar a fase de validação.</p>
        </Card>

        <Card className="glass border-warning/30 p-6">
          <h3 className="font-semibold flex items-center gap-2">
            <AlertTriangle className="size-4 text-warning" /> Alerta de saturação
          </h3>
          <p className="text-sm text-muted-foreground mt-2">
            O ângulo <span className="text-foreground">"mecanismo único + before/after"</span> está aparecendo em 34% dos seus criativos rodando. Diversifique para evitar fadiga.
          </p>
          <Button variant="outline" size="sm" className="mt-4">
            <TrendingUp className="size-3.5 mr-1.5" /> Ver alternativas
          </Button>
        </Card>
      </div>
    </div>
  );
}
