import { useState } from 'react';
import { gameApi } from '@/lib/api';
import { Shield, User, KeyRound, Users, ScanLine } from 'lucide-react';
import { navigate } from '@/lib/session';

export function AdminLoginPage({
  onJoined,
}: {
  onJoined: (adminId: string, sessionToken: string) => void;
}) {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    if (!username.trim()) { setError('Please enter your username'); return; }
    if (!pin.trim()) { setError('Please enter your PIN'); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await gameApi.adminLogin(username.trim(), pin.trim());
      onJoined(res.adminId, res.sessionToken);
    } catch (err) {
      setError((err as Error).message || 'Invalid admin credentials.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-pop-in">
        {/* Hero */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-maroon-600 via-maroon-700 to-maroon-900 mb-4 shadow-2xl shadow-maroon-900/60 border-2 border-gold-500/40">
            <Shield className="w-12 h-12 text-gold-300" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-display font-extrabold text-gold-200 text-shadow-gold mb-2">
            Game Admin
          </h1>
          <p className="text-gold-300/80 text-lg font-display">Manage the Diya Monopoly event</p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <span className="h-px w-12 bg-gradient-to-r from-transparent to-gold-500/50" />
            <span className="text-gold-400/60 text-xs uppercase tracking-widest">Admin Sign In</span>
            <span className="h-px w-12 bg-gradient-to-l from-transparent to-gold-500/50" />
          </div>
        </div>

        <div className="festive-card p-6 sm:p-8">
          {/* Role switcher */}
          <div className="flex gap-1.5 mb-5 text-xs">
            <button
              onClick={() => navigate('/team')}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-maroon-800/50 text-gold-200/60 hover:text-gold-200 hover:bg-maroon-700/50 transition"
            >
              <Users className="w-3.5 h-3.5" /> Team
            </button>
            <button
              onClick={() => navigate('/host')}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-maroon-800/50 text-gold-200/60 hover:text-gold-200 hover:bg-maroon-700/50 transition"
            >
              <ScanLine className="w-3.5 h-3.5" /> Host
            </button>
            <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gradient-to-br from-maroon-600 to-maroon-800 text-gold-300 font-semibold border border-gold-500/40">
              <Shield className="w-3.5 h-3.5" /> Admin
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="label-text mb-1.5 block">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gold-400/60" />
                <input
                  className="input-field pl-10"
                  placeholder="admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                />
              </div>
            </div>

            <div>
              <label className="label-text mb-1.5 block">PIN</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gold-400/60" />
                <input
                  type="password"
                  className="input-field pl-10"
                  placeholder="Enter your PIN"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                />
              </div>
              <p className="text-gold-200/40 text-xs mt-1.5">
                This PIN is shared only with organizers. Ask the event lead if you don't have it.
              </p>
            </div>

            {error && (
              <p className="text-marigold-300 text-sm text-center bg-marigold-900/30 rounded-lg py-2 px-3">
                {error}
              </p>
            )}

            <button onClick={handleLogin} disabled={loading || !username.trim() || !pin} className="btn-primary w-full text-lg">
              {loading ? 'Checking…' : <><Shield className="w-5 h-5" /> Log In</>}
            </button>
          </div>
        </div>

        <p className="text-center text-gold-200/30 text-xs mt-6">
          Diya Monopoly — A Deepavali Festival Adventure
        </p>
      </div>
    </div>
  );
}
