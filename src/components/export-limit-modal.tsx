import { Link } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

type ExportLimitModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exportsUsed: number;
  exportsLimit: number;
};

export function ExportLimitModal({
  open,
  onOpenChange,
  exportsUsed,
  exportsLimit,
}: ExportLimitModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary-glow" />
            Limite de exports atingido
          </DialogTitle>
          <DialogDescription>
            Você usou {exportsUsed} de {exportsLimit} export(s) MP4 este mês no plano grátis.
            O upgrade Pro será liberado em breve — enquanto isso, priorize exportar o criativo com maior potencial.
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
