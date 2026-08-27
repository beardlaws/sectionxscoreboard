-- Section X Scoreboard community contributor + photo tagging foundation
-- Additive only. No existing game, roster, athlete, or photo data is removed.

create table if not exists public.contributor_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null,
  public_credit_name text,
  email text,
  school_id uuid references public.schools(id) on delete set null,
  bio text,
  status text not null default 'pending' check (status in ('pending','approved','suspended','rejected')),
  roles text[] not null default '{}'::text[],
  trust_level text not null default 'new' check (trust_level in ('new','trusted','veteran')),
  can_submit_photos boolean not null default true,
  can_tag_photos boolean not null default true,
  can_submit_scores boolean not null default true,
  can_live_score boolean not null default false,
  can_publish_photos boolean not null default false,
  submissions_count integer not null default 0,
  verified_count integer not null default 0,
  rejected_count integer not null default 0,
  approved_at timestamptz,
  approved_by text,
  last_active_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists contributor_profiles_status_idx on public.contributor_profiles(status);
create index if not exists contributor_profiles_school_idx on public.contributor_profiles(school_id);

create table if not exists public.contributor_game_assignments (
  id uuid primary key default gen_random_uuid(),
  contributor_id uuid not null references public.contributor_profiles(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  assignment_role text not null default 'coverage' check (assignment_role in ('coverage','score-reporter','photographer')),
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  unique(contributor_id,game_id,assignment_role)
);
create index if not exists contributor_game_assignments_game_idx on public.contributor_game_assignments(game_id);
create index if not exists contributor_game_assignments_contributor_idx on public.contributor_game_assignments(contributor_id);

create table if not exists public.contributor_score_updates (
  id uuid primary key default gen_random_uuid(),
  contributor_id uuid not null references public.contributor_profiles(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  home_score integer,
  away_score integer,
  game_status text,
  note text,
  update_type text not null default 'score' check (update_type in ('score','final','status','correction')),
  publication_status text not null default 'pending' check (publication_status in ('pending','published','rejected','superseded')),
  before_state jsonb,
  after_state jsonb,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists contributor_score_updates_game_idx on public.contributor_score_updates(game_id,created_at desc);
create index if not exists contributor_score_updates_contributor_idx on public.contributor_score_updates(contributor_id,created_at desc);
create index if not exists contributor_score_updates_status_idx on public.contributor_score_updates(publication_status);

create table if not exists public.contributor_activity (
  id uuid primary key default gen_random_uuid(),
  contributor_id uuid references public.contributor_profiles(id) on delete set null,
  event_type text not null,
  entity_type text,
  entity_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);
create index if not exists contributor_activity_contributor_idx on public.contributor_activity(contributor_id,created_at desc);

create table if not exists public.photo_tag_suggestions (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.photos(id) on delete cascade,
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  contributor_id uuid references public.contributor_profiles(id) on delete set null,
  source_type text not null default 'public' check (source_type in ('public','contributor','admin')),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text,
  unique(photo_id,athlete_id)
);
create index if not exists photo_tag_suggestions_photo_idx on public.photo_tag_suggestions(photo_id,status);
create index if not exists photo_tag_suggestions_athlete_idx on public.photo_tag_suggestions(athlete_id);

alter table public.photos add column if not exists contributor_id uuid references public.contributor_profiles(id) on delete set null;
alter table public.photos add column if not exists contributor_user_id uuid references auth.users(id) on delete set null;
alter table public.photos add column if not exists tag_reviewed boolean not null default false;

alter table public.photo_athletes add column if not exists source_type text default 'admin';
alter table public.photo_athletes add column if not exists contributor_id uuid references public.contributor_profiles(id) on delete set null;
alter table public.photo_athletes add column if not exists approved_at timestamptz default now();

alter table public.contributor_profiles enable row level security;
alter table public.contributor_game_assignments enable row level security;
alter table public.contributor_score_updates enable row level security;
alter table public.contributor_activity enable row level security;
alter table public.photo_tag_suggestions enable row level security;

-- Contributor profile: self-read and one-time pending application only.
drop policy if exists "Contributor read own profile" on public.contributor_profiles;
create policy "Contributor read own profile" on public.contributor_profiles for select to authenticated using (user_id = auth.uid());

drop policy if exists "Contributor apply" on public.contributor_profiles;
create policy "Contributor apply" on public.contributor_profiles for insert to authenticated with check (
  user_id = auth.uid()
  and status = 'pending'
  and can_live_score = false
  and can_publish_photos = false
  and trust_level = 'new'
);

-- Contributor assignment/activity history: read only for the owner. Writes happen server-side.
drop policy if exists "Contributor read assignments" on public.contributor_game_assignments;
create policy "Contributor read assignments" on public.contributor_game_assignments for select to authenticated using (
  exists(select 1 from public.contributor_profiles cp where cp.id=contributor_id and cp.user_id=auth.uid())
);

drop policy if exists "Contributor read score history" on public.contributor_score_updates;
create policy "Contributor read score history" on public.contributor_score_updates for select to authenticated using (
  exists(select 1 from public.contributor_profiles cp where cp.id=contributor_id and cp.user_id=auth.uid())
);

drop policy if exists "Contributor read own activity" on public.contributor_activity;
create policy "Contributor read own activity" on public.contributor_activity for select to authenticated using (
  exists(select 1 from public.contributor_profiles cp where cp.id=contributor_id and cp.user_id=auth.uid())
);

-- Tighten photo inserts now that a contributor identity can be attached.
-- Anonymous visitors can only submit anonymous/public photos.
drop policy if exists "Public submit photos" on public.photos;
drop policy if exists "Anonymous submit photos" on public.photos;
create policy "Anonymous submit photos" on public.photos for insert to anon with check (
  contributor_id is null and contributor_user_id is null and approved=false and featured=false
);

-- Authenticated people may still submit normal photos, but if they attach contributor identity it must be their own approved profile.
drop policy if exists "Authenticated submit photos" on public.photos;
create policy "Authenticated submit photos" on public.photos for insert to authenticated with check (
  approved=false and featured=false and (
    (contributor_id is null and contributor_user_id is null)
    or (
      contributor_user_id=auth.uid()
      and exists(
        select 1 from public.contributor_profiles cp
        where cp.id=contributor_id and cp.user_id=auth.uid() and cp.status='approved' and cp.can_submit_photos=true
      )
    )
  )
);

-- Anonymous tag suggestions are limited to rostered athletes from the selected game.
drop policy if exists "Public suggest athlete tags" on public.photo_tag_suggestions;
create policy "Public suggest athlete tags" on public.photo_tag_suggestions for insert to anon with check (
  contributor_id is null and source_type='public' and status='pending' and exists (
    select 1
    from public.photos p
    join public.games g on g.id=p.game_id
    join public.roster_entries re on re.athlete_id=photo_tag_suggestions.athlete_id
    where p.id=photo_tag_suggestions.photo_id
      and p.approved=false
      and re.active=true
      and (re.team_id=g.home_team_id or re.team_id=g.away_team_id)
      and (g.season_id is null or re.season_id=g.season_id)
  )
);

-- Approved contributors may suggest tags only as themselves and only if tag permission is enabled.
drop policy if exists "Contributor suggest athlete tags" on public.photo_tag_suggestions;
create policy "Contributor suggest athlete tags" on public.photo_tag_suggestions for insert to authenticated with check (
  status='pending' and source_type='contributor' and exists(
    select 1 from public.contributor_profiles cp where cp.id=contributor_id and cp.user_id=auth.uid() and cp.status='approved' and cp.can_tag_photos=true
  ) and exists (
    select 1
    from public.photos p
    join public.games g on g.id=p.game_id
    join public.roster_entries re on re.athlete_id=photo_tag_suggestions.athlete_id
    where p.id=photo_tag_suggestions.photo_id
      and p.approved=false
      and re.active=true
      and (re.team_id=g.home_team_id or re.team_id=g.away_team_id)
      and (g.season_id is null or re.season_id=g.season_id)
  )
);
