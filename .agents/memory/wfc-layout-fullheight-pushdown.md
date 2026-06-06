---
name: WFC full-height page pushdown
description: Why h-[100dvh] pages in wfc-app overflow the viewport and push bottom-anchored UI (like the chat input) off-screen.
---

In wfc-app the app shell (`App.tsx` Router) is NOT a flex column — it's a plain `min-h-[100dvh]` div that renders `LiveTicker` (an in-flow block, not fixed) above the routed page. Individual pages then use `h-[100dvh]`.

So on any route where `LiveTicker` is visible, total height = ticker height + 100dvh, which **overflows the viewport**. Anything anchored to the bottom of a `h-[100dvh]` page (e.g. a chat send bar at the end of the flex column) ends up below the fold and requires scrolling to reach.

**Why:** ticker is in-flow and adds height on top of a rigid full-viewport page.

**How to apply:** don't rely on "bottom of an h-[100dvh] flex column" being on-screen. For must-always-be-visible bottom UI (chat input), use `position: fixed` pinned to the viewport (e.g. `fixed bottom-16` to clear the h-16 BottomNav) and add matching bottom padding to the scroll area. Also pair with `interactive-widget=resizes-content` in the viewport meta so the keyboard shrinks the layout instead of covering the fixed input.
