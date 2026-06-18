import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, HelpCircle, Copy } from "lucide-react";
import { toast } from "sonner";

const STEPS = [
  {
    title: "Baixe o MP4",
    desc: "Use o botão de download no editor ou histórico. Prefira 9:16 para Reels/Stories.",
  },
  {
    title: "Abra o Meta Ads Manager",
    desc: "Crie ou edite um conjunto de anúncios. Formato: vídeo único ou carrossel com vídeo.",
  },
  {
    title: "Faça upload do vídeo",
    desc: "Em Criativo do anúncio → Adicionar mídia → Carregar. Mantenha CTA e texto fora da safe zone inferior (35%).",
  },
  {
    title: "Configure rastreamento",
    desc: "Em Parâmetros de URL, adicione utm_content com o ID copiado do Andromeda para saber qual criativo performou.",
  },
  {
    title: "Publique e marque no Andromeda",
    desc: "Após subir a campanha, volte ao histórico e marque o criativo como Subiu → Rodando conforme o status real.",
  },
];

const CAMPAIGN_TEMPLATES = [
  "ANDROMEDA | {produto} | {angulo} | {formato}",
  "CBO | {nicho} | Hook-{numero} | {data}",
  "TESTE | {angulo} | v{versao} | utm_{utm}",
];

type MetaUploadGuideProps = {
  trigger?: React.ReactNode;
  forceOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function MetaUploadGuide({ trigger, forceOpen, onOpenChange }: MetaUploadGuideProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = forceOpen ?? internalOpen;

  function setOpen(v: boolean) {
    setInternalOpen(v);
    onOpenChange?.(v);
  }

  useEffect(() => {
    if (forceOpen) setInternalOpen(true);
  }, [forceOpen]);

  function copyTemplate(tpl: string) {
    void navigator.clipboard.writeText(tpl);
    toast.success("Template copiado — substitua os campos entre chaves");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && (
        <DialogTrigger asChild>
          {trigger}
        </DialogTrigger>
      )}
      {!trigger && !forceOpen && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <HelpCircle className="size-3.5 mr-1.5" />
            Como subir no Meta
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Guia: subir criativo no Meta Ads</DialogTitle>
        </DialogHeader>
        <ol className="space-y-4 mt-2">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-3 text-sm">
              <span className="size-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-xs font-bold">
                {i + 1}
              </span>
              <div>
                <p className="font-medium">{step.title}</p>
                <p className="text-muted-foreground mt-0.5">{step.desc}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-6 space-y-2">
          <p className="text-sm font-medium">Templates de nomenclatura</p>
          <p className="text-xs text-muted-foreground">
            Use no nome do anúncio ou campanha para organizar testes no Ads Manager.
          </p>
          <ul className="space-y-2">
            {CAMPAIGN_TEMPLATES.map((tpl) => (
              <li
                key={tpl}
                className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/40 text-xs font-mono"
              >
                <span className="truncate">{tpl}</span>
                <Button size="sm" variant="ghost" className="shrink-0 h-7" onClick={() => copyTemplate(tpl)}>
                  <Copy className="size-3" />
                </Button>
              </li>
            ))}
          </ul>
        </div>

        <a
          href="https://adsmanager.facebook.com"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-primary-glow hover:underline mt-4"
        >
          Abrir Ads Manager <ExternalLink className="size-3.5" />
        </a>
      </DialogContent>
    </Dialog>
  );
}
