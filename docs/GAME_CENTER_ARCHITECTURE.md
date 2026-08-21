# Section X Scoreboard Game Center Architecture

## Product goal
Every game is a permanent hub that connects scores, teams, schools, athletes, photos, recaps, stats, standings, and history.

## Data completeness levels
1. Score only
2. Period/quarter scoring
3. Team stats
4. Athlete box score

A game is valid at any level. Missing advanced data must never make a game page look broken.

## Core relationships
School <-> Team <-> Season <-> Game <-> Athlete <-> Coach <-> Photo <-> Story <-> Award

## Game Center v1 foundation
- Existing `games` remains the canonical event table.
- `game_period_scores` supports quarters, periods, innings, sets, etc.
- `stat_definitions` makes stats sport-aware instead of hardcoding basketball/football fields.
- `game_team_stats` stores game-level team metrics.
- `game_athlete_stats` stores athlete box-score metrics and carries source/verification metadata.
- `photo_athletes` supports tagging approved photos to athletes.
- Existing `photos.game_id`, `team_id`, `school_id`, and `sport_id` are retained and used as the connected photo graph.

## Provenance
Advanced stat rows carry `source_type`, `source_name`, and `verified`. Future admin tools should expose verification rather than silently treating community data as official.

## Photo distribution
A photo tied to a game can be surfaced on the game page. Its game supplies sport and matchup context; its explicit school/team links support team and school galleries. Athlete tagging through `photo_athletes` supports athlete career galleries later.

## Future modules without schema replacement
- Full box scores
- Season and career stat aggregation
- Section X leaderboards
- School and Section X records
- Coach/team stat submission
- CSV/stat-sheet imports
- Athlete photo tagging UI
- Live Game Center
- Historical seasons

## Principle
Enter information once; distribute it everywhere it belongs.
