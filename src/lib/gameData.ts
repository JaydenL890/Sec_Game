export const TILE_LABELS: Record<string, { name: string; icon: string; description: string }> = {
  start: { name: 'Diwali Gate', icon: 'gate', description: 'Pass or land here to collect a Diya bonus!' },
};

export const TEAM_COLORS = [
  { id: 'amber', name: 'Amber Flame', hex: '#fbbf24' },
  { id: 'rose', name: 'Rose Flame', hex: '#f43f5e' },
  { id: 'teal', name: 'Teal Flame', hex: '#2dd4bf' },
  { id: 'violet', name: 'Violet Flame', hex: '#a78bfa' },
  { id: 'emerald', name: 'Emerald Flame', hex: '#34d399' },
  { id: 'sky', name: 'Sky Flame', hex: '#38bdf8' },
  { id: 'orange', name: 'Marigold Flame', hex: '#fb923c' },
  { id: 'pink', name: 'Pink Flame', hex: '#f472b6' },
];

export function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export const REWARD_MIN = 20;
export const REWARD_MAX = 200;

export function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}
