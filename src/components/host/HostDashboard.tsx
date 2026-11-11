import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { gameApi } from '@/lib/api';
import type { Host, Station, Turn } from '@/lib/types';
import { StationIcon } from '@/components/StationIcon';
import { DiyaIcon } from '@/components/DiyaIcon';
import { QRScanner } from '@/components/QRScanner';
import { RewardSlider } from '@/components/host/RewardSlider';
import { REWARD_MAX, REWARD_MIN } from '@/lib/gameData';
import { ScanLine, CheckCircle2, AlertCircle, X, LogOut, History, Keyboard, Home } from 'lucide-react';

interface ProcessedLog {
  teamName: string;
  reward: number;
  time: string;
}

export function HostDashboard({
  host,
  station,
  onLogout,
  onBack,
}: {
  host: Host;
  station: Station;
  onLogout: () => void;
  onBack: () => void;
}) {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string; detail?: string } | null>(null);
  const [reward, setReward] = useState(100);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [logs, setLogs] = useState<ProcessedLog[]>([]);
  const [showPinEntry, setShowPinEntry] = useState(false);
  const [pinTeamId, setPinTeamId] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  useEffect(() => {
    // Load today's processed turns for this station
    supabase
      .from('turns')
      .select('*, teams(name)')
      .eq('station_id', station.id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (data) {
          setLogs(
            data.map((t: any) => ({
              teamName: t.teams?.name ?? 'Unknown',
              reward: t.reward ?? 0,
              time: new Date(t.completed_at).toLocaleTimeString(),
            })),
          );
        }
      });
  }, [station.id]);

  async function handleScan(text: string) {
    setScanning(false);
    setPendingToken(text);
    setResult(null);
  }

  async function confirmScan() {
    if (!pendingToken) return;
    try {
      const res = await gameApi.scan(pendingToken, host.id, reward);
      setResult({
        ok: true,
        text: `${res.teamName} earned ${res.reward} Diyas!`,
      });
      setLogs((prev) => [
        { teamName: res.teamName, reward: res.reward, time: new Date().toLocaleTimeString() },
        ...prev,
      ]);
    } catch (err) {
      setResult({ ok: false, text: (err as Error).message });
    }
    setPendingToken(null);
  }

  async function handlePinVerify() {
    setPinError(null);
    try {
      const res = await gameApi.pinVerify(pinTeamId, host.id, reward);
      setResult({
        ok: true,
        text: `${res.teamName} earned ${res.reward} Diyas!`,
      });
      setLogs((prev) => [
        { teamName: res.teamName, reward: res.reward, time: new Date().toLocaleTimeString() },
        ...prev,
      ]);
      setShowPinEntry(false);
      setPinTeamId('');
    } catch (err) {
      setPinError((err as Error).message);
    }
  }

  return (
    <div className="min-h-screen pb-8">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-maroon-950/90 backdrop-blur-md border-b border-gold-500/20 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-jewel-400 to-jewel-600 flex items-center justify-center">
              <StationIcon icon={station.icon} className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-display font-bold text-gold-100 text-sm">{station.name}</p>
              <p className="text-jewel-300/70 text-xs">{station.location_hint}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onBack} className="text-gold-300/60 hover:text-gold-100" title="Back to Home">
              <Home className="w-5 h-5" />
            </button>
            <button onClick={onLogout} className="text-gold-300/60 hover:text-gold-100" title="Switch Station">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        {/* Station info */}
        <div className="festive-card p-4">
          <p className="text-gold-200/70 text-sm">{station.description}</p>
          <div className="flex items-center gap-4 mt-2 text-xs">
            <span className="text-flame-300 flex items-center gap-1">
              <DiyaIcon className="w-4 h-4" /> {REWARD_MIN}–{REWARD_MAX} reward
            </span>
          </div>
        </div>

        {/* Scan button */}
        {!pendingToken && !result && (
          <div className="festive-card p-6 flex flex-col items-center gap-3">
            <button onClick={() => setScanning(true)} className="btn-primary text-lg px-10 py-5">
              <ScanLine className="w-6 h-6" /> Scan QR Code
            </button>
            <button onClick={() => setShowPinEntry(true)} className="btn-ghost text-sm">
              <Keyboard className="w-4 h-4" /> Manual PIN Entry
            </button>
          </div>
        )}

        {/* Performance selector + confirm */}
        {pendingToken && (
          <div className="festive-card p-5 space-y-4 animate-pop-in">
            <p className="text-gold-100 text-center font-display font-semibold">Choose this team's reward</p>
            <RewardSlider value={reward} onChange={setReward} />
            <div className="flex gap-2">
              <button onClick={() => setPendingToken(null)} className="btn-ghost flex-1">
                Cancel
              </button>
              <button onClick={confirmScan} className="btn-primary flex-1">
                <CheckCircle2 className="w-5 h-5" /> Confirm & Reward
              </button>
            </div>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className={`festive-card p-5 animate-pop-in ${result.ok ? 'border-jewel-400/50' : 'border-marigold-400/50'}`}>
            <div className="flex items-start gap-3">
              {result.ok ? (
                <CheckCircle2 className="w-8 h-8 text-jewel-400 shrink-0" />
              ) : (
                <AlertCircle className="w-8 h-8 text-marigold-400 shrink-0" />
              )}
              <div className="flex-1">
                <p className={`font-display font-bold ${result.ok ? 'text-jewel-300' : 'text-marigold-300'}`}>
                  {result.text}
                </p>
                {result.detail && <p className="text-gold-200/60 text-sm">{result.detail}</p>}
              </div>
              <button onClick={() => setResult(null)} className="text-gold-300/60 hover:text-gold-100">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* PIN entry modal */}
        {showPinEntry && (
          <div className="fixed inset-0 z-50 bg-maroon-950/90 flex items-center justify-center p-4">
            <div className="w-full max-w-sm festive-card p-5 space-y-3 animate-pop-in">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-gold-200">Manual PIN Entry</h3>
                <button onClick={() => setShowPinEntry(false)} className="text-gold-300/60 hover:text-gold-100">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-gold-200/60 text-xs">Enter the team's 8-character PIN shown on their screen.</p>
              <input
                className="input-field text-center text-lg tracking-widest font-mono"
                placeholder="ABCD1234"
                value={pinTeamId}
                onChange={(e) => setPinTeamId(e.target.value)}
                maxLength={8}
              />
              {pinError && <p className="text-marigold-300 text-sm">{pinError}</p>}
              <RewardSlider value={reward} onChange={setReward} />
              <button onClick={handlePinVerify} className="btn-primary w-full">
                <CheckCircle2 className="w-5 h-5" /> Verify & Reward
              </button>
            </div>
          </div>
        )}

        {/* Today's log */}
        <div className="festive-card p-4">
          <h3 className="label-text mb-3 flex items-center gap-2">
            <History className="w-4 h-4" /> Teams Processed Today ({logs.length})
          </h3>
          {logs.length === 0 ? (
            <p className="text-gold-200/40 text-sm text-center py-3">No teams yet</p>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {logs.map((log, i) => (
                <div key={i} className="flex items-center justify-between text-sm border-b border-gold-500/10 pb-1.5">
                  <span className="text-gold-100 truncate">{log.teamName}</span>
                  <span className="text-gold-200/50 text-xs">{log.time}</span>
                  <span className="text-flame-300 font-display font-bold ml-2 flex items-center gap-1">
                    <DiyaIcon className="w-4 h-4" /> +{log.reward}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Scanner overlay */}
      {scanning && <QRScanner onScan={handleScan} onClose={() => setScanning(false)} />}
    </div>
  );
}
