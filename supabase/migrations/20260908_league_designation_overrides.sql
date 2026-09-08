-- Explicit league/non-league designation with admin override protection.
alter table public.games add column if not exists league_designation text;
alter table public.games add column if not exists league_designation_override boolean not null default false;
alter table public.games add column if not exists league_designation_note text;
alter table public.games add column if not exists league_designation_updated_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='games_league_designation_check'
  ) then
    alter table public.games
      add constraint games_league_designation_check
      check (league_designation is null or league_designation in ('League','Non-League'));
  end if;
end $$;

-- Seed the designation from the latest Arbiter payload wherever Arbiter is explicit.
update public.games g
set league_designation = case
      when lower(coalesce(l.source_payload->>'gameTypeName',''))='league' then 'League'
      when lower(coalesce(l.source_payload->>'gameTypeName',''))='non-league' then 'Non-League'
      else g.league_designation
    end,
    league_designation_updated_at = now()
from public.arbiter_game_links l
where l.game_id=g.id
  and coalesce(g.league_designation_override,false)=false
  and lower(coalesce(l.source_payload->>'gameTypeName','')) in ('league','non-league');

-- Explicitly correct the Sept. 5 Heuvelton-Morristown girls soccer result.
-- The tournament result counts as a league game per Section X scheduling.
update public.games
set league_designation='League',
    league_designation_override=true,
    league_designation_note='Admin override: Sept. 5 Heuvelton vs Morristown tournament result counts as a league game.',
    league_designation_updated_at=now(),
    updated_at=now()
where id='0e909183-a87d-4ee0-8b77-6d6a584f96d8';
