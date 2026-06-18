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
  History,
  LogOut,
  Loader2,
  FolderKanban,
  Settings,
  BarChart3,
  TrendingUp,
  Plus,
  CreditCard,
  Shield,
  Film,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { WorkspaceProvider, useWorkspace } from "@/contexts/workspace-context";
import { EditorNavLink } from "@/components/editor-nav-link";
import { BatchDraftChecklistHost } from "@/components/batch-draft-checklist-host";
import { getDashboardStats, getVslDashboardStats } from "@/lib/criativos.functions";
import { productModeFromPathname, getProductConfig } from "@/lib/product-mode";
import { safeLoginRedirect } from "@/lib/utils";

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

const navGroups: Array<{ label: string; items: NavItem[]; showEditor?: boolean; editorMode?: "criativo" | "vsl" }> = [
  {
    label: "Criar",
    items: [{ title: "Criar ângulos", url: "/app/gerador", icon: Wand2 }],
    showEditor: true,
    editorMode: "criativo",
  },
  {
    label: "VSL",
    items: [{ title: "VSL curta", url: "/app/vsl", icon: Film }],
    showEditor: true,
    editorMode: "vsl",
  },
  {
    label: "Operar",
    items: [
      { title: "Dashboard", url: "/app", icon: Sparkles, exact: true },
      { title: "Pipeline", url: "/app/historico", icon: History },
    ],
  },
  {
    label: "Aprender",
    items: [
      { title: "Inteligência", url: "/app/inteligencia", icon: BarChart3 },
      { title: "Escala", url: "/app/escala", icon: TrendingUp },
    ],
  },
];

function AppAuthGate({ children }: { children: React.ReactNode }) {
  const { session, loading, profile } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  useEffect(() => {
    if (!loading && !session) {
      navigate({ to: "/login", search: { redirect: safeLoginRedirect(pathname) } });
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

function ProjectSelector({ compact }: { compact?: boolean }) {
  const { organizations, organizationId, projectId, setWorkspace, loading, currentProject } =
    useWorkspace();

  if (loading || !organizationId) return null;

  const org = organizations.find((o) => o.id === organizationId);
  const hasMultipleOrgs = organizations.length > 1;

  return (
    <div className={`${compact ? "flex" : "hidden md:flex"} items-center gap-2`}>
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
      {!compact && (
        <span className="text-xs text-muted-foreground max-w-[120px] truncate hidden lg:inline">
          {currentProject?.name}
        </span>
      )}
    </div>
  );
}

function OnboardingShell({ children }: { children: React.ReactNode }) {
  const { signOut } = useAuth();
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="h-14 flex items-center justify-between border-b border-border/50 px-6">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-md bg-gradient-primary shadow-glow" />
          <span className="font-display font-semibold">Andromeda</span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => signOut()}>
          <LogOut className="size-4 mr-1.5" /> Sair
        </Button>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}

function AppLayout() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isOnboarding = pathname === "/app/onboarding";

  if (isOnboarding) {
    return (
      <AppAuthGate>
        <WorkspaceProvider>
          <OnboardingShell>
            <Outlet />
          </OnboardingShell>
        </WorkspaceProvider>
      </AppAuthGate>
    );
  }

  return (
    <AppAuthGate>
      <WorkspaceProvider>
        <AppShell />
      </WorkspaceProvider>
    </AppAuthGate>
  );
}

function AppShell() {
  const { profile, signOut } = useAuth();
  const { currentOrg } = useWorkspace();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isOwner = currentOrg?.role === "owner";
  const productMode = productModeFromPathname(pathname);
  const productConfig = getProductConfig(productMode);
  const geradorPath = productConfig.geradorPath;
  const showFab =
    pathname.startsWith("/app") &&
    pathname !== geradorPath &&
    pathname !== "/app/vsl/gerador";
  const fabLabel = productMode === "vsl" ? "Nova VSL" : "Novo criativo";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar isOwner={isOwner} />
        <div className="flex-1 flex flex-col">
          <header className="h-14 sticky top-0 z-30 flex items-center gap-3 border-b border-border/50 bg-background/80 backdrop-blur px-4">
            <SidebarTrigger />
            <Link to="/app" className="flex items-center gap-2">
              <div className="size-6 rounded-md bg-gradient-primary shadow-glow" />
              <span className="font-display font-semibold text-sm">Andromeda</span>
            </Link>
            <ProjectSelector />
            <div className="flex md:hidden flex-1 min-w-0 max-w-[200px]">
              <ProjectSelector compact />
            </div>
            <div className="ml-auto flex items-center gap-3">
              {isOwner && (
                <Link to="/app/configuracoes" className="hidden sm:flex">
                  <Button variant="ghost" size="sm" className="h-8 px-2" title="Configurações">
                    <Settings className="size-4" />
                  </Button>
                </Link>
              )}
              <Link to="/app/projetos" className="hidden sm:flex">
                <Button variant="ghost" size="sm" className="h-8 px-2" title="Projetos">
                  <FolderKanban className="size-4" />
                </Button>
              </Link>
              <Link to="/app/plano" className="flex sm:hidden">
                <Button variant="ghost" size="sm" className="h-8 px-2" title="Plano e uso">
                  <CreditCard className="size-4" />
                </Button>
              </Link>
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
            <BatchDraftChecklistHost />
          </main>
          {showFab && (
            <Link
              to={geradorPath}
              className="fixed bottom-4 right-4 z-40 md:bottom-6 md:right-6"
            >
              <Button
                size="lg"
                className="rounded-full shadow-glow bg-gradient-primary border-0 min-h-12 min-w-12 px-4"
              >
                <Plus className="size-5 mr-1" />
                <span className="hidden sm:inline">{fabLabel}</span>
              </Button>
            </Link>
          )}
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppSidebar({ isOwner }: { isOwner: boolean }) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { profile } = useAuth();
  const { projectId } = useWorkspace();
  const fetchStats = useServerFn(getDashboardStats);
  const isActive = (url: string, exact?: boolean) =>
    exact ? pathname === url : pathname === url || pathname.startsWith(url + "/");

  const fetchVslStats = useServerFn(getVslDashboardStats);

  const { data: dashStats } = useQuery({
    queryKey: ["dashboard-stats-nav", projectId],
    queryFn: () => fetchStats({ data: { projectId: projectId! } }),
    enabled: !!projectId,
    staleTime: 60_000,
  });

  const { data: vslStats } = useQuery({
    queryKey: ["vsl-dashboard-stats-nav", projectId],
    queryFn: () => fetchVslStats({ data: { projectId: projectId! } }),
    enabled: !!projectId,
    staleTime: 60_000,
  });

  const showEscala =
    (dashStats?.counts?.Performando ?? 0) > 0 ||
    !!dashStats?.firstPerformandoId ||
    (vslStats?.performando ?? 0) > 0 ||
    !!vslStats?.firstPerformandoId;
  const pendingExports = dashStats?.semExport ?? 0;
  const pendingVslExports = vslStats?.semExport ?? 0;
  const isPlatformAdmin = !!(profile as { is_platform_admin?: boolean } | null)?.is_platform_admin;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 py-3">
        <Link to="/app" className="flex items-center gap-2">
          <div className="size-7 rounded-md bg-gradient-primary shadow-glow" />
          <span className="font-display font-semibold">Andromeda</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items
                  .filter((item) => item.url !== "/app/escala" || showEscala)
                  .map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive(item.url, item.exact)}>
                      <Link to={item.url} className="flex items-center gap-2">
                        <item.icon className="size-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
                {group.showEditor && (
                  <EditorNavLink
                    mode={group.editorMode ?? "criativo"}
                    isActive={isActive(group.editorMode === "vsl" ? "/app/vsl/editor" : "/app/editor")}
                    pendingExports={group.editorMode === "vsl" ? pendingVslExports : pendingExports}
                  />
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
        <SidebarGroup className="md:hidden">
          <SidebarGroupLabel>Projeto</SidebarGroupLabel>
          <SidebarGroupContent className="px-2 pb-2">
            <ProjectSelector compact />
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Conta</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/app/projetos"}>
                  <Link to="/app/projetos" className="flex items-center gap-2">
                    <FolderKanban className="size-4" />
                    <span>Projetos</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/app/plano"}>
                  <Link to="/app/plano" className="flex items-center gap-2">
                    <CreditCard className="size-4" />
                    <span>Plano e uso</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {isOwner && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === "/app/configuracoes"}>
                    <Link to="/app/configuracoes" className="flex items-center gap-2">
                      <Settings className="size-4" />
                      <span>Configurações</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {isPlatformAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname.startsWith("/admin")}>
                    <Link to="/admin" className="flex items-center gap-2">
                      <Shield className="size-4" />
                      <span>Admin</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
