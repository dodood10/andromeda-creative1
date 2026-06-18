import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Upload, X, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { importCriativosCampeoesLote } from "@/lib/criativos.functions";
import { uploadCriativoMedia, validateUploadFile } from "@/lib/storage";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/contexts/workspace-context";

type PendingItem = {
  id: string;
  file: File;
  nomeAngulo: string;
  hookRate: string;
  roas: string;
  cpa: string;
  formatoSaida: "criativo_curto" | "vsl_curta";
  estiloProducao: "texto_animado" | "clipes_texto" | "ugc_avatar";
  status: "pending" | "uploading" | "processing" | "done" | "error";
  error?: string;
  storagePath?: string;
};

function fileBaseName(name: string): string {
  return name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
}

function buildMetrics(item: PendingItem) {
  const metrics: Array<{ metrica: string; valor: string }> = [];
  if (item.hookRate.trim()) metrics.push({ metrica: "hook_rate", valor: item.hookRate.trim() });
  if (item.roas.trim()) metrics.push({ metrica: "roas", valor: item.roas.trim() });
  if (item.cpa.trim()) metrics.push({ metrica: "cpa", valor: item.cpa.trim() });
  return metrics;
}

type ImportBibliotecaDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ImportBibliotecaDialog({ open, onOpenChange }: ImportBibliotecaDialogProps) {
  const { user } = useAuth();
  const { projectId, organizationId } = useWorkspace();
  const runImportLote = useServerFn(importCriativosCampeoesLote);
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<PendingItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const reset = useCallback(() => {
    setItems([]);
    setSubmitting(false);
  }, []);

  function handleOpenChange(next: boolean) {
    if (!next && !submitting) reset();
    onOpenChange(next);
  }

  function addFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    const next: PendingItem[] = [];
    for (const file of Array.from(fileList)) {
      try {
        validateUploadFile(file);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : `Arquivo inválido: ${file.name}`);
        continue;
      }
      next.push({
        id: crypto.randomUUID(),
        file,
        nomeAngulo: fileBaseName(file.name) || file.name,
        hookRate: "",
        roas: "",
        cpa: "",
        formatoSaida: "criativo_curto",
        estiloProducao: "clipes_texto",
        status: "pending",
      });
    }
    if (next.length) setItems((prev) => [...prev, ...next]);
  }

  function updateItem(id: string, patch: Partial<PendingItem>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  async function handleSubmit() {
    if (!user?.id || !projectId || !organizationId) {
      toast.error("Selecione um projeto antes de importar");
      return;
    }
    if (items.length === 0) {
      toast.error("Adicione ao menos um vídeo");
      return;
    }
    if (items.some((i) => !i.nomeAngulo.trim())) {
      toast.error("Preencha o nome do ângulo em todos os arquivos");
      return;
    }

    setSubmitting(true);
    const uploaded: PendingItem[] = [];

    try {
      for (const item of items) {
        updateItem(item.id, { status: "uploading" });
        try {
          const { path } = await uploadCriativoMedia(user.id, item.file, projectId);
          const withPath = { ...item, storagePath: path, status: "processing" as const };
          updateItem(item.id, { storagePath: path, status: "processing" });
          uploaded.push(withPath);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Erro no upload";
          updateItem(item.id, { status: "error", error: msg });
        }
      }

      const ready = uploaded.filter((i) => i.storagePath);
      if (ready.length === 0) {
        toast.error("Nenhum arquivo foi enviado com sucesso");
        return;
      }

      const { imported, total, results } = await runImportLote({
        data: {
          projectId,
          organizationId,
          items: ready.map((i) => ({
            storagePath: i.storagePath!,
            nomeAngulo: i.nomeAngulo.trim(),
            fileName: i.file.name,
            metrics: buildMetrics(i),
            formatoSaida: i.formatoSaida,
            estiloProducao: i.estiloProducao,
          })),
        },
      });

      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        const match = ready[i];
        if (!match) continue;
        updateItem(match.id, {
          status: r.ok ? "done" : "error",
          error: r.error,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["criativos", projectId] });
      queryClient.invalidateQueries({ queryKey: ["inteligencia", projectId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["resultados", projectId] });

      if (imported === total) {
        toast.success(`${imported} campeão(ões) importado(s) — inteligência atualizada`);
        handleOpenChange(false);
      } else {
        toast.warning(`${imported} de ${total} importado(s). Verifique os erros na lista.`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao importar campeões");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="size-5 text-primary-glow" />
            Importar biblioteca de campeões
          </DialogTitle>
          <DialogDescription>
            Suba anúncios que já converteram na sua conta. A IA transcreve o vídeo, extrai a estrutura
            estratégica e alimenta o gerador e a calibração do projeto.
          </DialogDescription>
        </DialogHeader>

        <div
          className="border border-dashed border-primary/30 rounded-xl p-8 text-center cursor-pointer hover:bg-primary/5 transition"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            addFiles(e.dataTransfer.files);
          }}
        >
          <Upload className="size-8 mx-auto text-primary-glow mb-2" />
          <p className="font-medium">Arraste MP4s ou clique para selecionar</p>
          <p className="text-xs text-muted-foreground mt-1">Até 100MB por arquivo · mp4, webm</p>
          <p className="text-xs text-muted-foreground mt-1">
            Métricas informadas passam por validação da equipe antes de alimentar a calibração.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="video/mp4,video/webm"
            multiple
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {items.length > 0 && (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="glass rounded-lg p-3 space-y-2 border border-border/50">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{item.file.name}</p>
                    {item.status === "uploading" && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Loader2 className="size-3 animate-spin" /> Enviando…
                      </p>
                    )}
                    {item.status === "processing" && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Loader2 className="size-3 animate-spin" /> Transcrevendo e analisando…
                      </p>
                    )}
                    {item.status === "done" && (
                      <p className="text-xs text-success">Importado com sucesso</p>
                    )}
                    {item.status === "error" && (
                      <p className="text-xs text-destructive">{item.error ?? "Erro"}</p>
                    )}
                  </div>
                  {!submitting && item.status === "pending" && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(item.id)}>
                      <X className="size-4" />
                    </Button>
                  )}
                </div>

                {item.status === "pending" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Nome do ângulo</Label>
                      <Input
                        value={item.nomeAngulo}
                        onChange={(e) => updateItem(item.id, { nomeAngulo: e.target.value })}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Hook rate (%)</Label>
                      <Input
                        value={item.hookRate}
                        onChange={(e) => updateItem(item.id, { hookRate: e.target.value })}
                        placeholder="ex: 42"
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">ROAS</Label>
                      <Input
                        value={item.roas}
                        onChange={(e) => updateItem(item.id, { roas: e.target.value })}
                        placeholder="ex: 3.2"
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">CPA</Label>
                      <Input
                        value={item.cpa}
                        onChange={(e) => updateItem(item.id, { cpa: e.target.value })}
                        placeholder="ex: R$ 28"
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Formato</Label>
                      <Select
                        value={item.formatoSaida}
                        onValueChange={(v) =>
                          updateItem(item.id, { formatoSaida: v as PendingItem["formatoSaida"] })
                        }
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="criativo_curto">Criativo curto</SelectItem>
                          <SelectItem value="vsl_curta">VSL curta</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Estilo</Label>
                      <Select
                        value={item.estiloProducao}
                        onValueChange={(v) =>
                          updateItem(item.id, { estiloProducao: v as PendingItem["estiloProducao"] })
                        }
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ugc_avatar">UGC / avatar</SelectItem>
                          <SelectItem value="clipes_texto">Clipes + texto</SelectItem>
                          <SelectItem value="texto_animado">Texto animado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            className="bg-gradient-primary border-0"
            disabled={submitting || items.length === 0}
            onClick={() => void handleSubmit()}
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 mr-1.5 animate-spin" />
                Importando…
              </>
            ) : (
              `Importar ${items.length} campeão(ões)`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ImportBibliotecaButton({
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
        <Trophy className="size-4 mr-1.5" />
        Importar campeões
      </Button>
      <ImportBibliotecaDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
