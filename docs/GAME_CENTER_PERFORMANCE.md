# Performance principle

Advanced Game Center data should be fetched by game ID with indexed relationships. The new period/team-stat/athlete-stat tables have game indexes. Athlete stats also have an athlete index for future career aggregation.

Do not load Section-wide stat datasets on individual game pages. Keep the permanent game page fast even as historical data grows.
