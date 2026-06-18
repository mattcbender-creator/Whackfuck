import {
  runTransaction, setDoc, updateDoc, deleteField, increment, arrayUnion,
  type Firestore, type DocumentReference,
} from 'firebase/firestore';
import { normalizeScores } from './tournament';
import type { WheelItemId } from './wheel';

// Shared score-sync primitives used by both the player scorecard (store.tsx)
// and the admin score-correction modal (Admin.tsx). Keeping the Firestore write
// shapes in one place means the conflict-free merge semantics can be exercised
// by an integration test instead of living only inside React components.

export interface CorrectionEdit {
  /** 0-based hole index (0–17). */
  idx: number;
  /** New score for the hole, or null to clear it. */
  value: number | null;
}

export interface TeeChange {
  changed: boolean;
  value: 'tips' | 'womens' | null;
}

export interface ParHole {
  par: number;
}

// Recompute holesPlayed + netScore from a full 18-slot scores array and the
// persisted wheel adjustment. Single source of truth for the aggregate math so
// the player store and the admin correction can never drift apart.
export function aggregatesFromScores(
  scores: (number | null)[],
  holes: ParHole[],
  wheelAdjustment: number,
): { holesPlayed: number; netScore: number } {
  let strokes = 0;
  let par = 0;
  let holesPlayed = 0;
  scores.forEach((s, i) => {
    if (s !== null && s !== undefined) {
      strokes += s;
      par += holes[i]?.par ?? 4;
      holesPlayed += 1;
    }
  });
  const netScore = (holesPlayed > 0 ? strokes - par : 0) + wheelAdjustment;
  return { holesPlayed, netScore };
}

// Diff the admin's edited draft against the snapshot the modal opened with,
// returning only the holes the admin actually touched. Everything else stays
// under the authority of whatever the player has written since.
export function diffCorrectionEdits(
  snapshot: (number | null)[],
  draft: (number | null)[],
): CorrectionEdit[] {
  const edits: CorrectionEdit[] = [];
  for (let i = 0; i < 18; i++) {
    const before = snapshot[i] ?? null;
    const after = draft[i] ?? null;
    if (before !== after) edits.push({ idx: i, value: after });
  }
  return edits;
}

// Player-side single-hole write. Field-level merge (scores.{hole}) so two
// teammates scoring different holes never clobber each other, and so an admin
// correction running concurrently only ever touches the holes it changed.
export function writeHoleScore(
  db: Firestore,
  ref: DocumentReference,
  hole: number,
  score: number | null,
): Promise<void> {
  const payload = score === null
    ? { scores: { [String(hole)]: deleteField() } }
    : { scores: { [String(hole)]: score } };
  return setDoc(ref, payload, { merge: true });
}

// Admin score correction. Runs inside a Firestore transaction so the read of the
// current scores map and the recomputed aggregates are consistent even if a
// player writes a different hole mid-flight: the transaction re-reads and
// retries on conflict, then applies only the edited holes via a field-level
// merge. Concurrent player edits to other holes are preserved.
export async function correctTeamScores(
  db: Firestore,
  ref: DocumentReference,
  edits: CorrectionEdit[],
  teeChange: TeeChange,
  holes: ParHole[],
): Promise<void> {
  if (edits.length === 0 && !teeChange.changed) return;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists() ? snap.data() : {};
    const merged = normalizeScores(data?.scores);
    for (const e of edits) merged[e.idx] = e.value;

    const wheelAdj = typeof data?.wheelAdjustment === 'number' ? data.wheelAdjustment : 0;
    const { holesPlayed, netScore } = aggregatesFromScores(merged, holes, wheelAdj);

    const payload: Record<string, unknown> = { netScore, holesPlayed };
    if (edits.length > 0) {
      const scoresPatch: Record<string, unknown> = {};
      for (const e of edits) {
        scoresPatch[String(e.idx + 1)] = e.value === null ? deleteField() : e.value;
      }
      payload.scores = scoresPatch;
    }
    if (teeChange.changed) {
      payload.teeOverride = teeChange.value === 'tips' || teeChange.value === 'womens'
        ? teeChange.value
        : deleteField();
    }
    tx.set(ref, payload, { merge: true });
  });
}

// ── Wheel-sync primitives ───────────────────────────────────────────────────
// The wheel ("whack") mechanic lets one team's spin penalise another team. The
// reconciliation and recording write paths below live here (rather than inline
// in store.tsx) so their concurrency semantics can be exercised by the same
// in-memory Firestore fake the score-correction tests use.

export interface TargetedByEntry {
  item: WheelItemId;
  fromTeam: string;
  at: number;
}

export interface WheelSpinRecord {
  item: WheelItemId;
  at: number;
  /** Team name we targeted (Green/Red/Boo). */
  targetTeam?: string;
}

// Read a team doc's per-hole wheel spins, tolerating the legacy single-spin
// shape (one wheelSpin field) by bucketing it under hole 9 — the only hole the
// old fixed wheel could ever fire on.
export function spinsFromData(
  data: Record<string, unknown> | undefined | null,
): Record<number, WheelSpinRecord> {
  const out: Record<number, WheelSpinRecord> = {};
  if (!data) return out;
  const map = data.wheelSpins;
  if (map && typeof map === 'object') {
    for (const [k, v] of Object.entries(map as Record<string, unknown>)) {
      const n = parseInt(k, 10);
      if (n >= 1 && n <= 18 && v && typeof v === 'object' && (v as WheelSpinRecord).item) {
        out[n] = v as WheelSpinRecord;
      }
    }
    return out;
  }
  const legacy = data.wheelSpin as WheelSpinRecord | undefined;
  if (legacy && legacy.item) out[9] = legacy;
  return out;
}

// Apply cross-team wheel hits to this team's own doc. Runs inside a transaction
// so the read of the current targetedBy list and the increment of the score
// aggregates are consistent: each hit (keyed by fromTeam|at) is counted exactly
// once even if the same snapshot is reconciled twice or another writer lands the
// same hit mid-flight (the transaction re-reads and de-dupes against the server
// list, and arrayUnion guards the list itself). Returns how many hits were
// actually added.
export async function reconcileWheelHits(
  db: Firestore,
  ref: DocumentReference,
  possiblyMissing: TargetedByEntry[],
): Promise<number> {
  let added = 0;
  await runTransaction(db, async (tx) => {
    added = 0;
    const ourSnap = await tx.get(ref);
    if (!ourSnap.exists()) return;
    const ourData = ourSnap.data();
    if (ourData?.hasSubmitted === true) return;
    const currentTargeted = Array.isArray(ourData?.targetedBy)
      ? (ourData.targetedBy as TargetedByEntry[])
      : [];
    const serverKeys = new Set(currentTargeted.map(t => `${t.fromTeam}|${t.at}`));
    const toAdd = possiblyMissing.filter(e => !serverKeys.has(`${e.fromTeam}|${e.at}`));
    if (toAdd.length === 0) return;
    tx.set(ref, {
      wheelAdjustment: increment(toAdd.length),
      netScore: increment(toAdd.length),
      targetedBy: arrayUnion(...toAdd),
    }, { merge: true });
    added = toAdd.length;
  });
  return added;
}

// Apply a single cross-team wheel hit to a target doc inside a transaction.
// Idempotent: if the fromTeam|at key is already present in targetedBy no write
// is made and the function returns false. This mirrors reconcileWheelHits but
// operates on one entry at a time so applyEffectToOthers (the spinner's direct
// write path) and the continuous reconciler share the same server-side de-dup
// logic — eliminating the double-hit race regardless of call ordering.
export async function applyWheelHit(
  db: Firestore,
  ref: DocumentReference,
  entry: TargetedByEntry,
): Promise<boolean> {
  let applied = false;
  await runTransaction(db, async (tx) => {
    applied = false;
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const data = snap.data();
    if (data?.hasSubmitted === true) return;
    const currentTargeted = Array.isArray(data?.targetedBy)
      ? (data.targetedBy as TargetedByEntry[])
      : [];
    const key = `${entry.fromTeam}|${entry.at}`;
    if (currentTargeted.some(t => `${t.fromTeam}|${t.at}` === key)) return;
    tx.set(ref, {
      wheelAdjustment: increment(1),
      netScore: increment(1),
      targetedBy: arrayUnion(entry),
    }, { merge: true });
    applied = true;
  });
  return applied;
}

// Record a single wheel spin for a hole. One spin per wheel-hole, ever: the
// transaction re-reads before committing so two racing callers can't both write
// the hole — the loser observes the winner's spin and returns it unchanged. If
// the round was submitted on the server, an existing spin is returned and a
// brand-new spin is refused (throws 'submitted').
export async function recordWheelSpinTx(
  db: Firestore,
  ref: DocumentReference,
  hole: number,
  record: WheelSpinRecord,
): Promise<WheelSpinRecord> {
  const cleanRecord: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(record)) {
    if (v !== undefined) cleanRecord[k] = v;
  }
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists() ? snap.data() : undefined;
    const existingSpins = spinsFromData(data);
    if (data?.hasSubmitted === true) {
      const existing = existingSpins[hole];
      if (existing && existing.item) return existing;
      throw new Error('submitted');
    }
    // One spin per wheel-hole — never overwrite an existing spin.
    const existing = existingSpins[hole];
    if (existing && existing.item) return existing;
    tx.set(ref, { wheelSpins: { [String(hole)]: cleanRecord } }, { merge: true });
    return record;
  });
}

// Admin manual stroke adjustment. Bumps the persisted wheelAdjustment and the
// netScore aggregate by the same delta via field-level increments so it composes
// with concurrent score and wheel writes without clobbering them.
export function applyManualAdjustment(
  db: Firestore,
  ref: DocumentReference,
  delta: number,
): Promise<void> {
  return updateDoc(ref, {
    wheelAdjustment: increment(delta),
    netScore: increment(delta),
  });
}
