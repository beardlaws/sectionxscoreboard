-- Normalize date-only game fields after PostgreSQL -> D1 migration.
-- Supabase DATE values can arrive through migration tooling as ISO timestamps.
-- Section X treats these columns as calendar dates in America/New_York, so store
-- them consistently as YYYY-MM-DD to keep equality/range queries correct.

UPDATE games
SET game_date = substr(trim(game_date), 1, 10)
WHERE game_date IS NOT NULL
  AND length(trim(game_date)) > 10
  AND substr(trim(game_date), 5, 1) = '-'
  AND substr(trim(game_date), 8, 1) = '-';

UPDATE games
SET rescheduled_date = substr(trim(rescheduled_date), 1, 10)
WHERE rescheduled_date IS NOT NULL
  AND length(trim(rescheduled_date)) > 10
  AND substr(trim(rescheduled_date), 5, 1) = '-'
  AND substr(trim(rescheduled_date), 8, 1) = '-';
