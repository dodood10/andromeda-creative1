import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listWorkspaces = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: memberships, error } = await supabase
      .from("organization_members")
      .select("organization_id, role, organizations(id, name, slug)")
      .eq("user_id", userId);

    if (error) throw new Error(error.message);

    const orgIds = (memberships ?? []).map((m) => m.organization_id);
    if (orgIds.length === 0) return { organizations: [] as WorkspaceOrg[] };

    const { data: projects, error: pErr } = await supabase
      .from("projects")
      .select("*")
      .in("organization_id", orgIds)
      .order("created_at", { ascending: true });

    if (pErr) throw new Error(pErr.message);

    const organizations: WorkspaceOrg[] = (memberships ?? []).map((m) => {
      const org = m.organizations as { id: string; name: string; slug: string } | null;
      return {
        id: m.organization_id,
        name: org?.name ?? "Workspace",
        slug: org?.slug ?? "",
        role: m.role,
        projects: (projects ?? []).filter((p) => p.organization_id === m.organization_id),
      };
    });

    return { organizations };
  });

export type WorkspaceOrg = {
  id: string;
  name: string;
  slug: string;
  role: string;
  projects: Array<{
    id: string;
    name: string;
    nicho: string | null;
    organization_id: string;
    url_default: string | null;
  }>;
};

export const createProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      organizationId: z.string().uuid(),
      name: z.string().min(1),
      nicho: z.string().optional(),
      urlDefault: z.string().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: project, error } = await supabase
      .from("projects")
      .insert({
        organization_id: data.organizationId,
        name: data.name,
        nicho: data.nicho ?? null,
        url_default: data.urlDefault ?? null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return project;
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      displayName: z.string().optional(),
      nicho: z.string().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: data.displayName,
        nicho: data.nicho,
      })
      .eq("id", userId);

    if (error) throw new Error(error.message);
    return { ok: true };
  });
