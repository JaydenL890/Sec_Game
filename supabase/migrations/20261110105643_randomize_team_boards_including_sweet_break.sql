/*
# Randomize every team's board, including Sweet Break

1. What changes
- Every team's board is now laid out at random: the 8 stations and the Sweet Break can appear in any of the 9 spaces after Diwali Gate.
- Diwali Gate always stays as the first space, so lap bonuses and passing the gate keep working.
- Every team that already joined gets a fresh random board.

2. Functions
- generate_team_board is replaced with the new randomized layout. It keeps the same permissions as before.

3. Data
- Existing per-team board rows are removed and regenerated for every team.
- Team balances, scores, positions, and station visit history are not changed.

4. Security
- No policies or grants change.
*/

CREATE OR REPLACE FUNCTION generate_team_board(p_team_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF EXISTS (SELECT 1 FROM team_tiles WHERE team_id = p_team_id) THEN
    RETURN;
  END IF;

  INSERT INTO team_tiles (team_id, tile_order, type, station_id)
  SELECT p_team_id, tile_order, type, NULL
  FROM tiles
  WHERE tile_order = 0;

  INSERT INTO team_tiles (team_id, tile_order, type, station_id)
  WITH positions AS (
    SELECT tile_order, row_number() OVER (ORDER BY tile_order) AS rn
    FROM tiles
    WHERE tile_order > 0
  ),
  kinds AS (
    SELECT type, row_number() OVER (ORDER BY random()) AS rn
    FROM tiles
    WHERE tile_order > 0
  ),
  placed AS (
    SELECT positions.tile_order, kinds.type
    FROM positions
    JOIN kinds USING (rn)
  ),
  station_slots AS (
    SELECT tile_order, row_number() OVER (ORDER BY tile_order) AS srn
    FROM placed
    WHERE type = 'station'
  ),
  station_pick AS (
    SELECT id, row_number() OVER (ORDER BY random()) AS srn
    FROM stations
  )
  SELECT p_team_id, placed.tile_order, placed.type,
         CASE WHEN placed.type = 'station' THEN station_pick.id END
  FROM placed
  LEFT JOIN station_slots ON station_slots.tile_order = placed.tile_order
  LEFT JOIN station_pick ON station_pick.srn = station_slots.srn;
END;
$function$;

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
