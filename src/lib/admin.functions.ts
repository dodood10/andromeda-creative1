import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requirePlatformAdmin } from "@/integrations/supabase/admin-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAdminAction } from "@/lib/admin-audit";
import { scheduleBackgroundRender } from "@/lib/render/background-task";
import { runBackgroundRenderForCriativoId } from "@/lib/render/process-render-job";
import {
  ReviewPerformandoSchema,
  ReviewResultadoSchema,
  scoreFromJson,
  SubmitAdminCriativoReviewSchema,
} from "@/lib/types/intel-review";
import {
  computeQueuePriorityScore,
  hasWhisperTranscriptionFromAnguloJson,
  priorityLabelFromScore,
} from "@/lib/intel-queue-priority";

const adminMiddleware = [requireSupabaseAuth, requirePlatformAdmin] as const;

const PeriodSchema = z.enum(["today", "7d", "30d", "all"]).default("30d");

function bucketLastNDays(rows: { created_at: string }[], days = 14) {
  const buckets: Record<string, number> = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    buckets[d.toISOString().slice(0, 10)] = 0;
  }
  for (const r of rows) {
    const key = r.created_at.slice(0, 10);
    if (key in buckets) buckets[key]++;
  }
  return Object.entries(buckets).map(([label, value]) => ({
    label: label.slice(5),
    value,
  }));
}

function periodStart(period: z.infer<typeof PeriodSchema>): string | null {
  if (period === "all") return null;
  const d = new Date();
  if (period === "today") {
    d.setHours(0, 0, 0, 0);
  } else if (period === "7d") {
    d.setDate(d.getDate() - 7);
  } else {
    d.setDate(d.getDate() - 30);
  }
  return d.toISOString();
}

const GERADOR_FUNNEL_STEPS = [
  "angulos_gerados",
  "wizard_step",
  "draft_created",
  "editor_opened",
  "render_started",
  "render_done",
  "render_failed",
  "export_pronto",
] as const;

async function loadGeradorFunnelCounts(since: string | null) {
  let q = supabaseAdmin.from("funnel_events").select("event_type");
  if (since) q = q.gte("created_at", since);
  const { data, error } = await q;
  const counts = Object.fromEntries(GERADOR_FUNNEL_STEPS.map((s) => [s, 0])) as Record<
    (typeof GERADOR_FUNNEL_STEPS)[number],
    number
  >;
  if (error) return counts;
  for (const row of data ?? []) {
    const t = row.event_type as (typeof GERADOR_FUNNEL_STEPS)[number];
    if (t in counts) counts[t]++;
  }
  return counts;
}

export const checkAdminAccess = createServerFn({ method: "GET" })
  .middleware([...adminMiddleware])
  .handler(async ({ context }) => {
    await logAdminAction({
      actorUserId: context.userId,
      action: "admin.access_check",
    });
    return { ok: true as const };
  });

export const getAdminOverview = createServerFn({ method: "POST" })
  .middleware([...adminMiddleware])
  .inputValidator((input: unknown) =>
    z.object({ period: PeriodSchema }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const since = periodStart(data.period);

    const [
      profilesRes,
      geracoesRes,
      criativosRes,
      resultadosRes,
      orgsRes,
      exportErroRes,
    ] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, created_at", { count: "exact", head: false }),
      supabaseAdmin.from("geracoes").select("id, user_id, created_at"),
      supabaseAdmin
        .from("criativos")
        .select("id, status, export_status, user_id, created_at, angulo, organization_id, estilo_producao"),
      supabaseAdmin.from("resultados_reportados").select("id, created_at"),
      supabaseAdmin.from("organizations").select("id, name, created_at"),
      supabaseAdmin
        .from("criativos")
        .select("id, angulo, produto, updated_at")
        .eq("export_status", "erro")
        .order("updated_at", { ascending: false })
        .limit(10),
    ]);

    const filterSince = <T extends { created_at: string }>(rows: T[] | null) =>
      since ? (rows ?? []).filter((r) => r.created_at >= since) : (rows ?? []);

    const profiles = filterSince(profilesRes.data as { id: string; created_at: string }[] | null);
    const geracoes = filterSince(geracoesRes.data as { id: string; user_id: string; created_at: string }[] | null);
    const criativos = filterSince(
      criativosRes.data as Array<{
        id: string;
        status: string;
        export_status: string | null;
        user_id: string;
        created_at: string;
        angulo: string;
        organization_id: string | null;
        estilo_producao: string | null;
      }> | null,
    );
    const resultados = filterSince(
      resultadosRes.data as { id: string; created_at: string }[] | null,
    );

    const statusCounts = {
      Gerado: 0,
      Subiu: 0,
      Rodando: 0,
      Performando: 0,
      Pausado: 0,
    };
    let exportsProntos = 0;
    const usersComGeracao = new Set<string>();
    const usersComCriativo = new Set<string>();
    const usersComExport = new Set<string>();

    for (const g of geracoes) usersComGeracao.add(g.user_id);
    for (const c of criativos) {
      usersComCriativo.add(c.user_id);
      if (c.status in statusCounts) {
        statusCounts[c.status as keyof typeof statusCounts]++;
      }
      if (c.export_status === "pronto") {
        exportsProntos++;
        usersComExport.add(c.user_id);
      }
    }

    const orgVolume: Record<string, { name: string; count: number }> = {};
    const orgs = orgsRes.data ?? [];
    for (const o of orgs) {
      orgVolume[o.id] = { name: o.name, count: 0 };
    }
    for (const c of criativos) {
      if (c.organization_id && orgVolume[c.organization_id]) {
        orgVolume[c.organization_id].count++;
      }
    }
    const topOrgs = Object.entries(orgVolume)
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const totalUsers = profilesRes.count ?? profiles.length;
    const newUsers = since ? profiles.length : totalUsers;

    const allGeracoes = (geracoesRes.data ?? []) as { created_at: string }[];
    const allCriativos = (criativosRes.data ?? []) as Array<{
      created_at: string;
      export_status: string | null;
    }>;
    const exportsForChart = allCriativos.filter((c) => c.export_status === "pronto");

    const pipelineStats: Record<
      string,
      { total: number; pronto: number; erro: number; renderizando: number }
    > = {};
    for (const c of criativos) {
      const estilo = c.estilo_producao ?? "texto_animado";
      if (!pipelineStats[estilo]) {
        pipelineStats[estilo] = { total: 0, pronto: 0, erro: 0, renderizando: 0 };
      }
      pipelineStats[estilo].total++;
      if (c.export_status === "pronto") pipelineStats[estilo].pronto++;
      if (c.export_status === "erro") pipelineStats[estilo].erro++;
      if (c.export_status === "renderizando") pipelineStats[estilo].renderizando++;
    }

    await logAdminAction({
      actorUserId: context.userId,
      action: "admin.view_overview",
      metadata: { period: data.period },
    });

    return {
      period: data.period,
      kpis: {
        totalUsers,
        newUsers,
        geracoes: geracoes.length,
        criativos: criativos.length,
        exportsProntos,
        performando: statusCounts.Performando,
        resultados: resultados.length,
        organizations: orgs.length,
      },
      funnel: {
        usersComGeracao: usersComGeracao.size,
        usersComCriativo: usersComCriativo.size,
        usersComExport: usersComExport.size,
        statusCounts,
        rascunhosSemExport: criativos.filter((c) => c.export_status !== "pronto" && c.status !== "Pausado").length,
        geradorFunnel: await loadGeradorFunnelCounts(since),
        pipelineStats,
      },
      topOrgs,
      exportErrors: exportErroRes.data ?? [],
      recentProfiles: [...profiles]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 8)
        .map((p) => ({ id: p.id, created_at: p.created_at })),
      charts: {
        geracoesPorDia: bucketLastNDays(allGeracoes, 14),
        exportsPorDia: bucketLastNDays(exportsForChart, 14),
      },
    };
  });

export const listAdminUsers = createServerFn({ method: "POST" })
  .middleware([...adminMiddleware])
  .inputValidator((input: unknown) =>
    z
      .object({
        search: z.string().optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(25),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;

    let profileQuery = supabaseAdmin
      .from("profiles")
      .select("id, display_name, nicho, is_platform_admin, created_at", { count: "exact" })
      .order("created_at", { ascending: false });

    const { data: profiles, error, count } = await profileQuery.range(from, to);
    if (error) throw new Error(error.message);

    const enriched = await Promise.all(
      (profiles ?? []).map(async (p) => {
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(p.id);
        const email = authUser?.user?.email ?? "";
        if (data.search?.trim()) {
          const q = data.search.trim().toLowerCase();
          const match =
            email.toLowerCase().includes(q) ||
            (p.display_name?.toLowerCase().includes(q) ?? false);
          if (!match) return null;
        }
        const [cRes, gRes, mRes] = await Promise.all([
          supabaseAdmin.from("criativos").select("id", { count: "exact", head: true }).eq("user_id", p.id),
          supabaseAdmin.from("geracoes").select("id", { count: "exact", head: true }).eq("user_id", p.id),
          supabaseAdmin
            .from("organization_members")
            .select("id", { count: "exact", head: true })
            .eq("user_id", p.id),
        ]);
        return {
          id: p.id,
          email,
          displayName: p.display_name,
          nicho: p.nicho,
          isPlatformAdmin: p.is_platform_admin ?? false,
          createdAt: p.created_at,
          lastSignIn: authUser?.user?.last_sign_in_at ?? null,
          criativos: cRes.count ?? 0,
          geracoes: gRes.count ?? 0,
          orgs: mRes.count ?? 0,
        };
      }),
    );

    await logAdminAction({
      actorUserId: context.userId,
      action: "admin.list_users",
      metadata: { page: data.page, search: data.search ?? null },
    });

    return {
      users: enriched.filter(Boolean) as NonNullable<(typeof enriched)[number]>[],
      total: count ?? 0,
      page: data.page,
      pageSize: data.pageSize,
    };
  });

export const listAdminOrganizations = createServerFn({ method: "POST" })
  .middleware([...adminMiddleware])
  .inputValidator((input: unknown) =>
    z.object({ search: z.string().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    let query = supabaseAdmin
      .from("organizations")
      .select("id, name, slug, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    const { data: orgs, error } = await query;
    if (error) throw new Error(error.message);

    let filtered = orgs ?? [];
    const q = data.search?.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter(
        (o) => o.name.toLowerCase().includes(q) || o.slug.toLowerCase().includes(q),
      );
    }

    const enriched = await Promise.all(
      filtered.map(async (org) => {
        const [membersRes, projectsRes, criativosRes] = await Promise.all([
          supabaseAdmin
            .from("organization_members")
            .select("user_id, role")
            .eq("organization_id", org.id),
          supabaseAdmin.from("projects").select("id, name, nicho").eq("organization_id", org.id),
          supabaseAdmin
            .from("criativos")
            .select("id, status")
            .eq("organization_id", org.id),
        ]);
        const criativos = criativosRes.data ?? [];
        return {
          ...org,
          memberCount: membersRes.data?.length ?? 0,
          members: membersRes.data ?? [],
          projects: projectsRes.data ?? [],
          criativoCount: criativos.length,
          performando: criativos.filter((c) => c.status === "Performando").length,
        };
      }),
    );

    await logAdminAction({
      actorUserId: context.userId,
      action: "admin.list_organizations",
    });

    return { organizations: enriched };
  });

export const listAdminCriativos = createServerFn({ method: "POST" })
  .middleware([...adminMiddleware])
  .inputValidator((input: unknown) =>
    z
      .object({
        status: z.string().optional(),
        exportStatus: z.string().optional(),
        organizationId: z.string().uuid().optional(),
        search: z.string().optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(30),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    let query = supabaseAdmin
      .from("criativos")
      .select(
        "id, produto, angulo, status, export_status, formato_saida, utm_content, created_at, updated_at, user_id, project_id, organization_id, score_json",
        { count: "exact" },
      )
      .order("created_at", { ascending: false });

    if (data.status) {
      query = query.eq("status", data.status as "Gerado" | "Subiu" | "Rodando" | "Performando" | "Pausado");
    }
    if (data.exportStatus) {
      query = query.eq("export_status", data.exportStatus as "rascunho" | "renderizando" | "pronto" | "erro");
    }
    if (data.organizationId) {
      query = query.eq("organization_id", data.organizationId);
    }

    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;
    const { data: rows, error, count } = await query.range(from, to);
    if (error) throw new Error(error.message);

    let criativos = rows ?? [];
    const q = data.search?.trim().toLowerCase();
    if (q) {
      criativos = criativos.filter(
        (c) =>
          c.angulo.toLowerCase().includes(q) ||
          c.produto.toLowerCase().includes(q) ||
          (c.utm_content?.toLowerCase().includes(q) ?? false),
      );
    }

    await logAdminAction({
      actorUserId: context.userId,
      action: "admin.list_criativos",
      metadata: { status: data.status, exportStatus: data.exportStatus },
    });

    return {
      criativos: criativos.map((c) => ({
        id: c.id,
        produto: c.produto,
        angulo: c.angulo,
        status: c.status,
        exportStatus: c.export_status,
        formatoSaida: c.formato_saida,
        utmContent: c.utm_content,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
        userId: c.user_id,
        projectId: c.project_id,
        organizationId: c.organization_id,
        scoreTotal:
          c.score_json && typeof c.score_json === "object" && "total" in c.score_json
            ? Number((c.score_json as { total?: number }).total)
            : null,
      })),
      total: count ?? criativos.length,
      page: data.page,
      pageSize: data.pageSize,
    };
  });

export const listAdminAuditLog = createServerFn({ method: "POST" })
  .middleware([...adminMiddleware])
  .inputValidator((input: unknown) =>
    z
      .object({
        limit: z.number().int().min(1).max(200).default(50),
        days: z.number().int().min(1).max(90).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    let query = supabaseAdmin
      .from("admin_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.days) {
      const since = new Date();
      since.setDate(since.getDate() - data.days);
      query = supabaseAdmin
        .from("admin_audit_log")
        .select("*")
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false })
        .limit(data.limit);
    }

    const { data: rows, error } = await query;

    if (error) throw new Error(error.message);

    await logAdminAction({
      actorUserId: context.userId,
      action: "admin.view_audit_log",
    });

    return { entries: rows ?? [] };
  });

export const getAdminApiUsage = createServerFn({ method: "POST" })
  .middleware([...adminMiddleware])
  .inputValidator((input: unknown) =>
    z.object({ days: z.number().int().min(1).max(90).default(30) }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const since = new Date();
    since.setDate(since.getDate() - data.days);

    const { data: events, error } = await supabaseAdmin
      .from("api_usage_events")
      .select("event_type, tokens_estimated, success, created_at, user_id")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    const rows = events ?? [];
    const byType: Record<string, { count: number; tokens: number; errors: number }> = {};
    const byUser: Record<string, { count: number; tokens: number }> = {};

    for (const e of rows) {
      const t = e.event_type;
      if (!byType[t]) byType[t] = { count: 0, tokens: 0, errors: 0 };
      byType[t].count++;
      byType[t].tokens += e.tokens_estimated ?? 0;
      if (!e.success) byType[t].errors++;

      if (e.user_id) {
        if (!byUser[e.user_id]) byUser[e.user_id] = { count: 0, tokens: 0 };
        byUser[e.user_id].count++;
        byUser[e.user_id].tokens += e.tokens_estimated ?? 0;
      }
    }

    const topUsers = Object.entries(byUser)
      .sort((a, b) => b[1].tokens - a[1].tokens)
      .slice(0, 10)
      .map(([userId, stats]) => ({ userId, ...stats }));

    const eventsByDay = bucketLastNDays(rows, Math.min(data.days, 14));

    const COST_PER_1K_TOKENS = 0.003;
    const totalTokens = rows.reduce((s, e) => s + (e.tokens_estimated ?? 0), 0);
    const estimatedCostUsd = (totalTokens / 1000) * COST_PER_1K_TOKENS;

    await logAdminAction({
      actorUserId: context.userId,
      action: "admin.view_api_usage",
      metadata: { days: data.days },
    });

    return {
      days: data.days,
      totalEvents: rows.length,
      totalTokens,
      estimatedCostUsd: Math.round(estimatedCostUsd * 100) / 100,
      byType: Object.entries(byType).map(([type, s]) => ({ type, ...s })),
      topUsers,
      eventsByDay,
      recentErrors: rows.filter((e) => !e.success).slice(0, 15),
    };
  });

export const setPlatformAdmin = createServerFn({ method: "POST" })
  .middleware([...adminMiddleware])
  .inputValidator(
    z.object({
      userId: z.string().uuid(),
      isPlatformAdmin: z.boolean(),
    }),
  )
  .handler(async ({ data, context }) => {
    if (data.userId === context.userId && !data.isPlatformAdmin) {
      const { count } = await supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("is_platform_admin", true);
      if ((count ?? 0) <= 1) {
        throw new Error("Não é possível remover o último admin da plataforma");
      }
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ is_platform_admin: data.isPlatformAdmin })
      .eq("id", data.userId);

    if (error) throw new Error(error.message);

    await logAdminAction({
      actorUserId: context.userId,
      action: data.isPlatformAdmin ? "admin.grant_platform_admin" : "admin.revoke_platform_admin",
      targetType: "user",
      targetId: data.userId,
    });

    return { ok: true };
  });

export const getAdminUserDetail = createServerFn({ method: "POST" })
  .middleware([...adminMiddleware])
  .inputValidator(z.object({ userId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", data.userId)
      .maybeSingle();

    const [geracoesRes, criativosRes, membersRes, latestCriativoRes] = await Promise.all([
      supabaseAdmin.from("geracoes").select("id", { count: "exact", head: true }).eq("user_id", data.userId),
      supabaseAdmin.from("criativos").select("id", { count: "exact", head: true }).eq("user_id", data.userId),
      supabaseAdmin
        .from("organization_members")
        .select("organization_id, role, organizations(id, name, slug)")
        .eq("user_id", data.userId),
      supabaseAdmin
        .from("criativos")
        .select("id, angulo, produto, status, export_status, created_at")
        .eq("user_id", data.userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    await logAdminAction({
      actorUserId: context.userId,
      action: "admin.view_user_detail",
      targetType: "user",
      targetId: data.userId,
    });

    return {
      id: data.userId,
      email: authUser?.user?.email ?? "",
      displayName: profile?.display_name ?? null,
      nicho: profile?.nicho ?? null,
      isPlatformAdmin: profile?.is_platform_admin ?? false,
      createdAt: profile?.created_at ?? authUser?.user?.created_at,
      lastSignIn: authUser?.user?.last_sign_in_at ?? null,
      banned: authUser?.user?.banned_until != null,
      geracoes: geracoesRes.count ?? 0,
      criativos: criativosRes.count ?? 0,
      organizations: (membersRes.data ?? []).map((m) => {
        const org = m.organizations as { id: string; name: string; slug: string } | null;
        return {
          id: m.organization_id,
          name: org?.name ?? "—",
          slug: org?.slug ?? "",
          role: m.role,
        };
      }),
      latestCriativo: latestCriativoRes.data,
    };
  });

export const getAdminCriativoDetail = createServerFn({ method: "POST" })
  .middleware([...adminMiddleware])
  .inputValidator(z.object({ criativoId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { data: criativo, error } = await supabaseAdmin
      .from("criativos")
      .select("*")
      .eq("id", data.criativoId)
      .single();

    if (error || !criativo) throw new Error("Criativo não encontrado");

    const paths = (criativo.export_paths as string[]) ?? [];
    const signed: Record<string, string> = {};
    if (paths.length > 0) {
      const { data: signedData } = await supabaseAdmin.storage
        .from("criativos-media")
        .createSignedUrls(paths, 3600);
      for (const item of signedData ?? []) {
        if (item.path && item.signedUrl) signed[item.path] = item.signedUrl;
      }
    }

    await logAdminAction({
      actorUserId: context.userId,
      action: "admin.view_criativo_detail",
      targetType: "criativo",
      targetId: data.criativoId,
    });

    return {
      criativo,
      signedUrls: signed,
      roteiro: criativo.roteiro,
      scoreJson: criativo.score_json,
    };
  });

export const adminReprocessExport = createServerFn({ method: "POST" })
  .middleware([...adminMiddleware])
  .inputValidator(z.object({ criativoId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { data: criativo, error } = await supabaseAdmin
      .from("criativos")
      .select("id")
      .eq("id", data.criativoId)
      .single();

    if (error || !criativo) throw new Error("Criativo não encontrado");

    await supabaseAdmin
      .from("criativos")
      .update({ export_status: "renderizando" })
      .eq("id", data.criativoId);

    scheduleBackgroundRender(() =>
      runBackgroundRenderForCriativoId(data.criativoId, context.userId),
    );

    await logAdminAction({
      actorUserId: context.userId,
      action: "admin.reprocess_export",
      targetType: "criativo",
      targetId: data.criativoId,
    });

    return { ok: true, status: "renderizando" as const };
  });

export const setUserSuspended = createServerFn({ method: "POST" })
  .middleware([...adminMiddleware])
  .inputValidator(
    z.object({
      userId: z.string().uuid(),
      suspended: z.boolean(),
    }),
  )
  .handler(async ({ data, context }) => {
    if (data.userId === context.userId) {
      throw new Error("Não é possível suspender sua própria conta");
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.suspended ? "876000h" : "none",
    });

    if (error) throw new Error(error.message);

    await logAdminAction({
      actorUserId: context.userId,
      action: data.suspended ? "admin.suspend_user" : "admin.unsuspend_user",
      targetType: "user",
      targetId: data.userId,
    });

    return { ok: true };
  });

async function resolveUserEmails(userIds: string[]): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  for (const id of [...new Set(userIds)]) {
    const { data } = await supabaseAdmin.auth.admin.getUserById(id);
    map[id] = data.user?.email ?? "";
  }
  return map;
}

async function resolveOrgNames(orgIds: string[]): Promise<Record<string, string>> {
  if (orgIds.length === 0) return {};
  const { data } = await supabaseAdmin.from("organizations").select("id, name").in("id", orgIds);
  const map: Record<string, string> = {};
  for (const o of data ?? []) map[o.id] = o.name;
  return map;
}

export const listAdminAvaliacaoQueue = createServerFn({ method: "POST" })
  .middleware([...adminMiddleware])
  .handler(async ({ context }) => {
    const [performandoRes, resultadosRes] = await Promise.all([
      supabaseAdmin
        .from("criativos")
        .select(
          "id, produto, angulo, user_id, organization_id, performando_intel_submitted_at, source, angulo_json",
        )
        .eq("performando_intel_status", "pending")
        .order("performando_intel_submitted_at", { ascending: true })
        .limit(100),
      supabaseAdmin
        .from("resultados_reportados")
        .select(
          "id, criativo_id, user_id, tipo, metrica, valor, observacao, created_at, criativos(produto, angulo, organization_id)",
        )
        .eq("intel_review_status", "pending")
        .order("created_at", { ascending: true })
        .limit(100),
    ]);

    if (performandoRes.error) throw new Error(performandoRes.error.message);
    if (resultadosRes.error) throw new Error(resultadosRes.error.message);

    const userIds = [
      ...(performandoRes.data ?? []).map((c) => c.user_id),
      ...(resultadosRes.data ?? []).map((r) => r.user_id),
    ];
    const orgIds = [
      ...(performandoRes.data ?? []).map((c) => c.organization_id).filter(Boolean) as string[],
      ...(resultadosRes.data ?? [])
        .map((r) => (r.criativos as { organization_id?: string } | null)?.organization_id)
        .filter(Boolean) as string[],
    ];

    const performandoIds = (performandoRes.data ?? []).map((c) => c.id);
    const { data: linkedResultados } = performandoIds.length
      ? await supabaseAdmin
          .from("resultados_reportados")
          .select("criativo_id, metrica, observacao")
          .in("criativo_id", performandoIds)
          .order("created_at", { ascending: false })
      : { data: [] };

    const linkedByCriativo = new Map<string, { metrica?: string | null; observacao?: string | null }>();
    for (const r of linkedResultados ?? []) {
      if (!linkedByCriativo.has(r.criativo_id)) {
        linkedByCriativo.set(r.criativo_id, { metrica: r.metrica, observacao: r.observacao });
      }
    }

    const [emails, orgNames] = await Promise.all([
      resolveUserEmails(userIds),
      resolveOrgNames(orgIds),
    ]);

    const performandoItems = (performandoRes.data ?? []).map((c) => {
      const linked = linkedByCriativo.get(c.id);
      const priorityScore = computeQueuePriorityScore({
        kind: "performando",
        observacao: linked?.observacao,
        metrica: linked?.metrica,
        source: c.source,
        hasWhisperTranscription: hasWhisperTranscriptionFromAnguloJson(c.angulo_json),
      });
      return {
        kind: "performando" as const,
        criativoId: c.id,
        produto: c.produto,
        angulo: c.angulo,
        organizationName: c.organization_id ? (orgNames[c.organization_id] ?? "—") : "—",
        userEmail: emails[c.user_id] ?? "",
        submittedAt: c.performando_intel_submitted_at ?? "",
        priorityScore,
        priorityLabel: priorityLabelFromScore(priorityScore),
      };
    });

    const resultadoItems = (resultadosRes.data ?? []).map((r) => {
      const criativo = r.criativos as {
        produto?: string;
        angulo?: string;
        organization_id?: string;
        source?: string;
        angulo_json?: { export_transcricao?: string } | null;
      } | null;
      const orgId = criativo?.organization_id;
      const priorityScore = computeQueuePriorityScore({
        kind: "resultado",
        observacao: r.observacao,
        metrica: r.metrica,
        source: criativo?.source,
        hasWhisperTranscription: hasWhisperTranscriptionFromAnguloJson(criativo?.angulo_json),
      });
      return {
        kind: "resultado" as const,
        resultadoId: r.id,
        criativoId: r.criativo_id,
        produto: criativo?.produto ?? "—",
        angulo: criativo?.angulo ?? "—",
        organizationName: orgId ? (orgNames[orgId] ?? "—") : "—",
        userEmail: emails[r.user_id] ?? "",
        tipo: r.tipo,
        metrica: r.metrica,
        valor: r.valor,
        observacao: r.observacao,
        submittedAt: r.created_at,
        priorityScore,
        priorityLabel: priorityLabelFromScore(priorityScore),
      };
    });

    const items = [...performandoItems, ...resultadoItems].sort((a, b) => {
      if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
      return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
    });

    await logAdminAction({
      actorUserId: context.userId,
      action: "admin.list_avaliacao_queue",
      metadata: { pending: items.length },
    });

    return { items, pendingCount: items.length };
  });

export const listAdminAvaliacaoCriativos = createServerFn({ method: "POST" })
  .middleware([...adminMiddleware])
  .inputValidator((input: unknown) =>
    z
      .object({
        search: z.string().optional(),
        intelStatus: z.enum(["all", "pending", "approved", "rejected", "none"]).default("all"),
        exportStatus: z.string().optional(),
        organizationId: z.string().uuid().optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(30),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    let query = supabaseAdmin
      .from("criativos")
      .select(
        "id, produto, angulo, status, export_status, formato_saida, created_at, user_id, organization_id, score_json, performando_intel_status",
        { count: "exact" },
      )
      .order("created_at", { ascending: false });

    if (data.exportStatus) {
      query = query.eq(
        "export_status",
        data.exportStatus as "rascunho" | "renderizando" | "pronto" | "erro",
      );
    }
    if (data.organizationId) {
      query = query.eq("organization_id", data.organizationId);
    }
    if (data.intelStatus === "pending") {
      query = query.eq("performando_intel_status", "pending");
    } else if (data.intelStatus === "approved") {
      query = query.eq("performando_intel_status", "approved");
    } else if (data.intelStatus === "rejected") {
      query = query.eq("performando_intel_status", "rejected");
    } else if (data.intelStatus === "none") {
      query = query.is("performando_intel_status", null);
    }

    const q = data.search?.trim();
    if (q) {
      const pattern = `%${q.replace(/%/g, "\\%")}%`;
      query = query.or(`angulo.ilike.${pattern},produto.ilike.${pattern},utm_content.ilike.${pattern}`);
    }

    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;
    const { data: rows, error, count } = await query.range(from, to);
    if (error) throw new Error(error.message);

    const userIds = (rows ?? []).map((r) => r.user_id);
    const orgIds = (rows ?? []).map((r) => r.organization_id).filter(Boolean) as string[];
    const [emails, orgNames] = await Promise.all([
      resolveUserEmails(userIds),
      resolveOrgNames(orgIds),
    ]);

    await logAdminAction({
      actorUserId: context.userId,
      action: "admin.list_avaliacao_criativos",
      metadata: { page: data.page, intelStatus: data.intelStatus },
    });

    return {
      criativos: (rows ?? []).map((c) => ({
        id: c.id,
        produto: c.produto,
        angulo: c.angulo,
        status: c.status,
        exportStatus: c.export_status,
        formatoSaida: c.formato_saida,
        performandoIntelStatus: c.performando_intel_status,
        organizationName: c.organization_id ? (orgNames[c.organization_id] ?? "—") : "—",
        userEmail: emails[c.user_id] ?? "",
        scoreTotal: scoreFromJson(c.score_json),
        createdAt: c.created_at,
      })),
      total: count ?? 0,
      page: data.page,
      pageSize: data.pageSize,
    };
  });

export const getAdminAvaliacaoDetail = createServerFn({ method: "POST" })
  .middleware([...adminMiddleware])
  .inputValidator(z.object({ criativoId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { data: criativo, error } = await supabaseAdmin
      .from("criativos")
      .select("*")
      .eq("id", data.criativoId)
      .single();

    if (error || !criativo) throw new Error("Criativo não encontrado");

    const [resultadosRes, reviewsRes, orgRes, userRes] = await Promise.all([
      supabaseAdmin
        .from("resultados_reportados")
        .select("*")
        .eq("criativo_id", data.criativoId)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("criativo_admin_reviews")
        .select("*")
        .eq("criativo_id", data.criativoId)
        .order("created_at", { ascending: false })
        .limit(20),
      criativo.organization_id
        ? supabaseAdmin.from("organizations").select("name").eq("id", criativo.organization_id).single()
        : Promise.resolve({ data: null }),
      supabaseAdmin.auth.admin.getUserById(criativo.user_id),
    ]);

    const paths = (criativo.export_paths as string[]) ?? [];
    const signed: Record<string, string> = {};
    if (paths.length > 0) {
      const { data: signedData } = await supabaseAdmin.storage
        .from("criativos-media")
        .createSignedUrls(paths, 3600);
      for (const item of signedData ?? []) {
        if (item.path && item.signedUrl) signed[item.path] = item.signedUrl;
      }
    }

    await logAdminAction({
      actorUserId: context.userId,
      action: "admin.view_avaliacao_detail",
      targetType: "criativo",
      targetId: data.criativoId,
    });

    return {
      criativo,
      signedUrls: signed,
      roteiro: criativo.roteiro,
      scoreJson: criativo.score_json,
      scoreTotal: scoreFromJson(criativo.score_json),
      organizationName: orgRes.data?.name ?? "—",
      userEmail: userRes.data.user?.email ?? "",
      resultados: resultadosRes.data ?? [],
      adminReviews: reviewsRes.data ?? [],
    };
  });

export const reviewPerformandoClaim = createServerFn({ method: "POST" })
  .middleware([...adminMiddleware])
  .inputValidator((input: unknown) => ReviewPerformandoSchema.parse(input))
  .handler(async ({ data, context }) => {
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("criativos")
      .update({
        performando_intel_status: data.status,
        performando_intel_reviewed_at: now,
        performando_intel_reviewed_by: context.userId,
        performando_intel_notes: data.notes ?? null,
      })
      .eq("id", data.criativoId)
      .eq("performando_intel_status", "pending");

    if (error) throw new Error(error.message);

    await logAdminAction({
      actorUserId: context.userId,
      action: data.status === "approved" ? "admin.approve_performando" : "admin.reject_performando",
      targetType: "criativo",
      targetId: data.criativoId,
      metadata: { notes: data.notes },
    });

    return { ok: true };
  });

export const reviewResultadoReport = createServerFn({ method: "POST" })
  .middleware([...adminMiddleware])
  .inputValidator((input: unknown) => ReviewResultadoSchema.parse(input))
  .handler(async ({ data, context }) => {
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("resultados_reportados")
      .update({
        intel_review_status: data.status,
        intel_reviewed_at: now,
        intel_reviewed_by: context.userId,
        intel_notes: data.notes ?? null,
      })
      .eq("id", data.resultadoId)
      .eq("intel_review_status", "pending");

    if (error) throw new Error(error.message);

    await logAdminAction({
      actorUserId: context.userId,
      action: data.status === "approved" ? "admin.approve_resultado" : "admin.reject_resultado",
      targetType: "resultado",
      targetId: data.resultadoId,
      metadata: { notes: data.notes },
    });

    return { ok: true };
  });

export const submitAdminCriativoReview = createServerFn({ method: "POST" })
  .middleware([...adminMiddleware])
  .inputValidator((input: unknown) => SubmitAdminCriativoReviewSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin.from("criativo_admin_reviews").insert({
      criativo_id: data.criativoId,
      admin_user_id: context.userId,
      verdict: data.verdict,
      quality_score: data.qualityScore ?? null,
      notes: data.notes ?? null,
      include_in_intelligence: data.includeInIntelligence ?? false,
    });

    if (error) throw new Error(error.message);

    await logAdminAction({
      actorUserId: context.userId,
      action: "admin.submit_criativo_review",
      targetType: "criativo",
      targetId: data.criativoId,
      metadata: {
        verdict: data.verdict,
        qualityScore: data.qualityScore,
        includeInIntelligence: data.includeInIntelligence,
      },
    });

    return { ok: true };
  });
