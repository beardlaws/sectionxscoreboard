insert into public.stat_definitions (sport_id, stat_key, label, category, value_type, scope, unit, lower_is_better, sort_order, active)
select s.id, v.stat_key, v.label, 'team', 'number', 'team', null, false, v.sort_order, true
from public.sports s
join (values
  ('Boys Soccer','shots','Shots',10),('Boys Soccer','shots_on_goal','Shots on Goal',20),('Boys Soccer','corner_kicks','Corners',30),('Boys Soccer','saves','Saves',40),
  ('Girls Soccer','shots','Shots',10),('Girls Soccer','shots_on_goal','Shots on Goal',20),('Girls Soccer','corner_kicks','Corners',30),('Girls Soccer','saves','Saves',40),
  ('Football','first_downs','First Downs',10),('Football','total_yards','Total Yards',20),('Football','turnovers','Turnovers',30),('Football','penalties','Penalties',40),
  ('Boys Basketball','rebounds','Rebounds',10),('Boys Basketball','assists','Assists',20),('Boys Basketball','turnovers','Turnovers',30),('Boys Basketball','three_pointers','3PT Made',40),
  ('Girls Basketball','rebounds','Rebounds',10),('Girls Basketball','assists','Assists',20),('Girls Basketball','turnovers','Turnovers',30),('Girls Basketball','three_pointers','3PT Made',40),
  ('Boys Hockey','shots','Shots',10),('Boys Hockey','power_play_goals','PP Goals',20),('Boys Hockey','penalty_minutes','Penalty Min',30),('Boys Hockey','saves','Saves',40),
  ('Girls Hockey','shots','Shots',10),('Girls Hockey','power_play_goals','PP Goals',20),('Girls Hockey','penalty_minutes','Penalty Min',30),('Girls Hockey','saves','Saves',40),
  ('Baseball','hits','Hits',10),('Baseball','errors','Errors',20),('Baseball','walks','Walks',30),('Baseball','strikeouts','Strikeouts',40),
  ('Softball','hits','Hits',10),('Softball','errors','Errors',20),('Softball','walks','Walks',30),('Softball','strikeouts','Strikeouts',40),
  ('Boys Lacrosse','shots','Shots',10),('Boys Lacrosse','ground_balls','Ground Balls',20),('Boys Lacrosse','faceoffs_won','Faceoffs Won',30),('Boys Lacrosse','saves','Saves',40),
  ('Girls Lacrosse','shots','Shots',10),('Girls Lacrosse','ground_balls','Ground Balls',20),('Girls Lacrosse','draw_controls','Draw Controls',30),('Girls Lacrosse','saves','Saves',40)
) as v(sport_name, stat_key, label, sort_order) on s.sport_name = v.sport_name
on conflict (sport_id, stat_key) do update set label=excluded.label, scope=excluded.scope, category=excluded.category, sort_order=excluded.sort_order, active=true;
