-- ============================================================
-- Section X Scoreboard — Seed Data
-- Run AFTER 001_initial.sql
-- ============================================================

-- ============================================================
-- SEASONS
-- ============================================================
INSERT INTO seasons (id, name, year, season_type, is_active, start_date, end_date) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Spring 2026', 2026, 'Spring', true,  '2026-04-01', '2026-06-15'),
  ('a1000000-0000-0000-0000-000000000002', 'Fall 2026',   2026, 'Fall',   false, '2026-09-01', '2026-11-15'),
  ('a1000000-0000-0000-0000-000000000003', 'Winter 2026', 2026, 'Winter', false, '2026-12-01', '2027-03-01');

-- ============================================================
-- SPORTS
-- ============================================================
INSERT INTO sports (id, sport_name, gender, season_type, homepage_priority, slug) VALUES
  -- Spring
  ('b1000000-0000-0000-0000-000000000001', 'Baseball',      'Boys',  'Spring', 1,  'baseball'),
  ('b1000000-0000-0000-0000-000000000002', 'Softball',      'Girls', 'Spring', 2,  'softball'),
  ('b1000000-0000-0000-0000-000000000003', 'Boys Lacrosse', 'Boys',  'Spring', 3,  'boys-lacrosse'),
  ('b1000000-0000-0000-0000-000000000004', 'Girls Lacrosse','Girls', 'Spring', 4,  'girls-lacrosse'),
  ('b1000000-0000-0000-0000-000000000005', 'Track',         'Boys',  'Spring', 5,  'boys-track'),
  ('b1000000-0000-0000-0000-000000000006', 'Track',         'Girls', 'Spring', 6,  'girls-track'),
  ('b1000000-0000-0000-0000-000000000007', 'Golf',          'Boys',  'Spring', 7,  'boys-golf'),
  -- Fall
  ('b1000000-0000-0000-0000-000000000008', 'Football',      'Boys',  'Fall',   1,  'football'),
  ('b1000000-0000-0000-0000-000000000009', 'Boys Soccer',   'Boys',  'Fall',   2,  'boys-soccer'),
  ('b1000000-0000-0000-0000-000000000010', 'Girls Soccer',  'Girls', 'Fall',   3,  'girls-soccer'),
  ('b1000000-0000-0000-0000-000000000011', 'Volleyball',    'Girls', 'Fall',   4,  'volleyball'),
  ('b1000000-0000-0000-0000-000000000012', 'Cross Country', 'Boys',  'Fall',   5,  'boys-cross-country'),
  ('b1000000-0000-0000-0000-000000000013', 'Cross Country', 'Girls', 'Fall',   6,  'girls-cross-country'),
  -- Winter
  ('b1000000-0000-0000-0000-000000000014', 'Boys Basketball',  'Boys',  'Winter', 1, 'boys-basketball'),
  ('b1000000-0000-0000-0000-000000000015', 'Girls Basketball', 'Girls', 'Winter', 2, 'girls-basketball'),
  ('b1000000-0000-0000-0000-000000000016', 'Boys Hockey',      'Boys',  'Winter', 3, 'boys-hockey'),
  ('b1000000-0000-0000-0000-000000000017', 'Girls Hockey',     'Girls', 'Winter', 4, 'girls-hockey'),
  ('b1000000-0000-0000-0000-000000000018', 'Wrestling',        'Boys',  'Winter', 5, 'boys-wrestling'),
  ('b1000000-0000-0000-0000-000000000019', 'Wrestling',        'Girls', 'Winter', 6, 'girls-wrestling'),
  ('b1000000-0000-0000-0000-000000000020', 'Swimming',         'Girls', 'Winter', 7, 'girls-swimming'),
  ('b1000000-0000-0000-0000-000000000021', 'Indoor Track',     'Boys',  'Winter', 8, 'boys-indoor-track'),
  ('b1000000-0000-0000-0000-000000000022', 'Indoor Track',     'Girls', 'Winter', 9, 'girls-indoor-track');

-- ============================================================
-- SCHOOLS
-- ============================================================
INSERT INTO schools (id, school_name, mascot, city, county, primary_color, secondary_color, alias, slug) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'Brushton-Moira Central School',      'Panthers',      'Brushton',    'Franklin',   '#CC0000', '#000000', 'BM',      'brushton-moira'),
  ('c1000000-0000-0000-0000-000000000002', 'Canton Central School',              'Bears',         'Canton',      'St Lawrence','#CFB53B', '#000000', 'CANTON',  'canton'),
  ('c1000000-0000-0000-0000-000000000003', 'Chateaugay Central School',          'Bulldogs',      'Chateaugay',  'Franklin',   '#800000', '#FFFFFF', 'CHAT',    'chateaugay'),
  ('c1000000-0000-0000-0000-000000000004', 'Clifton-Fine Central School',        'Eagles',        'Star Lake',   'St Lawrence','#003087', '#CFB53B', 'CF',      'clifton-fine'),
  ('c1000000-0000-0000-0000-000000000005', 'Colton-Pierrepont Central School',   'Colts',         'Colton',      'St Lawrence','#6B21A8', '#CFB53B', 'CP',      'colton-pierrepont'),
  ('c1000000-0000-0000-0000-000000000006', 'Edwards-Knox Central School',        'Cougars',       'Edwards',     'St Lawrence','#1C1C1C', '#C0C0C0', 'EK',      'edwards-knox'),
  ('c1000000-0000-0000-0000-000000000007', 'Gouverneur Central School',          'Wildcats',      'Gouverneur',  'St Lawrence','#003087', '#CFB53B', 'GOUV',    'gouverneur'),
  ('c1000000-0000-0000-0000-000000000008', 'Hammond Central School',             'Red Devils',    'Hammond',     'St Lawrence','#CC0000', '#000000', 'HAMMOND', 'hammond'),
  ('c1000000-0000-0000-0000-000000000009', 'Harrisville Central School',         'Pirates',       'Harrisville', 'St Lawrence','#800000', '#000000', 'Harrisville','harrisville'),
  ('c1000000-0000-0000-0000-000000000010', 'Hermon-Dekalb Central School',       'Demons',        'Hermon',      'St Lawrence','#006400', '#CFB53B', 'HD',      'hermon-dekalb'),
  ('c1000000-0000-0000-0000-000000000011', 'Heuvelton Central School',           'Bulldogs',      'Heuvelton',   'St Lawrence','#6B21A8', '#FFD700', 'HCS',     'heuvelton'),
  ('c1000000-0000-0000-0000-000000000012', 'Lisbon Central School',              'Golden Knights','Lisbon',      'St Lawrence','#003087', '#CFB53B', 'LCS',     'lisbon'),
  ('c1000000-0000-0000-0000-000000000013', 'Madrid-Waddington Central',          'Yellow Jackets','Madrid',      'St Lawrence','#FFD700', '#003087', 'MW',      'madrid-waddington'),
  ('c1000000-0000-0000-0000-000000000014', 'Malone Central School',              'Huskies',       'Malone',      'Franklin',   '#006400', '#000000', 'Malone',  'malone'),
  ('c1000000-0000-0000-0000-000000000015', 'Massena Central School',             'Raiders',       'Massena',     'St Lawrence','#CC0000', '#003087', 'Massena', 'massena'),
  ('c1000000-0000-0000-0000-000000000016', 'Morristown Central School',          'Rockets',       'Morristown',  'St Lawrence','#006400', '#000000', 'Morristown','morristown'),
  ('c1000000-0000-0000-0000-000000000017', 'Norwood-Norfolk Central',            'Flyers',        'Norfolk',     'St Lawrence','#006400', '#FFD700', 'NN',      'norwood-norfolk'),
  ('c1000000-0000-0000-0000-000000000018', 'Ogdensburg Free Academy',            'Blue Devils',   'Ogdensburg',  'St Lawrence','#003087', '#FFFFFF', 'OFA',     'ogdensburg-free-academy'),
  ('c1000000-0000-0000-0000-000000000019', 'Parishville-Hopkinton Central School','Panthers',     'Parishville', 'St Lawrence','#CC0000', '#000000', 'PH',      'parishville-hopkinton'),
  ('c1000000-0000-0000-0000-000000000020', 'Potsdam Central School',             'Stoners',       'Potsdam',     'St Lawrence','#003087', '#FF6B00', 'Potsdam', 'potsdam'),
  ('c1000000-0000-0000-0000-000000000021', 'Salmon River Central School',        'Shamrocks',     'Salmon River','St Lawrence','#006400', '#000000', 'SR',      'salmon-river'),
  ('c1000000-0000-0000-0000-000000000022', 'St Lawrence Central School',         'Larries',       'Brasher',     'St Lawrence','#003087', '#000000', 'SLC',     'st-lawrence-central'),
  ('c1000000-0000-0000-0000-000000000023', 'St Regis Falls Central School',      'Saints',        'St Regis',    'St Lawrence','#CFB53B', '#003087', 'SRF',     'st-regis-falls'),
  ('c1000000-0000-0000-0000-000000000024', 'Tupper Lake Central School',         'Lumberjacks',   'Tupper Lake', 'St Lawrence','#1C1C1C', '#CC0000', 'TL',      'tupper-lake');

-- ============================================================
-- TEAMS (one per school/sport/level combination)
-- ============================================================
-- Helper: school alias map for slug generation
-- slug pattern: {school-slug}-{sport-slug}

-- BRUSHTON-MOIRA (c1)
INSERT INTO teams (school_id, sport_id, team_name, slug) VALUES
  ('c1000000-0000-0000-0000-000000000001','b1000000-0000-0000-0000-000000000002','Brushton-Moira Softball','brushton-moira-softball'),
  ('c1000000-0000-0000-0000-000000000001','b1000000-0000-0000-0000-000000000001','Brushton-Moira Baseball','brushton-moira-baseball'),
  ('c1000000-0000-0000-0000-000000000001','b1000000-0000-0000-0000-000000000015','Brushton-Moira Girls Basketball','brushton-moira-girls-basketball'),
  ('c1000000-0000-0000-0000-000000000001','b1000000-0000-0000-0000-000000000014','Brushton-Moira Boys Basketball','brushton-moira-boys-basketball'),
  ('c1000000-0000-0000-0000-000000000001','b1000000-0000-0000-0000-000000000010','Brushton-Moira Girls Soccer','brushton-moira-girls-soccer'),
  ('c1000000-0000-0000-0000-000000000001','b1000000-0000-0000-0000-000000000009','Brushton-Moira Boys Soccer','brushton-moira-boys-soccer');

-- CANTON (c2)
INSERT INTO teams (school_id, sport_id, team_name, slug) VALUES
  ('c1000000-0000-0000-0000-000000000002','b1000000-0000-0000-0000-000000000002','Canton Softball','canton-softball'),
  ('c1000000-0000-0000-0000-000000000002','b1000000-0000-0000-0000-000000000001','Canton Baseball','canton-baseball'),
  ('c1000000-0000-0000-0000-000000000002','b1000000-0000-0000-0000-000000000015','Canton Girls Basketball','canton-girls-basketball'),
  ('c1000000-0000-0000-0000-000000000002','b1000000-0000-0000-0000-000000000014','Canton Boys Basketball','canton-boys-basketball'),
  ('c1000000-0000-0000-0000-000000000002','b1000000-0000-0000-0000-000000000010','Canton Girls Soccer','canton-girls-soccer'),
  ('c1000000-0000-0000-0000-000000000002','b1000000-0000-0000-0000-000000000009','Canton Boys Soccer','canton-boys-soccer'),
  ('c1000000-0000-0000-0000-000000000002','b1000000-0000-0000-0000-000000000008','Canton Football','canton-football'),
  ('c1000000-0000-0000-0000-000000000002','b1000000-0000-0000-0000-000000000007','Canton Boys Golf','canton-boys-golf'),
  ('c1000000-0000-0000-0000-000000000002','b1000000-0000-0000-0000-000000000016','Canton Boys Hockey','canton-boys-hockey'),
  ('c1000000-0000-0000-0000-000000000002','b1000000-0000-0000-0000-000000000017','Canton Girls Hockey','canton-girls-hockey'),
  ('c1000000-0000-0000-0000-000000000002','b1000000-0000-0000-0000-000000000003','Canton Boys Lacrosse','canton-boys-lacrosse'),
  ('c1000000-0000-0000-0000-000000000002','b1000000-0000-0000-0000-000000000004','Canton Girls Lacrosse','canton-girls-lacrosse'),
  ('c1000000-0000-0000-0000-000000000002','b1000000-0000-0000-0000-000000000020','Canton Girls Swimming','canton-girls-swimming'),
  ('c1000000-0000-0000-0000-000000000002','b1000000-0000-0000-0000-000000000005','Canton Boys Track','canton-boys-track'),
  ('c1000000-0000-0000-0000-000000000002','b1000000-0000-0000-0000-000000000006','Canton Girls Track','canton-girls-track'),
  ('c1000000-0000-0000-0000-000000000002','b1000000-0000-0000-0000-000000000018','Canton Boys Wrestling','canton-boys-wrestling');

-- CHATEAUGAY (c3)
INSERT INTO teams (school_id, sport_id, team_name, slug) VALUES
  ('c1000000-0000-0000-0000-000000000003','b1000000-0000-0000-0000-000000000002','Chateaugay Softball','chateaugay-softball'),
  ('c1000000-0000-0000-0000-000000000003','b1000000-0000-0000-0000-000000000001','Chateaugay Baseball','chateaugay-baseball'),
  ('c1000000-0000-0000-0000-000000000003','b1000000-0000-0000-0000-000000000015','Chateaugay Girls Basketball','chateaugay-girls-basketball'),
  ('c1000000-0000-0000-0000-000000000003','b1000000-0000-0000-0000-000000000014','Chateaugay Boys Basketball','chateaugay-boys-basketball'),
  ('c1000000-0000-0000-0000-000000000003','b1000000-0000-0000-0000-000000000010','Chateaugay Girls Soccer','chateaugay-girls-soccer'),
  ('c1000000-0000-0000-0000-000000000003','b1000000-0000-0000-0000-000000000009','Chateaugay Boys Soccer','chateaugay-boys-soccer');

-- CLIFTON-FINE (c4)
INSERT INTO teams (school_id, sport_id, team_name, slug) VALUES
  ('c1000000-0000-0000-0000-000000000004','b1000000-0000-0000-0000-000000000002','Clifton-Fine Softball','clifton-fine-softball'),
  ('c1000000-0000-0000-0000-000000000004','b1000000-0000-0000-0000-000000000001','Clifton-Fine Baseball','clifton-fine-baseball'),
  ('c1000000-0000-0000-0000-000000000004','b1000000-0000-0000-0000-000000000015','Clifton-Fine Girls Basketball','clifton-fine-girls-basketball'),
  ('c1000000-0000-0000-0000-000000000004','b1000000-0000-0000-0000-000000000014','Clifton-Fine Boys Basketball','clifton-fine-boys-basketball'),
  ('c1000000-0000-0000-0000-000000000004','b1000000-0000-0000-0000-000000000010','Clifton-Fine Girls Soccer','clifton-fine-girls-soccer'),
  ('c1000000-0000-0000-0000-000000000004','b1000000-0000-0000-0000-000000000009','Clifton-Fine Boys Soccer','clifton-fine-boys-soccer'),
  ('c1000000-0000-0000-0000-000000000004','b1000000-0000-0000-0000-000000000007','Clifton-Fine Boys Golf','clifton-fine-boys-golf');

-- COLTON-PIERREPONT (c5)
INSERT INTO teams (school_id, sport_id, team_name, slug) VALUES
  ('c1000000-0000-0000-0000-000000000005','b1000000-0000-0000-0000-000000000002','Colton-Pierrepont Softball','colton-pierrepont-softball'),
  ('c1000000-0000-0000-0000-000000000005','b1000000-0000-0000-0000-000000000001','Colton-Pierrepont Baseball','colton-pierrepont-baseball'),
  ('c1000000-0000-0000-0000-000000000005','b1000000-0000-0000-0000-000000000015','Colton-Pierrepont Girls Basketball','colton-pierrepont-girls-basketball'),
  ('c1000000-0000-0000-0000-000000000005','b1000000-0000-0000-0000-000000000014','Colton-Pierrepont Boys Basketball','colton-pierrepont-boys-basketball'),
  ('c1000000-0000-0000-0000-000000000005','b1000000-0000-0000-0000-000000000010','Colton-Pierrepont Girls Soccer','colton-pierrepont-girls-soccer'),
  ('c1000000-0000-0000-0000-000000000005','b1000000-0000-0000-0000-000000000009','Colton-Pierrepont Boys Soccer','colton-pierrepont-boys-soccer');

-- EDWARDS-KNOX (c6)
INSERT INTO teams (school_id, sport_id, team_name, slug) VALUES
  ('c1000000-0000-0000-0000-000000000006','b1000000-0000-0000-0000-000000000002','Edwards-Knox Softball','edwards-knox-softball'),
  ('c1000000-0000-0000-0000-000000000006','b1000000-0000-0000-0000-000000000001','Edwards-Knox Baseball','edwards-knox-baseball'),
  ('c1000000-0000-0000-0000-000000000006','b1000000-0000-0000-0000-000000000015','Edwards-Knox Girls Basketball','edwards-knox-girls-basketball'),
  ('c1000000-0000-0000-0000-000000000006','b1000000-0000-0000-0000-000000000014','Edwards-Knox Boys Basketball','edwards-knox-boys-basketball'),
  ('c1000000-0000-0000-0000-000000000006','b1000000-0000-0000-0000-000000000010','Edwards-Knox Girls Soccer','edwards-knox-girls-soccer'),
  ('c1000000-0000-0000-0000-000000000006','b1000000-0000-0000-0000-000000000009','Edwards-Knox Boys Soccer','edwards-knox-boys-soccer');

-- GOUVERNEUR (c7)
INSERT INTO teams (school_id, sport_id, team_name, slug) VALUES
  ('c1000000-0000-0000-0000-000000000007','b1000000-0000-0000-0000-000000000002','Gouverneur Softball','gouverneur-softball'),
  ('c1000000-0000-0000-0000-000000000007','b1000000-0000-0000-0000-000000000001','Gouverneur Baseball','gouverneur-baseball'),
  ('c1000000-0000-0000-0000-000000000007','b1000000-0000-0000-0000-000000000015','Gouverneur Girls Basketball','gouverneur-girls-basketball'),
  ('c1000000-0000-0000-0000-000000000007','b1000000-0000-0000-0000-000000000014','Gouverneur Boys Basketball','gouverneur-boys-basketball'),
  ('c1000000-0000-0000-0000-000000000007','b1000000-0000-0000-0000-000000000010','Gouverneur Girls Soccer','gouverneur-girls-soccer'),
  ('c1000000-0000-0000-0000-000000000007','b1000000-0000-0000-0000-000000000009','Gouverneur Boys Soccer','gouverneur-boys-soccer'),
  ('c1000000-0000-0000-0000-000000000007','b1000000-0000-0000-0000-000000000008','Gouverneur Football','gouverneur-football'),
  ('c1000000-0000-0000-0000-000000000007','b1000000-0000-0000-0000-000000000007','Gouverneur Boys Golf','gouverneur-boys-golf'),
  ('c1000000-0000-0000-0000-000000000007','b1000000-0000-0000-0000-000000000020','Gouverneur Girls Swimming','gouverneur-girls-swimming'),
  ('c1000000-0000-0000-0000-000000000007','b1000000-0000-0000-0000-000000000005','Gouverneur Boys Track','gouverneur-boys-track'),
  ('c1000000-0000-0000-0000-000000000007','b1000000-0000-0000-0000-000000000006','Gouverneur Girls Track','gouverneur-girls-track'),
  ('c1000000-0000-0000-0000-000000000007','b1000000-0000-0000-0000-000000000018','Gouverneur Boys Wrestling','gouverneur-boys-wrestling'),
  ('c1000000-0000-0000-0000-000000000007','b1000000-0000-0000-0000-000000000019','Gouverneur Girls Wrestling','gouverneur-girls-wrestling');

-- HAMMOND (c8)
INSERT INTO teams (school_id, sport_id, team_name, slug) VALUES
  ('c1000000-0000-0000-0000-000000000008','b1000000-0000-0000-0000-000000000002','Hammond Softball','hammond-softball'),
  ('c1000000-0000-0000-0000-000000000008','b1000000-0000-0000-0000-000000000001','Hammond Baseball','hammond-baseball'),
  ('c1000000-0000-0000-0000-000000000008','b1000000-0000-0000-0000-000000000015','Hammond Girls Basketball','hammond-girls-basketball'),
  ('c1000000-0000-0000-0000-000000000008','b1000000-0000-0000-0000-000000000014','Hammond Boys Basketball','hammond-boys-basketball'),
  ('c1000000-0000-0000-0000-000000000008','b1000000-0000-0000-0000-000000000010','Hammond Girls Soccer','hammond-girls-soccer'),
  ('c1000000-0000-0000-0000-000000000008','b1000000-0000-0000-0000-000000000009','Hammond Boys Soccer','hammond-boys-soccer');

-- HARRISVILLE (c9)
INSERT INTO teams (school_id, sport_id, team_name, slug) VALUES
  ('c1000000-0000-0000-0000-000000000009','b1000000-0000-0000-0000-000000000002','Harrisville Softball','harrisville-softball'),
  ('c1000000-0000-0000-0000-000000000009','b1000000-0000-0000-0000-000000000001','Harrisville Baseball','harrisville-baseball'),
  ('c1000000-0000-0000-0000-000000000009','b1000000-0000-0000-0000-000000000015','Harrisville Girls Basketball','harrisville-girls-basketball'),
  ('c1000000-0000-0000-0000-000000000009','b1000000-0000-0000-0000-000000000014','Harrisville Boys Basketball','harrisville-boys-basketball'),
  ('c1000000-0000-0000-0000-000000000009','b1000000-0000-0000-0000-000000000010','Harrisville Girls Soccer','harrisville-girls-soccer'),
  ('c1000000-0000-0000-0000-000000000009','b1000000-0000-0000-0000-000000000009','Harrisville Boys Soccer','harrisville-boys-soccer');

-- HERMON-DEKALB (c10)
INSERT INTO teams (school_id, sport_id, team_name, slug) VALUES
  ('c1000000-0000-0000-0000-000000000010','b1000000-0000-0000-0000-000000000002','Hermon-Dekalb Softball','hermon-dekalb-softball'),
  ('c1000000-0000-0000-0000-000000000010','b1000000-0000-0000-0000-000000000001','Hermon-Dekalb Baseball','hermon-dekalb-baseball'),
  ('c1000000-0000-0000-0000-000000000010','b1000000-0000-0000-0000-000000000015','Hermon-Dekalb Girls Basketball','hermon-dekalb-girls-basketball'),
  ('c1000000-0000-0000-0000-000000000010','b1000000-0000-0000-0000-000000000014','Hermon-Dekalb Boys Basketball','hermon-dekalb-boys-basketball'),
  ('c1000000-0000-0000-0000-000000000010','b1000000-0000-0000-0000-000000000010','Hermon-Dekalb Girls Soccer','hermon-dekalb-girls-soccer'),
  ('c1000000-0000-0000-0000-000000000010','b1000000-0000-0000-0000-000000000009','Hermon-Dekalb Boys Soccer','hermon-dekalb-boys-soccer');

-- HEUVELTON (c11)
INSERT INTO teams (school_id, sport_id, team_name, slug) VALUES
  ('c1000000-0000-0000-0000-000000000011','b1000000-0000-0000-0000-000000000002','Heuvelton Softball','heuvelton-softball'),
  ('c1000000-0000-0000-0000-000000000011','b1000000-0000-0000-0000-000000000001','Heuvelton Baseball','heuvelton-baseball'),
  ('c1000000-0000-0000-0000-000000000011','b1000000-0000-0000-0000-000000000015','Heuvelton Girls Basketball','heuvelton-girls-basketball'),
  ('c1000000-0000-0000-0000-000000000011','b1000000-0000-0000-0000-000000000014','Heuvelton Boys Basketball','heuvelton-boys-basketball'),
  ('c1000000-0000-0000-0000-000000000011','b1000000-0000-0000-0000-000000000010','Heuvelton Girls Soccer','heuvelton-girls-soccer'),
  ('c1000000-0000-0000-0000-000000000011','b1000000-0000-0000-0000-000000000009','Heuvelton Boys Soccer','heuvelton-boys-soccer');

-- LISBON (c12)
INSERT INTO teams (school_id, sport_id, team_name, slug) VALUES
  ('c1000000-0000-0000-0000-000000000012','b1000000-0000-0000-0000-000000000002','Lisbon Softball','lisbon-softball'),
  ('c1000000-0000-0000-0000-000000000012','b1000000-0000-0000-0000-000000000001','Lisbon Baseball','lisbon-baseball'),
  ('c1000000-0000-0000-0000-000000000012','b1000000-0000-0000-0000-000000000015','Lisbon Girls Basketball','lisbon-girls-basketball'),
  ('c1000000-0000-0000-0000-000000000012','b1000000-0000-0000-0000-000000000014','Lisbon Boys Basketball','lisbon-boys-basketball'),
  ('c1000000-0000-0000-0000-000000000012','b1000000-0000-0000-0000-000000000010','Lisbon Girls Soccer','lisbon-girls-soccer'),
  ('c1000000-0000-0000-0000-000000000012','b1000000-0000-0000-0000-000000000009','Lisbon Boys Soccer','lisbon-boys-soccer');

-- MADRID-WADDINGTON (c13)
INSERT INTO teams (school_id, sport_id, team_name, slug) VALUES
  ('c1000000-0000-0000-0000-000000000013','b1000000-0000-0000-0000-000000000002','Madrid-Waddington Softball','madrid-waddington-softball'),
  ('c1000000-0000-0000-0000-000000000013','b1000000-0000-0000-0000-000000000001','Madrid-Waddington Baseball','madrid-waddington-baseball'),
  ('c1000000-0000-0000-0000-000000000013','b1000000-0000-0000-0000-000000000015','Madrid-Waddington Girls Basketball','madrid-waddington-girls-basketball'),
  ('c1000000-0000-0000-0000-000000000013','b1000000-0000-0000-0000-000000000014','Madrid-Waddington Boys Basketball','madrid-waddington-boys-basketball'),
  ('c1000000-0000-0000-0000-000000000013','b1000000-0000-0000-0000-000000000010','Madrid-Waddington Girls Soccer','madrid-waddington-girls-soccer'),
  ('c1000000-0000-0000-0000-000000000013','b1000000-0000-0000-0000-000000000009','Madrid-Waddington Boys Soccer','madrid-waddington-boys-soccer'),
  ('c1000000-0000-0000-0000-000000000013','b1000000-0000-0000-0000-000000000005','Madrid-Waddington Boys Track','madrid-waddington-boys-track'),
  ('c1000000-0000-0000-0000-000000000013','b1000000-0000-0000-0000-000000000006','Madrid-Waddington Girls Track','madrid-waddington-girls-track'),
  ('c1000000-0000-0000-0000-000000000013','b1000000-0000-0000-0000-000000000007','Madrid-Waddington Boys Golf','madrid-waddington-boys-golf');

-- MALONE (c14)
INSERT INTO teams (school_id, sport_id, team_name, slug) VALUES
  ('c1000000-0000-0000-0000-000000000014','b1000000-0000-0000-0000-000000000002','Malone Softball','malone-softball'),
  ('c1000000-0000-0000-0000-000000000014','b1000000-0000-0000-0000-000000000001','Malone Baseball','malone-baseball'),
  ('c1000000-0000-0000-0000-000000000014','b1000000-0000-0000-0000-000000000015','Malone Girls Basketball','malone-girls-basketball'),
  ('c1000000-0000-0000-0000-000000000014','b1000000-0000-0000-0000-000000000014','Malone Boys Basketball','malone-boys-basketball'),
  ('c1000000-0000-0000-0000-000000000014','b1000000-0000-0000-0000-000000000010','Malone Girls Soccer','malone-girls-soccer'),
  ('c1000000-0000-0000-0000-000000000014','b1000000-0000-0000-0000-000000000009','Malone Boys Soccer','malone-boys-soccer'),
  ('c1000000-0000-0000-0000-000000000014','b1000000-0000-0000-0000-000000000008','Malone Football','malone-football'),
  ('c1000000-0000-0000-0000-000000000014','b1000000-0000-0000-0000-000000000003','Malone Boys Lacrosse','malone-boys-lacrosse'),
  ('c1000000-0000-0000-0000-000000000014','b1000000-0000-0000-0000-000000000004','Malone Girls Lacrosse','malone-girls-lacrosse'),
  ('c1000000-0000-0000-0000-000000000014','b1000000-0000-0000-0000-000000000007','Malone Boys Golf','malone-boys-golf'),
  ('c1000000-0000-0000-0000-000000000014','b1000000-0000-0000-0000-000000000016','Malone Boys Hockey','malone-boys-hockey'),
  ('c1000000-0000-0000-0000-000000000014','b1000000-0000-0000-0000-000000000005','Malone Boys Track','malone-boys-track'),
  ('c1000000-0000-0000-0000-000000000014','b1000000-0000-0000-0000-000000000006','Malone Girls Track','malone-girls-track');

-- MASSENA (c15)
INSERT INTO teams (school_id, sport_id, team_name, slug) VALUES
  ('c1000000-0000-0000-0000-000000000015','b1000000-0000-0000-0000-000000000002','Massena Softball','massena-softball'),
  ('c1000000-0000-0000-0000-000000000015','b1000000-0000-0000-0000-000000000001','Massena Baseball','massena-baseball'),
  ('c1000000-0000-0000-0000-000000000015','b1000000-0000-0000-0000-000000000015','Massena Girls Basketball','massena-girls-basketball'),
  ('c1000000-0000-0000-0000-000000000015','b1000000-0000-0000-0000-000000000014','Massena Boys Basketball','massena-boys-basketball'),
  ('c1000000-0000-0000-0000-000000000015','b1000000-0000-0000-0000-000000000010','Massena Girls Soccer','massena-girls-soccer'),
  ('c1000000-0000-0000-0000-000000000015','b1000000-0000-0000-0000-000000000009','Massena Boys Soccer','massena-boys-soccer'),
  ('c1000000-0000-0000-0000-000000000015','b1000000-0000-0000-0000-000000000008','Massena Football','massena-football'),
  ('c1000000-0000-0000-0000-000000000015','b1000000-0000-0000-0000-000000000003','Massena Boys Lacrosse','massena-boys-lacrosse'),
  ('c1000000-0000-0000-0000-000000000015','b1000000-0000-0000-0000-000000000004','Massena Girls Lacrosse','massena-girls-lacrosse'),
  ('c1000000-0000-0000-0000-000000000015','b1000000-0000-0000-0000-000000000007','Massena Boys Golf','massena-boys-golf'),
  ('c1000000-0000-0000-0000-000000000015','b1000000-0000-0000-0000-000000000016','Massena Boys Hockey','massena-boys-hockey'),
  ('c1000000-0000-0000-0000-000000000015','b1000000-0000-0000-0000-000000000017','Massena Girls Hockey','massena-girls-hockey'),
  ('c1000000-0000-0000-0000-000000000015','b1000000-0000-0000-0000-000000000005','Massena Boys Track','massena-boys-track'),
  ('c1000000-0000-0000-0000-000000000015','b1000000-0000-0000-0000-000000000006','Massena Girls Track','massena-girls-track');

-- MORRISTOWN (c16)
INSERT INTO teams (school_id, sport_id, team_name, slug) VALUES
  ('c1000000-0000-0000-0000-000000000016','b1000000-0000-0000-0000-000000000002','Morristown Softball','morristown-softball'),
  ('c1000000-0000-0000-0000-000000000016','b1000000-0000-0000-0000-000000000001','Morristown Baseball','morristown-baseball'),
  ('c1000000-0000-0000-0000-000000000016','b1000000-0000-0000-0000-000000000015','Morristown Girls Basketball','morristown-girls-basketball'),
  ('c1000000-0000-0000-0000-000000000016','b1000000-0000-0000-0000-000000000014','Morristown Boys Basketball','morristown-boys-basketball'),
  ('c1000000-0000-0000-0000-000000000016','b1000000-0000-0000-0000-000000000010','Morristown Girls Soccer','morristown-girls-soccer'),
  ('c1000000-0000-0000-0000-000000000016','b1000000-0000-0000-0000-000000000009','Morristown Boys Soccer','morristown-boys-soccer');

-- NORWOOD-NORFOLK (c17)
INSERT INTO teams (school_id, sport_id, team_name, slug) VALUES
  ('c1000000-0000-0000-0000-000000000017','b1000000-0000-0000-0000-000000000002','Norwood-Norfolk Softball','norwood-norfolk-softball'),
  ('c1000000-0000-0000-0000-000000000017','b1000000-0000-0000-0000-000000000001','Norwood-Norfolk Baseball','norwood-norfolk-baseball'),
  ('c1000000-0000-0000-0000-000000000017','b1000000-0000-0000-0000-000000000015','Norwood-Norfolk Girls Basketball','norwood-norfolk-girls-basketball'),
  ('c1000000-0000-0000-0000-000000000017','b1000000-0000-0000-0000-000000000014','Norwood-Norfolk Boys Basketball','norwood-norfolk-boys-basketball'),
  ('c1000000-0000-0000-0000-000000000017','b1000000-0000-0000-0000-000000000010','Norwood-Norfolk Girls Soccer','norwood-norfolk-girls-soccer'),
  ('c1000000-0000-0000-0000-000000000017','b1000000-0000-0000-0000-000000000009','Norwood-Norfolk Boys Soccer','norwood-norfolk-boys-soccer'),
  ('c1000000-0000-0000-0000-000000000017','b1000000-0000-0000-0000-000000000005','Norwood-Norfolk Boys Track','norwood-norfolk-boys-track'),
  ('c1000000-0000-0000-0000-000000000017','b1000000-0000-0000-0000-000000000006','Norwood-Norfolk Girls Track','norwood-norfolk-girls-track'),
  ('c1000000-0000-0000-0000-000000000017','b1000000-0000-0000-0000-000000000007','Norwood-Norfolk Boys Golf','norwood-norfolk-boys-golf');

-- OFA (c18)
INSERT INTO teams (school_id, sport_id, team_name, slug) VALUES
  ('c1000000-0000-0000-0000-000000000018','b1000000-0000-0000-0000-000000000002','OFA Softball','ofa-softball'),
  ('c1000000-0000-0000-0000-000000000018','b1000000-0000-0000-0000-000000000001','OFA Baseball','ofa-baseball'),
  ('c1000000-0000-0000-0000-000000000018','b1000000-0000-0000-0000-000000000015','OFA Girls Basketball','ofa-girls-basketball'),
  ('c1000000-0000-0000-0000-000000000018','b1000000-0000-0000-0000-000000000014','OFA Boys Basketball','ofa-boys-basketball'),
  ('c1000000-0000-0000-0000-000000000018','b1000000-0000-0000-0000-000000000010','OFA Girls Soccer','ofa-girls-soccer'),
  ('c1000000-0000-0000-0000-000000000018','b1000000-0000-0000-0000-000000000009','OFA Boys Soccer','ofa-boys-soccer'),
  ('c1000000-0000-0000-0000-000000000018','b1000000-0000-0000-0000-000000000003','OFA Boys Lacrosse','ofa-boys-lacrosse'),
  ('c1000000-0000-0000-0000-000000000018','b1000000-0000-0000-0000-000000000004','OFA Girls Lacrosse','ofa-girls-lacrosse'),
  ('c1000000-0000-0000-0000-000000000018','b1000000-0000-0000-0000-000000000008','OFA Football','ofa-football'),
  ('c1000000-0000-0000-0000-000000000018','b1000000-0000-0000-0000-000000000007','OFA Boys Golf','ofa-boys-golf'),
  ('c1000000-0000-0000-0000-000000000018','b1000000-0000-0000-0000-000000000020','OFA Girls Swimming','ofa-girls-swimming'),
  ('c1000000-0000-0000-0000-000000000018','b1000000-0000-0000-0000-000000000005','OFA Boys Track','ofa-boys-track'),
  ('c1000000-0000-0000-0000-000000000018','b1000000-0000-0000-0000-000000000006','OFA Girls Track','ofa-girls-track'),
  ('c1000000-0000-0000-0000-000000000018','b1000000-0000-0000-0000-000000000018','OFA Boys Wrestling','ofa-boys-wrestling');

-- PARISHVILLE-HOPKINTON (c19)
INSERT INTO teams (school_id, sport_id, team_name, slug) VALUES
  ('c1000000-0000-0000-0000-000000000019','b1000000-0000-0000-0000-000000000002','Parishville-Hopkinton Softball','parishville-hopkinton-softball'),
  ('c1000000-0000-0000-0000-000000000019','b1000000-0000-0000-0000-000000000001','Parishville-Hopkinton Baseball','parishville-hopkinton-baseball'),
  ('c1000000-0000-0000-0000-000000000019','b1000000-0000-0000-0000-000000000015','Parishville-Hopkinton Girls Basketball','parishville-hopkinton-girls-basketball'),
  ('c1000000-0000-0000-0000-000000000019','b1000000-0000-0000-0000-000000000014','Parishville-Hopkinton Boys Basketball','parishville-hopkinton-boys-basketball'),
  ('c1000000-0000-0000-0000-000000000019','b1000000-0000-0000-0000-000000000010','Parishville-Hopkinton Girls Soccer','parishville-hopkinton-girls-soccer'),
  ('c1000000-0000-0000-0000-000000000019','b1000000-0000-0000-0000-000000000009','Parishville-Hopkinton Boys Soccer','parishville-hopkinton-boys-soccer');

-- POTSDAM (c20)
INSERT INTO teams (school_id, sport_id, team_name, slug) VALUES
  ('c1000000-0000-0000-0000-000000000020','b1000000-0000-0000-0000-000000000002','Potsdam Softball','potsdam-softball'),
  ('c1000000-0000-0000-0000-000000000020','b1000000-0000-0000-0000-000000000001','Potsdam Baseball','potsdam-baseball'),
  ('c1000000-0000-0000-0000-000000000020','b1000000-0000-0000-0000-000000000015','Potsdam Girls Basketball','potsdam-girls-basketball'),
  ('c1000000-0000-0000-0000-000000000020','b1000000-0000-0000-0000-000000000014','Potsdam Boys Basketball','potsdam-boys-basketball'),
  ('c1000000-0000-0000-0000-000000000020','b1000000-0000-0000-0000-000000000010','Potsdam Girls Soccer','potsdam-girls-soccer'),
  ('c1000000-0000-0000-0000-000000000020','b1000000-0000-0000-0000-000000000009','Potsdam Boys Soccer','potsdam-boys-soccer'),
  ('c1000000-0000-0000-0000-000000000020','b1000000-0000-0000-0000-000000000003','Potsdam Boys Lacrosse','potsdam-boys-lacrosse'),
  ('c1000000-0000-0000-0000-000000000020','b1000000-0000-0000-0000-000000000004','Potsdam Girls Lacrosse','potsdam-girls-lacrosse'),
  ('c1000000-0000-0000-0000-000000000020','b1000000-0000-0000-0000-000000000008','Potsdam Football','potsdam-football'),
  ('c1000000-0000-0000-0000-000000000020','b1000000-0000-0000-0000-000000000007','Potsdam Boys Golf','potsdam-boys-golf'),
  ('c1000000-0000-0000-0000-000000000020','b1000000-0000-0000-0000-000000000020','Potsdam Girls Swimming','potsdam-girls-swimming'),
  ('c1000000-0000-0000-0000-000000000020','b1000000-0000-0000-0000-000000000005','Potsdam Boys Track','potsdam-boys-track'),
  ('c1000000-0000-0000-0000-000000000020','b1000000-0000-0000-0000-000000000006','Potsdam Girls Track','potsdam-girls-track'),
  ('c1000000-0000-0000-0000-000000000020','b1000000-0000-0000-0000-000000000018','Potsdam Boys Wrestling','potsdam-boys-wrestling');

-- SALMON RIVER (c21)
INSERT INTO teams (school_id, sport_id, team_name, slug) VALUES
  ('c1000000-0000-0000-0000-000000000021','b1000000-0000-0000-0000-000000000002','Salmon River Softball','salmon-river-softball'),
  ('c1000000-0000-0000-0000-000000000021','b1000000-0000-0000-0000-000000000001','Salmon River Baseball','salmon-river-baseball'),
  ('c1000000-0000-0000-0000-000000000021','b1000000-0000-0000-0000-000000000015','Salmon River Girls Basketball','salmon-river-girls-basketball'),
  ('c1000000-0000-0000-0000-000000000021','b1000000-0000-0000-0000-000000000014','Salmon River Boys Basketball','salmon-river-boys-basketball'),
  ('c1000000-0000-0000-0000-000000000021','b1000000-0000-0000-0000-000000000010','Salmon River Girls Soccer','salmon-river-girls-soccer'),
  ('c1000000-0000-0000-0000-000000000021','b1000000-0000-0000-0000-000000000009','Salmon River Boys Soccer','salmon-river-boys-soccer'),
  ('c1000000-0000-0000-0000-000000000021','b1000000-0000-0000-0000-000000000008','Salmon River Football','salmon-river-football'),
  ('c1000000-0000-0000-0000-000000000021','b1000000-0000-0000-0000-000000000007','Salmon River Boys Golf','salmon-river-boys-golf'),
  ('c1000000-0000-0000-0000-000000000021','b1000000-0000-0000-0000-000000000020','Salmon River Girls Swimming','salmon-river-girls-swimming'),
  ('c1000000-0000-0000-0000-000000000021','b1000000-0000-0000-0000-000000000005','Salmon River Boys Track','salmon-river-boys-track'),
  ('c1000000-0000-0000-0000-000000000021','b1000000-0000-0000-0000-000000000006','Salmon River Girls Track','salmon-river-girls-track'),
  ('c1000000-0000-0000-0000-000000000021','b1000000-0000-0000-0000-000000000018','Salmon River Boys Wrestling','salmon-river-boys-wrestling'),
  ('c1000000-0000-0000-0000-000000000021','b1000000-0000-0000-0000-000000000003','Salmon River Boys Lacrosse','salmon-river-boys-lacrosse'),
  ('c1000000-0000-0000-0000-000000000021','b1000000-0000-0000-0000-000000000004','Salmon River Girls Lacrosse','salmon-river-girls-lacrosse');

-- ST LAWRENCE CENTRAL (c22)
INSERT INTO teams (school_id, sport_id, team_name, slug) VALUES
  ('c1000000-0000-0000-0000-000000000022','b1000000-0000-0000-0000-000000000002','St Lawrence Central Softball','st-lawrence-central-softball'),
  ('c1000000-0000-0000-0000-000000000022','b1000000-0000-0000-0000-000000000001','St Lawrence Central Baseball','st-lawrence-central-baseball'),
  ('c1000000-0000-0000-0000-000000000022','b1000000-0000-0000-0000-000000000015','St Lawrence Central Girls Basketball','st-lawrence-central-girls-basketball'),
  ('c1000000-0000-0000-0000-000000000022','b1000000-0000-0000-0000-000000000014','St Lawrence Central Boys Basketball','st-lawrence-central-boys-basketball'),
  ('c1000000-0000-0000-0000-000000000022','b1000000-0000-0000-0000-000000000010','St Lawrence Central Girls Soccer','st-lawrence-central-girls-soccer'),
  ('c1000000-0000-0000-0000-000000000022','b1000000-0000-0000-0000-000000000009','St Lawrence Central Boys Soccer','st-lawrence-central-boys-soccer'),
  ('c1000000-0000-0000-0000-000000000022','b1000000-0000-0000-0000-000000000008','St Lawrence Central Football','st-lawrence-central-football'),
  ('c1000000-0000-0000-0000-000000000022','b1000000-0000-0000-0000-000000000007','St Lawrence Central Boys Golf','st-lawrence-central-boys-golf'),
  ('c1000000-0000-0000-0000-000000000022','b1000000-0000-0000-0000-000000000020','St Lawrence Central Girls Swimming','st-lawrence-central-girls-swimming'),
  ('c1000000-0000-0000-0000-000000000022','b1000000-0000-0000-0000-000000000005','St Lawrence Central Boys Track','st-lawrence-central-boys-track'),
  ('c1000000-0000-0000-0000-000000000022','b1000000-0000-0000-0000-000000000006','St Lawrence Central Girls Track','st-lawrence-central-girls-track'),
  ('c1000000-0000-0000-0000-000000000022','b1000000-0000-0000-0000-000000000018','St Lawrence Central Boys Wrestling','st-lawrence-central-boys-wrestling'),
  ('c1000000-0000-0000-0000-000000000022','b1000000-0000-0000-0000-000000000003','St Lawrence Central Boys Lacrosse','st-lawrence-central-boys-lacrosse'),
  ('c1000000-0000-0000-0000-000000000022','b1000000-0000-0000-0000-000000000004','St Lawrence Central Girls Lacrosse','st-lawrence-central-girls-lacrosse');

-- ST REGIS FALLS (c23)
INSERT INTO teams (school_id, sport_id, team_name, slug) VALUES
  ('c1000000-0000-0000-0000-000000000023','b1000000-0000-0000-0000-000000000002','St Regis Falls Softball','st-regis-falls-softball'),
  ('c1000000-0000-0000-0000-000000000023','b1000000-0000-0000-0000-000000000001','St Regis Falls Baseball','st-regis-falls-baseball'),
  ('c1000000-0000-0000-0000-000000000023','b1000000-0000-0000-0000-000000000015','St Regis Falls Girls Basketball','st-regis-falls-girls-basketball'),
  ('c1000000-0000-0000-0000-000000000023','b1000000-0000-0000-0000-000000000014','St Regis Falls Boys Basketball','st-regis-falls-boys-basketball'),
  ('c1000000-0000-0000-0000-000000000023','b1000000-0000-0000-0000-000000000010','St Regis Falls Girls Soccer','st-regis-falls-girls-soccer'),
  ('c1000000-0000-0000-0000-000000000023','b1000000-0000-0000-0000-000000000009','St Regis Falls Boys Soccer','st-regis-falls-boys-soccer');

-- TUPPER LAKE (c24)
INSERT INTO teams (school_id, sport_id, team_name, slug) VALUES
  ('c1000000-0000-0000-0000-000000000024','b1000000-0000-0000-0000-000000000002','Tupper Lake Softball','tupper-lake-softball'),
  ('c1000000-0000-0000-0000-000000000024','b1000000-0000-0000-0000-000000000001','Tupper Lake Baseball','tupper-lake-baseball'),
  ('c1000000-0000-0000-0000-000000000024','b1000000-0000-0000-0000-000000000015','Tupper Lake Girls Basketball','tupper-lake-girls-basketball'),
  ('c1000000-0000-0000-0000-000000000024','b1000000-0000-0000-0000-000000000014','Tupper Lake Boys Basketball','tupper-lake-boys-basketball'),
  ('c1000000-0000-0000-0000-000000000024','b1000000-0000-0000-0000-000000000010','Tupper Lake Girls Soccer','tupper-lake-girls-soccer'),
  ('c1000000-0000-0000-0000-000000000024','b1000000-0000-0000-0000-000000000009','Tupper Lake Boys Soccer','tupper-lake-boys-soccer'),
  ('c1000000-0000-0000-0000-000000000024','b1000000-0000-0000-0000-000000000008','Tupper Lake Football','tupper-lake-football'),
  ('c1000000-0000-0000-0000-000000000024','b1000000-0000-0000-0000-000000000007','Tupper Lake Boys Golf','tupper-lake-boys-golf'),
  ('c1000000-0000-0000-0000-000000000024','b1000000-0000-0000-0000-000000000020','Tupper Lake Girls Swimming','tupper-lake-girls-swimming'),
  ('c1000000-0000-0000-0000-000000000024','b1000000-0000-0000-0000-000000000005','Tupper Lake Boys Track','tupper-lake-boys-track'),
  ('c1000000-0000-0000-0000-000000000024','b1000000-0000-0000-0000-000000000006','Tupper Lake Girls Track','tupper-lake-girls-track');

-- ============================================================
-- TEAM_SEASONS for Spring 2026 (active season)
-- Each team that plays in Spring gets activated
-- Spring sports: Baseball, Softball, Boys/Girls Lacrosse, Track, Golf
-- ============================================================
-- This bulk-inserts team_seasons for all Spring 2026 teams
INSERT INTO team_seasons (team_id, season_id, class, division, active_for_season)
SELECT
  t.id,
  'a1000000-0000-0000-0000-000000000001',
  CASE s.alias
    WHEN 'BM' THEN 'C' WHEN 'CANTON' THEN 'B' WHEN 'CHAT' THEN 'D'
    WHEN 'CF' THEN 'D' WHEN 'CP' THEN 'D' WHEN 'EK' THEN 'D'
    WHEN 'GOUV' THEN 'A' WHEN 'HAMMOND' THEN 'D' WHEN 'Harrisville' THEN 'D'
    WHEN 'HD' THEN 'D' WHEN 'HCS' THEN 'D' WHEN 'LCS' THEN 'C'
    WHEN 'MW' THEN 'D' WHEN 'Malone' THEN 'A' WHEN 'Massena' THEN 'A'
    WHEN 'Morristown' THEN 'D' WHEN 'NN' THEN 'B' WHEN 'OFA' THEN 'B'
    WHEN 'PH' THEN 'D' WHEN 'Potsdam' THEN 'B' WHEN 'SR' THEN 'B'
    WHEN 'SLC' THEN 'C' WHEN 'SRF' THEN 'D' WHEN 'TL' THEN 'C'
    ELSE 'C'
  END,
  CASE s.alias
    WHEN 'BM' THEN 'East' WHEN 'CHAT' THEN 'East' WHEN 'CF' THEN 'East'
    WHEN 'CP' THEN 'East' WHEN 'CANTON' THEN 'Central' WHEN 'GOUV' THEN 'Central'
    WHEN 'EK' THEN 'West' WHEN 'HAMMOND' THEN 'West' WHEN 'Harrisville' THEN 'West'
    WHEN 'HD' THEN 'West' WHEN 'HCS' THEN 'West' WHEN 'LCS' THEN 'West'
    WHEN 'MW' THEN 'East' WHEN 'Malone' THEN 'Central' WHEN 'Massena' THEN 'Central'
    WHEN 'Morristown' THEN 'West' WHEN 'NN' THEN 'East' WHEN 'OFA' THEN 'Central'
    WHEN 'PH' THEN 'East' WHEN 'Potsdam' THEN 'Central' WHEN 'SR' THEN 'Central'
    WHEN 'SLC' THEN 'East' WHEN 'SRF' THEN 'East' WHEN 'TL' THEN 'East'
    ELSE 'Central'
  END,
  true
FROM teams t
JOIN schools s ON t.school_id = s.id
JOIN sports sp ON t.sport_id = sp.id
WHERE sp.season_type = 'Spring';

-- TEAM_SEASONS for Fall 2026 (not active yet)
INSERT INTO team_seasons (team_id, season_id, class, division, active_for_season)
SELECT
  t.id,
  'a1000000-0000-0000-0000-000000000002',
  CASE s.alias
    WHEN 'BM' THEN 'C' WHEN 'CANTON' THEN 'B' WHEN 'CHAT' THEN 'D'
    WHEN 'CF' THEN 'D' WHEN 'CP' THEN 'D' WHEN 'EK' THEN 'D'
    WHEN 'GOUV' THEN 'A' WHEN 'HAMMOND' THEN 'D' WHEN 'Harrisville' THEN 'D'
    WHEN 'HD' THEN 'D' WHEN 'HCS' THEN 'D' WHEN 'LCS' THEN 'C'
    WHEN 'MW' THEN 'D' WHEN 'Malone' THEN 'A' WHEN 'Massena' THEN 'A'
    WHEN 'Morristown' THEN 'D' WHEN 'NN' THEN 'B' WHEN 'OFA' THEN 'B'
    WHEN 'PH' THEN 'D' WHEN 'Potsdam' THEN 'B' WHEN 'SR' THEN 'B'
    WHEN 'SLC' THEN 'C' WHEN 'SRF' THEN 'D' WHEN 'TL' THEN 'C'
    ELSE 'C'
  END,
  CASE s.alias
    WHEN 'BM' THEN 'East' WHEN 'CHAT' THEN 'East' WHEN 'CF' THEN 'East'
    WHEN 'CP' THEN 'East' WHEN 'CANTON' THEN 'Central' WHEN 'GOUV' THEN 'Central'
    WHEN 'EK' THEN 'West' WHEN 'HAMMOND' THEN 'West' WHEN 'Harrisville' THEN 'West'
    WHEN 'HD' THEN 'West' WHEN 'HCS' THEN 'West' WHEN 'LCS' THEN 'West'
    WHEN 'MW' THEN 'East' WHEN 'Malone' THEN 'Central' WHEN 'Massena' THEN 'Central'
    WHEN 'Morristown' THEN 'West' WHEN 'NN' THEN 'East' WHEN 'OFA' THEN 'Central'
    WHEN 'PH' THEN 'East' WHEN 'Potsdam' THEN 'Central' WHEN 'SR' THEN 'Central'
    WHEN 'SLC' THEN 'East' WHEN 'SRF' THEN 'East' WHEN 'TL' THEN 'East'
    ELSE 'Central'
  END,
  true
FROM teams t
JOIN schools s ON t.school_id = s.id
JOIN sports sp ON t.sport_id = sp.id
WHERE sp.season_type = 'Fall';

-- TEAM_SEASONS for Winter 2026
INSERT INTO team_seasons (team_id, season_id, class, division, active_for_season)
SELECT
  t.id,
  'a1000000-0000-0000-0000-000000000003',
  CASE s.alias
    WHEN 'BM' THEN 'C' WHEN 'CANTON' THEN 'B' WHEN 'CHAT' THEN 'D'
    WHEN 'CF' THEN 'D' WHEN 'CP' THEN 'D' WHEN 'EK' THEN 'D'
    WHEN 'GOUV' THEN 'A' WHEN 'HAMMOND' THEN 'D' WHEN 'Harrisville' THEN 'D'
    WHEN 'HD' THEN 'D' WHEN 'HCS' THEN 'D' WHEN 'LCS' THEN 'C'
    WHEN 'MW' THEN 'D' WHEN 'Malone' THEN 'A' WHEN 'Massena' THEN 'A'
    WHEN 'Morristown' THEN 'D' WHEN 'NN' THEN 'B' WHEN 'OFA' THEN 'B'
    WHEN 'PH' THEN 'D' WHEN 'Potsdam' THEN 'B' WHEN 'SR' THEN 'B'
    WHEN 'SLC' THEN 'C' WHEN 'SRF' THEN 'D' WHEN 'TL' THEN 'C'
    ELSE 'C'
  END,
  CASE s.alias
    WHEN 'BM' THEN 'East' WHEN 'CHAT' THEN 'East' WHEN 'CF' THEN 'East'
    WHEN 'CP' THEN 'East' WHEN 'CANTON' THEN 'Central' WHEN 'GOUV' THEN 'Central'
    WHEN 'EK' THEN 'West' WHEN 'HAMMOND' THEN 'West' WHEN 'Harrisville' THEN 'West'
    WHEN 'HD' THEN 'West' WHEN 'HCS' THEN 'West' WHEN 'LCS' THEN 'West'
    WHEN 'MW' THEN 'East' WHEN 'Malone' THEN 'Central' WHEN 'Massena' THEN 'Central'
    WHEN 'Morristown' THEN 'West' WHEN 'NN' THEN 'East' WHEN 'OFA' THEN 'Central'
    WHEN 'PH' THEN 'East' WHEN 'Potsdam' THEN 'Central' WHEN 'SR' THEN 'Central'
    WHEN 'SLC' THEN 'East' WHEN 'SRF' THEN 'East' WHEN 'TL' THEN 'East'
    ELSE 'Central'
  END,
  true
FROM teams t
JOIN schools s ON t.school_id = s.id
JOIN sports sp ON t.sport_id = sp.id
WHERE sp.season_type = 'Winter';

-- ============================================================
-- DEFAULT SITE SETTINGS
-- ============================================================
INSERT INTO site_settings (key, value, description) VALUES
  ('site_title', 'Section X Scoreboard', 'Main site title'),
  ('site_tagline', 'North Country High School Sports Scores & Schedules', 'SEO description'),
  ('scores_email', 'scores@sectionxscoreboard.com', 'Email for score submissions'),
  ('submission_notice', 'Know a score? Submit it here. All submissions are reviewed before publishing.', 'Public submission notice'),
  ('maintenance_mode', 'false', 'Set to true to enable maintenance page'),
  ('alert_banner', '', 'Optional sitewide alert banner (blank to hide)');

-- ============================================================
-- EXTERNAL OPPONENTS (common non-Section X opponents)
-- ============================================================
INSERT INTO external_opponents (name, slug, city, state, is_section_x) VALUES
  ('Lyme Central',         'lyme-central',         'Chaumont',    'NY', false),
  ('Peru Central',         'peru-central',          'Peru',        'NY', false),
  ('Watertown',            'watertown',             'Watertown',   'NY', false),
  ('Beekmantown',          'beekmantown',           'West Chazy',  'NY', false),
  ('LaFargeville',         'lafargeville',          'LaFargeville','NY', false),
  ('Carthage',             'carthage',              'Carthage',    'NY', false),
  ('Unatego',              'unatego',               'Otego',       'NY', false),
  ('Saranac Central',      'saranac-central',       'Dannemora',   'NY', false),
  ('Plattsburgh',          'plattsburgh',           'Plattsburgh', 'NY', false),
  ('Ticonderoga',          'ticonderoga',           'Ticonderoga', 'NY', false),
  ('Lake Placid',          'lake-placid',           'Lake Placid', 'NY', false),
  ('Keene',                'keene',                 'Keene Valley','NY', false);
