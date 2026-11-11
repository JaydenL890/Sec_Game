import { useEffect, useRef, useState } from 'react';
import { FestiveBackground } from '@/components/FestiveBackground';
import { LandingPage } from '@/components/LandingPage';
import { TeamLoginPage } from '@/components/player/TeamLoginPage';
import { PlayerGame } from '@/components/player/PlayerGame';
import { HostLoginPage } from '@/components/host/HostLoginPage';
import { HostDashboard } from '@/components/host/HostDashboard';
import { AdminLoginPage } from '@/components/admin/AdminLoginPage';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { DeepavaliIntro } from '@/components/DeepavaliIntro';
import {
  type StoredSession,
  getStoredSession,
  saveSession,
  clearSession,
  parseRoute,
  navigate,
  hasSeenIntro,
  markIntroSeen,
  clearIntroSeen,
} from '@/lib/session';
import { supabase } from '@/lib/supabase';
import type { Team, GameConfig } from '@/lib/types';

type TeamView = 'game' | 'intro';

export default function App() {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [route, setRoute] = useState(parseRoute());
  const [authChecked, setAuthChecked] = useState(false);
  const [teamView, setTeamView] = useState<TeamView>('game');
  const [teamData, setTeamData] = useState<Team | null>(null);
  const [gameConfig, setGameConfig] = useState<GameConfig | null>(null);
  const prevGameStatus = useRef<string | null>(null);

  useEffect(() => {
    const s = getStoredSession();
    setSession(s);
    setAuthChecked(true);
  }, []);

  useEffect(() => {
    const onHashChange = () => setRoute(parseRoute());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Load game config (team data for team sessions) and listen for the game starting; hosts and teams both get the start intro
  useEffect(() => {
    if (session?.role !== 'team' && session?.role !== 'host') return;

    let cancelled = false;

    async function loadInitial() {
      const [cfgRes, teamRes] = await Promise.all([
        supabase.from('game_config').select('*').eq('id', 1).maybeSingle(),
        session!.role === 'team'
          ? supabase.from('teams').select('*').eq('id', session!.id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      if (cancelled) return;
      if (cfgRes.data) {
        setGameConfig(cfgRes.data as GameConfig);
        prevGameStatus.current = (cfgRes.data as GameConfig).status;
      }
      if (teamRes.data) setTeamData(teamRes.data as Team);
    }
    loadInitial();

    // Realtime: when game_config changes, update immediately
    const channel = supabase
      .channel('team-game-config')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_config' }, (payload) => {
        const cfg = payload.new as GameConfig;
        setGameConfig(cfg);
        if (cfg.status === 'running' && prevGameStatus.current !== 'running' && !hasSeenIntro()) {
          setTeamView('intro');
        }
        prevGameStatus.current = cfg.status;
      })
      .subscribe();

    // Polling fallback: check game status every 5s in case realtime drops
    const pollInterval = setInterval(async () => {
      if (cancelled) return;
      const { data: cfg } = await supabase
        .from('game_config').select('*').eq('id', 1).maybeSingle();
      if (cancelled || !cfg) return;
      setGameConfig(cfg as GameConfig);
      const newStatus = (cfg as GameConfig).status;
      if (newStatus === 'running' && prevGameStatus.current !== 'running' && !hasSeenIntro()) {
        setTeamView('intro');
      }
      prevGameStatus.current = newStatus;
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [session]);

  function joinTeam(teamId: string, sessionToken: string) {
    clearIntroSeen();
    const s: StoredSession = { role: 'team', id: teamId, token: sessionToken };
    saveSession(s);
    setSession(s);
    setTeamView('game');
    setTeamData(null);
    setGameConfig(null);
    navigate('/team');
  }

  function handleIntroComplete() {
    markIntroSeen();
    setTeamView('game');
  }

  function joinHost(hostId: string, stationId: string, sessionToken: string) {
    clearIntroSeen();
    const s: StoredSession = { role: 'host', id: hostId, token: sessionToken, stationId };
    saveSession(s);
    setSession(s);
    navigate('/host');
  }

  function joinAdmin(adminId: string, sessionToken: string) {
    const s: StoredSession = { role: 'admin', id: adminId, token: sessionToken };
    saveSession(s);
    setSession(s);
    navigate('/admin');
  }

  function logout() {
    clearSession();
    clearIntroSeen();
    setSession(null);
    setTeamView('game');
    setTeamData(null);
    setGameConfig(null);
    navigate('/team');
  }

  if (!authChecked) return null;

  const { role: routeRole } = route;

  // ── Intro overlay (plays on top of everything) ──
  if (teamView === 'intro' && (session?.role === 'team' || session?.role === 'host')) {
    return <DeepavaliIntro onComplete={handleIntroComplete} />;
  }

  // ── Route: /team/* ──
  if (routeRole === 'team') {
    if (session?.role === 'team') {
      // Default: show the game board (works as a waiting room before admin starts)
      return (
        <>
          <FestiveBackground />
          <PlayerGame
            teamId={session.id}
            sessionToken={session.token}
            onLeave={logout}
            gameStatus={gameConfig?.status ?? 'setup'}
          />
        </>
      );
    }
    return (
      <>
        <FestiveBackground />
        <TeamLoginPage onJoined={joinTeam} />
      </>
    );
  }

  // ── Route: /host/* ──
  if (routeRole === 'host') {
    if (session?.role === 'host' && session.stationId) {
      return (
        <>
          <FestiveBackground />
          <HostDashboardView session={session} onLogout={logout} />
        </>
      );
    }
    return (
      <>
        <FestiveBackground />
        <HostLoginPage onJoined={joinHost} />
      </>
    );
  }

  // ── Route: /admin/* ──
  if (routeRole === 'admin') {
    if (session?.role === 'admin') {
      return (
        <>
          <FestiveBackground />
          <AdminDashboard onLogout={logout} onBack={() => navigate('/admin')} />
        </>
      );
    }
    return (
      <>
        <FestiveBackground />
        <AdminLoginPage onJoined={joinAdmin} />
      </>
    );
  }

  // ── Default: redirect ──
  return (
    <>
      <FestiveBackground />
      <LandingPage />
    </>
  );
}

function HostDashboardView({
  session,
  onLogout,
}: {
  session: StoredSession;
  onLogout: () => void;
}) {
  const [host, setHost] = useState<{ id: string; name: string; station_id: string; pin: string } | null>(null);
  const [station, setStation] = useState<{ id: string; name: string; phrase: string; description: string; location_hint: string; min_reward: number; max_reward: number; max_capacity: number; bonus_enabled: boolean; icon: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: hostData } = await supabase
        .from('hosts')
        .select('*')
        .eq('id', session.id)
        .maybeSingle();
      if (hostData) {
        setHost(hostData as any);
        const { data: stationData } = await supabase
          .from('stations')
          .select('*')
          .eq('id', session.stationId)
          .maybeSingle();
        if (stationData) setStation(stationData as any);
      }
      setLoading(false);
    })();
  }, [session.id, session.stationId]);

  if (loading || !host || !station) {
    return <div className="min-h-screen flex items-center justify-center text-gold-200">Loading…</div>;
  }

  return (
    <HostDashboard
      host={host as any}
      station={station as any}
      onLogout={onLogout}
      onBack={() => navigate('/host')}
    />
  );
}
