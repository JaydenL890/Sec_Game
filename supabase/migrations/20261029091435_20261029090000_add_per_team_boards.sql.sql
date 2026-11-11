/*
# Per-Team Board Layouts + Strict Station Capacity Exclusion

## Overview
Two changes:
1. **Per-team board layouts**: Each team gets their own shuffled sequence of
   stations on the board. The special tiles (start, chest, surprise, rest, break)
   stay in the same positions, but which station appears at each station-tile
   position is randomly shuffled per team. This means teams visit stations in
   different orders, preventing crowding at the same station.
2. **Strict capacity exclusion**: When a team rolls to a station tile, if that
   station is at full capacity, they are redirected to another available station.
   If ALL stations are full, they receive a consolation Diya bonus instead of
   being sent to any station.

## New Tables
- `team_tiles`: Per-team board layout. Same structure as `tiles` but scoped to
  a team. Columns: id, team_id, tile_order, type, station_id, created_at.

## New Functions (SECURITY DEFINER)
- `generate_team_board(p_team_id)`: Creates a shuffled board for a team.
  Takes the base tile structure from `tiles`, shuffles the station IDs,
  and assigns them to station-tile positions in randomized order.

## Security
- RLS enabled on `team_tiles` with anon+authenticated full CRUD (shared data).
- `generate_team_board` is SECURITY DEFINER, executable by authenticated + service_role only.

## Notes
- Existing teams get a board generated via a backfill step.
*/

CREATE TABLE IF NOT EXISTS team_tiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  tile_order integer NOT NULL,
  type text NOT NULL,
  station_id uuid REFERENCES stations(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(team_id, tile_order)
);

CREATE INDEX IF NOT EXISTS idx_team_tiles_team ON team_tiles(team_id);
CREATE INDEX IF NOT EXISTS idx_team_tiles_order ON team_tiles(team_id, tile_order);

ALTER TABLE team_tiles ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON team_tiles TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON team_tiles TO service_role;

DROP POLICY IF EXISTS "anon_all_team_tiles" ON team_tiles;
CREATE POLICY "anon_all_team_tiles" ON team_tiles FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);

-- ── generate_team_board function ──
-- Creates a shuffled board for a team based on the base tiles template.
-- Station IDs are shuffled and assigned to station-tile positions in random order.
-- Idempotent: if the team already has team_tiles, it does nothing.
CREATE OR REPLACE FUNCTION generate_team_board(p_team_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_station_ids uuid[];
  v_shuffled_stations uuid[];
  v_station_idx integer := 1;
  v_tile RECORD;
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM team_tiles WHERE team_id = p_team_id;
  IF v_count > 0 THEN RETURN; END IF;

  SELECT array_agg(id ORDER BY name) INTO v_station_ids FROM stations;

  WITH shuffled AS (
    SELECT id FROM unnest(v_station_ids) AS t(id) ORDER BY random()
  )
  SELECT array_agg(id) INTO v_shuffled_stations FROM shuffled;

  FOR v_tile IN SELECT tile_order, type, station_id FROM tiles ORDER BY tile_order LOOP
    IF v_tile.type = 'station' THEN
      INSERT INTO team_tiles (team_id, tile_order, type, station_id)
      VALUES (p_team_id, v_tile.tile_order, v_tile.type, v_shuffled_stations[v_station_idx]);
      v_station_idx := v_station_idx + 1;
    ELSE
      INSERT INTO team_tiles (team_id, tile_order, type, station_id)
      VALUES (p_team_id, v_tile.tile_order, v_tile.type, NULL);
    END IF;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION generate_team_board(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION generate_team_board(uuid) TO authenticated, service_role;

-- ── Backfill: generate boards for existing teams ──
DO $$
DECLARE
  v_team RECORD;
BEGIN
  FOR v_team IN SELECT id FROM teams LOOP
    PERFORM generate_team_board(v_team.id);
  END LOOP;
END;
$$;
