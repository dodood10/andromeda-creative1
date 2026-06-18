import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Pencil } from "lucide-react";
import { getLatestCriativo } from "@/lib/criativos.functions";
import { useWorkspace } from "@/contexts/workspace-context";

export function EditorNavLink({
  isActive,
  pendingExports = 0,
}: {
  isActive: boolean;
  pendingExports?: number;
}) {
  const { projectId } = useWorkspace();
  const fetchLatest = useServerFn(getLatestCriativo);
  const currentCriativoId = useRouterState({
    select: (s) => {
      if (!s.location.pathname.startsWith("/app/editor")) return undefined;
      const id = (s.location.search as { criativoId?: string }).criativoId;
      return id;
    },
  });

  const { data: latest } = useQuery({
    queryKey: ["latest-criativo-nav", projectId, currentCriativoId],
    queryFn: () =>
      fetchLatest({
        data: {
          projectId: projectId!,
          currentCriativoId,
        },
      }),
    enabled: !!projectId,
    staleTime: 30_000,
  });

  const to = "/app/editor" as const;
  const search = latest?.criativoId ? { criativoId: latest.criativoId } : undefined;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive}>
        <Link to={to} search={search} className="flex items-center gap-2 flex-1 min-w-0">
          <Pencil className="size-4 shrink-0" />
          <span className="truncate">Editor</span>
          {pendingExports > 0 && (
            <Badge
              variant="outline"
              className="ml-auto text-[10px] px-1.5 py-0 border-warning/50 text-warning shrink-0"
              title={`${pendingExports} export(s) pendente(s)`}
            >
              {pendingExports}
            </Badge>
          )}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
