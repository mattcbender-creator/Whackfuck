import { describe, it, expect, beforeEach } from 'vitest';
import {
  type CourseHole,
  blankCourse,
  blankTournamentSetup,
  tracksYardages,
  holeRulesFromCourse,
  dundeeCourseDefaults,
  buildWfc2026Config,
  playOrder,
  firstUnscoredPlayPos,
  clearAllLocalAppState,
  getActiveTournamentId,
  setActiveTournamentId,
} from './tournament';

// A par-only hole helper for the derive-logic tests.
function hole(patch: Partial<CourseHole>): CourseHole {
  return { hole: 1, par: 4, hdcp: 1, tips: 0, mid: 0, womens: 0, ruleName: '', rule: '', ...patch };
}

describe('WFC 2026 preset (toggle ON content)', () => {
  const c = buildWfc2026Config();

  it('prefills the canonical name, course, and settings', () => {
    expect(c.name).toBe('Whack Fuck Cup 2026');
    expect(c.courseName).toBe('Dundee Country Club');
    expect(c.teamSize).toBe(2);
    expect(c.startType).toBe('shotgun');
    expect(c.autoTeeRule).toBe(true);
    expect(c.adminCode.trim().length).toBeGreaterThan(0);
  });

  it('has 18 holes with valid pars and yardages', () => {
    expect(c.holes).toHaveLength(18);
    for (const h of c.holes) {
      expect(h.par).toBeGreaterThanOrEqual(3);
    }
    expect(tracksYardages(c.holes)).toBe(true);
    expect(c.trackYardages).toBe(true);
  });

  it('derives 18 hole rules from the course and places the wheel on hole 18', () => {
    expect(c.holeRules).toHaveLength(18);
    // Hole 9 (index 8) carries the course's own "Twin Putter" standard rule.
    expect(c.holeRules[8].type).toBe('standard');
    expect(c.holeRules[8].ruleName).toBe('Twin Putter');
    // Hole 18 (index 17) is the single auto-placed Mario Kart Item Box wheel.
    expect(c.holeRules[17].type).toBe('wheel');
    expect(c.holeRules.filter(r => r.type === 'wheel')).toHaveLength(1);
  });
});

describe('blank / OFF state (toggle OFF content)', () => {
  it('blankCourse is 18 par-placeholder holes with no yardages or rules', () => {
    const holes = blankCourse();
    expect(holes).toHaveLength(18);
    for (const h of holes) {
      expect(h.par).toBe(4); // par placeholder
      expect(h.tips).toBe(0);
      expect(h.mid).toBe(0);
      expect(h.womens).toBe(0);
      expect(h.ruleName).toBe('');
      expect(h.rule).toBe('');
    }
    expect(tracksYardages(holes)).toBe(false);
  });

  it('blankCourse produces no rules (all "none")', () => {
    const rules = holeRulesFromCourse(blankCourse());
    expect(rules).toHaveLength(18);
    expect(rules.every(r => r.type === 'none')).toBe(true);
  });

  it('blankTournamentSetup clears name/course/admin and uses defaults', () => {
    const s = blankTournamentSetup();
    expect(s.name).toBe('');
    expect(s.courseName).toBe('');
    expect(s.adminCode).toBe('');
    expect(s.teamSize).toBe(2);
    expect(s.startType).toBe('normal');
    expect(s.autoTeeRule).toBe(false);
    expect(s.customRules).toEqual([]);
    expect(tracksYardages(s.holes)).toBe(false);
    expect(s.holeRules.every(r => r.type === 'none')).toBe(true);
  });
});

describe('tracksYardages (derived yardage tracking)', () => {
  it('is false for a pars-only course (no distances)', () => {
    expect(tracksYardages(blankCourse())).toBe(false);
  });

  it('is true for the Dundee defaults and the WFC preset', () => {
    expect(tracksYardages(dundeeCourseDefaults())).toBe(true);
    expect(tracksYardages(buildWfc2026Config().holes)).toBe(true);
  });

  it('is true when any single tee distance is present', () => {
    expect(tracksYardages([hole({ tips: 300 })])).toBe(true);
    expect(tracksYardages([hole({ mid: 250 })])).toBe(true);
    expect(tracksYardages([hole({ womens: 200 })])).toBe(true);
  });

  it('is false when every distance is zero', () => {
    expect(tracksYardages([hole({}), hole({ hole: 2 })])).toBe(false);
  });
});

describe('pars-only create path', () => {
  it('a host can enter pars without yardages and it stays par-only', () => {
    // Course with real pars but no yardages entered.
    const holes = blankCourse().map(h => ({ ...h, par: 3 }));
    expect(holes.every(h => h.par >= 3)).toBe(true);
    expect(tracksYardages(holes)).toBe(false);
  });
});

describe('playOrder (shotgun wrap-around)', () => {
  it('a normal start (hole 1) is the identity order [1..18]', () => {
    expect(playOrder(1)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
  });

  it('wraps around from the assigned starting hole', () => {
    expect(playOrder(12)).toEqual([12, 13, 14, 15, 16, 17, 18, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it('always covers all 18 holes exactly once', () => {
    for (const start of [1, 5, 12, 18]) {
      const order = playOrder(start);
      expect(order).toHaveLength(18);
      expect(new Set(order).size).toBe(18);
      expect(order[0]).toBe(start);
    }
  });

  it('falls back to hole 1 for an out-of-range starting hole', () => {
    expect(playOrder(0)).toEqual(playOrder(1));
    expect(playOrder(19)).toEqual(playOrder(1));
    expect(playOrder(NaN)).toEqual(playOrder(1));
  });
});

describe('firstUnscoredPlayPos', () => {
  const blank = (): (number | null)[] => Array(18).fill(null);

  it('is 0 when nothing is scored', () => {
    expect(firstUnscoredPlayPos(playOrder(1), blank())).toBe(0);
  });

  it('points at the first gap in PLAY order, not raw hole order', () => {
    // Shotgun team starting on hole 12: play order is [12,13,...]. Score hole
    // 12 and the first unscored play position should advance to hole 13 (pos 1),
    // even though hole 1 (raw index 0) is still blank.
    const order = playOrder(12);
    const scores = blank();
    scores[11] = 4; // hole 12 scored
    expect(firstUnscoredPlayPos(order, scores)).toBe(1);
    expect(order[1]).toBe(13);
  });

  it('is 18 when the round is complete', () => {
    expect(firstUnscoredPlayPos(playOrder(1), Array(18).fill(4))).toBe(18);
  });
});

describe('clearAllLocalAppState (full local reset)', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = {
      get length() { return store.size; },
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => { store.set(k, String(v)); },
      removeItem: (k: string) => { store.delete(k); },
      clear: () => store.clear(),
    } as Storage;
  });

  it('removes every wfc- key and clears the active tournament id', () => {
    setActiveTournamentId('t_abc');
    localStorage.setItem('wfc-state::t_abc', '{"x":1}');
    localStorage.setItem('wfc-team-id::t_abc', 'team-1');
    localStorage.setItem('wfc-spectator::t_abc', '1');
    localStorage.setItem('wfc-host-key::t_abc', 'KEY');
    localStorage.setItem('wfc-starting-hole::t_abc', '12');

    clearAllLocalAppState();

    expect(localStorage.length).toBe(0);
    expect(getActiveTournamentId()).toBeNull();
  });

  it('leaves non-wfc keys untouched', () => {
    localStorage.setItem('wfc-state::t1', 'a');
    localStorage.setItem('theme', 'dark');
    localStorage.setItem('other-app', '1');

    clearAllLocalAppState();

    expect(localStorage.getItem('wfc-state::t1')).toBeNull();
    expect(localStorage.getItem('theme')).toBe('dark');
    expect(localStorage.getItem('other-app')).toBe('1');
  });
});
