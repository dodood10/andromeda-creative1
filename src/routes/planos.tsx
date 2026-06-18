import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PLAN_LIMITS, PLAN_LABELS, formatLimit } from "@/lib/plan-quota";
import { trackMetaInitiateCheckout } from "@/lib/meta-pixel";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/planos")({
  head: () => ({
    meta: [
      { title: "Planos · Andromeda" },
      { name: "description", content: "Compare planos Andromeda e escale seus criativos no Meta Ads." },
    ],
  }),
  component: PlanosPage,
});

const TIERS = [
  {
    id: "free" as const,
    price: "R$ 0",
    period: "/mês",
    desc: "Para testar o fluxo completo até o primeiro export.",
    features: [
      `${PLAN_LIMITS.free.geracoesMes} gerações de ângulos/mês`,
      `${PLAN_LIMITS.free.exportsMes} export MP4/mês`,
      `${PLAN_LIMITS.free.projetos} projeto`,
      "Editor com safe zones",
    ],
    cta: "Começar grátis",
    ctaTo: "/login" as const,
    ctaSearch: { redirect: "/app/onboarding" },
    highlight: false,
  },
  {
    id: "pro" as const,
    price: "R$ 197",
    period: "/mês",
    desc: "Para quem já validou e quer volume de testes e escala.",
    features: [
      "Ângulos e exports ilimitados",
      "Inteligência completa do projeto",
      "Escala com variações IA",
      "Export prioritário na fila",
      "Até 10 projetos",
    ],
    cta: "Assinar Pro",
    ctaTo: "/login" as const,
    ctaSearch: { redirect: "/app/plano" },
    highlight: true,
  },
  {
    id: "agency" as const,
    price: "Sob consulta",
    period: "",
    desc: "Times e agências com múltiplos workspaces.",
    features: [
      "Tudo do Pro",
      "Workspaces ilimitados",
      "Membros e permissões",
      "White-label (em breve)",
    ],
    cta: "Falar com vendas",
    ctaTo: "/login" as const,
    ctaSearch: { redirect: "/app/configuracoes" },
    highlight: false,
  },
];

function PlanosPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();

  useEffect(() => {
    if (!loading && session) {
      navigate({ to: "/app/plano", replace: true });
    }
  }, [loading, session, navigate]);

  if (!loading && session) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40">
        <div className="container mx-auto flex h-14 items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="size-7 rounded-md bg-gradient-primary shadow-glow" />
            <span className="font-display font-semibold">Andromeda</span>
          </Link>
          <Link to="/login" search={{ redirect: "/app" }}>
            <Button variant="outline" size="sm">Entrar</Button>
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-6 py-16 max-w-5xl space-y-12">
        <div className="text-center max-w-2xl mx-auto">
          <Badge variant="outline" className="mb-4 border-primary/40 text-primary-glow">
            <Sparkles className="size-3 mr-1" /> Monetização em rollout
          </Badge>
          <h1 className="text-4xl md:text-5xl font-display font-bold">
            Planos para cada fase do{" "}
            <span className="bg-clip-text text-transparent bg-gradient-primary">seu funil</span>
          </h1>
          <p className="mt-4 text-muted-foreground">
            Comece grátis com {PLAN_LIMITS.free.geracoesMes} gerações e {PLAN_LIMITS.free.exportsMes} export.
            Faça upgrade quando o criativo começar a performar.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TIERS.map((t) => (
            <Card
              key={t.id}
              className={`glass p-6 flex flex-col ${t.highlight ? "border-primary/50 shadow-glow ring-1 ring-primary/30" : ""}`}
            >
              {t.highlight && (
                <Badge className="w-fit mb-3 bg-primary/20 text-primary-glow border-0">Mais popular</Badge>
              )}
              <h2 className="font-display text-xl font-semibold">{PLAN_LABELS[t.id]}</h2>
              <div className="mt-2">
                <span className="text-3xl font-bold">{t.price}</span>
                <span className="text-muted-foreground text-sm">{t.period}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">{t.desc}</p>
              <ul className="mt-6 space-y-2 flex-1">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="size-4 text-success shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to={t.ctaTo}
                search={t.ctaSearch}
                className="mt-6 block"
                onClick={() => trackMetaInitiateCheckout(t.id)}
              >
                <Button
                  className={`w-full min-h-11 ${t.highlight ? "bg-gradient-primary border-0 shadow-glow" : ""}`}
                  variant={t.highlight ? "default" : "outline"}
                >
                  {t.cta}
                </Button>
              </Link>
            </Card>
          ))}
        </div>

        <Card className="glass p-6 text-sm text-muted-foreground space-y-2">
          <p className="font-medium text-foreground">FAQ rápido</p>
          <p>
            <strong>Posso testar antes de pagar?</strong> Sim — o plano Grátis cobre briefing, ângulos, editor e{" "}
            {formatLimit(PLAN_LIMITS.free.exportsMes)} export por mês.
          </p>
          <p>
            <strong>Quando cobrar?</strong> Os limites aparecem no gerador e no editor. O checkout Stripe será
            ativado em breve na aba Plano em Configurações.
          </p>
        </Card>
      </div>
    </div>
  );
}
