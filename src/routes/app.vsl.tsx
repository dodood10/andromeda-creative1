import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight, Video, Edit3, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/app/vsl")({
  head: () => ({
    meta: [
      { title: "VSL curta · Andromeda" },
      { name: "description", content: "Roteiro VSL de 2 minutos gerado por IA a partir dos ângulos Andromeda." },
    ],
  }),
  component: VslPage,
});

function VslPage() {
  return (
    <div className="container mx-auto px-6 py-8 max-w-3xl space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold flex items-center gap-3">
          <Video className="size-7 text-primary-glow" /> VSL curta · 2 minutos
        </h1>
        <p className="text-muted-foreground mt-2">
          Roteiro completo de 6 blocos gerado por IA — hook duplo, objeções, CTA com valor e indicações de produção.
        </p>
      </div>

      <Card className="glass bg-gradient-card p-6 space-y-4">
        <h2 className="font-display text-lg font-semibold">Como funciona</h2>
        <ol className="space-y-4 text-sm">
          <li className="flex gap-3">
            <span className="size-7 rounded-full bg-primary/20 text-primary-glow flex items-center justify-center shrink-0 font-semibold text-xs">1</span>
            <div>
              <div className="font-medium flex items-center gap-1.5"><Sparkles className="size-3.5" /> Gerador</div>
              <p className="text-muted-foreground mt-0.5">
                Gere ângulos Andromeda. Quando a IA recomendar <strong>VSL curta</strong>, o rascunho já vem com roteiro palavra-por-palavra (~30–60s de geração).
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="size-7 rounded-full bg-primary/20 text-primary-glow flex items-center justify-center shrink-0 font-semibold text-xs">2</span>
            <div>
              <div className="font-medium flex items-center gap-1.5"><Edit3 className="size-3.5" /> Editor</div>
              <p className="text-muted-foreground mt-0.5">
                Revise os 6 blocos, hook visual separado, diagnóstico da micropersona e sinais Andromeda. Use &quot;Regenerar roteiro VSL&quot; se quiser uma nova versão.
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="size-7 rounded-full bg-primary/20 text-primary-glow flex items-center justify-center shrink-0 font-semibold text-xs">3</span>
            <div>
              <div className="font-medium flex items-center gap-1.5"><TrendingUp className="size-3.5" /> Escala</div>
              <p className="text-muted-foreground mt-0.5">
                Quando o criativo estiver performando, escale com variações completas na fase de escala.
              </p>
            </div>
          </li>
        </ol>
        <Link to="/app/gerador" search={{ step: "wizard", formato: "vsl_curta" }}>
          <Button className="bg-gradient-primary border-0 shadow-glow w-full sm:w-auto">
            Abrir gerador com VSL <ArrowRight className="size-4 ml-1.5" />
          </Button>
        </Link>
      </Card>
    </div>
  );
}
