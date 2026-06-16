import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Wand2, Sparkles, ArrowRight, Brain } from "lucide-react";

export const Route = createFileRoute("/app/gerador")({
  head: () => ({
    meta: [
      { title: "Gerador de ângulos · Andromeda" },
      { name: "description", content: "5 ângulos por briefing com a metodologia Andromeda 2026." },
    ],
  }),
  component: Gerador,
});

const angulos = [
  { nome: "Dor aguda", tipo: "Previsibilidade", schwartz: "Consciente do problema", hook: "Você acorda cansado mesmo dormindo 8 horas?" },
  { nome: "Mecanismo único", tipo: "Escala", schwartz: "Consciente da solução", hook: "Descobriram um nutriente que o seu corpo não absorve depois dos 35." },
  { nome: "Prova social com resultado", tipo: "Previsibilidade", schwartz: "Consciente do produto", hook: "12.483 mulheres já fizeram. Veja o resultado da Carla." },
  { nome: "Antes e depois com contraste", tipo: "Escala", schwartz: "Consciente do problema", hook: "Em 90 dias. Sem dieta. Sem academia." },
  { nome: "Objeção invertida", tipo: "Orgânico", schwartz: "Mais consciente", hook: "Não é mais um chá. Não é mais um app. É outra coisa." },
];

const tipoColor: Record<string, string> = {
  Previsibilidade: "bg-primary/20 text-primary-glow border-primary/40",
  Escala: "bg-accent/20 text-accent border-accent/40",
  Orgânico: "bg-success/20 text-success border-success/40",
};

function Gerador() {
  const [generated, setGenerated] = useState(false);

  return (
    <div className="container mx-auto px-6 py-8 max-w-6xl space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold">Gerador de ângulos</h1>
        <p className="text-muted-foreground mt-1">Cole a URL, escolha o tipo de produto e gere 5 ângulos prontos.</p>
      </div>

      <Card className="glass bg-gradient-card p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>URL do site</Label>
            <Input placeholder="https://seuproduto.com" defaultValue="https://meuproduto.com.br" />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo de produto</Label>
            <Select defaultValue="info">
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
            <Select defaultValue="conv">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="conv">Conversão</SelectItem>
                <SelectItem value="leads">Leads</SelectItem>
                <SelectItem value="traf">Tráfego</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-4 space-y-1.5">
          <Label>Contexto adicional (opcional)</Label>
          <Textarea placeholder="Preço, concorrente, público específico..." rows={2} />
        </div>
        <div className="mt-5 flex justify-end">
          <Button onClick={() => setGenerated(true)} className="bg-gradient-primary border-0 shadow-glow">
            <Wand2 className="size-4 mr-1.5" /> Gerar ângulos
          </Button>
        </div>
      </Card>

      {generated && (
        <>
          {/* Diagnóstico */}
          <Card className="glass bg-gradient-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Brain className="size-5 text-primary-glow" />
              <h2 className="font-display text-xl font-semibold">Diagnóstico do produto</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {[
                { l: "Mecanismo da oferta", v: "Suplemento natural com bioativos de absorção rápida." },
                { l: "Framework de copy atual", v: "PAS clássico com prova social fraca no topo." },
                { l: "Nível de consciência (Schwartz)", v: "Consciente do problema, em transição para consciente da solução." },
                { l: "Sofisticação do mercado", v: "Estágio 4 — público já viu várias soluções, precisa de mecanismo único." },
              ].map((d) => (
                <div key={d.l} className="p-4 rounded-lg bg-background/40 border border-border/50">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">{d.l}</div>
                  <div className="mt-1.5 font-medium">{d.v}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* Ângulos */}
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
              {angulos.map((a, i) => (
                <AccordionItem key={a.nome} value={`a${i}`} className="glass bg-gradient-card rounded-xl px-5 border-0">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3 text-left flex-1 pr-4">
                      <div className="size-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                        <Sparkles className="size-4 text-primary-glow" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold">{a.nome}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{a.hook}</div>
                      </div>
                      <Badge variant="outline" className={tipoColor[a.tipo]}>{a.tipo}</Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="p-3 rounded bg-background/40 border border-border/50">
                        <div className="text-xs text-muted-foreground">Schwartz</div>
                        <div className="font-medium">{a.schwartz}</div>
                      </div>
                      <div className="p-3 rounded bg-background/40 border border-border/50">
                        <div className="text-xs text-muted-foreground">Hook visual</div>
                        <div className="font-medium">Close no rosto + zoom abrupto no mecanismo</div>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Estrutura bloco a bloco</div>
                      <div className="space-y-2">
                        {[
                          { t: "0-3s", c: a.hook },
                          { t: "3-10s", c: "Agitação da dor com cenário concreto." },
                          { t: "10-20s", c: "Apresentação do mecanismo único." },
                          { t: "20-30s", c: "Prova social com resultado específico." },
                          { t: "30-45s", c: "CTA com benefício embutido." },
                        ].map((b) => (
                          <div key={b.t} className="flex gap-3 text-sm">
                            <div className="w-14 shrink-0 text-primary-glow font-mono text-xs pt-0.5">{b.t}</div>
                            <div className="flex-1 text-muted-foreground">{b.c}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">Refinar com IA</Button>
                      <Link to="/app/editor">
                        <Button size="sm" className="bg-gradient-primary border-0">Abrir no editor</Button>
                      </Link>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </>
      )}
    </div>
  );
}
