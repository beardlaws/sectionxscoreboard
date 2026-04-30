-- ============================================================
-- Add Saranac Lake Placid as a real school for Girls Lacrosse
-- (They appear in Section X Girls Lacrosse standings)
-- ============================================================

-- Add the school
INSERT INTO schools (school_name, mascot, city, county, primary_color, secondary_color, alias, slug, active)
VALUES ('Saranac Lake Placid', 'Wolves', 'Saranac Lake', 'Franklin', '#1e3a8a', '#ffffff', 'SLP', 'saranac-lake-placid')
ON CONFLICT (slug) DO NOTHING;

-- Add Girls Lacrosse team
INSERT INTO teams (school_id, sport_id, team_name, slug)
SELECT s.id, 'b1000000-0000-0000-0000-000000000004', 'Saranac Lake Placid Girls Lacrosse', 'saranac-lake-placid-girls-lacrosse'
FROM schools s WHERE s.slug = 'saranac-lake-placid'
ON CONFLICT (slug) DO NOTHING;

-- Activate for Spring 2026 with correct division
INSERT INTO team_seasons (team_id, season_id, division, active_for_season)
SELECT t.id, 'a1000000-0000-0000-0000-000000000001', 'North', true
FROM teams t WHERE t.slug = 'saranac-lake-placid-girls-lacrosse'
ON CONFLICT (team_id, season_id) DO UPDATE SET active_for_season = true, division = 'North';

-- Update Plattsburgh Girls Lacrosse to correct division too
UPDATE team_seasons ts
SET division = 'North'
FROM teams t
WHERE ts.team_id = t.id
  AND t.slug = 'plattsburgh-girls-lacrosse'
  AND ts.season_id = 'a1000000-0000-0000-0000-000000000001';

-- Set divisions for ALL Girls Lacrosse teams based on the standings image:
-- From the image: Canton, Saranac Lake Placid, Salmon River, Potsdam, Ogdensburg, Massena, Plattsburgh, Malone
-- These all appear to be in one division (no East/Central/West shown - it's just one group)
-- So set division = 'Section X' for all GL teams, or leave division-based on geography

-- Looking at the image more carefully - it's ALL one group, no division split
-- Set division to empty/null for girls lacrosse so it shows as one table
UPDATE team_seasons ts
SET division = NULL, class = NULL
FROM teams t
WHERE ts.team_id = t.id
  AND t.sport_id = 'b1000000-0000-0000-0000-000000000004'
  AND ts.season_id = 'a1000000-0000-0000-0000-000000000001';

-- Verify
SELECT sch.school_name, t.team_name, ts.division, ts.class, ts.active_for_season
FROM team_seasons ts
JOIN teams t ON ts.team_id = t.id
JOIN schools sch ON t.school_id = sch.id
WHERE t.sport_id = 'b1000000-0000-0000-0000-000000000004'
  AND ts.season_id = 'a1000000-0000-0000-0000-000000000001'
ORDER BY sch.school_name;
