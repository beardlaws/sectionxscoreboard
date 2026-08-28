-- Section X Scoreboard: lightweight fan follows + alert preferences
-- Non-destructive. Extends the existing email score-alert system without requiring accounts.

create table if not exists public.fan_follow_preferences (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  team_id uuid references public.teams(id) on delete cascade,
  athlete_id uuid references public.athletes(id) on delete cascade,
  alert_finals boolean not null default true,
  alert_schedule_changes boolean not null default true,
  alert_live boolean not null default false,
  alert_photos boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fan_follow_one_target check ((team_id is not null)::int + (athlete_id is not null)::int = 1)
);

create unique index if not exists fan_follow_team_unique
  on public.fan_follow_preferences (lower(email), team_id)
  where team_id is not null;
create unique index if not exists fan_follow_athlete_unique
  on public.fan_follow_preferences (lower(email), athlete_id)
  where athlete_id is not null;
create index if not exists fan_follow_team_active_idx on public.fan_follow_preferences(team_id) where active=true;
create index if not exists fan_follow_athlete_active_idx on public.fan_follow_preferences(athlete_id) where active=true;

alter table public.fan_follow_preferences enable row level security;
revoke all on public.fan_follow_preferences from anon, authenticated;
grant all on public.fan_follow_preferences to service_role;

create or replace function public.touch_fan_follow_preferences()
returns trigger language plpgsql set search_path=public as $$
begin new.updated_at=now(); return new; end; $$;
drop trigger if exists fan_follow_preferences_touch on public.fan_follow_preferences;
create trigger fan_follow_preferences_touch before update on public.fan_follow_preferences
for each row execute function public.touch_fan_follow_preferences();

-- Admin-safe rollup; never expose subscriber email publicly.
create or replace view public.fan_follow_counts as
select team_id, athlete_id, count(*)::bigint as followers
from public.fan_follow_preferences
where active=true
group by team_id, athlete_id;
revoke all on public.fan_follow_counts from public;
grant select on public.fan_follow_counts to service_role;
