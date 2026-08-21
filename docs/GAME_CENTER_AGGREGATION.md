# Stat aggregation plan

Do not store season/career totals prematurely. Initially derive them from verified `game_athlete_stats` grouped by athlete, team, sport, and season. Add materialized summaries only if performance requires them.

This prevents totals from drifting away from corrected game-level source data and keeps every career number traceable back to individual games.
