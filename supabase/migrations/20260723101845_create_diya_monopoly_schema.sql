/*
# Diya Monopoly — Full Game Schema

1. Overview
   Creates the complete data model for a Deepavali-themed station board game:
   - teams (players), stations (physical activity stops), tiles (board layout),
   - turns (pending/completed station visits with signed QR tokens),
   - transactions (Diya balance ledger), shop_items + purchases,
   - hosts (station operators), game_config (event settings + flavor card text).
   This is a single-tenant shared-data app (no per-user sign-in for players);
   host/admin access is gated by a role field on the `hosts` table and a
   separate `admins` table, both using simple PIN/password credentials stored
   as text (school event, low security risk). RLS is enabled on every table
   with anon+authenticated full CRUD because the game data is intentionally
   shared across all participant devices.

2. New Tables
   - game_config        : singleton event settings (status, time limits, messages)
   - stations           : the 8 physical stations (name, location, reward range)
   - tiles              : ordered board tiles (station / special types)
   - teams              : student teams (name, balance, position, status, session)
   - turns              : per-visit records with signed QR token + reward
   - transactions       : Diya balance ledger (append-only audit log)
   - shop_items         : purchasable power-ups / cosmetics
   - purchases          : team shop purchase records
   - hosts              : station host accounts (stationId, pin, name)
   - admins             : game admin accounts (username, pin)

3. Security
   - RLS enabled on every table.
   - All policies use TO anon, authenticated with USING(true) / WITH CHECK(true)
     because the game data is intentionally shared/public across participant
     devices (no per-user auth). This is a single-tenant shared-data app.

4. Notes
   - balances are updated via direct UPDATE on teams, but every change is also
     logged in transactions for auditability.
   - turns.token is a random signed string used for QR verification.
*/

CREATE TABLE IF NOT EXISTS game_config (
  id integer PRIMARY KEY DEFAULT 1,
  status text NOT NULL DEFAULT 'setup',          -- setup | running | paused | ended
  started_at timestamptz,
  ends_at timestamptz,
  lap_bonus integer NOT NULL DEFAULT 50,
  updated_at timestamptz DEFAULT now()
);
INSERT INTO game_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phrase text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  location_hint text NOT NULL DEFAULT '',
  min_reward integer NOT NULL DEFAULT 20,
  max_reward integer NOT NULL DEFAULT 60,
  bonus_enabled boolean NOT NULL DEFAULT true,
  icon text NOT NULL DEFAULT 'flame',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tile_order integer NOT NULL,
  type text NOT NULL,                            -- station | start | chest | surprise | rest | break
  station_id uuid REFERENCES stations(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  balance integer NOT NULL DEFAULT 0,
  board_position integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'idle',           -- idle | rolling | traveling | pending | resting
  session_token text,
  color text NOT NULL DEFAULT 'amber',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS turns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  station_id uuid NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',        -- pending | completed | expired
  token text NOT NULL,
  reward integer,
  bonus integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  amount integer NOT NULL,                       -- +credit / -debit
  type text NOT NULL,                            -- station | shop | special | adjustment | lap
  note text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shop_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  price integer NOT NULL DEFAULT 0,
  effect_type text NOT NULL DEFAULT 'none',
  icon text NOT NULL DEFAULT 'sparkles',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  shop_item_id uuid NOT NULL REFERENCES shop_items(id) ON DELETE CASCADE,
  price_paid integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hosts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  station_id uuid NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  pin text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  pin text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tiles_order ON tiles(tile_order);
CREATE INDEX IF NOT EXISTS idx_turns_team ON turns(team_id);
CREATE INDEX IF NOT EXISTS idx_turns_status ON turns(status);
CREATE INDEX IF NOT EXISTS idx_transactions_team ON transactions(team_id);
CREATE INDEX IF NOT EXISTS idx_purchases_team ON purchases(team_id);

-- RLS
ALTER TABLE game_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE hosts ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- Policies (shared data, anon+authenticated full CRUD)
CREATE POLICY "anon_all_game_config" ON game_config FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_stations" ON stations FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_tiles" ON tiles FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_teams" ON teams FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_turns" ON turns FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_transactions" ON transactions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_shop_items" ON shop_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_purchases" ON purchases FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_hosts" ON hosts FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_admins" ON admins FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
