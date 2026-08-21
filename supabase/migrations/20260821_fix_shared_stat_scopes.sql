update public.stat_definitions sd
set scope='both'
from public.sports s
where sd.sport_id=s.id
and (
  (s.sport_name in ('Boys Soccer','Girls Soccer','Boys Hockey','Girls Hockey','Boys Lacrosse','Girls Lacrosse') and sd.stat_key='saves')
  or (s.sport_name in ('Boys Basketball','Girls Basketball') and sd.stat_key in ('rebounds','assists'))
  or (s.sport_name in ('Baseball','Softball') and sd.stat_key in ('hits','strikeouts'))
);
