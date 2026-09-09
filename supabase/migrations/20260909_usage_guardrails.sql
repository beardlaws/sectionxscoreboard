-- Usage guardrails: roster recovery should never become a retry storm.
create or replace function public.recover_sectionx_stale_roster_run()
returns bigint
language plpgsql
security definer
set search_path = public, vault, net
as $$
declare
  stale_id uuid;
  stale_heartbeat timestamptz;
  recent_recovery timestamptz;
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

  if stale_id is null then return null; end if;

  -- Allow slow roster runs more breathing room before declaring them stale.
  if coalesce(stale_heartbeat, now() - interval '1 day') > now() - interval '20 minutes' then
    return null;
  end if;

  -- Never launch repeated recovery runs in a tight loop.
  select max(finished_at) into recent_recovery
  from public.arbiter_roster_automation_runs
  where summary->>'error' like 'Roster worker heartbeat went stale%';

  if recent_recovery is not null and recent_recovery > now() - interval '2 hours' then
    return null;
  end if;

  update public.arbiter_roster_automation_runs
  set status = 'failed',
      finished_at = now(),
      summary = jsonb_set(
        jsonb_set(coalesce(summary,'{}'::jsonb),'{progress,phase}',to_jsonb('recovered-stale'::text),true),
        '{error}',to_jsonb('Roster worker heartbeat went stale; watchdog retired this run and launched one guarded retry.'::text),true)
  where id = stale_id and status='running' and finished_at is null;

  if not found then return null; end if;

  select public.trigger_sectionx_arbiter_rosters() into request_id;
  return request_id;
end;
$$;

do $$
declare existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname='sectionx-arbiter-roster-watchdog' limit 1;
  if existing_job is not null then perform cron.unschedule(existing_job); end if;
  perform cron.schedule('sectionx-arbiter-roster-watchdog','*/30 * * * *','select public.recover_sectionx_stale_roster_run();');
end $$;