create table if not exists public.staff_power_rank_snapshots (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  sport_id uuid not null references public.sports(id) on delete cascade,
  group_type text not null check (group_type in ('class','division','all')),
  group_value text not null default 'All',
  rankings jsonb not null default '[]'::jsonb,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(week_start,sport_id,group_type,group_value)
);
create index if not exists staff_power_rank_week_idx on public.staff_power_rank_snapshots(week_start,sport_id,group_type,group_value);
alter table public.staff_power_rank_snapshots enable row level security;
