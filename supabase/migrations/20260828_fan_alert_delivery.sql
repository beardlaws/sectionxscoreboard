-- Section X fan alert delivery + preference management foundation.
-- Non-destructive. Existing follows remain intact.

alter table public.fan_follow_preferences
  add column if not exists manage_token uuid;

update public.fan_follow_preferences
set manage_token = gen_random_uuid()
where manage_token is null;

alter table public.fan_follow_preferences
  alter column manage_token set default gen_random_uuid();

alter table public.fan_follow_preferences
  alter column manage_token set not null;

create unique index if not exists fan_follow_manage_token_unique
  on public.fan_follow_preferences(manage_token);

create table if not exists public.fan_notification_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('final','live','schedule-change','photo')),
  game_id uuid references public.games(id) on delete cascade,
  photo_id uuid references public.photos(id) on delete cascade,
  dedupe_key text not null unique,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','sent','skipped','error')),
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text
);

create index if not exists fan_notification_events_pending_idx
  on public.fan_notification_events(status, created_at)
  where status in ('pending','error');

create table if not exists public.fan_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.fan_notification_events(id) on delete cascade,
  follow_id uuid not null references public.fan_follow_preferences(id) on delete cascade,
  email text not null,
  status text not null default 'pending' check (status in ('pending','sent','skipped','error')),
  provider text,
  provider_id text,
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique(event_id, follow_id)
);

create index if not exists fan_notification_deliveries_event_idx
  on public.fan_notification_deliveries(event_id, status);

alter table public.fan_notification_events enable row level security;
alter table public.fan_notification_deliveries enable row level security;
revoke all on public.fan_notification_events from anon, authenticated;
revoke all on public.fan_notification_deliveries from anon, authenticated;
grant all on public.fan_notification_events to service_role;
grant all on public.fan_notification_deliveries to service_role;

create or replace function public.sectionx_enqueue_game_fan_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_status text := lower(coalesce(old.status, ''));
  new_status text := lower(coalesce(new.status, ''));
  schedule_key text;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if new_status in ('live','in progress') and old_status not in ('live','in progress') then
    insert into public.fan_notification_events(event_type, game_id, dedupe_key, payload)
    values ('live', new.id, 'live:' || new.id::text,
      jsonb_build_object('status', new.status, 'home_score', new.home_score, 'away_score', new.away_score))
    on conflict (dedupe_key) do nothing;
  end if;

  if new_status = 'final' and old_status <> 'final' then
    insert into public.fan_notification_events(event_type, game_id, dedupe_key, payload)
    values ('final', new.id, 'final:' || new.id::text,
      jsonb_build_object('home_score', new.home_score, 'away_score', new.away_score))
    on conflict (dedupe_key) do nothing;
  end if;

  if new.game_date is distinct from old.game_date
     or new.game_time is distinct from old.game_time
     or new.location is distinct from old.location
     or (new_status in ('postponed','canceled','cancelled') and new_status <> old_status)
  then
    schedule_key := 'schedule:' || new.id::text || ':' || md5(
      coalesce(new.game_date::text,'') || '|' || coalesce(new.game_time::text,'') || '|' ||
      coalesce(new.location,'') || '|' || coalesce(new.status,'')
    );
    insert into public.fan_notification_events(event_type, game_id, dedupe_key, payload)
    values ('schedule-change', new.id, schedule_key,
      jsonb_build_object('game_date', new.game_date, 'game_time', new.game_time, 'location', new.location, 'status', new.status))
    on conflict (dedupe_key) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists sectionx_game_fan_events on public.games;
create trigger sectionx_game_fan_events
after update on public.games
for each row execute function public.sectionx_enqueue_game_fan_events();

create or replace function public.sectionx_enqueue_photo_fan_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.approved = true and (tg_op = 'INSERT' or coalesce(old.approved, false) = false) then
    insert into public.fan_notification_events(event_type, game_id, photo_id, dedupe_key, payload)
    values ('photo', new.game_id, new.id, 'photo:' || new.id::text,
      jsonb_build_object('caption', new.caption))
    on conflict (dedupe_key) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists sectionx_photo_fan_events on public.photos;
create trigger sectionx_photo_fan_events
after insert or update of approved on public.photos
for each row execute function public.sectionx_enqueue_photo_fan_event();

create or replace function public.trigger_sectionx_fan_alerts()
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
    raise exception 'Section X automation token is not configured';
  end if;

  select net.http_get(
    url := 'https://sectionxscoreboard.com/api/cron/fan-alerts',
    headers := jsonb_build_object(
      'x-sectionx-automation-key', token,
      'user-agent', 'SectionX-Supabase-Fan-Alerts/1.0'
    ),
    timeout_milliseconds := 120000
  ) into request_id;

  return request_id;
end;
$$;

revoke all on function public.trigger_sectionx_fan_alerts() from public;
grant execute on function public.trigger_sectionx_fan_alerts() to service_role;

-- Safe scheduler install. Re-running this migration won't create duplicate jobs.
do $outer$
declare
  existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname = 'sectionx-fan-alert-dispatch' limit 1;
  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
  perform cron.schedule('sectionx-fan-alert-dispatch', '*/5 * * * *', $cron$select public.trigger_sectionx_fan_alerts();$cron$);
exception when undefined_table then
  null;
end
$outer$;
