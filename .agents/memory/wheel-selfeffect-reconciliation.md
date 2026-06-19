---
name: Wheel self-effect optimistic reconciliation
description: Why atomic self-effect wheel spins must reconcile from the tx return value, not the onSnapshot listener.
---

# Atomic self-effect wheel spins (Mushroom / Super Star)

Self-effect spins record the per-hole spin AND apply the score delta in ONE
Firestore transaction (so the spin pill and netScore can never partially apply).
The client applies the delta optimistically first, then awaits the transaction.

**Rule:** the transaction must return the AUTHORITATIVE post-commit
`wheelAdjustment`, and the client must snap its optimistic value to that returned
value after the await. Do NOT rely on the `onSnapshot` listener to heal an
over-applied optimistic delta.

**Why:** optimistic wheel-adjustment writes are wrapped in
`pendingWheelAdjWritesRef++/--`, and the store's `onSnapshot` handler SKIPS
applying remote `wheelAdjustment` while `pendingWheelAdjWritesRef.current > 0`
(to stop the listener clobbering an in-flight optimistic write). A no-op
transaction (`applied:false`, e.g. another device already spun that hole) writes
nothing, so it triggers no new snapshot — meaning the listener may never deliver
a correcting value, and the over-applied delta would persist. Transaction retry
semantics make the returned value authoritative at commit (any concurrent doc
write forces a retry), so reconciling to it is correct even under races.

**How to apply:**
- The tx returns `{ spin, applied, wheelAdjustment }`. On `applied:false` also
  adopt `result.spin` (the winner may have spun a different item on the same hole).
- On `Error('submitted')` roll back the optimistic spin + delta and set
  `hasSubmitted` locally. On generic/offline errors KEEP the optimistic spin
  (offline-first), matching `recordWheelSpin`.
- The store method returns `{ applied }` so `WheelModal` can gate the live-feed
  `logEvent` on `applied` — never log on a refused (`submitted`) or no-op result,
  or you get false/duplicate feed entries.
