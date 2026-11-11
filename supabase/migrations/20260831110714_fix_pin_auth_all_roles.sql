/*
# Fix PIN-based authentication for all roles (teams, hosts, admins)

## Problem
1. Admin login had TWO overloaded functions — one that verified a PIN (p_username, p_password)
   and one that did NOT (p_username only). The edge function was calling the no-password
   overload, so the admin PIN in the database was never checked server-side. A client-side
   constant ('diya2026') was the only gate, and it didn't even match the DB pin ('admin123').
2. Teams only had a `password_hash` (bcrypt) column — no `pin` column. The user wants all
   three roles to log in with a PIN stored in the database.

## Changes

### Tables
- `teams`: adds `pin text` column (nullable, for backward compat with existing bcrypt teams).
- `hosts`: already has `pin` — no change.
- `admins`: already has `pin` — no change.

### Functions (all SECURITY DEFINER, search_path safe)
- `admin_login(p_username, p_pin)`: drops BOTH old overloads, recreates a single function
  that verifies the PIN against `admins.pin`. Creates a session on success.
- `host_login(p_name, p_pin)`: drops old function, recreates to check `pin` first, then
  fall back to `password_hash` for backward compatibility.
- `team_login(p_name, p_pin)`: drops old function, recreates to check `pin` first, then
  fall back to `password_hash`.
- `team_register(p_name, p_pin, p_color)`: drops old function, recreates to store the PIN
  in plaintext in `teams.pin` (matching the hosts/admins pattern) AND keeps a bcrypt hash
  in `password_hash` for backward compatibility.
- `reset_team_pin(p_team_id, p_new_pin)`: replaces `reset_team_password` — updates the
  `pin` column and the bcrypt hash for consistency.

### Security
- All functions are SECURITY DEFINER so they can read the `admins`, `hosts`, and `teams`
  tables which are behind RLS. They only expose the login result (id + token), nothing else.
- No RLS policy changes.
*/

-- ── Add pin column to teams ──
ALTER TABLE teams ADD COLUMN IF NOT EXISTS pin text;

-- ── Drop old admin_login overloads (both of them) ──
DROP FUNCTION IF EXISTS admin_login(text);
DROP FUNCTION IF EXISTS admin_login(text, text);

-- ── Recreate admin_login with PIN verification ──
CREATE OR REPLACE FUNCTION admin_login(p_username text, p_pin text)
RETURNS TABLE (admin_id uuid, session_token text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid;
  v_pin text;
BEGIN
  SELECT admins.id, admins.pin
  INTO v_admin_id, v_pin
  FROM admins WHERE admins.username = p_username;

  IF NOT FOUND OR v_pin IS NULL OR v_pin <> p_pin THEN
    RETURN;
  END IF;

  session_token := encode(gen_random_bytes(32), 'hex');
  INSERT INTO sessions (team_id, owner_type, owner_id, token)
  VALUES (v_admin_id, 'admin', v_admin_id, session_token);

  RETURN QUERY SELECT v_admin_id, session_token;
END;
$$;

-- ── Drop and recreate host_login: check pin first, fall back to password_hash ──
DROP FUNCTION IF EXISTS host_login(text, text);

CREATE OR REPLACE FUNCTION host_login(p_name text, p_pin text)
RETURNS TABLE (host_id uuid, station_id uuid, session_token text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host_id uuid;
  v_station_id uuid;
  v_hash text;
  v_pin text;
  v_match boolean := false;
BEGIN
  SELECT hosts.id, hosts.station_id, hosts.password_hash, hosts.pin
  INTO v_host_id, v_station_id, v_hash, v_pin
  FROM hosts WHERE hosts.name = p_name;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_pin IS NOT NULL THEN
    v_match := v_pin = p_pin;
  ELSIF v_hash IS NOT NULL THEN
    v_match := crypt(p_pin, v_hash) = v_hash;
  END IF;

  IF NOT v_match THEN
    RETURN;
  END IF;

  session_token := encode(gen_random_bytes(32), 'hex');
  INSERT INTO sessions (team_id, owner_type, owner_id, token)
  VALUES (v_host_id, 'host', v_host_id, session_token);

  RETURN QUERY SELECT v_host_id, v_station_id, session_token;
END;
$$;

-- ── Drop and recreate team_login: check pin first, fall back to password_hash ──
DROP FUNCTION IF EXISTS team_login(text, text);

CREATE OR REPLACE FUNCTION team_login(p_name text, p_pin text)
RETURNS TABLE (team_id uuid, session_token text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_id uuid;
  v_hash text;
  v_pin text;
  v_match boolean := false;
BEGIN
  SELECT teams.id, teams.password_hash, teams.pin
  INTO v_team_id, v_hash, v_pin
  FROM teams WHERE lower(teams.name) = lower(p_name);

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_pin IS NOT NULL THEN
    v_match := v_pin = p_pin;
  ELSIF v_hash IS NOT NULL THEN
    v_match := crypt(p_pin, v_hash) = v_hash;
  END IF;

  IF NOT v_match THEN
    RETURN;
  END IF;

  session_token := encode(gen_random_bytes(32), 'hex');
  UPDATE teams SET session_token = session_token WHERE teams.id = v_team_id;
  INSERT INTO sessions (team_id, token) VALUES (v_team_id, session_token);

  RETURN QUERY SELECT v_team_id, session_token;
END;
$$;

-- ── Drop and recreate team_register: store pin (plaintext) + bcrypt hash for backward compat ──
DROP FUNCTION IF EXISTS team_register(text, text, text);

CREATE OR REPLACE FUNCTION team_register(p_name text, p_pin text, p_color text)
RETURNS TABLE (team_id uuid, session_token text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM teams WHERE lower(teams.name) = lower(p_name)) THEN
    RETURN;
  END IF;

  session_token := encode(gen_random_bytes(32), 'hex');

  INSERT INTO teams (name, password_hash, pin, color, balance, board_position, status, session_token)
  VALUES (p_name, crypt(p_pin, gen_salt('bf')), p_pin, p_color, 0, 0, 'idle', session_token)
  RETURNING teams.id INTO v_team_id;

  INSERT INTO sessions (team_id, token) VALUES (v_team_id, session_token);

  RETURN QUERY SELECT v_team_id, session_token;
END;
$$;

-- ── Replace reset_team_password with reset_team_pin ──
DROP FUNCTION IF EXISTS reset_team_password(uuid, text);
DROP FUNCTION IF EXISTS reset_team_pin(uuid, text);

CREATE OR REPLACE FUNCTION reset_team_pin(p_team_id uuid, p_new_pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE teams
  SET pin = p_new_pin,
      password_hash = crypt(p_new_pin, gen_salt('bf'))
  WHERE id = p_team_id;
  RETURN FOUND;
END;
$$;
