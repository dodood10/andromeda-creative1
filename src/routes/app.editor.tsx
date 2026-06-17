import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Download, Mic, Music, Type, Loader2, Sparkles, Upload, Image } from "lucide-react";
import { toast } from "sonner";
import { getCriativo, getLatestCriativo, updateCriativoRoteiro } from "@/lib/criativos.functions";
import {
  avaliarCriativo,
  solicitarExport,
  gerarAudio,
  gerarAudioRoteiroCompleto,
  listVozes,
  getExportStatus,
  getSignedExportUrls,
  getSignedAudioUrl,
} from "@/lib/export.functions";
import { refinarBloco } from "@/lib/anthropic.functions";
import { uploadCriativoMedia } from "@/lib/storage";
import { useWorkspace } from "@/contexts/workspace-context";
import { useAuth } from "@/hooks/use-auth";
import type { RoteiroBloco } from "@/lib/schemas/angulos.schema";

const searchSchema = z.object({
  criativoId: z.string().uuid().optional(),
});

export const Route = createFileRoute("/app/editor")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [{ title: "Editor de vídeo · Andromeda" }],
  }),
  component: EditorPage,
});

const BLOCK_COLORS = [
  "bg-primary/70",
  "bg-accent/70",
  "bg-primary/60",
  "bg-success/60",
  "bg-warning/60",
];

function EditorPage() {
  const { criativoId: searchId } = Route.useSearch();
  const navigate = useNavigate();
  const { projectId } = useWorkspace();
  const fetchLatest = useServerFn(getLatestCriativo);

  const { data: latest, isLoading: loadingLatest } = useQuery({
    queryKey: ["latest-criativo", projectId],
    queryFn: () => fetchLatest({ data: { projectId: projectId! } }),
    enabled: !searchId && !!projectId,
  });

  useEffect(() => {
    if (!searchId && !loadingLatest) {
      if (latest?.criativoId) {
        navigate({ to: "/app/editor", search: { criativoId: latest.criativoId }, replace: true });
      }
    }
  }, [searchId, latest, loadingLatest, navigate]);

  if (!searchId) {
    if (loadingLatest) {
      return (
        <div className="flex items-center justify-center h-[50vh]">
          <Loader2 className="size-8 animate-spin text-primary-glow" />
        </div>
      );
    }
    if (!latest?.criativoId) {
      return (
        <div className="container py-12 text-center">
          <p className="text-muted-foreground">Nenhum criativo ainda.</p>
          <Link to="/app/gerador" className="text-primary-glow underline mt-4 inline-block">
            Gerar ângulos
          </Link>
        </div>
      );
    }
    return null;
  }

  return <Editor criativoId={searchId} />;
}

function Editor({ criativoId }: { criativoId: string }) {
  const { user } = useAuth();
  const { projectId } = useWorkspace();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchCriativo = useServerFn(getCriativo);
  const saveRoteiro = useServerFn(updateCriativoRoteiro);
  const runAvaliar = useServerFn(avaliarCriativo);
  const runExport = useServerFn(solicitarExport);
  const runAudio = useServerFn(gerarAudio);
  const runAudioAll = useServerFn(gerarAudioRoteiroCompleto);
  const runRefinar = useServerFn(refinarBloco);
  const fetchVozes = useServerFn(listVozes);
  const pollExport = useServerFn(getExportStatus);
  const signUrls = useServerFn(getSignedExportUrls);
  const signAudio = useServerFn(getSignedAudioUrl);

  const { data: criativo, isLoading, error } = useQuery({
    queryKey: ["criativo", criativoId],
    queryFn: () => fetchCriativo({ data: { id: criativoId } }),
  });

  const { data: vozes = [] } = useQuery({
    queryKey: ["vozes"],
    queryFn: () => fetchVozes(),
  });

  const [block, setBlock] = useState(0);
  const [roteiro, setRoteiro] = useState<RoteiroBloco[]>([]);
  const [voiceId, setVoiceId] = useState("");
  const [refinarInstrucao, setRefinarInstrucao] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [scoreOpen, setScoreOpen] = useState(false);
  const [scoreData, setScoreData] = useState<Awaited<ReturnType<typeof runAvaliar>> | null>(null);
  const [exporting, setExporting] = useState(false);
  const [downloadUrls, setDownloadUrls] = useState<Record<string, string>>({});
  const [uploadingBg, setUploadingBg] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (criativo?.roteiro) setRoteiro(criativo.roteiro as RoteiroBloco[]);
    if (criativo?.voice_id) setVoiceId(criativo.voice_id);
    if (criativo?.score_json) {
      setScoreData(criativo.score_json as typeof scoreData);
    }
  }, [criativo]);

  const loadBlockAudio = useCallback(
    async (idx: number, paths: Record<string, string> | null) => {
      const p = paths?.[String(idx)];
      if (!p) {
        setAudioUrl(null);
        return;
      }
      try {
        const { url } = await signAudio({ data: { path: p } });
        setAudioUrl(url);
      } catch {
        setAudioUrl(null);
      }
    },
    [signAudio],
  );

  useEffect(() => {
    const paths = criativo?.audio_paths as Record<string, string> | null;
    void loadBlockAudio(block, paths);
  }, [block, criativo?.audio_paths, loadBlockAudio]);

  useEffect(() => {
    const paths = (criativo?.export_paths as string[]) ?? [];
    if (paths.length === 0 || criativo?.export_status !== "pronto") return;
    signUrls({ data: { paths } })
      .then((r) => setDownloadUrls(r.urls))
      .catch(() => {});
  }, [criativo?.export_paths, criativo?.export_status, signUrls]);

  const persistRoteiro = useCallback(
    async (next: RoteiroBloco[]) => {
      await saveRoteiro({
        data: { id: criativoId, roteiro: next, voiceId: voiceId || undefined },
      });
      queryClient.invalidateQueries({ queryKey: ["criativo", criativoId] });
    },
    [criativoId, saveRoteiro, voiceId, queryClient],
  );

  function updateBlockContent(idx: number, conteudo: string) {
    const next = roteiro.map((b, i) => (i === idx ? { ...b, conteudo } : b));
    setRoteiro(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void persistRoteiro(next), 500);
  }

  const refinarMutation = useMutation({
    mutationFn: async () => {
      const b = roteiro[block];
      if (!b || !refinarInstrucao.trim()) throw new Error("Informe a instrução");
      return runRefinar({
        data: { conteudoAtual: b.conteudo, instrucao: refinarInstrucao, tempo: b.tempo },
      });
    },
    onSuccess: (data) => {
      updateBlockContent(block, data.conteudo);
      setRefinarInstrucao("");
      toast.success("Bloco refinado");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  async function handleGerarAudio() {
    const b = roteiro[block];
    if (!b || !voiceId) {
      toast.error("Selecione uma voz");
      return;
    }
    try {
      const res = await runAudio({
        data: { criativoId, texto: b.conteudo, voiceId, blocoIndex: block },
      });
      if (res.audioUrl) {
        setAudioUrl(res.audioUrl);
        queryClient.invalidateQueries({ queryKey: ["criativo", criativoId] });
      } else {
        toast.info(res.message ?? "Áudio em modo dev");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar áudio");
    }
  }

  async function handleGerarAudioCompleto() {
    if (!voiceId) {
      toast.error("Selecione uma voz");
      return;
    }
    try {
      const res = await runAudioAll({ data: { criativoId, voiceId } });
      toast.success(`${res.gerados} bloco(s) narrados`);
      queryClient.invalidateQueries({ queryKey: ["criativo", criativoId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  async function handleUploadBackground(file: File) {
    if (!user || !projectId) return;
    setUploadingBg(true);
    try {
      const { path } = await uploadCriativoMedia(user.id, file, projectId);
      await saveRoteiro({
        data: { id: criativoId, roteiro, backgroundMediaPath: path },
      });
      queryClient.invalidateQueries({ queryKey: ["criativo", criativoId] });
      toast.success("Mídia de fundo enviada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro no upload");
    } finally {
      setUploadingBg(false);
    }
  }

  async function handleAvaliar() {
    try {
      const score = await runAvaliar({ data: { criativoId } });
      setScoreData(score);
      setScoreOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro na avaliação");
    }
  }

  async function pollUntilReady() {
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const status = await pollExport({ data: { criativoId } });
      if (status.status === "pronto") return status;
      if (status.status === "erro") throw new Error("Render falhou");
    }
    throw new Error("Timeout no render");
  }

  async function handleExport() {
    setExporting(true);
    try {
      const score = scoreData ?? (await runAvaliar({ data: { criativoId } }));
      if (!score.podeExportar) {
        setScoreData(score);
        setScoreOpen(true);
        toast.error("Corrija os alertas antes de exportar");
        return;
      }
      await runExport({ data: { criativoId } });
      const final = await pollUntilReady();
      if (final.paths.length > 0) {
        const signed = await signUrls({ data: { paths: final.paths } });
        setDownloadUrls(signed.urls);
      }
      toast.success("Export concluído!");
      queryClient.invalidateQueries({ queryKey: ["criativo", criativoId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro no export");
    } finally {
      setExporting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="size-8 animate-spin text-primary-glow" />
      </div>
    );
  }

  if (error || !criativo) {
    return (
      <div className="container py-12 text-center">
        <p className="text-muted-foreground">Criativo não encontrado.</p>
        <Link to="/app/gerador" className="text-primary-glow underline mt-4 inline-block">
          Voltar ao gerador
        </Link>
      </div>
    );
  }

  const anguloNome = criativo.angulo;
  const estilo = criativo.estilo_producao ?? "texto_animado";
  const audioPaths = (criativo.audio_paths as Record<string, string>) ?? {};
  const exportPaths = (criativo.export_paths as string[]) ?? [];

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col">
      <div className="flex items-center justify-between px-6 py-3 border-b border-border/50">
        <div>
          <h1 className="font-display text-lg font-semibold">Editor · {anguloNome}</h1>
          <p className="text-xs text-muted-foreground">
            9:16 · {estilo === "texto_animado" ? "Texto animado" : "Clipes + texto"} ·{" "}
            {criativo.export_status === "renderizando" ? "Renderizando..." : criativo.export_status ?? "rascunho"}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          {exporting && <Loader2 className="size-4 animate-spin text-primary-glow" />}
          <Tabs value={estilo === "texto_animado" ? "A" : "B"}>
            <TabsList>
              <TabsTrigger value="A" disabled={estilo !== "texto_animado"}>Texto animado</TabsTrigger>
              <TabsTrigger value="B" disabled={estilo !== "clipes_texto"}>Clipes + texto</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" onClick={handleAvaliar}>Score</Button>
          <Dialog open={scoreOpen} onOpenChange={setScoreOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary border-0 shadow-glow" disabled={exporting}>
                <Download className="size-4 mr-1.5" /> Exportar
              </Button>
            </DialogTrigger>
            <ExportDialog
              score={scoreData}
              onExport={handleExport}
              onReavaliar={handleAvaliar}
              exporting={exporting}
              downloadUrls={downloadUrls}
              exportPaths={exportPaths}
            />
          </Dialog>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-72 border-r border-border/50 p-4 space-y-4 overflow-auto">
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Blocos</Label>
            <div className="mt-2 space-y-1.5">
              {roteiro.map((b, i) => (
                <button
                  key={i}
                  onClick={() => setBlock(i)}
                  className={`w-full text-left p-2.5 rounded-lg text-xs transition ${
                    block === i ? "bg-primary/20 border border-primary/40" : "bg-card/40 border border-border/30"
                  }`}
                >
                  <div className="flex justify-between">
                    <span className="font-mono text-primary-glow">{b.tempo}</span>
                    {audioPaths[String(i)] && <Mic className="size-3 text-success" />}
                  </div>
                  <div className="text-muted-foreground mt-0.5 line-clamp-2">{b.conteudo}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Editar bloco {roteiro[block]?.tempo}</Label>
            <Textarea
              rows={4}
              value={roteiro[block]?.conteudo ?? ""}
              onChange={(e) => updateBlockContent(block, e.target.value)}
            />
            <Textarea
              rows={2}
              placeholder="Refinar com IA: ex. deixe mais agressivo"
              value={refinarInstrucao}
              onChange={(e) => setRefinarInstrucao(e.target.value)}
            />
            <Button size="sm" variant="outline" onClick={() => refinarMutation.mutate()} disabled={refinarMutation.isPending}>
              <Sparkles className="size-3.5 mr-1" /> Refinar bloco
            </Button>
          </div>
        </aside>

        <section className="flex-1 flex items-center justify-center p-6 bg-background/40">
          <div className="relative" style={{ width: 270, height: 480 }}>
            <div className="absolute inset-0 rounded-3xl overflow-hidden border border-border bg-gradient-to-br from-primary/30 to-accent/20">
              <div className="absolute inset-x-0 top-0 h-[14%] bg-destructive/15 border-b border-destructive/30 pointer-events-none" />
              <div className="absolute inset-x-0 bottom-0 h-[35%] bg-destructive/15 border-t border-destructive/30 pointer-events-none" />
              <div className="absolute inset-x-4 top-[20%] bottom-[38%] flex items-center justify-center text-center font-display font-bold text-xl leading-tight overflow-hidden">
                {roteiro[block]?.conteudo}
              </div>
              {audioUrl && (
                <audio src={audioUrl} controls className="absolute bottom-[40%] inset-x-4 w-[calc(100%-2rem)]" />
              )}
            </div>
          </div>
        </section>

        <aside className="w-72 border-l border-border/50 p-4 space-y-5 overflow-auto">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><Mic className="size-3.5" /> Voz</Label>
            <Select value={voiceId} onValueChange={setVoiceId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {vozes.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="w-full" onClick={handleGerarAudio}>
              Gerar narração do bloco
            </Button>
            <Button size="sm" variant="outline" className="w-full" onClick={handleGerarAudioCompleto}>
              Gerar roteiro completo
            </Button>
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><Image className="size-3.5" /> Mídia de fundo</Label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleUploadBackground(f);
              }}
            />
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              disabled={uploadingBg}
              onClick={() => fileRef.current?.click()}
            >
              {uploadingBg ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5 mr-1" />}
              {criativo.background_media_path ? "Trocar mídia" : "Upload mídia"}
            </Button>
            {criativo.background_media_path && (
              <p className="text-xs text-muted-foreground truncate">{criativo.background_media_path}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><Music className="size-3.5" /> Música</Label>
            <Slider defaultValue={[40]} max={100} />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><Type className="size-3.5" /> Legendas</Label>
            <p className="text-xs text-muted-foreground">Queimadas automaticamente no export.</p>
          </div>
        </aside>
      </div>

      <div className="border-t border-border/50 p-3">
        <div className="flex gap-1 h-12">
          {roteiro.map((b, i) => (
            <button
              key={i}
              onClick={() => setBlock(i)}
              className={`${BLOCK_COLORS[i % BLOCK_COLORS.length]} rounded flex items-center px-2 text-xs font-mono text-primary-foreground ${
                block === i ? "ring-2 ring-primary-glow" : "opacity-70"
              }`}
              style={{ flex: 1 }}
            >
              {b.tempo}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ExportDialog({
  score,
  onExport,
  onReavaliar,
  exporting,
  downloadUrls,
  exportPaths,
}: {
  score: { dimensoes: Array<{ label: string; score: number; ok: boolean; dica?: string }>; podeExportar: boolean } | null;
  onExport: () => void;
  onReavaliar: () => void;
  exporting: boolean;
  downloadUrls: Record<string, string>;
  exportPaths: string[];
}) {
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Score de qualidade pré-export</DialogTitle>
      </DialogHeader>
      {!score ? (
        <Button onClick={onReavaliar}>Avaliar criativo</Button>
      ) : (
        <div className="space-y-4 py-2">
          {score.dimensoes.map((s) => (
            <div key={s.label}>
              <div className="flex justify-between text-sm mb-1.5">
                <span>{s.label}</span>
                <span className={s.ok ? "text-success" : "text-warning"}>{s.score}%</span>
              </div>
              <Progress value={s.score} className="h-2" />
              {s.dica && <p className="text-xs text-muted-foreground mt-1">{s.dica}</p>}
            </div>
          ))}
        </div>
      )}
      {exportPaths.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-border/50">
          <p className="text-sm font-medium">Downloads</p>
          {exportPaths.map((p) => (
            <a
              key={p}
              href={downloadUrls[p] ?? "#"}
              target="_blank"
              rel="noreferrer"
              className="block text-sm text-primary-glow underline"
            >
              {p.includes("4x5") ? "Baixar 4:5" : "Baixar 9:16"}
            </a>
          ))}
        </div>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onReavaliar}>Reavaliar</Button>
        <Button
          className="bg-gradient-primary border-0"
          onClick={onExport}
          disabled={exporting || (score ? !score.podeExportar : true)}
        >
          {exporting ? <Loader2 className="size-4 animate-spin" /> : "Exportar 9:16 + 4:5"}
        </Button>
      </div>
    </DialogContent>
  );
}
