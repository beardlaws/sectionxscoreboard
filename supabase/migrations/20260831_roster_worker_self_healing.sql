-- Self-healing watchdog for Section X Arbiter roster automation.
-- If a roster worker loses its heartbeat for 10 minutes, retire the stale run
-- and trigger a clean idempotent retry. Normal healthy runs are untouched.

create or replace function public.recover_sectionx_stale_roster_run()
returns bigint
language plpgsql
security definer
set search_path = public, vault, net
as $$
declare
  stale_id uuid;
  stale_heartbeat timestamptz;
  request_id bigint;
begin
  select r.id,
         nullif(r.summary #>> '{progress,heartbeatAt}', '')::timestamptz
    into stale_id, stale_heartbeat
  from public.arbiter_roster_automation_runs r
  where r.status = 'running'
    and r.finished_at is null
  order by r.started_at desc
  limit 1;

  if stale_id is null then
    return null;
  end if;

  -- A run is allowed plenty of time between heartbeat writes. Only intervene
  -- when the persisted heartbeat is genuinely stale (or missing on an old run).
  if coalesce(stale_heartbeat, now() - interval '1 day') > now() - interval '10 minutes' then
    return null;
  end if;

  update public.arbiter_roster_automation_runs
  set status = 'failed',
      finished_at = now(),
      summary = jsonb_set(
        jsonb_set(
          coalesce(summary, '{}'::jsonb),
          '{progress,phase}',
          to_jsonb('recovered-stale'::text),
          true
        ),
        '{error}',
        to_jsonb('Roster worker heartbeat went stale; watchdog retired this run and launched a clean retry.'::text),
        true
      )
  where id = stale_id
    and status = 'running'
    and finished_at is null;

  if not found then
    return null;
  end if;

  select public.trigger_sectionx_arbiter_rosters() into request_id;
  return request_id;
end;
$$;

revoke all on function public.recover_sectionx_stale_roster_run() from public;
revoke all on function public.recover_sectionx_stale_roster_run() from anon;
revoke all on function public.recover_sectionx_stale_roster_run() from authenticated;

-- Keep exactly one watchdog schedule.
do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname = 'sectionx-arbiter-roster-watchdog'
  limit 1;

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;

  perform cron.schedule(
    'sectionx-arbiter-roster-watchdog',
    '*/10 * * * *',
    'select public.recover_sectionx_stale_roster_run();'
  );
end $$;
