# Database additions

`game_period_scores`: game + side + period -> score

`stat_definitions`: sport-specific stat metadata and display behavior

`game_team_stats`: game + side + definition -> value + provenance

`game_athlete_stats`: game + athlete + definition -> value + provenance

`photo_athletes`: approved-photo tagging bridge to athlete profiles

Existing `photos` already connects to school/team/game/sport and remains canonical. Existing `games` remains canonical for the event itself.
