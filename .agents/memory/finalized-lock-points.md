---
name: Finalized tournament lock points
description: All score/net mutation paths must guard on status==='final' (and the parallel scoringLocked pause) AND surface feedback, or the app looks totally broken.
---

# Finalized tournament lock points (WFC)

When a tournament's `status === 'final'`, the app must lock **every** path that
mutates a team's score or net, and each lock must be **visible** to the user.

There is also a SEPARATE host pause: `tournament.scoringLocked === true` (optional
field, absent → unlocked). It blocks the SAME write paths as `final` but does NOT
redirect anyone to results — players stay on their screens. Any new write path you
gate for `final` must ALSO gate for `scoringLocked` (and vice versa), or the pause
is bypassable. The full write surface is larger than the steppers:
- store `setScore`, `recordWheelSpin`, `applyEffectToSelf`, `applyEffectToOthers`
- Scorecard `handleSync` (pushes scores to leaderboard — easy to forget)
- BOTH final-submit flows: `HoleView.handleSubmitFinal` AND `Scorecard.handleSubmitFinal`
  (each does its own `setDoc` of `scoresToMap(scores)` — see `final-submit-paths.md`)
- the submit/sync buttons themselves should be hidden/disabled when blocked, not just no-op

**Rule:** every mutation entry point guards on `tournament?.status === 'final'`
(and `scoringLocked === true`):
- store `setScore` (direct hole scoring)
- store `recordWheelSpin`, `applyEffectToSelf`, `applyEffectToOthers` (wheel/item-box effects — these mutate `wheelAdjustment`/`netScore`, a real bypass if left open)
- UI score steppers (HoleView `handleScore`, Scorecard `handleChange`)
- UI "Spin Item Box" buttons (HoleView + Scorecard) and `WheelModal.handleSpin`

**Why:** a finalized tournament that *silently* no-ops scoring is the #1
"nothing works" report. A host finalizes (intentionally or via the Admin panel),
then the steppers do nothing with zero feedback and the in-order nav toast
("Holes must be entered in order") appears as a confusing downstream symptom.
The bottom nav switching to the 4-tab `finalTabs` (Home/Results/Live/Rules) is
the tell that status is `final`. Recovery (reopen) was once buried only in Admin.

**How to apply:**
- Never add a silent `if (final) return;` without paired user feedback. Steppers
  must toast; the recoverable escape hatch is `FinalizedBanner` (shown on Home,
  HoleView, Scorecard) with a host-only "Reopen scoring" button calling
  `reopenTournament()` (sets status back to `live` via merge setDoc).
- Host-only reopen is enforced client-side via `isHost` only. If Firestore rules
  are ever tightened, host authorization for tournament status writes must move
  into security rules — UI gating is not a security boundary.
