import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Sparkles,
  ArrowRight,
  Check,
  Menu,
  X,
  Link as LinkIcon,
  Search,
  Layers,
  Wand2,
  Brain,
  TrendingUp,
  History,
  Edit3,
  Target,
  ShoppingBag,
  GraduationCap,
  Cloud,
  Briefcase,
  Building2,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import heroImg from "@/assets/hero-andromeda.jpg";
import problemImg from "@/assets/problem-speed.jpg";
import howImg from "@/assets/how-it-works.jpg";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Andromeda — Criativos para Meta Ads em menos de 5 minutos" },
      {
        name: "description",
        content:
          "Cole a URL da sua oferta e receba 5 novos ângulos de venda e 5 criativos prontos para anunciar em menos de 5 minutos.",
      },
      {
        property: "og:title",
        content: "Andromeda — Criativos que convertem em minutos",
      },
      {
        property: "og:description",
        content:
          "Transforme qualquer oferta em criativos prontos para escalar. 5 ângulos, 5 criativos, em menos de 5 minutos.",
      },
    ],
  }),
  component: Landing,
});

const pillars = [
  "Pesquisa de mercado",
  "Estratégia criativa",
  "Geração de ângulos",
  "Produção de criativos",
  "Escala de campanhas",
];

const steps = [
  {
    n: "01",
    icon: LinkIcon,
    title: "Cole a URL da sua oferta",
    desc: "A plataforma analisa automaticamente produto, oferta, benefícios, mecanismo, avatar e posicionamento. Sem briefing complexo.",
  },
  {
    n: "02",
    icon: Search,
    title: "Descubra novas oportunidades de conversão",
    desc: "O Andromeda identifica novos ângulos, novas promessas, novas abordagens e novas oportunidades de escala — antes de criar qualquer anúncio.",
  },
  {
    n: "03",
    icon: Layers,
    title: "Receba 5 ângulos prontos",
    desc: "Cada ângulo conversa com uma motivação diferente do comprador: dor, desejo, oportunidade, prova, objeção. Porque raramente existe apenas uma forma de vender uma oferta.",
  },
  {
    n: "04",
    icon: Wand2,
    title: "Gere seus criativos",
    desc: "Cada ângulo vira hook, estrutura, roteiro, CTA e criativo completo — pronto para Meta Ads.",
  },
];

const deliverables = [
  {
    icon: Brain,
    title: "Inteligência de mercado",
    desc: "Descubra o que está funcionando agora no seu nicho.",
  },
  {
    icon: Layers,
    title: "5 novos ângulos de venda",
    desc: "Novas oportunidades de conversão para sua oferta.",
  },
  {
    icon: Sparkles,
    title: "5 criativos prontos para anunciar",
    desc: "Sem começar do zero.",
  },
  {
    icon: Edit3,
    title: "Editor integrado",
    desc: "Ajuste apenas o que quiser.",
  },
  {
    icon: TrendingUp,
    title: "Sistema de escala",
    desc: "Transforme criativos vencedores em dezenas de novas variações.",
  },
  {
    icon: History,
    title: "Histórico completo",
    desc: "Todos os projetos organizados em um único lugar.",
  },
];

const audience = [
  { icon: ShoppingBag, title: "E-commerce", desc: "Volume constante de criativos para alimentar o algoritmo." },
  { icon: GraduationCap, title: "Infoprodutos", desc: "Novos mecanismos, promessas e ângulos." },
  { icon: Cloud, title: "SaaS", desc: "Criativos para aquisição e geração de demanda." },
  { icon: Briefcase, title: "Serviços", desc: "Mensagens mais persuasivas para gerar reuniões e vendas." },
  { icon: Building2, title: "Agências", desc: "Mais produção sem aumentar equipe." },
];

const faqs = [
  {
    q: "Funciona para qualquer nicho?",
    a: "Sim. A análise é feita individualmente para cada oferta.",
  },
  {
    q: "Preciso saber copywriting?",
    a: "Não. Toda a estrutura é criada automaticamente.",
  },
  {
    q: "Preciso saber editar vídeo?",
    a: "Não. Os criativos já saem prontos para exportação.",
  },
  {
    q: "Os créditos expiram?",
    a: "Não. Você usa quando quiser.",
  },
  {
    q: "Posso comprar mais depois?",
    a: "Sim. Quando precisar gerar novos criativos basta adquirir novos créditos.",
  },
  {
    q: "E se um criativo não converter?",
    a: "Nenhum anunciante profissional aposta em apenas um criativo. A vantagem está na velocidade para testar novas hipóteses até encontrar o vencedor. É exatamente isso que o Andromeda entrega.",
  },
];

function Landing() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const ctaSearch = { redirect: "/app/onboarding" } as const;

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
            <a href="#como" className="hover:text-foreground transition">Como funciona</a>
            <a href="#entregas" className="hover:text-foreground transition">O que você recebe</a>
            <a href="#preco" className="hover:text-foreground transition">Preço</a>
            <a href="#faq" className="hover:text-foreground transition">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="md:hidden min-h-11 min-w-11 flex items-center justify-center"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Menu"
            >
              {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
            <Link to="/login" search={{ redirect: "/app" }} className="hidden md:inline-flex">
              <Button variant="ghost" size="sm" className="min-h-11">
                Entrar
              </Button>
            </Link>
            <Link to="/login" search={ctaSearch}>
              <Button className="bg-gradient-primary shadow-glow hover:opacity-90 border-0 min-h-11">
                Criar conta grátis
              </Button>
            </Link>
          </div>
        </div>
        {mobileOpen && (
          <nav className="md:hidden border-t border-border/40 px-6 py-4 flex flex-col gap-3 text-sm">
            <a href="#como" onClick={() => setMobileOpen(false)}>Como funciona</a>
            <a href="#entregas" onClick={() => setMobileOpen(false)}>O que você recebe</a>
            <a href="#preco" onClick={() => setMobileOpen(false)}>Preço</a>
            <a href="#faq" onClick={() => setMobileOpen(false)}>FAQ</a>
            <Link to="/login" search={ctaSearch} onClick={() => setMobileOpen(false)}>
              Entrar
            </Link>
          </nav>
        )}
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero pointer-events-none" />
        <div className="container mx-auto px-6 pt-20 pb-24 relative">
          <div className="max-w-3xl mx-auto text-center">
            <Badge variant="outline" className="mb-6 border-primary/40 text-primary-glow bg-primary/10">
              <Sparkles className="size-3 mr-1.5" />
              Criativos para Meta Ads em menos de 5 minutos
            </Badge>
            <h1 className="text-5xl md:text-7xl font-display font-bold tracking-tight">
              Transforme qualquer oferta em{" "}
              <span className="bg-clip-text text-transparent bg-gradient-primary">
                criativos que convertem
              </span>
              .
            </h1>
            <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Cole a URL da sua oferta e receba 5 novos ângulos de venda e 5 criativos prontos para
              anunciar em menos de 5 minutos.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link to="/login" search={ctaSearch}>
                <Button size="lg" className="bg-gradient-primary shadow-glow border-0 text-base px-8 min-h-11">
                  Criar meus primeiros criativos <ArrowRight className="ml-1.5 size-4" />
                </Button>
              </Link>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">Sem cartão de crédito</p>
          </div>

          <div className="mt-16 relative">
            <div className="absolute -inset-8 bg-gradient-primary opacity-30 blur-3xl rounded-full" />
            <img
              src={heroImg}
              alt="Andromeda transforma URL em criativos"
              width={1600}
              height={1000}
              className="relative rounded-2xl border border-border shadow-card-soft w-full"
            />
          </div>

          {/* Prova */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {[
              { k: "R$30M+", v: "investidos em Meta Ads" },
              { k: "R$10M", v: "gerados recentemente" },
              { k: "Milhares", v: "de criativos testados" },
            ].map((s) => (
              <div key={s.k} className="glass rounded-2xl p-5 text-center">
                <div className="text-2xl font-display font-bold bg-clip-text text-transparent bg-gradient-primary">
                  {s.k}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">{s.v}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Problema */}
      <section className="container mx-auto px-6 py-24">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <Badge variant="outline" className="mb-4 border-primary/30 text-primary-glow">O problema</Badge>
            <h2 className="text-4xl md:text-5xl font-display font-bold">
              O Meta não recompensa quem cria anúncios.{" "}
              <span className="bg-clip-text text-transparent bg-gradient-primary">
                Recompensa quem encontra criativos vencedores mais rápido.
              </span>
            </h2>
            <p className="mt-6 text-muted-foreground">
              A maioria dos anunciantes ainda opera da mesma forma:
            </p>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              {[
                "Pesquisa concorrentes",
                "Procura tendências",
                "Escreve hooks",
                "Cria roteiros",
                "Edita vídeos",
                "Espera aprovação",
                "Publica",
              ].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-primary-glow" />
                  {t}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-muted-foreground">
              E só então descobre se o criativo funciona. Enquanto isso, o concorrente já está
              testando os próximos.
            </p>
            <p className="mt-6 text-xl font-display font-semibold">
              O problema não é falta de talento.{" "}
              <span className="bg-clip-text text-transparent bg-gradient-primary">É falta de velocidade.</span>
            </p>
          </div>
          <div className="relative">
            <div className="absolute -inset-6 bg-gradient-primary opacity-20 blur-3xl rounded-full" />
            <img
              src={problemImg}
              alt="Velocidade versus processo lento"
              width={1400}
              height={900}
              loading="lazy"
              className="relative rounded-2xl border border-border shadow-card-soft w-full"
            />
          </div>
        </div>
      </section>

      {/* Apresentando */}
      <section className="container mx-auto px-6 py-24">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <Badge variant="outline" className="mb-4 border-primary/30 text-primary-glow">
            Apresentando o Andromeda
          </Badge>
          <h2 className="text-4xl md:text-5xl font-display font-bold">
            O sistema que transforma ofertas em{" "}
            <span className="bg-clip-text text-transparent bg-gradient-primary">criativos prontos para escalar</span>
            .
          </h2>
          <div className="mt-8 space-y-1 text-muted-foreground">
            <p>Não é apenas um editor.</p>
            <p>Não é apenas uma IA de copy.</p>
            <p>Não é apenas um gerador de vídeo.</p>
          </div>
          <p className="mt-8 text-foreground">O Andromeda combina:</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 max-w-4xl mx-auto">
          {pillars.map((p) => (
            <div key={p} className="glass bg-gradient-card rounded-2xl p-5 text-center">
              <Check className="size-4 text-primary-glow mx-auto mb-2" />
              <div className="text-sm font-medium">{p}</div>
            </div>
          ))}
        </div>
        <p className="mt-8 text-center text-muted-foreground">Tudo em uma única plataforma.</p>
      </section>

      {/* Como funciona */}
      <section id="como" className="container mx-auto px-6 py-24">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <Badge variant="outline" className="mb-4 border-primary/30 text-primary-glow">Como funciona</Badge>
          <h2 className="text-4xl md:text-5xl font-display font-bold">
            Da URL ao criativo em{" "}
            <span className="bg-clip-text text-transparent bg-gradient-primary">minutos</span>
          </h2>
        </div>

        <div className="mb-12 relative max-w-4xl mx-auto">
          <div className="absolute -inset-6 bg-gradient-primary opacity-20 blur-3xl rounded-full" />
          <img
            src={howImg}
            alt="4 etapas conectadas"
            width={1400}
            height={900}
            loading="lazy"
            className="relative rounded-2xl border border-border shadow-card-soft w-full"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {steps.map((s) => (
            <div key={s.n} className="glass bg-gradient-card rounded-2xl p-8 relative">
              <div className="flex items-start justify-between mb-4">
                <div className="size-10 rounded-lg bg-primary/15 flex items-center justify-center">
                  <s.icon className="size-5 text-primary-glow" />
                </div>
                <div className="text-4xl font-display font-bold bg-clip-text text-transparent bg-gradient-primary opacity-50">
                  {s.n}
                </div>
              </div>
              <h3 className="font-display text-xl font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Entregas */}
      <section id="entregas" className="container mx-auto px-6 py-24">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <Badge variant="outline" className="mb-4 border-primary/30 text-primary-glow">Tudo o que você recebe</Badge>
          <h2 className="text-4xl md:text-5xl font-display font-bold">
            Uma plataforma.{" "}
            <span className="bg-clip-text text-transparent bg-gradient-primary">Seis entregas.</span>
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {deliverables.map((d) => (
            <div key={d.title} className="glass bg-gradient-card rounded-2xl p-6 hover:shadow-glow transition-all duration-300">
              <div className="size-10 rounded-lg bg-primary/15 flex items-center justify-center mb-4">
                <d.icon className="size-5 text-primary-glow" />
              </div>
              <h3 className="font-display text-lg font-semibold">{d.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{d.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Por que funciona */}
      <section className="container mx-auto px-6 py-24">
        <div className="max-w-3xl mx-auto text-center">
          <Badge variant="outline" className="mb-4 border-primary/30 text-primary-glow">Por que funciona</Badge>
          <h2 className="text-4xl md:text-5xl font-display font-bold">
            A maioria das ferramentas gera conteúdo.{" "}
            <span className="bg-clip-text text-transparent bg-gradient-primary">
              O Andromeda gera hipóteses de conversão.
            </span>
          </h2>
          <div className="mt-8 space-y-4 text-muted-foreground">
            <p>Essa é uma diferença enorme.</p>
            <p>
              Um criativo é apenas um anúncio. Uma hipótese de conversão é uma nova oportunidade de
              venda.
            </p>
            <p className="text-foreground">
              Por isso o objetivo não é criar vídeos bonitos. O objetivo é descobrir quais mensagens
              fazem o mercado comprar.
            </p>
          </div>
        </div>
      </section>

      {/* Verdadeiro benefício */}
      <section className="container mx-auto px-6 py-24">
        <div className="relative overflow-hidden rounded-3xl glass bg-gradient-card p-10 md:p-16">
          <div className="absolute inset-0 bg-gradient-hero opacity-60 pointer-events-none" />
          <div className="relative max-w-3xl mx-auto text-center">
            <Badge variant="outline" className="mb-4 border-primary/30 text-primary-glow">O verdadeiro benefício</Badge>
            <h2 className="text-3xl md:text-5xl font-display font-bold">
              Você não está comprando criativos.{" "}
              <span className="bg-clip-text text-transparent bg-gradient-primary">
                Você está comprando velocidade.
              </span>
            </h2>
            <div className="mt-10 grid md:grid-cols-3 gap-4 text-sm">
              {[
                ["Enquanto seu concorrente cria 3 anúncios", "Você testa 15"],
                ["Enquanto ele procura um vencedor", "Você encontra vários"],
                ["Enquanto ele ainda está editando", "Você já está coletando dados"],
              ].map(([a, b]) => (
                <div key={a} className="glass rounded-2xl p-5">
                  <p className="text-muted-foreground">{a}</p>
                  <p className="mt-2 font-display font-semibold bg-clip-text text-transparent bg-gradient-primary">
                    {b}.
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-10 text-muted-foreground">
              O mercado não recompensa quem produz mais.{" "}
              <span className="text-foreground">Recompensa quem aprende mais rápido.</span>
            </p>
          </div>
        </div>
      </section>

      {/* Comparação */}
      <section className="container mx-auto px-6 py-24">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <Badge variant="outline" className="mb-4 border-primary/30 text-primary-glow">Comparação</Badge>
          <h2 className="text-4xl md:text-5xl font-display font-bold">
            Dias de trabalho vs.{" "}
            <span className="bg-clip-text text-transparent bg-gradient-primary">menos de 5 minutos</span>
          </h2>
        </div>
        <div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto">
          <div className="rounded-2xl border border-border p-8 bg-card/40">
            <div className="text-sm uppercase tracking-widest text-muted-foreground mb-4">
              Processo tradicional
            </div>
            <ul className="space-y-2 text-sm">
              {[
                "Pesquisar mercado",
                "Escrever copy",
                "Criar roteiro",
                "Editar vídeo",
                "Fazer ajustes",
                "Exportar",
                "Publicar",
              ].map((t) => (
                <li key={t} className="flex items-center gap-2 text-muted-foreground">
                  <X className="size-3.5 text-destructive/70" />
                  {t}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm font-medium text-muted-foreground">Dias de trabalho.</p>
          </div>
          <div className="rounded-2xl border border-primary/40 p-8 bg-gradient-card shadow-glow">
            <div className="text-sm uppercase tracking-widest text-primary-glow mb-4">
              Com Andromeda
            </div>
            <ul className="space-y-2 text-sm">
              {["Cole a URL.", "Receba os ângulos.", "Gere os criativos.", "Publique."].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Check className="size-3.5 text-primary-glow" />
                  {t}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm font-display font-semibold bg-clip-text text-transparent bg-gradient-primary">
              Menos de 5 minutos.
            </p>
          </div>
        </div>
      </section>

      {/* Para quem é */}
      <section className="container mx-auto px-6 py-24">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <Badge variant="outline" className="mb-4 border-primary/30 text-primary-glow">Para quem é</Badge>
          <h2 className="text-4xl md:text-5xl font-display font-bold">
            Feito para quem precisa{" "}
            <span className="bg-clip-text text-transparent bg-gradient-primary">testar mais rápido</span>
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {audience.map((a) => (
            <div key={a.title} className="glass bg-gradient-card rounded-2xl p-6">
              <div className="size-10 rounded-lg bg-primary/15 flex items-center justify-center mb-4">
                <a.icon className="size-5 text-primary-glow" />
              </div>
              <h3 className="font-display font-semibold">{a.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{a.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Preço */}
      <section id="preco" className="container mx-auto px-6 py-24">
        <div className="max-w-xl mx-auto">
          <div className="relative overflow-hidden rounded-3xl border border-primary/40 bg-gradient-card p-10 shadow-glow">
            <div className="absolute inset-0 bg-gradient-hero opacity-50 pointer-events-none" />
            <div className="relative">
              <Badge variant="outline" className="mb-4 border-primary/30 text-primary-glow">
                Starter
              </Badge>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-display font-bold">R$67</span>
                <span className="text-muted-foreground">/ pacote</span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                O que está incluso no seu primeiro pacote.
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                {[
                  "5 ângulos de venda",
                  "5 criativos prontos para anunciar",
                  "Editor integrado",
                  "Exportação para Meta Ads",
                  "Sem prazo de validade",
                ].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <Check className="size-4 text-primary-glow" />
                    {t}
                  </li>
                ))}
              </ul>
              <Link to="/login" search={ctaSearch} className="block mt-8">
                <Button className="w-full bg-gradient-primary shadow-glow border-0 min-h-12">
                  Quero começar por R$67 <ArrowRight className="ml-1.5 size-4" />
                </Button>
              </Link>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Sem cartão de crédito para começar.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="container mx-auto px-6 py-24">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <Badge variant="outline" className="mb-4 border-primary/30 text-primary-glow">FAQ</Badge>
          <h2 className="text-4xl md:text-5xl font-display font-bold">Perguntas frequentes</h2>
        </div>
        <div className="max-w-2xl mx-auto">
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((f, i) => (
              <AccordionItem key={f.q} value={`item-${i}`} className="border-border/60">
                <AccordionTrigger className="text-left font-display text-base hover:no-underline">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CTA final */}
      <section className="container mx-auto px-6 pb-24">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-primary p-12 md:p-20 text-center shadow-glow">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.2),transparent_50%)]" />
          <div className="relative">
            <Target className="size-8 text-primary-foreground mx-auto mb-4 opacity-80" />
            <h2 className="text-4xl md:text-5xl font-display font-bold text-primary-foreground">
              Seu próximo criativo vencedor pode estar a menos de 5 minutos de distância.
            </h2>
            <p className="mt-6 text-primary-foreground/85 max-w-xl mx-auto">
              Pare de criar anúncios no escuro. Transforme sua oferta em novos ângulos, novos
              criativos e novas oportunidades de conversão.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link to="/login" search={ctaSearch}>
                <Button size="lg" variant="secondary" className="text-base px-8 min-h-11">
                  Criar meus primeiros criativos <ArrowRight className="ml-1.5 size-4" />
                </Button>
              </Link>
            </div>
            <p className="mt-4 text-sm text-primary-foreground/80">
              Sem cartão. Sem assinatura. Sem fidelidade.
            </p>
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
