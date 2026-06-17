import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { acceptOrganizationInvite } from "@/lib/organizations.functions";

const searchSchema = z.object({
  token: z.string().optional(),
});

export const Route = createFileRoute("/accept-invite")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Aceitar convite · Andromeda" }] }),
  component: AcceptInvite,
});

function AcceptInvite() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const runAccept = useServerFn(acceptOrganizationInvite);

  const acceptMutation = useMutation({
    mutationFn: () => runAccept({ data: { token: token! } }),
    onSuccess: (result) => {
      try {
        localStorage.setItem(
          "andromeda_workspace",
          JSON.stringify({ organizationId: result.organizationId, projectId: "" }),
        );
      } catch {
        /* ignore */
      }
      toast.success("Convite aceito! Bem-vindo ao workspace.");
      navigate({ to: "/app" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao aceitar convite"),
  });

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="glass p-8 max-w-md text-center space-y-4">
          <Mail className="size-10 mx-auto text-muted-foreground" />
          <h1 className="text-xl font-display font-bold">Convite inválido</h1>
          <p className="text-sm text-muted-foreground">O link não contém um token válido.</p>
          <Link to="/app">
            <Button variant="outline">Ir para o app</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="glass p-8 max-w-md text-center space-y-6">
        <Mail className="size-10 mx-auto text-primary-glow" />
        <div>
          <h1 className="text-xl font-display font-bold">Aceitar convite</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Você foi convidado para um workspace. Faça login com o e-mail do convite e confirme abaixo.
          </p>
        </div>
        <Button
          className="w-full"
          disabled={acceptMutation.isPending}
          onClick={() => acceptMutation.mutate()}
        >
          {acceptMutation.isPending && <Loader2 className="size-4 animate-spin mr-1.5" />}
          Aceitar convite
        </Button>
        <p className="text-xs text-muted-foreground">
          Precisa entrar?{" "}
          <Link to="/login" search={{ redirect: `/accept-invite?token=${token}` }} className="text-primary-glow underline">
            Fazer login
          </Link>
        </p>
      </Card>
    </div>
  );
}
