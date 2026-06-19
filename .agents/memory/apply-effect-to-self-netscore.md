---
name: applyEffectToSelf must write netScore
description: Self-wheel effects (mushroom, super_star) must write netScore atomically; relying on sync effect alone causes a race with the Firestore listener.
---

## Rule
`applyEffectToSelf(delta)` must write **both** `wheelAdjustment: increment(delta)` and `netScore: increment(delta)` in the same `setDoc` call.

## Why
The store has two competing write paths for `netScore`:
1. **Direct write** in `applyEffectToSelf` — only wrote `wheelAdjustment`, relied on the React sync useEffect to push `netScore`.
2. **Sync useEffect** — fires when `netScore` or `wheelAdjustment` changes in local state, writes the absolute value `rawNet + wheelAdjustment`.

Race condition: If the Firestore listener fires with a stale snapshot (old `wheelAdjustment`) *before* the sync effect runs, it calls `setWheelAdjustment(oldValue)`, resetting local state. The sync effect then writes the *old* `netScore`, losing the wheel adjustment. This manifested as super_star and mushroom spins appearing to do nothing on the leaderboard / net score display.

## How to apply
Any time you touch `applyEffectToSelf` or add a new self-effect write path, ensure the Firestore write includes `netScore: increment(delta)` alongside `wheelAdjustment: increment(delta)`. This matches the pattern used by `applyWheelHit` (cross-team) and `applyManualAdjustment` (admin). The sync effect can still run — it writes the same absolute value and does not double-count.
