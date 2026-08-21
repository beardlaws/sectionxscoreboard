# Team stats model

Team-level game metrics are keyed by game, home/away side, and stat definition. This avoids relying on a team ID when an external opponent is involved while still keeping the game matchup authoritative.

Future displays can show only definitions that have values, preserving sparse-data behavior.
