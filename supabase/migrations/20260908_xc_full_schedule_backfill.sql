create or replace function public.trigger_sectionx_xc_schedule_backfill(p_start date, p_end date)
returns bigint
language plpgsql
security definer
set search_path to 'public','vault','net'
as $function$
declare
  token text;
  request_id bigint;
begin
  if p_start is null or p_end is null or p_end < p_start then
    raise exception 'Invalid Cross Country sync date range';
  end if;
  if p_end - p_start > 150 then
    raise exception 'Cross Country sync range cannot exceed 150 days';
  end if;

  select decrypted_secret into token
  from vault.decrypted_secrets
  where name='sectionx_arbiter_pull_token'
  limit 1;

  if token is null then
    raise exception 'Section X Arbiter automation token is not configured';
  end if;

  select net.http_get(
    url := 'https://sectionxscoreboard.com/api/cron/cross-country-sync?start=' || to_char(p_start,'YYYY-MM-DD') || '&end=' || to_char(p_end,'YYYY-MM-DD'),
    headers := jsonb_build_object(
      'x-sectionx-automation-key', token,
      'user-agent','SectionX-Supabase-XC-Backfill/1.0'
    ),
    timeout_milliseconds := 300000
  )
  into request_id;

  return request_id;
end;
$function$;

revoke all on function public.trigger_sectionx_xc_schedule_backfill(date,date) from public;
grant execute on function public.trigger_sectionx_xc_schedule_backfill(date,date) to service_role;
