PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS game_import_sources (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  season_id TEXT NOT NULL,
  sport_id TEXT NOT NULL,
  source TEXT NOT NULL,
  imported_at TEXT DEFAULT (datetime('now')),
  source_status TEXT,
  source_game_time TEXT,
  source_location TEXT,
  source_contest_type TEXT,
  source_notes TEXT,
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (season_id) REFERENCES seasons(id),
  FOREIGN KEY (sport_id) REFERENCES sports(id),
  UNIQUE(game_id,team_id,season_id,sport_id)
);
CREATE INDEX IF NOT EXISTS idx_d1_game_import_sources_game ON game_import_sources(game_id);
CREATE INDEX IF NOT EXISTS idx_d1_game_import_sources_team ON game_import_sources(team_id,season_id,sport_id);
