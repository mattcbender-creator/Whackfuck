---
name: WFC team identity settings
description: Two host-level team toggles (useTeamNames, requireTeamCode) and the rules every UI surface must follow.
---

# WFC team identity settings

Two tournament-config flags are decided by the host, default-on, and must be read
backward-compatibly (`tournament?.flag !== false` / `?? true`) because published
docs predate them.

## useTeamNames
When off, the team name IS the player list, so showing both duplicates the names.
Any surface that renders a team name with a player subtitle must build the
subtitle through `teamSubtitle()` (returns '' when it would just repeat the name),
never `formatPlayers()` directly. Name-entry inputs (Home registration, Admin team
edit) must hide the name field and derive the name from players when off.

## requireTeamCode
Every path that lets a device claim/join an existing team must require the team's
4-char code when this is on. There are multiple such paths (JoinTournament team
picker AND the Home "existing teams" list) — gating only one leaves a bypass.

**Why:** a fresh code review flagged the Home list as a hard authorization bypass
because it claimed teams directly while JoinTournament correctly gated on the code.
**How to apply:** when adding any new join/claim entry point, gate it on
`requireTeamCode`; when adding any team-display surface, use `teamSubtitle` and the
default-on reads above.
