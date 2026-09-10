PRAGMA foreign_keys = ON;

ALTER TABLE photos ADD COLUMN storage_provider TEXT DEFAULT 'legacy';
ALTER TABLE photos ADD COLUMN storage_key TEXT;
ALTER TABLE photos ADD COLUMN mime_type TEXT;
ALTER TABLE photos ADD COLUMN file_size_bytes INTEGER;

CREATE INDEX IF NOT EXISTS idx_d1_photos_storage_key ON photos(storage_key);

CREATE TABLE IF NOT EXISTS photo_tag_suggestions (
  id TEXT PRIMARY KEY,
  photo_id TEXT NOT NULL,
  athlete_id TEXT NOT NULL,
  contributor_id TEXT,
  source_type TEXT NOT NULL DEFAULT 'public',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT DEFAULT (datetime('now')),
  reviewed_at TEXT,
  reviewed_by TEXT,
  FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE,
  FOREIGN KEY (athlete_id) REFERENCES athletes(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_d1_photo_tag_suggestions_photo ON photo_tag_suggestions(photo_id,status);
CREATE INDEX IF NOT EXISTS idx_d1_photo_tag_suggestions_athlete ON photo_tag_suggestions(athlete_id,status);
