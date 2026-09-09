
create table if not exists public.cross_country_dual_results (
  id uuid primary key default uuid_generate_v4(),
  meet_id uuid not null references public.cross_country_meets(id) on delete cascade,
  sport_id uuid not null references public.sports(id) on delete cascade,
  team_a_id uuid not null references public.teams(id) on delete cascade,
  team_b_id uuid not null references public.teams(id) on delete cascade,
  team_a_score integer,
  team_b_score integer,
  outcome_a text not null check (outcome_a in ('W','L','T')),
  source text not null default 'admin',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (team_a_id <> team_b_id)
);
create unique index if not exists cross_country_dual_results_unique_pair
on public.cross_country_dual_results(meet_id,sport_id,least(team_a_id,team_b_id),greatest(team_a_id,team_b_id));
alter table public.cross_country_dual_results enable row level security;
drop policy if exists "Public read cross country dual results" on public.cross_country_dual_results;
create policy "Public read cross country dual results" on public.cross_country_dual_results for select using (true);

-- Add missing Salmon River girls varsity XC team from Arbiter's published 2026 schedule.
with ins as (
  insert into public.teams(school_id,sport_id,team_name,slug,level,active)
  select 'c1000000-0000-0000-0000-000000000021','b1000000-0000-0000-0000-000000000013',
         'Salmon River Girls Cross Country','salmon-river-girls-cross-country','Varsity',true
  where not exists(select 1 from public.teams where slug='salmon-river-girls-cross-country')
  returning id
)
insert into public.team_seasons(team_id,season_id,active_for_season)
select id,'a1000000-0000-0000-0000-000000000002',true from ins
on conflict do nothing;

insert into public.arbiter_team_links(team_id,arbiter_team_id,arbiter_school_id,source,confidence,observed_count,last_seen_at,updated_at)
select t.id,11067964,20233,'current-season-schedule-observation','stable',1,now(),now()
from public.teams t where t.slug='salmon-river-girls-cross-country'
on conflict (team_id) do update set arbiter_team_id=excluded.arbiter_team_id,arbiter_school_id=excluded.arbiter_school_id,last_seen_at=now(),updated_at=now();

-- Replace the malformed Sept. 8 league "team score" rows with participant rows.
delete from public.cross_country_team_results where meet_id in ('bb8ca078-2743-4f01-b0fb-6b001627662a','f389d2e9-e7b3-4ce6-8977-139a32571120');
insert into public.cross_country_team_results(meet_id,sport_id,team_id,is_section_x)
select m.id,s.id,t.id,true
from (values
 ('bb8ca078-2743-4f01-b0fb-6b001627662a'::uuid,'boys-cross-country',array['canton-boys-cross-country','tupper-lake-boys-cross-country','gouverneur-boys-cross-country','ogdensburg-free-academy-boys-cross-country','salmon-river-boys-cross-country']),
 ('bb8ca078-2743-4f01-b0fb-6b001627662a'::uuid,'girls-cross-country',array['gouverneur-girls-cross-country','canton-girls-cross-country','ogdensburg-free-academy-girls-cross-country','salmon-river-girls-cross-country','tupper-lake-girls-cross-country']),
 ('f389d2e9-e7b3-4ce6-8977-139a32571120'::uuid,'boys-cross-country',array['norwood-norfolk-boys-cross-country','massena-boys-cross-country','brushton-moira-boys-cross-country','potsdam-boys-cross-country','malone-boys-cross-country']),
 ('f389d2e9-e7b3-4ce6-8977-139a32571120'::uuid,'girls-cross-country',array['norwood-norfolk-girls-cross-country','massena-girls-cross-country','malone-girls-cross-country','brushton-moira-girls-cross-country','potsdam-girls-cross-country'])
) v(meet_id,sport_slug,team_slugs)
join public.cross_country_meets m on m.id=v.meet_id
join public.sports s on s.slug=v.sport_slug
join lateral unnest(v.team_slugs) u(slug) on true
join public.teams t on t.slug=u.slug;

-- Seed official Sept. 8 Section X dual results from North Country Sports.
with pairs(meet_id,sport_slug,a,b,sa,sb,outcome,notes) as (values
('bb8ca078-2743-4f01-b0fb-6b001627662a','boys-cross-country','canton-boys-cross-country','tupper-lake-boys-cross-country',21,40,'W',null),
('bb8ca078-2743-4f01-b0fb-6b001627662a','boys-cross-country','canton-boys-cross-country','gouverneur-boys-cross-country',15,48,'W',null),
('bb8ca078-2743-4f01-b0fb-6b001627662a','boys-cross-country','tupper-lake-boys-cross-country','gouverneur-boys-cross-country',24,31,'W',null),
('bb8ca078-2743-4f01-b0fb-6b001627662a','boys-cross-country','canton-boys-cross-country','ogdensburg-free-academy-boys-cross-country',null,null,'W','OFA incomplete'),
('bb8ca078-2743-4f01-b0fb-6b001627662a','boys-cross-country','canton-boys-cross-country','salmon-river-boys-cross-country',null,null,'W','Salmon River incomplete'),
('bb8ca078-2743-4f01-b0fb-6b001627662a','boys-cross-country','tupper-lake-boys-cross-country','ogdensburg-free-academy-boys-cross-country',null,null,'W','OFA incomplete'),
('bb8ca078-2743-4f01-b0fb-6b001627662a','boys-cross-country','tupper-lake-boys-cross-country','salmon-river-boys-cross-country',null,null,'W','Salmon River incomplete'),
('bb8ca078-2743-4f01-b0fb-6b001627662a','boys-cross-country','gouverneur-boys-cross-country','ogdensburg-free-academy-boys-cross-country',null,null,'W','OFA incomplete'),
('bb8ca078-2743-4f01-b0fb-6b001627662a','boys-cross-country','gouverneur-boys-cross-country','salmon-river-boys-cross-country',null,null,'W','Salmon River incomplete'),
('bb8ca078-2743-4f01-b0fb-6b001627662a','boys-cross-country','ogdensburg-free-academy-boys-cross-country','salmon-river-boys-cross-country',null,null,'T','Both incomplete'),

('bb8ca078-2743-4f01-b0fb-6b001627662a','girls-cross-country','gouverneur-girls-cross-country','canton-girls-cross-country',15,50,'W',null),
('bb8ca078-2743-4f01-b0fb-6b001627662a','girls-cross-country','gouverneur-girls-cross-country','ogdensburg-free-academy-girls-cross-country',15,50,'W','OFA incomplete'),
('bb8ca078-2743-4f01-b0fb-6b001627662a','girls-cross-country','gouverneur-girls-cross-country','salmon-river-girls-cross-country',15,50,'W','Salmon River incomplete'),
('bb8ca078-2743-4f01-b0fb-6b001627662a','girls-cross-country','gouverneur-girls-cross-country','tupper-lake-girls-cross-country',15,50,'W','Tupper Lake incomplete'),
('bb8ca078-2743-4f01-b0fb-6b001627662a','girls-cross-country','canton-girls-cross-country','ogdensburg-free-academy-girls-cross-country',null,null,'T','Both incomplete'),
('bb8ca078-2743-4f01-b0fb-6b001627662a','girls-cross-country','canton-girls-cross-country','salmon-river-girls-cross-country',null,null,'T','Both incomplete'),
('bb8ca078-2743-4f01-b0fb-6b001627662a','girls-cross-country','canton-girls-cross-country','tupper-lake-girls-cross-country',null,null,'T','Both incomplete'),
('bb8ca078-2743-4f01-b0fb-6b001627662a','girls-cross-country','ogdensburg-free-academy-girls-cross-country','salmon-river-girls-cross-country',null,null,'T','Both incomplete'),
('bb8ca078-2743-4f01-b0fb-6b001627662a','girls-cross-country','ogdensburg-free-academy-girls-cross-country','tupper-lake-girls-cross-country',null,null,'T','Both incomplete'),
('bb8ca078-2743-4f01-b0fb-6b001627662a','girls-cross-country','salmon-river-girls-cross-country','tupper-lake-girls-cross-country',null,null,'T','Both incomplete'),

('f389d2e9-e7b3-4ce6-8977-139a32571120','boys-cross-country','norwood-norfolk-boys-cross-country','massena-boys-cross-country',27,28,'W',null),
('f389d2e9-e7b3-4ce6-8977-139a32571120','boys-cross-country','norwood-norfolk-boys-cross-country','brushton-moira-boys-cross-country',21,38,'W',null),
('f389d2e9-e7b3-4ce6-8977-139a32571120','boys-cross-country','norwood-norfolk-boys-cross-country','potsdam-boys-cross-country',26,29,'W',null),
('f389d2e9-e7b3-4ce6-8977-139a32571120','boys-cross-country','massena-boys-cross-country','brushton-moira-boys-cross-country',21,38,'W',null),
('f389d2e9-e7b3-4ce6-8977-139a32571120','boys-cross-country','massena-boys-cross-country','potsdam-boys-cross-country',25,30,'W',null),
('f389d2e9-e7b3-4ce6-8977-139a32571120','boys-cross-country','potsdam-boys-cross-country','brushton-moira-boys-cross-country',23,36,'W',null),
('f389d2e9-e7b3-4ce6-8977-139a32571120','boys-cross-country','norwood-norfolk-boys-cross-country','malone-boys-cross-country',null,null,'W','Malone incomplete'),
('f389d2e9-e7b3-4ce6-8977-139a32571120','boys-cross-country','massena-boys-cross-country','malone-boys-cross-country',null,null,'W','Malone incomplete'),
('f389d2e9-e7b3-4ce6-8977-139a32571120','boys-cross-country','brushton-moira-boys-cross-country','malone-boys-cross-country',null,null,'W','Malone incomplete'),
('f389d2e9-e7b3-4ce6-8977-139a32571120','boys-cross-country','potsdam-boys-cross-country','malone-boys-cross-country',null,null,'W','Malone incomplete'),

('f389d2e9-e7b3-4ce6-8977-139a32571120','girls-cross-country','norwood-norfolk-girls-cross-country','massena-girls-cross-country',27,30,'W',null),
('f389d2e9-e7b3-4ce6-8977-139a32571120','girls-cross-country','norwood-norfolk-girls-cross-country','malone-girls-cross-country',40,41,'W',null),
('f389d2e9-e7b3-4ce6-8977-139a32571120','girls-cross-country','massena-girls-cross-country','malone-girls-cross-country',18,43,'W',null),
('f389d2e9-e7b3-4ce6-8977-139a32571120','girls-cross-country','norwood-norfolk-girls-cross-country','brushton-moira-girls-cross-country',null,null,'W','Brushton-Moira incomplete'),
('f389d2e9-e7b3-4ce6-8977-139a32571120','girls-cross-country','norwood-norfolk-girls-cross-country','potsdam-girls-cross-country',null,null,'W','Potsdam incomplete'),
('f389d2e9-e7b3-4ce6-8977-139a32571120','girls-cross-country','massena-girls-cross-country','brushton-moira-girls-cross-country',null,null,'W','Brushton-Moira incomplete'),
('f389d2e9-e7b3-4ce6-8977-139a32571120','girls-cross-country','massena-girls-cross-country','potsdam-girls-cross-country',null,null,'W','Potsdam incomplete'),
('f389d2e9-e7b3-4ce6-8977-139a32571120','girls-cross-country','malone-girls-cross-country','brushton-moira-girls-cross-country',null,null,'W','Brushton-Moira incomplete'),
('f389d2e9-e7b3-4ce6-8977-139a32571120','girls-cross-country','malone-girls-cross-country','potsdam-girls-cross-country',null,null,'W','Potsdam incomplete'),
('f389d2e9-e7b3-4ce6-8977-139a32571120','girls-cross-country','brushton-moira-girls-cross-country','potsdam-girls-cross-country',null,null,'T','Both incomplete')
)
insert into public.cross_country_dual_results(meet_id,sport_id,team_a_id,team_b_id,team_a_score,team_b_score,outcome_a,source,notes)
select p.meet_id::uuid,s.id,a.id,b.id,p.sa,p.sb,p.outcome,'northcountrysports',p.notes
from pairs p
join public.sports s on s.slug=p.sport_slug
join public.teams a on a.slug=p.a
join public.teams b on b.slug=p.b
on conflict do nothing;
