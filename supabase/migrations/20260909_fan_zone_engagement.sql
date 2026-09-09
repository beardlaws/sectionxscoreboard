create table if not exists public.fan_game_votes (
 id uuid primary key default gen_random_uuid(),
 week_start date not null,
 game_id uuid not null references public.games(id) on delete cascade,
 voter_hash text not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(week_start,voter_hash)
);
create index if not exists fan_game_votes_week_idx on public.fan_game_votes(week_start,game_id);
alter table public.fan_game_votes enable row level security;

create table if not exists public.fan_game_vote_snapshots (
 id uuid primary key default gen_random_uuid(),
 week_start date not null,
 game_id uuid not null references public.games(id) on delete cascade,
 votes integer not null default 0,
 published boolean not null default true,
 updated_at timestamptz not null default now(),
 unique(week_start,game_id)
);
alter table public.fan_game_vote_snapshots enable row level security;
drop policy if exists "Public read game vote snapshots" on public.fan_game_vote_snapshots;
create policy "Public read game vote snapshots" on public.fan_game_vote_snapshots for select using (published=true);

create table if not exists public.fan_school_support (
 id uuid primary key default gen_random_uuid(),
 week_start date not null,
 school_id uuid not null references public.schools(id) on delete cascade,
 voter_hash text not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(week_start,voter_hash)
);
create index if not exists fan_school_support_week_idx on public.fan_school_support(week_start,school_id);
alter table public.fan_school_support enable row level security;

create table if not exists public.fan_school_support_snapshots (
 id uuid primary key default gen_random_uuid(),
 week_start date not null,
 school_id uuid not null references public.schools(id) on delete cascade,
 votes integer not null default 0,
 published boolean not null default true,
 updated_at timestamptz not null default now(),
 unique(week_start,school_id)
);
alter table public.fan_school_support_snapshots enable row level security;
drop policy if exists "Public read school support snapshots" on public.fan_school_support_snapshots;
create policy "Public read school support snapshots" on public.fan_school_support_snapshots for select using (published=true);