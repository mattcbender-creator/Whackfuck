---
name: WFC shotgun play-order invariant
description: How shotgun-start hole ordering stays compatible with normal start in the WFC golf PWA
---

# WFC shotgun start — play-order invariant

The WFC PWA supports `startType: 'normal' | 'shotgun'`. Shotgun teams begin on a
different hole and wrap around all 18.

**Rule:** all per-hole navigation/gating math is expressed in *play order* via a
`holeOrder` array (`((startingHole-1+i)%18)+1`) exposed from `store.tsx`. For a
normal start `startingHole=1` so `holeOrder=[1..18]` and every play-order
computation collapses to the original hole-index math.

**Why:** normal-start play must remain byte-identical; the wrap-around array is
the single mechanism that guarantees it without branching every call site.

**How to apply:**
- Never read `shotgunAssignments` unconditionally — gate on
  `tournament.startType === 'shotgun'`, else force start hole 1. (A stale/migrated
  assignments map on a normal tournament must not change behavior. This bit
  Leaderboard's Groups-on-Course once.)
- Normal-only mechanics (front-9 lock, Item Box / wheel front→back gate) are
  gated to `!isShotgun`.
