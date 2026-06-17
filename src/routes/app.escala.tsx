import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TrendingUp, Upload, Sparkles, Play, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { uploadCriativoMedia } from "@/lib/storage";
import { getCriativo } from "@/lib/criativos.functions";

const searchSchema = z.object({
  criativoId: z.string().uuid().optional(),
});

export const Route = createFileRoute("/app/escala")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Fase de escala · Andromeda" },
      { name: "description", content: "Gere variações em lote do seu criativo campeão." },
    ],
  }),
  component: Escala,
});

const variacoes = [
  { id: "hook-v", nome: "Variações de hook visual", desc: "Mantém o corpo, troca os primeiros 3 segundos." },
  { id: "hook-t", nome: "Variações de hook textual", desc: "5 novos ganchos textuais para o mesmo ângulo." },
  { id: "avatar", nome: "Variações de avatar", desc: "Troca o perfil de quem fala." },
  { id: "formato", nome: "Variações de formato", desc: "Mesmo roteiro, outra apresentação visual." },
  { id: "empilha", nome: "Empilhamento de gancho", desc: "Cola o hook com maior hook rate na frente." },
  { id: "benef", nome: "Expansão de benefícios", desc: "Adiciona benefícios 2 e 3 e consequências emocionais." },
  { id: "cta", nome: "Novo CTA", desc: "Âncora de preço ou benefício adicional." },
];

function Escala() {
  const { criativoId } = Route.useSearch();
  const { user } = useAuth();
  const fetchCriativo = useServerFn(getCriativo);

  const { data: campeao } = useQuery({
    queryKey: ["criativo", criativoId],
    queryFn: () => fetchCriativo({ data: { id: criativoId! } }),
    enabled: !!criativoId,
  });

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set(["hook-v", "hook-t", "empilha"]));
  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  async function handleFileUpload(file: File) {
    if (!user) {
      toast.error("Faça login para enviar vídeos");
      return;
    }
    setUploading(true);
    try {
      const { path } = await uploadCriativoMedia(user.id, file);
      setUploadedPath(path);
      toast.success("Vídeo enviado para o storage");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro no upload");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="container mx-auto px-6 py-8 max-w-6xl space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold flex items-center gap-3">
          <TrendingUp className="size-7 text-primary-glow" /> Fase de escala
        </h1>
        <p className="text-muted-foreground mt-1">
          {campeao
            ? `Escalando: ${campeao.angulo} · ${campeao.produto}`
            : "Pegue o que está performando e gere variações em lote."}
        </p>
      </div>

      <Tabs defaultValue="campeao">
        <TabsList>
          <TabsTrigger value="campeao"><Sparkles className="size-4 mr-1.5" /> Criativo campeão</TabsTrigger>
          <TabsTrigger value="externo"><Upload className="size-4 mr-1.5" /> Vídeo externo</TabsTrigger>
        </TabsList>

        <TabsContent value="campeao" className="space-y-6 mt-6">
          <Card className="glass bg-gradient-card p-6">
            <div className="flex gap-6">
              <div className="w-32 aspect-[9/16] rounded-xl bg-gradient-to-br from-primary/40 to-accent/30 border border-border flex items-center justify-center shrink-0">
                <Play className="size-6 text-primary-foreground/80 fill-current" />
              </div>
              <div className="flex-1">
                {campeao ? (
                  <>
                    <Badge className="bg-success/20 text-success border-success/40 mb-2">Performando</Badge>
                    <h2 className="font-display text-xl font-semibold">{campeao.angulo}</h2>
                    <p className="text-sm text-muted-foreground mt-1">{campeao.produto} · {campeao.formato_saida ?? campeao.formato}</p>
                    <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                      <div className="p-3 bg-background/40 rounded border border-border/40">
                        <div className="text-xs text-muted-foreground">Estilo</div>
                        <div className="font-medium mt-0.5">{campeao.estilo_producao ?? campeao.estilo}</div>
                      </div>
                      <div className="p-3 bg-background/40 rounded border border-border/40">
                        <div className="text-xs text-muted-foreground">Export</div>
                        <div className="font-medium mt-0.5">{campeao.export_status ?? "rascunho"}</div>
                      </div>
                      <div className="p-3 bg-background/40 rounded border border-border/40">
                        <div className="text-xs text-muted-foreground">UTM</div>
                        <div className="font-medium mt-0.5 font-mono text-xs">{campeao.utm_content?.slice(0, 8)}</div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <Badge className="bg-muted/20 text-muted-foreground border-border mb-2">Sem criativo selecionado</Badge>
                    <h2 className="font-display text-xl font-semibold">Selecione um campeão no histórico</h2>
                    <p className="text-sm text-muted-foreground mt-1">Marque um criativo como Performando e clique em Escalar.</p>
                  </>
                )}
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="externo" className="mt-6">
          <input
            ref={fileRef}
            type="file"
            accept="video/mp4,video/webm"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
            }}
          />
          <Card
            className="glass border-dashed p-12 text-center cursor-pointer hover:border-primary/40 transition"
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="size-10 mx-auto text-primary-glow animate-spin mb-3" />
            ) : (
              <Upload className="size-10 mx-auto text-muted-foreground mb-3" />
            )}
            <p className="font-medium">
              {uploadedPath ? "Vídeo enviado — clique para trocar" : "Arraste seu vídeo ou clique para enviar"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              MP4/WebM até 100 MB · bucket Supabase <code className="text-xs">criativos-media</code>
            </p>
            {uploadedPath && (
              <p className="text-xs text-muted-foreground mt-3 font-mono truncate max-w-md mx-auto">{uploadedPath}</p>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <div>
        <h2 className="font-display text-xl font-semibold mb-4">Variações disponíveis</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {variacoes.map((v) => (
            <label key={v.id} className={`glass rounded-xl p-4 flex items-start gap-3 cursor-pointer transition ${
              selected.has(v.id) ? "border-primary/50 bg-primary/5" : "hover:border-border"
            }`}>
              <Checkbox checked={selected.has(v.id)} onCheckedChange={() => toggle(v.id)} className="mt-0.5" />
              <div>
                <div className="font-medium">{v.nome}</div>
                <div className="text-sm text-muted-foreground mt-0.5">{v.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="sticky bottom-4 flex justify-between items-center glass bg-gradient-card rounded-xl p-4">
        <div className="text-sm">
          <span className="text-muted-foreground">Selecionadas:</span>{" "}
          <span className="font-semibold">{selected.size}</span> · estimado{" "}
          <span className="font-semibold">{selected.size * 3} criativos</span>
        </div>
        <Button className="bg-gradient-primary border-0 shadow-glow">
          Gerar lote
        </Button>
      </div>
    </div>
  );
}
