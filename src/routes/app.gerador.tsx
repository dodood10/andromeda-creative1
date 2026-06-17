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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Wand2, Sparkles, ArrowRight, Brain, Loader2, Target, Gauge,
  HelpCircle, Clock, TrendingDown, TrendingUp, Minus, EyeOff, Upload, AlertTriangle,
} from "lucide-react";
import {
  gerarAngulos,
  gerarPerguntaCirurgica,
  type ResultadoAngulos,
} from "@/lib/anthropic.functions";
import { saveGeracao, createCriativoDraft } from "@/lib/criativos.functions";
import { useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "@/contexts/workspace-context";
import { useNavigate } from "@tanstack/react-router";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/use-auth";
import { uploadCriativoMedia } from "@/lib/storage";
import { toast } from "sonner";

const wizardSearchSchema = z.object({
  step: z.enum(["wizard"]).optional(),
  formato: z.enum(["criativo_curto", "vsl_curta"]).optional(),
});

const WIZARD_STORAGE_KEY = "andromeda_wizard_state";

type WizardPersisted = {
  geracaoId: string;
  selectedAngulos: number[];
  wizardStep: WizardStep;
  formatoSaida: "criativo_curto" | "vsl_curta";
  estiloProducao: "texto_animado" | "clipes_texto";
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

type Etapa = "input" | "respondendo" | "resultado" | "wizard";
type WizardStep = "selecao" | "formato" | "estilo" | "midia";

function Gerador() {
  const navigate = useNavigate();
  const { step: urlStep, formato: urlFormato } = Route.useSearch();
  const { organizationId, projectId, currentProject } = useWorkspace();
  const askQuestion = useServerFn(gerarPerguntaCirurgica);
  const run = useServerFn(gerarAngulos);
  const persist = useServerFn(saveGeracao);
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
  const [geracaoId, setGeracaoId] = useState<string | null>(null);
  const [selectedAngulos, setSelectedAngulos] = useState<Set<number>>(new Set());
  const [wizardStep, setWizardStep] = useState<WizardStep>("selecao");
  const [formatoSaida, setFormatoSaida] = useState<"criativo_curto" | "vsl_curta">("criativo_curto");
  const [estiloProducao, setEstiloProducao] = useState<"texto_animado" | "clipes_texto">("texto_animado");
  const [creatingDrafts, setCreatingDrafts] = useState(false);
  const [createdDrafts, setCreatedDrafts] = useState<Array<{ id: string; nome: string }> | null>(null);
  const [backgroundMediaPath, setBackgroundMediaPath] = useState<string | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const mediaRef = useRef<HTMLInputElement>(null);
  const prevProjectRef = useRef<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (currentProject?.url_default) {
      setUrl(currentProject.url_default);
    }
  }, [currentProject?.url_default, projectId]);

  useEffect(() => {
    if (urlFormato) {
      setFormatoSaida(urlFormato);
      if (urlStep === "wizard") setEtapa("wizard");
    }
  }, [urlFormato, urlStep]);

  useEffect(() => {
    if (prevProjectRef.current && prevProjectRef.current !== projectId) {
      setEtapa("input");
      setPergunta(null);
      setResposta("");
      setResultado(null);
      setGeracaoId(null);
      setSelectedAngulos(new Set());
      setWizardStep("selecao");
      setBackgroundMediaPath(null);
      localStorage.removeItem(WIZARD_STORAGE_KEY);
      queryClient.invalidateQueries({ queryKey: ["criativos"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      if (currentProject?.url_default) setUrl(currentProject.url_default);
      else setUrl("");
      toast.info(`Projeto alterado para ${currentProject?.name ?? "novo projeto"}`);
    }
    prevProjectRef.current = projectId;
  }, [projectId, currentProject?.name, currentProject?.url_default, queryClient]);

  const persistWizard = useCallback((patch: Partial<WizardPersisted> & { geracaoId?: string }) => {
    if (!geracaoId && !patch.geracaoId) return;
    try {
      const raw = localStorage.getItem(WIZARD_STORAGE_KEY);
      const prev = raw ? (JSON.parse(raw) as WizardPersisted) : null;
      const next: WizardPersisted = {
        geracaoId: patch.geracaoId ?? geracaoId ?? prev?.geracaoId ?? "",
        selectedAngulos: patch.selectedAngulos ?? prev?.selectedAngulos ?? [...selectedAngulos],
        wizardStep: patch.wizardStep ?? wizardStep,
        formatoSaida: patch.formatoSaida ?? formatoSaida,
        estiloProducao: patch.estiloProducao ?? estiloProducao,
        backgroundMediaPath: patch.backgroundMediaPath !== undefined ? patch.backgroundMediaPath : backgroundMediaPath,
      };
      localStorage.setItem(WIZARD_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, [geracaoId, selectedAngulos, wizardStep, formatoSaida, estiloProducao, backgroundMediaPath]);

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
      setWizardStep(saved.wizardStep);
      setFormatoSaida(saved.formatoSaida);
      setEstiloProducao(saved.estiloProducao);
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

  async function handleGenerate() {
    if (!url.trim()) {
      toast.error("Informe a URL do site");
      return;
    }
    if (!resposta.trim()) {
      toast.error("Responda a pergunta cirúrgica antes de gerar os ângulos");
      return;
    }
    if (!organizationId || !projectId) {
      toast.error("Selecione um projeto no header");
      return;
    }
    setLoadingAngulos(true);
    setLoadingStep("Lendo site e pesquisando nicho...");
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    const stepTimer = window.setTimeout(() => {
      setLoadingStep("Analisando página e concorrentes...");
    }, 8000);
    const stepTimer2 = window.setTimeout(() => {
      setLoadingStep("Gerando 5 ângulos Andromeda...");
    }, 20000);
    const start = Date.now();
    try {
      const data = await run({
        data: {
          url, productType, goal, context,
          perguntaCirurgica: pergunta?.pergunta ?? "",
          respostaCirurgica: resposta,
          tomCalibracao,
        },
      });
      setLoadingStep("Gerando 5 ângulos...");
      setResultado(data);
      setEtapa("resultado");

      const elapsed = Date.now() - start;
      if (elapsed > 60000) toast.warning("Geração levou mais de 60 segundos");

      try {
        const saved = await persist({
          data: {
            url, productType, goal, context,
            resultado: data,
            criarCriativos: false,
            projectId,
            organizationId,
          },
        });
        setGeracaoId(saved.geracaoId);
        persistWizard({ geracaoId: saved.geracaoId, selectedAngulos: [...selectedAngulos] });
        queryClient.invalidateQueries({ queryKey: ["criativos"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
        toast.success("Ângulos salvos");
      } catch (persistErr) {
        console.error(persistErr);
        toast.error("Ângulos gerados, mas não foi possível salvar");
      }
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "Erro ao gerar ângulos";
      if (msg.includes("Unauthorized")) {
        navigate({ to: "/login" });
        return;
      }
      toast.error(msg);
    } finally {
      window.clearTimeout(stepTimer);
      window.clearTimeout(stepTimer2);
      setLoadingAngulos(false);
      setLoadingStep("");
    }
  }

  async function handleCreateDrafts() {
    if (!geracaoId || !organizationId || !projectId || selectedAngulos.size === 0) {
      toast.error("Selecione ao menos um ângulo");
      return;
    }
    setCreatingDrafts(true);
    try {
      const created: Array<{ id: string; idx: number }> = [];
      for (const idx of selectedAngulos) {
        const { criativoId } = await createDraft({
          data: {
            geracaoId,
            anguloIndex: idx,
            formatoSaida,
            estiloProducao,
            projectId,
            organizationId,
            backgroundMediaPath: backgroundMediaPath ?? undefined,
          },
        });
        created.push({ id: criativoId, idx });
      }
      localStorage.removeItem(WIZARD_STORAGE_KEY);
      queryClient.invalidateQueries({ queryKey: ["criativos"] });

      const draftList = created.map((c) => ({
        id: c.id,
        nome: resultado?.angulos[c.idx]?.nome ?? `Ângulo ${c.idx + 1}`,
      }));

      if (created.length === 1) {
        navigate({ to: "/app/editor", search: { criativoId: created[0].id } });
      } else {
        setCreatedDrafts(draftList);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar rascunho");
    } finally {
      setCreatingDrafts(false);
    }
  }

  return (
    <div className="container mx-auto px-6 py-8 max-w-6xl space-y-8 relative">
      {loadingAngulos && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur flex items-center justify-center">
          <Card className="glass p-8 max-w-md text-center space-y-4">
            <Loader2 className="size-10 animate-spin text-primary-glow mx-auto" />
            <p className="font-medium">{loadingStep}</p>
            <p className="text-sm text-muted-foreground">Isso pode levar 30–90 segundos. Não feche a página.</p>
          </Card>
        </div>
      )}

      {!projectId && (
        <div className="flex items-center gap-2 p-4 rounded-lg border border-warning/40 bg-warning/10 text-sm">
          <AlertTriangle className="size-4 text-warning shrink-0" />
          Selecione um projeto no header antes de gerar ângulos.
        </div>
      )}

      <div>
        <h1 className="text-3xl font-display font-bold">Gerador de ângulos</h1>
        <p className="text-muted-foreground mt-1">
          Cole a URL, responda a pergunta cirúrgica e gere 5 ângulos com lógica probabilística Andromeda 2026.
        </p>
      </div>

      <Card className="glass bg-gradient-card p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>URL do site</Label>
            <Input placeholder="https://seuproduto.com" value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo de produto</Label>
            <Select value={productType} onValueChange={setProductType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ecom">E-commerce físico</SelectItem>
                <SelectItem value="info">Infoproduto</SelectItem>
                <SelectItem value="saas">SaaS</SelectItem>
                <SelectItem value="ticket">Serviço de alto ticket</SelectItem>
                <SelectItem value="saude">Saúde e bem-estar</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
          {etapa !== "respondendo" && etapa !== "wizard" && (
            <Button
              onClick={handleAskQuestion}
              disabled={loadingPergunta || loadingAngulos}
              className="bg-gradient-primary border-0 shadow-glow"
            >
              {loadingPergunta ? (
                <><Loader2 className="size-4 mr-1.5 animate-spin" /> Gerando pergunta...</>
              ) : (
                <><HelpCircle className="size-4 mr-1.5" /> Gerar pergunta cirúrgica</>
              )}
            </Button>
          )}
        </div>
      </Card>

      {etapa === "respondendo" && pergunta && (
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

      {resultado && (
        <>
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
              ].map((d) => (
                <div key={d.l} className="p-4 rounded-lg bg-background/40 border border-border/50">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">{d.l}</div>
                  <div className="mt-1.5 font-medium">{d.v}</div>
                </div>
              ))}
            </div>
          </Card>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl font-semibold">5 ângulos gerados</h2>
              <Button
                className="bg-gradient-primary border-0"
                disabled={selectedAngulos.size === 0}
                onClick={() => {
                  setEtapa("wizard");
                  setWizardStep("selecao");
                  navigate({ to: "/app/gerador", search: { step: "wizard" } });
                  persistWizard({ wizardStep: "selecao", selectedAngulos: [...selectedAngulos] });
                }}
              >
                Continuar com selecionados <ArrowRight className="size-4 ml-1.5" />
              </Button>
            </div>
            <Accordion type="multiple" className="space-y-3">
              {resultado.angulos.map((a, i) => {
                const sat = saturacaoMeta[a.saturacao_hook?.status] ?? saturacaoMeta.neutro;
                const SatIcon = sat.icon;
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
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
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
        <Card className="glass bg-gradient-card p-6 space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="font-display text-xl font-semibold">Configurar produção</h2>
            <p className="text-sm text-muted-foreground">
              {selectedAngulos.size} ângulo(s) → {selectedAngulos.size} rascunho(s)
            </p>
          </div>
          <div className="flex gap-2 text-xs">
            {(["selecao", "formato", "estilo", "midia"] as WizardStep[]).map((s, i) => (
              <span
                key={s}
                className={`px-2 py-1 rounded ${wizardStep === s ? "bg-primary/20 text-primary-glow" : "text-muted-foreground"}`}
              >
                {i + 1}. {s}
              </span>
            ))}
          </div>

          {formatoSaida === "vsl_curta" && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
              <p className="font-medium text-primary-glow">Modo VSL curta</p>
              <p className="text-muted-foreground mt-1">
                O rascunho será montado em 6 blocos (hook, problema, mecanismo, prova, oferta, CTA) — até ~2 minutos.
              </p>
            </div>
          )}

          {wizardStep === "selecao" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{selectedAngulos.size} ângulo(s) selecionado(s)</p>
              <Button onClick={() => { setWizardStep("formato"); persistWizard({ wizardStep: "formato" }); }} disabled={selectedAngulos.size === 0}>
                Próximo: formato <ArrowRight className="size-4 ml-1" />
              </Button>
            </div>
          )}

          {wizardStep === "formato" && (
            <div className="space-y-4">
              <Label>Formato de saída</Label>
              <Select value={formatoSaida} onValueChange={(v) => {
                const val = v as typeof formatoSaida;
                setFormatoSaida(val);
                persistWizard({ formatoSaida: val });
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="criativo_curto">Criativo curto (30–60s)</SelectItem>
                  <SelectItem value="vsl_curta">VSL curta (até 2min)</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setWizardStep("selecao")}>Voltar</Button>
                <Button onClick={() => { setWizardStep("estilo"); persistWizard({ wizardStep: "estilo" }); }}>Próximo <ArrowRight className="size-4 ml-1" /></Button>
              </div>
            </div>
          )}

          {wizardStep === "estilo" && (
            <div className="space-y-4">
              <Label>Estilo de produção</Label>
              <Select value={estiloProducao} onValueChange={(v) => {
                const val = v as typeof estiloProducao;
                setEstiloProducao(val);
                persistWizard({ estiloProducao: val });
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="texto_animado">A — Texto animado + voz</SelectItem>
                  <SelectItem value="clipes_texto">B — Clipes + texto sobreposto</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setWizardStep("formato")}>Voltar</Button>
                <Button onClick={() => { setWizardStep("midia"); persistWizard({ wizardStep: "midia" }); }}>Próximo <ArrowRight className="size-4 ml-1" /></Button>
              </div>
            </div>
          )}

          {wizardStep === "midia" && (
            <div className="space-y-4">
              <Label>Mídia de fundo (opcional)</Label>
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
                Banco de mídia da plataforma (Pexels/Unsplash): em breve. Você também pode enviar no editor.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setWizardStep("estilo")}>Voltar</Button>
                <Button
                  className="bg-gradient-primary border-0"
                  onClick={handleCreateDrafts}
                  disabled={creatingDrafts}
                >
                  {creatingDrafts ? (
                    <Loader2 className="size-4 animate-spin" />
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

      <Dialog open={!!createdDrafts} onOpenChange={(open) => !open && setCreatedDrafts(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{createdDrafts?.length ?? 0} rascunhos criados</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Cada ângulo virou um criativo no histórico. Abra o editor de cada um para finalizar.
          </p>
          <div className="space-y-2 max-h-60 overflow-auto py-2">
            {createdDrafts?.map((d, i) => (
              <Link
                key={d.id}
                to="/app/editor"
                search={{ criativoId: d.id }}
                onClick={() => setCreatedDrafts(null)}
              >
                <Button variant="outline" className="w-full justify-between">
                  <span className="truncate">{i + 1}. {d.nome}</span>
                  <ArrowRight className="size-4 shrink-0" />
                </Button>
              </Link>
            ))}
          </div>
          <Link to="/app/historico" onClick={() => setCreatedDrafts(null)}>
            <Button variant="ghost" className="w-full">Ver todos no histórico</Button>
          </Link>
        </DialogContent>
      </Dialog>
    </div>
  );
}
