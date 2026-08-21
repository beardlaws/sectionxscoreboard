-- Game Center v1 foundation
-- Additive-only schema for scoring detail, sport-aware stats, and photo/athlete relationships.

create table if not exists public.game_period_scores (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  team_side text not null check (team_side in ('home','away')),
  period_number integer not null check (period_number > 0),
  period_label text,
  score integer,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (game_id, team_side, period_number)
);

create index if not exists game_period_scores_game_id_idx
  on public.game_period_scores(game_id);

create table if not exists public.stat_definitions (
  id uuid primary key default gen_random_uuid(),
  sport_id uuid references public.sports(id) on delete cascade,
  stat_key text not null,
  label text not null,
  category text,
  value_type text not null default 'number' check (value_type in ('number','text','time','percentage')),
  scope text not null default 'both' check (scope in ('team','athlete','both')),
  unit text,
  lower_is_better boolean default false,
  sort_order integer default 0,
  active boolean default true,
  created_at timestamptz default now(),
  unique (sport_id, stat_key)
);

create index if not exists stat_definitions_sport_id_idx
  on public.stat_definitions(sport_id, sort_order);

create table if not exists public.game_team_stats (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  team_side text not null check (team_side in ('home','away')),
  stat_definition_id uuid not null references public.stat_definitions(id) on delete cascade,
  value_numeric numeric,
  value_text text,
  source_type text default 'admin',
  source_name text,
  verified boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (game_id, team_side, stat_definition_id)
);

create index if not exists game_team_stats_game_id_idx
  on public.game_team_stats(game_id);

create table if not exists public.game_athlete_stats (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  team_id uuid references public.teams(id) on delete set null,
  stat_definition_id uuid not null references public.stat_definitions(id) on delete cascade,
  value_numeric numeric,
  value_text text,
  source_type text default 'admin',
  source_name text,
  verified boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (game_id, athlete_id, stat_definition_id)
);

create index if not exists game_athlete_stats_game_id_idx
  on public.game_athlete_stats(game_id);
create index if not exists game_athlete_stats_athlete_id_idx
  on public.game_athlete_stats(athlete_id);

create table if not exists public.photo_athletes (
  photo_id uuid not null references public.photos(id) on delete cascade,
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (photo_id, athlete_id)
);

create index if not exists photo_athletes_athlete_id_idx
  on public.photo_athletes(athlete_id);

alter table public.game_period_scores enable row level security;
alter table public.stat_definitions enable row level security;
alter table public.game_team_stats enable row level security;
alter table public.game_athlete_stats enable row level security;
alter table public.photo_athletes enable row level security;

-- Public data is readable. Writes remain service-role/admin only unless explicit policies are added later.
drop policy if exists "Public read game period scores" on public.game_period_scores;
create policy "Public read game period scores"
  on public.game_period_scores for select
  using (true);

drop policy if exists "Public read stat definitions" on public.stat_definitions;
create policy "Public read stat definitions"
  on public.stat_definitions for select
  using (active = true);

drop policy if exists "Public read game team stats" on public.game_team_stats;
create policy "Public read game team stats"
  on public.game_team_stats for select
  using (true);

drop policy if exists "Public read game athlete stats" on public.game_athlete_stats;
create policy "Public read game athlete stats"
  on public.game_athlete_stats for select
  using (true);

drop policy if exists "Public read photo athlete tags" on public.photo_athletes;
create policy "Public read photo athlete tags"
  on public.photo_athletes for select
  using (
    exists (
      select 1 from public.photos p
      where p.id = photo_id and p.approved = true
    )
  );
