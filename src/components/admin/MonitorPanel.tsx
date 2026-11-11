import type { Team, Station, Tile, GameConfig, Turn } from '@/lib/types';
import { DiyaIcon } from '@/components/DiyaIcon';
import { StationIcon } from '@/components/StationIcon';
import { TILE_LABELS } from '@/lib/gameData';

export function MonitorPanel({
  teams,
  tiles,
  stations,
  turns,
  config,
}: {
  teams: Team[];
  tiles: Tile[];
  stations: Station[];
  turns: Turn[];
  config: GameConfig | null;
}) {
  const stationMap = new Map(stations.map((s) => [s.id, s]));

  const statusColor: Record<string, string> = {
    idle: 'text-jewel-300 bg-jewel-500/20',
    rolling: 'text-gold-300 bg-gold-500/20',
    traveling: 'text-flame-300 bg-flame-500/20',
    pending: 'text-marigold-300 bg-marigold-500/20',
    resting: 'text-gold-200/50 bg-maroon-600/30',
  };

  const statusLabel: Record<string, string> = {
    idle: 'Ready',
    rolling: 'Rolling',
    traveling: 'Traveling',
    pending: 'At station',
    resting: 'Resting',
  };

  return (
    <div className="space-y-4">
      {config && (
        <div className="festive-card p-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="label-text">Event Status</p>
            <p className="font-display font-bold text-gold-100 capitalize text-lg">{config.status}</p>
          </div>
          {config.started_at && (
            <div>
              <p className="label-text">Started</p>
              <p className="text-gold-200 text-sm">{new Date(config.started_at).toLocaleTimeString()}</p>
            </div>
          )}
          {config.ends_at && (
            <div>
              <p className="label-text">Ends</p>
              <p className="text-gold-200 text-sm">{new Date(config.ends_at).toLocaleTimeString()}</p>
            </div>
          )}
          <div>
            <p className="label-text">Lap Bonus</p>
            <p className="text-flame-300 font-display font-bold flex items-center gap-1">
              <DiyaIcon className="w-4 h-4" /> +{config.lap_bonus}
            </p>
          </div>
          <div>
            <p className="label-text">Teams</p>
            <p className="text-gold-100 font-display font-bold">{teams.length}</p>
          </div>
        </div>
      )}

      {/* Station occupancy */}
      <div className="festive-card p-4">
        <h3 className="label-text mb-3">Station Occupancy</h3>
        {stations.length === 0 ? (
          <p className="text-gold-200/40 text-sm text-center py-4">No stations configured</p>
        ) : (
          <div className="space-y-2">
            {stations.map((s) => {
              const load = turns.filter((t) => t.station_id === s.id && t.status === 'pending').length;
              const full = load >= s.max_capacity;
              const closed = s.max_capacity === 0;
              const pct = s.max_capacity > 0 ? Math.min(100, (load / s.max_capacity) * 100) : 0;
              return (
                <div key={s.id} className="flex items-center gap-3 bg-maroon-800/30 rounded-lg px-3 py-2 border border-gold-500/10">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-marigold-400 to-marigold-600 flex items-center justify-center shrink-0">
                    <StationIcon icon={s.icon} className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-gold-100 font-medium text-sm truncate">{s.name}</span>
                      <span className={`text-xs font-display font-bold ${closed ? 'text-marigold-300' : full ? 'text-flame-300' : 'text-jewel-300'}`}>
                        {closed ? 'Closed' : `${load} / ${s.max_capacity}`}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-maroon-950/60 mt-1 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${closed ? 'bg-marigold-500' : full ? 'bg-flame-500' : 'bg-jewel-500'}`}
                        style={{ width: `${closed ? 100 : pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="festive-card p-4">
        <h3 className="label-text mb-3">Live Team Monitor</h3>
        {teams.length === 0 ? (
          <p className="text-gold-200/40 text-sm text-center py-4">No teams have joined yet</p>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-12 gap-2 text-xs text-gold-300/60 font-semibold uppercase tracking-wider px-2 pb-2 border-b border-gold-500/20">
              <span className="col-span-4">Team</span>
              <span className="col-span-2 text-right">Balance</span>
              <span className="col-span-2 text-center">Tile</span>
              <span className="col-span-4 text-center">Status</span>
            </div>
            {teams.map((t) => {
              const tile = tiles.find((ti) => ti.tile_order === t.board_position);
              const station = tile?.station_id ? stationMap.get(tile.station_id) : null;
              const tileName = station?.name ?? TILE_LABELS[tile?.type ?? '']?.name ?? '—';
              return (
                <div key={t.id} className="grid grid-cols-12 gap-2 items-center bg-maroon-800/30 rounded-lg px-2 py-2 border border-gold-500/10">
                  <span className="col-span-4 text-gold-100 font-medium truncate flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: TEAM_HEX(t.color) }} />
                    {t.name}
                  </span>
                  <span className="col-span-2 text-flame-300 font-display font-bold text-sm text-right flex items-center justify-end gap-1">
                    <DiyaIcon className="w-3.5 h-3.5" /> {t.balance}
                  </span>
                  <span className="col-span-2 text-gold-200/70 text-xs text-center truncate">{tileName}</span>
                  <span className={`col-span-4 text-center text-xs px-2 py-1 rounded-full font-medium ${statusColor[t.status] ?? 'text-gold-200'}`}>
                    {statusLabel[t.status] ?? t.status}
                  </span>
                </div>
              );
            })}
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
