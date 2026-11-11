/*
# Add Sweet Break as a station with live occupancy

1. New station
- `Sweet Break` is added to the stations list with the same default capacity (2 teams at once) as the other stations.
- Its location and phrase are blank so you can fill them in from the Stations page.

2. Board
- The Sweet Break space on the board is now a station space, so it is counted in live occupancy like the others.
- Every team's board is regenerated, so the 9 stations (8 existing plus Sweet Break) are placed randomly across the 9 spaces after Diwali Gate.

3. Notes
- Team balances, scores, positions, and past station visits are not changed.
- Sweet Break still needs a host login before it can process teams. That is created separately.

4. Security
- No policies or grants change.
*/

INSERT INTO stations (name, description, icon)
SELECT 'Sweet Break', 'A peaceful stop for a sweet treat. Take a breath!', 'sweet'
WHERE NOT EXISTS (SELECT 1 FROM stations WHERE name = 'Sweet Break');

UPDATE tiles
SET type = 'station',
    station_id = (SELECT id FROM stations WHERE name = 'Sweet Break')
WHERE type = 'break';

DELETE FROM team_tiles;

DO $$
DECLARE
  v_team RECORD;
BEGIN
  FOR v_team IN SELECT id FROM teams LOOP
    PERFORM generate_team_board(v_team.id);
  END LOOP;
END;
$$;
