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
import { Download, Mic, Music, Type, Loader2, Sparkles, Upload, Image, Copy, CheckCircle2, AlertTriangle, ExternalLink, ChevronDown, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { getCriativo, getLatestCriativo, updateCriativoRoteiro, updateCriativoStatus, getGeradorEtaEstimates } from "@/lib/criativos.functions";
import {
  avaliarCriativo,
  solicitarExport,
  gerarAudio,
  gerarAudioRoteiroCompleto,
  listVozes,
  getSignedExportUrls,
  getSignedAudioUrl,
  getMediaCapabilities,
  getRenderJobStatus,
  getExportStatus,
} from "@/lib/export.functions";
import { refinarBloco } from "@/lib/anthropic.functions";
import { uploadCriativoMedia } from "@/lib/storage";
import { useWorkspace } from "@/contexts/workspace-context";
import { useAuth } from "@/hooks/use-auth";
import type { RoteiroBloco } from "@/lib/schemas/angulos.schema";
import { RoteiroBlocoSchema } from "@/lib/schemas/angulos.schema";
import { validateHttpUrl } from "@/lib/security-url";
import { VSL_BLOCOS_META, vslBlockLabel, isVslRoteiro, type VslAnguloJsonExtras } from "@/lib/vsl-roteiro";
import { gerarVslCurta } from "@/lib/vsl.functions";
import { trackFunnelEvent } from "@/lib/funnel-events";
import { celebrateFirstExport } from "@/lib/first-export-celebration";
import { trackMetaExportConcluido, trackMetaMarcarSubiu } from "@/lib/meta-pixel";
import type { AudioPaths } from "@/lib/types/criativo-json";
import type { CriativoScore } from "@/lib/types/criativo-json";

function formatEtaRange(sec: number): string {
  const minMin = Math.max(1, Math.round((sec * 0.7) / 60));
  const maxMin = Math.max(minMin, Math.round((sec * 1.5) / 60));
  return minMin === maxMin ? `~${minMin} min` : `${minMin}–${maxMin} min`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AppBreadcrumbs } from "@/components/app-breadcrumbs";
import { GeradorStepper } from "@/components/gerador-stepper";
import { UpgradeBanner } from "@/components/upgrade-banner";
import { MetaUploadGuide } from "@/components/meta-upload-guide";
import { UtmBuilder } from "@/components/utm-builder";
import { ExportLimitModal } from "@/components/export-limit-modal";
import { getPlanUsage } from "@/lib/plan.functions";
import { trackMetaInitiateCheckout } from "@/lib/meta-pixel";

const searchSchema = z.object({
  criativoId: z.string().uuid().optional(),
  focus: z.enum(["audio", "score", "media"]).optional(),
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

  const { focus } = Route.useSearch();
  return <Editor criativoId={searchId} focus={focus} />;
}

type EditorProps = { criativoId: string; focus?: "audio" | "score" | "media" };

function Editor({ criativoId, focus }: EditorProps) {
  const { user } = useAuth();
  const { projectId, organizationId } = useWorkspace();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchCriativo = useServerFn(getCriativo);
  const saveRoteiro = useServerFn(updateCriativoRoteiro);
  const patchStatus = useServerFn(updateCriativoStatus);
  const runAvaliar = useServerFn(avaliarCriativo);
  const runExport = useServerFn(solicitarExport);
  const runAudio = useServerFn(gerarAudio);
  const runAudioAll = useServerFn(gerarAudioRoteiroCompleto);
  const runRefinar = useServerFn(refinarBloco);
  const runGerarVsl = useServerFn(gerarVslCurta);
  const fetchVozes = useServerFn(listVozes);
  const pollRenderJob = useServerFn(getRenderJobStatus);
  const fetchExportStatus = useServerFn(getExportStatus);
  const signUrls = useServerFn(getSignedExportUrls);
  const signAudio = useServerFn(getSignedAudioUrl);
  const fetchCapabilities = useServerFn(getMediaCapabilities);
  const fetchEta = useServerFn(getGeradorEtaEstimates);
  const fetchPlanUsage = useServerFn(getPlanUsage);

  const { data: planUsage } = useQuery({
    queryKey: ["plan-usage", organizationId],
    queryFn: () => fetchPlanUsage({ data: { organizationId: organizationId! } }),
    enabled: !!organizationId,
    staleTime: 60_000,
  });

  const { data: capabilities } = useQuery({
    queryKey: ["media-capabilities"],
    queryFn: () => fetchCapabilities(),
  });

  const { data: etaEstimates } = useQuery({
    queryKey: ["gerador-eta"],
    queryFn: () => fetchEta(),
    staleTime: 60_000,
  });

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
  const [scoreData, setScoreData] = useState<CriativoScore | null>(null);
  const [exporting, setExporting] = useState(false);
  const [renderProgress, setRenderProgress] = useState<string | null>(null);
  const [exportDevMode, setExportDevMode] = useState(false);
  const [audioDevMode, setAudioDevMode] = useState(false);
  const [showPostExport, setShowPostExport] = useState(false);
  const [exportLimitOpen, setExportLimitOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<"roteiro" | "preview" | "export">("roteiro");
  const [markingSubiu, setMarkingSubiu] = useState(false);
  const [downloadUrls, setDownloadUrls] = useState<Record<string, string>>({});
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [uploadingBg, setUploadingBg] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openedTracked = useRef<string | null>(null);
  const focusHandled = useRef(false);

  useEffect(() => {
    if (!criativo || openedTracked.current === criativoId) return;
    openedTracked.current = criativoId;
    trackFunnelEvent({ userId: user?.id, organizationId, event: "editor_opened" });
  }, [criativo, criativoId, user?.id, organizationId]);

  useEffect(() => {
    if (criativo?.score_json) {
      const parsed = criativo.score_json;
      if (parsed.dimensoes && parsed.podeExportar !== undefined) {
        setScoreData(parsed as CriativoScore);
      } else {
        setScoreData(null);
      }
      if (parsed.exportDevMode) setExportDevMode(true);
    }
  }, [criativo]);

  useEffect(() => {
    if (!capabilities) return;
    if (!capabilities.elevenLabsConfigured) setAudioDevMode(true);
    if (!capabilities.ffmpegConfigured && criativo?.export_status === "pronto") {
      setExportDevMode(true);
    }
  }, [capabilities, criativo?.export_status]);

  useEffect(() => {
    const bgPath = criativo?.background_media_path;
    if (!bgPath) {
      setBackgroundUrl(null);
      return;
    }
    signAudio({ data: { path: bgPath } })
      .then((r) => setBackgroundUrl(r.url))
      .catch(() => setBackgroundUrl(null));
  }, [criativo?.background_media_path, signAudio]);

  const loadBlockAudio = useCallback(
    async (idx: number, paths: AudioPaths | null) => {
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
    const paths = criativo?.audio_paths ?? null;
    void loadBlockAudio(block, paths);
  }, [block, criativo?.audio_paths, loadBlockAudio]);

  useEffect(() => {
    if (criativo?.roteiro) setRoteiro(criativo.roteiro as RoteiroBloco[]);
    if (criativo?.voice_id) setVoiceId(criativo.voice_id);
  }, [criativo?.roteiro, criativo?.voice_id]);

  useEffect(() => {
    const paths = (criativo?.export_paths as string[]) ?? [];
    if (paths.length === 0 || criativo?.export_status !== "pronto") return;
    signUrls({ data: { paths } })
      .then((r) => setDownloadUrls(r.urls))
      .catch(() => {});
  }, [criativo?.export_paths, criativo?.export_status, signUrls]);

  const persistRoteiro = useCallback(
    async (next: RoteiroBloco[]) => {
      const parsed = z.array(RoteiroBlocoSchema).safeParse(next);
      if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message ?? "Roteiro inválido");
        return;
      }
      await saveRoteiro({
        data: { id: criativoId, roteiro: parsed.data, voiceId: voiceId || undefined },
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

  const regenVslMutation = useMutation({
    mutationFn: () => runGerarVsl({ data: { criativoId } }),
    onSuccess: (result) => {
      setRoteiro(result.roteiro);
      queryClient.invalidateQueries({ queryKey: ["criativo", criativoId] });
      if (result.devMode) {
        toast.info("Roteiro VSL gerado em modo offline (sem API key)");
      } else {
        toast.success("Roteiro VSL regenerado com IA");
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao regenerar VSL"),
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
      } else if (res.devMode) {
        setAudioDevMode(true);
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
      if (res.devMode) setAudioDevMode(true);
      toast.success(res.devMode ? (res.message ?? "Modo dev — sem narração") : `${res.gerados} bloco(s) narrados`);
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

  useEffect(() => {
    focusHandled.current = false;
  }, [criativoId]);

  useEffect(() => {
    if (!criativo || !focus || focusHandled.current) return;
    focusHandled.current = true;
    if (focus === "score") {
      void handleAvaliar();
    } else if (focus === "audio") {
      document.getElementById("editor-audio")?.scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (focus === "media") {
      document.getElementById("editor-media")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [criativo, focus, criativoId]);

  async function handleExport() {
    if (planUsage && !planUsage.canExport) {
      setExportLimitOpen(true);
      trackMetaInitiateCheckout("export_limit");
      return;
    }
    setExporting(true);
    setRenderProgress("Iniciando render…");
    const pollTimer = setInterval(() => {
      void pollRenderJob({ data: { criativoId } }).then((jobRes) => {
        const progress = jobRes.job?.progress as {
          message?: string;
          current?: number;
          total?: number;
        } | undefined;
        if (progress?.message) setRenderProgress(progress.message);
        else if (progress?.current && progress?.total) {
          setRenderProgress(`Gerando cena ${progress.current}/${progress.total}…`);
        }
      });
    }, 5000);

    try {
      const score = scoreData ?? (await runAvaliar({ data: { criativoId } }));
      if (!score.podeExportar) {
        setScoreData(score);
        setScoreOpen(true);
        toast.error("Corrija os alertas antes de exportar");
        return;
      }

      const kickoff = await runExport({ data: { criativoId } });

      if (kickoff.status === "renderizando") {
        const deadline = Date.now() + 20 * 60 * 1000;
        while (Date.now() < deadline) {
          await sleep(3000);
          const [jobRes, exportRes] = await Promise.all([
            pollRenderJob({ data: { criativoId } }),
            fetchExportStatus({ data: { criativoId } }),
          ]);

          const progress = jobRes.job?.progress as { message?: string } | undefined;
          if (progress?.message) setRenderProgress(progress.message);

          if (exportRes.status === "pronto") {
            if (exportRes.devMode) setExportDevMode(true);
            if (exportRes.paths.length > 0) {
              const signed = await signUrls({ data: { paths: exportRes.paths } });
              setDownloadUrls(signed.urls);
            }
            setShowPostExport(true);
            setScoreOpen(false);
            toast.success("Export concluído!");
            celebrateFirstExport();
            trackMetaExportConcluido();
            trackFunnelEvent({ userId: user?.id, organizationId, event: "export_pronto", success: true });
            queryClient.invalidateQueries({ queryKey: ["criativo", criativoId] });
            return;
          }

          if (exportRes.status === "erro" || jobRes.job?.status === "failed") {
            throw new Error(jobRes.job?.error ?? "Render falhou");
          }
        }
        throw new Error("Tempo limite do export — tente novamente em alguns minutos");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro no export");
    } finally {
      clearInterval(pollTimer);
      setRenderProgress(null);
      setExporting(false);
    }
  }

  async function handleMarcarSubiu() {
    setMarkingSubiu(true);
    try {
      await patchStatus({ data: { id: criativoId, status: "Subiu" } });
      trackMetaMarcarSubiu();
      queryClient.invalidateQueries({ queryKey: ["criativos"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Marcado como Subiu!");
      navigate({ to: "/app/historico", search: { criativoId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar status");
    } finally {
      setMarkingSubiu(false);
    }
  }

  function copyUtm() {
    const utm = criativo?.utm_content ?? criativoId;
    void navigator.clipboard.writeText(utm);
    toast.success("utm_content copiado");
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
  const scoreMeta = criativo.score_json;
  const showUgcFallbackBanner =
    scoreMeta?.ugc_recommended ||
    (estilo === "ugc_avatar" && !capabilities?.agentMediaConfigured);
  const exportEtaSec =
    estilo === "clipes_texto" || estilo === "ugc_avatar"
      ? (etaEstimates?.brollSec ?? 300)
      : (etaEstimates?.exportSec ?? 45);
  const exportEtaLabel = formatEtaRange(exportEtaSec);
  const isVsl = criativo.formato_saida === "vsl_curta" || isVslRoteiro(roteiro);
  const vslExtras = (criativo.angulo_json as VslAnguloJsonExtras | null) ?? {};
  const vslDevMode = !!vslExtras.vsl_dev_mode;
  const blocoAtual = roteiro[block];
  const audioPaths = criativo.audio_paths ?? {};
  const exportPaths = (criativo.export_paths as string[]) ?? {};

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col">
      {showUgcFallbackBanner && (
        <div className="px-6 py-2 bg-primary/10 border-b border-primary/20 flex items-center gap-2 text-sm">
          <Sparkles className="size-4 text-primary-glow shrink-0" />
          <span>
            {scoreMeta?.ugc_message ??
              "IA recomendou UGC depoimento. Render com clipes/texto até configurar AGENT_MEDIA_API_KEY."}
          </span>
        </div>
      )}
      {(exportDevMode || audioDevMode || vslDevMode) && (
        <div className="px-6 py-2 bg-warning/15 border-b border-warning/30 flex items-center gap-2 text-sm">
          <AlertTriangle className="size-4 text-warning shrink-0" />
          <span>
            {vslDevMode && (exportDevMode || audioDevMode)
              ? "Modo desenvolvimento: VSL mecânico, export e/ou narração são placeholders."
              : vslDevMode
                ? "VSL em modo offline (sem API key) — roteiro mecânico. Regenerar com ANTHROPIC_API_KEY para versão completa."
                : exportDevMode && audioDevMode
              ? "Modo desenvolvimento: export MP4 e narração são placeholders. Configure FFMPEG_SERVICE_URL e ELEVENLABS_API_KEY antes de subir no Meta."
              : exportDevMode
                ? "Export em modo dev: arquivos MP4 são placeholders. Configure FFMPEG_SERVICE_URL para render real."
                : "Áudio em modo dev: narração não será gerada. Configure ELEVENLABS_API_KEY para voz real."}
          </span>
        </div>
      )}
      {(showPostExport || criativo.export_status === "pronto") && exportPaths.length > 0 && (
        <PostExportBanner
          utm={criativo.utm_content ?? criativoId}
          exportPaths={exportPaths}
          downloadUrls={downloadUrls}
          onCopyUtm={copyUtm}
          onMarcarSubiu={handleMarcarSubiu}
          markingSubiu={markingSubiu}
          onDismiss={() => setShowPostExport(false)}
          onExpand={() => setShowPostExport(true)}
          expanded={showPostExport}
          exportDevMode={exportDevMode}
        />
      )}
      <div className="px-4 lg:px-6 pt-4">
        <AppBreadcrumbs
          items={[
            { label: "Projeto", to: "/app" },
            { label: "Histórico", to: "/app/historico" },
            { label: anguloNome },
          ]}
        />
        <GeradorStepper etapa="editor" />
        {planUsage && !planUsage.canExport && (
          <UpgradeBanner
            message={`Limite de exports do plano grátis atingido (${planUsage.exportsMes}/${planUsage.limits.exportsMes} este mês).`}
            compact
            upgradeTo="/app/plano"
          />
        )}
      </div>
      <div className="flex items-center justify-between px-4 lg:px-6 py-3 border-b border-border/50 gap-2">
        <div>
          <h1 className="font-display text-lg font-semibold">Editor · {anguloNome}</h1>
          <p className="text-xs text-muted-foreground">
            {isVsl ? "VSL curta · 6 blocos" : "9:16"} · {estilo === "texto_animado" ? "Texto animado" : "Clipes + texto"} ·{" "}
            {criativo.export_status === "renderizando" ? "Renderizando..." : criativo.export_status ?? "rascunho"}
          </p>
        </div>
        <div className="hidden lg:flex gap-2 items-center">
          {exporting && <Loader2 className="size-4 animate-spin text-primary-glow" />}
          {renderProgress && (
            <span className="text-xs text-muted-foreground">{renderProgress}</span>
          )}
          {isVsl && (
            <Button
              variant="outline"
              size="sm"
              disabled={regenVslMutation.isPending}
              onClick={() => regenVslMutation.mutate()}
            >
              {regenVslMutation.isPending ? (
                <Loader2 className="size-4 animate-spin mr-1.5" />
              ) : (
                <RefreshCw className="size-4 mr-1.5" />
              )}
              Regenerar roteiro VSL
            </Button>
          )}
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
              exportEtaLabel={exportEtaLabel}
            />
          </Dialog>
        </div>
        <div className="lg:hidden flex items-center gap-2">
          {exporting && <Loader2 className="size-4 animate-spin text-primary-glow" />}
          <Dialog open={scoreOpen} onOpenChange={setScoreOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="min-h-11 bg-gradient-primary border-0 shadow-glow" disabled={exporting}>
                <Download className="size-4 mr-1" /> Exportar
              </Button>
            </DialogTrigger>
            <ExportDialog
              score={scoreData}
              onExport={handleExport}
              onReavaliar={handleAvaliar}
              exporting={exporting}
              downloadUrls={downloadUrls}
              exportPaths={exportPaths}
              exportEtaLabel={exportEtaLabel}
            />
          </Dialog>
        </div>
      </div>

      <div className="lg:hidden border-b border-border/50 px-2 py-2">
        <div className="grid grid-cols-3 gap-1">
          {(
            [
              { id: "roteiro", label: "Roteiro" },
              { id: "preview", label: "Preview" },
              { id: "export", label: "Export" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMobileTab(tab.id)}
              className={`min-h-11 rounded-lg text-sm font-medium transition ${
                mobileTab === tab.id
                  ? "bg-primary/20 text-primary-glow border border-primary/40"
                  : "text-muted-foreground border border-transparent"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <aside
          className={`w-full lg:w-72 border-r border-border/50 p-4 space-y-4 overflow-auto ${
            mobileTab !== "roteiro" ? "hidden lg:block" : ""
          }`}
        >
          {isVsl && (
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 text-xs space-y-1">
              <p className="font-semibold text-primary-glow">Roteiro VSL · 2 min</p>
              <p className="text-muted-foreground">6 blocos fixos Andromeda — edite cada etapa na ordem.</p>
            </div>
          )}
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
                  {isVsl && (
                    <div className="text-[10px] text-primary-glow/80 mt-0.5">{vslBlockLabel(b, i)}</div>
                  )}
                  <div className="text-muted-foreground mt-0.5 line-clamp-2">{b.conteudo}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Editar bloco {roteiro[block]?.tempo}{isVsl ? ` · ${vslBlockLabel(roteiro[block] ?? { tempo: "", conteudo: "" }, block)}` : ""}</Label>
            {isVsl && VSL_BLOCOS_META[block] && (
              <p className="text-xs text-muted-foreground">{VSL_BLOCOS_META[block].hint}</p>
            )}
            {isVsl && blocoAtual?.hook_visual && (
              <div className="p-2 rounded border border-primary/20 bg-primary/5 text-xs">
                <span className="font-semibold text-primary-glow">Hook visual:</span>{" "}
                <span className="text-muted-foreground">{blocoAtual.hook_visual}</span>
              </div>
            )}
            {isVsl && blocoAtual?.objetivo_bloco && (
              <p className="text-xs text-muted-foreground">
                <span className="font-medium">Objetivo:</span> {blocoAtual.objetivo_bloco}
              </p>
            )}
            {isVsl && blocoAtual?.objecoes && blocoAtual.objecoes.length > 0 && (
              <div className="space-y-1 text-xs">
                {blocoAtual.objecoes.map((o, i) => (
                  <div key={i} className="p-2 rounded border border-border/40 bg-card/30">
                    <div className="font-medium text-warning">{o.objecao}</div>
                    <div className="text-muted-foreground mt-0.5">→ {o.quebra}</div>
                  </div>
                ))}
              </div>
            )}
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

        <section
          className={`flex-1 flex items-center justify-center p-4 lg:p-6 bg-background/40 ${
            mobileTab !== "preview" ? "hidden lg:flex" : "flex"
          }`}
        >
          <div className="relative" style={{ width: 270, height: 480 }}>
            <div className="absolute inset-0 rounded-3xl overflow-hidden border border-border bg-gradient-to-br from-primary/30 to-accent/20">
              {backgroundUrl && (
                <>
                  {criativo.background_media_path?.match(/\.(mp4|webm|mov)$/i) ? (
                    <video src={backgroundUrl} className="absolute inset-0 w-full h-full object-cover" muted loop autoPlay playsInline />
                  ) : (
                    <img src={backgroundUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  )}
                </>
              )}
              <div className="absolute inset-x-0 top-0 h-[14%] bg-destructive/15 border-b border-destructive/30 pointer-events-none z-10" />
              <div className="absolute inset-x-0 bottom-0 h-[35%] bg-destructive/15 border-t border-destructive/30 pointer-events-none z-10" />
              <div className="absolute inset-x-4 top-[20%] bottom-[38%] flex items-center justify-center text-center font-display font-bold text-xl leading-tight overflow-hidden z-10 drop-shadow-lg">
                {roteiro[block]?.conteudo}
              </div>
              {audioUrl && (
                <audio src={audioUrl} controls className="absolute bottom-[40%] inset-x-4 w-[calc(100%-2rem)]" />
              )}
            </div>
          </div>
        </section>

        <aside
          className={`w-full lg:w-72 border-l border-border/50 p-4 space-y-5 overflow-auto ${
            mobileTab !== "export" ? "hidden lg:block" : ""
          }`}
        >
          {isVsl && vslExtras.vsl_diagnostico && (
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex items-center justify-between w-full text-left">
                <Label className="cursor-pointer">Diagnóstico VSL</Label>
                <ChevronDown className="size-4 text-muted-foreground" />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-2 text-xs">
                <div><span className="text-muted-foreground">Micropersona:</span> {vslExtras.vsl_diagnostico.nome_micropersona}</div>
                <div><span className="text-muted-foreground">Papel temido:</span> {vslExtras.vsl_diagnostico.papel_temido}</div>
                <div><span className="text-muted-foreground">Schwartz:</span> {vslExtras.vsl_diagnostico.nivel_consciencia_schwartz}</div>
                <div><span className="text-muted-foreground">Objeção principal:</span> {vslExtras.vsl_diagnostico.objecao_principal}</div>
              </CollapsibleContent>
            </Collapsible>
          )}
          {isVsl && vslExtras.vsl_sinais && (
            <Collapsible>
              <CollapsibleTrigger className="flex items-center justify-between w-full text-left">
                <Label className="cursor-pointer">Sinais Andromeda</Label>
                <ChevronDown className="size-4 text-muted-foreground" />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                <div>Hook rate: {vslExtras.vsl_sinais.hook_rate_estimado}</div>
                <div>Hold 30s: {vslExtras.vsl_sinais.hold_rate_30s}</div>
                <div>Conclusão: {vslExtras.vsl_sinais.taxa_conclusao_estimada}</div>
                {vslExtras.vsl_sinais.feedback_negativo_esperado && (
                  <div className="text-warning">Feedback negativo: {vslExtras.vsl_sinais.feedback_negativo_esperado}</div>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}
          {isVsl && vslExtras.vsl_producao && (
            <Collapsible>
              <CollapsibleTrigger className="flex items-center justify-between w-full text-left">
                <Label className="cursor-pointer">Indicações de produção</Label>
                <ChevronDown className="size-4 text-muted-foreground" />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                <div><span className="font-medium text-foreground">Formato:</span> {vslExtras.vsl_producao.formato_sugerido}</div>
                <div><span className="font-medium text-foreground">Tom:</span> {vslExtras.vsl_producao.tom_voz}</div>
                {vslExtras.vsl_producao.safe_zone && (
                  <div><span className="font-medium text-foreground">Safe zone:</span> {vslExtras.vsl_producao.safe_zone}</div>
                )}
                <div className="pt-1">{vslExtras.vsl_producao.hook_visual_detalhado}</div>
              </CollapsibleContent>
            </Collapsible>
          )}
          <div id="editor-audio" className="space-y-1.5">
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
          <div id="editor-media" className="space-y-1.5">
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

      <Dialog open={showPostExport} onOpenChange={setShowPostExport}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-success" /> Export concluído
            </DialogTitle>
          </DialogHeader>
          <PostExportContent
            utm={criativo.utm_content ?? criativoId}
            exportPaths={exportPaths}
            downloadUrls={downloadUrls}
            onCopyUtm={copyUtm}
            onMarcarSubiu={handleMarcarSubiu}
            markingSubiu={markingSubiu}
            exportDevMode={exportDevMode}
          />
        </DialogContent>
      </Dialog>

      {planUsage && (
        <ExportLimitModal
          open={exportLimitOpen}
          onOpenChange={setExportLimitOpen}
          exportsUsed={planUsage.exportsMes}
          exportsLimit={planUsage.limits.exportsMes}
        />
      )}
    </div>
  );
}

type PostExportContentProps = {
  utm: string;
  exportPaths: string[];
  downloadUrls: Record<string, string>;
  onCopyUtm: () => void;
  onMarcarSubiu: () => void;
  markingSubiu: boolean;
  exportDevMode: boolean;
};

function PostExportContent({
  utm,
  exportPaths,
  downloadUrls,
  onCopyUtm,
  onMarcarSubiu,
  markingSubiu,
  exportDevMode,
}: PostExportContentProps) {
  return (
    <div className="space-y-4">
      {exportDevMode && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/15 border border-warning/30 text-sm">
          <AlertTriangle className="size-4 text-warning shrink-0 mt-0.5" />
          <span>Estes MP4 são placeholders de desenvolvimento. Não suba no Meta até configurar o serviço FFmpeg.</span>
        </div>
      )}
      <div className="grid md:grid-cols-3 gap-4 text-sm">
        <div className="space-y-2">
          <p className="font-medium">Downloads</p>
          {exportPaths.map((p) => (
            <a
              key={p}
              href={downloadUrls[p] ?? "#"}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-primary-glow underline"
            >
              <Download className="size-3.5" />
              {p.includes("4x5") ? "Baixar 4:5" : "Baixar 9:16"}
            </a>
          ))}
        </div>
        <div className="space-y-2">
          <p className="font-medium">UTM para Meta</p>
          <code className="block text-xs bg-background/60 p-2 rounded font-mono truncate">{utm}</code>
          <Button size="sm" variant="outline" onClick={onCopyUtm}>
            <Copy className="size-3.5 mr-1" /> Copiar utm_content
          </Button>
        </div>
        <div className="space-y-2">
          <p className="font-medium">Checklist Meta</p>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Pixel e eventos de conversão ativos</li>
            <li>• CTA visível fora da safe zone inferior</li>
            <li>• utm_content no anúncio para rastrear</li>
          </ul>
          <MetaUploadGuide />
        </div>
      </div>
      <UtmBuilder utmContent={utm} />
      <div className="flex flex-wrap gap-2">
        <Button className="bg-gradient-primary border-0" onClick={onMarcarSubiu} disabled={markingSubiu}>
          {markingSubiu ? <Loader2 className="size-4 animate-spin" /> : <ExternalLink className="size-4 mr-1.5" />}
          Marcar como Subiu
        </Button>
        <Link to="/app/historico">
          <Button variant="outline">Ir ao histórico</Button>
        </Link>
      </div>
    </div>
  );
}

type PostExportBannerProps = PostExportContentProps & {
  onDismiss: () => void;
  onExpand: () => void;
  expanded: boolean;
};

function PostExportBanner({
  utm,
  exportPaths,
  downloadUrls,
  onCopyUtm,
  onMarcarSubiu,
  markingSubiu,
  onDismiss,
  onExpand,
  expanded,
  exportDevMode,
}: PostExportBannerProps) {
  if (!expanded) {
    return (
      <div className="px-6 py-2 bg-success/10 border-b border-success/30 flex items-center justify-between text-sm">
        <span className="flex items-center gap-2">
          <CheckCircle2 className="size-4 text-success" /> Export pronto — abra o checklist pós-export
        </span>
        <Button size="sm" variant="outline" onClick={onExpand}>
          Ver checklist
        </Button>
      </div>
    );
  }

  return (
    <div className="px-6 py-4 bg-success/10 border-b border-success/30">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display font-semibold flex items-center gap-2 text-sm">
          <CheckCircle2 className="size-4 text-success" /> Checklist pós-export
        </h2>
        <Button size="sm" variant="ghost" onClick={onDismiss}>Recolher</Button>
      </div>
      <PostExportContent
        utm={utm}
        exportPaths={exportPaths}
        downloadUrls={downloadUrls}
        onCopyUtm={onCopyUtm}
        onMarcarSubiu={onMarcarSubiu}
        markingSubiu={markingSubiu}
        exportDevMode={exportDevMode}
      />
    </div>
  );
}

type ExportDialogProps = {
  score: CriativoScore | null;
  onExport: () => void;
  onReavaliar: () => void;
  exporting: boolean;
  downloadUrls: Record<string, string>;
  exportPaths: string[];
  exportEtaLabel?: string;
};

function ExportDialog({
  score,
  onExport,
  onReavaliar,
  exporting,
  downloadUrls,
  exportPaths,
  exportEtaLabel,
}: ExportDialogProps) {
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
          {exporting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            `Exportar 9:16 + 4:5${exportEtaLabel ? ` (${exportEtaLabel})` : ""}`
          )}
        </Button>
      </div>
    </DialogContent>
  );
}
