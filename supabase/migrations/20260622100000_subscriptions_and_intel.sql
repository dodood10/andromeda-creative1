-- Subscriptions per organization
CREATE TYPE public.plan_tier AS ENUM ('free', 'pro', 'agency');

CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tier public.plan_tier NOT NULL DEFAULT 'free',
  stripe_customer_id text,
  stripe_subscription_id text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id)
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY subscriptions_select_member ON public.subscriptions
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

-- Daily niche intelligence cache
CREATE TABLE public.niche_daily_intel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nicho_key text NOT NULL,
  nicho_label text NOT NULL,
  insights jsonb NOT NULL DEFAULT '[]'::jsonb,
  generated_for date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (nicho_key, generated_for)
);

ALTER TABLE public.niche_daily_intel ENABLE ROW LEVEL SECURITY;

CREATE POLICY niche_intel_read_authenticated ON public.niche_daily_intel
  FOR SELECT TO authenticated USING (true);

CREATE POLICY niche_intel_insert_authenticated ON public.niche_daily_intel
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY niche_intel_update_authenticated ON public.niche_daily_intel
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
