-- Roster season provenance guardrails.

create table if not exists public.arbiter_roster_freshness (
  team_id uuid not null references public.teams(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  arbiter_team_id bigint,
  status text not null check (status in ('current-verified','current-probable','awaiting-current-roster','possible-prior-season-roster','prior-season-roster','review-needed')),
  verified boolean not null default false,
  reason text not null,
  incoming_count integer not null default 0,
  previous_count integer not null default 0,
  previous_overlap numeric(6,4) not null default 0,
  evidence jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now(),
  primary key (team_id, season_id)
);
alter table public.arbiter_roster_freshness enable row level security;
revoke all on public.arbiter_roster_freshness from anon, authenticated;
create index if not exists arbiter_roster_freshness_status_idx on public.arbiter_roster_freshness (season_id,status,verified);

create or replace view public.arbiter_roster_freshness_admin as
select f.team_id,t.team_name,f.season_id,s.name season_name,f.arbiter_team_id,f.status,f.verified,f.reason,f.incoming_count,f.previous_count,f.previous_overlap,f.evidence,f.checked_at
from public.arbiter_roster_freshness f join public.teams t on t.id=f.team_id join public.seasons s on s.id=f.season_id;
revoke all on public.arbiter_roster_freshness_admin from anon,authenticated;

insert into public.arbiter_roster_freshness (team_id,season_id,status,verified,reason,incoming_count,previous_count,previous_overlap,evidence,checked_at)
with a as (select id,year,season_type from public.seasons where is_active=true limit 1),p as (select x.id from public.seasons x,a where x.season_type=a.season_type and x.year=a.year-1 limit 1),c as (select r.team_id,r.season_id,array_agg(lower(trim(x.display_name))) names,count(*)::int cnt from public.roster_entries r join public.athletes x on x.id=r.athlete_id join a on a.id=r.season_id where r.active=true and r.source='arbiter' group by r.team_id,r.season_id),q as (select r.team_id,array_agg(lower(trim(x.display_name))) names,count(*)::int cnt from public.roster_entries r join public.athletes x on x.id=r.athlete_id join p on p.id=r.season_id where r.active=true and r.source='arbiter' group by r.team_id),z as (select c.team_id,c.season_id,c.cnt cc,q.cnt pc,(select count(*)::numeric from unnest(c.names)n where n=any(q.names))/greatest(1,least(c.cnt,q.cnt)) ov from c join q using(team_id))
select team_id,season_id,'possible-prior-season-roster',false,'Existing active-season Arbiter roster is essentially identical to the previous season; held for review.',cc,pc,ov,jsonb_build_object('source','retroactive-audit'),now() from z where ov>=.95 and cc=pc
on conflict(team_id,season_id) do update set status=excluded.status,verified=false,reason=excluded.reason,incoming_count=excluded.incoming_count,previous_count=excluded.previous_count,previous_overlap=excluded.previous_overlap,evidence=excluded.evidence,checked_at=excluded.checked_at;

create or replace function public.trigger_sectionx_arbiter_rosters()
returns void language plpgsql security definer set search_path=public,extensions as $$
declare v_base_url text; v_token text;
begin
  select decrypted_secret into v_base_url from vault.decrypted_secrets where name='sectionx_site_url' limit 1;
  select decrypted_secret into v_token from vault.decrypted_secrets where name='sectionx_automation_key' limit 1;
  if coalesce(v_base_url,'')='' or coalesce(v_token,'')='' then raise exception 'Section X roster automation secrets are not configured.'; end if;
  perform net.http_get(url:=rtrim(v_base_url,'/')||'/api/cron/arbiter-rosters-v2',headers:=jsonb_build_object('x-sectionx-automation-key',v_token),timeout_milliseconds:=120000);
end; $$;
revoke all on function public.trigger_sectionx_arbiter_rosters() from public,anon,authenticated;
