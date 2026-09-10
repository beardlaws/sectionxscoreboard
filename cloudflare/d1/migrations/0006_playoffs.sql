PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS playoff_tournaments (
  id TEXT PRIMARY KEY,
  sport_id TEXT,
  season_id TEXT,
  class TEXT,
  name TEXT,
  status TEXT,
  created_at TEXT,
  FOREIGN KEY (sport_id) REFERENCES sports(id),
  FOREIGN KEY (season_id) REFERENCES seasons(id)
);
CREATE INDEX IF NOT EXISTS idx_d1_playoff_tournaments_season ON playoff_tournaments(season_id);
CREATE INDEX IF NOT EXISTS idx_d1_playoff_tournaments_sport ON playoff_tournaments(sport_id);

CREATE TABLE IF NOT EXISTS playoff_games (
  id TEXT PRIMARY KEY,
  tournament_id TEXT NOT NULL,
  round INTEGER,
  position INTEGER,
  seed_home INTEGER,
  seed_away INTEGER,
  home_name TEXT,
  away_name TEXT,
  home_score INTEGER,
  away_score INTEGER,
  status TEXT,
  game_date TEXT,
  game_time TEXT,
  location TEXT,
  created_at TEXT,
  game_id TEXT,
  FOREIGN KEY (tournament_id) REFERENCES playoff_tournaments(id) ON DELETE CASCADE,
  FOREIGN KEY (game_id) REFERENCES games(id)
);
CREATE INDEX IF NOT EXISTS idx_d1_playoff_games_tournament ON playoff_games(tournament_id, round, position);
CREATE INDEX IF NOT EXISTS idx_d1_playoff_games_game ON playoff_games(game_id);
