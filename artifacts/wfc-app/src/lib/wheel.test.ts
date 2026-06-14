import { describe, it, expect } from 'vitest';
import {
  pickRandomIndex,
  DEFAULT_WHEEL_WEIGHTS,
  WHEEL_ITEMS,
  type WheelItemId,
} from './wheel';

describe('DEFAULT_WHEEL_WEIGHTS', () => {
  it('covers all 8 wheel items', () => {
    for (const item of WHEEL_ITEMS) {
      expect(DEFAULT_WHEEL_WEIGHTS[item.id]).toBeDefined();
    }
  });

  it('sets lightning to 0.5 and every other item to 1', () => {
    expect(DEFAULT_WHEEL_WEIGHTS['lightning']).toBe(0.5);
    for (const item of WHEEL_ITEMS.filter(i => i.id !== 'lightning')) {
      expect(DEFAULT_WHEEL_WEIGHTS[item.id]).toBe(1);
    }
  });
});

describe('pickRandomIndex', () => {
  it('always returns a valid index within [0, WHEEL_ITEMS.length)', () => {
    for (let i = 0; i < 200; i++) {
      const idx = pickRandomIndex();
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(WHEEL_ITEMS.length);
    }
  });

  it('with weight 0, that item is never selected (1 000 trials)', () => {
    const overrides: Partial<Record<WheelItemId, number>> = { lightning: 0 };
    for (let i = 0; i < 1000; i++) {
      const id = WHEEL_ITEMS[pickRandomIndex(overrides)].id;
      expect(id).not.toBe('lightning');
    }
  });

  it('when only one item has weight > 0, it always wins (200 trials)', () => {
    const overrides = Object.fromEntries(
      WHEEL_ITEMS.map(item => [item.id, item.id === 'mushroom' ? 1 : 0])
    ) as Partial<Record<WheelItemId, number>>;

    for (let i = 0; i < 200; i++) {
      expect(WHEEL_ITEMS[pickRandomIndex(overrides)].id).toBe('mushroom');
    }
  });

  it('lightning lands at roughly half the rate of other items with default weights', () => {
    const counts: Record<string, number> = {};
    const trials = 20_000;
    for (let i = 0; i < trials; i++) {
      const id = WHEEL_ITEMS[pickRandomIndex()].id;
      counts[id] = (counts[id] ?? 0) + 1;
    }
    // Total weight = 7 × 1 + 1 × 0.5 = 7.5
    // Expected lightning rate ≈ 0.5/7.5 ≈ 6.7%; others each ≈ 13.3%
    const lightningRate = counts['lightning'] / trials;
    const mushroomRate  = counts['mushroom']  / trials;
    // Lightning should be well below the normal-item rate (use 90% of half as threshold)
    expect(lightningRate).toBeLessThan(mushroomRate * 0.9);
  });

  it('a weight of 2× doubles that item relative to a 1× item', () => {
    const overrides: Partial<Record<WheelItemId, number>> = { mushroom: 2 };
    const counts: Record<string, number> = {};
    const trials = 20_000;
    for (let i = 0; i < trials; i++) {
      const id = WHEEL_ITEMS[pickRandomIndex(overrides)].id;
      counts[id] = (counts[id] ?? 0) + 1;
    }
    // mushroom at 2×, green_shell at 1× — mushroom should land ~2× as often
    const mushroomRate    = counts['mushroom']    / trials;
    const greenShellRate  = counts['green_shell'] / trials;
    expect(mushroomRate).toBeGreaterThan(greenShellRate * 1.5);
  });

  it('falls back to uniform random when all weights are 0', () => {
    const allOff = Object.fromEntries(
      WHEEL_ITEMS.map(item => [item.id, 0])
    ) as Partial<Record<WheelItemId, number>>;
    // Should not throw and should return a valid index
    for (let i = 0; i < 50; i++) {
      const idx = pickRandomIndex(allOff);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(WHEEL_ITEMS.length);
    }
  });
});
