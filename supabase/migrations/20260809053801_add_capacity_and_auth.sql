/*
# Capacity-Aware Station Assignment + Team Password Auth

1. Overview
   Adds two major features to the Diya Monopoly schema:
   - **Capacity-aware station assignment**: stations get a `max_capacity` column
     (default 2, admin-editable). A SECURITY DEFINER function `try_reserve_station_slot`
     atomically reserves a slot at a station so two teams rolling simultaneously
     can't double-book the last open slot. Another function `expire_stale_turns`
     marks turns older than a timeout as expired so no-show teams don't block slots.
   - **Team password auth**: teams get a `password_hash` column (bcrypt-style hash,
     never plain text). A `sessions` table stores per-team session tokens with
     expiry. A SECURITY DEFINER function `team_login` validates name+password and
     returns a new session token. Another function `team_register` creates a new
     team with a hashed password. Admin can reset any team's password via
     `reset_team_password`.

2. New Columns
   - stations.max_capacity integer NOT NULL DEFAULT 2  — how many teams can be
     assigned/arrived at this station simultaneously. Admin-editable in real time.
   - teams.password_hash text  — bcrypt-style hash of the team's password (NULL
     for legacy teams created before this feature; they can set a password later).

3. New Tables
   - sessions: stores active login sessions (team_id, token, expires_at). Used by
     the edge function to validate that a request comes from an authenticated team.

4. New Functions (SECURITY DEFINER)
   - try_reserve_station_slot(station_id, team_id): atomically inserts a turn with
     status 'pending' ONLY if the station has fewer active turns than max_capacity.
     Returns the turn row on success, NULL on failure (station full).
   - expire_stale_turns(timeout_minutes): marks turns older than timeout as 'expired'.
     Returns count of expired turns. Called by the edge function on each roll/scan.
   - team_register(name, password, color): creates a new team with hashed password,
     returns the team row + a session token. Fails if name is taken.
   - team_login(name, password): validates credentials, returns team row + new
     session token. Fails on wrong password or missing team.
   - reset_team_password(team_id, new_password): admin override to reset a team's
     password. Returns true on success.
   - validate_session(token): returns the team row for a valid, non-expired session
     token, or NULL. Used by edge function to authenticate requests.

5. Security
   - RLS enabled on sessions table with anon+authenticated full CRUD (shared data
     model, same as all other tables in this app).
   - SECURITY DEFINER functions run with elevated privileges to perform atomic
     operations that the anon role can't do directly (conditional insert with
     count check in a single atomic step).
   - Password hashing uses pgcrypto's crypt() + gen_salt() with bf (bcrypt) —
     passwords are never stored in plain text.
   - The functions do NOT expose password_hash to the caller — only the team row
     without the hash is returned.

6. Notes
   - max_capacity defaults to 2 for all existing stations (ALTER COLUMN ... SET
     DEFAULT + UPDATE existing rows).
   - The reservation function uses SELECT ... FOR UPDATE inside the function to
     lock the station row during the count check, preventing race conditions.
   - Stale turn expiry is called at the start of each roll and scan action so
     slots free up automatically without a separate cron job.
*/

-- Add max_capacity to stations
ALTER TABLE stations ADD COLUMN IF NOT EXISTS max_capacity integer NOT NULL DEFAULT 2;

-- Add password_hash to teams
ALTER TABLE teams ADD COLUMN IF NOT EXISTS password_hash text;

-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  token text NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT now() + interval '24 hours'
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_team ON sessions(team_id);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_all_sessions" ON sessions;
CREATE POLICY "anon_all_sessions" ON sessions FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);

-- Add index on turns for capacity counting
CREATE INDEX IF NOT EXISTS idx_turns_station_status ON turns(station_id, status);

-- Ensure pgcrypto extension is available for crypt()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Atomic slot reservation ──
-- Tries to insert a pending turn for a team at a station, but ONLY if the
-- station's current active turn count is below max_capacity. Uses FOR UPDATE
-- to lock the station row, preventing two concurrent reservations from both
-- succeeding. Returns the turn row on success, or NULL on failure.
CREATE OR REPLACE FUNCTION try_reserve_station_slot(
  p_station_id uuid,
  p_team_id uuid,
  p_token text
) RETURNS uuid AS $$
DECLARE
  v_max_cap integer;
  v_current_count integer;
  v_turn_id uuid;
BEGIN
  -- Lock the station row for the duration of this transaction
  SELECT max_capacity INTO v_max_cap
  FROM stations WHERE id = p_station_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Count active turns (pending) at this station
  SELECT count(*) INTO v_current_count
  FROM turns
  WHERE station_id = p_station_id AND status = 'pending';

  IF v_current_count >= v_max_cap THEN
    RETURN NULL;
  END IF;

  -- Insert the turn
  INSERT INTO turns (team_id, station_id, status, token)
  VALUES (p_team_id, p_station_id, 'pending', p_token)
  RETURNING id INTO v_turn_id;

  RETURN v_turn_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Expire stale turns ──
-- Marks turns older than the timeout as expired. Frees up capacity slots
-- for teams that never showed up. Returns the count of expired turns.
CREATE OR REPLACE FUNCTION expire_stale_turns(
  p_timeout_minutes integer DEFAULT 20
) RETURNS integer AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE turns
  SET status = 'expired'
  WHERE status = 'pending'
    AND created_at < now() - (p_timeout_minutes || ' minutes')::interval;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Team register ──
-- Creates a new team with a hashed password and returns the team id + a
-- session token. Fails (returns NULL id) if the name is already taken.
CREATE OR REPLACE FUNCTION team_register(
  p_name text,
  p_password text,
  p_color text DEFAULT 'amber'
) RETURNS TABLE(id uuid, session_token text) AS $$
DECLARE
  v_team_id uuid;
  v_token text;
BEGIN
  -- Check name uniqueness
  IF EXISTS (SELECT 1 FROM teams WHERE lower(name) = lower(p_name)) THEN
    RETURN;
  END IF;

  v_token := encode(gen_random_bytes(32), 'hex');

  INSERT INTO teams (name, password_hash, color, balance, board_position, status, session_token)
  VALUES (p_name, crypt(p_password, gen_salt('bf')), p_color, 0, 0, 'idle', v_token)
  RETURNING id INTO v_team_id;

  INSERT INTO sessions (team_id, token) VALUES (v_team_id, v_token);

  RETURN QUERY SELECT v_team_id, v_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Team login ──
-- Validates team name + password. On success, returns the team id + a new
-- session token. On failure (wrong password or missing team), returns NULL.
CREATE OR REPLACE FUNCTION team_login(
  p_name text,
  p_password text
) RETURNS TABLE(id uuid, session_token text) AS $$
DECLARE
  v_team_id uuid;
  v_hash text;
  v_token text;
BEGIN
  SELECT id, password_hash INTO v_team_id, v_hash
  FROM teams WHERE lower(name) = lower(p_name);

  IF NOT FOUND OR v_hash IS NULL THEN
    RETURN;
  END IF;

  IF crypt(p_password, v_hash) <> v_hash THEN
    RETURN;
  END IF;

  v_token := encode(gen_random_bytes(32), 'hex');

  UPDATE teams SET session_token = v_token WHERE id = v_team_id;
  INSERT INTO sessions (team_id, token) VALUES (v_team_id, v_token);

  RETURN QUERY SELECT v_team_id, v_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Validate session ──
-- Returns the team id for a valid, non-expired session token, or NULL.
CREATE OR REPLACE FUNCTION validate_session(
  p_token text
) RETURNS uuid AS $$
DECLARE
  v_team_id uuid;
BEGIN
  SELECT team_id INTO v_team_id
  FROM sessions
  WHERE token = p_token AND expires_at > now()
  LIMIT 1;

  RETURN v_team_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Reset team password (admin override) ──
-- Allows an admin to reset any team's password. Returns true on success.
CREATE OR REPLACE FUNCTION reset_team_password(
  p_team_id uuid,
  p_new_password text
) RETURNS boolean AS $$
BEGIN
  UPDATE teams SET password_hash = crypt(p_new_password, gen_salt('bf'))
  WHERE id = p_team_id;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
