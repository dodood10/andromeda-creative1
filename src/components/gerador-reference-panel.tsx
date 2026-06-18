import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, Layers } from "lucide-react";
import { ColarTranscricaoButton } from "@/components/colar-transcricao-dialog";
import { ImportBibliotecaButton } from "@/components/import-biblioteca-dialog";
import { ReferenceComboPanel } from "@/components/reference-combo-panel";
import type { ReferenceComboItem } from "@/components/reference-combo-panel";

type GeradorReferencePanelProps = {
  referenceTranscriptions?: Array<{
    id: string;
    preview: string;
    label?: string;
    analysis?: ReferenceComboItem["analysis"];
  }>;
  referenceCombo?: {
    structure_id?: string;
    formato_id?: string;
    angulo_id?: string;
  } | null;
  calibrationChip?: {
    samples: number;
    hookBiasPp?: number | null;
    conversionSamples?: number;
    cpaMedio?: number | null;
    roasMedio?: number | null;
  } | null;
};

export function GeradorReferencePanel({
  referenceTranscriptions = [],
  referenceCombo,
  calibrationChip,
}: GeradorReferencePanelProps) {
  const items: ReferenceComboItem[] = referenceTranscriptions.map((r) => ({
    id: r.id,
    preview: r.preview,
    label: r.label,
    analysis: r.analysis,
  }));

  return (
    <Collapsible>
      <Card className="glass p-4 border border-border/50">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between px-0 hover:bg-transparent">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Layers className="size-4 text-primary-glow" />
              Referências da organização
              {items.length > 0 && (
                <span className="text-xs text-muted-foreground font-normal">
                  ({items.length} transcrição{items.length !== 1 ? "ões" : ""})
                </span>
              )}
            </span>
            <ChevronDown className="size-4 text-muted-foreground" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4 space-y-4">
          {(calibrationChip?.samples ?? 0) > 0 || (calibrationChip?.conversionSamples ?? 0) > 0 ? (
            <div className="text-xs text-muted-foreground rounded-md bg-primary/5 border border-primary/20 px-3 py-2 space-y-1">
              {(calibrationChip?.samples ?? 0) > 0 && (
                <p>
                  Hook rate calibrado com <strong>{calibrationChip!.samples}</strong> resultado(s) reais
                  {calibrationChip?.hookBiasPp != null
                    ? ` · ajuste ${calibrationChip.hookBiasPp > 0 ? "+" : ""}${calibrationChip.hookBiasPp} pp`
                    : ""}
                  .
                </p>
              )}
              {(calibrationChip?.cpaMedio != null || calibrationChip?.roasMedio != null) && (
                <p>
                  Conversão validada
                  {calibrationChip?.cpaMedio != null && ` · CPA médio R$ ${calibrationChip.cpaMedio.toFixed(2)}`}
                  {calibrationChip?.roasMedio != null && ` · ROAS ${calibrationChip.roasMedio.toFixed(2)}`}
                  {calibrationChip?.conversionSamples
                    ? ` (${calibrationChip.conversionSamples} amostra(s))`
                    : ""}
                  .
                </p>
              )}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <ColarTranscricaoButton />
            <ImportBibliotecaButton variant="outline" size="sm" />
          </div>
          {items.length > 0 ? (
            <ReferenceComboPanel items={items} activeCombo={referenceCombo ?? null} />
          ) : (
            <p className="text-xs text-muted-foreground">
              Cole transcrições de anúncios campeões (qualquer nicho) — a IA usa estrutura e ritmo como referência.
            </p>
          )}
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
