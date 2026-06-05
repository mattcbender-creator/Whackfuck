import {
  runTransaction, setDoc, deleteField,
  type Firestore, type DocumentReference,
} from 'firebase/firestore';
import { normalizeScores } from './tournament';

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
