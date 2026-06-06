---
name: Async sim tick cancellation
description: Why interval-driven async ticks in wfc-app need a runningRef guard, not just clearInterval.
---

# Async simulation ticks need an explicit cancellation flag

In wfc-app Admin Demo Mode, the simulation runs an async tick on a setInterval.
Clearing the interval (or setting `simulating=false`) does NOT stop a tick that
is already mid-flight — it keeps awaiting `updateDoc`/`addDoc` and can leak
Firestore writes after stop/timeout.

**Rule:** any interval-driven async loop that writes must check a `runningRef`
(plain `useRef(true/false)`) before *every* await/write, and set it `false`
synchronously in the stop path (effect cleanup, the `!simulating` branch, the
unmount cleanup, and at the top of the timeout handler).

**Why:** clearInterval only prevents *future* invocations; it can't unwind an
in-progress async function. Without the flag, a stop or 5-min auto-timeout can
still spray writes against the Firebase free-tier limits it was meant to protect.

**How to apply:** guard at tick top (`if (!runningRef.current) return`), inside
per-item loops (`if (!runningRef.current) return/break`), and before each
batched side effect (chat posts, etc.). Also seed per-item schedules with a
staggered offset so the first tick doesn't dump every item's write at once.
