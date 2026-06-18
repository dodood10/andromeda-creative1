const STEPS = [
  { id: "input", label: "Briefing", etapas: ["input", "respondendo"] as const },
  { id: "resultado", label: "Ângulos", etapas: ["resultado"] as const },
  { id: "wizard", label: "Produção", etapas: ["wizard"] as const },
  { id: "editor", label: "Editor", etapas: ["editor"] as const },
] as const;

export type GeradorStepId = (typeof STEPS)[number]["id"];

export function GeradorStepper({
  etapa,
  onStepClick,
}: {
  etapa: string;
  onStepClick?: (stepId: GeradorStepId) => void;
}) {
  const currentIdx =
    etapa === "editor"
      ? 3
      : etapa === "wizard"
        ? 2
        : etapa === "resultado"
          ? 1
          : etapa === "respondendo" || etapa === "input"
            ? 0
            : 0;

  return (
    <div className="flex items-center gap-2 text-xs mb-6 overflow-x-auto pb-1">
      {STEPS.map((s, i) => {
        const clickable = !!onStepClick && i <= currentIdx;
        return (
          <div key={s.id} className="flex items-center gap-2 shrink-0">
            {i > 0 && <span className="text-muted-foreground">→</span>}
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onStepClick?.(s.id)}
              className={`px-3 py-1.5 rounded-full border transition-colors ${
                i === currentIdx
                  ? "bg-primary/20 border-primary/40 text-primary-glow font-medium"
                  : i < currentIdx
                    ? "border-success/40 text-success hover:bg-success/10"
                    : "border-border/50 text-muted-foreground"
              } ${clickable ? "cursor-pointer" : "cursor-default opacity-80"}`}
            >
              {i + 1}. {s.label}
            </button>
          </div>
        );
      })}
    </div>
  );
}
