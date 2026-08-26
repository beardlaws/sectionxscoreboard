create table if not exists public.arbiter_sync_runs (
  id uuid primary key default gen_random_uuid(),
  season_id uuid references public.seasons(id) on delete set null,
  mode text not null default 'controlled',
  window_start timestamptz,
  window_end timestamptz,
  status text not null default 'running',
  summary jsonb,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.arbiter_sync_actions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.arbiter_sync_runs(id) on delete cascade,
  arbiter_game_id bigint,
  game_id uuid references public.games(id) on delete set null,
  action text not null,
  outcome text not null,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists arbiter_sync_actions_run_id_idx on public.arbiter_sync_actions(run_id);
create index if not exists arbiter_sync_actions_arbiter_game_id_idx on public.arbiter_sync_actions(arbiter_game_id);

alter table public.arbiter_sync_runs enable row level security;
alter table public.arbiter_sync_actions enable row level security;

comment on table public.arbiter_sync_runs is 'Admin/service-role audit trail for controlled Arbiter schedule sync runs.';
comment on table public.arbiter_sync_actions is 'Per-game action log for controlled Arbiter schedule sync runs.';
