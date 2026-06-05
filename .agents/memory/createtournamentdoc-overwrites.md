---
name: createTournamentDoc overwrites (wfc-app)
description: createTournamentDoc does a full setDoc with no merge — never call it just to re-enter an existing event.
---

# createTournamentDoc is a full overwrite

`createTournamentDoc` in `artifacts/wfc-app/src/lib/tournamentContext.tsx` writes
the tournament config with Firestore `setDoc(..., {...config})` — no `{ merge:
true }`. It also persists the host key to localStorage under `hostKeyKey(id)`.

**Why:** When re-entering an already-initialized canonical event (e.g. WFC 2026
via the Create preset toggle), calling `createTournamentDoc(existing)` clobbers
the live event's top-level config and races any concurrent edits. The fix was to
re-enter read-only: persist the host key locally
(`localStorage.setItem(hostKeyKey(id), hostKey)`) and skip the write entirely.

**How to apply:** Only call `createTournamentDoc` when actually creating/seeding
a doc you intend to fully own. To re-enter or refresh an existing event, read it
and persist the host key locally instead of writing it back.
