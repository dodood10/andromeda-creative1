import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const searchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/login")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Entrar · Andromeda" },
      { name: "description", content: "Acesse sua conta Andromeda." },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("signin");

  async function handleSignIn() {
    if (!email || !password) {
      toast.error("Preencha e-mail e senha");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate({ to: redirect ?? "/app" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao entrar");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp() {
    if (!email || !password) {
      toast.error("Preencha e-mail e senha");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName || email.split("@")[0] },
        },
      });
      if (error) throw error;
      toast.success("Conta criada! Verifique seu e-mail se a confirmação estiver ativa.");
      navigate({ to: redirect ?? "/app/onboarding" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar conta");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!email) {
      toast.error("Informe seu e-mail para recuperar a senha");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      });
      if (error) throw error;
      toast.success("Enviamos um link de recuperação para seu e-mail");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar recuperação");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}${redirect ?? "/app"}` },
      });
      if (error) throw error;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao entrar com Google");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-background">
      <div className="hidden lg:flex flex-1 items-center justify-center p-12 border-r border-border/40 bg-primary/5">
        <div className="max-w-md space-y-6">
          <div className="size-12 rounded-xl bg-gradient-primary shadow-glow flex items-center justify-center">
            <Sparkles className="size-6 text-primary-foreground" />
          </div>
          <h2 className="text-3xl font-display font-bold">Em 2 min você terá 5 ângulos</h2>
          <p className="text-muted-foreground">
            Briefing → ângulos Andromeda → editor pré-montado → export MP4 com safe zones do Meta.
          </p>
          <ul className="text-sm space-y-2 text-muted-foreground">
            <li>· 5 ângulos por briefing com lógica probabilística</li>
            <li>· Editor com narração, score e export</li>
            <li>· Escala do criativo campeão com IA</li>
          </ul>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center lg:text-left">
            <Link to="/" className="inline-flex items-center gap-2 mb-6">
              <div className="size-8 rounded-lg bg-gradient-primary shadow-glow" />
              <span className="font-display font-bold text-xl">Andromeda</span>
            </Link>
            <h1 className="text-2xl font-display font-bold">
              {tab === "signup" ? "Crie sua conta" : "Entre na sua conta"}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {tab === "signup"
                ? "Gere seus primeiros ângulos em minutos."
                : "Continue de onde parou nos seus criativos."}
            </p>
          </div>

          <Card className="glass bg-gradient-card p-6">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="signin">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Criar conta</TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email-in">E-mail</Label>
                  <Input
                    id="email-in"
                    type="email"
                    autoComplete="email"
                    className="min-h-11"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password-in">Senha</Label>
                  <Input
                    id="password-in"
                    type="password"
                    autoComplete="current-password"
                    className="min-h-11"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="text-xs text-primary-glow hover:underline"
                  onClick={handleForgotPassword}
                >
                  Esqueci minha senha
                </button>
                <Button
                  className="w-full min-h-11 bg-gradient-primary border-0 shadow-glow"
                  onClick={handleSignIn}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="size-4 animate-spin" /> : "Entrar"}
                </Button>
              </TabsContent>

              <TabsContent value="signup" className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name-up">Nome</Label>
                  <Input
                    id="name-up"
                    className="min-h-11"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Como quer ser chamado"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email-up">E-mail</Label>
                  <Input
                    id="email-up"
                    type="email"
                    autoComplete="email"
                    className="min-h-11"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password-up">Senha</Label>
                  <Input
                    id="password-up"
                    type="password"
                    autoComplete="new-password"
                    className="min-h-11"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button
                  className="w-full min-h-11 bg-gradient-primary border-0 shadow-glow"
                  onClick={handleSignUp}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="size-4 animate-spin" /> : "Gerar meus primeiros ângulos"}
                </Button>
              </TabsContent>
            </Tabs>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/50" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">ou</span>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full min-h-11"
              onClick={handleGoogle}
              disabled={loading}
            >
              Continuar com Google
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
