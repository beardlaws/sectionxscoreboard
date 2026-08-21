# Game Center v1

This branch establishes the connected sports-data foundation without replacing existing Section X Scoreboard architecture.

Production database migration has been applied additively. Existing schedules, games, standings, rosters, photos, team pages, and school pages remain intact.

The first user-facing change on this branch is game-aware photo submission. The existing Game Center already supports score, records, recap, metadata, approved game photos, and correction reporting; new stat/scoring modules are isolated and ready for safe integration.
