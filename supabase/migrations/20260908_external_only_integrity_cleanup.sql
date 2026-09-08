-- Production integrity cleanup:
-- 1) remove an accidentally-created external-vs-external source event;
-- 2) consolidate Beekmantown aliases used by game records onto Arbiter's current school name.

delete from public.arbiter_game_links
where game_id='1152a60c-33b5-43fa-ab89-7df006cb1b59'
   or arbiter_game_id=103526347;

delete from public.games
where id='1152a60c-33b5-43fa-ab89-7df006cb1b59'
  and home_team_id is null
  and away_team_id is null
  and home_score is null
  and away_score is null;

update public.games
set external_home_opponent_id='6211f185-7a8b-4a5b-a2e1-7d14aac5b6fb',
    updated_at=now()
where external_home_opponent_id in (
  'db6f8eff-f10e-4909-8dc1-70f7147b708b',
  '0b3ca52c-3ea2-498f-a8f7-54d4fe62cd9a'
);

update public.games
set external_away_opponent_id='6211f185-7a8b-4a5b-a2e1-7d14aac5b6fb',
    updated_at=now()
where external_away_opponent_id in (
  'db6f8eff-f10e-4909-8dc1-70f7147b708b',
  '0b3ca52c-3ea2-498f-a8f7-54d4fe62cd9a'
);
