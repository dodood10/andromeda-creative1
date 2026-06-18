import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Film, Wand2, Pencil, History } from "lucide-react";
import { AppBreadcrumbs } from "@/components/app-breadcrumbs";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/vsl")({
  head: () => ({
    meta: [
      { title: "VSL curta · Andromeda" },
      { name: "description", content: "Gere, edite e acompanhe VSLs curtas de 2 minutos." },
    ],
  }),
  component: VslLayout,
});

const subnav = [
  { label: "Cockpit", to: "/app/vsl", icon: Film, exact: true },
  { label: "Gerar", to: "/app/vsl/gerador", icon: Wand2 },
  { label: "Editor", to: "/app/vsl/editor", icon: Pencil },
  { label: "Pipeline", to: "/app/historico", icon: History, search: { formato: "vsl_curta" as const } },
] as const;

function VslLayout() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  return (
    <div className="container mx-auto px-6 py-6 max-w-6xl space-y-6">
      <AppBreadcrumbs items={[{ label: "Dashboard", to: "/app" }, { label: "VSL curta" }]} />
      <div>
        <h1 className="text-2xl font-display font-bold">VSL curta</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Roteiro de 2 min em 6 blocos — produto separado do criativo curto.
        </p>
      </div>
      <nav className="flex flex-wrap gap-1 border-b border-border/50 pb-px">
        {subnav.map((item) => {
          const active = item.exact
            ? pathname === item.to
            : pathname === item.to || pathname.startsWith(`${item.to}/`);
          return (
            <Link
              key={item.to}
              to={item.to}
              search={"search" in item ? item.search : undefined}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                active
                  ? "border-primary text-primary-glow"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <Outlet />
    </div>
  );
}
