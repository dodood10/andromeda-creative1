import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Definir nova senha · Andromeda" },
      { name: "description", content: "Defina uma nova senha para sua conta Andromeda." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Supabase routes the magic link to this page with `#type=recovery&access_token=...`.
  // The client picks up that hash automatically and creates a recovery session,
  // emitting a PASSWORD_RECOVERY event. We just need to confirm a session exists.
  useEffect(() => {
    let mounted = true;

    const sub = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setHasRecoverySession(true);
        setChecking(false);
      }
    });

    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (data.session) {
        setHasRecoverySession(true);
      }
      setChecking(false);
    })();

    return () => {
      mounted = false;
      sub.data.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("A senha precisa ter pelo menos 8 caracteres");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não conferem");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      toast.success("Senha atualizada com sucesso");
      // Sign out the recovery session so the user logs in fresh with the new password.
      await supabase.auth.signOut();
      setTimeout(() => navigate({ to: "/login" }), 1500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível atualizar a senha");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-gradient-primary shadow-glow flex items-center justify-center">
            <Sparkles className="size-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Definir nova senha</h1>
            <p className="text-sm text-muted-foreground">Escolha uma senha que você lembre.</p>
          </div>
        </div>

        {checking ? (
          <div className="py-8 flex items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : done ? (
          <div className="space-y-3 text-center py-4">
            <CheckCircle2 className="size-10 text-success mx-auto" />
            <p className="text-sm text-muted-foreground">
              Senha atualizada. Redirecionando para o login…
            </p>
          </div>
        ) : !hasRecoverySession ? (
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              Link de recuperação inválido ou expirado. Solicite um novo no login.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link to="/login">Voltar para o login</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nova senha</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirmar senha</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                minLength={8}
                required
              />
            </div>
            <Button type="submit" className="w-full bg-gradient-primary border-0" disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : "Atualizar senha"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
