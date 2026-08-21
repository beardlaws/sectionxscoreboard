# Canonical ownership

- `games`: event identity, status, final score, recap
- `teams`/`team_seasons`: program identity and season participation
- `athletes`/`roster_entries`: athlete identity and team-season membership
- `photos`: media identity and moderation
- Game Center stat tables: scoring detail and performance data

Avoid duplicating these facts into customization tables. Customization should decorate canonical data, not fork it.
