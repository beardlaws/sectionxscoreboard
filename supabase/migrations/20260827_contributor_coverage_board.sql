-- Section X Scoreboard — contributor coverage board

CREATE TABLE IF NOT EXISTS public.contributor_coverage_requests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  coverage_role text NOT NULL CHECK (coverage_role IN ('coverage','photographer','score-reporter','live-score')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','claimed','cancelled','closed')),
  notes text,
  requested_by text NOT NULL DEFAULT 'admin',
  claimed_by uuid REFERENCES public.contributor_profiles(id) ON DELETE SET NULL,
  claimed_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS contributor_coverage_requests_active_unique
  ON public.contributor_coverage_requests(game_id, coverage_role)
  WHERE status IN ('open','claimed');

CREATE INDEX IF NOT EXISTS idx_contributor_coverage_requests_status
  ON public.contributor_coverage_requests(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contributor_coverage_requests_claimed_by
  ON public.contributor_coverage_requests(claimed_by)
  WHERE claimed_by IS NOT NULL;

ALTER TABLE public.contributor_coverage_requests ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.contributor_coverage_requests IS
  'Admin-created game coverage opportunities that approved contributors can claim through authenticated server routes.';
