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
