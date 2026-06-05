---
name: Duplicate final-submit paths
description: wfc-app has two separate final-round submit flows that must stay in sync
---

# Two final-submit paths in wfc-app

Both `HoleView` and `Scorecard` define their own `handleSubmitFinal` that locks in
a team's round. They are independent UI entry points to the same finalize action.

**Why:** A submit-time gate (e.g. "hole 18 is an Item Box hole — spin before
submit") added to only one path is silently bypassable from the other. A code
review caught exactly this: the gate was added to `HoleView` but not `Scorecard`.

**How to apply:** Any rule that should run before a round is finalized
(validation, forced wheel spin, confirmation) must be added to BOTH
`handleSubmitFinal` functions — or, better, centralized into one shared
"can submit final" helper in the store so future UI paths can't drift.
