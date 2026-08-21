# Game Center security model

New Game Center tables have RLS enabled.

Public access is SELECT-only for scoring/stat data. Photo-athlete tags are publicly readable only when their parent photo is approved. No public INSERT/UPDATE/DELETE policies were added for stats.

Future coach/community stat submission must use a moderated submission path rather than granting anonymous direct writes to canonical statistics.
