import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { toast } from "sonner";

type UtmBuilderProps = {
  utmContent: string;
  defaultBaseUrl?: string;
};

export function UtmBuilder({ utmContent, defaultBaseUrl = "" }: UtmBuilderProps) {
  const [baseUrl, setBaseUrl] = useState(defaultBaseUrl);
  const [utmSource, setUtmSource] = useState("meta");
  const [utmMedium, setUtmMedium] = useState("paid");
  const [utmCampaign, setUtmCampaign] = useState("andromeda");

  function buildUrl() {
    if (!baseUrl.trim()) return "";
    try {
      const url = new URL(baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`);
      url.searchParams.set("utm_source", utmSource);
      url.searchParams.set("utm_medium", utmMedium);
      url.searchParams.set("utm_campaign", utmCampaign);
      url.searchParams.set("utm_content", utmContent);
      return url.toString();
    } catch {
      return "";
    }
  }

  const fullUrl = buildUrl();

  function copy() {
    if (!fullUrl) {
      toast.error("Informe uma URL base válida");
      return;
    }
    void navigator.clipboard.writeText(fullUrl);
    toast.success("URL com UTM copiada");
  }

  return (
    <div className="space-y-3 text-sm">
      <p className="font-medium">UTM Builder</p>
      <div className="space-y-1.5">
        <Label className="text-xs">URL de destino (landing/página de vendas)</Label>
        <Input
          placeholder="https://seuproduto.com/oferta"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">utm_source</Label>
          <Input value={utmSource} onChange={(e) => setUtmSource(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">utm_medium</Label>
          <Input value={utmMedium} onChange={(e) => setUtmMedium(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">utm_campaign</Label>
        <Input value={utmCampaign} onChange={(e) => setUtmCampaign(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">utm_content (do criativo)</Label>
        <code className="block text-xs bg-background/60 p-2 rounded font-mono truncate">{utmContent}</code>
      </div>
      {fullUrl && (
        <code className="block text-[10px] bg-muted/50 p-2 rounded break-all">{fullUrl}</code>
      )}
      <Button size="sm" variant="outline" onClick={copy} disabled={!fullUrl}>
        <Copy className="size-3.5 mr-1" /> Copiar URL completa
      </Button>
    </div>
  );
}
