import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type RenderJobStatus = "pending" | "running" | "done" | "failed";

export type RenderJobProgress = {
  step?: string;
  current?: number;
  total?: number;
  message?: string;
};

export async function createRenderJob(params: {
  criativoId: string;
  provider: string;
  externalJobId?: string;
}) {
  const { data, error } = await supabaseAdmin
    .from("video_render_jobs")
    .insert({
      criativo_id: params.criativoId,
      provider: params.provider,
      external_job_id: params.externalJobId ?? null,
      status: "pending",
      progress: {},
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function updateRenderJob(
  jobId: string,
  patch: {
    status?: RenderJobStatus;
    progress?: RenderJobProgress;
    result_paths?: string[];
    error?: string;
    external_job_id?: string;
    cost_usd?: number;
    cost_breakdown?: Record<string, unknown>;
    duration_ms?: number;
  },
) {
  const { cost_breakdown, ...rest } = patch;
  const { error } = await supabaseAdmin
    .from("video_render_jobs")
    .update({
      ...rest,
      cost_breakdown: cost_breakdown as never,
      result_paths: patch.result_paths ?? undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (error) throw new Error(error.message);
}

export async function getLatestRenderJob(criativoId: string) {
  const { data, error } = await supabaseAdmin
    .from("video_render_jobs")
    .select("*")
    .eq("criativo_id", criativoId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}
