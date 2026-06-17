import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Wand2, Sparkles, ArrowRight, Brain, Loader2, Target, Gauge,
  HelpCircle, Clock, TrendingDown, TrendingUp, Minus, EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import {
  gerarAngulos,
  gerarPerguntaCirurgica,
  type ResultadoAngulos,
} from "@/lib/anthropic.functions";

export const Route = createFileRoute("/app/gerador")({
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

type Etapa = "input" | "respondendo" | "resultado";

function Gerador() {
  const askQuestion = useServerFn(gerarPerguntaCirurgica);
  const run = useServerFn(gerarAngulos);

  const [url, setUrl] = useState("https://meuproduto.com.br");
  const [productType, setProductType] = useState("info");
  const [goal, setGoal] = useState("conv");
  const [context, setContext] = useState("");
  const [tomCalibracao, setTomCalibracao] = useState<"direto" | "empatico" | "autoritativo">("direto");

  const [etapa, setEtapa] = useState<Etapa>("input");
  const [pergunta, setPergunta] = useState<{ pergunta: string; justificativa: string } | null>(null);
  const [resposta, setResposta] = useState("");

  const [loadingPergunta, setLoadingPergunta] = useState(false);
  const [loadingAngulos, setLoadingAngulos] = useState(false);
  const [resultado, setResultado] = useState<ResultadoAngulos | null>(null);

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

  async function handleGenerate(skip = false) {
    if (!url.trim()) {
      toast.error("Informe a URL do site");
      return;
    }
    setLoadingAngulos(true);
    try {
      const data = await run({
        data: {
          url, productType, goal, context,
          perguntaCirurgica: skip ? "" : pergunta?.pergunta ?? "",
          respostaCirurgica: skip ? "" : resposta,
          tomCalibracao,
        },
      });
      setResultado(data);
      setEtapa("resultado");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Erro ao gerar ângulos");
    } finally {
      setLoadingAngulos(false);
    }
  }

  return (
    <div className="container mx-auto px-6 py-8 max-w-6xl space-y-8">
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
          {etapa !== "respondendo" && (
            <>
              <Button
                variant="outline"
                onClick={() => handleGenerate(true)}
                disabled={loadingAngulos || loadingPergunta}
              >
                Pular e gerar direto
              </Button>
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
            </>
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
              onClick={() => handleGenerate(false)}
              disabled={loadingAngulos || !resposta.trim()}
              className="bg-gradient-primary border-0 shadow-glow"
            >
              {loadingAngulos ? (
                <><Loader2 className="size-4 mr-1.5 animate-spin" /> Pesquisando e gerando...</>
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
              <Link to="/app/editor">
                <Button className="bg-gradient-primary border-0">
                  Enviar selecionados ao editor <ArrowRight className="size-4 ml-1.5" />
                </Button>
              </Link>
            </div>
            <Accordion type="multiple" className="space-y-3">
              {resultado.angulos.map((a, i) => {
                const sat = saturacaoMeta[a.saturacao_hook?.status] ?? saturacaoMeta.neutro;
                const SatIcon = sat.icon;
                return (
                  <AccordionItem key={i} value={`a${i}`} className="glass bg-gradient-card rounded-xl px-5 border-0">
                    <AccordionTrigger className="hover:no-underline">
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
                    <AccordionContent className="space-y-4 pt-3">
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

                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">Refinar com IA</Button>
                        <Link to="/app/editor">
                          <Button size="sm" className="bg-gradient-primary border-0">Abrir no editor</Button>
                        </Link>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        </>
      )}
    </div>
  );
}
