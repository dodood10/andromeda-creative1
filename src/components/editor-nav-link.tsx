import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Pencil } from "lucide-react";
import { getLatestCriativo } from "@/lib/criativos.functions";
import { useWorkspace } from "@/contexts/workspace-context";
import { getProductConfig, type ProductMode } from "@/lib/product-mode";

export function EditorNavLink({
  mode = "criativo",
  isActive,
  pendingExports = 0,
}: {
  mode?: ProductMode;
  isActive: boolean;
  pendingExports?: number;
}) {
  const config = getProductConfig(mode);
  const { projectId } = useWorkspace();
  const fetchLatest = useServerFn(getLatestCriativo);
  const editorPath = config.editorPath;
  const currentCriativoId = useRouterState({
    select: (s) => {
      if (!s.location.pathname.startsWith(editorPath)) return undefined;
      const id = (s.location.search as { criativoId?: string }).criativoId;
      return id;
    },
  });

  const { data: latest } = useQuery({
    queryKey: ["latest-criativo-nav", projectId, mode, currentCriativoId],
    queryFn: () =>
      fetchLatest({
        data: {
          projectId: projectId!,
          currentCriativoId,
          formatoSaida: config.forcedFormato,
        },
      }),
    enabled: !!projectId,
    staleTime: 30_000,
  });

  const search = latest?.criativoId ? { criativoId: latest.criativoId } : undefined;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive}>
        <Link to={editorPath} search={search} className="flex items-center gap-2 flex-1 min-w-0">
          <Pencil className="size-4 shrink-0" />
          <span className="truncate">{mode === "vsl" ? "Editor VSL" : "Editor"}</span>
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
