PRAGMA foreign_keys = ON;

ALTER TABLE games ADD COLUMN event_format TEXT NOT NULL DEFAULT 'head_to_head';
ALTER TABLE games ADD COLUMN counts_for_standings INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS event_team_results (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
  external_opponent_id TEXT REFERENCES external_opponents(id) ON DELETE SET NULL,
  display_name TEXT,
  placement INTEGER,
  score REAL,
  points REAL,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  CHECK (team_id IS NOT NULL OR external_opponent_id IS NOT NULL OR display_name IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_event_team_results_game ON event_team_results(game_id, placement);
CREATE INDEX IF NOT EXISTS idx_event_team_results_team ON event_team_results(team_id, game_id);
CREATE INDEX IF NOT EXISTS idx_games_event_format ON games(event_format, game_date DESC);
