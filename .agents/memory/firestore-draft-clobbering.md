---
name: Firestore live-snapshot draft clobbering
description: Why editable drafts seeded from a live Firestore tournament doc need a dirty flag to survive snapshots.
---

# Firestore live-snapshot draft clobbering

When an editor seeds local draft state from a live Firestore document (e.g. an
`onSnapshot` listener on the tournament doc), any `useEffect` that reseeds the
draft from a field of that doc will re-run on **every** snapshot — Firestore
hands back a fresh object with fresh array/object references each update, so
dependency arrays like `[tournament?.holeRules]` change identity even when the
saved value is unchanged. This silently overwrites the host's unsaved edits.

**Rule:** Gate the reseed effect behind a `dirty` flag. Seed only while
`!dirty`; set `dirty = true` in every onChange handler; clear it after a
successful save.

**Why:** Hosts doing multi-step edits (e.g. placing rules on many holes) lose
work mid-edit when a snapshot arrives.

**How to apply:** Mirror the `rulesDirty` pattern in
`artifacts/wfc-app/src/pages/Admin.tsx` (and `CreateTournament.tsx`). Note the
shotgun-draft effect there is safe only because it seeds from a stable map; new
draft editors backed by live docs should always use the dirty-flag pattern.
