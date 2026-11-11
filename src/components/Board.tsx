import { StationIcon } from './StationIcon';
import { TILE_LABELS } from '@/lib/gameData';
import type { Tile, Station } from '@/lib/types';

const TYPE_COLORS: Record<string, string> = {
  station: 'from-marigold-500 to-marigold-600 border-marigold-300',
  start: 'from-gold-400 to-gold-500 border-gold-200',
};

export function Board({
  tiles,
  stations,
  currentPosition,
  teamColor = '#fbbf24',
  compact = false,
}: {
  tiles: Tile[];
  stations: Station[];
  currentPosition: number;
  teamColor?: string;
  compact?: boolean;
}) {
  const stationMap = new Map(stations.map((s) => [s.id, s]));

  return (
    <div className={`grid grid-cols-4 gap-2 ${compact ? 'sm:grid-cols-5' : 'sm:grid-cols-4 md:grid-cols-5'}`}>
      {tiles.map((tile) => {
        const isCurrent = tile.tile_order === currentPosition;
        const station = tile.station_id ? stationMap.get(tile.station_id) : null;
        const label = TILE_LABELS[tile.type];
        const icon = station?.icon ?? label?.icon ?? 'star';
        const name = station?.name ?? label?.name ?? tile.type;

        return (
          <div
            key={tile.id}
            className={`relative rounded-xl border-2 bg-gradient-to-br p-2 transition-all ${
              TYPE_COLORS[tile.type] ?? 'from-maroon-700 to-maroon-800 border-maroon-500'
            } ${isCurrent ? 'ring-4 ring-gold-300 ring-offset-2 ring-offset-maroon-950 scale-105 z-10' : ''}`}
          >
            {isCurrent && (
              <div
                className="absolute -top-2 -right-2 w-4 h-4 rounded-full border-2 border-white shadow-lg"
                style={{ backgroundColor: teamColor }}
              />
            )}
            <div className="flex flex-col items-center text-center gap-1 min-h-[60px] justify-center">
              <StationIcon
                icon={icon}
                className={`text-white/90 ${compact ? 'w-4 h-4' : 'w-5 h-5'}`}
              />
              <span className={`text-white font-medium leading-tight ${compact ? 'text-[8px]' : 'text-[9px] sm:text-[10px]'}`}>
                {name}
              </span>
              <span className="text-white/60 text-[8px]">#{tile.tile_order + 1}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
