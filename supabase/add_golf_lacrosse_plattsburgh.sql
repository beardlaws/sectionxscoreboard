-- ============================================================
-- Add Plattsburgh High School (external school for Girls Lacrosse)
-- ============================================================
INSERT INTO schools (school_name, mascot, city, county, primary_color, secondary_color, alias, slug, active)
VALUES ('Plattsburgh High School', 'Hornets', 'Plattsburgh', 'Clinton', '#FF6600', '#000000', 'PLATT', 'plattsburgh-high-school')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- Add Girls Lacrosse teams for all Section X schools that play
-- sport_id b1000000-0000-0000-0000-000000000004 = Girls Lacrosse
-- ============================================================

-- Get Plattsburgh school ID for use below
-- First add Plattsburgh Girls Lacrosse team
INSERT INTO teams (school_id, sport_id, team_name, slug)
SELECT s.id, 'b1000000-0000-0000-0000-000000000004', 'Plattsburgh Girls Lacrosse', 'plattsburgh-girls-lacrosse'
FROM schools s WHERE s.slug = 'plattsburgh-high-school'
ON CONFLICT (slug) DO NOTHING;

-- Saranac Lake Placid is likely a co-op or external - add as external opponent for now
-- The image shows: Canton, Saranac Lake Placid, Salmon River, Potsdam, Ogdensburg, Massena, Plattsburgh, Malone
-- These are the Section X Girls Lacrosse teams + Plattsburgh

-- Add Girls Lacrosse teams for Section X schools that don't have them yet
-- (Canton, Salmon River, Massena, Malone, OFA, Potsdam already have GL teams from seed)
-- Plattsburgh is the new one

-- Add Plattsburgh to Spring 2026 season team_seasons
INSERT INTO team_seasons (team_id, season_id, class, division, active_for_season)
SELECT t.id, 'a1000000-0000-0000-0000-000000000001', 'A', 'North', true
FROM teams t WHERE t.slug = 'plattsburgh-girls-lacrosse'
ON CONFLICT (team_id, season_id) DO NOTHING;

-- ============================================================
-- Add Boys Golf teams for all Section X golf schools
-- sport_id b1000000-0000-0000-0000-000000000007 = Boys Golf
-- ============================================================
-- Schools with golf: Potsdam, Salmon River, Massena, Malone, Tupper Lake, Canton,
-- OFA (Ogdensburg), Madrid-Waddington, Gouverneur, Clifton-Fine, Morristown, Norwood-Norfolk

-- These schools may already have golf teams from seed - use ON CONFLICT to be safe
INSERT INTO teams (school_id, sport_id, team_name, slug) VALUES
  ((SELECT id FROM schools WHERE slug='potsdam'),          'b1000000-0000-0000-0000-000000000007', 'Potsdam Boys Golf',          'potsdam-boys-golf'),
  ((SELECT id FROM schools WHERE slug='salmon-river'),      'b1000000-0000-0000-0000-000000000007', 'Salmon River Boys Golf',      'salmon-river-boys-golf'),
  ((SELECT id FROM schools WHERE slug='massena'),           'b1000000-0000-0000-0000-000000000007', 'Massena Boys Golf',           'massena-boys-golf'),
  ((SELECT id FROM schools WHERE slug='malone'),            'b1000000-0000-0000-0000-000000000007', 'Malone Boys Golf',            'malone-boys-golf'),
  ((SELECT id FROM schools WHERE slug='tupper-lake'),       'b1000000-0000-0000-0000-000000000007', 'Tupper Lake Boys Golf',       'tupper-lake-boys-golf'),
  ((SELECT id FROM schools WHERE slug='canton'),            'b1000000-0000-0000-0000-000000000007', 'Canton Boys Golf',            'canton-boys-golf'),
  ((SELECT id FROM schools WHERE slug='ogdensburg-free-academy'), 'b1000000-0000-0000-0000-000000000007', 'OFA Boys Golf', 'ofa-boys-golf'),
  ((SELECT id FROM schools WHERE slug='madrid-waddington'), 'b1000000-0000-0000-0000-000000000007', 'Madrid-Waddington Boys Golf', 'madrid-waddington-boys-golf'),
  ((SELECT id FROM schools WHERE slug='gouverneur'),        'b1000000-0000-0000-0000-000000000007', 'Gouverneur Boys Golf',        'gouverneur-boys-golf'),
  ((SELECT id FROM schools WHERE slug='clifton-fine'),      'b1000000-0000-0000-0000-000000000007', 'Clifton-Fine Boys Golf',      'clifton-fine-boys-golf'),
  ((SELECT id FROM schools WHERE slug='morristown'),        'b1000000-0000-0000-0000-000000000007', 'Morristown Boys Golf',        'morristown-boys-golf'),
  ((SELECT id FROM schools WHERE slug='norwood-norfolk'),   'b1000000-0000-0000-0000-000000000007', 'Norwood-Norfolk Boys Golf',   'norwood-norfolk-boys-golf')
ON CONFLICT (slug) DO NOTHING;

-- Activate all golf teams for Spring 2026
INSERT INTO team_seasons (team_id, season_id, active_for_season)
SELECT t.id, 'a1000000-0000-0000-0000-000000000001', true
FROM teams t
WHERE t.sport_id = 'b1000000-0000-0000-0000-000000000007'
  AND t.slug IN (
    'potsdam-boys-golf','salmon-river-boys-golf','massena-boys-golf',
    'malone-boys-golf','tupper-lake-boys-golf','canton-boys-golf',
    'ofa-boys-golf','madrid-waddington-boys-golf','gouverneur-boys-golf',
    'clifton-fine-boys-golf','morristown-boys-golf','norwood-norfolk-boys-golf'
  )
ON CONFLICT (team_id, season_id) DO UPDATE SET active_for_season = true;

-- ============================================================
-- Verify what we added
-- ============================================================
SELECT t.team_name, t.slug, s.sport_name, sch.school_name
FROM teams t
JOIN sports s ON t.sport_id = s.id
JOIN schools sch ON t.school_id = sch.id
WHERE t.sport_id IN (
  'b1000000-0000-0000-0000-000000000007',
  'b1000000-0000-0000-0000-000000000004'
)
ORDER BY s.sport_name, sch.school_name;
