import { useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Sparkles, Check, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { getPlanUsage, createStripeCheckout } from "@/lib/plan.functions";
import { PLAN_LIMITS, PLAN_LABELS, formatLimit } from "@/lib/plan-quota";
import { useWorkspace } from "@/contexts/workspace-context";
import { trackMetaInitiateCheckout } from "@/lib/meta-pixel";
import { AppBreadcrumbs } from "@/components/app-breadcrumbs";

const searchSchema = z.object({
  checkout: z.enum(["success", "cancel"]).optional(),
});

export const Route = createFileRoute("/app/plano")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [{ title: "Plano e uso · Andromeda" }],
  }),
  component: PlanoPage,
});

function PlanoPage() {
  const { organizationId, currentOrg } = useWorkspace();
  const { checkout } = Route.useSearch();
  const navigate = useNavigate();
  const fetchUsage = useServerFn(getPlanUsage);
  const runCheckout = useServerFn(createStripeCheckout);
  const isOwner = currentOrg?.role === "owner";

  const checkoutMutation = useMutation({
    mutationFn: () => {
      if (!organizationId) throw new Error("Workspace não carregado");
      trackMetaInitiateCheckout();
      return runCheckout({ data: { organizationId, tier: "pro" } });
    },
    onSuccess: (data) => {
      window.location.href = data.checkoutUrl;
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Checkout indisponível"),
  });

  const { data: usage, isLoading } = useQuery({
    queryKey: ["plan-usage", organizationId],
    queryFn: () => fetchUsage({ data: { organizationId: organizationId! } }),
    enabled: !!organizationId,
  });

  useEffect(() => {
    if (checkout === "success") {
      toast.success("Pagamento recebido! Seu plano Pro será ativado em instantes.");
    } else if (checkout === "cancel") {
      toast.info("Checkout cancelado.");
    }
    if (checkout === "success" || checkout === "cancel") {
      navigate({ to: "/app/plano", search: {}, replace: true });
    }
  }, [checkout, navigate]);

  const tier = usage?.tier ?? "free";
  const limits = PLAN_LIMITS[tier];
  const gerPct =
    limits.geracoesMes === Infinity
      ? 0
      : Math.min(100, Math.round(((usage?.geracoesMes ?? 0) / limits.geracoesMes) * 100));
  const expPct =
    limits.exportsMes === Infinity
      ? 0
      : Math.min(100, Math.round(((usage?.exportsMes ?? 0) / limits.exportsMes) * 100));
  const impPct =
    limits.importsMes === Infinity
      ? 0
      : Math.min(100, Math.round(((usage?.importsMes ?? 0) / limits.importsMes) * 100));
  const projPct =
    limits.projetos === Infinity
      ? 0
      : Math.min(100, Math.round(((usage?.projetosCount ?? 0) / limits.projetos) * 100));

  return (
    <div className="container mx-auto px-6 py-8 max-w-3xl space-y-8">
      <AppBreadcrumbs items={[{ label: "Dashboard", to: "/app" }, { label: "Plano e uso" }]} />

      <div>
        <h1 className="text-3xl font-display font-bold flex items-center gap-2">
          <CreditCard className="size-7 text-primary-glow" /> Plano e uso
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Workspace: {currentOrg?.name ?? "—"}
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-8 animate-spin text-primary-glow" />
        </div>
      ) : (
        <>
          <Card className="glass p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Plano atual</p>
                <p className="text-2xl font-display font-bold">{PLAN_LABELS[tier]}</p>
              </div>
              <Badge variant="outline">{tier === "free" ? "Grátis" : "Ativo"}</Badge>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Gerações este mês</span>
                  <span>
                    {usage?.geracoesMes ?? 0} / {formatLimit(limits.geracoesMes)}
                  </span>
                </div>
                {limits.geracoesMes !== Infinity && <Progress value={gerPct} className="h-2" />}
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Exports este mês</span>
                  <span>
                    {usage?.exportsMes ?? 0} / {formatLimit(limits.exportsMes)}
                  </span>
                </div>
                {limits.exportsMes !== Infinity && <Progress value={expPct} className="h-2" />}
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Imports campeão este mês</span>
                  <span>
                    {usage?.importsMes ?? 0} / {formatLimit(limits.importsMes)}
                  </span>
                </div>
                {limits.importsMes !== Infinity && <Progress value={impPct} className="h-2" />}
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Projetos no workspace</span>
                  <span>
                    {usage?.projetosCount ?? 0} / {formatLimit(limits.projetos)}
                  </span>
                </div>
                {limits.projetos !== Infinity && <Progress value={projPct} className="h-2" />}
              </div>
            </div>
          </Card>

          {tier === "free" && (
            <Card className="glass p-6 border border-primary/30 bg-primary/5 space-y-4">
              <h2 className="font-display font-semibold flex items-center gap-2">
                <Sparkles className="size-5 text-primary-glow" /> Upgrade Pro
              </h2>
              <ul className="text-sm space-y-2 text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Check className="size-4 text-success" /> Ângulos e exports ilimitados
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-4 text-success" /> Escala com variações IA
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-4 text-success" /> Até 10 projetos
                </li>
              </ul>
              <p className="text-sm text-muted-foreground">
                {isOwner
                  ? "Assine online com cartão ou solicite liberação manual se preferir."
                  : "Fale com o owner do workspace para assinar o Pro."}
              </p>
              {isOwner && organizationId ? (
                <Button
                  className="bg-gradient-primary border-0"
                  onClick={() => checkoutMutation.mutate()}
                  disabled={checkoutMutation.isPending}
                >
                  {checkoutMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Assinar Pro — checkout seguro"
                  )}
                </Button>
              ) : null}
              <a href="mailto:suporte@andromeda.app?subject=Upgrade%20Pro">
                <Button variant="outline">Solicitar upgrade manual</Button>
              </a>
            </Card>
          )}

          <Link to="/planos" className="text-sm text-primary-glow hover:underline inline-block">
            Comparar todos os planos
          </Link>
        </>
      )}
    </div>
  );
}
