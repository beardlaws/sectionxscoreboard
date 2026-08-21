# API direction

Future write APIs should operate around game-centered commands (update score/status, upsert period scoring, upsert team stats, upsert athlete stats, attach/tag photos) and validate authorization server-side.

Avoid exposing broad anonymous CRUD over canonical sports data.
