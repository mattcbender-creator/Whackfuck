---
name: WFC tee-change toast fires on refresh
description: Why "skip the first run" guards leak a toast on page reload in wfc-app store, and the baseline-ref fix.
---

The auto-tee toast ("Tee unlocked: Tips" / "Tee switched to Women's") in `store.tsx` must only fire on genuine in-round tee changes, never on a page refresh that simply restores an under-par (Tips) state.

A naive "skip the first effect run" guard (a ref set true on first run) does NOT work here and leaks a toast on every refresh.

**Why:** the localStorage hydrate effect sets `hydratedRef.current = true` *synchronously* within its own commit, before the `setScoresState(...)` updates re-render. So when the tee effect runs in that same commit it sees `hydratedRef === true` but `currentTee` is still the default `'womens'` (scores not yet applied). The skip-once guard is consumed on that stale render, then the real hydrated value (`'tips'`) re-renders and fires the toast.

**How to apply:** gate the toast on `hydratedRef.current && lockResolved` (the Firestore snapshot batches `setLockResolved(true)` together with the score updates, so `currentTee` is final in that render). Use a `prevTeeRef` baseline: on the first settled run record `currentTee` silently and return; only toast when `prevTeeRef.current !== currentTee`. Keep `lockResolved` in the effect deps. Same pattern applies to any "only react to changes after load" effect in this store.
