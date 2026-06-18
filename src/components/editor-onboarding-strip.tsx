import { useState } from "react";
import { CheckCircle2, Circle, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "andromeda_editor_onboarding_done";

const STEPS = [
  { id: "audio", label: "Gerar ou revisar áudio", focus: "audio" as const },
  { id: "media", label: "Mídia de fundo (se clipes/UGC)", focus: "media" as const },
  { id: "score", label: "Avaliar score pré-export", focus: "score" as const },
  { id: "export", label: "Exportar MP4", focus: null },
] as const;

export function EditorOnboardingStrip({
  hasAudio,
  hasMedia,
  hasScore,
  exported,
  needsMedia = true,
  onStepFocus,
}: {
  hasAudio: boolean;
  hasMedia: boolean;
  hasScore: boolean;
  exported: boolean;
  needsMedia?: boolean;
  onStepFocus?: (focus: "audio" | "media" | "score" | "export") => void;
}) {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(STORAGE_KEY) === "1",
  );

  if (dismissed || exported) return null;

  const done = {
    audio: hasAudio,
    media: needsMedia ? hasMedia : true,
    score: hasScore,
    export: exported,
  };

  const visibleSteps = STEPS.filter((s) => s.id !== "media" || needsMedia);
  const completed = visibleSteps.filter((s) => done[s.id as keyof typeof done]).length;
  if (completed >= visibleSteps.length) {
    localStorage.setItem(STORAGE_KEY, "1");
    return null;
  }

  const nextStep = visibleSteps.find((s) => !done[s.id as keyof typeof done]);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setDismissed(true);
  }

  function handleStep(step: (typeof STEPS)[number]) {
    if (done[step.id as keyof typeof done]) return;
    if (step.id === "export") {
      onStepFocus?.("export");
      document.getElementById("editor-export-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (step.focus) onStepFocus?.(step.focus);
    const elId =
      step.focus === "audio"
        ? "editor-audio"
        : step.focus === "media"
          ? "editor-media"
          : "editor-score";
    document.getElementById(elId)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <Card className="mx-4 lg:mx-6 mt-3 p-3 border border-primary/25 bg-primary/5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div>
          <p className="text-sm font-medium">Próximos passos no editor</p>
          {nextStep && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Agora: {nextStep.label}
            </p>
          )}
        </div>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={dismiss}>
          Ocultar
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {visibleSteps.map((step) => {
          const isDone = done[step.id as keyof typeof done];
          const isNext = nextStep?.id === step.id;
          const Icon = isDone ? CheckCircle2 : Circle;
          return (
            <button
              key={step.id}
              type="button"
              disabled={isDone}
              onClick={() => handleStep(step)}
              className={`inline-flex items-center gap-1.5 text-xs rounded-md px-2 py-1 border transition-colors ${
                isDone
                  ? "text-success border-success/30 bg-success/5 cursor-default"
                  : isNext
                    ? "text-foreground border-primary/40 bg-primary/10 hover:bg-primary/15 cursor-pointer"
                    : "text-muted-foreground border-border/40 hover:bg-muted/50 cursor-pointer"
              }`}
            >
              <Icon className="size-3.5 shrink-0" />
              {step.label}
              {!isDone && isNext && <ChevronRight className="size-3 shrink-0" />}
            </button>
          );
        })}
      </div>
    </Card>
  );
}
