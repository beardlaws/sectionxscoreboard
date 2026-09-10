PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS game_period_scores (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL,
  team_side TEXT NOT NULL,
  period_number INTEGER NOT NULL,
  period_label TEXT,
  score INTEGER,
  created_at TEXT,
  updated_at TEXT,
  UNIQUE(game_id, team_side, period_number),
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_d1_game_period_scores_game ON game_period_scores(game_id);

CREATE TABLE IF NOT EXISTS stat_definitions (
  id TEXT PRIMARY KEY,
  sport_id TEXT,
  stat_key TEXT NOT NULL,
  label TEXT NOT NULL,
  category TEXT,
  value_type TEXT DEFAULT 'number',
  scope TEXT DEFAULT 'both',
  unit TEXT,
  lower_is_better INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  created_at TEXT,
  UNIQUE(sport_id, stat_key),
  FOREIGN KEY (sport_id) REFERENCES sports(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_d1_stat_definitions_sport ON stat_definitions(sport_id, sort_order);

CREATE TABLE IF NOT EXISTS game_team_stats (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL,
  team_side TEXT NOT NULL,
  stat_definition_id TEXT NOT NULL,
  value_numeric REAL,
  value_text TEXT,
  source_type TEXT,
  source_name TEXT,
  verified INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT,
  UNIQUE(game_id, team_side, stat_definition_id),
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  FOREIGN KEY (stat_definition_id) REFERENCES stat_definitions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_d1_game_team_stats_game ON game_team_stats(game_id);

CREATE TABLE IF NOT EXISTS game_athlete_stats (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL,
  athlete_id TEXT NOT NULL,
  team_id TEXT,
  stat_definition_id TEXT NOT NULL,
  value_numeric REAL,
  value_text TEXT,
  source_type TEXT,
  source_name TEXT,
  verified INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT,
  UNIQUE(game_id, athlete_id, stat_definition_id),
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  FOREIGN KEY (athlete_id) REFERENCES athletes(id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL,
  FOREIGN KEY (stat_definition_id) REFERENCES stat_definitions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_d1_game_athlete_stats_game ON game_athlete_stats(game_id);
CREATE INDEX IF NOT EXISTS idx_d1_game_athlete_stats_athlete ON game_athlete_stats(athlete_id);

CREATE TABLE IF NOT EXISTS photo_athletes (
  photo_id TEXT NOT NULL,
  athlete_id TEXT NOT NULL,
  created_at TEXT,
  PRIMARY KEY (photo_id, athlete_id),
  FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE,
  FOREIGN KEY (athlete_id) REFERENCES athletes(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_d1_photo_athletes_athlete ON photo_athletes(athlete_id);
