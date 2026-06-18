import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { Pencil } from "lucide-react";
import { getLatestCriativo } from "@/lib/criativos.functions";
import { useWorkspace } from "@/contexts/workspace-context";

export function EditorNavLink({ isActive }: { isActive: boolean }) {
  const { projectId } = useWorkspace();
  const fetchLatest = useServerFn(getLatestCriativo);

  const { data: latest } = useQuery({
    queryKey: ["latest-criativo-nav", projectId],
    queryFn: () => fetchLatest({ data: { projectId: projectId! } }),
    enabled: !!projectId,
    staleTime: 30_000,
  });

  const to = "/app/editor" as const;
  const search = latest?.criativoId ? { criativoId: latest.criativoId } : undefined;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive}>
        <Link to={to} search={search} className="flex items-center gap-2">
          <Pencil className="size-4" />
          <span>Editor</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
