import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { gameApi } from '@/lib/api';
import type { Team, Station, Tile, Transaction, Turn } from '@/lib/types';
import { DiyaBalance } from '@/components/DiyaIcon';
import { Dice } from '@/components/Dice';
import { QRDisplay } from '@/components/QRDisplay';
import { Board } from '@/components/Board';
import { StationIcon } from '@/components/StationIcon';
import { TILE_LABELS } from '@/lib/gameData';
import { ShoppingBag, History, MapPin, Gift, Coins, ChevronDown, ChevronUp, Sparkles, LogOut, Users } from 'lucide-react';
import { PlayerShop } from './PlayerShop';

export function PlayerGame({
  teamId,
  sessionToken,
  onLeave,
  gameStatus = 'running',
}: {
  teamId: string;
  sessionToken: string;
  onLeave: () => void;
  gameStatus?: string;
}) {
  const [team, setTeam] = useState<Team | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stationLoad, setStationLoad] = useState<Map<string, number>>(new Map());
  const [showStations, setShowStations] = useState(false);
  const [currentTurn, setCurrentTurn] = useState<Turn | null>(null);
  const [rolling, setRolling] = useState(false);
  const [diceValue, setDiceValue] = useState(1);
  const [rollResult, setRollResult] = useState<null | {
    tileType: string;
    station?: Station;
    special?: { text: string; amount: number };
    passedStart?: boolean;
    dice: number;
  }>(null);
  const [showShop, setShowShop] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rewardPopup, setRewardPopup] = useState<string | null>(null);
  const stationsRef = useRef<Station[]>([]);

  const loadData = useCallback(async () => {
    const [teamRes, stationsRes, teamTilesRes, txRes, pendingTurnsRes] = await Promise.all([
      supabase.from('teams').select('*').eq('id', teamId).maybeSingle(),
      supabase.from('stations').select('*').order('name'),
      supabase.from('team_tiles').select('*').eq('team_id', teamId).order('tile_order'),
      supabase.from('transactions').select('*').eq('team_id', teamId).order('created_at', { ascending: false }).limit(20),
      supabase.from('turns').select('station_id').eq('status', 'pending'),
    ]);
    if (teamRes.data) setTeam(teamRes.data);
    if (stationsRes.data) { setStations(stationsRes.data); stationsRef.current = stationsRes.data; }
    if (teamTilesRes.data && teamTilesRes.data.length > 0) {
      setTiles(teamTilesRes.data as unknown as Tile[]);
    } else if (teamTilesRes.data && teamTilesRes.data.length === 0) {
      const { data: baseTiles } = await supabase.from('tiles').select('*').order('tile_order');
      if (baseTiles) setTiles(baseTiles);
    }
    if (txRes.data) setTransactions(txRes.data);

    // Build live station load map
    const loadMap = new Map<string, number>();
    for (const s of stationsRes.data ?? []) loadMap.set(s.id, 0);
    for (const t of pendingTurnsRes.data ?? []) {
      loadMap.set(t.station_id, (loadMap.get(t.station_id) ?? 0) + 1);
    }
    setStationLoad(loadMap);

    // Find pending turn
    const { data: pendingTurn } = await supabase
      .from('turns')
      .select('*')
      .eq('team_id', teamId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setCurrentTurn(pendingTurn);
  }, [teamId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`team-${teamId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams', filter: `id=eq.${teamId}` }, (payload) => {
        if (payload.new) setTeam(payload.new as Team);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'turns', filter: `team_id=eq.${teamId}` }, async (payload) => {
        const turn = payload.new as Turn;
        if (turn.status === 'completed' && turn.reward) {
          const st = stationsRef.current.find((s) => s.id === turn.station_id);
          setRewardPopup(`You earned ${turn.reward} Diyas at ${st?.name ?? 'the station'}!`);
          setCurrentTurn(null);
          setTimeout(() => setRewardPopup(null), 4000);
          loadData();
        } else if (turn.status === 'pending') {
          setCurrentTurn(turn);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `team_id=eq.${teamId}` }, () => {
        loadData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'turns' }, () => {
        // Live station capacity update — any turn change affects station loads
        supabase.from('turns').select('station_id').eq('status', 'pending').then(({ data }) => {
          const loadMap = new Map<string, number>();
          for (const s of stationsRef.current) loadMap.set(s.id, 0);
          for (const t of data ?? []) {
            loadMap.set(t.station_id, (loadMap.get(t.station_id) ?? 0) + 1);
          }
          setStationLoad(loadMap);
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [teamId, loadData]);

  // Polling fallback: if the team is pending, poll every 3s for status changes
  // so the roll button re-enables reliably even if realtime drops events
  useEffect(() => {
    if (!team || team.status !== 'pending') return;
    const interval = setInterval(async () => {
      const { data: fresh } = await supabase
        .from('teams').select('*').eq('id', teamId).maybeSingle();
      if (fresh && fresh.status !== 'pending') {
        setTeam(fresh);
        const { data: tx } = await supabase
          .from('transactions')
          .select('*, stations!inner(name)')
          .eq('team_id', teamId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (tx && tx.amount > 0) {
          const stName = (tx as any).stations?.name ?? 'the station';
          setRewardPopup(`You earned ${tx.amount} Diyas at ${stName}!`);
          setTimeout(() => setRewardPopup(null), 4000);
        }
        setCurrentTurn(null);
        loadData();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [team, teamId, loadData]);

  async function handleRoll() {
    if (!team || rolling) return;
    setRolling(true);
    setError(null);
    setRollResult(null);

    // Animate dice
    const animInterval = setInterval(() => {
      setDiceValue(Math.floor(Math.random() * 6) + 1);
    }, 100);

    try {
      const result = await gameApi.roll(teamId, sessionToken);
      setDiceValue(result.dice);

      setTimeout(() => {
        setRolling(false);
        clearInterval(animInterval);

        const station = result.stationId
          ? stations.find((s) => s.id === result.stationId)
          : undefined;
        setRollResult({
          tileType: result.tileType,
          station,
          special: result.specialResult ?? undefined,
          passedStart: result.passedStart,
          dice: result.dice,
        });
        loadData();
      }, 700);
    } catch (err) {
      clearInterval(animInterval);
      setRolling(false);
      setError((err as Error).message);
    }
  }

  async function handleSkipRest() {
    try {
      await gameApi.skipRest(teamId, sessionToken);
      loadData();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleClearRest() {
    try {
      await gameApi.clearRest(teamId, sessionToken);
      loadData();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!team) return <div className="min-h-screen flex items-center justify-center text-gold-200">Loading…</div>;

  const currentTile = tiles.find((t) => t.tile_order === team.board_position);
  const currentStation = currentTile?.station_id ? stations.find((s) => s.id === currentTile.station_id) : null;
  const tileLabel = currentTile ? TILE_LABELS[currentTile.type] : null;
  const isPending = team.status === 'pending' && currentTurn;
  const isResting = team.status === 'resting';
  const canRoll = team.status === 'idle' && !rolling && gameStatus === 'running';
  const isWaiting = gameStatus !== 'running';

  return (
    <div className="min-h-screen pb-28">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-maroon-950/90 backdrop-blur-md border-b border-gold-500/20 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: TEAM_COLOR_HEX(team.color) }}
            />
            <span className="font-display font-bold text-gold-100 truncate max-w-[140px]">{team.name}</span>
          </div>
          <DiyaBalance amount={team.balance} className="text-lg" />
          <button onClick={onLeave} className="text-gold-300/60 hover:text-gold-100">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        {/* Board */}
        <div className="festive-card p-3">
          <h3 className="label-text mb-2 px-1">Your Journey</h3>
          <Board tiles={tiles} stations={stations} currentPosition={team.board_position} teamColor={TEAM_COLOR_HEX(team.color)} compact />
        </div>

        {/* Current position info */}
        <div className="festive-card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-400 to-marigold-500 flex items-center justify-center">
              <StationIcon icon={currentStation?.icon ?? tileLabel?.icon ?? 'star'} className="w-5 h-5 text-maroon-950" />
            </div>
            <div>
              <p className="label-text">Current Tile</p>
              <p className="font-display font-bold text-gold-100">{currentStation?.name ?? tileLabel?.name ?? '—'}</p>
            </div>
          </div>
          {currentStation && (
            <p className="text-gold-200/80 text-sm italic">{currentStation.phrase}</p>
          )}
          {currentStation?.location_hint && (
            <p className="text-jewel-300 text-xs mt-1 flex items-center gap-1">
              <MapPin className="w-3 h-3" /> {currentStation.location_hint}
            </p>
          )}
        </div>

        {/* Live station occupancy */}
        <div className="festive-card p-4">
          <button
            onClick={() => setShowStations(!showStations)}
            className="w-full flex items-center justify-between text-gold-200"
          >
            <span className="flex items-center gap-2 font-display font-semibold text-sm">
              <Users className="w-4 h-4" /> Station Occupancy
              <span className="w-2 h-2 rounded-full bg-jewel-400 animate-pulse" />
            </span>
            {showStations ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showStations && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {stations.map((s) => {
                const load = stationLoad.get(s.id) ?? 0;
                const full = load >= s.max_capacity;
                const closed = s.max_capacity === 0;
                return (
                  <div
                    key={s.id}
                    className={`flex items-center gap-2 rounded-lg px-2.5 py-2 border ${
                      closed ? 'bg-maroon-700/30 border-marigold-500/20' :
                      full ? 'bg-flame-500/15 border-flame-500/30' :
                      'bg-jewel-500/10 border-jewel-500/20'
                    }`}
                  >
                    <StationIcon icon={s.icon} className="w-4 h-4 text-gold-300 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-gold-100 text-xs font-medium truncate">{s.name}</p>
                      <p className={`text-[10px] font-display font-bold ${closed ? 'text-marigold-300' : full ? 'text-flame-300' : 'text-jewel-300'}`}>
                        {closed ? 'Closed' : full ? 'Full' : `${load}/${s.max_capacity}`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Dice + Roll */}
        <div className="festive-card p-6 flex flex-col items-center gap-4">
          <Dice value={diceValue} rolling={rolling} />

          {error && (
            <p className="text-marigold-300 text-sm text-center bg-marigold-900/30 rounded-lg py-2 px-3">{error}</p>
          )}

          {/* Roll result */}
          {rollResult && !isPending && (
            <div className="w-full text-center animate-pop-in">
              {rollResult.station ? (
                <div className="space-y-2">
                  <p className="text-gold-100 font-display font-bold text-lg">You rolled a {rollResult.dice}!</p>
                  <p className="text-flame-300 text-sm">{rollResult.station.phrase}</p>
                  <p className="text-jewel-300 text-xs flex items-center justify-center gap-1">
                    <MapPin className="w-3 h-3" /> {rollResult.station.location_hint}
                  </p>
                  <p className="text-gold-200/60 text-xs">Show your QR code below to the station host.</p>
                </div>
              ) : rollResult.special ? (
                <div className="space-y-1">
                  <p className="text-gold-100 font-display font-bold">You rolled a {rollResult.dice}!</p>
                  <p className="text-flame-300 text-sm">{rollResult.special.text}</p>
                  {rollResult.special.amount !== 0 && (
                    <p className={`font-display font-bold text-lg ${rollResult.special.amount > 0 ? 'text-jewel-300' : 'text-marigold-300'}`}>
                      {rollResult.special.amount > 0 ? '+' : ''}{rollResult.special.amount} Diyas
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-gold-100 font-display font-bold">You rolled a {rollResult.dice}!</p>
              )}
              {rollResult.passedStart && (
                <p className="text-gold-300 text-xs mt-1 flex items-center justify-center gap-1">
                  <Gift className="w-4 h-4" /> Passed Diwali Gate — bonus earned!
                </p>
              )}
            </div>
          )}

          {/* Pending: show QR */}
          {isPending && currentTurn && currentStation && (
            <div className="w-full flex flex-col items-center gap-3 animate-pop-in">
              <div className="text-center">
                <p className="text-flame-300 font-display font-bold text-lg">{currentStation.name}</p>
                <p className="text-gold-200/70 text-xs">Show this QR to your station host</p>
              </div>
              <QRDisplay value={currentTurn.token} size={200} />
              <div className="bg-maroon-900/60 rounded-xl px-4 py-2 border border-gold-500/20">
                <p className="text-gold-200/50 text-xs text-center">Manual PIN (if camera fails):</p>
                <p className="text-gold-100 font-mono text-sm text-center tracking-wider">{currentTurn.token.slice(0, 8).toUpperCase()}</p>
              </div>
            </div>
          )}

          {/* Resting */}
          {isResting && (
            <div className="w-full text-center space-y-3 animate-pop-in">
              <p className="text-gold-100 font-display font-bold">You're resting at Rangoli Rest</p>
              <p className="text-gold-200/70 text-sm">Skip your next roll for free, or pay 15 Diyas to roll now.</p>
              <div className="flex gap-2 justify-center">
                <button onClick={handleSkipRest} className="btn-primary">
                  <Coins className="w-4 h-4" /> Pay 15 & Roll
                </button>
                <button onClick={handleClearRest} className="btn-ghost">
                  Rest (skip turn)
                </button>
              </div>
            </div>
          )}

          {/* Roll button */}
          {canRoll && (
            <button onClick={handleRoll} className="btn-primary text-xl px-10 py-4 animate-flame-flicker">
              <Sparkles className="w-6 h-6" /> Roll Dice
            </button>
          )}
          {isPending && (
            <p className="text-gold-200/50 text-xs text-center">Rolling is locked until the host scans your QR code.</p>
          )}
          {isWaiting && (
            <div className="text-center space-y-3 py-2">
              <div className="flex items-center justify-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-jewel-400 animate-pulse" />
                <span className="text-gold-200/60 text-xs font-medium tracking-wide">LIVE — waiting for admin</span>
              </div>
              <p className="text-gold-200 font-display font-bold text-lg">Waiting for the game to begin…</p>
              <p className="text-gold-200/50 text-sm">Your admin will start the game once all teams have joined. The game will appear here automatically — no reload needed.</p>
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div className="festive-card p-4">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-between text-gold-200"
          >
            <span className="flex items-center gap-2 font-display font-semibold">
              <History className="w-5 h-5" /> Recent Activity
            </span>
            {showHistory ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
          {showHistory && (
            <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
              {transactions.length === 0 ? (
                <p className="text-gold-200/40 text-sm text-center py-2">No activity yet</p>
              ) : (
                transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between text-sm border-b border-gold-500/10 pb-1.5">
                    <span className="text-gold-200/70 truncate flex-1">{tx.note}</span>
                    <span className={`font-display font-bold ml-2 ${tx.amount > 0 ? 'text-jewel-300' : 'text-marigold-300'}`}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Shop button */}
      <button
        onClick={() => setShowShop(true)}
        className="fixed bottom-4 right-4 z-30 btn-primary rounded-full px-5 py-3 shadow-2xl"
      >
        <ShoppingBag className="w-5 h-5" /> Shop
      </button>

      {/* Shop modal */}
      {showShop && (
        <PlayerShop
          teamId={teamId}
          sessionToken={sessionToken}
          balance={team.balance}
          onClose={() => { setShowShop(false); loadData(); }}
        />
      )}

      {/* Reward popup */}
      {rewardPopup && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 festive-card-light px-6 py-4 shadow-2xl animate-pop-in">
          <p className="font-display font-bold text-maroon-900 text-center">{rewardPopup}</p>
        </div>
      )}
    </div>
  );
}

function TEAM_COLOR_HEX(id: string): string {
  const map: Record<string, string> = {
    amber: '#fbbf24', rose: '#f43f5e', teal: '#2dd4bf', violet: '#a78bfa',
    emerald: '#34d399', sky: '#38bdf8', orange: '#fb923c', pink: '#f472b6',
  };
  return map[id] ?? '#fbbf24';
}
