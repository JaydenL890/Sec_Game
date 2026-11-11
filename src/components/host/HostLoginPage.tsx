import { useState } from 'react';
import { gameApi } from '@/lib/api';
import { DiyaIcon } from '@/components/DiyaIcon';
import { ScanLine, Lock, User, Users, Shield, Camera, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { navigate } from '@/lib/session';

type LoginStep = 'form' | 'camera-permission' | 'camera-granted';

export function HostLoginPage({
  onJoined,
}: {
  onJoined: (hostId: string, stationId: string, sessionToken: string) => void;
}) {
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<LoginStep>('form');
  const [pendingCreds, setPendingCreds] = useState<{ hostId: string; stationId: string; sessionToken: string } | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  async function handleLogin() {
    if (!name.trim()) { setError('Please enter your host name'); return; }
    if (!pin) { setError('Please enter your PIN'); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await gameApi.hostLogin(name.trim(), pin);
      setPendingCreds(res);
      setLoading(false);
      setStep('camera-permission');
    } catch (err) {
      setError((err as Error).message || 'Invalid host credentials.');
      setLoading(false);
    }
  }

  async function enableCamera(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      const videoElement = document.querySelector('video');
      if (videoElement) {
        videoElement.srcObject = stream;
      }
      return true;
    } catch (err) {
      console.error('Camera access denied or unavailable:', err);
      return false;
    }
  }

  async function requestCameraPermission() {
    setCameraError(null);
    setLoading(true);

    // Try multiple approaches for cross-platform / app compatibility
    const constraints = [
      { video: { facingMode: { exact: 'environment' } } },
      { video: { facingMode: 'environment' } },
      { video: true },
      { video: {} },
    ];

    let success = false;

    for (let i = 0; i < constraints.length; i++) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints[i]);
        stream.getTracks().forEach((t) => t.stop());
        success = true;
        break;
      } catch (err) {
        if (i < constraints.length - 1) continue;

        const error = err as DOMException;
        let msg = 'Camera access was denied. You can still log in, but you\'ll need to use manual PIN entry instead of QR scanning.';

        if (error.name === 'NotAllowedError') {
          msg = 'Camera permission was denied. Please enable camera access in your app settings, then try again. You can still continue with manual PIN entry.';
        } else if (error.name === 'NotFoundError') {
          msg = 'No camera was found on this device. You can still continue with manual PIN entry.';
        } else if (error.name === 'NotReadableError') {
          msg = 'The camera is already in use by another app. Close it and try again, or continue with manual PIN entry.';
        }

        setLoading(false);
        setCameraError(msg);
        setStep('camera-granted');
      }
    }

    if (success) {
      setLoading(false);
      setStep('camera-granted');
    }
  }

  function proceedToDashboard() {
    if (pendingCreds) {
      onJoined(pendingCreds.hostId, pendingCreds.stationId, pendingCreds.sessionToken);
    }
  }

  if (step === 'camera-permission' || step === 'camera-granted') {
    const granted = step === 'camera-granted' && !cameraError;
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md animate-pop-in">
          <div className="text-center mb-6">
            <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full mb-4 shadow-2xl border-2 border-gold-300/30 ${granted ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-900/50' : 'bg-gradient-to-br from-jewel-400 via-jewel-500 to-jewel-700 shadow-jewel-900/50'}`}>
              {granted ? <CheckCircle2 className="w-12 h-12 text-white" /> : <Camera className="w-12 h-12 text-white" />}
            </div>
            <h1 className="text-3xl font-display font-extrabold text-gold-200 text-shadow-gold mb-2">
              {granted ? 'Camera Ready!' : 'Camera Permission'}
            </h1>
            <p className="text-gold-300/80 text-sm">
              {granted
                ? cameraError
                  ? 'You can still continue with manual PIN entry.'
                  : 'Your camera is ready for QR scanning.'
                : 'You need camera access to scan team QR codes. Tap below to allow it.'}
            </p>
          </div>

          <div className="festive-card p-6 sm:p-8">
            {cameraError && (
              <div className="flex items-start gap-3 mb-4 p-3 rounded-lg bg-marigold-900/30 border border-marigold-500/30">
                <AlertCircle className="w-5 h-5 text-marigold-300 flex-shrink-0 mt-0.5" />
                <p className="text-marigold-200 text-xs">{cameraError}</p>
              </div>
            )}

            {step === 'camera-permission' && !cameraError && (
              <button
                onClick={requestCameraPermission}
                disabled={loading}
                className="btn-primary w-full text-lg"
              >
                {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Requesting…</> : <><Camera className="w-5 h-5" /> Allow Camera Access</>}
              </button>
            )}

            {step === 'camera-granted' && (
              <button
                onClick={proceedToDashboard}
                className="btn-primary w-full text-lg"
              >
                {granted ? <><ScanLine className="w-5 h-5" /> Go to Scanner</> : <><ScanLine className="w-5 h-5" /> Continue</>}
              </button>
            )}

            <button
              onClick={() => {
                setStep('form');
                setCameraError(null);
                setPendingCreds(null);
              }}
              className="btn-ghost w-full text-sm mt-3"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-pop-in">
        {/* Hero */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-jewel-400 via-jewel-500 to-jewel-700 mb-4 shadow-2xl shadow-jewel-900/50 border-2 border-gold-300/30">
            <ScanLine className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-display font-extrabold text-gold-200 text-shadow-gold mb-2">
            Station Host
          </h1>
          <p className="text-gold-300/80 text-lg font-display">Scan teams and reward their efforts</p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <span className="h-px w-12 bg-gradient-to-r from-transparent to-gold-500/50" />
            <span className="text-gold-400/60 text-xs uppercase tracking-widest">Host Sign In</span>
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
            <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gradient-to-br from-jewel-400 to-jewel-600 text-white font-semibold">
              <ScanLine className="w-3.5 h-3.5" /> Host
            </span>
            <button
              onClick={() => navigate('/admin')}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-maroon-800/50 text-gold-200/60 hover:text-gold-200 hover:bg-maroon-700/50 transition"
            >
              <Shield className="w-3.5 h-3.5" /> Admin
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="label-text mb-1.5 block">Host Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gold-400/60" />
                <input
                  className="input-field pl-10"
                  placeholder="e.g. Host of Laser Maze"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                />
              </div>
            </div>

            <div>
              <label className="label-text mb-1.5 block">PIN</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gold-400/60" />
                <input
                  type="password"
                  className="input-field pl-10"
                  placeholder="Enter your PIN"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                />
              </div>
            </div>

            {error && (
              <p className="text-marigold-300 text-sm text-center bg-marigold-900/30 rounded-lg py-2 px-3">
                {error}
              </p>
            )}

            <button onClick={handleLogin} disabled={loading || !name.trim() || !pin} className="btn-primary w-full text-lg">
              {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Checking…</> : <><ScanLine className="w-5 h-5" /> Log In</>}
            </button>

            <p className="text-gold-200/40 text-xs text-center">
              Your account is tied to one station. You'll go straight to that station's scanner after logging in.
            </p>
          </div>
        </div>

        <p className="text-center text-gold-200/30 text-xs mt-6">
          Diya Monopoly — A Deepavali Festival Adventure
        </p>
      </div>
    </div>
  );
}
