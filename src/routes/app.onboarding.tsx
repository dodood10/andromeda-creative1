import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateProfile } from "@/lib/organizations.functions";
import { useWorkspace } from "@/contexts/workspace-context";

export const Route = createFileRoute("/app/onboarding")({
  head: () => ({
    meta: [{ title: "Configurar conta · Andromeda" }],
  }),
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const { refresh } = useWorkspace();
  const saveProfile = useServerFn(updateProfile);

  const [displayName, setDisplayName] = useState("");
  const [nicho, setNicho] = useState("");
  const [tipoUso, setTipoUso] = useState<"solo" | "agencia">("solo");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!displayName.trim() || !nicho.trim()) {
      toast.error("Preencha nome e nicho");
      return;
    }
    setLoading(true);
    try {
      await saveProfile({
        data: {
          displayName: displayName.trim(),
          nicho: `${nicho.trim()} (${tipoUso})`,
        },
      });
      await refresh();
      toast.success("Perfil configurado!");
      navigate({ to: "/app" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container max-w-lg mx-auto py-16 px-6">
      <Card className="glass bg-gradient-card p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold">Bem-vindo ao Andromeda</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Configure seu workspace para começar a gerar criativos.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Seu nome</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Como quer ser chamado" />
          </div>
          <div className="space-y-1.5">
            <Label>Nicho principal</Label>
            <Input value={nicho} onChange={(e) => setNicho(e.target.value)} placeholder="Ex: emagrecimento, SaaS B2B, e-commerce moda" />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo de uso</Label>
            <Select value={tipoUso} onValueChange={(v) => setTipoUso(v as typeof tipoUso)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="solo">Solo / infoprodutor</SelectItem>
                <SelectItem value="agencia">Agência / gestor</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button className="w-full bg-gradient-primary border-0" onClick={handleSubmit} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : "Começar"}
        </Button>
      </Card>
    </div>
  );
}
