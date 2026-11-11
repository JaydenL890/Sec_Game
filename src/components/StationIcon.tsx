import {
  Brain, Puzzle, Scroll, Shirt, Zap, Circle, Palette,
  Coffee, Star, ScanLine, Waypoints,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  brain: Brain,
  mirror: ScanLine,
  puzzle: Puzzle,
  scroll: Scroll,
  shirt: Shirt,
  zap: Zap,
  circle: Circle,
  palette: Palette,
  gate: Waypoints,
  sweet: Coffee,
  flame: Star,
  star: Star,
};

export function StationIcon({ icon, className = 'w-6 h-6' }: { icon: string; className?: string }) {
  const Icon = ICONS[icon] ?? Star;
  return <Icon className={className} />;
}
