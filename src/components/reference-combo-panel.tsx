import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Layers, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setProjectReferenceComboFn } from "@/lib/criativos.functions";
import { formatReferenceComboBlock } from "@/lib/project-reference-intel";
import type { ReferenceTranscriptionAnalysis } from "@/lib/reference-transcription-analyze";
import { useWorkspace } from "@/contexts/workspace-context";

export type ReferenceComboItem = {
  id: string;
  preview: string;
  label?: string;
  analysis?: ReferenceTranscriptionAnalysis;
};

type ReferenceComboPanelProps = {
  items: ReferenceComboItem[];
  activeCombo: {
    structure_id?: string;
    formato_id?: string;
    angulo_id?: string;
  } | null;
};

const NONE = "__none__";

export function ReferenceComboPanel({ items, activeCombo }: ReferenceComboPanelProps) {
  const { projectId } = useWorkspace();
  const queryClient = useQueryClient();
  const runSetCombo = useServerFn(setProjectReferenceComboFn);

  const [structureId, setStructureId] = useState(activeCombo?.structure_id ?? "");
  const [formatoId, setFormatoId] = useState(activeCombo?.formato_id ?? "");
  const [anguloId, setAnguloId] = useState(activeCombo?.angulo_id ?? "");

  const preview = useMemo(() => {
    if (!structureId && !formatoId && !anguloId) return null;
    return formatReferenceComboBlock(
      items.map((i) => ({
        id: i.id,
        text: i.preview,
        added_at: "",
        label: i.label,
        analysis: i.analysis,
      })),
      {
        structure_id: structureId || undefined,
        formato_id: formatoId || undefined,
        angulo_id: anguloId || undefined,
      },
    );
  }, [items, structureId, formatoId, anguloId]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error("Projeto não selecionado");
      if (!structureId && !formatoId && !anguloId) {
        return runSetCombo({ data: { projectId, clear: true } });
      }
      return runSetCombo({
        data: {
          projectId,
          structureId: structureId || undefined,
          formatoId: formatoId || undefined,
          anguloId: anguloId || undefined,
        },
      });
    },
    onSuccess: async () => {
      toast.success("Combo salvo — entra no próximo gerador e VSL");
      await queryClient.invalidateQueries({ queryKey: ["inteligencia", projectId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar combo"),
  });

  if (items.length < 2) return null;

  function labelFor(item: ReferenceComboItem) {
    const hook = item.analysis?.hook?.slice(0, 50);
    const base = item.label ?? item.preview.slice(0, 48);
    return hook ? `${base} — ${hook}…` : base;
  }

  return (
    <Card className="glass p-6 space-y-4 border border-accent/30">
      <div>
        <h2 className="font-semibold text-sm flex items-center gap-2">
          <Layers className="size-4 text-primary-glow" />
          Combo de referências
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Combine estrutura de um anúncio, formato de outro e hook/ângulo de um terceiro — método
          campeão da metodologia EDS.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Estrutura (ordem dos beats)</Label>
          <Select
            value={structureId || NONE}
            onValueChange={(v) => setStructureId(v === NONE ? "" : v)}
          >
            <SelectTrigger className="text-xs">
              <SelectValue placeholder="Escolher referência" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Nenhuma</SelectItem>
              {items.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {labelFor(item)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Formato (UGC, notícia, especialista…)</Label>
          <Select value={formatoId || NONE} onValueChange={(v) => setFormatoId(v === NONE ? "" : v)}>
            <SelectTrigger className="text-xs">
              <SelectValue placeholder="Escolher referência" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Nenhuma</SelectItem>
              {items.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.analysis?.formato_inferido?.slice(0, 60) ?? labelFor(item)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Ângulo / hook</Label>
          <Select value={anguloId || NONE} onValueChange={(v) => setAnguloId(v === NONE ? "" : v)}>
            <SelectTrigger className="text-xs">
              <SelectValue placeholder="Escolher referência" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Nenhuma</SelectItem>
              {items.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.analysis?.hook?.slice(0, 70) ?? labelFor(item)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {preview && (
        <pre className="text-xs whitespace-pre-wrap font-mono bg-background/50 border border-border/40 rounded-lg p-3 max-h-40 overflow-y-auto text-muted-foreground">
          {preview}
        </pre>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          className="bg-gradient-primary border-0"
          disabled={saveMutation.isPending || (!structureId && !formatoId && !anguloId)}
          onClick={() => saveMutation.mutate()}
        >
          {saveMutation.isPending ? (
            <Loader2 className="size-4 mr-1.5 animate-spin" />
          ) : (
            <Layers className="size-4 mr-1.5" />
          )}
          Usar combo no gerador
        </Button>
        {(structureId || formatoId || anguloId || activeCombo) && (
          <Button
            size="sm"
            variant="outline"
            disabled={saveMutation.isPending}
            onClick={() => {
              setStructureId("");
              setFormatoId("");
              setAnguloId("");
              if (!projectId) return;
              void runSetCombo({ data: { projectId, clear: true } }).then(() => {
                toast.success("Combo removido");
                void queryClient.invalidateQueries({ queryKey: ["inteligencia", projectId] });
              });
            }}
          >
            Limpar combo
          </Button>
        )}
      </div>
    </Card>
  );
}
