import { supabase } from '@/lib/supabase';
import type { Station, Turn } from '@/lib/types';
import { StationIcon } from '@/components/StationIcon';
import { Save, X, Users, AlertCircle } from 'lucide-react';
import { useState } from 'react';

export function StationsPanel({
  stations,
  turns,
  onRefresh,
}: {
  stations: Station[];
  turns: Turn[];
  onRefresh: () => void;
}) {
  const [editing, setEditing] = useState<Station | null>(null);
  const [form, setForm] = useState<Partial<Station>>({});
  const [saving, setSaving] = useState(false);

  // Count pending turns per station for live occupancy
  const loadMap = new Map<string, number>();
  for (const t of turns) {
    if (t.status === 'pending') {
      loadMap.set(t.station_id, (loadMap.get(t.station_id) ?? 0) + 1);
    }
  }

  function startEdit(s: Station) {
    setEditing(s);
    setForm(s);
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    await supabase.from('stations').update({
      name: form.name,
      phrase: form.phrase,
      description: form.description,
      location_hint: form.location_hint,
      min_reward: form.min_reward,
      max_reward: form.max_reward,
      max_capacity: form.max_capacity,
      bonus_enabled: form.bonus_enabled,
    }).eq('id', editing.id);
    setSaving(false);
    setEditing(null);
    onRefresh();
  }

  async function setCapacity(s: Station, cap: number) {
    await supabase.from('stations').update({ max_capacity: Math.max(0, cap) }).eq('id', s.id);
    onRefresh();
  }

  return (
    <div className="space-y-3">
      <div className="festive-card p-3 flex items-center gap-2 text-sm text-gold-200/70">
        <AlertCircle className="w-4 h-4 text-gold-400 shrink-0" />
        <span>Capacity controls how many teams can be assigned to a station at once. Set to 0 to close a station.</span>
      </div>

      {stations.map((s) => {
        const load = loadMap.get(s.id) ?? 0;
        const full = load >= s.max_capacity;
        const closed = s.max_capacity === 0;

        return (
          <div key={s.id} className="festive-card p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-marigold-400 to-marigold-600 flex items-center justify-center shrink-0">
                <StationIcon icon={s.icon} className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-bold text-gold-100">{s.name}</h3>
                  <button onClick={() => startEdit(s)} className="btn-ghost text-xs py-1.5">Edit</button>
                </div>
                <p className="text-gold-200/60 text-xs mt-0.5">{s.description}</p>
                <div className="flex items-center gap-3 mt-1 text-xs">
                  <span className="text-flame-300">{s.min_reward}–{s.max_reward} Diyas</span>
                  <span className="text-jewel-300/70">{s.location_hint}</span>
                </div>

                {/* Capacity row */}
                <div className="flex items-center gap-2 mt-3">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setCapacity(s, s.max_capacity - 1)}
                      className="w-7 h-7 rounded-lg bg-maroon-800/60 hover:bg-maroon-700/60 text-gold-200 font-bold text-lg flex items-center justify-center transition"
                    >
                      −
                    </button>
                    <div className={`px-3 py-1 rounded-lg font-display font-bold text-sm min-w-[80px] text-center ${
                      closed ? 'bg-maroon-700/50 text-marigold-300' :
                      full ? 'bg-flame-500/30 text-flame-300' :
                      'bg-jewel-500/20 text-jewel-300'
                    }`}>
                      {load} / {s.max_capacity}
                    </div>
                    <button
                      onClick={() => setCapacity(s, s.max_capacity + 1)}
                      className="w-7 h-7 rounded-lg bg-maroon-800/60 hover:bg-maroon-700/60 text-gold-200 font-bold text-lg flex items-center justify-center transition"
                    >
                      +
                    </button>
                  </div>
                  <span className="text-xs text-gold-200/50 flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {closed ? 'Closed' : full ? 'Full' : 'Open'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-maroon-950/90 flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-lg festive-card p-5 space-y-3 animate-pop-in my-8">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-gold-200">Edit {editing.name}</h3>
              <button onClick={() => setEditing(null)} className="text-gold-300/60"><X className="w-5 h-5" /></button>
            </div>
            <Field label="Name"><input className="input-field" value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Activity Description"><textarea className="input-field" rows={2} value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <Field label="Phrase Shown to Team"><textarea className="input-field" rows={2} value={form.phrase ?? ''} onChange={(e) => setForm({ ...form, phrase: e.target.value })} /></Field>
            <Field label="Location Hint"><input className="input-field" value={form.location_hint ?? ''} onChange={(e) => setForm({ ...form, location_hint: e.target.value })} /></Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Min Reward"><input type="number" className="input-field" value={form.min_reward ?? 0} onChange={(e) => setForm({ ...form, min_reward: parseInt(e.target.value) || 0 })} /></Field>
              <Field label="Max Reward"><input type="number" className="input-field" value={form.max_reward ?? 0} onChange={(e) => setForm({ ...form, max_reward: parseInt(e.target.value) || 0 })} /></Field>
              <Field label="Max Capacity"><input type="number" min={0} className="input-field" value={form.max_capacity ?? 2} onChange={(e) => setForm({ ...form, max_capacity: parseInt(e.target.value) || 0 })} /></Field>
            </div>
            <label className="flex items-center gap-2 text-gold-200 text-sm">
              <input type="checkbox" checked={form.bonus_enabled ?? true} onChange={(e) => setForm({ ...form, bonus_enabled: e.target.checked })} />
              Enable performance bonus
            </label>
            <button onClick={save} disabled={saving} className="btn-primary w-full">
              <Save className="w-5 h-5" /> {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label-text mb-1 block">{label}</label>
      {children}
    </div>
  );
}
