-- Cross Country foundation: meets, team results, individual results, 2026 varsity teams, and first known meet.
-- Additive only. Existing games/scores tables are untouched.

create table if not exists public.cross_country_meets (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  meet_name text not null,
  meet_date date not null,
  location text,
  meet_type text not null default 'Invitational' check (meet_type in ('League','Invitational','Championship','Scrimmage')),
  status text not null default 'Scheduled' check (status in ('Scheduled','Live','Final','Postponed','Canceled')),
  notes text,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cross_country_team_results (
  id uuid primary key default gen_random_uuid(),
  meet_id uuid not null references public.cross_country_meets(id) on delete cascade,
  sport_id uuid not null references public.sports(id),
  team_id uuid references public.teams(id),
  external_opponent_id uuid references public.external_opponents(id),
  team_score integer,
  finish_place integer,
  is_section_x boolean not null default false,
  created_at timestamptz not null default now(),
  constraint xc_team_result_one_team check (
    (team_id is not null and external_opponent_id is null)
    or (team_id is null and external_opponent_id is not null)
  ),
  constraint xc_team_result_unique unique (meet_id, sport_id, team_id, external_opponent_id)
);

create table if not exists public.cross_country_individual_results (
  id uuid primary key default gen_random_uuid(),
  meet_id uuid not null references public.cross_country_meets(id) on delete cascade,
  sport_id uuid not null references public.sports(id),
  athlete_id uuid references public.athletes(id),
  team_id uuid references public.teams(id),
  external_opponent_id uuid references public.external_opponents(id),
  runner_name text,
  finish_place integer,
  finish_time interval,
  scorer boolean,
  displacer boolean,
  created_at timestamptz not null default now()
);

create index if not exists cross_country_meets_date_idx on public.cross_country_meets(meet_date desc);
create index if not exists cross_country_meets_season_idx on public.cross_country_meets(season_id, meet_date desc);
create index if not exists cross_country_team_results_meet_idx on public.cross_country_team_results(meet_id, sport_id, finish_place);
create index if not exists cross_country_team_results_team_idx on public.cross_country_team_results(team_id);
create index if not exists cross_country_individual_results_meet_idx on public.cross_country_individual_results(meet_id, sport_id, finish_place);
create index if not exists cross_country_individual_results_athlete_idx on public.cross_country_individual_results(athlete_id);

alter table public.cross_country_meets enable row level security;
alter table public.cross_country_team_results enable row level security;
alter table public.cross_country_individual_results enable row level security;

drop policy if exists "Public read cross country meets" on public.cross_country_meets;
create policy "Public read cross country meets" on public.cross_country_meets for select to public using (true);

drop policy if exists "Public read cross country team results" on public.cross_country_team_results;
create policy "Public read cross country team results" on public.cross_country_team_results for select to public using (true);

drop policy if exists "Public read cross country individual results" on public.cross_country_individual_results;
create policy "Public read cross country individual results" on public.cross_country_individual_results for select to public using (true);

-- Build known 2026 Section X varsity XC teams from published standings.
with boys_schools(slug) as (
  values
    ('potsdam'),('massena'),('norwood-norfolk'),('tupper-lake'),('canton'),
    ('gouverneur'),('malone'),('brushton-moira'),('ogdensburg-free-academy'),('salmon-river')
)
insert into public.teams (school_id, sport_id, team_name, slug, level, active)
select s.id, sp.id,
       regexp_replace(s.school_name, ' (Central School|Central|School)$', '') || ' Boys Cross Country',
       s.slug || '-boys-cross-country',
       'Varsity', true
from boys_schools b
join public.schools s on s.slug=b.slug
join public.sports sp on sp.slug='boys-cross-country'
on conflict (slug) do update set active=true, sport_id=excluded.sport_id, school_id=excluded.school_id;

with girls_schools(slug) as (
  values
    ('norwood-norfolk'),('massena'),('potsdam'),('brushton-moira'),('malone'),
    ('canton'),('gouverneur'),('ogdensburg-free-academy'),('tupper-lake')
)
insert into public.teams (school_id, sport_id, team_name, slug, level, active)
select s.id, sp.id,
       regexp_replace(s.school_name, ' (Central School|Central|School)$', '') || ' Girls Cross Country',
       s.slug || '-girls-cross-country',
       'Varsity', true
from girls_schools g
join public.schools s on s.slug=g.slug
join public.sports sp on sp.slug='girls-cross-country'
on conflict (slug) do update set active=true, sport_id=excluded.sport_id, school_id=excluded.school_id;

insert into public.team_seasons (team_id, season_id, active_for_season)
select t.id, se.id, true
from public.teams t
join public.sports sp on sp.id=t.sport_id and sp.slug in ('boys-cross-country','girls-cross-country')
join public.seasons se on se.name='Fall 2026'
where t.active=true
and not exists (
  select 1 from public.team_seasons ts where ts.team_id=t.id and ts.season_id=se.id
);

-- Known external teams from the Sept. 5 Saranac Spartan Running Festival.
insert into public.external_opponents (name, slug, state, section, is_section_x)
values
  ('AuSable Valley','ausable-valley','NY','VII',false),
  ('Lake Placid','lake-placid','NY','VII',false),
  ('Saranac Central','saranac-central','NY','VII',false)
on conflict (slug) do update set name=excluded.name, state=excluded.state, section=excluded.section;

-- Seed the first meet if it is not already present.
insert into public.cross_country_meets (season_id, meet_name, meet_date, location, meet_type, status, source)
select se.id, 'Saranac Spartan Running Festival', '2026-09-05', 'Saranac Central', 'Invitational', 'Final', 'published results'
from public.seasons se
where se.name='Fall 2026'
and not exists (
  select 1 from public.cross_country_meets m
  where m.meet_name='Saranac Spartan Running Festival' and m.meet_date='2026-09-05'
);

-- Boys team results.
with meet as (
  select id from public.cross_country_meets where meet_name='Saranac Spartan Running Festival' and meet_date='2026-09-05' limit 1
), sport as (
  select id from public.sports where slug='boys-cross-country'
), rows(name,score,place,is_x) as (
  values
    ('AuSable Valley',65,1,false),
    ('Norwood-Norfolk Central',69,2,true),
    ('Massena Central School',75,3,true),
    ('Lake Placid',79,4,false),
    ('Saranac Central',90,5,false),
    ('Canton Central School',105,6,true)
)
insert into public.cross_country_team_results (meet_id,sport_id,team_id,external_opponent_id,team_score,finish_place,is_section_x)
select meet.id, sport.id,
       t.id,
       eo.id,
       r.score,
       r.place,
       r.is_x
from rows r cross join meet cross join sport
left join public.schools s on s.school_name=r.name
left join public.teams t on t.school_id=s.id and t.sport_id=sport.id and t.level='Varsity'
left join public.external_opponents eo on eo.name=r.name
on conflict do nothing;

-- Girls team results.
with meet as (
  select id from public.cross_country_meets where meet_name='Saranac Spartan Running Festival' and meet_date='2026-09-05' limit 1
), sport as (
  select id from public.sports where slug='girls-cross-country'
), rows(name,score,place,is_x) as (
  values
    ('Saranac Central',33,1,false),
    ('Norwood-Norfolk Central',63,2,true),
    ('Massena Central School',67,3,true),
    ('AuSable Valley',80,4,false),
    ('Canton Central School',104,5,true)
)
insert into public.cross_country_team_results (meet_id,sport_id,team_id,external_opponent_id,team_score,finish_place,is_section_x)
select meet.id, sport.id,
       t.id,
       eo.id,
       r.score,
       r.place,
       r.is_x
from rows r cross join meet cross join sport
left join public.schools s on s.school_name=r.name
left join public.teams t on t.school_id=s.id and t.sport_id=sport.id and t.level='Varsity'
left join public.external_opponents eo on eo.name=r.name
on conflict do nothing;
