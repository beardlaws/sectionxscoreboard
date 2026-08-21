# Architecture decisions

1. Keep `games` canonical; no parallel Game Center event table.
2. Keep `photos` canonical; extend relationships instead of replacing it.
3. Stats are definition-driven by sport, not one giant hardcoded column set.
4. Store game-level athlete stats; derive season/career totals.
5. Preserve source and verification metadata.
6. Advanced content is optional and progressively rendered.
7. Public canonical stat writes remain closed; future submissions are moderated.
