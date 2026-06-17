import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Sparkles,
  Zap,
  Wand2,
  Video,
  Film,
  TrendingUp,
  History,
  Brain,
  ArrowRight,
  Check,
  Target,
  Shield,
  LineChart,
} from "lucide-react";
import heroImg from "@/assets/hero-dashboard.jpg";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Andromeda" },
      {
        name: "description",
        content:
          "Gere ângulos, edite vídeos e escale criativos para Meta Ads com a metodologia Andromeda 2026.",
      },
      { property: "og:title", content: "Andromeda" },
      {
        property: "og:description",
        content:
          "Inteligência diária por nicho, 5 ângulos por briefing, editor com safe zones do Meta e fase de escala.",
      },
    ],
  }),
  component: Landing,
});

const areas = [
  {
    icon: Sparkles,
    title: "Dashboard diário",
    desc: "Feed de inteligência por nicho. O que está escalando hoje, antes do CPM subir.",
  },
  {
    icon: Wand2,
    title: "Gerador de ângulos",
    desc: "5 ângulos por briefing. Dor, mecanismo, prova, contraste, objeção invertida.",
  },
  {
    icon: Video,
    title: "Editor de vídeo",
    desc: "Pré-montado com voz, legendas, música e safe zones do Meta marcadas.",
  },
  {
    icon: Film,
    title: "VSL curta",
    desc: "Roteiro de 2 minutos em 6 blocos fixos. Hook duplo até CTA com valor.",
  },
  {
    icon: TrendingUp,
    title: "Fase de escala",
    desc: "Variações do seu criativo campeão. Hook, avatar, CTA, empilhamento.",
  },
  {
    icon: History,
    title: "Histórico",
    desc: "Tudo que você gerou, com status, observações e exportação em ZIP.",
  },
  {
    icon: Brain,
    title: "Inteligência de nicho",
    desc: "Benchmarks de hook rate, hold rate, CPM e CTR por nicho e formato.",
  },
];

const differentials = [
  { icon: Target, title: "5 ângulos por briefing", desc: "Dois de previsibilidade, dois de escala, um orgânico. Sempre." },
  { icon: Shield, title: "Safe zones do Meta", desc: "35% inferior e 14% superior marcados no preview. Nada importante na zona de risco." },
  { icon: LineChart, title: "Score de qualidade pré-export", desc: "Hook rate esperado, compliance, calibração e diversidade antes de exportar." },
  { icon: Brain, title: "Inteligência diária", desc: "Web search em tempo real cruzado com Andromeda 2026." },
  { icon: TrendingUp, title: "Fase de escala", desc: "Gere lote de variações do criativo que está performando." },
  { icon: Zap, title: "Refinamento por bloco", desc: "Ajuste só o hook, só o CTA, só uma objeção. Em linguagem natural." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/40 backdrop-blur-xl bg-background/70">
        <div className="container mx-auto flex h-16 items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-gradient-primary shadow-glow" />
            <span className="font-display font-semibold tracking-tight">Andromeda</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#areas" className="hover:text-foreground transition">Recursos</a>
            <a href="#como" className="hover:text-foreground transition">Como funciona</a>
            <a href="#diferenciais" className="hover:text-foreground transition">Diferenciais</a>
          </nav>
          <Link to="/app">
            <Button className="bg-gradient-primary shadow-glow hover:opacity-90 border-0">
              Entrar no app
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero pointer-events-none" />
        <div className="container mx-auto px-6 pt-20 pb-24 relative">
          <div className="max-w-3xl mx-auto text-center">
            <Badge variant="outline" className="mb-6 border-primary/40 text-primary-glow bg-primary/10">
              <Sparkles className="size-3 mr-1.5" />
              Metodologia Andromeda 2026
            </Badge>
            <h1 className="text-5xl md:text-7xl font-display font-bold tracking-tight">
              Crie criativos que{" "}
              <span className="bg-clip-text text-transparent bg-gradient-primary">
                escalam no Meta Ads
              </span>
            </h1>
            <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Os segredos dos criativos de alta conversão em uma plataforma. Inteligência diária por nicho, 5 ângulos prontos por briefing, editor com safe zones do Meta e fase de escala automática.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link to="/app">
                <Button size="lg" className="bg-gradient-primary shadow-glow border-0 text-base px-8">
                  Começar agora <ArrowRight className="ml-1.5 size-4" />
                </Button>
              </Link>
              <Button size="lg" variant="ghost" className="text-base">
                Ver demo
              </Button>
            </div>
          </div>

          <div className="mt-16 relative">
            <div className="absolute -inset-8 bg-gradient-primary opacity-30 blur-3xl rounded-full" />
            <img
              src={heroImg}
              alt="Dashboard da plataforma"
              width={1920}
              height={1080}
              className="relative rounded-2xl border border-border shadow-card-soft w-full"
            />
          </div>

          <p className="mt-12 text-center text-xs uppercase tracking-widest text-muted-foreground">
            Construído sobre · Andromeda 2026 · Dan Kennedy · Eugene Schwartz · Anthony Carreiro
          </p>
        </div>
      </section>

      {/* Áreas */}
      <section id="areas" className="container mx-auto px-6 py-24">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <Badge variant="outline" className="mb-4 border-primary/30 text-primary-glow">7 áreas</Badge>
          <h2 className="text-4xl md:text-5xl font-display font-bold">
            Tudo que você precisa para{" "}
            <span className="bg-clip-text text-transparent bg-gradient-primary">criar e escalar</span>
          </h2>
          <p className="mt-4 text-muted-foreground">
            Do briefing à variação em lote. Sem trocar de ferramenta.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {areas.map((a, i) => (
            <div
              key={a.title}
              className={`glass bg-gradient-card rounded-2xl p-6 hover:shadow-glow transition-all duration-300 ${
                i === 0 ? "lg:col-span-2 lg:row-span-2" : ""
              }`}
            >
              <div className="size-10 rounded-lg bg-primary/15 flex items-center justify-center mb-4">
                <a.icon className="size-5 text-primary-glow" />
              </div>
              <h3 className="font-display text-lg font-semibold">{a.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{a.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Como funciona */}
      <section id="como" className="container mx-auto px-6 py-24">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <Badge variant="outline" className="mb-4 border-primary/30 text-primary-glow">Veja como funciona</Badge>
          <h2 className="text-4xl md:text-5xl font-display font-bold">
            Do site ao criativo em <span className="bg-clip-text text-transparent bg-gradient-primary">minutos</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { n: "01", t: "Briefing", d: "Cole a URL do site, escolha o tipo de produto e o objetivo. A IA lê o site e pesquisa o mercado em tempo real." },
            { n: "02", t: "5 ângulos", d: "Dor aguda, mecanismo único, prova social, antes e depois, objeção invertida. Cada um com hook, estrutura bloco a bloco e justificativa." },
            { n: "03", t: "Editor", d: "Abre pré-montado com voz, legendas, música e safe zones do Meta marcadas. Você ajusta, não constrói do zero." },
          ].map((s) => (
            <div key={s.n} className="glass bg-gradient-card rounded-2xl p-8 relative">
              <div className="text-6xl font-display font-bold bg-clip-text text-transparent bg-gradient-primary opacity-60">
                {s.n}
              </div>
              <h3 className="mt-4 font-display text-xl font-semibold">{s.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Diferenciais */}
      <section id="diferenciais" className="container mx-auto px-6 py-24">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-4xl md:text-5xl font-display font-bold">
            Por que <span className="bg-clip-text text-transparent bg-gradient-primary">performa</span>
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {differentials.map((d) => (
            <div key={d.title} className="glass rounded-2xl p-6 hover:border-primary/40 transition">
              <d.icon className="size-5 text-primary-glow mb-3" />
              <h3 className="font-semibold">{d.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{d.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Para quem é */}
      <section className="container mx-auto px-6 py-24">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="text-4xl md:text-5xl font-display font-bold">Para quem é</h2>
        </div>
        <div className="flex flex-wrap justify-center gap-3 max-w-3xl mx-auto">
          {[
            "E-commerce físico",
            "Infoproduto",
            "SaaS",
            "Serviço de alto ticket",
            "Saúde e bem-estar",
          ].map((t) => (
            <Badge key={t} variant="outline" className="px-5 py-2.5 text-sm border-primary/30 bg-primary/5">
              <Check className="size-3.5 mr-1.5 text-primary-glow" />
              {t}
            </Badge>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-6 pb-24">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-primary p-12 md:p-20 text-center shadow-glow">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.2),transparent_50%)]" />
          <div className="relative">
            <h2 className="text-4xl md:text-5xl font-display font-bold text-primary-foreground">
              Pronto para criar criativos que escalam?
            </h2>
            <p className="mt-4 text-primary-foreground/80 max-w-xl mx-auto">
              Entre no app e gere os 5 primeiros ângulos em menos de 2 minutos.
            </p>
            <div className="mt-8">
              <Link to="/app">
                <Button size="lg" variant="secondary" className="text-base px-8">
                  Entrar no app <ArrowRight className="ml-1.5 size-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-10">
        <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="size-6 rounded-md bg-gradient-primary" />
            <span className="font-display font-semibold text-foreground">Andromeda</span>
          </div>
          <p>© 2026 Andromeda</p>
        </div>
      </footer>
    </div>
  );
}
