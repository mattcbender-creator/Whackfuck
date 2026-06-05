---
name: WFC scoring data shape
description: Why golf scores are a hole-keyed map in Firestore but an array in local/UI state
---

# Scores: map in Firestore, array in local state

WFC stores per-team hole scores as a **hole-keyed map** (`{ "1": 4, "2": 5, ... }`)
in Firestore, but as an **18-length array** in local/UI state. Conversion helpers
live in `artifacts/wfc-app/src/lib/tournament.ts`: `scoresToMap(arr)` on write,
`normalizeScores(raw)` on read (tolerates both array and map input → 18-len array).

**Why:** multiple group members score concurrently. A map lets Firestore merge
individual hole writes without clobbering each other; an array write would
overwrite the whole field and lose concurrent edits. Arrays are kept locally only
because the UI indexes holes positionally.

**How to apply:** any new code that writes team scores to Firestore must go
through `scoresToMap`, and any snapshot/read must run `normalizeScores` before
the value reaches UI state. Never write a raw array to the `scores` field.

# Tournament-scoped Firestore writes

All team/event/drive/config Firestore refs are scoped to the active tournament
via helpers in `tournament.ts` (`teamsCol`, `eventsCol`, `drivesCol`, `teamDoc`,
`configDoc`) which resolve the active tournament id internally. `teamDoc` falls
back to a `__no_tournament__` sentinel when none is active.

**Why:** that sentinel fallback means an unguarded write can silently land in the
wrong namespace instead of aborting.

**How to apply:** every mutating handler must guard with
`if (!db || !getActiveTournamentId()) return;` BEFORE calling any scoped ref.
Do not rely on the sentinel to no-op a write.
