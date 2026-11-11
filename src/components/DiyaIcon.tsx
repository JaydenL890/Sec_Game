import { Flame } from 'lucide-react';

export function DiyaIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return <Flame className={`${className} text-flame-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.6)]`} />;
}

export function DiyaBalance({ amount, className = '' }: { amount: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-display font-bold ${className}`}>
      <DiyaIcon className="w-5 h-5 animate-flame-flicker" />
      <span className="text-flame-300">{amount.toLocaleString()}</span>
      <span className="text-flame-200/70 text-sm font-medium">Diyas</span>
    </span>
  );
}
