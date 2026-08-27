-- Stable Arbiter team identity for fast roster automation.
-- Mirrors arbiter_game_links: discover a team identity once, then reuse it.

CREATE TABLE IF NOT EXISTS public.arbiter_team_links (
  team_id uuid PRIMARY KEY REFERENCES public.teams(id) ON DELETE CASCADE,
  arbiter_team_id bigint NOT NULL UNIQUE,
  arbiter_school_id bigint,
  source text NOT NULL DEFAULT 'schedule-observation',
  confidence text NOT NULL DEFAULT 'stable',
  observed_count integer NOT NULL DEFAULT 1,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_arbiter_team_links_arbiter_school
  ON public.arbiter_team_links(arbiter_school_id);

ALTER TABLE public.arbiter_team_links ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.arbiter_team_links IS
  'Permanent Section X team -> Arbiter team identity used by roster automation. Service-role only; no public policies.';
