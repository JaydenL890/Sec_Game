import { Plus, Users, X } from 'lucide-react';

export const MAX_TEAM_MEMBERS = 10;

export function TeamMemberFields({
  values,
  onChange,
}: {
  values: string[];
  onChange: (next: string[]) => void;
}) {
  function updateAt(index: number, value: string) {
    onChange(values.map((v, i) => (i === index ? value : v)));
  }

  function removeAt(index: number) {
    onChange(values.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      <label className="label-text mb-1.5 block">
        Team Members <span className="text-gold-200/40 normal-case tracking-normal">({values.length}/{MAX_TEAM_MEMBERS})</span>
      </label>
      {values.map((value, index) => (
        <div key={index} className="flex items-center gap-2 animate-pop-in">
          <div className="relative flex-1">
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gold-400/60" />
            <input
              className="input-field pl-10"
              placeholder={`Member ${index + 1} name`}
              value={value}
              onChange={(e) => updateAt(index, e.target.value)}
              maxLength={40}
            />
          </div>
          {values.length > 1 && (
            <button
              type="button"
              onClick={() => removeAt(index)}
              className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-gold-300/60 hover:text-gold-100 hover:bg-maroon-800/60 transition"
              aria-label={`Remove member ${index + 1}`}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ))}
      {values.length < MAX_TEAM_MEMBERS && (
        <button
          type="button"
          onClick={() => onChange([...values, ''])}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-gold-500/40 py-2.5 text-sm font-display font-semibold text-gold-200 hover:border-gold-400 hover:bg-maroon-800/40 transition"
        >
          <Plus className="w-4 h-4" /> Add
        </button>
      )}
    </div>
  );
}
