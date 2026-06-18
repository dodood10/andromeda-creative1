import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { removeProjectReferenceTranscriptionFn } from "@/lib/criativos.functions";
import type { ReferenceTranscriptionAnalysis } from "@/lib/reference-transcription-analyze";
import { useWorkspace } from "@/contexts/workspace-context";

export type ReferenceTranscriptionItem = {
  id: string;
  preview: string;
  added_at: string;
  charCount: number;
  label?: string;
  analysis?: ReferenceTranscriptionAnalysis;
};

type ReferenceTranscriptionsListProps = {
  items: ReferenceTranscriptionItem[];
  embedded?: boolean;
};

export function ReferenceTranscriptionsList({ items, embedded }: ReferenceTranscriptionsListProps) {
  const { organizationId, projectId } = useWorkspace();
  const queryClient = useQueryClient();
  const runRemove = useServerFn(removeProjectReferenceTranscriptionFn);

  const removeMutation = useMutation({
    mutationFn: async (transcriptionId: string) => {
      if (!organizationId) throw new Error("Organização não selecionada");
      return runRemove({ data: { organizationId, transcriptionId } });
    },
    onSuccess: async () => {
      toast.success("Transcrição removida");
      await queryClient.invalidateQueries({ queryKey: ["inteligencia", projectId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao remover"),
  });

  if (items.length === 0) return null;

  const list = (
    <ul className="space-y-2">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex gap-3 items-start justify-between p-3 rounded-lg border border-border/40 bg-background/30"
        >
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs text-muted-foreground">
                {format(new Date(item.added_at), "dd MMM yyyy · HH:mm", { locale: ptBR })} ·{" "}
                {item.charCount} caracteres
              </p>
              {item.label && (
                <Badge variant="outline" className="text-[10px]">
                  {item.label}
                </Badge>
              )}
              {item.analysis && (
                <Badge className="text-[10px] bg-primary/15 text-primary-glow border-primary/30">
                  <Sparkles className="size-3 mr-1" />
                  Analisado
                </Badge>
              )}
            </div>
            {item.analysis ? (
              <div className="text-xs space-y-1 text-muted-foreground">
                <p>
                  <span className="text-foreground/80 font-medium">Hook:</span> {item.analysis.hook}
                </p>
                <p>
                  <span className="text-foreground/80 font-medium">Ângulo:</span>{" "}
                  {item.analysis.angulo} · {item.analysis.tipo_angulo}
                </p>
                <p className="line-clamp-2">
                  <span className="text-foreground/80 font-medium">Estrutura:</span>{" "}
                  {item.analysis.estrutura_resumo}
                </p>
              </div>
            ) : (
              <p className="text-sm text-foreground/90 whitespace-pre-wrap line-clamp-3">
                {item.preview}
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground hover:text-destructive"
            disabled={removeMutation.isPending}
            onClick={() => removeMutation.mutate(item.id)}
            aria-label="Remover transcrição"
          >
            {removeMutation.isPending && removeMutation.variables === item.id ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
          </Button>
        </li>
      ))}
    </ul>
  );

  if (embedded) return list;

  return (
    <Card className="glass p-6 space-y-4 border border-primary/20">
      <div>
        <h2 className="font-semibold text-sm">Biblioteca de transcrições</h2>
        <p className="text-xs text-muted-foreground mt-1">
          {items.length} texto(s) na organização — as 8 mais recentes entram no gerador, VSL e refinar.
          Copies podem ser de qualquer nicho; usamos só estrutura e ritmo.
        </p>
      </div>
      {list}
    </Card>
  );
}
