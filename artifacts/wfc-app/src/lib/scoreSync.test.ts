import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── In-memory Firestore fake ────────────────────────────────────────────────
// Models the slices of Firestore that the score-sync code relies on:
//   • setDoc(ref, data, { merge: true }) — deep field merge, with deleteField()
//     sentinels removing nested keys (so scores.{hole} writes are conflict-free)
//   • runTransaction(db, fn) — optimistic concurrency: tx.get records the read
//     version, and if the doc changes before commit the transaction re-runs.
// A one-shot "after first get" hook lets a test interleave a concurrent player
// write between the admin transaction's read and its commit, forcing the retry
// path that protects against the race.
const h = vi.hoisted(() => {
  const DELETE = Symbol('deleteField');

  // FieldValue sentinels (increment / arrayUnion) are modelled as tagged objects
  // so deepMerge can apply them against the *current* stored value rather than
  // overwriting it — this is what makes concurrent score/wheel writes compose.
  class FieldOp {
    constructor(public kind: 'increment' | 'arrayUnion', public arg: unknown) {}
  }
  const increment = (n: number) => new FieldOp('increment', n);
  const arrayUnion = (...items: unknown[]) => new FieldOp('arrayUnion', items);

  interface Ref { id: string; }
  const docs = new Map<string, Record<string, unknown>>();
  const versions = new Map<string, number>();
  let afterFirstGet: (() => void | Promise<void>) | null = null;

  function isPlainObject(v: unknown): v is Record<string, unknown> {
    return !!v && typeof v === 'object' && !Array.isArray(v)
      && v !== DELETE && !(v instanceof FieldOp);
  }

  function deepMerge(
    target: Record<string, unknown> | undefined,
    patch: Record<string, unknown>,
  ): Record<string, unknown> {
    const out: Record<string, unknown> = { ...(target ?? {}) };
    for (const [k, v] of Object.entries(patch)) {
      if (v === DELETE) {
        delete out[k];
      } else if (v instanceof FieldOp) {
        if (v.kind === 'increment') {
          const cur = typeof out[k] === 'number' ? (out[k] as number) : 0;
          out[k] = cur + (v.arg as number);
        } else {
          // arrayUnion: append items not already present (deep-equality dedupe).
          const cur = Array.isArray(out[k]) ? [...(out[k] as unknown[])] : [];
          for (const item of v.arg as unknown[]) {
            if (!cur.some(x => JSON.stringify(x) === JSON.stringify(item))) cur.push(item);
          }
          out[k] = cur;
        }
      } else if (isPlainObject(v)) {
        const prev = isPlainObject(out[k]) ? (out[k] as Record<string, unknown>) : {};
        out[k] = deepMerge(prev, v);
      } else {
        out[k] = v;
      }
    }
    return out;
  }

  function bump(id: string) {
    versions.set(id, (versions.get(id) ?? 0) + 1);
  }

  function commit(ref: Ref, payload: Record<string, unknown>, merge: boolean) {
    const cur = docs.get(ref.id);
    docs.set(ref.id, merge ? deepMerge(cur, payload) : payload);
    bump(ref.id);
  }

  const deleteField = () => DELETE;

  const setDoc = async (
    ref: Ref,
    payload: Record<string, unknown>,
    opts?: { merge?: boolean },
  ) => {
    commit(ref, payload, !!opts?.merge);
  };

  // updateDoc is a non-transactional field-level merge (the admin manual adjust
  // path). Increment sentinels apply against the stored value, like Firestore.
  const updateDoc = async (ref: Ref, payload: Record<string, unknown>) => {
    commit(ref, payload, true);
  };

  const runTransaction = async <T>(
    _db: unknown,
    fn: (tx: {
      get: (ref: Ref) => Promise<{ exists: () => boolean; data: () => Record<string, unknown> | undefined }>;
      set: (ref: Ref, payload: Record<string, unknown>, opts?: { merge?: boolean }) => void;
    }) => Promise<T>,
  ): Promise<T> => {
    for (let attempt = 0; attempt < 8; attempt++) {
      const reads = new Map<string, number>();
      const writes: { ref: Ref; payload: Record<string, unknown>; merge: boolean }[] = [];
      let firstGet = true;
      const tx = {
        async get(ref: Ref) {
          const data = docs.get(ref.id);
          reads.set(ref.id, versions.get(ref.id) ?? 0);
          const wasFirst = firstGet;
          firstGet = false;
          const snap = { exists: () => data !== undefined, data: () => data };
          if (wasFirst && afterFirstGet) {
            const hook = afterFirstGet;
            afterFirstGet = null; // one-shot
            await hook();
          }
          return snap;
        },
        set(ref: Ref, payload: Record<string, unknown>, opts?: { merge?: boolean }) {
          writes.push({ ref, payload, merge: !!opts?.merge });
        },
      };
      const result = await fn(tx);
      // Conflict check: did any read doc change before we committed?
      let conflict = false;
      for (const [id, ver] of reads) {
        if ((versions.get(id) ?? 0) !== ver) { conflict = true; break; }
      }
      if (conflict) continue; // retry the whole transaction body
      for (const w of writes) commit(w.ref, w.payload, w.merge);
      return result;
    }
    throw new Error('transaction exceeded max attempts');
  };

  function reset() {
    docs.clear();
    versions.clear();
    afterFirstGet = null;
  }
  function seed(id: string, data: Record<string, unknown>) {
    docs.set(id, data);
    bump(id);
  }
  function get(id: string) {
    return docs.get(id);
  }
  function queueAfterFirstGet(fn: () => void | Promise<void>) {
    afterFirstGet = fn;
  }

  return {
    DELETE, deleteField, setDoc, updateDoc, runTransaction, increment, arrayUnion,
    reset, seed, get, queueAfterFirstGet,
    ref: (id: string): Ref => ({ id }),
  };
});

vi.mock('firebase/firestore', () => ({
  runTransaction: h.runTransaction,
  setDoc: h.setDoc,
  updateDoc: h.updateDoc,
  deleteField: h.deleteField,
  increment: h.increment,
  arrayUnion: h.arrayUnion,
}));

import {
  correctTeamScores, writeHoleScore,
  reconcileWheelHits, recordWheelSpinTx, applyManualAdjustment,
  spinsFromData,
  type ParHole, type TargetedByEntry, type WheelSpinRecord,
} from './scoreSync';
import { normalizeScores } from './tournament';

// All-par-4 course is enough for the aggregate math here.
const HOLES: ParHole[] = Array.from({ length: 18 }, () => ({ par: 4 }));
const TEAM = 'team-A';

// Recompute the "truth" aggregates straight from the final stored scores map so
// assertions can't drift from the production formula by accident.
function expectedAggregates(data: Record<string, unknown> | undefined) {
  const scores = normalizeScores(data?.scores);
  const wheelAdj = typeof data?.wheelAdjustment === 'number' ? data.wheelAdjustment : 0;
  let strokes = 0, par = 0, hp = 0;
  scores.forEach((s, i) => {
    if (s !== null) { strokes += s; par += HOLES[i].par; hp += 1; }
  });
  return { holesPlayed: hp, netScore: (hp > 0 ? strokes - par : 0) + wheelAdj };
}

describe('correctTeamScores vs. concurrent player scoring', () => {
  beforeEach(() => h.reset());

  it('preserves a concurrent player write to a different hole', async () => {
    // Team has holes 1 & 2 scored. Admin opened the modal on this snapshot.
    h.seed(TEAM, { scores: { '1': 4, '2': 4 }, wheelAdjustment: 0 });
    const snapshot = normalizeScores(h.get(TEAM)?.scores);

    // Admin corrects hole 1: 4 → 6.
    const draft = [...snapshot];
    draft[0] = 6;

    // While the admin transaction is mid-flight (after its first read), a player
    // writes a brand-new hole 5. This must survive the admin's correction.
    h.queueAfterFirstGet(() =>
      writeHoleScore({} as never, h.ref(TEAM) as never, 5, 5),
    );

    await correctTeamScores(
      {} as never,
      h.ref(TEAM) as never,
      [{ idx: 0, value: 6 }],
      { changed: false, value: null },
      HOLES,
    );

    const data = h.get(TEAM)!;
    const scores = data.scores as Record<string, number>;
    expect(scores['1']).toBe(6); // admin's correction applied
    expect(scores['2']).toBe(4); // untouched hole preserved
    expect(scores['5']).toBe(5); // concurrent player write NOT clobbered

    // Aggregates reflect the merged map: 6 + 4 + 5 = 15 strokes over par 12 = +3.
    const exp = expectedAggregates(data);
    expect(exp).toEqual({ holesPlayed: 3, netScore: 3 });
    expect(data.netScore).toBe(exp.netScore);
    expect(data.holesPlayed).toBe(exp.holesPlayed);
  });

  it('clears a hole (deleteField) without dropping a concurrent player write', async () => {
    h.seed(TEAM, { scores: { '1': 4, '2': 5, '3': 6 }, wheelAdjustment: 0 });
    const snapshot = normalizeScores(h.get(TEAM)?.scores);

    // Admin clears hole 3.
    const edits = [{ idx: 2, value: null }];

    // Player concurrently writes hole 10.
    h.queueAfterFirstGet(() =>
      writeHoleScore({} as never, h.ref(TEAM) as never, 10, 3),
    );

    await correctTeamScores(
      {} as never,
      h.ref(TEAM) as never,
      edits,
      { changed: false, value: null },
      HOLES,
    );

    const data = h.get(TEAM)!;
    const scores = data.scores as Record<string, number>;
    expect('3' in scores).toBe(false); // hole 3 cleared via deleteField
    expect(scores['1']).toBe(4);
    expect(scores['2']).toBe(5);
    expect(scores['10']).toBe(3); // concurrent write survives

    // Remaining: 4 + 5 + 3 = 12 strokes over par 12 = 0 (even).
    const exp = expectedAggregates(data);
    expect(exp).toEqual({ holesPlayed: 3, netScore: 0 });
    expect(data.netScore).toBe(0);
    expect(data.holesPlayed).toBe(3);
    expect(snapshot[2]).toBe(6); // sanity: snapshot really had hole 3 before
  });

  it('sets a tee override while a player writes a hole, recomputing net correctly', async () => {
    h.seed(TEAM, { scores: { '1': 3 }, wheelAdjustment: 0 });

    // Admin only changes the tee override (no score edits).
    h.queueAfterFirstGet(() =>
      writeHoleScore({} as never, h.ref(TEAM) as never, 2, 4),
    );

    await correctTeamScores(
      {} as never,
      h.ref(TEAM) as never,
      [],
      { changed: true, value: 'tips' },
      HOLES,
    );

    const data = h.get(TEAM)!;
    expect(data.teeOverride).toBe('tips');
    const scores = data.scores as Record<string, number>;
    expect(scores['1']).toBe(3);
    expect(scores['2']).toBe(4); // concurrent player write preserved

    // 3 + 4 = 7 strokes over par 8 = -1. The admin recomputed from the merged
    // map even though it made no score edits itself.
    const exp = expectedAggregates(data);
    expect(exp).toEqual({ holesPlayed: 2, netScore: -1 });
    expect(data.netScore).toBe(-1);
    expect(data.holesPlayed).toBe(2);
  });

  it('keeps the persisted wheel adjustment in the recomputed net score', async () => {
    h.seed(TEAM, { scores: { '1': 4 }, wheelAdjustment: 2 });

    h.queueAfterFirstGet(() =>
      writeHoleScore({} as never, h.ref(TEAM) as never, 2, 5),
    );

    await correctTeamScores(
      {} as never,
      h.ref(TEAM) as never,
      [{ idx: 0, value: 6 }],
      { changed: false, value: null },
      HOLES,
    );

    const data = h.get(TEAM)!;
    // 6 + 5 = 11 strokes over par 8 = +3, plus wheelAdjustment 2 = +5.
    const exp = expectedAggregates(data);
    expect(exp.netScore).toBe(5);
    expect(data.netScore).toBe(5);
    expect(data.holesPlayed).toBe(2);
  });

  it('is a no-op when there are no edits and no tee change', async () => {
    h.seed(TEAM, { scores: { '1': 4 }, wheelAdjustment: 0, netScore: 0, holesPlayed: 1 });
    const before = JSON.stringify(h.get(TEAM));

    await correctTeamScores(
      {} as never,
      h.ref(TEAM) as never,
      [],
      { changed: false, value: null },
      HOLES,
    );

    expect(JSON.stringify(h.get(TEAM))).toBe(before);
  });
});

// ── Cross-team wheel-hit reconciliation ─────────────────────────────────────
describe('reconcileWheelHits', () => {
  beforeEach(() => h.reset());

  const HIT = (over: Partial<TargetedByEntry> = {}): TargetedByEntry => ({
    item: 'green_shell', fromTeam: 'B', at: 1000, ...over,
  });

  it('adds a missing hit and bumps wheelAdjustment + netScore once', async () => {
    h.seed(TEAM, { wheelAdjustment: 0, netScore: 0, targetedBy: [] });

    const added = await reconcileWheelHits({} as never, h.ref(TEAM) as never, [HIT()]);

    expect(added).toBe(1);
    const data = h.get(TEAM)!;
    expect(data.wheelAdjustment).toBe(1);
    expect(data.netScore).toBe(1);
    expect(data.targetedBy).toEqual([HIT()]);
  });

  it('does not double-count a hit already present on the team doc', async () => {
    h.seed(TEAM, { wheelAdjustment: 1, netScore: 1, targetedBy: [HIT()] });

    const added = await reconcileWheelHits({} as never, h.ref(TEAM) as never, [HIT()]);

    expect(added).toBe(0);
    const data = h.get(TEAM)!;
    expect(data.wheelAdjustment).toBe(1);
    expect(data.netScore).toBe(1);
    expect((data.targetedBy as unknown[]).length).toBe(1);
  });

  it('applies a hit exactly once when the same hit lands concurrently mid-flight', async () => {
    // Two teams interleave: our reconcile reads an empty targetedBy, but before it
    // commits the spinner's own write lands the very same hit on our doc. The
    // transaction must retry, see the hit already there, and NOT add it twice.
    h.seed(TEAM, { wheelAdjustment: 0, netScore: 0, targetedBy: [] });
    h.queueAfterFirstGet(() =>
      h.setDoc(h.ref(TEAM) as never, {
        wheelAdjustment: h.increment(1),
        netScore: h.increment(1),
        targetedBy: h.arrayUnion(HIT()),
      }, { merge: true }),
    );

    const added = await reconcileWheelHits({} as never, h.ref(TEAM) as never, [HIT()]);

    expect(added).toBe(0); // retried, found nothing left to add
    const data = h.get(TEAM)!;
    expect(data.wheelAdjustment).toBe(1); // not 2
    expect(data.netScore).toBe(1);
    expect((data.targetedBy as unknown[]).length).toBe(1);
  });

  it('adds only the genuinely missing hits from a mixed batch', async () => {
    const known = HIT({ fromTeam: 'B', at: 1000 });
    const fresh = HIT({ item: 'red_shell', fromTeam: 'C', at: 2000 });
    h.seed(TEAM, { wheelAdjustment: 1, netScore: 1, targetedBy: [known] });

    const added = await reconcileWheelHits({} as never, h.ref(TEAM) as never, [known, fresh]);

    expect(added).toBe(1);
    const data = h.get(TEAM)!;
    expect(data.wheelAdjustment).toBe(2);
    expect(data.netScore).toBe(2);
    expect(data.targetedBy).toEqual([known, fresh]);
  });

  it('skips reconciliation entirely once the round is submitted', async () => {
    h.seed(TEAM, { wheelAdjustment: 0, netScore: 0, targetedBy: [], hasSubmitted: true });

    const added = await reconcileWheelHits({} as never, h.ref(TEAM) as never, [HIT()]);

    expect(added).toBe(0);
    const data = h.get(TEAM)!;
    expect(data.wheelAdjustment).toBe(0);
    expect(data.netScore).toBe(0);
    expect(data.targetedBy).toEqual([]);
  });
});

// ── Wheel-spin recording (one spin per hole) ────────────────────────────────
describe('recordWheelSpinTx', () => {
  beforeEach(() => h.reset());

  it('records a brand-new spin for a hole', async () => {
    h.seed(TEAM, {});
    const rec: WheelSpinRecord = { item: 'green_shell', at: 1000, targetTeam: 'B' };

    const result = await recordWheelSpinTx({} as never, h.ref(TEAM) as never, 9, rec);

    expect(result).toEqual(rec);
    const spins = h.get(TEAM)!.wheelSpins as Record<string, unknown>;
    expect(spins['9']).toEqual(rec);
  });

  it('never overwrites an existing spin on the same hole', async () => {
    const first: WheelSpinRecord = { item: 'banana', at: 1000 };
    h.seed(TEAM, { wheelSpins: { '9': first } });

    const result = await recordWheelSpinTx(
      {} as never, h.ref(TEAM) as never, 9, { item: 'boo', at: 2000 },
    );

    expect(result).toEqual(first); // returns the spin that was already there
    const spins = h.get(TEAM)!.wheelSpins as Record<string, unknown>;
    expect(spins['9']).toEqual(first);
  });

  it('applies a spin exactly once when two callers race the same hole', async () => {
    h.seed(TEAM, {});
    const winner: WheelSpinRecord = { item: 'lightning', at: 1000 };
    const loser: WheelSpinRecord = { item: 'blue_shell', at: 1001 };
    // The winner writes the hole after our transaction's first read but before it
    // commits, forcing the retry that observes and preserves the winner.
    h.queueAfterFirstGet(() =>
      h.setDoc(h.ref(TEAM) as never, { wheelSpins: { '9': winner } }, { merge: true }),
    );

    const result = await recordWheelSpinTx({} as never, h.ref(TEAM) as never, 9, loser);

    expect(result).toEqual(winner);
    const spins = h.get(TEAM)!.wheelSpins as Record<string, unknown>;
    expect(spins['9']).toEqual(winner); // loser never clobbers the winner
  });

  it('strips undefined fields before writing the spin', async () => {
    h.seed(TEAM, {});

    await recordWheelSpinTx(
      {} as never, h.ref(TEAM) as never, 5,
      { item: 'red_shell', at: 1000, targetTeam: undefined },
    );

    const spins = h.get(TEAM)!.wheelSpins as Record<string, Record<string, unknown>>;
    expect(spins['5']).toEqual({ item: 'red_shell', at: 1000 });
    expect('targetTeam' in spins['5']).toBe(false);
  });

  it('preserves a concurrent spin on a different hole', async () => {
    h.seed(TEAM, {});
    h.queueAfterFirstGet(() =>
      h.setDoc(h.ref(TEAM) as never,
        { wheelSpins: { '3': { item: 'banana', at: 900 } } }, { merge: true }),
    );

    await recordWheelSpinTx(
      {} as never, h.ref(TEAM) as never, 9, { item: 'boo', at: 1000 },
    );

    const spins = h.get(TEAM)!.wheelSpins as Record<string, unknown>;
    expect(spins['3']).toEqual({ item: 'banana', at: 900 }); // other hole survives
    expect(spins['9']).toEqual({ item: 'boo', at: 1000 });
  });

  it('throws "submitted" when the round is submitted and the hole has no spin', async () => {
    h.seed(TEAM, { hasSubmitted: true });

    await expect(
      recordWheelSpinTx({} as never, h.ref(TEAM) as never, 9, { item: 'boo', at: 1000 }),
    ).rejects.toThrow('submitted');
    expect(h.get(TEAM)!.wheelSpins).toBeUndefined();
  });

  it('returns the existing spin when submitted but the hole already spun', async () => {
    const existing: WheelSpinRecord = { item: 'banana', at: 1000 };
    h.seed(TEAM, { hasSubmitted: true, wheelSpins: { '9': existing } });

    const result = await recordWheelSpinTx(
      {} as never, h.ref(TEAM) as never, 9, { item: 'boo', at: 2000 },
    );

    expect(result).toEqual(existing);
    const spins = h.get(TEAM)!.wheelSpins as Record<string, unknown>;
    expect(spins['9']).toEqual(existing);
  });
});

// ── Admin manual stroke adjustment ──────────────────────────────────────────
describe('applyManualAdjustment', () => {
  beforeEach(() => h.reset());

  it('increments wheelAdjustment and netScore by a positive delta', async () => {
    h.seed(TEAM, { wheelAdjustment: 2, netScore: 5 });

    await applyManualAdjustment({} as never, h.ref(TEAM) as never, 3);

    const data = h.get(TEAM)!;
    expect(data.wheelAdjustment).toBe(5);
    expect(data.netScore).toBe(8);
  });

  it('applies a negative delta', async () => {
    h.seed(TEAM, { wheelAdjustment: 0, netScore: 1 });

    await applyManualAdjustment({} as never, h.ref(TEAM) as never, -2);

    const data = h.get(TEAM)!;
    expect(data.wheelAdjustment).toBe(-2);
    expect(data.netScore).toBe(-1);
  });

  it('treats missing aggregate fields as zero', async () => {
    h.seed(TEAM, {});

    await applyManualAdjustment({} as never, h.ref(TEAM) as never, 4);

    const data = h.get(TEAM)!;
    expect(data.wheelAdjustment).toBe(4);
    expect(data.netScore).toBe(4);
  });

  it('composes with a concurrent per-hole score write without clobbering it', async () => {
    // A player writes a new hole via the field-level merge while the admin adjusts
    // strokes. Both must land: the adjustment increments, the score is preserved.
    h.seed(TEAM, { wheelAdjustment: 0, netScore: 0, scores: { '1': 4 } });

    await Promise.all([
      applyManualAdjustment({} as never, h.ref(TEAM) as never, 2),
      writeHoleScore({} as never, h.ref(TEAM) as never, 5, 5),
    ]);

    const data = h.get(TEAM)!;
    expect(data.wheelAdjustment).toBe(2);
    expect(data.netScore).toBe(2);
    const scores = data.scores as Record<string, number>;
    expect(scores['1']).toBe(4);
    expect(scores['5']).toBe(5); // concurrent player write survives
  });
});

describe('spinsFromData (hole-agnostic wheel resolution)', () => {
  const spin = (item: string): WheelSpinRecord => ({ item: item as WheelSpinRecord['item'], at: 1000 });

  it('reads the per-hole wheelSpins map at arbitrary holes, not just hole 9', () => {
    const out = spinsFromData({ wheelSpins: { '3': spin('banana'), '14': spin('mushroom') } });
    expect(out[3]?.item).toBe('banana');
    expect(out[14]?.item).toBe('mushroom');
    expect(out[9]).toBeUndefined();
  });

  it('keeps every spin when multiple wheel holes are in play', () => {
    const out = spinsFromData({
      wheelSpins: { '1': spin('boo'), '7': spin('super_star'), '18': spin('lightning') },
    });
    expect(Object.keys(out).map(Number).sort((a, b) => a - b)).toEqual([1, 7, 18]);
  });

  it('falls back to the legacy single wheelSpin field bucketed under hole 9', () => {
    const out = spinsFromData({ wheelSpin: spin('mushroom') });
    expect(out[9]?.item).toBe('mushroom');
  });

  it('ignores out-of-range hole keys and entries with no item', () => {
    const out = spinsFromData({
      wheelSpins: { '0': spin('banana'), '19': spin('boo'), '5': { at: 1 } },
    });
    expect(out).toEqual({});
  });

  it('returns an empty map for a team that never spun', () => {
    expect(spinsFromData({})).toEqual({});
    expect(spinsFromData(null)).toEqual({});
    expect(spinsFromData(undefined)).toEqual({});
  });
});
