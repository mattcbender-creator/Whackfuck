---
name: Testing Firestore transaction concurrency
description: How wfc-app unit-tests Firestore transaction/merge races without a real backend
---

# Testing Firestore transaction concurrency (wfc-app)

The conflict-free score writes live in `artifacts/wfc-app/src/lib/scoreSync.ts`
(`writeHoleScore`, `correctTeamScores`, `aggregatesFromScores`) so they can be
exercised outside React. `scoreSync.test.ts` mocks `firebase/firestore` with an
in-memory fake built via `vi.hoisted`.

The fake models two behaviours that the safety actually depends on:
- **merge:true deep-merges nested maps** and treats a `deleteField()` sentinel as
  key deletion — that is what makes `scores.{hole}` writes non-clobbering.
- **`runTransaction` retries on optimistic-concurrency conflict**: `tx.get`
  records a per-doc version; if the doc's version changed before commit, the whole
  body re-runs. A one-shot `queueAfterFirstGet` hook injects a concurrent player
  write between the admin's read and commit, forcing the retry path.

**Why:** field-level merge alone preserves the *scores map*, but the recomputed
`netScore`/`holesPlayed` would be stale without the transaction retry. Tests
assert the stored aggregates equal a fresh recompute from the final merged map,
so a regression that drops the transaction (or does a full-array overwrite) fails.

**How to apply:** when testing any Firestore transaction race here, reuse this
fake pattern rather than spinning up the emulator; keep aggregate assertions
derived from the final stored doc, not hard-coded, so they can't drift from the
production formula.
