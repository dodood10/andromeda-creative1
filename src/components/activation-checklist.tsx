import { Link } from "@tanstack/react-router";
import { CheckCircle2, Circle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { AppLink } from "@/lib/app-links";

export type ActivationStep = {
  id: string;
  label: string;
  done: boolean;
  action?: AppLink & { label?: string };
};

export function ActivationChecklist({ steps, title = "Primeiros passos" }: { steps: ActivationStep[]; title?: string }) {
  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;

  const next = steps.find((s) => !s.done);

  return (
    <Card className="glass p-5 border border-primary/30 bg-primary/5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {doneCount} de {steps.length} concluídos — complete para extrair valor do Andromeda
          </p>
        </div>
        {next?.action && (
          <Link to={next.action.to} search={next.action.search}>
            <Button size="sm" className="min-h-11 bg-gradient-primary border-0">
              {next.action.label ?? next.label}
            </Button>
          </Link>
        )}
      </div>
      <ul className="mt-4 space-y-2">
        {steps.map((s) => (
          <li key={s.id} className="flex items-center gap-2 text-sm">
            {s.done ? (
              <CheckCircle2 className="size-4 text-success shrink-0" />
            ) : (
              <Circle className="size-4 text-muted-foreground shrink-0" />
            )}
            <span className={s.done ? "text-muted-foreground line-through" : ""}>{s.label}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
