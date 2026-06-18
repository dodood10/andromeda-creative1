import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { OrgMemberRole } from "./types/enums";

async function assertOrgOwner(
  supabase: SupabaseClient<Database>,
  userId: string,
  organizationId: string,
) {
  const { data, error } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (data?.role !== "owner") {
    throw new Error("Apenas o owner do workspace pode executar esta ação");
  }
}

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
  role: OrgMemberRole;
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
      urlDefault: z.string().optional(),
      projectId: z.string().uuid().optional(),
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

    if (data.projectId) {
      const patch: Record<string, string | null> = {};
      if (data.nicho) patch.nicho = data.nicho;
      if (data.urlDefault) patch.url_default = data.urlDefault;
      if (Object.keys(patch).length > 0) {
        await supabase.from("projects").update(patch).eq("id", data.projectId);
      }
    }

    return { ok: true };
  });

export const getWorkspaceSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ organizationId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOrgOwner(supabase, userId, data.organizationId);

    const { data: org, error } = await supabase
      .from("organizations")
      .select("id, name, slug, created_at")
      .eq("id", data.organizationId)
      .single();

    if (error) throw new Error(error.message);

    const { data: members, error: mErr } = await supabase
      .from("organization_members")
      .select("user_id, role, created_at")
      .eq("organization_id", data.organizationId)
      .order("created_at", { ascending: true });

    if (mErr) throw new Error(mErr.message);

    const userIds = (members ?? []).map((m) => m.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

    return {
      organization: org,
      members: (members ?? []).map((m) => ({
        userId: m.user_id,
        role: m.role,
        displayName: profileMap.get(m.user_id) ?? null,
        joinedAt: m.created_at,
      })),
    };
  });

export const updateOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      organizationId: z.string().uuid(),
      name: z.string().min(1).max(120),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOrgOwner(supabase, userId, data.organizationId);

    const { data: org, error } = await supabase
      .from("organizations")
      .update({ name: data.name.trim() })
      .eq("id", data.organizationId)
      .select("id, name, slug")
      .single();

    if (error) throw new Error(error.message);
    return org;
  });

export const inviteOrganizationMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      organizationId: z.string().uuid(),
      email: z.string().email(),
      role: z.enum(["editor", "viewer"]).default("editor"),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOrgOwner(supabase, userId, data.organizationId);

    const { data: invite, error } = await supabase
      .from("organization_invites")
      .insert({
        organization_id: data.organizationId,
        email: data.email.trim().toLowerCase(),
        role: data.role,
        invited_by: userId,
      })
      .select("id, email, role, token, expires_at, created_at")
      .single();

    if (error) throw new Error(error.message);
    return { invite, acceptPath: `/accept-invite?token=${invite.token}` };
  });

export const listOrganizationInvites = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ organizationId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOrgOwner(supabase, userId, data.organizationId);

    const { data: invites, error } = await supabase
      .from("organization_invites")
      .select("id, email, role, token, expires_at, accepted_at, created_at")
      .eq("organization_id", data.organizationId)
      .is("accepted_at", null)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return { invites: invites ?? [] };
  });

export const cancelOrganizationInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      organizationId: z.string().uuid(),
      inviteId: z.string().uuid(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOrgOwner(supabase, userId, data.organizationId);

    const { error } = await supabase
      .from("organization_invites")
      .delete()
      .eq("id", data.inviteId)
      .eq("organization_id", data.organizationId);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const acceptOrganizationInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ token: z.string().min(1) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: authData } = await supabase.auth.getUser();
    const email = authData.user?.email?.toLowerCase();
    if (!email) throw new Error("E-mail não encontrado na sessão");

    const { data: invite, error } = await supabase
      .from("organization_invites")
      .select("*")
      .eq("token", data.token)
      .is("accepted_at", null)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!invite) throw new Error("Convite inválido ou já aceito");
    if (invite.email.toLowerCase() !== email) {
      throw new Error("Este convite foi enviado para outro e-mail");
    }
    if (new Date(invite.expires_at) < new Date()) {
      throw new Error("Convite expirado");
    }

    const { error: memberErr } = await supabase.from("organization_members").upsert(
      {
        organization_id: invite.organization_id,
        user_id: userId,
        role: invite.role,
      },
      { onConflict: "organization_id,user_id" },
    );

    if (memberErr) throw new Error(memberErr.message);

    await supabase
      .from("organization_invites")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invite.id);

    return { organizationId: invite.organization_id, role: invite.role };
  });

export const updateMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      organizationId: z.string().uuid(),
      memberUserId: z.string().uuid(),
      role: z.enum(["editor", "viewer"]),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOrgOwner(supabase, userId, data.organizationId);

    const { error } = await supabase
      .from("organization_members")
      .update({ role: data.role })
      .eq("organization_id", data.organizationId)
      .eq("user_id", data.memberUserId)
      .neq("role", "owner");

    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeOrganizationMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      organizationId: z.string().uuid(),
      memberUserId: z.string().uuid(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOrgOwner(supabase, userId, data.organizationId);
    if (data.memberUserId === userId) throw new Error("Não é possível remover a si mesmo");

    const { error } = await supabase
      .from("organization_members")
      .delete()
      .eq("organization_id", data.organizationId)
      .eq("user_id", data.memberUserId)
      .neq("role", "owner");

    if (error) throw new Error(error.message);
    return { ok: true };
  });
