---
name: netScore is single-discipline (always absolute, never increment)
description: Every Firestore writer of a team's netScore must write it as an absolute recompute (rawNet + wheelAdjustment); mixing absolute and increment(delta) writes double-counts.
---

## Rule
`netScore` on a team doc has exactly ONE write discipline: **absolute**. Every path
that touches it must set `netScore = aggregatesFromScores(normalizeScores(scores), holes, wheelAdjustment).netScore`
(i.e. `rawNet + wheelAdjustment`), never `increment(delta)`. `wheelAdjustment` is the
opposite — it is **increment-only** and is the single source of truth for the cumulative
wheel/manual delta.

## Why
The double-count bug (Mike & Les showed net -5 instead of -3): `netScore` was written
by TWO incompatible disciplines at once.
- Absolute writers: the store's sync `useEffect` and `correctTeamScores`.
- Increment writers: the four wheel/manual transactions + a legacy self-effect path,
  each doing `netScore: increment(delta)`.

When an absolute write races an increment write on the same field, the delta lands
twice — once baked into the absolute recompute (because `wheelAdjustment` already
moved), and once from the standalone `increment`. `wheelAdjustment` itself stayed
correct precisely because it was increment-only (one discipline), which is what
pinpointed the asymmetry.

The earlier belief — "self-effects MUST also write `netScore: increment(delta)` or a
stale snapshot loses the adjustment" — was the cause, not the fix. The real fix for a
stale snapshot is that `wheelAdjustment` is authoritative and `netScore` is always
recomputed from it; the absolute write self-heals.

## How to apply
Any new writer of `netScore` (cross-team hit, self-effect spin, admin manual adjust,
score correction, sync effect) must:
- write `wheelAdjustment` via `increment(delta)` (composes with concurrent writes), and
- write `netScore` as the absolute recompute from the doc's current `scores` +
  `currentAdj + delta`, inside the same transaction.
Functions that recompute netScore need the `holes: ParHole[]` (par list) passed in so
they can compute `rawNet`. Never reintroduce `netScore: increment(...)` anywhere.
