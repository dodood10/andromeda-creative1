import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { createStripeCheckout } from "@/lib/plan.functions";
import { trackMetaInitiateCheckout } from "@/lib/meta-pixel";

type ExportLimitModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exportsUsed: number;
  exportsLimit: number;
  organizationId?: string;
  canUpgrade?: boolean;
};

export function ExportLimitModal({
  open,
  onOpenChange,
  exportsUsed,
  exportsLimit,
  organizationId,
  canUpgrade = false,
}: ExportLimitModalProps) {
  const runCheckout = useServerFn(createStripeCheckout);
  const [loading, setLoading] = useState(false);

  async function handleUpgrade() {
    if (!organizationId) {
      toast.error("Workspace não carregado");
      return;
    }
    setLoading(true);
    try {
      trackMetaInitiateCheckout("pro");
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary-glow" />
            Limite de exports atingido
          </DialogTitle>
          <DialogDescription>
            Você usou {exportsUsed} de {exportsLimit} export(s) MP4 este mês no plano grátis.
            Faça upgrade para Pro e exporte sem limite — ou priorize o criativo com maior potencial.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2 justify-end pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Entendi
          </Button>
          {canUpgrade && organizationId ? (
            <Button
              className="bg-gradient-primary border-0"
              onClick={() => void handleUpgrade()}
              disabled={loading}
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : "Assinar Pro agora"}
            </Button>
          ) : (
            <Link to="/app/plano">
              <Button className="bg-gradient-primary border-0">Ver plano e uso</Button>
            </Link>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
