import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sparkles,
  Wand2,
  Video,
  Film,
  TrendingUp,
  History,
  Brain,
  LogOut,
  Loader2,
  FolderKanban,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { WorkspaceProvider, useWorkspace } from "@/contexts/workspace-context";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "App · Andromeda" },
      { name: "description", content: "Dashboard e ferramentas para criar criativos de alta conversão." },
    ],
  }),
  component: AppLayout,
});

type NavItem = { title: string; url: string; icon: typeof Sparkles; exact?: boolean };
const items: NavItem[] = [
  { title: "Dashboard", url: "/app", icon: Sparkles, exact: true },
  { title: "Gerador de ângulos", url: "/app/gerador", icon: Wand2 },
  { title: "Editor de vídeo", url: "/app/editor", icon: Video },
  { title: "VSL curta", url: "/app/vsl", icon: Film },
  { title: "Fase de escala", url: "/app/escala", icon: TrendingUp },
  { title: "Histórico", url: "/app/historico", icon: History },
  { title: "Inteligência de nicho", url: "/app/inteligencia", icon: Brain },
  { title: "Projetos", url: "/app/projetos", icon: FolderKanban },
];

function AppAuthGate({ children }: { children: React.ReactNode }) {
  const { session, loading, profile } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  useEffect(() => {
    if (!loading && !session) {
      navigate({ to: "/login", search: { redirect: pathname } });
    }
  }, [loading, session, navigate, pathname]);

  useEffect(() => {
    if (!loading && session && profile && !profile.nicho && pathname !== "/app/onboarding") {
      navigate({ to: "/app/onboarding" });
    }
  }, [loading, session, profile, pathname, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary-glow" />
      </div>
    );
  }

  if (!session) return null;
  return <>{children}</>;
}

function ProjectSelector() {
  const { organizations, organizationId, projectId, setWorkspace, loading, currentProject } =
    useWorkspace();

  if (loading || !organizationId) return null;

  const org = organizations.find((o) => o.id === organizationId);
  const hasMultipleOrgs = organizations.length > 1;

  return (
    <div className="hidden md:flex items-center gap-2">
      {hasMultipleOrgs && (
        <Select
          value={organizationId}
          onValueChange={(oid) => {
            const nextOrg = organizations.find((o) => o.id === oid);
            const pid = nextOrg?.projects[0]?.id;
            if (pid) setWorkspace(oid, pid);
          }}
        >
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue placeholder="Workspace" />
          </SelectTrigger>
          <SelectContent>
            {organizations.map((o) => (
              <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Select
        value={projectId ?? undefined}
        onValueChange={(pid) => {
          if (organizationId) setWorkspace(organizationId, pid);
        }}
      >
        <SelectTrigger className="h-8 w-[180px] text-xs">
          <SelectValue placeholder="Projeto" />
        </SelectTrigger>
        <SelectContent>
          {org?.projects.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-xs text-muted-foreground max-w-[120px] truncate">
        {currentProject?.name}
      </span>
    </div>
  );
}

function AppLayout() {
  const { profile, signOut } = useAuth();

  return (
    <AppAuthGate>
      <WorkspaceProvider>
        <SidebarProvider>
          <div className="min-h-screen flex w-full bg-background">
            <AppSidebar />
            <div className="flex-1 flex flex-col">
              <header className="h-14 sticky top-0 z-30 flex items-center gap-3 border-b border-border/50 bg-background/80 backdrop-blur px-4">
                <SidebarTrigger />
                <Link to="/" className="flex items-center gap-2">
                  <div className="size-6 rounded-md bg-gradient-primary shadow-glow" />
                  <span className="font-display font-semibold text-sm">Andromeda</span>
                </Link>
                <ProjectSelector />
                <div className="ml-auto flex items-center gap-3">
                  <span className="text-xs text-muted-foreground hidden sm:inline">
                    {profile?.display_name ?? "Workspace"}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => signOut()} className="h-8 px-2">
                    <LogOut className="size-4" />
                  </Button>
                </div>
              </header>
              <main className="flex-1 overflow-auto">
                <Outlet />
              </main>
            </div>
          </div>
        </SidebarProvider>
      </WorkspaceProvider>
    </AppAuthGate>
  );
}

function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (url: string, exact?: boolean) =>
    exact ? pathname === url : pathname === url || pathname.startsWith(url + "/");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-md bg-gradient-primary shadow-glow" />
          <span className="font-display font-semibold">Andromeda</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url, item.exact)}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
