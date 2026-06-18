import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef, useEffect, useCallback } from "react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Wand2, Sparkles, ArrowRight, Brain, Loader2, Target, Gauge,
  HelpCircle, Clock, TrendingDown, TrendingUp, Minus, EyeOff, Upload, AlertTriangle,
  Film, LayoutTemplate, RefreshCw, Layers, ChevronDown,
} from "lucide-react";
import {
  gerarAngulos,
  gerarPerguntaCirurgica,
  type ResultadoAngulos,
} from "@/lib/anthropic.functions";
import { saveGeracao, createCriativoDraft, getGeracaoResultado, getInteligenciaNicho, fetchProjectFormatContext, getGeradorEtaEstimates } from "@/lib/criativos.functions";
import { getPlanUsage } from "@/lib/plan.functions";
import { GeradorStepper } from "@/components/gerador-stepper";
import { UpgradeBanner } from "@/components/upgrade-banner";
import { Switch } from "@/components/ui/switch";
import {
  pickRecommendedAngulos,
  pickAbTestPackage,
  formatAnthropicError,
  angleIntelBadge,
  buildAbTestFormatoMap,
  runWithConcurrency,
} from "@/lib/gerador-helpers";
import { searchPexelsMedia, downloadPexelsToStorage } from "@/lib/stock-media.functions";
import { trackFunnelEvent } from "@/lib/funnel-events";
import { validateHttpUrl } from "@/lib/security-url";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useWorkspace } from "@/contexts/workspace-context";
import { useNavigate } from "@tanstack/react-router";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/use-auth";
import { uploadCriativoMedia } from "@/lib/storage";
import { toast } from "sonner";
import {
  buildFormatoPorAngulo,
  estiloProducaoBadge,
  estiloProducaoLabel,
  formatoBadgeLabel,
  formatoSaidaLabel,
  needsMediaUpload,
  overrideFromRecomendacao,
  type FormatoOverride,
} from "@/lib/formato-recomendacao";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const wizardSearchSchema = z.object({
  step: z.enum(["wizard"]).optional(),
  formato: z.enum(["criativo_curto", "vsl_curta"]).optional(),
});

const WIZARD_STORAGE_KEY = "andromeda_wizard_state";

type WizardPersisted = {
  geracaoId: string;
  selectedAngulos: number[];
  wizardStep: WizardStep;
  formatoPorAngulo: Record<number, FormatoOverride>;
  backgroundMediaPath: string | null;
};

export const Route = createFileRoute("/app/gerador")({
  validateSearch: wizardSearchSchema,
  head: () => ({
    meta: [
      { title: "Gerador de ângulos · Andromeda" },
      { name: "description", content: "5 ângulos por briefing com a metodologia Andromeda 2026." },
    ],
  }),
  component: Gerador,
});

const tipoColor: Record<string, string> = {
  Previsibilidade: "bg-primary/20 text-primary-glow border-primary/40",
  Escala: "bg-accent/20 text-accent border-accent/40",
  "Orgânico": "bg-success/20 text-success border-success/40",
};

const fbColor: Record<string, string> = {
  baixo: "bg-success/20 text-success border-success/40",
  medio: "bg-warning/20 text-warning border-warning/40",
  alto: "bg-destructive/20 text-destructive border-destructive/40",
};

const conspiracaoColor: Record<string, string> = {
  sem: "bg-muted/40 text-muted-foreground border-border",
  leve: "bg-warning/15 text-warning border-warning/30",
  forte: "bg-destructive/15 text-destructive border-destructive/30",
};

const saturacaoMeta: Record<string, { color: string; icon: typeof TrendingUp; label: string }> = {
  saturado: { color: "bg-destructive/15 text-destructive border-destructive/30", icon: TrendingDown, label: "Saturado" },
  neutro: { color: "bg-muted/40 text-muted-foreground border-border", icon: Minus, label: "Neutro" },
  sub_explorado: { color: "bg-success/15 text-success border-success/30", icon: TrendingUp, label: "Sub-explorado" },
};

const janelaColor: Record<string, string> = {
  atemporal: "bg-success/15 text-success border-success/30",
  media: "bg-primary/15 text-primary-glow border-primary/30",
  curta: "bg-warning/15 text-warning border-warning/30",
};

const confiancaColor: Record<string, string> = {
  alta: "bg-success/20 text-success border-success/40",
  media: "bg-primary/20 text-primary-glow border-primary/40",
  baixa: "bg-muted/40 text-muted-foreground border-border",
};

type Etapa = "input" | "respondendo" | "resultado" | "wizard";
type WizardStep = "producao" | "midia";

function Gerador() {
  const navigate = useNavigate();
  const { step: urlStep, formato: urlFormato } = Route.useSearch();
  const { organizationId, projectId, currentProject, setWorkspace } = useWorkspace();
  const askQuestion = useServerFn(gerarPerguntaCirurgica);
  const run = useServerFn(gerarAngulos);
  const persist = useServerFn(saveGeracao);
  const fetchGeracao = useServerFn(getGeracaoResultado);
  const createDraft = useServerFn(createCriativoDraft);
  const queryClient = useQueryClient();

  const [url, setUrl] = useState("");
  const [productType, setProductType] = useState("info");
  const [goal, setGoal] = useState("conv");
  const [context, setContext] = useState("");
  const [tomCalibracao, setTomCalibracao] = useState<"direto" | "empatico" | "autoritativo">("direto");

  const [etapa, setEtapa] = useState<Etapa>("input");
  const [pergunta, setPergunta] = useState<{ pergunta: string; justificativa: string } | null>(null);
  const [resposta, setResposta] = useState("");

  const [loadingPergunta, setLoadingPergunta] = useState(false);
  const [loadingAngulos, setLoadingAngulos] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [resultado, setResultado] = useState<ResultadoAngulos | null>(null);
  const [unsavedResultado, setUnsavedResultado] = useState<ResultadoAngulos | null>(null);
  const [geracaoId, setGeracaoId] = useState<string | null>(null);
  const [selectedAngulos, setSelectedAngulos] = useState<Set<number>>(new Set());
  const [wizardStep, setWizardStep] = useState<WizardStep>("producao");
  const [formatoPorAngulo, setFormatoPorAngulo] = useState<Record<number, FormatoOverride>>({});
  const [creatingDrafts, setCreatingDrafts] = useState(false);
  const [creatingVsl, setCreatingVsl] = useState(false);
  const [draftProgress, setDraftProgress] = useState<{ done: number; total: number } | null>(null);
  const [pendingFormato, setPendingFormato] = useState<"criativo_curto" | "vsl_curta" | null>(null);
  const [partialDrafts, setPartialDrafts] = useState<Array<{ id: string; nome: string }> | null>(null);
  const [batchChecklist, setBatchChecklist] = useState<Array<{ id: string; nome: string; needsMedia: boolean }> | null>(null);
  const [backgroundMediaPath, setBackgroundMediaPath] = useState<string | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [pexelsQuery, setPexelsQuery] = useState("");
  const [pexelsLoading, setPexelsLoading] = useState(false);
  const [pexelsResults, setPexelsResults] = useState<Array<{
    id: string; type: "image" | "video"; previewUrl: string; downloadUrl: string; attribution: string;
  }>>([]);
  const [modoRapido, setModoRapido] = useState(false);
  const mediaRef = useRef<HTMLInputElement>(null);
  const prevProjectRef = useRef<string | null>(null);
  const { user } = useAuth();

  const fetchIntel = useServerFn(getInteligenciaNicho);
  const fetchFormatCtx = useServerFn(fetchProjectFormatContext);
  const fetchEta = useServerFn(getGeradorEtaEstimates);
  const runPexelsSearch = useServerFn(searchPexelsMedia);
  const runPexelsDownload = useServerFn(downloadPexelsToStorage);
  const fetchPlanUsage = useServerFn(getPlanUsage);

  const { data: planUsage } = useQuery({
    queryKey: ["plan-usage", organizationId],
    queryFn: () => fetchPlanUsage({ data: { organizationId: organizationId! } }),
    enabled: !!organizationId,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (localStorage.getItem("gerador_completed_once") === "1") {
      setModoRapido(true);
    }
  }, []);

  const { data: eta } = useQuery({
    queryKey: ["gerador-eta"],
    queryFn: () => fetchEta(),
    staleTime: 300_000,
  });

  const { data: formatCtx } = useQuery({
    queryKey: ["project-format-ctx", projectId],
    queryFn: () => fetchFormatCtx({ data: { projectId: projectId! } }),
    enabled: !!projectId && !!resultado,
    staleTime: 120_000,
  });

  const { data: intelNicho } = useQuery({
    queryKey: ["inteligencia-nicho", projectId],
    queryFn: () => fetchIntel({ data: { projectId: projectId! } }),
    enabled: !!projectId && !!resultado,
    staleTime: 120_000,
  });

  const { data: geracaoRestored, isLoading: loadingGeracao, isError: geracaoRestoreError } = useQuery({
    queryKey: ["geracao-resultado", geracaoId],
    queryFn: () => fetchGeracao({ data: { geracaoId: geracaoId! } }),
    enabled: !!geracaoId && !resultado,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!geracaoRestored?.resultado || resultado) return;
    setResultado(geracaoRestored.resultado);
    if (geracaoRestored.url) setUrl(geracaoRestored.url);
    if (geracaoRestored.productType) setProductType(geracaoRestored.productType);
    if (geracaoRestored.goal) setGoal(geracaoRestored.goal);
    if (geracaoRestored.context) setContext(geracaoRestored.context);
  }, [geracaoRestored, resultado]);

  useEffect(() => {
    if (currentProject?.url_default) {
      setUrl(currentProject.url_default);
    }
  }, [currentProject?.url_default, projectId]);

  useEffect(() => {
    if (geracaoRestoreError) {
      toast.error("Não foi possível restaurar a geração salva");
      localStorage.removeItem(WIZARD_STORAGE_KEY);
      setGeracaoId(null);
    }
  }, [geracaoRestoreError]);

  useEffect(() => {
    if (urlFormato && urlStep === "wizard" && !geracaoId && !resultado && !loadingGeracao) {
      setPendingFormato(urlFormato);
      setEtapa("input");
      navigate({ to: "/app/gerador", search: {}, replace: true });
      toast.info(
        urlFormato === "vsl_curta"
          ? "Briefing pronto para VSL curta — gere seus ângulos e o formato será aplicado na produção."
          : "Gere seus ângulos primeiro — o formato será aplicado na produção.",
      );
    }
  }, [urlFormato, urlStep, geracaoId, resultado, loadingGeracao, navigate]);

  useEffect(() => {
    if (urlFormato && urlStep === "wizard" && geracaoId && resultado) {
      setEtapa("wizard");
      setWizardStep("producao");
    }
  }, [urlFormato, urlStep, geracaoId, resultado]);

  const initFormatoPorAngulo = useCallback(
    (indices: Iterable<number>, globalFormato?: "criativo_curto" | "vsl_curta") => {
      if (!resultado) return {};
      const map = buildFormatoPorAngulo(resultado.angulos, indices);
      if (globalFormato) {
        for (const idx of indices) {
          if (map[idx]) {
            map[idx] = { ...map[idx], formatoSaida: globalFormato, source: "manual" };
          }
        }
      }
      return map;
    },
    [resultado],
  );

  useEffect(() => {
    if (prevProjectRef.current && prevProjectRef.current !== projectId) {
      const hadProgress = etapa !== "input" || resultado !== null;
      if (hadProgress && !window.confirm("Trocar de projeto vai descartar o progresso atual. Continuar?")) {
        if (organizationId) setWorkspace(organizationId, prevProjectRef.current);
        return;
      }
      setEtapa("input");
      setPergunta(null);
      setResposta("");
      setResultado(null);
      setGeracaoId(null);
      setSelectedAngulos(new Set());
      setWizardStep("producao");
      setFormatoPorAngulo({});
      setBackgroundMediaPath(null);
      localStorage.removeItem(WIZARD_STORAGE_KEY);
      queryClient.invalidateQueries({ queryKey: ["criativos"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      if (currentProject?.url_default) setUrl(currentProject.url_default);
      else setUrl("");
      toast.info(`Projeto alterado para ${currentProject?.name ?? "novo projeto"}`);
    }
    prevProjectRef.current = projectId;
  }, [projectId, currentProject?.name, currentProject?.url_default, queryClient, etapa, resultado, organizationId, setWorkspace]);

  const persistWizard = useCallback((patch: Partial<WizardPersisted> & { geracaoId?: string }) => {
    if (!geracaoId && !patch.geracaoId) return;
    try {
      const raw = localStorage.getItem(WIZARD_STORAGE_KEY);
      const prev = raw ? (JSON.parse(raw) as WizardPersisted) : null;
      const next: WizardPersisted = {
        geracaoId: patch.geracaoId ?? geracaoId ?? prev?.geracaoId ?? "",
        selectedAngulos: patch.selectedAngulos ?? prev?.selectedAngulos ?? [...selectedAngulos],
        wizardStep: patch.wizardStep ?? wizardStep,
        formatoPorAngulo: patch.formatoPorAngulo ?? formatoPorAngulo,
        backgroundMediaPath: patch.backgroundMediaPath !== undefined ? patch.backgroundMediaPath : backgroundMediaPath,
      };
      localStorage.setItem(WIZARD_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, [geracaoId, selectedAngulos, wizardStep, formatoPorAngulo, backgroundMediaPath]);

  useEffect(() => {
    if (urlStep === "wizard" && geracaoId) {
      setEtapa("wizard");
    }
  }, [urlStep, geracaoId]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(WIZARD_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as WizardPersisted;
      if (!saved.geracaoId) return;
      setGeracaoId(saved.geracaoId);
      setSelectedAngulos(new Set(saved.selectedAngulos));
      setWizardStep(saved.wizardStep === "formato" || saved.wizardStep === "estilo" || saved.wizardStep === "selecao" ? "producao" : saved.wizardStep);
      if (saved.formatoPorAngulo) {
        setFormatoPorAngulo(saved.formatoPorAngulo);
      } else if ("formatoSaida" in saved && saved.formatoSaida) {
        const legacy = saved as unknown as { formatoSaida: FormatoOverride["formatoSaida"]; estiloProducao: FormatoOverride["estiloProducao"] };
        const legacyMap: Record<number, FormatoOverride> = {};
        for (const idx of saved.selectedAngulos) {
          legacyMap[idx] = {
            formatoSaida: legacy.formatoSaida,
            estiloProducao: legacy.estiloProducao,
            aspectRatioPrioritario: "9:16",
            source: "manual",
          };
        }
        setFormatoPorAngulo(legacyMap);
      }
      setBackgroundMediaPath(saved.backgroundMediaPath);
      if (urlStep === "wizard") setEtapa("wizard");
    } catch {
      /* ignore */
    }
  }, [urlStep]);

  async function handleAskQuestion() {
    if (!url.trim()) {
      toast.error("Informe a URL do site");
      return;
    }
    try {
      validateHttpUrl(url);
    } catch {
      toast.error("Informe uma URL válida (http ou https)");
      return;
    }
    setLoadingPergunta(true);
    try {
      const data = await askQuestion({ data: { url, productType, goal, context } });
      setPergunta(data);
      setEtapa("respondendo");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Erro ao gerar pergunta");
    } finally {
      setLoadingPergunta(false);
    }
  }

  async function runGerarAngulos(skipPergunta = false, updateGeracaoId?: string | null) {
    if (!url.trim()) {
      toast.error("Informe a URL do site");
      return;
    }
    try {
      validateHttpUrl(url);
    } catch {
      toast.error("Informe uma URL válida (http ou https)");
      return;
    }
    if (!skipPergunta && !resposta.trim()) {
      toast.error("Responda a pergunta cirúrgica antes de gerar os ângulos");
      return;
    }
    if (!organizationId || !projectId) {
      toast.error("Selecione um projeto no header");
      return;
    }
    const etaSec = eta?.angulosSec ?? 60;
    setLoadingAngulos(true);
    setLoadingStep(`Consultando IA (estimativa ~${etaSec}s)…`);
    const start = Date.now();
    const existingId = updateGeracaoId ?? geracaoId;
    try {
      const data = await run({
        data: {
          url, productType, goal, context,
          perguntaCirurgica: skipPergunta ? "Geração direta" : (pergunta?.pergunta ?? ""),
          respostaCirurgica: skipPergunta ? context || "Gerar com contexto mínimo da URL." : resposta,
          tomCalibracao,
          projectId: projectId ?? undefined,
        },
      });

      let saved: { geracaoId: string };
      try {
        saved = await persist({
          data: {
            url, productType, goal, context,
            resultado: data,
            criarCriativos: false,
            projectId,
            organizationId,
            geracaoId: existingId ?? undefined,
          },
        });
      } catch (persistErr) {
        setUnsavedResultado(data);
        const msg = persistErr instanceof Error ? persistErr.message : "Erro ao salvar geração";
        toast.error(formatAnthropicError(msg), {
          action: { label: "Tentar salvar", onClick: () => void retrySaveGeracao(data, existingId) },
        });
        return;
      }

      setUnsavedResultado(null);
      setResultado(data);
      setGeracaoId(saved.geracaoId);
      setEtapa("resultado");
      persistWizard({ geracaoId: saved.geracaoId, selectedAngulos: [...selectedAngulos] });
      queryClient.invalidateQueries({ queryKey: ["criativos"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      const durationMs = Date.now() - start;
      trackFunnelEvent({ userId: user?.id, organizationId, event: "angulos_gerados", success: true, durationMs });
      trackFunnelEvent({ userId: user?.id, organizationId, event: "wizard_step", success: true, durationMs });
      localStorage.setItem("gerador_completed_once", "1");

      if (durationMs > 90000) toast.warning("Geração levou mais de 90 segundos");
      toast.success(existingId ? "Ângulos atualizados" : "Ângulos salvos");
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "Erro ao gerar ângulos";
      if (msg.includes("Unauthorized")) {
        navigate({ to: "/login" });
        return;
      }
      toast.error(formatAnthropicError(msg));
    } finally {
      setLoadingAngulos(false);
      setLoadingStep("");
    }
  }

  async function retrySaveGeracao(data: ResultadoAngulos, existingId?: string | null) {
    if (!organizationId || !projectId) {
      toast.error("Selecione um projeto no header");
      return;
    }
    try {
      const saved = await persist({
        data: {
          url, productType, goal, context,
          resultado: data,
          criarCriativos: false,
          projectId,
          organizationId,
          geracaoId: existingId ?? geracaoId ?? undefined,
        },
      });
      setUnsavedResultado(null);
      setResultado(data);
      setGeracaoId(saved.geracaoId);
      setEtapa("resultado");
      persistWizard({ geracaoId: saved.geracaoId, selectedAngulos: [...selectedAngulos] });
      queryClient.invalidateQueries({ queryKey: ["criativos"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      trackFunnelEvent({ userId: user?.id, organizationId, event: "angulos_gerados", success: true });
      toast.success("Geração salva com sucesso");
    } catch (e) {
      toast.error(formatAnthropicError(e instanceof Error ? e.message : "Erro ao salvar"));
    }
  }

  async function handleGenerate() {
    await runGerarAngulos(false);
  }

  async function handleGenerateDirect() {
    await runGerarAngulos(true);
  }

  async function handleRegenerateAngles() {
    if (!geracaoId) {
      toast.error("Salve uma geração antes de regenerar");
      return;
    }
    setSelectedAngulos(new Set());
    await runGerarAngulos(!!context.trim(), geracaoId);
  }

  async function applyMediaFallback(mediaIndices: number[]): Promise<Record<number, FormatoOverride> | null> {
    const useFallback = window.confirm(
      "Sem mídia de fundo, clipes+texto tende a performar mal no Meta.\n\nUsar texto animado como fallback para esses ângulos?",
    );
    if (!useFallback) return null;
    const next = { ...formatoPorAngulo };
    for (const idx of mediaIndices) {
      if (next[idx]) {
        next[idx] = { ...next[idx], estiloProducao: "texto_animado", source: "manual" };
      }
    }
    setFormatoPorAngulo(next);
    toast.warning("Formato alterado para texto animado nos ângulos sem mídia.");
    return next;
  }

  async function handleCreateDrafts() {
    if (!geracaoId || !organizationId || !projectId || selectedAngulos.size === 0) {
      toast.error("Selecione ao menos um ângulo");
      return;
    }

    let fmtMap = formatoPorAngulo;
    const mediaIndices = resultado
      ? needsMediaUpload(resultado.angulos, selectedAngulos, fmtMap)
      : [];
    if (mediaIndices.length > 0 && !backgroundMediaPath) {
      const fallback = await applyMediaFallback(mediaIndices);
      if (!fallback) {
        toast.error("Envie mídia de fundo ou aceite o fallback para texto animado");
        setWizardStep("midia");
        return;
      }
      fmtMap = fallback;
    }

    setCreatingDrafts(true);
    const indices = [...selectedAngulos].sort((a, b) => a - b);
    const vslTotal = indices.filter((idx) => fmtMap[idx]?.formatoSaida === "vsl_curta").length;
    const hasVsl = vslTotal > 0;
    if (hasVsl) setCreatingVsl(true);
    setDraftProgress({ done: 0, total: indices.length });
    const draftStart = Date.now();

    const created: Array<{ id: string; idx: number }> = [];
    const failed: number[] = [];
    let vslDone = 0;

    try {
      const tasks = indices.map((idx) => async () => {
        const fmt = fmtMap[idx];
        if (!fmt) throw new Error(`Configure o formato do ângulo ${idx + 1}`);
        const { criativoId, vslDevMode } = await createDraft({
          data: {
            geracaoId,
            anguloIndex: idx,
            formatoSaida: fmt.formatoSaida,
            estiloProducao: fmt.estiloProducao,
            formatoSource: fmt.source,
            aspectRatioPrioritario: fmt.aspectRatioPrioritario,
            projectId,
            organizationId,
            backgroundMediaPath: backgroundMediaPath ?? undefined,
          },
        });
        if (fmt.formatoSaida === "vsl_curta") {
          vslDone += 1;
          if (vslDevMode) toast.info(`Ângulo ${idx + 1}: roteiro VSL em modo offline (sem API key)`);
        }
        setDraftProgress((p) => (p ? { ...p, done: p.done + 1 } : null));
        return { id: criativoId, idx };
      });

      const results = await runWithConcurrency(tasks, 2);

      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (r.status === "fulfilled") created.push(r.value);
        else failed.push(indices[i]);
      }

      if (created.length === 0) {
        toast.error("Nenhum rascunho criado — verifique a configuração");
        return;
      }

      localStorage.removeItem(WIZARD_STORAGE_KEY);
      queryClient.invalidateQueries({ queryKey: ["criativos"] });
      trackFunnelEvent({
        userId: user?.id,
        organizationId,
        event: "draft_created",
        success: true,
        durationMs: Date.now() - draftStart,
        metadata: { count: created.length, vslCount: vslDone },
      });

      const draftList = created.map((c) => ({
        id: c.id,
        nome: resultado?.angulos[c.idx]?.nome ?? `Ângulo ${c.idx + 1}`,
        needsMedia:
          fmtMap[c.idx]?.estiloProducao === "clipes_texto" ||
          fmtMap[c.idx]?.estiloProducao === "ugc_avatar",
      }));

      if (failed.length > 0) {
        setPartialDrafts(draftList.map(({ id, nome }) => ({ id, nome })));
        toast.warning(`${created.length} criado(s), ${failed.length} falhou(aram)`);
        navigate({
          to: "/app/editor",
          search: { criativoId: created[0].id, focus: "audio" },
        });
        return;
      }

      const first = created[0];
      toast.success(
        created.length === 1
          ? "Rascunho criado — próximo: gerar áudio"
          : `${created.length} rascunhos criados — abrindo o primeiro`,
      );
      if (created.length > 1) {
        setBatchChecklist(draftList);
      }
      navigate({ to: "/app/editor", search: { criativoId: first.id, focus: "audio" } });
    } catch (e) {
      if (created.length > 0) {
        setPartialDrafts(
          created.map((c) => ({
            id: c.id,
            nome: resultado?.angulos[c.idx]?.nome ?? `Ângulo ${c.idx + 1}`,
          })),
        );
      }
      toast.error(e instanceof Error ? e.message : "Erro ao criar rascunho");
    } finally {
      setCreatingDrafts(false);
      setCreatingVsl(false);
      setDraftProgress(null);
    }
  }

  return (
    <div className="container mx-auto px-6 py-8 max-w-6xl space-y-8 relative">
      {loadingAngulos && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur flex items-center justify-center">
          <Card className="glass p-8 max-w-md text-center space-y-4">
            <Loader2 className="size-10 animate-spin text-primary-glow mx-auto" />
            <p className="font-medium">{loadingStep}</p>
            <p className="text-sm text-muted-foreground">
              Estimativa baseada no histórico: ~{eta?.angulosSec ?? 60}s. Não feche a página.
            </p>
          </Card>
        </div>
      )}

      {creatingDrafts && (
        <div className="fixed inset-0 z-50 bg-background/85 backdrop-blur flex items-center justify-center">
          <Card className="glass p-8 max-w-md text-center space-y-4">
            <Loader2 className="size-10 animate-spin text-primary-glow mx-auto" />
            <p className="font-medium">
              {draftProgress
                ? `${draftProgress.done}/${draftProgress.total} rascunho(s) criado(s)`
                : "Criando rascunhos…"}
            </p>
            {creatingVsl && draftProgress && (
              <p className="text-sm text-primary-glow">
                VSL em andamento — ~{eta?.vslSec ?? 45}s cada (máx. 2 em paralelo)
              </p>
            )}
            <p className="text-sm text-muted-foreground">Aguarde — não navegue até concluir.</p>
          </Card>
        </div>
      )}

      {!projectId && (
        <div className="flex items-center gap-2 p-4 rounded-lg border border-warning/40 bg-warning/10 text-sm">
          <AlertTriangle className="size-4 text-warning shrink-0" />
          Selecione um projeto no header antes de gerar ângulos.
        </div>
      )}

      {planUsage && !planUsage.canGerar && (
        <UpgradeBanner message={`Limite de gerações do plano grátis (${planUsage.geracoesMes}/${planUsage.limits.geracoesMes} este mês).`} />
      )}

      {(etapa !== "input" || modoRapido || resultado) && <GeradorStepper etapa={etapa} />}

      {unsavedResultado && (
        <div className="flex items-center justify-between gap-3 p-4 rounded-lg border border-warning/40 bg-warning/10 text-sm">
          <span>Ângulos gerados mas não salvos — crie rascunhos após salvar.</span>
          <Button size="sm" variant="outline" onClick={() => void retrySaveGeracao(unsavedResultado)}>
            Tentar salvar
          </Button>
        </div>
      )}

      {pendingFormato && (
        <div className="flex items-center justify-between gap-3 p-4 rounded-lg border border-primary/40 bg-primary/10 text-sm">
          <span>
            Formato <strong>{pendingFormato === "vsl_curta" ? "VSL curta" : "criativo curto"}</strong> será aplicado ao criar rascunhos.
          </span>
          <Button size="sm" variant="ghost" onClick={() => setPendingFormato(null)}>Ok</Button>
        </div>
      )}

      {(etapa === "input" || etapa === "respondendo") && (
      <>
      <div>
        <h1 className="text-3xl font-display font-bold">Gerador de ângulos</h1>
        <p className="text-muted-foreground mt-1">
          {modoRapido
            ? "Modo rápido: URL + objetivo → 5 ângulos em uma etapa."
            : "Cole a URL, responda a pergunta cirúrgica e gere 5 ângulos com lógica probabilística Andromeda 2026."}
        </p>
        <div className="flex items-center gap-2 mt-3">
          <Switch id="modo-rapido" checked={modoRapido} onCheckedChange={setModoRapido} />
          <Label htmlFor="modo-rapido" className="text-sm cursor-pointer">Modo rápido</Label>
        </div>
      </div>

      <Card className="glass bg-gradient-card p-6">
        <div className={`grid grid-cols-1 gap-4 ${modoRapido ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
          <div className="space-y-1.5">
            <Label>URL do site</Label>
            <Input placeholder="https://seuproduto.com" value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
          {!modoRapido && (
          <div className="space-y-1.5">
            <Label>Tipo de produto</Label>
            <Select value={productType} onValueChange={setProductType}>
              <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ecom">E-commerce físico</SelectItem>
                <SelectItem value="info">Infoproduto</SelectItem>
                <SelectItem value="saas">SaaS</SelectItem>
                <SelectItem value="ticket">Serviço de alto ticket</SelectItem>
                <SelectItem value="saude">Saúde e bem-estar</SelectItem>
              </SelectContent>
            </Select>
          </div>
          )}
          <div className="space-y-1.5">
            <Label>Objetivo</Label>
            <Select value={goal} onValueChange={setGoal}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="conv">Conversão</SelectItem>
                <SelectItem value="leads">Leads</SelectItem>
                <SelectItem value="traf">Tráfego</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Contexto adicional (opcional)</Label>
            <Textarea
              placeholder="Preço, concorrente, público específico..."
              rows={2}
              value={context}
              onChange={(e) => setContext(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Calibração de tom</Label>
            <Select value={tomCalibracao} onValueChange={(v) => setTomCalibracao(v as typeof tomCalibracao)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="direto">Direto e agressivo</SelectItem>
                <SelectItem value="empatico">Empático e suave</SelectItem>
                <SelectItem value="autoritativo">Autoritativo e técnico</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Aplicado bloco a bloco: hook usa linguagem da micropersona, mecanismo é sempre técnico, CTA sempre direto.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2 justify-end">
          {modoRapido ? (
            <Button
              onClick={handleGenerateDirect}
              disabled={loadingAngulos || !url.trim() || (planUsage ? !planUsage.canGerar : false)}
              className="min-h-11 bg-gradient-primary border-0 shadow-glow"
            >
              {loadingAngulos ? (
                <><Loader2 className="size-4 mr-1.5 animate-spin" /> Gerando 5 ângulos…</>
              ) : (
                <><Sparkles className="size-4 mr-1.5" /> Gerar 5 ângulos agora</>
              )}
            </Button>
          ) : etapa !== "respondendo" ? (
            <>
              <Button
                variant="outline"
                className="min-h-11"
                onClick={handleGenerateDirect}
                disabled={loadingPergunta || loadingAngulos || !url.trim()}
              >
                Gerar direto (sem pergunta)
              </Button>
              <Button
                onClick={handleAskQuestion}
                disabled={loadingPergunta || loadingAngulos}
                className="min-h-11 bg-gradient-primary border-0 shadow-glow"
              >
                {loadingPergunta ? (
                  <><Loader2 className="size-4 mr-1.5 animate-spin" /> Gerando pergunta...</>
                ) : (
                  <><HelpCircle className="size-4 mr-1.5" /> Gerar pergunta cirúrgica</>
                )}
              </Button>
            </>
          ) : null}
        </div>
      </Card>
      </>
      )}

      {etapa !== "wizard" && etapa === "respondendo" && pergunta && (
        <Card className="glass bg-gradient-card p-6 border border-primary/30">
          <div className="flex items-center gap-2 mb-3">
            <HelpCircle className="size-5 text-primary-glow" />
            <h2 className="font-display text-xl font-semibold">Pergunta cirúrgica</h2>
          </div>
          <p className="text-lg font-medium">{pergunta.pergunta}</p>
          <p className="text-xs text-muted-foreground mt-2 italic">Por que: {pergunta.justificativa}</p>

          <div className="mt-4 space-y-1.5">
            <Label>Sua resposta</Label>
            <Textarea
              rows={4}
              value={resposta}
              onChange={(e) => setResposta(e.target.value)}
              placeholder="Responda com o máximo de detalhe e linguagem do cliente real..."
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2 justify-end">
            <Button variant="outline" onClick={() => { setEtapa("input"); setPergunta(null); setResposta(""); }}>
              Voltar
            </Button>
            <Button
              onClick={() => handleGenerate()}
              disabled={loadingAngulos || !resposta.trim()}
              className="bg-gradient-primary border-0 shadow-glow"
            >
              {loadingAngulos ? (
                <><Loader2 className="size-4 mr-1.5 animate-spin" /> {loadingStep || "Gerando..."}</>
              ) : (
                <><Wand2 className="size-4 mr-1.5" /> Gerar 5 ângulos</>
              )}
            </Button>
          </div>
        </Card>
      )}

      {resultado && etapa === "resultado" && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-display font-bold">5 ângulos gerados</h1>
              <p className="text-muted-foreground mt-1">Selecione os que quer transformar em rascunhos.</p>
            </div>
            <Link to="/app/historico">
              <Button variant="outline" size="sm">Ver criativos</Button>
            </Link>
          </div>
          <Card className="glass bg-gradient-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Brain className="size-5 text-primary-glow" />
              <h2 className="font-display text-xl font-semibold">Diagnóstico do produto</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {[
                { l: "Mecanismo da oferta", v: resultado.diagnostico.mecanismo },
                { l: "Nível de consciência (Schwartz)", v: resultado.diagnostico.nivel_consciencia },
                { l: "Sofisticação do mercado", v: resultado.diagnostico.sofisticacao_mercado },
                { l: "Variável de maior oportunidade agora", v: resultado.diagnostico.variavel_oportunidade },
                ...(resultado.diagnostico.framework_copy_atual
                  ? [{ l: "Framework de copy atual", v: resultado.diagnostico.framework_copy_atual }]
                  : []),
                ...(resultado.diagnostico.panorama_formatos_nicho
                  ? [{ l: "Panorama de formatos no nicho", v: resultado.diagnostico.panorama_formatos_nicho }]
                  : []),
              ].map((d) => (
                <div key={d.l} className="p-4 rounded-lg bg-background/40 border border-border/50">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">{d.l}</div>
                  <div className="mt-1.5 font-medium">{d.v}</div>
                </div>
              ))}
            </div>
          </Card>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="font-display text-xl font-semibold">Selecione os ângulos</h2>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const picks = pickRecommendedAngulos(resultado, 2);
                    setSelectedAngulos(new Set(picks));
                    toast.success("2 ângulos recomendados selecionados");
                  }}
                >
                  Selecionar recomendados (2)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const picks = pickAbTestPackage(resultado);
                    setSelectedAngulos(new Set(picks));
                    const map = buildAbTestFormatoMap(resultado.angulos, picks, formatCtx ?? null);
                    const globalFmt = pendingFormato ?? urlFormato;
                    if (globalFmt) {
                      for (const idx of picks) {
                        if (map[idx]) map[idx] = { ...map[idx], formatoSaida: globalFmt, source: "manual" };
                      }
                    }
                    setFormatoPorAngulo(map);
                    toast.success("Pacote A/B: 3 ângulos com formatos diversificados");
                  }}
                >
                  <Layers className="size-3.5 mr-1" /> Pacote A/B (3)
                </Button>
                <Button variant="outline" size="sm" onClick={() => void handleRegenerateAngles()} disabled={loadingAngulos}>
                  <RefreshCw className="size-3.5 mr-1" /> Gerar outros 5
                </Button>
                <Button
                  className="bg-gradient-primary border-0"
                  disabled={selectedAngulos.size === 0}
                  onClick={() => {
                    const globalFmt = pendingFormato ?? urlFormato;
                    const map = initFormatoPorAngulo(selectedAngulos, globalFmt ?? undefined);
                    setFormatoPorAngulo(map);
                    setEtapa("wizard");
                    setWizardStep("producao");
                    navigate({ to: "/app/gerador", search: { step: "wizard" } });
                    persistWizard({ wizardStep: "producao", selectedAngulos: [...selectedAngulos], formatoPorAngulo: map });
                    trackFunnelEvent({ userId: user?.id, organizationId, event: "wizard_step" });
                  }}
                >
                  Continuar <ArrowRight className="size-4 ml-1.5" />
                </Button>
              </div>
            </div>
            <Card className="glass p-4 mb-4 overflow-x-auto">
              <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wide">Comparador rápido</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>Ângulo</TableHead>
                    <TableHead>Hook</TableHead>
                    <TableHead>Schwartz</TableHead>
                    <TableHead>Formato IA</TableHead>
                    <TableHead>Saturação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resultado.angulos.map((a, i) => {
                    const rec = a.recomendacao_formato;
                    const sat = saturacaoMeta[a.saturacao_hook?.status] ?? saturacaoMeta.neutro;
                    const SatIcon = sat.icon;
                    return (
                      <TableRow
                        key={i}
                        className={selectedAngulos.has(i) ? "bg-primary/5" : undefined}
                        onClick={() => {
                          const next = new Set(selectedAngulos);
                          if (next.has(i)) next.delete(i);
                          else next.add(i);
                          setSelectedAngulos(next);
                        }}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedAngulos.has(i)}
                            onCheckedChange={(checked) => {
                              const next = new Set(selectedAngulos);
                              if (checked) next.add(i);
                              else next.delete(i);
                              setSelectedAngulos(next);
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </TableCell>
                        <TableCell className="font-medium text-sm">{a.nome}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate" title={a.hook}>
                          {a.hook}
                        </TableCell>
                        <TableCell className="text-sm">{a.nivel_schwartz}</TableCell>
                        <TableCell className="text-sm">
                          {rec ? formatoBadgeLabel(overrideFromRecomendacao(rec), rec.duracao_alvo_seg) : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`${sat.color} text-[10px]`}>
                            <SatIcon className="size-3 mr-1" /> {sat.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
            <Accordion type="multiple" className="space-y-3">
              {resultado.angulos.map((a, i) => {
                const sat = saturacaoMeta[a.saturacao_hook?.status] ?? saturacaoMeta.neutro;
                const SatIcon = sat.icon;
                const rec = a.recomendacao_formato;
                const fmtBadge = rec
                  ? formatoBadgeLabel(overrideFromRecomendacao(rec), rec.duracao_alvo_seg)
                  : null;
                const intelBadge = intelNicho?.topAngulos
                  ? angleIntelBadge(a.nome, intelNicho.topAngulos)
                  : null;
                return (
                  <AccordionItem key={i} value={`a${i}`} className="glass bg-gradient-card rounded-xl border-0 overflow-hidden">
                    <div className="flex items-center gap-3 px-5 pt-4">
                      <Checkbox
                        checked={selectedAngulos.has(i)}
                        onCheckedChange={(checked) => {
                          const next = new Set(selectedAngulos);
                          if (checked) next.add(i); else next.delete(i);
                          setSelectedAngulos(next);
                        }}
                      />
                      <AccordionTrigger className="hover:no-underline flex-1 py-0">
                        <div className="flex items-center gap-3 text-left flex-1 pr-4">
                        <div className="size-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                          <Sparkles className="size-4 text-primary-glow" />
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold">
                            {a.numero ? `${a.numero}. ` : ""}{a.nome}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Micropersona: {a.micropersona?.nome} — teme perder o papel de {a.micropersona?.papel_temido}
                          </div>
                          {intelBadge && (
                            <Badge variant="outline" className="mt-1 text-[10px] bg-success/10 border-success/30">
                              {intelBadge}
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                          {fmtBadge && (
                            <Badge variant="outline" className="text-[10px] bg-accent/10 border-accent/30">
                              <Film className="size-3 mr-1" /> {fmtBadge}
                            </Badge>
                          )}
                          {rec && (
                            <Badge variant="secondary" className="text-[10px]">
                              {estiloProducaoBadge(rec.estilo_producao)}
                            </Badge>
                          )}
                          <Badge variant="outline" className={tipoColor[a.tipo] ?? ""}>{a.tipo}</Badge>
                          {a.nivel_conspiracao && a.nivel_conspiracao !== "sem" && (
                            <Badge variant="outline" className={conspiracaoColor[a.nivel_conspiracao] ?? ""}>
                              <EyeOff className="size-3 mr-1" /> Conspiração {a.nivel_conspiracao}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </AccordionTrigger>
                    </div>
                    <AccordionContent className="space-y-4 pt-3 px-5 pb-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div className="p-3 rounded bg-background/40 border border-border/50">
                          <div className="text-xs text-muted-foreground uppercase tracking-wide">Variável explorada</div>
                          <div className="font-medium mt-0.5">{a.variavel_explorada}</div>
                        </div>
                        <div className="p-3 rounded bg-background/40 border border-border/50">
                          <div className="text-xs text-muted-foreground uppercase tracking-wide">Nível Schwartz</div>
                          <div className="font-medium mt-0.5">{a.nivel_schwartz}</div>
                        </div>
                        <div className="p-3 rounded bg-background/40 border border-border/50">
                          <div className="text-xs text-muted-foreground uppercase tracking-wide">Nível de conspiração</div>
                          <div className="font-medium mt-0.5 capitalize">{a.nivel_conspiracao}</div>
                        </div>
                        <div className="p-3 rounded bg-background/40 border border-border/50">
                          <div className="text-xs text-muted-foreground uppercase tracking-wide">Hook visual</div>
                          <div className="font-medium mt-0.5">{a.hook_visual}</div>
                        </div>
                      </div>

                      {rec && (
                        <div className="p-4 rounded-lg bg-accent/10 border border-accent/30 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <LayoutTemplate className="size-4 text-accent" />
                            <span className="text-xs uppercase tracking-wide text-accent font-medium">Formato recomendado</span>
                            <Badge variant="outline" className={confiancaColor[rec.confianca] ?? ""}>
                              Confiança {rec.confianca}
                            </Badge>
                            {rec.requer_midia_usuario && (
                              <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-[10px]">
                                Requer mídia
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">{rec.justificativa}</p>
                          {rec.formato_saida === "vsl_curta" && (
                            <p className="text-sm text-primary-glow">
                              Ao criar o rascunho, a IA gera roteiro VSL completo de ~2 min (6 blocos, hook visual, objeções e CTA com valor).
                            </p>
                          )}
                          {rec.formatos_saturados_nicho.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              Saturados no nicho: {rec.formatos_saturados_nicho.join(", ")}
                            </p>
                          )}
                        </div>
                      )}

                      <div className="p-4 rounded-lg bg-primary/10 border border-primary/30">
                        <div className="text-xs uppercase tracking-wide text-primary-glow mb-1">Hook · 0–3s</div>
                        <div className="font-medium">{a.hook}</div>
                      </div>

                      <div>
                        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Estrutura bloco a bloco</div>
                        <div className="space-y-2">
                          {a.estrutura.map((b, idx) => (
                            <div key={idx} className="flex gap-3 text-sm">
                              <div className="w-14 shrink-0 text-primary-glow font-mono text-xs pt-0.5">{b.tempo}</div>
                              <div className="flex-1 text-muted-foreground">{b.conteudo}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="p-3 rounded bg-accent/10 border border-accent/30 text-sm">
                        <div className="text-xs uppercase tracking-wide text-accent mb-1">CTA</div>
                        <div className="font-medium">{a.cta}</div>
                      </div>

                      <div className="p-3 rounded bg-background/40 border border-border/50 text-sm">
                        <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground mb-1">
                          <Target className="size-3.5" /> Justificativa probabilística
                        </div>
                        <div className="text-muted-foreground leading-relaxed">{a.justificativa_probabilistica}</div>
                      </div>

                      <div className="p-3 rounded bg-background/40 border border-border/50">
                        <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground mb-2">
                          <Gauge className="size-3.5" /> Sinais Andromeda esperados
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                          <div>
                            <div className="text-xs text-muted-foreground">Hook rate</div>
                            <div className="font-medium">{a.sinais_andromeda?.hook_rate_estimado}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">Feedback negativo</div>
                            <Badge variant="outline" className={fbColor[a.sinais_andromeda?.feedback_negativo_esperado] ?? ""}>
                              {a.sinais_andromeda?.feedback_negativo_esperado}
                            </Badge>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">Saturação do hook</div>
                            <Badge variant="outline" className={sat.color} title={a.saturacao_hook?.observacao}>
                              <SatIcon className="size-3 mr-1" /> {sat.label}
                            </Badge>
                          </div>
                          <div className="md:col-span-3">
                            <div className="text-xs text-muted-foreground">Fatia de leilão</div>
                            <div className="font-medium">{a.sinais_andromeda?.fatia_leilao}</div>
                          </div>
                          {a.saturacao_hook?.observacao && (
                            <div className="md:col-span-3 text-xs text-muted-foreground italic">
                              {a.saturacao_hook.observacao}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="p-3 rounded bg-background/40 border border-border/50">
                        <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground mb-2">
                          <Clock className="size-3.5" /> Janela de relevância
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <Badge variant="outline" className={janelaColor[a.janela_relevancia?.tipo] ?? ""}>
                            {a.janela_relevancia?.tipo}
                          </Badge>
                          <span className="font-medium">{a.janela_relevancia?.estimativa}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5">{a.janela_relevancia?.motivo}</p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        </>
      )}

      {etapa === "wizard" && (
        <div>
          <h1 className="text-3xl font-display font-bold">Produção dos rascunhos</h1>
          <p className="text-muted-foreground mt-1">Configure formato e mídia antes de abrir no editor.</p>
        </div>
      )}

      {etapa === "wizard" && (
        <Card className="glass bg-gradient-card p-6 space-y-6">
          {loadingGeracao && !resultado && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="size-4 animate-spin" /> Carregando geração salva...
            </div>
          )}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold">Configurar produção</h2>
              <Button variant="link" className="h-auto p-0 text-xs text-muted-foreground" onClick={() => setEtapa("resultado")}>
                ← Voltar aos ângulos
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              {selectedAngulos.size} ângulo(s) → {selectedAngulos.size} rascunho(s)
              {draftProgress && ` · ${draftProgress.done}/${draftProgress.total}`}
            </p>
          </div>
          <div className="flex gap-2 text-xs">
            {(["producao", "midia"] as WizardStep[]).map((s, i) => (
              <span
                key={s}
                className={`px-2 py-1 rounded ${wizardStep === s ? "bg-primary/20 text-primary-glow" : "text-muted-foreground"}`}
              >
                {i + 1}. {s === "producao" ? "produção" : "mídia"}
              </span>
            ))}
          </div>

          {wizardStep === "producao" && resultado && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Label>Formato definido pela IA por ângulo</Label>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const map = initFormatoPorAngulo(selectedAngulos);
                      setFormatoPorAngulo(map);
                      persistWizard({ formatoPorAngulo: map });
                      toast.success("Recomendações da IA restauradas");
                    }}
                  >
                    Restaurar recomendações da IA
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const first = [...selectedAngulos][0];
                      const firstFmt = formatoPorAngulo[first];
                      if (!firstFmt) return;
                      const next: Record<number, FormatoOverride> = { ...formatoPorAngulo };
                      for (const idx of selectedAngulos) {
                        next[idx] = { ...firstFmt, source: "manual" };
                      }
                      setFormatoPorAngulo(next);
                      persistWizard({ formatoPorAngulo: next });
                      toast.info("Formato do primeiro ângulo aplicado a todos");
                    }}
                  >
                    Usar formato do 1º para todos
                  </Button>
                </div>
              </div>
              <div className="space-y-3">
                {[...selectedAngulos].sort((a, b) => a - b).map((idx) => {
                  const angulo = resultado.angulos[idx];
                  const fmt = formatoPorAngulo[idx];
                  const rec = angulo?.recomendacao_formato;
                  if (!angulo || !fmt) return null;
                  return (
                    <div key={idx} className="p-4 rounded-lg border border-border/50 bg-background/30 space-y-3">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="space-y-2 flex-1">
                          <p className="font-medium text-sm">{angulo.nome}</p>
                          {rec && (
                            <div className="flex flex-wrap gap-1.5">
                              <Badge variant="outline" className="text-[10px]">
                                {formatoSaidaLabel(fmt.formatoSaida)}
                              </Badge>
                              <Badge variant="secondary" className="text-[10px]">
                                {estiloProducaoBadge(rec.estilo_producao)}
                              </Badge>
                              <Badge variant="outline" className="text-[10px]">
                                {fmt.aspectRatioPrioritario}
                              </Badge>
                              {rec.confianca && (
                                <Badge variant="outline" className="text-[10px] capitalize">
                                  confiança {rec.confianca}
                                </Badge>
                              )}
                            </div>
                          )}
                          {rec && fmt.source === "ia" && (
                            <p className="text-xs text-muted-foreground line-clamp-3">{rec.justificativa}</p>
                          )}
                          {fmt.source === "manual" && (
                            <Badge variant="outline" className="text-[10px]">Alterado manualmente</Badge>
                          )}
                        </div>
                      </div>
                      <Collapsible>
                        <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                          <ChevronDown className="size-3.5" />
                          Avançado — sobrescrever IA
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Formato</Label>
                          <Select
                            value={fmt.formatoSaida}
                            onValueChange={(v) => {
                              const val = v as FormatoOverride["formatoSaida"];
                              const next = {
                                ...fmt,
                                formatoSaida: val,
                                source: "manual" as const,
                              };
                              const updated = { ...formatoPorAngulo, [idx]: next };
                              setFormatoPorAngulo(updated);
                              persistWizard({ formatoPorAngulo: updated });
                            }}
                          >
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="criativo_curto">{formatoSaidaLabel("criativo_curto")}</SelectItem>
                              <SelectItem value="vsl_curta">{formatoSaidaLabel("vsl_curta")}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Estilo</Label>
                          <Select
                            value={fmt.estiloProducao}
                            onValueChange={(v) => {
                              const val = v as FormatoOverride["estiloProducao"];
                              const next = {
                                ...fmt,
                                estiloProducao: val,
                                source: "manual" as const,
                              };
                              const updated = { ...formatoPorAngulo, [idx]: next };
                              setFormatoPorAngulo(updated);
                              persistWizard({ formatoPorAngulo: updated });
                            }}
                          >
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="texto_animado">{estiloProducaoLabel("texto_animado")}</SelectItem>
                              <SelectItem value="clipes_texto">{estiloProducaoLabel("clipes_texto")}</SelectItem>
                              <SelectItem value="ugc_avatar">{estiloProducaoLabel("ugc_avatar")}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Proporção</Label>
                          <Select
                            value={fmt.aspectRatioPrioritario}
                            onValueChange={(v) => {
                              const next = {
                                ...fmt,
                                aspectRatioPrioritario: v as FormatoOverride["aspectRatioPrioritario"],
                                source: "manual" as const,
                              };
                              const updated = { ...formatoPorAngulo, [idx]: next };
                              setFormatoPorAngulo(updated);
                              persistWizard({ formatoPorAngulo: updated });
                            }}
                          >
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="9:16">9:16 (Stories/Reels)</SelectItem>
                              <SelectItem value="4:5">4:5 (Feed)</SelectItem>
                              <SelectItem value="1:1">1:1 (Quadrado)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                        </CollapsibleContent>
                      </Collapsible>
                      {fmt.formatoSaida === "vsl_curta" && (
                        <p className="text-xs text-muted-foreground">
                          VSL curta: 6 blocos (hook, problema, mecanismo, prova, oferta, CTA) — até ~2 min.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEtapa("resultado")}>Voltar aos ângulos</Button>
                <Button onClick={() => { setWizardStep("midia"); persistWizard({ wizardStep: "midia" }); }}>
                  Próximo <ArrowRight className="size-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {wizardStep === "midia" && resultado && (
            <div className="space-y-4">
              {(() => {
                const mediaIndices = needsMediaUpload(resultado.angulos, selectedAngulos, formatoPorAngulo);
                if (mediaIndices.length === 0) return null;
                return (
                  <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
                    <p className="font-medium text-warning flex items-center gap-1.5">
                      <AlertTriangle className="size-4" /> Mídia recomendada
                    </p>
                    <p className="text-muted-foreground mt-1">
                      Ângulo(s) {mediaIndices.map((i) => i + 1).join(", ")} pedem clipes — envie vídeo/imagem ou adicione no editor.
                    </p>
                  </div>
                );
              })()}
              <Label>
                Mídia de fundo
                {needsMediaUpload(resultado.angulos, selectedAngulos, formatoPorAngulo).length > 0
                  ? " (recomendado)"
                  : " (opcional)"}
              </Label>
              <input
                ref={mediaRef}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file || !user || !projectId) return;
                  setUploadingMedia(true);
                  try {
                    const { path } = await uploadCriativoMedia(user.id, file, projectId);
                    setBackgroundMediaPath(path);
                    persistWizard({ backgroundMediaPath: path });
                    toast.success("Mídia enviada");
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Erro no upload");
                  } finally {
                    setUploadingMedia(false);
                  }
                }}
              />
              <Button
                variant="outline"
                onClick={() => mediaRef.current?.click()}
                disabled={uploadingMedia}
              >
                {uploadingMedia ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4 mr-1" />}
                {backgroundMediaPath ? "Trocar arquivo" : "Upload imagem/vídeo"}
              </Button>
              {backgroundMediaPath && (
                <p className="text-xs text-muted-foreground truncate">{backgroundMediaPath}</p>
              )}
              <p className="text-sm text-muted-foreground">
                Ou busque mídia gratuita no Pexels (retrato 9:16):
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="Ex: fitness, escritório, natureza"
                  value={pexelsQuery}
                  onChange={(e) => setPexelsQuery(e.target.value)}
                />
                <Button
                  variant="outline"
                  disabled={pexelsLoading || pexelsQuery.trim().length < 2}
                  onClick={async () => {
                    setPexelsLoading(true);
                    try {
                      const res = await runPexelsSearch({
                        data: { query: pexelsQuery.trim(), orientation: "portrait", perPage: 6 },
                      });
                      if (!res.configured) {
                        toast.info("Configure PEXELS_API_KEY no servidor para buscar mídia");
                        return;
                      }
                      setPexelsResults([...res.photos, ...res.videos].filter((x) => x.downloadUrl));
                      if (res.photos.length === 0 && res.videos.length === 0) {
                        toast.info("Nenhum resultado — tente outro termo");
                      }
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Erro na busca Pexels");
                    } finally {
                      setPexelsLoading(false);
                    }
                  }}
                >
                  {pexelsLoading ? <Loader2 className="size-4 animate-spin" /> : "Buscar"}
                </Button>
              </div>
              {pexelsResults.length > 0 && (
                <div className="grid grid-cols-3 gap-2 max-h-48 overflow-auto">
                  {pexelsResults.map((item) => (
                    <button
                      key={`${item.type}-${item.id}`}
                      type="button"
                      className="relative rounded-lg overflow-hidden border border-border/50 hover:border-primary/50 aspect-[9/16]"
                      onClick={async () => {
                        if (!projectId) return;
                        setUploadingMedia(true);
                        try {
                          const ext = item.type === "video" ? "mp4" : "jpg";
                          const { path } = await runPexelsDownload({
                            data: {
                              downloadUrl: item.downloadUrl,
                              projectId,
                              filename: `pexels-${item.id}.${ext}`,
                            },
                          });
                          setBackgroundMediaPath(path);
                          persistWizard({ backgroundMediaPath: path });
                          toast.success(`Mídia Pexels (${item.attribution}) aplicada`);
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Erro ao importar Pexels");
                        } finally {
                          setUploadingMedia(false);
                        }
                      }}
                    >
                      <img src={item.previewUrl} alt={item.attribution} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setWizardStep("producao")}>Voltar</Button>
                <Button
                  className="bg-gradient-primary border-0"
                  onClick={handleCreateDrafts}
                  disabled={creatingDrafts}
                >
                  {creatingDrafts ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {draftProgress
                        ? `${draftProgress.done}/${draftProgress.total} — ${creatingVsl ? "VSL…" : "criando…"}`
                        : creatingVsl
                          ? "Gerando roteiro VSL (~30–60s)…"
                          : "Criando rascunhos…"}
                    </>
                  ) : selectedAngulos.size > 1 ? (
                    `Criar ${selectedAngulos.size} rascunhos`
                  ) : (
                    "Abrir no editor"
                  )}
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      <Dialog open={!!batchChecklist} onOpenChange={(open) => !open && setBatchChecklist(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{batchChecklist?.length ?? 0} rascunho(s) — próximos passos</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Antes de subir no Meta, complete cada criativo no editor:
          </p>
          <div className="space-y-4 py-2">
            {batchChecklist?.map((d, i) => (
              <div key={d.id} className="rounded-lg border border-border/50 p-3 space-y-2">
                <p className="font-medium text-sm">{i + 1}. {d.nome}</p>
                <ul className="text-xs space-y-1.5 text-muted-foreground">
                  <li className="flex justify-between gap-2">
                    <span>Narração completa</span>
                    <Link to="/app/editor" search={{ criativoId: d.id, focus: "audio" }} onClick={() => setBatchChecklist(null)}>
                      <Button size="sm" variant="link" className="h-auto p-0 text-xs">Ir →</Button>
                    </Link>
                  </li>
                  {d.needsMedia && (
                    <li className="flex justify-between gap-2">
                      <span>Mídia de fundo</span>
                      <Link to="/app/editor" search={{ criativoId: d.id, focus: "media" }} onClick={() => setBatchChecklist(null)}>
                        <Button size="sm" variant="link" className="h-auto p-0 text-xs">Ir →</Button>
                      </Link>
                    </li>
                  )}
                  <li className="flex justify-between gap-2">
                    <span>Score e export MP4</span>
                    <Link to="/app/editor" search={{ criativoId: d.id, focus: "score" }} onClick={() => setBatchChecklist(null)}>
                      <Button size="sm" variant="link" className="h-auto p-0 text-xs">Avaliar →</Button>
                    </Link>
                  </li>
                </ul>
                <Link to="/app/editor" search={{ criativoId: d.id }} onClick={() => setBatchChecklist(null)}>
                  <Button size="sm" variant="outline" className="w-full">Abrir no editor</Button>
                </Link>
              </div>
            ))}
          </div>
          <Link to="/app/historico" onClick={() => setBatchChecklist(null)}>
            <Button variant="ghost" className="w-full">Ver todos no histórico</Button>
          </Link>
        </DialogContent>
      </Dialog>

      <Dialog open={!!partialDrafts} onOpenChange={(open) => !open && setPartialDrafts(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rascunhos parciais criados</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Alguns ângulos falharam — abra os rascunhos que foram criados:
          </p>
          <div className="space-y-2 max-h-60 overflow-auto py-2">
            {partialDrafts?.map((d) => (
              <Link key={d.id} to="/app/editor" search={{ criativoId: d.id }} onClick={() => setPartialDrafts(null)}>
                <Button variant="outline" className="w-full justify-between">
                  <span className="truncate">{d.nome}</span>
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
