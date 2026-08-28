create table if not exists public.admin_exception_resolutions (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  arbiter_game_id text not null,
  game_id uuid null references public.games(id) on delete set null,
  exception_bucket text not null,
  resolution text not null check (resolution in ('confirm-scrimmage','keep-quarantined')),
  note text null,
  evidence_fingerprint text not null,
  evidence jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists admin_exception_resolutions_active_unique
  on public.admin_exception_resolutions(season_id, arbiter_game_id)
  where active;

alter table public.admin_exception_resolutions enable row level security;
revoke all on public.admin_exception_resolutions from anon, authenticated;
grant all on public.admin_exception_resolutions to service_role;

comment on table public.admin_exception_resolutions is
  'Audited Section X admin decisions for Arbiter exceptions. A decision is honored only while its evidence fingerprint still matches the current Arbiter record.';
