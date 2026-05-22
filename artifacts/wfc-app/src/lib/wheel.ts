export type WheelItemId =
  | 'green_shell'
  | 'red_shell'
  | 'blue_shell'
  | 'banana'
  | 'lightning'
  | 'mushroom'
  | 'super_star'
  | 'boo';

export type SelectionMode = 'none' | 'nearby' | 'ahead' | 'any';

export interface WheelItem {
  id: WheelItemId;
  label: string;
  short: string;
  emojiLess: string;
  color: string;
  textColor: string;
  selection: SelectionMode;
  description: string;
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
    selection: 'nearby',
    description: 'Pick a nearby team — they take +1 stroke.',
  },
  {
    id: 'red_shell',
    label: 'Red Shell',
    short: 'RED',
    emojiLess: 'RS',
    color: '#e63946',
    textColor: '#ffffff',
    selection: 'ahead',
    description: 'Pick any team ahead of you — they take +1 stroke.',
  },
  {
    id: 'blue_shell',
    label: 'Blue Shell',
    short: 'BLUE',
    emojiLess: 'BS',
    color: '#2a9df4',
    textColor: '#ffffff',
    selection: 'none',
    description: 'Auto-fires at the current leader — they take +1 stroke.',
  },
  {
    id: 'banana',
    label: 'Banana',
    short: 'BANANA',
    emojiLess: 'BN',
    color: '#f4d35e',
    textColor: '#1a1a1a',
    selection: 'none',
    description: 'Slipped! You take +1 stroke on your back 9.',
  },
  {
    id: 'lightning',
    label: 'Lightning',
    short: 'BOLT',
    emojiLess: 'LT',
    color: '#3aa1ff',
    textColor: '#ffffff',
    selection: 'none',
    description: 'Strikes everyone else — every other team takes +1 stroke.',
  },
  {
    id: 'mushroom',
    label: 'Mushroom',
    short: 'MUSH',
    emojiLess: 'MR',
    color: '#ff7043',
    textColor: '#ffffff',
    selection: 'none',
    description: 'Boost! You shave -1 stroke off your back 9.',
  },
  {
    id: 'super_star',
    label: 'Super Star',
    short: 'STAR',
    emojiLess: 'SS',
    color: '#ffd700',
    textColor: '#1a1a1a',
    selection: 'none',
    description: 'Invincible! You shave -2 strokes off your back 9.',
  },
  {
    id: 'boo',
    label: 'Boo',
    short: 'BOO',
    emojiLess: 'BO',
    color: '#a05ec6',
    textColor: '#ffffff',
    selection: 'any',
    description: 'Steal -1 from a team of your choice AND your worst back-9 hole is hidden.',
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

export function pickRandomIndex(): number {
  return Math.floor(Math.random() * WHEEL_ITEMS.length);
}
