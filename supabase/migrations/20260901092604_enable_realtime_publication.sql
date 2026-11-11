-- Enable Supabase Realtime for all game tables
-- Without this, postgres_changes subscriptions never fire and teams
-- can't see live updates (admin starting game, balance changes, etc.)

ALTER PUBLICATION supabase_realtime ADD TABLE public.game_config;
ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;
ALTER PUBLICATION supabase_realtime ADD TABLE public.turns;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shop_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.purchases;
