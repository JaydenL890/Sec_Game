/*
# Fix host_login to return station_id

1. Problem
   - The `host_login` RPC returned only `host_id` and `session_token`.
   - The edge function and frontend expect `station_id` in the response so the
     host can be routed to their station dashboard.
   - Without it, `stationId` was `undefined`, and the host dashboard never loaded.

2. Changes
   - Drop and recreate `host_login` to also SELECT and return `station_id`.
   - The function now returns three columns: `host_id`, `station_id`, `session_token`.

3. Security
   - No RLS changes. This is a SECURITY DEFINER function callable by anon/authenticated
     for host login. The pin comparison remains unchanged.
*/

DROP FUNCTION IF EXISTS host_login(p_name text, p_pin text);

CREATE FUNCTION host_login(p_name text, p_pin text)
RETURNS TABLE (host_id uuid, station_id uuid, session_token text)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_host_id uuid;
  v_station_id uuid;
  v_pin text;
BEGIN
  SELECT hosts.id, hosts.station_id, hosts.pin
  INTO v_host_id, v_station_id, v_pin
  FROM hosts WHERE hosts.name = p_name;

  IF NOT FOUND OR v_pin IS NULL OR v_pin <> p_pin THEN
    RETURN;
  END IF;

  session_token := encode(extensions.gen_random_bytes(32), 'hex');
  INSERT INTO sessions (team_id, owner_type, owner_id, token, expires_at)
  VALUES (v_host_id, 'host', v_host_id, session_token, now() + interval '24 hours');

  RETURN QUERY SELECT v_host_id, v_station_id, session_token;
END;
$$;
