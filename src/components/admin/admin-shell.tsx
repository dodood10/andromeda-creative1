import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Users,
  Building2,
  Film,
  ScrollText,
  ArrowLeft,
  Loader2,
  Shield,
  BarChart3,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { checkAdminAccess } from "@/lib/admin.functions";

const navItems = [
  { title: "Overview", url: "/admin", icon: LayoutDashboard, exact: true },
  { title: "Usuários", url: "/admin/usuarios", icon: Users },
  { title: "Organizações", url: "/admin/organizacoes", icon: Building2 },
  { title: "Criativos", url: "/admin/criativos", icon: Film },
  { title: "IA & custos", url: "/admin/ia", icon: BarChart3 },
  { title: "Auditoria", url: "/admin/auditoria", icon: ScrollText },
] as const;

export function AdminShell() {
  const { session, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const verifyAdmin = useServerFn(checkAdminAccess);

  const { isLoading, isError, error } = useQuery({
    queryKey: ["admin-access"],
    queryFn: () => verifyAdmin(),
    enabled: !!session,
    retry: false,
  });

  useEffect(() => {
    if (!authLoading && !session) {
      navigate({ to: "/login", search: { redirect: pathname } });
    }
  }, [authLoading, session, navigate, pathname]);

  if (authLoading || (!session && !authLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary-glow" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary-glow" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 text-center gap-4">
        <Shield className="size-12 text-muted-foreground" />
        <h1 className="text-2xl font-display font-bold">Acesso negado</h1>
        <p className="text-muted-foreground max-w-md text-sm">
          {error instanceof Error ? error.message : "Você não tem permissão de administrador da plataforma."}
        </p>
        <Link to="/app">
          <Button variant="outline">Voltar ao app</Button>
        </Link>
      </div>
    );
  }

  const isActive = (url: string, exact?: boolean) =>
    exact ? pathname === url : pathname === url || pathname.startsWith(url + "/");

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-56 border-r border-border/50 bg-card/30 flex flex-col shrink-0">
        <div className="p-4 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Shield className="size-5 text-primary-glow" />
            <span className="font-display font-semibold text-sm">Admin</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wide">Plataforma</p>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {navItems.map((item) => (
            <Link
              key={item.url}
              to={item.url}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
                isActive(item.url, item.exact)
                  ? "bg-primary/15 text-primary-glow"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              <item.icon className="size-4 shrink-0" />
              {item.title}
            </Link>
          ))}
        </nav>
        <div className="p-2 border-t border-border/50 space-y-1">
          <Link to="/app">
            <Button variant="ghost" size="sm" className="w-full justify-start gap-2">
              <ArrowLeft className="size-4" /> Voltar ao app
            </Button>
          </Link>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => signOut()}>
            Sair
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}

export function AdminKpiCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="glass rounded-xl p-4 border border-border/40">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-display font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}
