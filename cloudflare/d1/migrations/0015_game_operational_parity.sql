PRAGMA foreign_keys = ON;

ALTER TABLE games ADD COLUMN recap TEXT;
ALTER TABLE games ADD COLUMN recap_author TEXT;
ALTER TABLE games ADD COLUMN is_playoff INTEGER DEFAULT 0;
ALTER TABLE games ADD COLUMN playoff_round TEXT;
ALTER TABLE games ADD COLUMN playoff_game_id TEXT;
ALTER TABLE games ADD COLUMN result_exempt INTEGER DEFAULT 0;
ALTER TABLE games ADD COLUMN result_exempt_reason TEXT;
ALTER TABLE games ADD COLUMN league_designation TEXT;
ALTER TABLE games ADD COLUMN league_designation_override INTEGER DEFAULT 0;
ALTER TABLE games ADD COLUMN league_designation_note TEXT;
ALTER TABLE games ADD COLUMN league_designation_updated_at TEXT;
ALTER TABLE games ADD COLUMN schedule_override INTEGER DEFAULT 0;
ALTER TABLE games ADD COLUMN schedule_override_note TEXT;
ALTER TABLE games ADD COLUMN schedule_override_updated_at TEXT;

CREATE INDEX IF NOT EXISTS idx_d1_games_playoff ON games(is_playoff, game_date);
CREATE INDEX IF NOT EXISTS idx_d1_games_result_exempt ON games(result_exempt, game_date);
CREATE INDEX IF NOT EXISTS idx_d1_games_schedule_override ON games(schedule_override, game_date);
