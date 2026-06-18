import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ClipboardPaste, Loader2, Plus, Scissors, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

type CopyField = { id: string; label: string; text: string };

type ColarTranscricaoDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function newCopyField(): CopyField {
  return { id: crypto.randomUUID(), label: "", text: "" };
}

export function ColarTranscricaoDialog({ open, onOpenChange }: ColarTranscricaoDialogProps) {
  const { organizationId, projectId, currentProject } = useWorkspace();
  const runAdd = useServerFn(addProjectReferenceTranscription);
  const runBatch = useServerFn(addProjectReferenceTranscriptionsBatchFn);
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<"single" | "multi">("single");
  const [transcription, setTranscription] = useState("");
  const [multiCopies, setMultiCopies] = useState<CopyField[]>(() => [newCopyField(), newCopyField()]);
  const [submitting, setSubmitting] = useState(false);
  const [submitMode, setSubmitMode] = useState<"idle" | "analyzing" | "extracting" | "batch">("idle");

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
    setMultiCopies([newCopyField(), newCopyField()]);
    setSubmitting(false);
    setSubmitMode("idle");
    setMode("single");
  }, []);

  function handleOpenChange(next: boolean) {
    if (!next && !submitting) reset();
    onOpenChange(next);
  }

  async function invalidateIntel() {
    await queryClient.invalidateQueries({ queryKey: ["inteligencia", projectId] });
  }

  async function handleSubmitSingle() {
    if (!organizationId) {
      toast.error("Selecione uma organização antes de enviar");
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
    setSubmitMode("analyzing");
    try {
      const result = await runAdd({
        data: {
          organizationId,
          transcription: transcription.trim(),
        },
      });
      toast.success(
        result.total === 1
          ? "Copy salva na biblioteca da organização"
          : `${result.total} copies na biblioteca da organização`,
      );
      await invalidateIntel();
      handleOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar transcrição");
    } finally {
      setSubmitting(false);
      setSubmitMode("idle");
    }
  }

  async function handleSubmitExtracted() {
    if (!organizationId) {
      toast.error("Selecione uma organização antes de enviar");
      return;
    }
    const snippets = extraction?.snippets ?? [];
    if (snippets.length === 0) {
      toast.error("Nenhum trecho de anúncio detectado — cole só a copy ou ajuste o texto");
      return;
    }

    setSubmitting(true);
    setSubmitMode("extracting");
    try {
      const result = await runBatch({
        data: {
          organizationId,
          snippets: snippets.map((s) => ({ text: s.text, label: s.label })),
        },
      });
      toast.success(
        `${result.added} trecho(s) salvos — ${result.total} no total na biblioteca da organização`,
      );
      await invalidateIntel();
      handleOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar trechos");
    } finally {
      setSubmitting(false);
      setSubmitMode("idle");
    }
  }

  async function handleSubmitMulti() {
    if (!organizationId) {
      toast.error("Selecione uma organização antes de enviar");
      return;
    }
    const snippets = multiCopies
      .map((c) => ({ text: c.text.trim(), label: c.label.trim() || undefined }))
      .filter((c) => c.text.length >= 40);
    if (snippets.length === 0) {
      toast.error("Adicione ao menos uma copy com 40+ caracteres");
      return;
    }
    if (snippets.length > 8) {
      toast.error("Máximo 8 copies por envio");
      return;
    }

    setSubmitting(true);
    setSubmitMode("batch");
    try {
      const result = await runBatch({ data: { organizationId, snippets } });
      toast.success(
        `${result.added} copy(s) adicionada(s) — ${result.total} no total na biblioteca da organização`,
      );
      await invalidateIntel();
      handleOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar copies");
    } finally {
      setSubmitting(false);
      setSubmitMode("idle");
    }
  }

  const statusLabel =
    submitMode === "analyzing"
      ? "Analisando hook, estrutura e ângulo…"
      : submitMode === "extracting"
        ? "Extraindo e analisando trechos…"
        : submitMode === "batch"
          ? "Salvando copies…"
          : null;

  const validMultiCount = multiCopies.filter((c) => c.text.trim().length >= 40).length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardPaste className="size-5 text-primary-glow" />
            Colar transcrição
          </DialogTitle>
          <DialogDescription>
            Biblioteca da organização — compartilhada entre todos os projetos. Copies podem ser de
            qualquer nicho ou produto; a IA usa só estrutura, ritmo e CTA como referência.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as "single" | "multi")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="single">Uma copy</TabsTrigger>
            <TabsTrigger value="multi">Várias copies</TabsTrigger>
          </TabsList>

          <TabsContent value="single" className="space-y-4 mt-4">
            <div className="space-y-1.5">
              <Label>Transcrição</Label>
              <Textarea
                rows={12}
                placeholder="Cole aqui o texto do anúncio (hook, corpo, CTA) — pode ser de outro nicho…"
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
              <div className="rounded-lg border border-border/40 bg-muted/30 p-4">
                <p className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="size-4 shrink-0 text-muted-foreground" />
                  Copy de outro nicho
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {nicheGuard.message} Pode salvar normalmente — usamos só o padrão estrutural.
                </p>
              </div>
            )}

            {looksLikeLesson && (
              <div className="rounded-lg border border-warning/40 bg-warning/5 p-4 space-y-3">
                <p className="text-sm font-medium flex items-center gap-2 text-warning">
                  <AlertTriangle className="size-4 shrink-0" />
                  Parece aula ou metodologia — não salve o texto inteiro
                </p>
                <p className="text-xs text-muted-foreground">
                  Extraia só os trechos de anúncio campeão. As 8 mais recentes entram no gerador
                  (~600 caracteres cada).
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
                  {submitting && submitMode === "extracting" ? (
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
                disabled={submitting || transcription.trim().length < 40 || looksLikeLesson}
                onClick={() => void handleSubmitSingle()}
              >
                {submitting && submitMode === "analyzing" ? (
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
          </TabsContent>

          <TabsContent value="multi" className="space-y-4 mt-4">
            <p className="text-xs text-muted-foreground">
              Adicione até 8 copies de uma vez. Label opcional ajuda a identificar a referência.
            </p>
            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
              {multiCopies.map((copy, index) => (
                <div key={copy.id} className="space-y-2 p-3 rounded-lg border border-border/40 bg-background/30">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-xs">Copy {index + 1}</Label>
                    {multiCopies.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-muted-foreground"
                        disabled={submitting}
                        onClick={() =>
                          setMultiCopies((prev) => prev.filter((c) => c.id !== copy.id))
                        }
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                  <Input
                    placeholder="Label opcional (ex: UGC emagrecimento, notícia finanças)"
                    value={copy.label}
                    onChange={(e) =>
                      setMultiCopies((prev) =>
                        prev.map((c) => (c.id === copy.id ? { ...c, label: e.target.value } : c)),
                      )
                    }
                    disabled={submitting}
                    className="text-sm"
                  />
                  <Textarea
                    rows={5}
                    placeholder="Cole a copy completa…"
                    value={copy.text}
                    onChange={(e) =>
                      setMultiCopies((prev) =>
                        prev.map((c) => (c.id === copy.id ? { ...c, text: e.target.value } : c)),
                      )
                    }
                    disabled={submitting}
                    className="font-mono text-sm"
                  />
                  <p className="text-[10px] text-muted-foreground">{copy.text.trim().length} caracteres</p>
                </div>
              ))}
            </div>
            {multiCopies.length < 8 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={submitting}
                onClick={() => setMultiCopies((prev) => [...prev, newCopyField()])}
              >
                <Plus className="size-4 mr-1.5" />
                Adicionar outra copy
              </Button>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
                Cancelar
              </Button>
              <Button
                className="bg-gradient-primary border-0"
                disabled={submitting || validMultiCount === 0}
                onClick={() => void handleSubmitMulti()}
              >
                {submitting && submitMode === "batch" ? (
                  <>
                    <Loader2 className="size-4 mr-1.5 animate-spin" />
                    Salvando…
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4 mr-1.5" />
                    Salvar {validMultiCount} copy{validMultiCount !== 1 ? "s" : ""}
                  </>
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
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
