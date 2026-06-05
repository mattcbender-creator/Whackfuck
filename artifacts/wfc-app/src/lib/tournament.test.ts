import { describe, it, expect } from 'vitest';
import {
  type CourseHole,
  blankCourse,
  blankTournamentSetup,
  tracksYardages,
  holeRulesFromCourse,
  dundeeCourseDefaults,
  buildWfc2026Config,
  WHEEL_RULE_NAME,
  playOrder,
  firstUnscoredPlayPos,
  isHoleOutOfOrder,
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
    expect(c.startType).toBe('normal');
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

  it('has 18 hole rules with the wheel on hole 9 (index 8)', () => {
    expect(c.holeRules).toHaveLength(18);
    expect(c.holeRules[8].type).toBe('wheel');
    expect(c.holeRules[8].ruleName).toBe(WHEEL_RULE_NAME);
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

describe('isHoleOutOfOrder (in-order scoring lock)', () => {
  const blank = (): (number | null)[] => Array(18).fill(null);

  it('normal start blocks scoring a hole ahead of the first unscored one', () => {
    const order = playOrder(1);
    // Nothing scored yet → only hole 1 (idx 0) is allowed.
    expect(isHoleOutOfOrder({ holeIdx: 0, order, scores: blank(), isShotgun: false })).toBe(false);
    expect(isHoleOutOfOrder({ holeIdx: 2, order, scores: blank(), isShotgun: false })).toBe(true);
  });

  it('normal start allows the next hole once the prior one is scored', () => {
    const order = playOrder(1);
    const scores = blank();
    scores[0] = 4; // hole 1 scored
    expect(isHoleOutOfOrder({ holeIdx: 1, order, scores, isShotgun: false })).toBe(false);
    expect(isHoleOutOfOrder({ holeIdx: 2, order, scores, isShotgun: false })).toBe(true);
  });

  it('shotgun never blocks any hole, even with everything blank', () => {
    // Regression: shotgun teams (and the host, who falls back to hole 1) used to
    // be trapped — every hole past the first appeared BLOCKED and steppers were
    // disabled. They must now be freely scoreable.
    const order = playOrder(12);
    for (let idx = 0; idx < 18; idx++) {
      expect(isHoleOutOfOrder({ holeIdx: idx, order, scores: blank(), isShotgun: true })).toBe(false);
    }
  });

  it('shotgun fallback to hole 1 (unassigned team / host) is also unblocked', () => {
    const order = playOrder(1); // unassigned shotgun team
    for (let idx = 0; idx < 18; idx++) {
      expect(isHoleOutOfOrder({ holeIdx: idx, order, scores: blank(), isShotgun: true })).toBe(false);
    }
  });

  it('an unknown hole index is never out of order', () => {
    const order = playOrder(1);
    expect(isHoleOutOfOrder({ holeIdx: 99, order, scores: blank(), isShotgun: false })).toBe(false);
  });
});
