# Athlete game stats model

Athlete stats are stored at the smallest durable level: athlete + game + stat definition. Team ID is also stored for context. Season and career numbers should initially aggregate from these rows.

This supports multi-sport athletes naturally because each stat definition belongs to the game's sport rather than the athlete profile itself.
