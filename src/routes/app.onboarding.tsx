import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
import { validateHttpUrl } from "@/lib/security-url";
import { ColarTranscricaoButton } from "@/components/colar-transcricao-dialog";
import { ImportBibliotecaButton } from "@/components/import-biblioteca-dialog";

const ACTIVATION_STEPS = [
  "Perfil do projeto",
  "Gerar 5 ângulos",
  "Criar rascunho no editor",
  "Exportar MP4",
  "Marcar Subiu no pipeline",
] as const;

export const Route = createFileRoute("/app/onboarding")({
  head: () => ({
    meta: [{ title: "Configurar conta · Andromeda" }],
  }),
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const { refresh, projectId, loading: wsLoading } = useWorkspace();
  const { profile, user, refreshProfile } = useAuth();
  const saveProfile = useServerFn(updateProfile);

  const metaName =
    profile?.display_name ??
    (user?.user_metadata?.display_name as string | undefined) ??
    "";

  const [step, setStep] = useState<"profile" | "references">("profile");
  const [displayName, setDisplayName] = useState(metaName);
  const [nicho, setNicho] = useState("");
  const [urlDefault, setUrlDefault] = useState("");
  const [tipoUso, setTipoUso] = useState<"solo" | "agencia">("solo");
  const [loading, setLoading] = useState(false);
  const [savedUrl, setSavedUrl] = useState<string | undefined>();

  useEffect(() => {
    if (metaName && !displayName) setDisplayName(metaName);
  }, [metaName, displayName]);

  const needsName = !metaName.trim();
  const submitDisabled = loading || wsLoading || !projectId;
  const stepIndex = step === "profile" ? 1 : 2;
  const progressValue = step === "profile" ? 20 : 40;

  async function handleSubmitProfile() {
    const name = (needsName ? displayName : metaName).trim();
    if (!name || !nicho.trim()) {
      toast.error("Preencha nicho" + (needsName ? " e nome" : ""));
      return;
    }

    let normalizedUrl: string | undefined;
    const urlTrimmed = urlDefault.trim();
    if (urlTrimmed) {
      try {
        normalizedUrl = validateHttpUrl(urlTrimmed);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "URL inválida");
        return;
      }
    }

    setLoading(true);
    try {
      const workspace = await refresh();
      const resolvedProjectId = workspace.projectId ?? projectId;
      if (!resolvedProjectId) {
        toast.error("Workspace ainda não está pronto. Aguarde um instante e tente de novo.");
        return;
      }

      await saveProfile({
        data: {
          displayName: name,
          nicho: `${nicho.trim()} (${tipoUso})`,
          urlDefault: normalizedUrl,
          projectId: resolvedProjectId,
        },
      });

      const updatedProfile = await refreshProfile();
      if (!updatedProfile?.nicho) {
        toast.error("Não foi possível confirmar o perfil. Tente novamente.");
        return;
      }

      trackMetaOnboardingStep("profile_saved");
      setSavedUrl(normalizedUrl);
      setStep("references");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setLoading(false);
    }
  }

  function goToGerador() {
    trackMetaLead("onboarding_complete");
    trackMetaOnboardingStep("references_done");
    toast.success("Perfil configurado! Próximo passo: gerar seus ângulos.");

    const search: Record<string, string> = { ttfe: "1" };
    if (savedUrl) search.url = savedUrl;
    navigate({ to: "/app/gerador", search });
  }

  return (
    <div className="container max-w-lg mx-auto py-12 px-6">
      <div className="mb-6 space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">
          Passo {stepIndex} de 5 · {step === "profile" ? "Perfil" : "Referências (opcional)"}
        </p>
        <Progress value={progressValue} className="h-1.5" />
        <p className="text-xs text-muted-foreground">
          Jornada: {ACTIVATION_STEPS.join(" → ")}
        </p>
      </div>

      {step === "profile" ? (
        <Card className="glass bg-gradient-card p-8 space-y-6">
          <div>
            <h1 className="text-2xl font-display font-bold">Bem-vindo ao Andromeda</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Em menos de 10 minutos: ângulos, rascunho no editor e caminho até o primeiro MP4.
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
              <Label>URL do produto (opcional)</Label>
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

          <Button
            className="w-full bg-gradient-primary border-0"
            onClick={handleSubmitProfile}
            disabled={submitDisabled}
          >
            {loading || wsLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "Continuar"
            )}
          </Button>
          {wsLoading && (
            <p className="text-xs text-center text-muted-foreground">Preparando seu workspace…</p>
          )}
          <p className="text-xs text-center text-muted-foreground">
            Plano grátis inclui 3 gerações e 1 export por mês. O fluxo rápido usa 1 geração.
          </p>
        </Card>
      ) : (
        <Card className="glass bg-gradient-card p-8 space-y-6">
          <div>
            <h1 className="text-2xl font-display font-bold">Alimente a inteligência (opcional)</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Cole a transcrição de um criativo campeão ou importe MP4s que já converteram — a IA usa isso nas próximas gerações. Você pode pular.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <ColarTranscricaoButton variant="outline" size="default" />
            <ImportBibliotecaButton variant="outline" size="default" />
          </div>

          <div className="flex flex-col gap-2">
            <Button className="w-full bg-gradient-primary border-0" onClick={goToGerador}>
              Continuar para o gerador
            </Button>
            <Button variant="ghost" className="w-full text-muted-foreground" onClick={goToGerador}>
              Pular por agora
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

