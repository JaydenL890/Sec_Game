import { supabase } from '@/lib/supabase';
import type { Tile, Station } from '@/lib/types';
import { StationIcon } from '@/components/StationIcon';
import { TILE_LABELS } from '@/lib/gameData';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';

export function BoardPanel({ tiles, stations, onRefresh }: { tiles: Tile[]; stations: Station[]; onRefresh: () => void }) {
  const stationMap = new Map(stations.map((s) => [s.id, s]));

  async function moveTile(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= tiles.length) return;
    const a = tiles[index];
    const b = tiles[target];
    await Promise.all([
      supabase.from('tiles').update({ tile_order: b.tile_order }).eq('id', a.id),
      supabase.from('tiles').update({ tile_order: a.tile_order }).eq('id', b.id),
    ]);
    onRefresh();
  }

  async function deleteTile(id: string) {
    if (!confirm('Remove this tile from the board?')) return;
    await supabase.from('tiles').delete().eq('id', id);
    onRefresh();
  }

  async function addTile(type: string) {
    const maxOrder = tiles.reduce((m, t) => Math.max(m, t.tile_order), -1);
    await supabase.from('tiles').insert({ tile_order: maxOrder + 1, type });
    onRefresh();
  }

  return (
    <div className="space-y-4">
      <div className="festive-card p-4">
        <h3 className="label-text mb-2">Add Tile</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(TILE_LABELS).map(([type, info]) => (
            <button
              key={type}
              onClick={() => addTile(type)}
              className="btn-ghost text-xs py-1.5 flex items-center gap-1.5"
            >
              <StationIcon icon={info.icon} className="w-3.5 h-3.5" /> {info.name}
            </button>
          ))}
        </div>
      </div>

      <div className="festive-card p-4">
        <h3 className="label-text mb-3">Board Sequence ({tiles.length} tiles)</h3>
        <div className="space-y-2">
          {tiles.map((tile, i) => {
            const station = tile.station_id ? stationMap.get(tile.station_id) : null;
            const label = TILE_LABELS[tile.type];
            return (
              <div key={tile.id} className="flex items-center gap-2 bg-maroon-800/40 rounded-xl px-3 py-2 border border-gold-500/10">
                <span className="text-gold-200/40 text-xs font-mono w-6">{i + 1}</span>
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gold-400 to-marigold-500 flex items-center justify-center shrink-0">
                  <StationIcon icon={station?.icon ?? label?.icon ?? 'star'} className="w-4 h-4 text-maroon-950" />
                </div>
                <span className="text-gold-100 text-sm flex-1 truncate">
                  {station?.name ?? label?.name ?? tile.type}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => moveTile(i, -1)} disabled={i === 0} className="text-gold-300/60 hover:text-gold-100 disabled:opacity-30">
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button onClick={() => moveTile(i, 1)} disabled={i === tiles.length - 1} className="text-gold-300/60 hover:text-gold-100 disabled:opacity-30">
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteTile(tile.id)} className="text-marigold-300 hover:text-marigold-200">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
