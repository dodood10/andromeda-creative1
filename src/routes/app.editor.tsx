import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Play, Download, Type, Music, Mic, Image as ImageIcon, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/app/editor")({
  head: () => ({
    meta: [
      { title: "Editor de vídeo · Andromeda" },
      { name: "description", content: "Editor pré-montado com safe zones do Meta e score de qualidade." },
    ],
  }),
  component: Editor,
});

const blocks = [
  { t: "0-3s", txt: "Você acorda cansado mesmo dormindo 8h?", color: "bg-primary/70" },
  { t: "3-10s", txt: "Não é o seu sono. É o que falta na sua manhã.", color: "bg-accent/70" },
  { t: "10-20s", txt: "Bioativos que seu corpo deixou de absorver.", color: "bg-primary/60" },
  { t: "20-30s", txt: "12.483 pessoas em 90 dias.", color: "bg-success/60" },
  { t: "30-45s", txt: "Garanta o seu com 40% off hoje.", color: "bg-warning/60" },
];

function Editor() {
  const [block, setBlock] = useState(0);

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col">
      <div className="flex items-center justify-between px-6 py-3 border-b border-border/50">
        <div>
          <h1 className="font-display text-lg font-semibold">Editor · Ângulo "Mecanismo único"</h1>
          <p className="text-xs text-muted-foreground">9:16 · 1080×1920 · 45s</p>
        </div>
        <div className="flex gap-2">
          <Tabs defaultValue="A" className="mr-2">
            <TabsList>
              <TabsTrigger value="A">Texto animado</TabsTrigger>
              <TabsTrigger value="B">Clipes + texto</TabsTrigger>
            </TabsList>
          </Tabs>
          <Dialog>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary border-0 shadow-glow">
                <Download className="size-4 mr-1.5" /> Exportar
              </Button>
            </DialogTrigger>
            <ExportDialog />
          </Dialog>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: assets */}
        <aside className="w-64 border-r border-border/50 p-4 space-y-4 overflow-auto">
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Blocos</Label>
            <div className="mt-2 space-y-1.5">
              {blocks.map((b, i) => (
                <button
                  key={i}
                  onClick={() => setBlock(i)}
                  className={`w-full text-left p-2.5 rounded-lg text-xs transition ${
                    block === i ? "bg-primary/20 border border-primary/40" : "bg-card/40 border border-border/30 hover:bg-card"
                  }`}
                >
                  <div className="font-mono text-primary-glow">{b.t}</div>
                  <div className="text-muted-foreground mt-0.5 line-clamp-2">{b.txt}</div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Banco de mídia</Label>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-square rounded bg-gradient-card border border-border/30 flex items-center justify-center">
                  <ImageIcon className="size-4 text-muted-foreground" />
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Center: preview */}
        <section className="flex-1 flex items-center justify-center p-6 bg-background/40 overflow-auto">
          <div className="relative" style={{ width: 270, height: 480 }}>
            <div className="absolute inset-0 rounded-3xl overflow-hidden shadow-card-soft border border-border bg-gradient-to-br from-primary/30 via-background to-accent/20">
              {/* Safe zones overlay */}
              <div className="absolute inset-x-0 top-0 h-[14%] bg-destructive/15 border-b border-destructive/30 flex items-end justify-center pb-0.5">
                <span className="text-[9px] uppercase tracking-wider text-destructive/80">Zona de UI Meta</span>
              </div>
              <div className="absolute inset-x-0 bottom-0 h-[35%] bg-destructive/15 border-t border-destructive/30 flex items-start justify-center pt-1">
                <span className="text-[9px] uppercase tracking-wider text-destructive/80">Zona de UI Meta</span>
              </div>
              {/* Content */}
              <div className="absolute inset-x-4 top-[20%]">
                <div className="text-center font-display font-bold text-xl leading-tight">
                  {blocks[block].txt}
                </div>
              </div>
              <div className="absolute bottom-[38%] inset-x-0 flex justify-center">
                <button className="size-12 rounded-full bg-primary/80 backdrop-blur flex items-center justify-center">
                  <Play className="size-5 text-primary-foreground fill-current" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Right: props */}
        <aside className="w-72 border-l border-border/50 p-4 space-y-5 overflow-auto">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><Mic className="size-3.5" /> Voz</Label>
            <Select defaultValue="fem-jovem">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fem-jovem">Feminina jovem (PT-BR)</SelectItem>
                <SelectItem value="fem-madura">Feminina madura</SelectItem>
                <SelectItem value="masc-jovem">Masculina jovem</SelectItem>
                <SelectItem value="masc-aut">Masculina autoritativa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><Music className="size-3.5" /> Música</Label>
            <Select defaultValue="urg">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="urg">Urgência</SelectItem>
                <SelectItem value="conf">Confiança</SelectItem>
                <SelectItem value="ener">Energia</SelectItem>
                <SelectItem value="emo">Emocional</SelectItem>
              </SelectContent>
            </Select>
            <div className="pt-2"><Slider defaultValue={[40]} max={100} /></div>
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><Type className="size-3.5" /> Legenda</Label>
            <Select defaultValue="word">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="word">Palavra por palavra</SelectItem>
                <SelectItem value="block">Bloco por bloco</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Card className="glass p-3 border-warning/30">
            <div className="flex items-start gap-2 text-xs">
              <AlertTriangle className="size-4 text-warning shrink-0 mt-0.5" />
              <span>O botão Play está sobre a safe zone inferior. Mova para o centro.</span>
            </div>
          </Card>
        </aside>
      </div>

      {/* Timeline */}
      <div className="border-t border-border/50 p-3 bg-background/60">
        <div className="flex gap-1 h-12">
          {blocks.map((b, i) => (
            <button
              key={i}
              onClick={() => setBlock(i)}
              className={`${b.color} rounded flex items-center px-2 text-xs font-mono text-primary-foreground transition ${
                block === i ? "ring-2 ring-primary-glow" : "opacity-70 hover:opacity-100"
              }`}
              style={{ flex: i === 4 ? 1.5 : 1 }}
            >
              {b.t}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ExportDialog() {
  const scores = [
    { l: "Hook rate esperado", v: 82 },
    { l: "Compliance Meta", v: 95 },
    { l: "Elementos obrigatórios", v: 100 },
    { l: "Safe zones", v: 68 },
    { l: "Diversidade vs histórico", v: 74 },
  ];
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Score de qualidade pré-export</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-2">
        {scores.map((s) => (
          <div key={s.l}>
            <div className="flex justify-between text-sm mb-1.5">
              <span>{s.l}</span>
              <span className={s.v < 75 ? "text-warning" : "text-success"}>{s.v}%</span>
            </div>
            <Progress value={s.v} className="h-2" />
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline">Corrigir alertas</Button>
        <Button className="bg-gradient-primary border-0">Exportar 9:16 + 4:5</Button>
      </div>
    </DialogContent>
  );
}
