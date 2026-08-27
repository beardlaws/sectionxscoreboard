-- Section X Scoreboard automated Arbiter pull foundation.
-- Additive only. Secrets and the actual cron schedule are installed separately after deployment.

create extension if not exists pg_net;
create extension if not exists pg_cron;

create table if not exists public.arbiter_automation_runs (
  id uuid primary key default gen_random_uuid(),
  season_id uuid references public.seasons(id) on delete set null,
  trigger_source text not null default 'supabase-cron',
  status text not null default 'running' check (status in ('running','completed','completed-with-errors','failed')),
  summary jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists arbiter_automation_runs_started_idx on public.arbiter_automation_runs(started_at desc);
create index if not exists arbiter_automation_runs_status_idx on public.arbiter_automation_runs(status,started_at desc);

alter table public.arbiter_automation_runs enable row level security;

create or replace function public.verify_sectionx_automation_key(p_token text)
returns boolean
language sql
security definer
set search_path = public, vault
as $$
  select coalesce(exists(
    select 1
    from vault.decrypted_secrets
    where name = 'sectionx_arbiter_pull_token'
      and decrypted_secret = p_token
  ), false);
$$;

revoke all on function public.verify_sectionx_automation_key(text) from public;
grant execute on function public.verify_sectionx_automation_key(text) to service_role;

create or replace function public.trigger_sectionx_arbiter_pull()
returns bigint
language plpgsql
security definer
set search_path = public, vault, net
as $$
declare
  token text;
  request_id bigint;
begin
  select decrypted_secret into token
  from vault.decrypted_secrets
  where name = 'sectionx_arbiter_pull_token'
  limit 1;

  if token is null then
    raise exception 'Section X Arbiter automation token is not configured';
  end if;

  select net.http_get(
    url := 'https://sectionxscoreboard.com/api/cron/arbiter-pull',
    headers := jsonb_build_object(
      'x-sectionx-automation-key', token,
      'user-agent', 'SectionX-Supabase-Cron/1.0'
    ),
    timeout_milliseconds := 300000
  ) into request_id;

  return request_id;
end;
$$;

revoke all on function public.trigger_sectionx_arbiter_pull() from public;
-- pg_cron executes as the database owner. Service-role access is useful for controlled diagnostics.
grant execute on function public.trigger_sectionx_arbiter_pull() to service_role;
