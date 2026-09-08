create table if not exists public.arbiter_shared_event_ids (
  arbiter_game_id bigint primary key,
  reason text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.arbiter_shared_event_ids enable row level security;

insert into public.arbiter_shared_event_ids (arbiter_game_id,reason,active)
values
  (102066363,'Arbiter reuses this swimming event ID across multiple opponents.',true),
  (102980028,'Arbiter reuses this swimming event ID across multiple opponents.',true),
  (103703698,'Arbiter reuses this volleyball event ID across multiple tournament opponents.',true),
  (103525329,'Arbiter reuses this volleyball event ID across multiple tournament opponents.',true),
  (103522120,'Arbiter participant changed under the same volleyball event ID.',true),
  (103526347,'Arbiter participant set changed under the same tournament event ID.',true),
  (101018178,'Arbiter tournament participant changed under the same event ID.',true)
on conflict (arbiter_game_id) do update
set reason=excluded.reason,active=true,updated_at=now();

-- Restore rows that were temporarily changed during the integrity sweep before
-- shared-event behavior was identified. These are the previously published pairings.
update public.games
set home_team_id='491199b9-c9f6-4d5e-9974-c483c690b445',
    away_team_id='8f757cce-fe4b-4507-a80c-b5bb035c4a5c',
    external_home_opponent_id=null,
    external_away_opponent_id=null,
    updated_at=now()
where id='c94d7d02-a5fb-4733-8e9e-12660cbf9f32'
  and home_score is null and away_score is null;

update public.games
set home_team_id='327149e0-63ed-4847-b724-2c7540939a87',
    away_team_id='8ac6a341-3bd5-4bbc-8dce-c2fb3b8b5d47',
    external_home_opponent_id=null,
    external_away_opponent_id=null,
    updated_at=now()
where id='6491e9cc-9be2-4544-ae4e-e4014b6becee'
  and home_score is null and away_score is null;

update public.games
set home_team_id='71618a43-6e27-488c-b66f-5e622e3767ec',
    away_team_id='330240c2-5e2d-4fad-afb8-0ae628df2b0f',
    external_home_opponent_id=null,
    external_away_opponent_id=null,
    updated_at=now()
where id='8eceeea5-dbf1-4563-af23-25a694ed174c'
  and home_score is null and away_score is null;

update public.games
set home_team_id='8f757cce-fe4b-4507-a80c-b5bb035c4a5c',
    away_team_id='491199b9-c9f6-4d5e-9974-c483c690b445',
    external_home_opponent_id=null,
    external_away_opponent_id=null,
    updated_at=now()
where id='1f1b96ee-a1e2-4781-bb2c-66966c5dcf50'
  and home_score is null and away_score is null;
