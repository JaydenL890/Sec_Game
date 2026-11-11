import { DiyaIcon } from '@/components/DiyaIcon';
import { REWARD_MAX, REWARD_MIN } from '@/lib/gameData';

export function RewardSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-2 text-flame-300">
        <DiyaIcon className="w-6 h-6" />
        <span className="font-display font-bold text-4xl text-gold-100 tabular-nums">{value}</span>
      </div>
      <input
        type="range"
        min={REWARD_MIN}
        max={REWARD_MAX}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Reward in Diyas"
        className="w-full cursor-pointer accent-flame-400"
      />
      <div className="flex justify-between text-xs text-gold-200/60 font-medium">
        <span>{REWARD_MIN} Diyas</span>
        <span>{REWARD_MAX} Diyas</span>
      </div>
    </div>
  );
}
