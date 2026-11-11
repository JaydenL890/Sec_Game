export type GameStatus = 'setup' | 'running' | 'paused' | 'ended';

export interface GameConfig {
  id: number;
  status: GameStatus;
  started_at: string | null;
  ends_at: string | null;
  lap_bonus: number;
  updated_at: string;
}

export interface Station {
  id: string;
  name: string;
  phrase: string;
  description: string;
  location_hint: string;
  min_reward: number;
  max_reward: number;
  max_capacity: number;
  bonus_enabled: boolean;
  icon: string;
  created_at: string;
}

export type TileType = 'station' | 'start';

export interface Tile {
  id: string;
  tile_order: number;
  type: TileType;
  station_id: string | null;
  created_at: string;
}

export interface TeamTile {
  id: string;
  team_id: string;
  tile_order: number;
  type: TileType;
  station_id: string | null;
  created_at: string;
}

export type TeamStatus = 'idle' | 'rolling' | 'traveling' | 'pending' | 'resting';

export interface Team {
  id: string;
  name: string;
  balance: number;
  board_position: number;
  status: TeamStatus;
  session_token: string | null;
  password_hash: string | null;
  color: string;
  created_at: string;
}

export type TurnStatus = 'pending' | 'completed' | 'expired';

export interface Turn {
  id: string;
  team_id: string;
  station_id: string;
  status: TurnStatus;
  token: string;
  reward: number | null;
  bonus: number;
  created_at: string;
  completed_at: string | null;
}

export interface Transaction {
  id: string;
  team_id: string;
  amount: number;
  type: string;
  note: string;
  created_at: string;
}

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
  effect_type: string;
  icon: string;
  active: boolean;
  created_at: string;
}

export interface Purchase {
  id: string;
  team_id: string;
  shop_item_id: string;
  price_paid: number;
  created_at: string;
}

export interface Host {
  id: string;
  name: string;
  station_id: string;
  pin: string;
  created_at: string;
}

export interface Admin {
  id: string;
  username: string;
  pin: string;
  created_at: string;
}
