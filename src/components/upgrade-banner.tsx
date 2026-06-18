import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function UpgradeBanner({
  message,
  compact,
}: {
  message: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/10 px-4 ${compact ? "py-2" : "py-3"}`}
    >
      <p className="text-sm flex items-center gap-2">
        <Sparkles className="size-4 text-primary-glow shrink-0" />
        {message}
      </p>
      <Link to="/planos">
        <Button size="sm" variant="outline" className="min-h-11 border-primary/40">
          Ver planos
        </Button>
      </Link>
    </div>
  );
}
