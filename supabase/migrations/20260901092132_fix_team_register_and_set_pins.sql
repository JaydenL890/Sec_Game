-- 1. Fix team_register: uses 'balance' and 'board_position', not 'money' and 'position'
DROP FUNCTION IF EXISTS public.team_register(text, text, text);

CREATE OR REPLACE FUNCTION public.team_register(p_name text, p_pin text, p_color text)
RETURNS TABLE(team_id uuid, session_token text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_team_id uuid;
BEGIN
  INSERT INTO teams (name, pin, password_hash, color, balance, board_position, status)
  VALUES (p_name, p_pin, crypt(p_pin, extensions.gen_salt('bf')), p_color, 1500, 0, 'idle')
  RETURNING id INTO v_team_id;

  session_token := encode(extensions.gen_random_bytes(32), 'hex');
  INSERT INTO sessions (team_id, owner_type, owner_id, token, expires_at)
  VALUES (v_team_id, 'team', v_team_id, session_token, now() + interval '24 hours');

  RETURN QUERY SELECT v_team_id, session_token;
END;
$function$;

-- 2. Fix team_login: also set expires_at on session
DROP FUNCTION IF EXISTS public.team_login(text, text);

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
  INSERT INTO sessions (team_id, owner_type, owner_id, token, expires_at)
  VALUES (v_team_id, 'team', v_team_id, session_token, now() + interval '24 hours');

  RETURN QUERY SELECT v_team_id, session_token;
END;
$function$;

-- 3. Fix admin_login: add expires_at
DROP FUNCTION IF EXISTS public.admin_login(text, text);

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
  INSERT INTO sessions (team_id, owner_type, owner_id, token, expires_at)
  VALUES (v_admin_id, 'admin', v_admin_id, session_token, now() + interval '24 hours');

  RETURN QUERY SELECT v_admin_id, session_token;
END;
$function$;

-- 4. Fix host_login: add expires_at
DROP FUNCTION IF EXISTS public.host_login(text, text);

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
  INSERT INTO sessions (team_id, owner_type, owner_id, token, expires_at)
  VALUES (v_host_id, 'host', v_host_id, session_token, now() + interval '24 hours');

  RETURN QUERY SELECT v_host_id, session_token;
END;
$function$;

-- 5. Fix reset_team_pin: qualify gen_salt with extensions schema
DROP FUNCTION IF EXISTS public.reset_team_pin(uuid, text);

CREATE OR REPLACE FUNCTION public.reset_team_pin(p_team_id uuid, p_new_pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE teams
  SET pin = p_new_pin,
      password_hash = crypt(p_new_pin, extensions.gen_salt('bf'))
  WHERE id = p_team_id;
  RETURN FOUND;
END;
$function$;

-- 6. Set all existing teams' PIN to 'PASSWORD' and update their password_hash
UPDATE teams
SET pin = 'PASSWORD',
    password_hash = crypt('PASSWORD', extensions.gen_salt('bf'))
WHERE pin IS NULL;
