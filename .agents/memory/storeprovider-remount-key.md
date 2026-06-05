---
name: StoreProvider remount key (wfc-app)
description: Why changing the active tournament mid-screen wipes local component state in wfc-app.
---

# StoreProvider remount key

In `artifacts/wfc-app/src/App.tsx`, `<StoreProvider key={activeId ?? "__none__"}>`
keys the store on the active tournament id. Any code that changes the active
tournament (`setActiveTournament` / `setActiveTournamentId`) forces React to
unmount and remount the entire Router subtree, discarding all local component
state below it.

**Why:** This caused the create-tournament bug. `CreateTournament` set the new
tournament active right after writing it, which remounted the page and threw
away the `created` state that renders the success screen — the form appeared to
"reset" and the create looked broken, even though the Firestore write succeeded.

**How to apply:** Only switch the active tournament at a navigation boundary
(when you are leaving the current screen anyway, e.g. tapping "Enter
Tournament" → `/home`). Never call `setActiveTournament` while you still need
to keep rendering local state on the current screen.
