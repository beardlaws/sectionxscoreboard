-- Daily guarded Arbiter roster automation.
-- Additive only. The job uses the same Vault token as schedule automation.

create table if not exists public.arbiter_roster_automation_runs (
  id uuid primary key default gen_random_uuid(),
  season_id uuid references public.seasons(id) on delete set null,
  trigger_source text not null default 'supabase-roster-cron',
  status text not null default 'running' check (status in ('running','completed','completed-with-errors','failed')),
  summary jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists arbiter_roster_automation_runs_started_idx on public.arbiter_roster_automation_runs(started_at desc);
create index if not exists arbiter_roster_automation_runs_status_idx on public.arbiter_roster_automation_runs(status,started_at desc);
alter table public.arbiter_roster_automation_runs enable row level security;

create or replace function public.trigger_sectionx_arbiter_rosters()
returns bigint language plpgsql security definer set search_path = public, vault, net as $$
declare token text; request_id bigint;
begin
  select decrypted_secret into token from vault.decrypted_secrets where name='sectionx_arbiter_pull_token' limit 1;
  if token is null then raise exception 'Section X Arbiter automation token is not configured'; end if;
  select net.http_get(url:='https://sectionxscoreboard.com/api/cron/arbiter-rosters',headers:=jsonb_build_object('x-sectionx-automation-key',token,'user-agent','SectionX-Supabase-Roster-Cron/1.0'),timeout_milliseconds:=300000) into request_id;
  return request_id;
end;
$$;
revoke all on function public.trigger_sectionx_arbiter_rosters() from public;
grant execute on function public.trigger_sectionx_arbiter_rosters() to service_role;

create or replace function public.sectionx_arbiter_cron_status()
returns table(jobid bigint,jobname text,schedule text,active boolean) language sql security definer set search_path = public, cron as $$ select j.jobid,j.jobname,j.schedule,j.active from cron.job j where j.jobname='sectionx-arbiter-pull' limit 1; $$;
create or replace function public.sectionx_roster_cron_status()
returns table(jobid bigint,jobname text,schedule text,active boolean) language sql security definer set search_path = public, cron as $$ select j.jobid,j.jobname,j.schedule,j.active from cron.job j where j.jobname='sectionx-arbiter-rosters' limit 1; $$;
revoke all on function public.sectionx_arbiter_cron_status() from public;
revoke all on function public.sectionx_roster_cron_status() from public;
grant execute on function public.sectionx_arbiter_cron_status() to service_role;
grant execute on function public.sectionx_roster_cron_status() to service_role;

do $$ declare existing_job bigint; begin
  select jobid into existing_job from cron.job where jobname='sectionx-arbiter-rosters' limit 1;
  if existing_job is not null then perform cron.unschedule(existing_job); end if;
  perform cron.schedule('sectionx-arbiter-rosters','30 12 * * *','select public.trigger_sectionx_arbiter_rosters();');
end $$;
