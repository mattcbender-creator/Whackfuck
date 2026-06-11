---
name: WFC team name + players display
description: How team name and player list render together, and the host-level useTeamNames setting.
---

# WFC team name / players display

Team name and player list are shown together in ~9 surfaces (Home card + join
list, JoinTournament join lists, Leaderboard, WheelModal target picker, Results
champion + standings, Admin team row, Scorecard header).

**Rule:** any surface that shows a team name with a player subtitle must render
the subtitle via `teamSubtitle(teamName, players)` from `lib/tournament.ts`, NOT
`formatPlayers(players)` directly. `teamSubtitle` returns '' when the players
string equals the team name (case-insensitive), so the subtitle disappears
instead of duplicating the name. Combined rows like `players · holes/18` build
the string with `[teamSubtitle(...), `${holes}/18`].filter(Boolean).join(' · ')`
to avoid a dangling separator when the subtitle is empty.

**Why:** the host setting `useTeamNames` (on TournamentConfig, default true) lets
the tournament creator decide whether teams name themselves. When off, the team
name IS the player list, so showing both would print the names twice. Legacy /
published docs (e.g. `wfc-2026`) lack the field — read it as on via
`tournament?.useTeamNames ?? true` / `!== false`.

**How to apply:** when adding any new place that displays a team, use
`teamSubtitle`; when reading the setting, always default-on for backward compat.
