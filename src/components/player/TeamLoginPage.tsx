import { useState } from 'react';
import { gameApi } from '@/lib/api';
import { TEAM_COLORS } from '@/lib/gameData';
import { DiyaIcon } from '@/components/DiyaIcon';
import { TeamMemberFields, MAX_TEAM_MEMBERS } from '@/components/player/TeamMemberFields';
import { Sparkles, Users, ArrowRight, LogIn, Lock, KeyRound, ScanLine, Shield } from 'lucide-react';
import { navigate } from '@/lib/session';

export function TeamLoginPage({
  onJoined,
}: {
  onJoined: (teamId: string, sessionToken: string) => void;
}) {
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [name, setName] = useState('');
  const [memberNames, setMemberNames] = useState<string[]>(['']);
  const [pin, setPin] = useState('');
  const [color, setColor] = useState(TEAM_COLORS[0].id);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRegister() {
    if (!name.trim()) { setError('Please enter a team name'); return; }
    const members = memberNames.map((m) => m.trim()).filter(Boolean);
    if (members.length === 0) { setError('Please enter at least one team member name'); return; }
    if (pin.length < 4) { setError('PIN must be at least 4 characters'); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await gameApi.teamRegister(name.trim(), pin, color, members);
      onJoined(res.teamId, res.sessionToken);
    } catch (err) {
      setError((err as Error).message || 'Could not register — that name may be taken.');
      setLoading(false);
    }
  }

  async function handleLogin() {
    if (!name.trim()) { setError('Please enter your team name'); return; }
    if (!pin) { setError('Please enter your PIN'); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await gameApi.teamLogin(name.trim(), pin);
      onJoined(res.teamId, res.sessionToken);
    } catch (err) {
      setError((err as Error).message || 'Incorrect team name or PIN.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-pop-in">
        {/* Hero */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-flame-400 via-marigold-500 to-maroon-600 mb-4 shadow-2xl shadow-marigold-900/50 border-2 border-gold-300/30">
            <DiyaIcon className="w-12 h-12 animate-flame-flicker" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-display font-extrabold text-gold-200 text-shadow-gold mb-2">
            Diya Monopoly
          </h1>
          <p className="text-gold-300/80 text-lg font-display">A Deepavali Festival Adventure</p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <span className="h-px w-12 bg-gradient-to-r from-transparent to-gold-500/50" />
            <span className="text-gold-400/60 text-xs uppercase tracking-widest">Team Sign In</span>
            <span className="h-px w-12 bg-gradient-to-l from-transparent to-gold-500/50" />
          </div>
        </div>

        <div className="festive-card p-6 sm:p-8">
          {/* Role switcher */}
          <div className="flex gap-1.5 mb-5 text-xs">
            <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gradient-to-br from-gold-400 to-marigold-500 text-maroon-950 font-semibold">
              <Users className="w-3.5 h-3.5" /> Team
            </span>
            <button
              onClick={() => navigate('/host')}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-maroon-800/50 text-gold-200/60 hover:text-gold-200 hover:bg-maroon-700/50 transition"
            >
              <ScanLine className="w-3.5 h-3.5" /> Host
            </button>
            <button
              onClick={() => navigate('/admin')}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-maroon-800/50 text-gold-200/60 hover:text-gold-200 hover:bg-maroon-700/50 transition"
            >
              <Shield className="w-3.5 h-3.5" /> Admin
            </button>
          </div>

          {/* Mode toggle */}
          <div className="flex gap-1 bg-maroon-950/60 rounded-xl p-1 mb-5">
            <button
              onClick={() => { setMode('register'); setError(null); }}
              className={`flex-1 rounded-lg py-2 text-sm font-display font-semibold transition ${
                mode === 'register' ? 'bg-gradient-to-br from-gold-400 to-marigold-500 text-maroon-950' : 'text-gold-200/60'
              }`}
            >
              <Sparkles className="w-4 h-4 inline mr-1" /> New Team
            </button>
            <button
              onClick={() => { setMode('login'); setError(null); }}
              className={`flex-1 rounded-lg py-2 text-sm font-display font-semibold transition ${
                mode === 'login' ? 'bg-gradient-to-br from-gold-400 to-marigold-500 text-maroon-950' : 'text-gold-200/60'
              }`}
            >
              <LogIn className="w-4 h-4 inline mr-1" /> Returning
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="label-text mb-1.5 block">Team Name</label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gold-400/60" />
                <input
                  className="input-field pl-10"
                  placeholder={mode === 'register' ? 'e.g. The Sparkling Diyas' : 'Enter your team name'}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={30}
                />
              </div>
            </div>

            {mode === 'register' && (
              <TeamMemberFields values={memberNames} onChange={setMemberNames} />
            )}

            <div>
              <label className="label-text mb-1.5 block">PIN</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gold-400/60" />
                <input
                  type="password"
                  className="input-field pl-10"
                  placeholder={mode === 'register' ? 'At least 4 characters' : 'Enter your PIN'}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (mode === 'register' ? handleRegister() : handleLogin())}
                />
              </div>
            </div>

            {mode === 'register' && (
              <div>
                <label className="label-text mb-2 block">Choose Your Flame Color</label>
                <div className="grid grid-cols-4 gap-2">
                  {TEAM_COLORS.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setColor(c.id)}
                      className={`flex flex-col items-center gap-1 rounded-xl p-2 border-2 transition ${
                        color === c.id
                          ? 'border-gold-400 bg-maroon-800/60 scale-105'
                          : 'border-transparent bg-maroon-950/40 hover:border-gold-500/30'
                      }`}
                    >
                      <span
                        className="w-6 h-6 rounded-full shadow-lg"
                        style={{ backgroundColor: c.hex, boxShadow: `0 0 10px ${c.hex}80` }}
                      />
                      <span className="text-[9px] text-gold-200/70">{c.name.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <p className="text-marigold-300 text-sm text-center bg-marigold-900/30 rounded-lg py-2 px-3">
                {error}
              </p>
            )}

            <button
              onClick={mode === 'register' ? handleRegister : handleLogin}
              disabled={loading || !name.trim() || !pin || (mode === 'register' && memberNames.every((m) => !m.trim()))}
              className="btn-primary w-full text-lg"
            >
              {loading ? 'Please wait…' : mode === 'register' ? (
                <>
                  <Sparkles className="w-5 h-5" /> Create Team
                  <ArrowRight className="w-5 h-5" />
                </>
              ) : (
                <>
                  <KeyRound className="w-5 h-5" /> Log In
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            {mode === 'register' ? (
              <p className="text-gold-200/40 text-xs text-center">
                Choose a name and PIN you'll remember. You'll need the PIN to rejoin from another device.
              </p>
            ) : (
              <p className="text-gold-200/40 text-xs text-center">
                Enter your exact team name and PIN to resume your game.
              </p>
            )}
          </div>
        </div>

        <p className="text-center text-gold-200/30 text-xs mt-6">
          Roll. Visit. Earn. Celebrate the festival of lights.
        </p>
      </div>
    </div>
  );
}
