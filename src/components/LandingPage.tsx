import { useEffect } from 'react';
import { FestiveBackground } from '@/components/FestiveBackground';
import { navigate, getStoredSession } from '@/lib/session';

export function LandingPage() {
  useEffect(() => {
    const session = getStoredSession();
    if (session) {
      navigate(`/${session.role}`);
      return;
    }
    navigate('/team');
  }, []);

  return (
    <>
      <FestiveBackground />
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gold-200/60 text-sm animate-pulse">Loading…</p>
      </div>
    </>
  );
}
