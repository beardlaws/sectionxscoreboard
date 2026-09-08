alter table public.games add column if not exists schedule_override boolean not null default false;
alter table public.games add column if not exists schedule_override_note text;
alter table public.games add column if not exists schedule_override_updated_at timestamptz;
