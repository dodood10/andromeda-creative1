import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
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
import { Sparkles, Wand2, Video, Film, TrendingUp, History, Brain } from "lucide-react";

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
];


function AppLayout() {
  return (
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
            <div className="ml-auto text-xs text-muted-foreground">Workspace demo</div>
          </header>
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
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
