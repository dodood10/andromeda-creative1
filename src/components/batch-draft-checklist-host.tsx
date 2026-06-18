import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { editorPathForFormato } from "@/lib/product-mode";
import { BATCH_CHECKLIST_EVENT } from "@/lib/draft-queue";

const BATCH_KEY = "andromeda_batch_checklist";

export type BatchDraftItem = {
  id: string;
  nome: string;
  needsMedia?: boolean;
  formatoSaida?: string | null;
};

export function persistBatchChecklist(items: BatchDraftItem[]) {
  if (items.length === 0) {
    sessionStorage.removeItem(BATCH_KEY);
  } else {
    sessionStorage.setItem(BATCH_KEY, JSON.stringify(items));
  }
  window.dispatchEvent(new CustomEvent(BATCH_CHECKLIST_EVENT));
}

export function loadBatchChecklist(): BatchDraftItem[] {
  try {
    const raw = sessionStorage.getItem(BATCH_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BatchDraftItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function removeFromBatchChecklist(criativoId: string) {
  const next = loadBatchChecklist().filter((d) => d.id !== criativoId);
  persistBatchChecklist(next);
}

export function BatchDraftChecklistHost() {
  const [items, setItems] = useState<BatchDraftItem[]>([]);
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    const refresh = () => setItems(loadBatchChecklist());
    refresh();
    window.addEventListener(BATCH_CHECKLIST_EVENT, refresh);
    return () => window.removeEventListener(BATCH_CHECKLIST_EVENT, refresh);
  }, []);

  function dismiss() {
    sessionStorage.removeItem(BATCH_KEY);
    setItems([]);
    window.dispatchEvent(new CustomEvent(BATCH_CHECKLIST_EVENT));
  }

  if (items.length === 0) return null;

  if (minimized) {
    return (
      <button
        type="button"
        onClick={() => setMinimized(false)}
        className="fixed bottom-20 right-4 z-40 md:bottom-6 md:right-24 rounded-full bg-primary text-primary-foreground shadow-glow px-4 py-2 text-sm font-medium"
      >
        Checklist ({items.length})
      </button>
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && setMinimized(true)}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Checklist de produção
            <Badge variant="outline">{items.length} rascunhos</Badge>
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Complete cada criativo: áudio → mídia (se necessário) → score → export. Este checklist
          permanece aberto enquanto você navega no app.
        </p>
        <div className="space-y-4 py-2">
          {items.map((d, i) => (
            <div key={d.id} className="rounded-lg border border-border/50 p-3 space-y-2">
              <p className="font-medium text-sm flex items-center gap-2">
                <span className="text-muted-foreground">{i + 1}.</span>
                {d.nome}
                {d.formatoSaida === "vsl_curta" && (
                  <Badge variant="outline" className="text-[10px]">VSL</Badge>
                )}
              </p>
              <ul className="text-xs space-y-1.5 text-muted-foreground">
                <li className="flex justify-between gap-2">
                  <span>Narração completa</span>
                  <Link
                    to={editorPathForFormato(d.formatoSaida)}
                    search={{ criativoId: d.id, focus: "audio" }}
                  >
                    <Button size="sm" variant="link" className="h-auto p-0 text-xs">
                      Ir →
                    </Button>
                  </Link>
                </li>
                {d.needsMedia && (
                  <li className="flex justify-between gap-2">
                    <span>Mídia de fundo</span>
                    <Link
                      to={editorPathForFormato(d.formatoSaida)}
                      search={{ criativoId: d.id, focus: "media" }}
                    >
                      <Button size="sm" variant="link" className="h-auto p-0 text-xs">
                        Ir →
                      </Button>
                    </Link>
                  </li>
                )}
                <li className="flex justify-between gap-2">
                  <span>Score e export MP4</span>
                  <Link
                    to={editorPathForFormato(d.formatoSaida)}
                    search={{ criativoId: d.id, focus: "score" }}
                  >
                    <Button size="sm" variant="link" className="h-auto p-0 text-xs">
                      Avaliar →
                    </Button>
                  </Link>
                </li>
              </ul>
              <Link to={editorPathForFormato(d.formatoSaida)} search={{ criativoId: d.id }}>
                <Button size="sm" variant="outline" className="w-full">
                  Abrir no editor
                </Button>
              </Link>
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm space-y-2">
          <p className="font-medium">Depois de subir no Meta</p>
          <p className="text-xs text-muted-foreground">
            Em ~3 dias, importe o CSV do Ads Manager com <code className="font-mono">utm_content</code> no
            pipeline — métricas validadas calibram a próxima geração.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={() => setMinimized(true)}>
            Minimizar
          </Button>
          <Button variant="outline" size="sm" onClick={dismiss}>
            Concluir checklist
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
