-- Fix: crypt() and gen_salt() are also in extensions schema, must qualify them

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
  VALUES (p_name, p_pin, extensions.crypt(p_pin, extensions.gen_salt('bf')), p_color, 1500, 0, 'idle')
  RETURNING id INTO v_team_id;

  session_token := encode(extensions.gen_random_bytes(32), 'hex');
  INSERT INTO sessions (team_id, owner_type, owner_id, token, expires_at)
  VALUES (v_team_id, 'team', v_team_id, session_token, now() + interval '24 hours');

  RETURN QUERY SELECT v_team_id, session_token;
END;
$function$;

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
    IF v_stored_hash <> extensions.crypt(p_pin, v_stored_hash) THEN
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
      password_hash = extensions.crypt(p_new_pin, extensions.gen_salt('bf'))
  WHERE id = p_team_id;
  RETURN FOUND;
END;
$function$;

-- Re-set all teams' PIN to 'PASSWORD' with properly qualified crypt
UPDATE teams
SET pin = 'PASSWORD',
    password_hash = extensions.crypt('PASSWORD', extensions.gen_salt('bf'))
WHERE pin IS NULL OR pin = '';
