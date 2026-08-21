# Game Center v1 integration checklist

The foundation is intentionally additive so existing public game pages remain stable while modules are introduced.

## Ready now
- Game-aware photo submissions via `/submit-photo?game=<game id>`
- Sport-aware stat schema
- Period/quarter/inning/set score schema
- Team game stats schema
- Athlete game stats schema
- Athlete photo-tag relationship
- Reusable `PeriodScoreTable`, `TeamStatsTable`, and `AthleteStatsTable`
- `getGameCenterData()` loader
- Reusable game-photo CTA

## Next UI integration
On the existing `src/app/(public)/games/[id]/page.tsx`:
1. Load `getGameCenterData(supabase, game.id)`.
2. Render `PeriodScoreTable` after the main score card.
3. Render `TeamStatsTable` and `AthleteStatsTable` after the recap.
4. Render `SubmitGamePhotoLink` immediately before the approved game gallery.

These components return null when no data exists, preserving the clean score-only experience.

## Next admin integration
Create a Game Center editor that uses `stat_definitions` to generate sport-specific inputs. Do not hardcode a single universal box score.
