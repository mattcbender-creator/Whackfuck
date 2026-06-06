---
name: Whacky chat channels
description: Where the Whacky roast-bot is allowed to post in wfc-app chat, and the two code paths that produce his messages.
---

Whacky (the AI roast persona) delivers messages as **DMs only**, styled like a team DM. He must never post to the global Lobby (`channel: 'general'`).

- His DM channel is `dmChannelId('__whacky__', teamId)` with `toTeamId = teamId`, `fromTeamId = '__whacky__'`, `isWhacky: true`, and a `face` field (only Whacky messages carry `face`).
- He is surfaced to the host as a pinned synthetic contact (`WHACKY_CONTACT`, id `__whacky__`) at the top of the Teams DM list — he is not a real team doc, so he won't appear via `listTeamsOnce`.

**Why:** the Lobby is meant to read like a clean team-to-team text platform; Whacky cluttered it. DMs also trigger the existing DmBanner/unread logic (`toTeamId===teamId && fromTeamId!==teamId`).

**How to apply:** Whacky messages are generated in TWO places — keep them in lockstep:
1. `Chat.tsx` `postWhacky` (timed DMs + reply when the user DMs Whacky).
2. `Admin.tsx` demo simulation (host-DM branch, ~35% from Whacky).
If you change Whacky's channel/payload shape, update both, and make sure neither writes `channel: 'general'`.
