import { useState, useEffect, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  Rocket,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MetaUploadGuide } from "@/components/meta-upload-guide";
import { UtmBuilder } from "@/components/utm-builder";
import { PlanoTesteMetaDialog } from "@/components/plano-teste-meta-dialog";
import { getSignedExportUrls } from "@/lib/export.functions";
import { updateCriativoStatus } from "@/lib/criativos.functions";
import { advanceDraftQueue } from "@/lib/draft-queue";
import { trackMetaMarcarSubiu } from "@/lib/meta-pixel";

export type PostExportContentProps = {
  criativoId: string;
  anguloNome?: string;
  utm: string;
  exportPaths: string[];
  downloadUrls: Record<string, string>;
  onCopyUtm: () => void;
  onMarcarSubiu: () => void;
  markingSubiu: boolean;
  exportDevMode?: boolean;
  onOpenTestPlan?: () => void;
  onNextDraft?: () => void;
  showHistoricoLink?: boolean;
  historicoSearch?: Record<string, string>;
  criativoStatus?: string;
};

export function PostExportContent({
  utm,
  exportPaths,
  downloadUrls,
  onCopyUtm,
  onMarcarSubiu,
  markingSubiu,
  exportDevMode,
  onOpenTestPlan,
  onNextDraft,
  showHistoricoLink = true,
  historicoSearch,
  criativoStatus,
}: PostExportContentProps) {
  const suggestSubiu = criativoStatus === "Gerado";
  return (
    <div className="space-y-4">
      {suggestSubiu && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/10 border border-primary/30 text-sm">
          <Rocket className="size-4 text-primary-glow shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Próximo passo do pipeline</p>
            <p className="text-muted-foreground text-xs mt-0.5">
              Suba o MP4 no Meta e marque como <strong>Subiu</strong> — isso libera lembretes de métricas e CSV.
            </p>
          </div>
        </div>
      )}
      {exportDevMode && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/15 border border-warning/30 text-sm">
          <AlertTriangle className="size-4 text-warning shrink-0 mt-0.5" />
          <span>Estes MP4 são placeholders de desenvolvimento. Não suba no Meta até configurar o serviço FFmpeg.</span>
        </div>
      )}
      {exportPaths.length > 0 && (() => {
        const mp4Path = exportPaths.find((p) => /9.?16|vertical/i.test(p)) ?? exportPaths[0];
        const mp4Url = downloadUrls[mp4Path];
        return mp4Url ? (
          <div className="rounded-xl border border-border overflow-hidden bg-black/90">
            <p className="text-xs text-muted-foreground px-3 py-2 border-b border-border/50">
              Preview do export (MP4 real)
            </p>
            <video
              src={mp4Url}
              controls
              className="w-full max-h-[420px] aspect-[9/16] mx-auto object-contain"
            />
          </div>
        ) : null;
      })()}
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
        {onOpenTestPlan && (
          <Button size="sm" variant="outline" onClick={onOpenTestPlan}>
            <Target className="size-3.5 mr-1" /> Plano de teste Meta
          </Button>
        )}
        <Button className="bg-gradient-primary border-0" onClick={onMarcarSubiu} disabled={markingSubiu}>
          {markingSubiu ? <Loader2 className="size-4 animate-spin" /> : <ExternalLink className="size-4 mr-1.5" />}
          Marcar como Subiu
        </Button>
        {onNextDraft && (
          <Button size="sm" variant="outline" onClick={onNextDraft}>
            Próximo rascunho da fila
          </Button>
        )}
        {showHistoricoLink && (
          <Link to="/app/historico" search={historicoSearch}>
            <Button variant="outline">Ir ao pipeline</Button>
          </Link>
        )}
      </div>
    </div>
  );
}

type PostExportBannerProps = PostExportContentProps & {
  onDismiss: () => void;
  onExpand: () => void;
  expanded: boolean;
  organizationId?: string | null;
  userId?: string;
};

export function PostExportBanner({
  criativoId,
  anguloNome,
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
  organizationId,
  userId,
  onNextDraft,
  criativoStatus,
  historicoSearch,
}: PostExportBannerProps) {
  const [testPlanOpen, setTestPlanOpen] = useState(false);

  const dialog = (
    <PlanoTesteMetaDialog
      criativoId={criativoId}
      anguloNome={anguloNome}
      autoOpen
      showTrigger={false}
      open={testPlanOpen}
      onOpenChange={setTestPlanOpen}
      organizationId={organizationId}
      userId={userId}
    />
  );

  if (!expanded) {
    return (
      <>
        {dialog}
        <div className="px-6 py-2 bg-success/10 border-b border-success/30 flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-success" /> Export pronto — abra o hub de lançamento
          </span>
          <Button size="sm" variant="outline" onClick={onExpand}>
            Ver hub
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      {dialog}
      <div className="px-6 py-4 bg-success/10 border-b border-success/30">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-semibold flex items-center gap-2 text-sm">
            <CheckCircle2 className="size-4 text-success" /> Hub de lançamento
          </h2>
          <Button size="sm" variant="ghost" onClick={onDismiss}>
            Recolher
          </Button>
        </div>
        <PostExportContent
          criativoId={criativoId}
          anguloNome={anguloNome}
          utm={utm}
          exportPaths={exportPaths}
          downloadUrls={downloadUrls}
          onCopyUtm={onCopyUtm}
          onMarcarSubiu={onMarcarSubiu}
          markingSubiu={markingSubiu}
          exportDevMode={exportDevMode}
          onOpenTestPlan={() => setTestPlanOpen(true)}
          onNextDraft={onNextDraft}
          criativoStatus={criativoStatus}
          historicoSearch={historicoSearch}
        />
      </div>
    </>
  );
}

type PostExportHubDialogProps = {
  criativoId: string;
  anguloNome: string;
  utm?: string;
  exportPaths: string[];
  organizationId?: string | null;
  userId?: string;
  onStatusUpdated?: () => void;
  onNextDraft?: (nextCriativoId: string) => void;
  triggerLabel?: string;
  triggerClassName?: string;
  trigger?: ReactNode;
  criativoStatus?: string;
};

export function PostExportHubDialog({
  criativoId,
  anguloNome,
  utm: utmProp,
  exportPaths,
  organizationId,
  userId,
  onStatusUpdated,
  onNextDraft,
  triggerLabel = "Hub de lançamento",
  triggerClassName,
  trigger,
  criativoStatus,
}: PostExportHubDialogProps) {
  const utm = utmProp ?? criativoId;
  const [open, setOpen] = useState(false);
  const [downloadUrls, setDownloadUrls] = useState<Record<string, string>>({});
  const [loadingUrls, setLoadingUrls] = useState(false);
  const [markingSubiu, setMarkingSubiu] = useState(false);
  const [testPlanOpen, setTestPlanOpen] = useState(false);
  const signUrls = useServerFn(getSignedExportUrls);
  const patchStatus = useServerFn(updateCriativoStatus);

  useEffect(() => {
    if (!open || exportPaths.length === 0) return;
    setLoadingUrls(true);
    signUrls({ data: { paths: exportPaths } })
      .then((r) => setDownloadUrls(r.urls))
      .catch(() => toast.error("Erro ao carregar downloads"))
      .finally(() => setLoadingUrls(false));
  }, [open, exportPaths, signUrls]);

  async function handleMarcarSubiu() {
    setMarkingSubiu(true);
    try {
      await patchStatus({ data: { id: criativoId, status: "Subiu" } });
      trackMetaMarcarSubiu();
      toast.success("Marcado como Subiu!");
      onStatusUpdated?.();
      setOpen(false);
      const nextId = advanceDraftQueue(criativoId);
      if (nextId && onNextDraft) {
        onNextDraft(nextId);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar status");
    } finally {
      setMarkingSubiu(false);
    }
  }

  function copyUtm() {
    void navigator.clipboard.writeText(utm);
    toast.success("utm_content copiado");
  }

  return (
    <>
      <PlanoTesteMetaDialog
        criativoId={criativoId}
        anguloNome={anguloNome}
        showTrigger={false}
        open={testPlanOpen}
        onOpenChange={setTestPlanOpen}
        organizationId={organizationId}
        userId={userId}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger ?? (
            <Button size="sm" className={`min-h-11 bg-gradient-primary border-0 ${triggerClassName ?? ""}`}>
              <Rocket className="size-3.5 mr-1" />
              {triggerLabel}
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Rocket className="size-5 text-primary-glow" />
              Hub de lançamento · {anguloNome}
            </DialogTitle>
          </DialogHeader>
          {loadingUrls ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-6 animate-spin text-primary-glow" />
            </div>
          ) : (
            <PostExportContent
              criativoId={criativoId}
              anguloNome={anguloNome}
              utm={utm}
              exportPaths={exportPaths}
              downloadUrls={downloadUrls}
              onCopyUtm={copyUtm}
              onMarcarSubiu={handleMarcarSubiu}
              markingSubiu={markingSubiu}
              onOpenTestPlan={() => setTestPlanOpen(true)}
              showHistoricoLink={false}
              criativoStatus={criativoStatus}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
