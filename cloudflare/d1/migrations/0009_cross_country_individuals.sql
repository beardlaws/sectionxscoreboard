PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS cross_country_individual_results (
  id TEXT PRIMARY KEY,
  meet_id TEXT NOT NULL,
  sport_id TEXT NOT NULL,
  athlete_id TEXT,
  team_id TEXT,
  external_opponent_id TEXT,
  runner_name TEXT,
  finish_place INTEGER,
  finish_time_seconds REAL,
  scorer INTEGER NOT NULL DEFAULT 0,
  displacer INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (meet_id) REFERENCES cross_country_meets(id) ON DELETE CASCADE,
  FOREIGN KEY (sport_id) REFERENCES sports(id) ON DELETE CASCADE,
  FOREIGN KEY (athlete_id) REFERENCES athletes(id) ON DELETE SET NULL,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL,
  FOREIGN KEY (external_opponent_id) REFERENCES external_opponents(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_d1_xc_individual_meet ON cross_country_individual_results(meet_id,sport_id,finish_place);
CREATE INDEX IF NOT EXISTS idx_d1_xc_individual_athlete ON cross_country_individual_results(athlete_id);
