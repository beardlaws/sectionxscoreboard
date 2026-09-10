PRAGMA foreign_keys = ON;

-- Additive parity fields used by the current public site but omitted from the first D1 core pass.
ALTER TABLE schools ADD COLUMN logo_url TEXT;
ALTER TABLE schools ADD COLUMN is_section_x INTEGER DEFAULT 1;

ALTER TABLE games ADD COLUMN contest_type TEXT DEFAULT 'Game';

ALTER TABLE team_seasons ADD COLUMN btm_override REAL;

CREATE INDEX IF NOT EXISTS idx_schools_section_x ON schools(is_section_x, active);
CREATE INDEX IF NOT EXISTS idx_games_contest_type ON games(contest_type);
