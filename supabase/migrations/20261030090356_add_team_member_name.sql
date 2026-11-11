/*
# Add team member name to team registration

1. Modified Tables
- `teams`: new nullable column `member_name` (text) that stores the name of the team member who registered the team.
  Teams created before this change keep NULL.

2. Functions
- `team_register` is replaced with a version that accepts a fourth argument, `p_member_name`, and saves it on the new team row.
  The old three-argument version is removed so there is only one registration entry point.

3. Security
- `team_register` is callable only by the server-side service role (used by the game-action edge function).
  EXECUTE is revoked from PUBLIC, anon and authenticated.
*/

ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS member_name text;

DROP FUNCTION IF EXISTS public.team_register(text, text, text);

CREATE OR REPLACE FUNCTION public.team_register(p_name text, p_pin text, p_color text, p_member_name text)
RETURNS TABLE(team_id uuid, session_token text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_team_id uuid;
BEGIN
  INSERT INTO teams (name, pin, password_hash, color, balance, board_position, status, member_name)
  VALUES (p_name, p_pin, extensions.crypt(p_pin, extensions.gen_salt('bf')), p_color, 1500, 0, 'idle', p_member_name)
  RETURNING id INTO v_team_id;

  session_token := encode(extensions.gen_random_bytes(32), 'hex');
  INSERT INTO sessions (team_id, owner_type, owner_id, token, expires_at)
  VALUES (v_team_id, 'team', v_team_id, session_token, now() + interval '24 hours');

  RETURN QUERY SELECT v_team_id, session_token;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.team_register(text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.team_register(text, text, text, text) TO service_role;
