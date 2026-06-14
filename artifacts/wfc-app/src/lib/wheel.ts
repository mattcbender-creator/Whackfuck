export type WheelItemId =
  | 'green_shell'
  | 'red_shell'
  | 'blue_shell'
  | 'banana'
  | 'lightning'
  | 'mushroom'
  | 'super_star'
  | 'boo';

// 'none' — auto effect, no user pick required
// 'any'  — user picks any other team
export type SelectionMode = 'none' | 'any';

export interface WheelItem {
  id: WheelItemId;
  label: string;
  short: string;
  emojiLess: string;
  color: string;
  textColor: string;
  selection: SelectionMode;
  description: string;
  flavor: string;
}

// Order MUST match the image, going clockwise starting from the pointer at TOP.
// Image order (clockwise from top): Green Shell, Red Shell, Blue Shell, Banana,
// Lightning, Mushroom, Super Star, Boo.
export const WHEEL_ITEMS: WheelItem[] = [
  {
    id: 'green_shell',
    label: 'Green Shell',
    short: 'GREEN',
    emojiLess: 'GS',
    color: '#2ecc40',
    textColor: '#ffffff',
    selection: 'none',
    flavor: 'Random attack',
    description: '+1 stroke to a random team (any team in the tournament).',
  },
  {
    id: 'red_shell',
    label: 'Red Shell',
    short: 'RED',
    emojiLess: 'RS',
    color: '#e63946',
    textColor: '#ffffff',
    selection: 'any',
    flavor: 'Targeted attack',
    description: 'Pick any team → +1 stroke.',
  },
  {
    id: 'blue_shell',
    label: 'Blue Shell',
    short: 'BLUE',
    emojiLess: 'BS',
    color: '#2a9df4',
    textColor: '#ffffff',
    selection: 'none',
    flavor: 'Auto leader',
    description: '+1 stroke to current 1st place leader (hits you if you\'re leading).',
  },
  {
    id: 'banana',
    label: 'Banana',
    short: 'BANANA',
    emojiLess: 'BN',
    color: '#f4d35e',
    textColor: '#1a1a1a',
    selection: 'none',
    flavor: 'Slipped!',
    description: '+1 stroke to a random other team on the course.',
  },
  {
    id: 'lightning',
    label: 'Lightning',
    short: 'BOLT',
    emojiLess: 'LT',
    color: '#3aa1ff',
    textColor: '#ffffff',
    selection: 'none',
    flavor: 'Strikes everyone else',
    description: '+1 stroke to all other teams.',
  },
  {
    id: 'mushroom',
    label: 'Mushroom',
    short: 'MUSH',
    emojiLess: 'MR',
    color: '#ff7043',
    textColor: '#ffffff',
    selection: 'none',
    flavor: 'Boost',
    description: '-1 stroke to your own net total.',
  },
  {
    id: 'super_star',
    label: 'Super Star',
    short: 'STAR',
    emojiLess: 'SS',
    color: '#ffd700',
    textColor: '#1a1a1a',
    selection: 'none',
    flavor: 'Invincible!',
    description: '-2 strokes to your own net total.',
  },
  {
    id: 'boo',
    label: 'Boo',
    short: 'BOO',
    emojiLess: 'BO',
    color: '#a05ec6',
    textColor: '#ffffff',
    selection: 'none',
    flavor: 'Steal',
    description: 'Steal 1 stroke from a random other team (their score +1, yours -1).',
  },
];

export function getWheelItem(id: WheelItemId | null | undefined): WheelItem | null {
  if (!id) return null;
  return WHEEL_ITEMS.find(i => i.id === id) ?? null;
}

// Map an index (0-7) to the rotation angle that places that segment under the
// top pointer. The wheel image is oriented so that index 0 (Green Shell) is
// already centered under the top pointer at rotation 0. Subsequent slices are
// spaced 45° clockwise, so to land slice i, rotate by -(i*45) plus full spins.
// A small jitter inside the slice keeps the landing feel non-mechanical.
export function targetAngleForIndex(index: number, fullSpins = 6): number {
  const center = index * 45;
  const jitter = (Math.random() - 0.5) * 30; // ±15° inside the slice
  return fullSpins * 360 - center + jitter;
}

// Default landing weights. Lightning (+1 to ALL teams) is set to 0.5 so it
// lands roughly half as often as any other item out of the box. Hosts can
// override per-item via tournament.wheelItemWeights.
export const DEFAULT_WHEEL_WEIGHTS: Record<WheelItemId, number> = {
  green_shell: 1,
  red_shell:   1,
  blue_shell:  1,
  banana:      1,
  lightning:   0.5,
  mushroom:    1,
  super_star:  1,
  boo:         1,
};

// Weighted random pick. Each item's effective weight = overrides[id] ?? DEFAULT_WHEEL_WEIGHTS[id].
// Weights of 0 (or negative) exclude that item entirely. If the total weight is
// zero (all items disabled) falls back to uniform random.
export function pickRandomIndex(overrides?: Partial<Record<WheelItemId, number>>): number {
  const weights = WHEEL_ITEMS.map(item => {
    const w = overrides?.[item.id] ?? DEFAULT_WHEEL_WEIGHTS[item.id];
    return Math.max(0, w);
  });
  const total = weights.reduce((s, w) => s + w, 0);
  if (total <= 0) return Math.floor(Math.random() * WHEEL_ITEMS.length);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return WHEEL_ITEMS.length - 1;
}

// Badge color helper — used by Leaderboard. Defined here (not in WheelModal)
// so the component file only exports a single default component, which keeps
// React Fast Refresh happy.
export function getWheelItemColor(id: WheelItemId | null | undefined): string {
  return getWheelItem(id)?.color ?? '#666';
}
