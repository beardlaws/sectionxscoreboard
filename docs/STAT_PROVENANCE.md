# Stat provenance and verification

Game Center stats are designed to distinguish availability from authority.

Each team/player game stat can record:
- `source_type`: admin, school, coach, official_book, community, import, historical, etc.
- `source_name`: human-readable source or contributor
- `verified`: whether Section X Scoreboard considers the value verified

Future UI should display verification at the game/dataset level and preserve source information for corrections and historical research.

Community submissions should never silently become verified official statistics.
