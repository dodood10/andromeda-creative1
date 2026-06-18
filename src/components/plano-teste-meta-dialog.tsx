import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Target, TrendingDown, TrendingUp, Calendar, FileSpreadsheet } from "lucide-react";
import { MetaUploadGuide } from "@/components/meta-upload-guide";
import { trackFunnelEvent } from "@/lib/funnel-events";

const STORAGE_PREFIX = "andromeda-test-plan-seen:";

type PlanoTesteMetaDialogProps = {
  criativoId: string;
  anguloNome?: string;
  /** Abre na primeira exportação pronta por criativo */
  autoOpen?: boolean;
  /** Exibe botão trigger inline (default true) */
  showTrigger?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  organizationId?: string | null;
  userId?: string;
};

export function PlanoTesteMetaDialog({
  criativoId,
  anguloNome,
  autoOpen = false,
  showTrigger = true,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  organizationId,
  userId,
}: PlanoTesteMetaDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const trackedOpen = useRef(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;

  useEffect(() => {
    if (!autoOpen || !criativoId) return;
    if (!wasTestPlanAcknowledged(criativoId)) {
      setOpen(true);
    }
  }, [autoOpen, criativoId, setOpen]);

  useEffect(() => {
    if (!open || !criativoId || trackedOpen.current) return;
    trackedOpen.current = true;
    trackFunnelEvent({
      userId,
      organizationId,
      event: "test_plan_viewed",
      metadata: { criativoId },
    });
  }, [open, criativoId, organizationId, userId]);

  function acknowledge() {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_PREFIX + criativoId, new Date().toISOString());
    }
    setOpen(false);
  }

  return (
    <>
      {showTrigger && (
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Target className="size-3.5 mr-1" /> Plano de teste Meta
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Plano de teste no Meta Ads</DialogTitle>
          </DialogHeader>
          {anguloNome && (
            <p className="text-sm text-muted-foreground">
              Criativo: <span className="text-foreground font-medium">{anguloNome}</span>
            </p>
          )}
          <div className="space-y-4 text-sm">
            <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-2">
              <p className="font-medium flex items-center gap-2">
                <TrendingUp className="size-4 text-primary-glow" /> Orçamento sugerido
              </p>
              <p className="text-muted-foreground">
                R$ 50–100/dia por criativo em fase de teste. Use conjunto dedicado (CBO ou ABO) com 1 criativo
                por anúncio para isolar o hook.
              </p>
            </div>
            <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/5 space-y-2">
              <p className="font-medium flex items-center gap-2">
                <TrendingDown className="size-4 text-destructive" /> Critérios de kill (48h)
              </p>
              <ul className="text-muted-foreground space-y-1 text-xs">
                <li>• Hook rate &lt; 25% após ~1.000 impressões</li>
                <li>• CPA &gt; 2× sua meta de conversão</li>
                <li>• Feedback negativo alto no Ads Manager</li>
              </ul>
              <Badge variant="outline" className="text-[10px]">Pause e teste outro ângulo</Badge>
            </div>
            <div className="p-3 rounded-lg border border-success/30 bg-success/5 space-y-2">
              <p className="font-medium flex items-center gap-2">
                <Target className="size-4 text-success" /> Critério de escala
              </p>
              <p className="text-muted-foreground text-xs">
                Hook rate estável ≥ 35%, CPA dentro da meta por 3+ dias → marque{" "}
                <strong className="text-foreground">Performando</strong> no histórico e reporte métricas
                (hook rate, CPA, ROAS) para calibrar o gerador.
              </p>
            </div>
            <div className="p-3 rounded-lg border border-warning/30 bg-warning/5 space-y-2">
              <p className="font-medium flex items-center gap-2">
                <Calendar className="size-4 text-warning" /> Lembrete CSV (3 dias)
              </p>
              <p className="text-muted-foreground text-xs flex items-start gap-2">
                <FileSpreadsheet className="size-4 shrink-0 mt-0.5" />
                Em ~3 dias, exporte o CSV do Ads Manager com coluna <code className="font-mono">utm_content</code>{" "}
                e importe no histórico — validação mais rápida na fila.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <MetaUploadGuide trigger={<Button variant="outline" size="sm">Como subir no Meta</Button>} />
            <Button className="bg-gradient-primary border-0" onClick={acknowledge}>
              Entendi — vou testar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function wasTestPlanAcknowledged(criativoId: string): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(localStorage.getItem(STORAGE_PREFIX + criativoId));
}
