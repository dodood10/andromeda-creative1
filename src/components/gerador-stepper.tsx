const STEPS = [
  { id: "input", label: "Briefing" },
  { id: "resultado", label: "Ângulos" },
  { id: "wizard", label: "Produção" },
  { id: "editor", label: "Editor" },
] as const;

export type GeradorStepId = (typeof STEPS)[number]["id"];

export function GeradorStepper({ etapa }: { etapa: string }) {
  const currentIdx =
    etapa === "editor"
      ? 3
      : etapa === "respondendo"
        ? 0
        : etapa === "resultado"
          ? 1
          : etapa === "wizard"
            ? 2
            : 0;

  return (
    <div className="flex items-center gap-2 text-xs mb-6 overflow-x-auto pb-1">
      {STEPS.map((s, i) => (
        <div key={s.id} className="flex items-center gap-2 shrink-0">
          {i > 0 && <span className="text-muted-foreground">→</span>}
          <span
            className={`px-3 py-1.5 rounded-full border ${
              i === currentIdx
                ? "bg-primary/20 border-primary/40 text-primary-glow font-medium"
                : i < currentIdx
                  ? "border-success/40 text-success"
                  : "border-border/50 text-muted-foreground"
            }`}
          >
            {i + 1}. {s.label}
          </span>
        </div>
      ))}
    </div>
  );
}
