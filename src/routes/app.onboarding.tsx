import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateProfile } from "@/lib/organizations.functions";
import { useWorkspace } from "@/contexts/workspace-context";
import { useAuth } from "@/hooks/use-auth";
import { trackMetaLead, trackMetaOnboardingStep } from "@/lib/meta-pixel";

export const Route = createFileRoute("/app/onboarding")({
  head: () => ({
    meta: [{ title: "Configurar conta · Andromeda" }],
  }),
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const { refresh, projectId } = useWorkspace();
  const { profile, user } = useAuth();
  const saveProfile = useServerFn(updateProfile);

  const metaName =
    profile?.display_name ??
    (user?.user_metadata?.display_name as string | undefined) ??
    "";

  const [displayName, setDisplayName] = useState(metaName);
  const [nicho, setNicho] = useState("");
  const [urlDefault, setUrlDefault] = useState("");
  const [tipoUso, setTipoUso] = useState<"solo" | "agencia">("solo");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (metaName && !displayName) setDisplayName(metaName);
  }, [metaName, displayName]);

  const needsName = !metaName.trim();
  const stepProgress = needsName ? 33 : 66;

  async function handleSubmit() {
    const name = (needsName ? displayName : metaName).trim();
    if (!name || !nicho.trim()) {
      toast.error("Preencha nicho" + (needsName ? " e nome" : ""));
      return;
    }
    setLoading(true);
    try {
      await saveProfile({
        data: {
          displayName: name,
          nicho: `${nicho.trim()} (${tipoUso})`,
          urlDefault: urlDefault.trim() || undefined,
          projectId: projectId ?? undefined,
        },
      });
      await refresh();
      trackMetaLead("onboarding_complete");
      trackMetaOnboardingStep("profile_saved");
      toast.success("Perfil configurado! Próximo passo: gerar seus ângulos.");
      const search: Record<string, string> = { ttfe: "1" };
      if (urlDefault.trim()) search.url = urlDefault.trim();
      navigate({ to: "/app/gerador", search });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container max-w-lg mx-auto py-12 px-6">
      <div className="mb-6 space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Primeiros passos · 1 de 3</p>
        <Progress value={stepProgress} className="h-1.5" />
      </div>
      <Card className="glass bg-gradient-card p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold">Bem-vindo ao Andromeda</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Em menos de 10 minutos você terá ângulos, rascunho e caminho até o primeiro MP4.
          </p>
        </div>

        <div className="space-y-4">
          {needsName && (
            <div className="space-y-1.5">
              <Label>Seu nome</Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Como quer ser chamado"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Nicho principal</Label>
            <Input
              value={nicho}
              onChange={(e) => setNicho(e.target.value)}
              placeholder="Ex: emagrecimento, SaaS B2B, e-commerce moda"
            />
          </div>
          <div className="space-y-1.5">
            <Label>URL do produto</Label>
            <Input
              value={urlDefault}
              onChange={(e) => setUrlDefault(e.target.value)}
              placeholder="https://seuproduto.com"
            />
            <p className="text-xs text-muted-foreground">Será pré-preenchida no gerador de ângulos.</p>
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
          {loading ? <Loader2 className="size-4 animate-spin" /> : "Continuar para o gerador"}
        </Button>
        <p className="text-xs text-center text-muted-foreground">
          Já tem conta?{" "}
          <Link to="/login" className="text-primary-glow hover:underline">
            Entrar
          </Link>
        </p>
      </Card>
    </div>
  );
}
