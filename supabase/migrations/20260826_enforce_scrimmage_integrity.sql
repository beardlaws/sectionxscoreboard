create or replace function public.enforce_scrimmage_game_integrity()
returns trigger
language plpgsql
as $$
begin
  if coalesce(new.notes,'') ilike '%Arbiter type: Scrimmage%' then
    new.contest_type := 'Scrimmage';
  end if;

  if new.contest_type = 'Scrimmage' then
    new.home_score := null;
    new.away_score := null;
    if new.status = 'Final' then
      new.status := 'Scheduled';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_scrimmage_game_integrity on public.games;
create trigger trg_enforce_scrimmage_game_integrity
before insert or update on public.games
for each row execute function public.enforce_scrimmage_game_integrity();

update public.games
set home_score = null,
    away_score = null,
    status = case when status = 'Final' then 'Scheduled' else status end
where contest_type = 'Scrimmage';
