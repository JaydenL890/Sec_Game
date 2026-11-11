import type { Team } from '@/lib/types';
import { DiyaIcon } from '@/components/DiyaIcon';
import { Trophy, Medal, Award } from 'lucide-react';

export function LeaderboardPanel({ teams }: { teams: Team[] }) {
  const sorted = [...teams].sort((a, b) => b.balance - a.balance);
  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  const podiumIcons = [Trophy, Medal, Award];
  const podiumColors = [
    'from-gold-300 to-gold-500',
    'from-maroon-200 to-maroon-400',
    'from-marigold-400 to-marigold-600',
  ];
  const podiumHeights = ['h-32', 'h-24', 'h-20'];

  return (
    <div className="space-y-4">
      {/* Podium */}
      {top3.length > 0 && (
        <div className="festive-card p-6">
          <h2 className="text-center font-display font-extrabold text-2xl text-gold-200 mb-4 text-shadow-gold">
            🏆 Festival Champions
          </h2>
          <div className="flex items-end justify-center gap-2 sm:gap-4">
            {top3.map((team, i) => {
              const Icon = podiumIcons[i];
              return (
                <div key={team.id} className="flex flex-col items-center gap-2 flex-1 max-w-[120px]">
                  <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${podiumColors[i]} flex items-center justify-center shadow-lg border-2 border-gold-300/40`}>
                    <Icon className="w-7 h-7 text-maroon-950" />
                  </div>
                  <p className="text-gold-100 font-display font-bold text-sm text-center truncate w-full">{team.name}</p>
                  <p className="text-flame-300 font-display font-bold flex items-center gap-1 text-sm">
                    <DiyaIcon className="w-4 h-4" /> {team.balance}
                  </p>
                  <div className={`w-full ${podiumHeights[i]} rounded-t-xl bg-gradient-to-t ${podiumColors[i]} flex items-start justify-center pt-2`}>
                    <span className="font-display font-extrabold text-maroon-950 text-lg">{i + 1}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Full ranking */}
      <div className="festive-card p-4">
        <h3 className="label-text mb-3">Full Rankings</h3>
        {sorted.length === 0 ? (
          <p className="text-gold-200/40 text-sm text-center py-4">No teams yet</p>
        ) : (
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {sorted.map((team, i) => (
              <div
                key={team.id}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border ${
                  i < 3
                    ? 'bg-gradient-to-r from-gold-500/20 to-transparent border-gold-400/30'
                    : 'bg-maroon-800/30 border-gold-500/10'
                }`}
              >
                <span className={`font-display font-extrabold text-lg w-8 text-center ${i < 3 ? 'text-gold-300' : 'text-gold-200/40'}`}>
                  {i + 1}
                </span>
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: TEAM_HEX(team.color) }} />
                <span className="text-gold-100 font-medium flex-1 truncate">{team.name}</span>
                <span className="text-flame-300 font-display font-bold flex items-center gap-1">
                  <DiyaIcon className="w-4 h-4" /> {team.balance}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
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
