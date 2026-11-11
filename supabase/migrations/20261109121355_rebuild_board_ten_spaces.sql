/*
# Rebuild the board to 10 spaces

1. What changes
- The Diya Chest, Festival Surprise, and Rangoli Rest spaces are removed from the board.
- The board is now 10 spaces: Diwali Gate, all 8 stations, and Sweet Break.
- Every team's personal board is regenerated from the new layout, so station order is reshuffled per team.
- Teams standing on a removed space move to the next space on the new board.

2. Position mapping (old space -> new space)
- 0 Diwali Gate -> 0
- 1 station -> 1
- 2 Diya Chest (removed) -> 2 (next space)
- 3 station -> 2
- 4 Festival Surprise (removed) -> 3 (next space)
- 5 station -> 3
- 6 Rangoli Rest (removed) -> 4 (next space)
- 7 station -> 4
- 8 Sweet Break -> 5
- 9 station -> 6
- 10 Diya Chest (removed) -> 7 (next space)
- 11 station -> 7
- 12 Festival Surprise (removed) -> 8 (next space)
- 13 station -> 8

3. Security
- No policies or grants change. Only board configuration rows are rewritten.

4. Notes
- Base board rows are rebuilt from scratch (they are configuration, not player data).
- Team board rows are derived data and are regenerated for every team.
- Team scores, balances, and station visit history are not touched.
*/

DELETE FROM team_tiles;

DELETE FROM tiles;

INSERT INTO tiles (tile_order, type, station_id) VALUES
  (0, 'start', NULL),
  (1, 'station', (SELECT id FROM stations WHERE name = 'Diya Memory')),
  (2, 'station', (SELECT id FROM stations WHERE name = 'Mirror Message')),
  (3, 'station', (SELECT id FROM stations WHERE name = 'Piece Together The Light')),
  (4, 'station', (SELECT id FROM stations WHERE name = 'Festival Quest')),
  (5, 'break', NULL),
  (6, 'station', (SELECT id FROM stations WHERE name = 'Deepavali Fashion')),
  (7, 'station', (SELECT id FROM stations WHERE name = 'Laser Maze')),
  (8, 'station', (SELECT id FROM stations WHERE name = 'Marble Maze')),
  (9, 'station', (SELECT id FROM stations WHERE name = 'Rangoli Relay'));

UPDATE teams SET board_position = CASE board_position
  WHEN 0 THEN 0 WHEN 1 THEN 1 WHEN 2 THEN 2 WHEN 3 THEN 2 WHEN 4 THEN 3
  WHEN 5 THEN 3 WHEN 6 THEN 4 WHEN 7 THEN 4 WHEN 8 THEN 5 WHEN 9 THEN 6
  WHEN 10 THEN 7 WHEN 11 THEN 7 WHEN 12 THEN 8 WHEN 13 THEN 8
  ELSE board_position END;

DO $$
DECLARE
  v_team RECORD;
BEGIN
  FOR v_team IN SELECT id FROM teams LOOP
    PERFORM generate_team_board(v_team.id);
  END LOOP;
END;
$$;
