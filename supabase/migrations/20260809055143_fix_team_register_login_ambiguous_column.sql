-- Fix: PL/pgSQL variables shadowed column names causing "column reference is ambiguous" errors.
-- The team_register and team_login functions used bare `id` which Postgres couldn't
-- disambiguate from PL/pgSQL variables. Prefix all column references with the table name.

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
  IF EXISTS (SELECT 1 FROM teams WHERE lower(teams.name) = lower(p_name)) THEN
    RETURN;
  END IF;

  v_token := encode(gen_random_bytes(32), 'hex');

  INSERT INTO teams (name, password_hash, color, balance, board_position, status, session_token)
  VALUES (p_name, crypt(p_password, gen_salt('bf')), p_color, 0, 0, 'idle', v_token)
  RETURNING teams.id INTO v_team_id;

  INSERT INTO sessions (team_id, token) VALUES (v_team_id, v_token);

  RETURN QUERY SELECT v_team_id, v_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION team_login(
  p_name text,
  p_password text
) RETURNS TABLE(id uuid, session_token text) AS $$
DECLARE
  v_team_id uuid;
  v_hash text;
  v_token text;
BEGIN
  SELECT teams.id, teams.password_hash INTO v_team_id, v_hash
  FROM teams WHERE lower(teams.name) = lower(p_name);

  IF NOT FOUND OR v_hash IS NULL THEN
    RETURN;
  END IF;

  IF crypt(p_password, v_hash) <> v_hash THEN
    RETURN;
  END IF;

  v_token := encode(gen_random_bytes(32), 'hex');

  UPDATE teams SET session_token = v_token WHERE teams.id = v_team_id;
  INSERT INTO sessions (team_id, token) VALUES (v_team_id, v_token);

  RETURN QUERY SELECT v_team_id, v_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
