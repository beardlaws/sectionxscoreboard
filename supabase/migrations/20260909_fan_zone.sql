
create table if not exists public.fan_top_play_nominations (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  athlete_name text not null,
  school_id uuid references public.schools(id) on delete set null,
  sport_id uuid references public.sports(id) on delete set null,
  game_date date,
  opponent text,
  play_description text not null,
  why_top_five text,
  submitter_name text,
  submitter_email text,
  voter_hash text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','featured')),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists fan_top_play_week_idx on public.fan_top_play_nominations(week_start,status,created_at desc);
alter table public.fan_top_play_nominations enable row level security;
drop policy if exists "Public read featured top plays" on public.fan_top_play_nominations;
create policy "Public read featured top plays" on public.fan_top_play_nominations
for select using (status in ('approved','featured'));

create table if not exists public.fan_power_rank_ballots (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  sport_id uuid not null references public.sports(id) on delete cascade,
  group_type text not null check (group_type in ('class','division','all')),
  group_value text not null default 'All',
  rankings jsonb not null,
  voter_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(week_start,sport_id,group_type,group_value,voter_hash)
);
create index if not exists fan_power_rank_week_idx on public.fan_power_rank_ballots(week_start,sport_id,group_type,group_value);
alter table public.fan_power_rank_ballots enable row level security;

create table if not exists public.fan_power_rank_snapshots (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  sport_id uuid not null references public.sports(id) on delete cascade,
  group_type text not null,
  group_value text not null,
  results jsonb not null,
  ballot_count integer not null default 0,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(week_start,sport_id,group_type,group_value)
);
alter table public.fan_power_rank_snapshots enable row level security;
drop policy if exists "Public read published fan rankings" on public.fan_power_rank_snapshots;
create policy "Public read published fan rankings" on public.fan_power_rank_snapshots
for select using (published=true);
