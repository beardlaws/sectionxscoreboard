-- Tournament games are non-league by default unless an admin override says otherwise.
update public.games g
set league_designation='Non-League',
    league_designation_updated_at=now(),
    updated_at=now()
from public.arbiter_game_links l
where l.game_id=g.id
  and coalesce(g.league_designation_override,false)=false
  and lower(coalesce(l.source_payload->>'gameTypeName',''))='tournament';
