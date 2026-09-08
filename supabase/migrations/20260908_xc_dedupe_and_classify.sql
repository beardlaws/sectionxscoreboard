-- Clean up Arbiter XC event wrappers created from separate boys/girls records,
-- preserve the published Sept. 5 final, and classify invitational/championship meets correctly.

do $$
declare
  grp record;
  keeper uuid;
  duplicate_id uuid;
  canonical_key text;
  published_final uuid;
begin
  -- Merge duplicate Arbiter wrappers that share the same date/time/location.
  for grp in
    select season_id, meet_date, meet_time, location
    from public.cross_country_meets
    where source='arbiter'
    group by season_id, meet_date, meet_time, location
    having count(*) > 1
  loop
    select id into keeper
    from public.cross_country_meets
    where source='arbiter'
      and season_id=grp.season_id
      and meet_date=grp.meet_date
      and meet_time is not distinct from grp.meet_time
      and location is not distinct from grp.location
    order by
      case
        when meet_name ilike '%championship%' then 5
        when meet_name ilike '%interdivision%' then 4
        when meet_name ilike '%invite%' or meet_name ilike '%invitational%' or meet_name ilike '%festival%' then 3
        when meet_name ilike '%league meet%' then 2
        else 1
      end desc,
      created_at asc
    limit 1;

    for duplicate_id in
      select id
      from public.cross_country_meets
      where source='arbiter'
        and season_id=grp.season_id
        and meet_date=grp.meet_date
        and meet_time is not distinct from grp.meet_time
        and location is not distinct from grp.location
        and id<>keeper
    loop
      insert into public.cross_country_team_results
        (meet_id,sport_id,team_id,external_opponent_id,team_score,finish_place,is_section_x,created_at)
      select keeper,r.sport_id,r.team_id,r.external_opponent_id,r.team_score,r.finish_place,r.is_section_x,r.created_at
      from public.cross_country_team_results r
      where r.meet_id=duplicate_id
        and not exists (
          select 1 from public.cross_country_team_results x
          where x.meet_id=keeper
            and x.sport_id=r.sport_id
            and x.team_id is not distinct from r.team_id
            and x.external_opponent_id is not distinct from r.external_opponent_id
        );

      delete from public.cross_country_team_results where meet_id=duplicate_id;

      update public.cross_country_individual_results
      set meet_id=keeper
      where meet_id=duplicate_id;

      delete from public.cross_country_meets where id=duplicate_id;
    end loop;

    canonical_key := 'arbiter-xc:' || trim(both '-' from regexp_replace(
      lower(concat_ws('|',grp.meet_date::text,coalesce(to_char(grp.meet_time,'HH24:MI'),''),coalesce(grp.location,''))),
      '[^a-z0-9]+','-','g'
    ));

    update public.cross_country_meets
    set source_event_key=canonical_key
    where id=keeper;
  end loop;

  -- The Sept. 5 Spartan Festival was manually seeded with verified finals before
  -- the Arbiter backfill. Fold the Arbiter schedule wrapper into that final.
  select id into published_final
  from public.cross_country_meets
  where meet_date='2026-09-05'
    and meet_name='Saranac Spartan Running Festival'
    and status='Final'
  limit 1;

  if published_final is not null then
    for duplicate_id in
      select id
      from public.cross_country_meets
      where meet_date='2026-09-05'
        and id<>published_final
        and source='arbiter'
        and location ilike '%Saranac Central%'
    loop
      insert into public.cross_country_team_results
        (meet_id,sport_id,team_id,external_opponent_id,team_score,finish_place,is_section_x,created_at)
      select published_final,r.sport_id,r.team_id,r.external_opponent_id,r.team_score,r.finish_place,r.is_section_x,r.created_at
      from public.cross_country_team_results r
      where r.meet_id=duplicate_id
        and not exists (
          select 1 from public.cross_country_team_results x
          where x.meet_id=published_final
            and x.sport_id=r.sport_id
            and x.team_id is not distinct from r.team_id
            and x.external_opponent_id is not distinct from r.external_opponent_id
        );

      delete from public.cross_country_team_results where meet_id=duplicate_id;
      update public.cross_country_individual_results set meet_id=published_final where meet_id=duplicate_id;
      delete from public.cross_country_meets where id=duplicate_id;
    end loop;

    update public.cross_country_meets
    set meet_time='09:00',
        location='Saranac Central High School',
        source_event_key='arbiter-xc:2026-09-05-09-00-saranac-central-high-school',
        updated_at=now()
    where id=published_final;
  end if;
end $$;

update public.cross_country_meets
set meet_type = case
  when meet_name ilike '%championship%' then 'Championship'
  when meet_name ilike '%invite%' or meet_name ilike '%invitational%' or meet_name ilike '%festival%'
       or meet_name ilike '%herrmann%' or meet_name ilike '%spartan%' then 'Invitational'
  when meet_name ilike '%scrimmage%' then 'Scrimmage'
  else meet_type
end,
updated_at=now()
where season_id=(select id from public.seasons where name='Fall 2026' limit 1);
