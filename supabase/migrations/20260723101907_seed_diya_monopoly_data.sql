/*
# Seed Diya Monopoly Initial Data

1. Inserts the 8 named stations with phrases, location hints, reward ranges.
2. Builds the board tile sequence (start + 8 stations + 5 special tiles = 14 tiles loop).
3. Inserts default shop items with prices and effect types.
4. Inserts a default admin account (username: admin, pin: admin123).
5. Inserts 8 host accounts, one per station (pin: host123 for all, for demo).

Notes:
- Uses ON CONFLICT DO NOTHING via a guard check on station names to stay idempotent.
- Stations are inserted first, then tiles reference them by name via a subquery.
*/

-- 8 stations
INSERT INTO stations (name, phrase, description, location_hint, min_reward, max_reward, icon) VALUES
('Diya Memory', '🪔 Your memory holds the light — find the matching flames at Diya Memory!', 'Memory-matching game with diya/rangoli-themed cards.', 'Near the school library', 20, 40, 'brain'),
('Mirror Message', '🪞 Not all is as it seems... decode the truth at Mirror Message!', 'Decode a mirror-written message.', 'Science Block, Room 12', 25, 45, 'mirror'),
('Piece Together The Light', '✨ Gather the scattered pieces of light at Piece Together The Light!', 'Jigsaw puzzle of a diya/rangoli image.', 'Art Room', 30, 50, 'puzzle'),
('Festival Quest', '📜 Test your festival wisdom on a quest at Festival Quest!', 'Deepavali trivia / scavenger-hunt style quiz.', 'Main Hall, Stage Left', 20, 60, 'scroll'),
('Deepavali Fashion', '👗 Dress the part and race the clock at Deepavali Fashion!', 'Relay dressing in traditional attire pieces.', 'Music Room', 25, 45, 'shirt'),
('Laser Maze', '🔴 Weave through the beams of light at Laser Maze!', 'Physical laser-string obstacle course.', 'Gymnasium', 35, 60, 'zap'),
('Marble Maze', '⚪ Steady hands guide the marble home at Marble Maze!', 'Tilt-board marble maze challenge.', 'Corridor outside Cafeteria', 20, 40, 'circle'),
('Rangoli Relay', '🎨 Race to paint the ground in color at Rangoli Relay!', 'Relay race building a rangoli pattern.', 'Courtyard', 30, 55, 'palette')
ON CONFLICT DO NOTHING;

-- Default admin
INSERT INTO admins (username, pin) VALUES ('admin', 'admin123')
ON CONFLICT (username) DO NOTHING;

-- 8 hosts, one per station (pin host123)
INSERT INTO hosts (name, station_id, pin)
SELECT 'Host of ' || s.name, s.id, 'host123'
FROM stations s
WHERE NOT EXISTS (SELECT 1 FROM hosts h WHERE h.station_id = s.id);

-- Board tile sequence: start, station, chest, station, surprise, station, rest, station, break, station, chest, station, surprise, station
-- 14 tiles total. tile_order 0..13
INSERT INTO tiles (tile_order, type, station_id)
SELECT t.ord, t.typ, t.sid FROM (
  SELECT 0 AS ord, 'start' AS typ, NULL::uuid AS sid
  UNION ALL SELECT 1, 'station', (SELECT id FROM stations WHERE name='Diya Memory')
  UNION ALL SELECT 2, 'chest', NULL::uuid
  UNION ALL SELECT 3, 'station', (SELECT id FROM stations WHERE name='Mirror Message')
  UNION ALL SELECT 4, 'surprise', NULL::uuid
  UNION ALL SELECT 5, 'station', (SELECT id FROM stations WHERE name='Piece Together The Light')
  UNION ALL SELECT 6, 'rest', NULL::uuid
  UNION ALL SELECT 7, 'station', (SELECT id FROM stations WHERE name='Festival Quest')
  UNION ALL SELECT 8, 'break', NULL::uuid
  UNION ALL SELECT 9, 'station', (SELECT id FROM stations WHERE name='Deepavali Fashion')
  UNION ALL SELECT 10, 'chest', NULL::uuid
  UNION ALL SELECT 11, 'station', (SELECT id FROM stations WHERE name='Laser Maze')
  UNION ALL SELECT 12, 'surprise', NULL::uuid
  UNION ALL SELECT 13, 'station', (SELECT id FROM stations WHERE name='Marble Maze')
) t
WHERE NOT EXISTS (SELECT 1 FROM tiles);

-- Default shop items
INSERT INTO shop_items (name, description, price, effect_type, icon) VALUES
('Lucky Re-Roll', 'Reroll the dice once if you don''t like your result.', 30, 'reroll', 'dice'),
('Double Diyas', 'Doubles the reward from your next station visit.', 60, 'double', 'flame'),
('Diya Shield', 'Blocks the next negative effect from a Diya Chest or Festival Surprise card.', 50, 'shield', 'shield'),
('Teleport Token', 'Choose which station you move to next, instead of rolling.', 90, 'teleport', 'map'),
('Skip Rangoli Rest', 'Auto-clears a "miss a turn" penalty if drawn.', 40, 'skiprest', 'wind'),
('Gift of Light', 'Send a small Diya gift to another team (goodwill mechanic).', 10, 'gift', 'gift'),
('Extra Turn', 'Roll again immediately after your current turn resolves, without visiting a station in between.', 80, 'extraturn', 'repeat'),
('Rangoli Blessing', 'Cosmetic: unlocks a special profile badge for your team. Pure fun, no gameplay effect.', 25, 'cosmetic', 'star')
ON CONFLICT DO NOTHING;
