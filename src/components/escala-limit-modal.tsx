import { Link } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TrendingUp } from "lucide-react";

type EscalaLimitModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EscalaLimitModal({ open, onOpenChange }: EscalaLimitModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="size-5 text-primary-glow" />
            Escala disponível no plano Pro
          </DialogTitle>
          <DialogDescription>
            Variações de escala com IA não estão incluídas no plano grátis. Faça upgrade para multiplicar
            criativos campeões com as 7 lateralizações Andromeda.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2 justify-end pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Entendi
          </Button>
          <Link to="/app/plano">
            <Button className="bg-gradient-primary border-0">Ver plano e uso</Button>
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
