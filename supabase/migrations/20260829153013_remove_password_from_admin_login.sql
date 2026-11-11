/*
# Remove password requirement from admin login

1. Overview
   The admin login no longer requires a password — the access code checked
   on the frontend is the sole gatekeeper. This simplifies the admin login
   to just a username lookup.

2. Changes
   - admin_login function: drop the p_password parameter and all password/
     pin validation logic. Now just looks up the admin by username and
     creates a session if found.
*/

CREATE OR REPLACE FUNCTION admin_login(
  p_username text
) RETURNS TABLE(admin_id uuid, session_token text) AS $$
DECLARE
  v_admin_id uuid;
  v_token text;
BEGIN
  SELECT admins.id INTO v_admin_id
  FROM admins WHERE admins.username = p_username;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_token := encode(gen_random_bytes(32), 'hex');

  INSERT INTO sessions (team_id, owner_type, owner_id, token)
  VALUES (v_admin_id, 'admin', v_admin_id, v_token);

  RETURN QUERY SELECT v_admin_id, v_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
