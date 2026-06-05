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

  interface Ref { id: string; }
  const docs = new Map<string, Record<string, unknown>>();
  const versions = new Map<string, number>();
  let afterFirstGet: (() => void | Promise<void>) | null = null;

  function isPlainObject(v: unknown): v is Record<string, unknown> {
    return !!v && typeof v === 'object' && !Array.isArray(v) && v !== DELETE;
  }

  function deepMerge(
    target: Record<string, unknown> | undefined,
    patch: Record<string, unknown>,
  ): Record<string, unknown> {
    const out: Record<string, unknown> = { ...(target ?? {}) };
    for (const [k, v] of Object.entries(patch)) {
      if (v === DELETE) {
        delete out[k];
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
    DELETE, deleteField, setDoc, runTransaction,
    reset, seed, get, queueAfterFirstGet,
    ref: (id: string): Ref => ({ id }),
  };
});

vi.mock('firebase/firestore', () => ({
  runTransaction: h.runTransaction,
  setDoc: h.setDoc,
  deleteField: h.deleteField,
}));

import { correctTeamScores, writeHoleScore, type ParHole } from './scoreSync';
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
