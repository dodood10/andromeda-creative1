import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { createStripeCheckout } from "@/lib/plan.functions";
import { trackMetaInitiateCheckout } from "@/lib/meta-pixel";

export function UpgradeBanner({
  message,
  compact,
  upgradeTo = "/app/plano",
  organizationId,
  canCheckout = false,
}: {
  message: string;
  compact?: boolean;
  upgradeTo?: "/app/plano" | "/planos";
  organizationId?: string;
  canCheckout?: boolean;
}) {
  const runCheckout = useServerFn(createStripeCheckout);
  const [loading, setLoading] = useState(false);

  async function handleCheckout() {
    if (!organizationId) {
      toast.error("Workspace não carregado");
      return;
    }
    setLoading(true);
    try {
      trackMetaInitiateCheckout();
      const { checkoutUrl } = await runCheckout({
        data: { organizationId, tier: "pro" },
      });
      window.location.href = checkoutUrl;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Checkout indisponível");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/10 px-4 ${compact ? "py-2" : "py-3"}`}
    >
      <p className="text-sm flex items-center gap-2">
        <Sparkles className="size-4 text-primary-glow shrink-0" />
        {message}
      </p>
      <div className="flex flex-wrap gap-2">
        {canCheckout && organizationId ? (
          <Button
            size="sm"
            className="min-h-11 bg-gradient-primary border-0"
            onClick={() => void handleCheckout()}
            disabled={loading}
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : "Assinar Pro"}
          </Button>
        ) : null}
        <Link to={upgradeTo}>
          <Button size="sm" variant="outline" className="min-h-11 border-primary/40">
            {upgradeTo === "/app/plano" ? "Ver plano e uso" : "Ver planos"}
          </Button>
        </Link>
      </div>
    </div>
  );
}
