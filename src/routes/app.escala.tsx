import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TrendingUp, Upload, Sparkles, Play, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/contexts/workspace-context";
import { uploadCriativoMedia } from "@/lib/storage";
import { getCriativo, gerarVariacoes } from "@/lib/criativos.functions";
import { getSignedExportUrls } from "@/lib/export.functions";

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
  { id: "hook-t", nome: "Variações de hook textual", desc: "Novos ganchos textuais via IA (refinarBloco)." },
  { id: "avatar", nome: "Variações de avatar", desc: "Troca o perfil de quem fala no hook." },
  { id: "formato", nome: "Variações de formato", desc: "Mesmo roteiro, estilo clipes+texto." },
  { id: "empilha", nome: "Empilhamento de gancho", desc: "Hook empilhado mais agressivo na frente." },
  { id: "benef", nome: "Expansão de benefícios", desc: "Adiciona benefícios ao bloco de mecanismo." },
  { id: "cta", nome: "Novo CTA", desc: "Âncora de preço ou benefício adicional." },
];

function Escala() {
  const { criativoId } = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { organizationId, projectId } = useWorkspace();
  const queryClient = useQueryClient();
  const fetchCriativo = useServerFn(getCriativo);
  const runVariacoes = useServerFn(gerarVariacoes);
  const signExports = useServerFn(getSignedExportUrls);

  const { data: campeao } = useQuery({
    queryKey: ["criativo", criativoId],
    queryFn: () => fetchCriativo({ data: { id: criativoId! } }),
    enabled: !!criativoId,
  });

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set(["hook-v", "hook-t", "empilha"]));
  const [variacoesCriadas, setVariacoesCriadas] = useState<
    Array<{ tipo: string; hook: string; criativoId?: string; angulo: string }> | null
  >(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  async function loadPreview() {
    const paths = (campeao?.export_paths as string[]) ?? [];
    if (paths.length === 0) return;
    try {
      const { urls } = await signExports({ data: { paths: [paths[0]] } });
      setPreviewUrl(urls[paths[0]] ?? null);
    } catch {
      /* ignore */
    }
  }

  const gerarMutation = useMutation({
    mutationFn: () => {
      if (!criativoId || !organizationId || !projectId) {
        throw new Error("Selecione um criativo campeão no histórico");
      }
      return runVariacoes({
        data: {
          criativoId,
          tipos: [...selected],
          organizationId,
          projectId,
        },
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["criativos"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      if (data.variacoes.length === 0) {
        toast.error("Nenhuma variação gerada — verifique ANTHROPIC_API_KEY");
        return;
      }
      if (data.variacoes.length === 1 && data.variacoes[0].criativoId) {
        toast.success("1 variação criada");
        navigate({ to: "/app/editor", search: { criativoId: data.variacoes[0].criativoId } });
      } else {
        setVariacoesCriadas(data.variacoes);
        toast.success(`${data.variacoes.length} variações criadas`);
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao gerar lote"),
  });

  async function handleFileUpload(file: File) {
    if (!user) {
      toast.error("Faça login para enviar vídeos");
      return;
    }
    setUploading(true);
    try {
      const { path } = await uploadCriativoMedia(user.id, file, projectId ?? undefined);
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
        {!criativoId && (
          <Link to="/app/historico" search={{ status: "Performando" }} className="text-sm text-primary-glow underline mt-2 inline-block">
            Selecionar campeão no histórico
          </Link>
        )}
      </div>

      <Tabs defaultValue="campeao">
        <TabsList>
          <TabsTrigger value="campeao"><Sparkles className="size-4 mr-1.5" /> Criativo campeão</TabsTrigger>
          <TabsTrigger value="externo"><Upload className="size-4 mr-1.5" /> Vídeo externo</TabsTrigger>
        </TabsList>

        <TabsContent value="campeao" className="space-y-6 mt-6">
          <Card className="glass bg-gradient-card p-6">
            <div className="flex gap-6">
              <button
                type="button"
                onClick={() => void loadPreview()}
                className="w-32 aspect-[9/16] rounded-xl bg-gradient-to-br from-primary/40 to-accent/30 border border-border flex items-center justify-center shrink-0 overflow-hidden relative group"
              >
                {previewUrl ? (
                  <video src={previewUrl} className="absolute inset-0 w-full h-full object-cover" muted />
                ) : (
                  <Play className="size-6 text-primary-foreground/80 fill-current group-hover:scale-110 transition" />
                )}
              </button>
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
                    <Link to="/app/inteligencia" className="text-xs text-primary-glow underline mt-3 inline-block">
                      Ver inteligência do nicho
                    </Link>
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
              MP4/WebM até 100 MB · análise manual em breve
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
          <span className="font-semibold">{selected.size}</span> ·{" "}
          <span className="font-semibold">{selected.size} rascunho(s)</span> via IA
        </div>
        <Button
          className="bg-gradient-primary border-0 shadow-glow"
          disabled={!criativoId || selected.size === 0 || gerarMutation.isPending}
          onClick={() => gerarMutation.mutate()}
        >
          {gerarMutation.isPending ? (
            <Loader2 className="size-4 animate-spin mr-1.5" />
          ) : (
            <Sparkles className="size-4 mr-1.5" />
          )}
          Gerar lote
        </Button>
      </div>

      <Dialog open={!!variacoesCriadas} onOpenChange={(open) => !open && setVariacoesCriadas(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{variacoesCriadas?.length ?? 0} variações criadas</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Cada variação virou um rascunho no histórico. Abra no editor para revisar e exportar.
          </p>
          <div className="space-y-2 max-h-64 overflow-auto py-2">
            {variacoesCriadas?.map((v) => (
              v.criativoId ? (
                <Link
                  key={v.criativoId}
                  to="/app/editor"
                  search={{ criativoId: v.criativoId }}
                  onClick={() => setVariacoesCriadas(null)}
                >
                  <Button variant="outline" className="w-full justify-between h-auto py-2">
                    <span className="text-left truncate">
                      <span className="text-xs text-muted-foreground block">{v.tipo}</span>
                      {v.angulo}
                    </span>
                    <ArrowRight className="size-4 shrink-0" />
                  </Button>
                </Link>
              ) : null
            ))}
          </div>
          <Link to="/app/historico" search={{ status: "Gerado" }} onClick={() => setVariacoesCriadas(null)}>
            <Button variant="ghost" className="w-full">Ver no histórico</Button>
          </Link>
        </DialogContent>
      </Dialog>
    </div>
  );
}
