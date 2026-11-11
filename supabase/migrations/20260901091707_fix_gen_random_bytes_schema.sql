-- gen_random_bytes lives in the `extensions` schema, but these functions
-- set search_path TO 'public', so they can't find it. Qualify the call.

DROP FUNCTION IF EXISTS public.admin_login(text, text);
DROP FUNCTION IF EXISTS public.host_login(text, text);
DROP FUNCTION IF EXISTS public.team_login(text, text);
DROP FUNCTION IF EXISTS public.team_register(text, text, text);

CREATE OR REPLACE FUNCTION public.admin_login(p_username text, p_pin text)
RETURNS TABLE(admin_id uuid, session_token text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  session_token := encode(extensions.gen_random_bytes(32), 'hex');
  INSERT INTO sessions (team_id, owner_type, owner_id, token)
  VALUES (v_admin_id, 'admin', v_admin_id, session_token);

  RETURN QUERY SELECT v_admin_id, session_token;
END;
$function$;

CREATE OR REPLACE FUNCTION public.host_login(p_name text, p_pin text)
RETURNS TABLE(host_id uuid, session_token text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_host_id uuid;
  v_pin text;
BEGIN
  SELECT hosts.id, hosts.pin
  INTO v_host_id, v_pin
  FROM hosts WHERE hosts.name = p_name;

  IF NOT FOUND OR v_pin IS NULL OR v_pin <> p_pin THEN
    RETURN;
  END IF;

  session_token := encode(extensions.gen_random_bytes(32), 'hex');
  INSERT INTO sessions (team_id, owner_type, owner_id, token)
  VALUES (v_host_id, 'host', v_host_id, session_token);

  RETURN QUERY SELECT v_host_id, session_token;
END;
$function$;

CREATE OR REPLACE FUNCTION public.team_login(p_name text, p_pin text)
RETURNS TABLE(team_id uuid, session_token text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_team_id uuid;
  v_stored_pin text;
  v_stored_hash text;
BEGIN
  SELECT teams.id, teams.pin, teams.password_hash
  INTO v_team_id, v_stored_pin, v_stored_hash
  FROM teams WHERE teams.name = p_name;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Check PIN first; fall back to legacy password_hash if PIN not set
  IF v_stored_pin IS NOT NULL THEN
    IF v_stored_pin <> p_pin THEN
      RETURN;
    END IF;
  ELSIF v_stored_hash IS NOT NULL THEN
    IF v_stored_hash <> crypt(p_pin, v_stored_hash) THEN
      RETURN;
    END IF;
  ELSE
    RETURN;
  END IF;

  session_token := encode(extensions.gen_random_bytes(32), 'hex');
  INSERT INTO sessions (team_id, owner_type, owner_id, token)
  VALUES (v_team_id, 'team', v_team_id, session_token);

  RETURN QUERY SELECT v_team_id, session_token;
END;
$function$;

CREATE OR REPLACE FUNCTION public.team_register(p_name text, p_pin text, p_color text)
RETURNS TABLE(team_id uuid, session_token text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_team_id uuid;
BEGIN
  INSERT INTO teams (name, pin, password_hash, color, money, position)
  VALUES (p_name, p_pin, crypt(p_pin, extensions.gen_salt('bf')), p_color, 1500, 0)
  RETURNING id INTO v_team_id;

  session_token := encode(extensions.gen_random_bytes(32), 'hex');
  INSERT INTO sessions (team_id, owner_type, owner_id, token)
  VALUES (v_team_id, 'team', v_team_id, session_token);

  RETURN QUERY SELECT v_team_id, session_token;
END;
$function$;
