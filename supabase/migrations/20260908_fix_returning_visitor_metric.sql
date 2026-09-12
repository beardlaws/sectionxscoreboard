-- Fix Audience Quality returning visitor classification.
-- Returning means a visitor active in the last 7 days who has more than one session
-- during that 7-day window. This makes the metric useful immediately after launch.

create or replace function public.site_traffic_dashboard()
returns jsonb
language sql
set search_path to 'public'
as $function$
with human_raw as (
  select * from public.site_traffic_events where is_bot = false and is_admin = false
),
human as (
  select h.*, case when split_part(h.path, '?', 1) = '' then '/' else split_part(h.path, '?', 1) end as canonical_path
  from human_raw h
),
periods as (
  select jsonb_build_object(
    'last5m', (select count(distinct visitor_id) from human where occurred_at >= now() - interval '5 minutes'),
    'todayPageviews', (select count(*) from human where occurred_at >= date_trunc('day', now() at time zone 'America/New_York') at time zone 'America/New_York'),
    'todayVisitors', (select count(distinct visitor_id) from human where occurred_at >= date_trunc('day', now() at time zone 'America/New_York') at time zone 'America/New_York'),
    'todaySessions', (select count(distinct session_id) from human where occurred_at >= date_trunc('day', now() at time zone 'America/New_York') at time zone 'America/New_York'),
    'yesterdayPageviews', (select count(*) from human where occurred_at >= (date_trunc('day', now() at time zone 'America/New_York') - interval '1 day') at time zone 'America/New_York' and occurred_at < date_trunc('day', now() at time zone 'America/New_York') at time zone 'America/New_York'),
    'weekPageviews', (select count(*) from human where occurred_at >= now() - interval '7 days'),
    'weekVisitors', (select count(distinct visitor_id) from human where occurred_at >= now() - interval '7 days'),
    'weekSessions', (select count(distinct session_id) from human where occurred_at >= now() - interval '7 days'),
    'monthPageviews', (select count(*) from human where occurred_at >= now() - interval '30 days'),
    'monthVisitors', (select count(distinct visitor_id) from human where occurred_at >= now() - interval '30 days'),
    'allPageviews', (select count(*) from human),
    'allVisitors', (select count(distinct visitor_id) from human)
  ) j
),
hourly as (
  select coalesce(jsonb_agg(jsonb_build_object('hour', h, 'pageviews', coalesce(c,0)) order by h), '[]'::jsonb) j
  from (
    select h, count(e.id)::int c
    from generate_series(date_trunc('hour', now()) - interval '23 hours', date_trunc('hour', now()), interval '1 hour') h
    left join human e on e.occurred_at >= h and e.occurred_at < h + interval '1 hour'
    group by h
  ) x
),
daily as (
  select coalesce(jsonb_agg(jsonb_build_object('day', d, 'pageviews', coalesce(c,0), 'visitors', coalesce(v,0)) order by d), '[]'::jsonb) j
  from (
    select d, count(e.id)::int c, count(distinct e.visitor_id)::int v
    from generate_series((current_date - 13)::timestamp, current_date::timestamp, interval '1 day') d
    left join human e on (e.occurred_at at time zone 'America/New_York') >= d
      and (e.occurred_at at time zone 'America/New_York') < d + interval '1 day'
    group by d
  ) x
),
top_pages as (
  select coalesce(jsonb_agg(to_jsonb(x) order by pageviews desc), '[]'::jsonb) j
  from (
    select canonical_path as path, max(page_title) as title, count(*)::int pageviews, count(distinct visitor_id)::int visitors
    from human
    where occurred_at >= now() - interval '7 days'
    group by canonical_path
    order by count(*) desc
    limit 15
  ) x
),
referrers as (
  select coalesce(jsonb_agg(to_jsonb(x) order by visits desc), '[]'::jsonb) j
  from (
    select case
      when referrer_host is null then 'Direct / Unknown'
      when referrer_host in ('l.instagram.com','instagram.com') then 'Instagram'
      when referrer_host in ('l.facebook.com','lm.facebook.com','facebook.com','m.facebook.com') then 'Facebook'
      when referrer_host like '%google.%' then 'Google'
      when referrer_host = 'northcountrynow.com' then 'North Country Now'
      else referrer_host
    end as source,
    count(*)::int visits,
    count(distinct visitor_id)::int visitors
    from human
    where occurred_at >= now() - interval '7 days'
    group by 1
    order by count(*) desc
    limit 12
  ) x
),
content as (
  select coalesce(jsonb_agg(to_jsonb(x) order by pageviews desc), '[]'::jsonb) j
  from (
    select case
      when canonical_path = '/' then 'Home'
      when canonical_path like '/scores%' then 'Scores'
      when canonical_path like '/game-center/%' or canonical_path like '/games/%' or canonical_path like '/game/%' then 'Games'
      when canonical_path like '/athletes/%' then 'Athletes'
      when canonical_path like '/schools/%' then 'Schools'
      when canonical_path like '/sports/%' then 'Sports'
      when canonical_path like '/spotlight/%' then 'Spotlight'
      when canonical_path like '/standings%' then 'Standings'
      when canonical_path like '/photos%' then 'Photos'
      else 'Other'
    end as content_type,
    count(*)::int pageviews
    from human
    where occurred_at >= now() - interval '7 days'
    group by 1
  ) x
),
audience_stats as (
  select jsonb_build_object(
    'newVisitors', count(*) filter (where week_sessions = 1),
    'returningVisitors', count(*) filter (where week_sessions > 1)
  ) j
  from (
    select visitor_id, count(distinct session_id) as week_sessions
    from human
    where occurred_at >= now() - interval '7 days'
    group by visitor_id
  ) x
)
select jsonb_build_object(
  'summary', periods.j,
  'hourly', hourly.j,
  'daily', daily.j,
  'topPages', top_pages.j,
  'referrers', referrers.j,
  'content', content.j,
  'audience', audience_stats.j
)
from periods,hourly,daily,top_pages,referrers,content,audience_stats;
$function$;
