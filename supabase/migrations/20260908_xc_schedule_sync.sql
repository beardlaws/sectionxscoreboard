alter table public.cross_country_meets add column if not exists meet_time time;
alter table public.cross_country_meets add column if not exists source_event_key text;
alter table public.cross_country_meets add column if not exists source_payload jsonb;
create unique index if not exists cross_country_meets_source_event_key_uidx on public.cross_country_meets(source_event_key) where source_event_key is not null;
