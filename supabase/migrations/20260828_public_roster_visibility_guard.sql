-- Public roster publication guardrails.
-- Non-destructive: existing rows stay in place for audit/history, but active-season
-- Arbiter rows are not readable by public/authenticated clients until the team's
-- freshness audit is explicitly current-verified.
-- Also blocks future direct Arbiter writes that bypass the guarded v2 worker.

create or replace function public.sectionx_roster_publicly_visible(
  p_team_id uuid,
  p_season_id uuid,
  p_source text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when coalesce(lower(p_source), '') <> 'arbiter' then true
    when not exists (
      select 1
      from public.seasons s
      where s.id = p_season_id
        and s.is_active = true
    ) then true
    else exists (
      select 1
      from public.arbiter_roster_freshness f
      where f.team_id = p_team_id
        and f.season_id = p_season_id
        and f.verified = true
        and f.status = 'current-verified'
    )
  end;
$$;

revoke all on function public.sectionx_roster_publicly_visible(uuid, uuid, text) from public;
grant execute on function public.sectionx_roster_publicly_visible(uuid, uuid, text) to anon, authenticated, service_role;

alter table public.roster_entries enable row level security;
drop policy if exists "Roster freshness publication guard" on public.roster_entries;
create policy "Roster freshness publication guard"
on public.roster_entries
as restrictive
for select
to anon, authenticated
using (
  public.sectionx_roster_publicly_visible(team_id, season_id, source)
);

-- Coaches arrive from the same Arbiter team payload. Keep them under the same
-- freshness boundary so an old coaching staff cannot be presented as current.
alter table public.team_coaches enable row level security;
drop policy if exists "Coach freshness publication guard" on public.team_coaches;
create policy "Coach freshness publication guard"
on public.team_coaches
as restrictive
for select
to anon, authenticated
using (
  public.sectionx_roster_publicly_visible(team_id, season_id, source)
);

create or replace function public.sectionx_guard_arbiter_roster_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(lower(new.source), '') = 'arbiter'
     and exists (
       select 1
       from public.seasons s
       where s.id = new.season_id
         and s.is_active = true
     )
     and not exists (
       select 1
       from public.arbiter_roster_freshness f
       where f.team_id = new.team_id
         and f.season_id = new.season_id
         and f.verified = true
         and f.status = 'current-verified'
     )
  then
    raise exception 'Blocked unverified Arbiter roster write for team %, season %', new.team_id, new.season_id;
  end if;
  return new;
end;
$$;

revoke all on function public.sectionx_guard_arbiter_roster_write() from public;
grant execute on function public.sectionx_guard_arbiter_roster_write() to service_role;

drop trigger if exists sectionx_guard_arbiter_roster_write on public.roster_entries;
create trigger sectionx_guard_arbiter_roster_write
before insert or update on public.roster_entries
for each row execute function public.sectionx_guard_arbiter_roster_write();

drop trigger if exists sectionx_guard_arbiter_coach_write on public.team_coaches;
create trigger sectionx_guard_arbiter_coach_write
before insert or update on public.team_coaches
for each row execute function public.sectionx_guard_arbiter_roster_write();

create or replace view public.arbiter_roster_publication_status_admin as
select
  t.id as team_id,
  t.team_name,
  s.id as season_id,
  s.name as season_name,
  f.status,
  coalesce(f.verified, false) as verified,
  f.reason,
  f.checked_at,
  count(distinct re.id) filter (
    where re.active = true and coalesce(lower(re.source), '') = 'arbiter'
  ) as active_arbiter_roster_entries,
  count(distinct tc.id) filter (
    where tc.active = true and coalesce(lower(tc.source), '') = 'arbiter'
  ) as active_arbiter_coaches,
  coalesce(f.verified, false) and f.status = 'current-verified' as publicly_visible
from public.teams t
join public.team_seasons ts on ts.team_id = t.id and ts.active_for_season = true
join public.seasons s on s.id = ts.season_id and s.is_active = true
left join public.arbiter_roster_freshness f on f.team_id = t.id and f.season_id = s.id
left join public.roster_entries re on re.team_id = t.id and re.season_id = s.id
left join public.team_coaches tc on tc.team_id = t.id and tc.season_id = s.id
group by t.id, t.team_name, s.id, s.name, f.status, f.verified, f.reason, f.checked_at;

revoke all on public.arbiter_roster_publication_status_admin from anon, authenticated;
grant select on public.arbiter_roster_publication_status_admin to service_role;
