import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { GameConfig, Team, Station, Tile, ShopItem, Turn } from '@/lib/types';
import { Users, MapPin, LayoutGrid, ShoppingBag, Monitor, Trophy, Settings, Play, Pause, Square, RotateCcw, LogOut, Home } from 'lucide-react';
import { TeamsPanel } from './TeamsPanel';
import { StationsPanel } from './StationsPanel';
import { BoardPanel } from './BoardPanel';
import { ShopPanel } from './ShopPanel';
import { MonitorPanel } from './MonitorPanel';
import { LeaderboardPanel } from './LeaderboardPanel';

type Tab = 'teams' | 'stations' | 'board' | 'shop' | 'monitor' | 'leaderboard';

export function AdminDashboard({ onLogout, onBack }: { onLogout: () => void; onBack: () => void }) {
  const [tab, setTab] = useState<Tab>('monitor');
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    const [cfg, t, s, ti, si, tu] = await Promise.all([
      supabase.from('game_config').select('*').eq('id', 1).maybeSingle(),
      supabase.from('teams').select('*').order('created_at'),
      supabase.from('stations').select('*').order('name'),
      supabase.from('tiles').select('*').order('tile_order'),
      supabase.from('shop_items').select('*').order('price'),
      supabase.from('turns').select('*').order('created_at', { ascending: false }).limit(500),
    ]);
    if (cfg.data) setConfig(cfg.data);
    if (t.data) setTeams(t.data);
    if (s.data) setStations(s.data);
    if (ti.data) setTiles(ti.data);
    if (si.data) setShopItems(si.data);
    if (tu.data) setTurns(tu.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
    const channel = supabase
      .channel('admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, () => loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_config' }, () => loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stations' }, () => loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_items' }, () => loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tiles' }, () => loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'turns' }, () => loadAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadAll]);

  async function setGameStatus(status: 'setup' | 'running' | 'paused' | 'ended') {
    const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (status === 'running' && !config?.started_at) {
      updates.started_at = new Date().toISOString();
      updates.ends_at = new Date(Date.now() + 90 * 60 * 1000).toISOString();
    }
    await supabase.from('game_config').update(updates).eq('id', 1);
  }

  async function resetGame() {
    if (!confirm('Reset the entire game? This deletes all teams, turns, and transactions. This cannot be undone.')) return;
    await supabase.from('transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('turns').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('purchases').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('teams').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('game_config').update({ status: 'setup', started_at: null, ends_at: null }).eq('id', 1);
    loadAll();
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gold-200">Loading…</div>;

  const tabs: { id: Tab; label: string; icon: typeof Users }[] = [
    { id: 'monitor', label: 'Live Monitor', icon: Monitor },
    { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
    { id: 'teams', label: 'Teams', icon: Users },
    { id: 'stations', label: 'Stations', icon: MapPin },
    { id: 'board', label: 'Board', icon: LayoutGrid },
    { id: 'shop', label: 'Shop', icon: ShoppingBag },
  ];

  return (
    <div className="min-h-screen pb-8">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-maroon-950/95 backdrop-blur-md border-b border-gold-500/20 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Settings className="w-6 h-6 text-gold-400" />
            <span className="font-display font-bold text-gold-100">Admin Dashboard</span>
            {config && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                config.status === 'running' ? 'bg-jewel-500/30 text-jewel-300' :
                config.status === 'paused' ? 'bg-marigold-500/30 text-marigold-300' :
                config.status === 'ended' ? 'bg-maroon-600/40 text-gold-200/60' :
                'bg-gold-500/20 text-gold-300'
              }`}>
                {config.status}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {config?.status !== 'running' && (
              <button onClick={() => setGameStatus('running')} className="btn-ghost text-sm py-1.5">
                <Play className="w-4 h-4" /> Start
              </button>
            )}
            {config?.status === 'running' && (
              <button onClick={() => setGameStatus('paused')} className="btn-ghost text-sm py-1.5">
                <Pause className="w-4 h-4" /> Pause
              </button>
            )}
            <button onClick={() => setGameStatus('ended')} className="btn-ghost text-sm py-1.5">
              <Square className="w-4 h-4" /> End
            </button>
            <button onClick={resetGame} className="btn-ghost text-sm py-1.5 text-marigold-300">
              <RotateCcw className="w-4 h-4" /> Reset
            </button>
            <button onClick={onBack} className="text-gold-300/60 hover:text-gold-100" title="Back to Home">
              <Home className="w-5 h-5" />
            </button>
            <button onClick={onLogout} className="text-gold-300/60 hover:text-gold-100">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-5xl mx-auto px-4 pt-4">
        <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium whitespace-nowrap transition ${
                tab === t.id
                  ? 'bg-gradient-to-br from-gold-400 to-marigold-500 text-maroon-950 font-semibold'
                  : 'bg-maroon-800/50 text-gold-200/70 hover:bg-maroon-700/50'
              }`}
            >
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 pt-4">
        {tab === 'monitor' && <MonitorPanel teams={teams} tiles={tiles} stations={stations} turns={turns} config={config} />}
        {tab === 'leaderboard' && <LeaderboardPanel teams={teams} />}
        {tab === 'teams' && <TeamsPanel teams={teams} onRefresh={loadAll} />}
        {tab === 'stations' && <StationsPanel stations={stations} turns={turns} onRefresh={loadAll} />}
        {tab === 'board' && <BoardPanel tiles={tiles} stations={stations} onRefresh={loadAll} />}
        {tab === 'shop' && <ShopPanel shopItems={shopItems} onRefresh={loadAll} />}
      </div>
    </div>
  );
}
