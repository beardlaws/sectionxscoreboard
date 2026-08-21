-- Seed a small, high-value set of sport-aware definitions. Additional definitions can be added without schema changes.

insert into public.stat_definitions (sport_id, stat_key, label, category, value_type, scope, sort_order)
select id, 'points', 'PTS', 'Scoring', 'number', 'athlete', 10 from public.sports where lower(sport_name) like '%basketball%'
on conflict (sport_id, stat_key) do nothing;
insert into public.stat_definitions (sport_id, stat_key, label, category, value_type, scope, sort_order)
select id, 'rebounds', 'REB', 'General', 'number', 'athlete', 20 from public.sports where lower(sport_name) like '%basketball%'
on conflict (sport_id, stat_key) do nothing;
insert into public.stat_definitions (sport_id, stat_key, label, category, value_type, scope, sort_order)
select id, 'assists', 'AST', 'General', 'number', 'athlete', 30 from public.sports where lower(sport_name) like '%basketball%'
on conflict (sport_id, stat_key) do nothing;

insert into public.stat_definitions (sport_id, stat_key, label, category, value_type, scope, sort_order)
select id, 'goals', 'G', 'Scoring', 'number', 'athlete', 10 from public.sports where lower(sport_name) like '%soccer%' or lower(sport_name) like '%hockey%' or lower(sport_name) like '%lacrosse%'
on conflict (sport_id, stat_key) do nothing;
insert into public.stat_definitions (sport_id, stat_key, label, category, value_type, scope, sort_order)
select id, 'assists', 'A', 'Scoring', 'number', 'athlete', 20 from public.sports where lower(sport_name) like '%soccer%' or lower(sport_name) like '%hockey%' or lower(sport_name) like '%lacrosse%'
on conflict (sport_id, stat_key) do nothing;
insert into public.stat_definitions (sport_id, stat_key, label, category, value_type, scope, sort_order)
select id, 'saves', 'SV', 'Goalkeeping', 'number', 'athlete', 30 from public.sports where lower(sport_name) like '%soccer%' or lower(sport_name) like '%hockey%' or lower(sport_name) like '%lacrosse%'
on conflict (sport_id, stat_key) do nothing;

insert into public.stat_definitions (sport_id, stat_key, label, category, value_type, scope, sort_order)
select id, 'passing_yards', 'PASS YDS', 'Passing', 'number', 'athlete', 10 from public.sports where lower(sport_name) like '%football%'
on conflict (sport_id, stat_key) do nothing;
insert into public.stat_definitions (sport_id, stat_key, label, category, value_type, scope, sort_order)
select id, 'rushing_yards', 'RUSH YDS', 'Rushing', 'number', 'athlete', 20 from public.sports where lower(sport_name) like '%football%'
on conflict (sport_id, stat_key) do nothing;
insert into public.stat_definitions (sport_id, stat_key, label, category, value_type, scope, sort_order)
select id, 'receiving_yards', 'REC YDS', 'Receiving', 'number', 'athlete', 30 from public.sports where lower(sport_name) like '%football%'
on conflict (sport_id, stat_key) do nothing;
insert into public.stat_definitions (sport_id, stat_key, label, category, value_type, scope, sort_order)
select id, 'tackles', 'TACKLES', 'Defense', 'number', 'athlete', 40 from public.sports where lower(sport_name) like '%football%'
on conflict (sport_id, stat_key) do nothing;

insert into public.stat_definitions (sport_id, stat_key, label, category, value_type, scope, sort_order)
select id, 'hits', 'H', 'Batting', 'number', 'athlete', 10 from public.sports where lower(sport_name) like '%baseball%' or lower(sport_name) like '%softball%'
on conflict (sport_id, stat_key) do nothing;
insert into public.stat_definitions (sport_id, stat_key, label, category, value_type, scope, sort_order)
select id, 'rbi', 'RBI', 'Batting', 'number', 'athlete', 20 from public.sports where lower(sport_name) like '%baseball%' or lower(sport_name) like '%softball%'
on conflict (sport_id, stat_key) do nothing;
insert into public.stat_definitions (sport_id, stat_key, label, category, value_type, scope, sort_order)
select id, 'home_runs', 'HR', 'Batting', 'number', 'athlete', 30 from public.sports where lower(sport_name) like '%baseball%' or lower(sport_name) like '%softball%'
on conflict (sport_id, stat_key) do nothing;
insert into public.stat_definitions (sport_id, stat_key, label, category, value_type, scope, sort_order)
select id, 'strikeouts', 'K', 'Pitching', 'number', 'athlete', 40 from public.sports where lower(sport_name) like '%baseball%' or lower(sport_name) like '%softball%'
on conflict (sport_id, stat_key) do nothing;
