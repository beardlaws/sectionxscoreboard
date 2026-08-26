alter table public.games add column if not exists contest_type text not null default 'Game';
alter table public.games drop constraint if exists games_contest_type_check;
alter table public.games add constraint games_contest_type_check check (contest_type in ('Game','Scrimmage'));

alter table public.game_import_sources add column if not exists source_status text;
alter table public.game_import_sources add column if not exists source_game_time time without time zone;
alter table public.game_import_sources add column if not exists source_location text;
alter table public.game_import_sources add column if not exists source_contest_type text;
alter table public.game_import_sources add column if not exists source_notes text;

update public.games
set contest_type = 'Scrimmage'
where coalesce(notes,'') ilike '%Arbiter type: Scrimmage%';
