/*
# Role-Based Authentication for Hosts and Admins

1. Overview
   Extends the existing team-only auth to support three distinct login roles:
   - Team/Player (already working via team_register/team_login)
   - Station Host (new: host_login)
   - Game Admin (new: admin_login)
   Each role gets its own login function and session type, so sessions are
   role-scoped — a team session token can't be used to access host or admin
   endpoints, and vice versa.

2. Schema Changes
   - sessions table: add `owner_type` (text, 'team'|'host'|'admin') and
     `owner_id` (uuid) columns. `team_id` is kept for backward compat but
     new sessions use owner_type/owner_id. Backfill existing rows to
     owner_type='team', owner_id=team_id.
   - hosts table: add `password_hash` (text) column for bcrypt-style hashed
     passwords. The existing `pin` column is kept for backward compat —
     existing hosts with a pin but no password_hash can still log in via
     the legacy pin flow. New logins check password_hash first, fall back
     to pin.
   - admins table: add `password_hash` (text) column. Same fallback logic
     as hosts — existing admins with a pin can still use it, but hashed
     passwords are preferred.

3. New Functions (SECURITY DEFINER)
   - host_login(p_name, p_password): validates host credentials against
     either password_hash (bcrypt) or the legacy pin column. On success
     returns host id + station id + a new session token. On failure
     returns NULL.
   - admin_login(p_username, p_password): validates admin credentials
     against either password_hash (bcrypt) or the legacy pin column. On
     success returns admin id + a new session token. On failure returns
     NULL.
   - validate_session_typed(p_token, p_owner_type): like validate_session
     but also checks that the session's owner_type matches the requested
     type. Returns the owner_id (uuid) or NULL.

4. Security
   - All functions are SECURITY DEFINER so they can read password_hash
     (which the anon role can't access directly once we restrict it).
   - Sessions remain shared (anon+authenticated full CRUD) since this is
     a single-tenant shared-data app — the token itself is the secret.
   - No changes to existing RLS policies on other tables.

5. Notes
   - Existing host/admin accounts created by the seed migration have
     plain-text pins (host123, admin123). The login functions fall back
     to comparing against the pin column when password_hash is NULL, so
     these legacy accounts continue to work without migration.
   - The admin can set proper hashed passwords for hosts/admins from the
     admin dashboard (future enhancement); for now the fallback keeps
     everything working.
*/

-- Add owner_type and owner_id to sessions
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS owner_type text DEFAULT 'team';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS owner_id uuid;

-- Backfill existing rows
UPDATE sessions SET owner_type = 'team', owner_id = team_id WHERE owner_id IS NULL;

-- Add index for typed session lookup
CREATE INDEX IF NOT EXISTS idx_sessions_token_type ON sessions(token, owner_type);

-- Add password_hash to hosts and admins
ALTER TABLE hosts ADD COLUMN IF NOT EXISTS password_hash text;
ALTER TABLE admins ADD COLUMN IF NOT EXISTS password_hash text;

-- ── Host login ──
-- Validates host name + password (or legacy pin). Returns host id, station id,
-- and a new session token. Returns NULL on failure.
CREATE OR REPLACE FUNCTION host_login(
  p_name text,
  p_password text
) RETURNS TABLE(host_id uuid, station_id uuid, session_token text) AS $$
DECLARE
  v_host_id uuid;
  v_station_id uuid;
  v_hash text;
  v_pin text;
  v_token text;
  v_match boolean := false;
BEGIN
  SELECT hosts.id, hosts.station_id, hosts.password_hash, hosts.pin
    INTO v_host_id, v_station_id, v_hash, v_pin
  FROM hosts WHERE hosts.name = p_name;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Check bcrypt hash first, fall back to legacy pin
  IF v_hash IS NOT NULL THEN
    v_match := crypt(p_password, v_hash) = v_hash;
  ELSIF v_pin IS NOT NULL THEN
    v_match := p_password = v_pin;
  END IF;

  IF NOT v_match THEN
    RETURN;
  END IF;

  v_token := encode(gen_random_bytes(32), 'hex');

  INSERT INTO sessions (team_id, owner_type, owner_id, token)
  VALUES (v_host_id, 'host', v_host_id, v_token);

  RETURN QUERY SELECT v_host_id, v_station_id, v_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Admin login ──
-- Validates admin username + password (or legacy pin). Returns admin id and
-- a new session token. Returns NULL on failure.
CREATE OR REPLACE FUNCTION admin_login(
  p_username text,
  p_password text
) RETURNS TABLE(admin_id uuid, session_token text) AS $$
DECLARE
  v_admin_id uuid;
  v_hash text;
  v_pin text;
  v_token text;
  v_match boolean := false;
BEGIN
  SELECT admins.id, admins.password_hash, admins.pin
    INTO v_admin_id, v_hash, v_pin
  FROM admins WHERE admins.username = p_username;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_hash IS NOT NULL THEN
    v_match := crypt(p_password, v_hash) = v_hash;
  ELSIF v_pin IS NOT NULL THEN
    v_match := p_password = v_pin;
  END IF;

  IF NOT v_match THEN
    RETURN;
  END IF;

  v_token := encode(gen_random_bytes(32), 'hex');

  INSERT INTO sessions (team_id, owner_type, owner_id, token)
  VALUES (v_admin_id, 'admin', v_admin_id, v_token);

  RETURN QUERY SELECT v_admin_id, v_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Typed session validation ──
-- Returns the owner_id if the token is valid, non-expired, AND matches the
-- requested owner_type. Returns NULL otherwise.
CREATE OR REPLACE FUNCTION validate_session_typed(
  p_token text,
  p_owner_type text
) RETURNS uuid AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  SELECT sessions.owner_id INTO v_owner_id
  FROM sessions
  WHERE sessions.token = p_token
    AND sessions.owner_type = p_owner_type
    AND sessions.expires_at > now()
  LIMIT 1;

  RETURN v_owner_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
