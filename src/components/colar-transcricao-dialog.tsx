import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ClipboardPaste, Loader2, Scissors, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  addProjectReferenceTranscription,
  addProjectReferenceTranscriptionsBatchFn,
} from "@/lib/criativos.functions";
import {
  extractChampionSnippetsFromText,
  isLikelyLessonTranscript,
} from "@/lib/reference-transcription-extract";
import { compareWithProjectNicho } from "@/lib/reference-niche-guard";
import { useWorkspace } from "@/contexts/workspace-context";

type ColarTranscricaoDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ColarTranscricaoDialog({ open, onOpenChange }: ColarTranscricaoDialogProps) {
  const { projectId, currentProject } = useWorkspace();
  const runAdd = useServerFn(addProjectReferenceTranscription);
  const runBatch = useServerFn(addProjectReferenceTranscriptionsBatchFn);
  const queryClient = useQueryClient();

  const [transcription, setTranscription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<"idle" | "analyzing" | "extracting">("idle");

  const nicheGuard = useMemo(() => {
    const trimmed = transcription.trim();
    if (trimmed.length < 80) return null;
    return compareWithProjectNicho(currentProject?.nicho, trimmed);
  }, [transcription, currentProject?.nicho]);

  const extraction = useMemo(() => {
    const trimmed = transcription.trim();
    if (trimmed.length < 200) return null;
    return extractChampionSnippetsFromText(trimmed);
  }, [transcription]);

  const looksLikeLesson = useMemo(
    () => transcription.trim().length >= 200 && isLikelyLessonTranscript(transcription),
    [transcription],
  );

  const reset = useCallback(() => {
    setTranscription("");
    setSubmitting(false);
    setMode("idle");
  }, []);

  function handleOpenChange(next: boolean) {
    if (!next && !submitting) reset();
    onOpenChange(next);
  }

  async function invalidateIntel() {
    await queryClient.invalidateQueries({ queryKey: ["inteligencia", projectId] });
  }

  async function handleSubmitSingle() {
    if (!projectId) {
      toast.error("Selecione um projeto antes de enviar");
      return;
    }
    if (transcription.trim().length < 40) {
      toast.error("Cole a transcrição completa (mínimo ~40 caracteres)");
      return;
    }
    if (looksLikeLesson) {
      toast.error("Texto parece aula — use “Extrair e salvar trechos” abaixo");
      return;
    }

    setSubmitting(true);
    setMode("analyzing");
    try {
      const result = await runAdd({
        data: {
          projectId,
          transcription: transcription.trim(),
        },
      });
      toast.success(
        result.total === 1
          ? "Transcrição analisada e salva — já alimenta o gerador"
          : `${result.total} transcrições de referência no projeto`,
      );
      await invalidateIntel();
      handleOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar transcrição");
    } finally {
      setSubmitting(false);
      setMode("idle");
    }
  }

  async function handleSubmitExtracted() {
    if (!projectId) {
      toast.error("Selecione um projeto antes de enviar");
      return;
    }
    const snippets = extraction?.snippets ?? [];
    if (snippets.length === 0) {
      toast.error("Nenhum trecho de anúncio detectado — cole só a copy ou ajuste o texto");
      return;
    }

    setSubmitting(true);
    setMode("extracting");
    try {
      const result = await runBatch({
        data: {
          projectId,
          snippets: snippets.map((s) => ({ text: s.text, label: s.label })),
        },
      });
      toast.success(
        `${result.added} trecho(s) de copy salvos com análise — ${result.total} no total no projeto`,
      );
      await invalidateIntel();
      handleOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar trechos");
    } finally {
      setSubmitting(false);
      setMode("idle");
    }
  }

  const statusLabel =
    mode === "analyzing"
      ? "Analisando hook, estrutura e ângulo…"
      : mode === "extracting"
        ? "Extraindo e analisando trechos…"
        : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardPaste className="size-5 text-primary-glow" />
            Colar transcrição
          </DialogTitle>
          <DialogDescription>
            Cole a copy de anúncios que já venderam — não aulas ou explicações longas. A IA decompõe
            hook, estrutura e ângulo antes de salvar na inteligência geral.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label>Transcrição</Label>
          <Textarea
            rows={12}
            placeholder="Cole aqui o texto do anúncio que performou (hook, corpo, CTA)…"
            value={transcription}
            onChange={(e) => setTranscription(e.target.value)}
            disabled={submitting}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            {transcription.trim().length} caracteres · mínimo 40 · até 12.000
            {statusLabel ? ` · ${statusLabel}` : ""}
          </p>
        </div>

        {nicheGuard?.mismatch && nicheGuard.message && (
          <div className="rounded-lg border border-warning/40 bg-warning/5 p-4">
            <p className="text-sm font-medium flex items-center gap-2 text-warning">
              <AlertTriangle className="size-4 shrink-0" />
              Nicho diferente do projeto
            </p>
            <p className="text-xs text-muted-foreground mt-1">{nicheGuard.message}</p>
          </div>
        )}

        {looksLikeLesson && (
          <div className="rounded-lg border border-warning/40 bg-warning/5 p-4 space-y-3">
            <p className="text-sm font-medium flex items-center gap-2 text-warning">
              <AlertTriangle className="size-4 shrink-0" />
              Parece aula ou metodologia — não salve o texto inteiro
            </p>
            <p className="text-xs text-muted-foreground">
              Extraia só os trechos de anúncio campeão. O gerador usa as 5 referências mais recentes
              (~600 caracteres cada); aula inteira dilui a inteligência.
            </p>
            {extraction && extraction.snippets.length > 0 && (
              <ul className="space-y-2 max-h-48 overflow-y-auto">
                {extraction.snippets.map((s, i) => (
                  <li
                    key={`${s.label}-${i}`}
                    className="text-xs p-2 rounded border border-border/40 bg-background/40 space-y-1"
                  >
                    <Badge variant="outline" className="text-[10px]">
                      {s.label}
                    </Badge>
                    <p className="text-muted-foreground line-clamp-3 whitespace-pre-wrap">{s.text}</p>
                  </li>
                ))}
              </ul>
            )}
            <Button
              className="w-full bg-gradient-primary border-0"
              disabled={submitting || !extraction?.snippets.length}
              onClick={() => void handleSubmitExtracted()}
            >
              {submitting && mode === "extracting" ? (
                <>
                  <Loader2 className="size-4 mr-1.5 animate-spin" />
                  Extraindo…
                </>
              ) : (
                <>
                  <Scissors className="size-4 mr-1.5" />
                  Extrair e salvar {extraction?.snippets.length ?? 0} trecho(s)
                </>
              )}
            </Button>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            className="bg-gradient-primary border-0"
            disabled={
              submitting ||
              transcription.trim().length < 40 ||
              looksLikeLesson
            }
            onClick={() => void handleSubmitSingle()}
          >
            {submitting && mode === "analyzing" ? (
              <>
                <Loader2 className="size-4 mr-1.5 animate-spin" />
                Analisando…
              </>
            ) : (
              <>
                <Sparkles className="size-4 mr-1.5" />
                Analisar e adicionar
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ColarTranscricaoButton({
  variant = "outline",
  size = "sm",
  className,
}: {
  variant?: "outline" | "default";
  size?: "sm" | "default";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={() => setOpen(true)}>
        <ClipboardPaste className="size-4 mr-1.5" />
        Colar transcrição
      </Button>
      <ColarTranscricaoDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
