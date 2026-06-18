import { Link, useRouterState } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Download } from "lucide-react";

const WIZARD_STORAGE_KEY = "andromeda_wizard_state";
const EXPORT_STEP_STORAGE_KEY = "andromeda_export_step";

export function ContinueWizardBanner() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isVslContext = pathname.startsWith("/app/vsl");

  if (typeof localStorage === "undefined") return null;

  let exportDrafts = 0;
  try {
    const exportRaw = localStorage.getItem(EXPORT_STEP_STORAGE_KEY);
    if (exportRaw) {
      exportDrafts = (JSON.parse(exportRaw) as { exportDrafts?: unknown[] }).exportDrafts?.length ?? 0;
    }
  } catch {
    /* ignore */
  }

  const geradorPath = isVslContext ? "/app/vsl/gerador" : "/app/gerador";

  if (exportDrafts > 0) {
    return (
      <Card className="glass p-4 border border-primary/30 bg-primary/5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <Download className="size-4 text-primary-glow shrink-0" />
          <span>
            {exportDrafts} rascunho(s) aguardando export MP4.
          </span>
        </div>
        <Link to={geradorPath} search={{ step: "export" }}>
          <Button size="sm" className="bg-gradient-primary border-0">
            Continuar export
          </Button>
        </Link>
      </Card>
    );
  }

  const raw = localStorage.getItem(WIZARD_STORAGE_KEY);
  if (!raw) return null;

  let geracaoId: string | null = null;
  let productMode: "criativo" | "vsl" | undefined;
  try {
    const parsed = JSON.parse(raw) as { geracaoId?: string; productMode?: "criativo" | "vsl" };
    geracaoId = parsed.geracaoId ?? null;
    productMode = parsed.productMode;
  } catch {
    return null;
  }
  if (!geracaoId) return null;

  const wizardPath =
    productMode === "vsl" || isVslContext ? "/app/vsl/gerador" : "/app/gerador";

  return (
    <Card className="glass p-4 border border-primary/30 bg-primary/5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm">
        <RefreshCw className="size-4 text-primary-glow shrink-0" />
        <span>Você tem uma sessão do gerador em andamento.</span>
      </div>
      <Link to={wizardPath} search={{ step: "wizard" }}>
        <Button size="sm" className="bg-gradient-primary border-0">
          Continuar de onde parou
        </Button>
      </Link>
    </Card>
  );
}
