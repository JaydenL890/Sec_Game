import { supabase } from '@/lib/supabase';
import { gameApi } from '@/lib/api';
import type { Team, Station, Tile, GameConfig } from '@/lib/types';
import { DiyaIcon } from '@/components/DiyaIcon';
import { StationIcon } from '@/components/StationIcon';
import { TILE_LABELS } from '@/lib/gameData';
import { Plus, Trash2, Coins, Download, KeyRound } from 'lucide-react';
import { useState } from 'react';

export function TeamsPanel({ teams, onRefresh }: { teams: Team[]; onRefresh: () => void }) {
  const [name, setName] = useState('');
  const [adjustTeam, setAdjustTeam] = useState<Team | null>(null);
  const [adjustAmount, setAdjustAmount] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');
  const [resetTeam, setResetTeam] = useState<Team | null>(null);
  const [newPin, setNewPin] = useState('');
  const [resetting, setResetting] = useState(false);

  async function addTeam() {
    if (!name.trim()) return;
    await supabase.from('teams').insert({
      name: name.trim(),
      balance: 0,
      board_position: 0,
      status: 'idle',
      color: 'amber',
    });
    setName('');
    onRefresh();
  }

  async function deleteTeam(id: string) {
    if (!confirm('Delete this team? All their data will be lost.')) return;
    await supabase.from('teams').delete().eq('id', id);
    onRefresh();
  }

  async function doAdjust() {
    if (!adjustTeam) return;
    try {
      await gameApi.adjust(adjustTeam.id, adjustAmount, adjustReason);
      setAdjustTeam(null);
      setAdjustAmount(0);
      setAdjustReason('');
      onRefresh();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  async function doResetPin() {
    if (!resetTeam || !newPin) return;
    if (newPin.length < 4) { alert('PIN must be at least 4 characters'); return; }
    setResetting(true);
    try {
      await gameApi.resetPin(resetTeam.id, newPin);
      setResetTeam(null);
      setNewPin('');
    } catch (err) {
      alert((err as Error).message);
    }
    setResetting(false);
  }

  function exportCSV() {
    const rows = ['Name,Balance,Position,Status,Created'];
    teams.forEach((t) => {
      rows.push(`${t.name},${t.balance},${t.board_position},${t.status},${t.created_at}`);
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'teams.csv';
    a.click();
  }

  return (
    <div className="space-y-4">
      <div className="festive-card p-4">
        <h3 className="label-text mb-2">Add Team</h3>
        <div className="flex gap-2">
          <input
            className="input-field"
            placeholder="Team name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTeam()}
          />
          <button onClick={addTeam} className="btn-primary shrink-0">
            <Plus className="w-5 h-5" /> Add
          </button>
        </div>
      </div>

      <div className="festive-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="label-text">All Teams ({teams.length})</h3>
          <button onClick={exportCSV} className="btn-ghost text-xs py-1.5">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>
        {teams.length === 0 ? (
          <p className="text-gold-200/40 text-sm text-center py-4">No teams yet</p>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {teams.map((t) => (
              <div key={t.id} className="flex items-center justify-between bg-maroon-800/40 rounded-xl px-3 py-2.5 border border-gold-500/10">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: TEAM_HEX(t.color) }} />
                  <span className="text-gold-100 font-medium truncate">{t.name}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-flame-300 font-display font-bold text-sm flex items-center gap-1">
                    <DiyaIcon className="w-4 h-4" /> {t.balance}
                  </span>
                  <span className="text-gold-200/50 text-xs capitalize w-20 text-center">{t.status}</span>
                  <button onClick={() => setAdjustTeam(t)} className="text-jewel-300 hover:text-jewel-200" title="Adjust balance">
                    <Coins className="w-4 h-4" />
                  </button>
                  <button onClick={() => setResetTeam(t)} className="text-gold-300 hover:text-gold-200" title="Reset PIN">
                    <KeyRound className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteTeam(t.id)} className="text-marigold-300 hover:text-marigold-200" title="Delete team">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Adjust modal */}
      {adjustTeam && (
        <div className="fixed inset-0 z-50 bg-maroon-950/90 flex items-center justify-center p-4">
          <div className="w-full max-w-sm festive-card p-5 space-y-3 animate-pop-in">
            <h3 className="font-display font-bold text-gold-200">Adjust {adjustTeam.name}</h3>
            <p className="text-gold-200/60 text-sm">Current balance: {adjustTeam.balance} Diyas</p>
            <div>
              <label className="label-text mb-1 block">Amount (+/-)</label>
              <input
                type="number"
                className="input-field"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="label-text mb-1 block">Reason</label>
              <input
                className="input-field"
                placeholder="e.g. Dispute correction"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setAdjustTeam(null)} className="btn-ghost flex-1">Cancel</button>
              <button onClick={doAdjust} className="btn-primary flex-1">Apply</button>
            </div>
          </div>
        </div>
      )}

      {/* Reset PIN modal */}
      {resetTeam && (
        <div className="fixed inset-0 z-50 bg-maroon-950/90 flex items-center justify-center p-4">
          <div className="w-full max-w-sm festive-card p-5 space-y-3 animate-pop-in">
            <h3 className="font-display font-bold text-gold-200 flex items-center gap-2">
              <KeyRound className="w-5 h-5" /> Reset {resetTeam.name}'s PIN
            </h3>
            <p className="text-gold-200/60 text-sm">
              Set a new PIN for this team. Tell the team the new PIN so they can log in.
            </p>
            <div>
              <label className="label-text mb-1 block">New PIN</label>
              <input
                type="text"
                className="input-field"
                placeholder="At least 4 characters"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && doResetPin()}
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setResetTeam(null)} className="btn-ghost flex-1">Cancel</button>
              <button onClick={doResetPin} disabled={resetting} className="btn-primary flex-1">
                <KeyRound className="w-4 h-4" /> {resetting ? 'Resetting…' : 'Reset PIN'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TEAM_HEX(id: string): string {
  const map: Record<string, string> = {
    amber: '#fbbf24', rose: '#f43f5e', teal: '#2dd4bf', violet: '#a78bfa',
    emerald: '#34d399', sky: '#38bdf8', orange: '#fb923c', pink: '#f472b6',
  };
  return map[id] ?? '#fbbf24';
}
