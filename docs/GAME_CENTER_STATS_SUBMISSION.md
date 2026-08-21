# Future stat submission

Public/coach stat submissions should write to a moderation layer or controlled server action, not directly to canonical `game_team_stats`/`game_athlete_stats` through anonymous RLS.

Approval can normalize accepted values into canonical rows with source and verification metadata. This keeps participation easy while protecting leaderboards and career totals from unreviewed data.
