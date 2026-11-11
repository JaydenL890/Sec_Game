import type { Team } from '@/lib/types';
import { DiyaIcon } from '@/components/DiyaIcon';
import { Sparkles, ArrowRight, LogOut } from 'lucide-react';

export function StartScreen({
  team,
  onStart,
  onLeave,
}: {
  team: Team;
  onStart: () => void;
  onLeave: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center animate-pop-in">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-flame-400 via-marigold-500 to-maroon-600 mb-4 shadow-2xl shadow-marigold-900/50 border-2 border-gold-300/30">
          <DiyaIcon className="w-12 h-12 animate-flame-flicker" />
        </div>

        <h1 className="text-3xl font-display font-extrabold text-gold-200 text-shadow-gold mb-2">
          Welcome, {team.name}!
        </h1>
        <p className="text-gold-300/70 text-sm mb-6">
          Your admin has started the game! Tap below to begin your journey across the festival board.
        </p>

        <div className="festive-card p-6 mb-6">
          <div className="flex items-center justify-around">
            <div>
              <p className="label-text mb-1">Your Diyas</p>
              <p className="text-2xl font-display font-bold text-gold-100 flex items-center gap-1.5 justify-center">
                <DiyaIcon className="w-6 h-6" /> {team.balance}
              </p>
            </div>
            <div className="w-px h-12 bg-gold-500/20" />
            <div>
              <p className="label-text mb-1">Position</p>
              <p className="text-2xl font-display font-bold text-gold-100">{team.board_position}</p>
            </div>
          </div>
        </div>

        <button onClick={onStart} className="btn-primary w-full text-xl py-5 animate-flame-flicker mb-3">
          <Sparkles className="w-6 h-6" /> Start Game
          <ArrowRight className="w-6 h-6" />
        </button>

        <button onClick={onLeave} className="btn-ghost w-full text-sm">
          <LogOut className="w-4 h-4" /> Log Out
        </button>
      </div>
    </div>
  );
}
