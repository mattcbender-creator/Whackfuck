# WFC App — Pre-Flight System Blueprint
**Generated:** June 05, 2026  
**Codebase:** `@workspace/wfc-app` · React 18 + Vite + TypeScript · Firebase Firestore (optional)

---

## 1. SINGLE SOURCE OF TRUTH (DATA SCHEMA)

### Primary Database

**Hybrid: Firebase Firestore + `localStorage`.**

- **Firestore** is the authoritative server store for all live tournament data. It is *optional* — if `VITE_FIREBASE_*` environment variables are absent, the app silently falls back to `localStorage`-only mode. All Firestore writes use `{ merge: true }` (field-level) for concurrent safety; per-hole scores specifically use a field-level merge keyed by hole number (`"1"` through `"18"`) so two teammates can score simultaneously without overwriting each other.
- **`localStorage`** is the device-local persistence layer. It is the sole store in offline mode and acts as a local cache + identity anchor in online mode. All keys are namespaced under the `wfc-` prefix.

**Key `localStorage` keys (all scoped per `tournamentId`):**

| Key | Purpose |
|---|---|
| `wfc-active-tournament` | Active tournament ID (global module pointer) |
| `wfc-state::{tId}` | Full local game state snapshot (JSON blob) |
| `wfc-team-id::{tId}` | This device's Firestore team doc ID |
| `wfc-joined-at::{tId}` | Epoch ms when team registered (used for admin reset detection) |
| `wfc-server-confirmed::{tId}` | Set to `"1"` once Firestore confirmed the team doc exists |
| `wfc-host-key::{tId}` | Host recovery key (matched against Firestore `hostKey` field) |
| `wfc-spectator::{tId}` | `"1"` if device is in spectator mode for this tournament |
| `wfc-starting-hole::{tId}` | Cached shotgun starting hole (offline resilience) |

---

### Firestore Collection Structure

```
tournaments/{tId}                     ← TournamentConfig doc (top-level)
tournaments/{tId}/teams/{teamId}      ← one doc per registered team
tournaments/{tId}/events/{autoId}     ← live feed events (birdies, eagles, wheel spins, messages)
tournaments/{tId}/config/tournament   ← admin-only config doc (resetAt timestamp, etc.)
tournaments/{tId}/longestDrives/...   ← drive contest entries
```

---

### Core TypeScript Interfaces

#### `TournamentConfig` — `lib/tournament.ts`
```typescript
interface TournamentConfig {
  id: string;
  name: string;
  courseName: string;
  holes: CourseHole[];           // 18 holes, always present
  trackYardages: boolean;
  teamSize: number;              // 1–4 player name fields per team
  startType: 'normal' | 'shotgun';
  autoTeeRule: boolean;          // WFC mechanic: raw score under par → Tips tee
  adminCode: string;             // 6-char code to unlock Admin panel
  hostKey: string;               // 16-char host recovery key (XXXX-XXXX-XXXX-XXXX)
  joinCode: string;              // 6-char public join code
  holeRules: HoleRule[];         // 18 configurable rule slots
  customRules?: RuleLibraryEntry[];
  status: 'setup' | 'live' | 'final';
  createdAt: number;
  shotgunAssignments?: Record<string, number>; // teamId → startingHole (shotgun only)
}
```

#### `CourseHole` — `lib/tournament.ts`
```typescript
interface CourseHole {
  hole: number;      // 1–18
  par: number;
  hdcp: number;      // handicap index
  tips: number;      // yardage (longest tee)
  mid: number;       // yardage (middle — stored in schema, hidden in current UI)
  womens: number;    // yardage (shortest tee)
  ruleName: string;
  rule: string;
}
```

#### `HoleRule` — `lib/tournament.ts`
```typescript
interface HoleRule {
  type: 'standard' | 'wheel' | 'none';
  ruleName: string;
  ruleText: string;
}
// 'wheel' = Mario Kart Item Box rule — auto-fires the spin UI when
// a score is entered on that hole.
```

#### `WFCState` — per-device team state, `lib/store.tsx`
```typescript
interface WFCState {
  teamId: string;
  teamCode: string | null;           // 4-char rejoin code (set on first registration)
  teamInfo: TeamInfo | null;         // { teamName: string; players: string[] }
  scores: (number | null)[];         // 18-slot array; null = not yet scored
  currentTee: 'tips' | 'womens';
  netScore: number;                  // rawNet + wheelAdjustment
  rawNet: number;                    // strokes vs par (wheel adjustments excluded)
  holesPlayed: number;
  startingHole: number;             // 1 for normal; 1–18 for shotgun
  holeOrder: number[];              // play sequence (wraps around for shotgun)
  isShotgun: boolean;
  frontNineConfirmed: boolean;
  wheelSpin: WheelSpinRecord | null;           // latest spin (back-compat single-spin UI)
  wheelSpins: Record<number, WheelSpinRecord>; // per-hole spin records keyed by hole number
  wheelAdjustment: number;          // cumulative stroke penalty from wheel hits received
  targetedBy: TargetedByEntry[];    // incoming wheel attacks from other teams
  hasSubmitted: boolean;
  submittedAt: number | null;
  serverTeamMissing: boolean;       // Firestore confirmed this team doc does not exist
}
```

#### Firestore Team Document (live shape)
```
teamName: string
players: string[]
teamCode: string                  // 4-char rejoin code
scores: Record<string, number>   // map keyed "1".."18" (not an array)
netScore: number
holesPlayed: number
currentTee: 'tips' | 'womens'
frontNineConfirmed: boolean
wheelSpins: Record<string, WheelSpinRecord>
wheelAdjustment: number
targetedBy: TargetedByEntry[]
hasSubmitted: boolean
submittedAt: number | Timestamp | null
lastUpdated: serverTimestamp
isDemo?: boolean                  // seeded demo teams only
teeOverride?: 'tips' | 'womens' | null   // admin-forced tee override
```

---

### Boolean State Flags

| Flag | Where | Meaning When `true` |
|---|---|---|
| `hasSubmitted` | `WFCState` + Firestore team doc | Final scorecard submitted. Blocks all score writes, wheel spins, team info edits. Admin can reset it to `false` to re-open scoring. |
| `frontNineConfirmed` | `WFCState` + Firestore team doc | Team has acknowledged completion of the front nine. Informational; does not block scoring. |
| `isSpectator` | `localStorage` + `TournamentContext` | Device is watching only. Routing `Guard` blocks `/home`, `/scorecard`, `/hole`. Redirects to `/leaderboard`. |
| `isHost` | Computed in `TournamentContext` | `localStorage.getItem('wfc-host-key::{tId}') === tournament.hostKey`. Grants host-only UI (reopen after finalize, admin shortcut). |
| `serverTeamMissing` | `WFCState` (local) | Firestore confirmed the team doc is absent. Triggers auto-wipe toast + device reset after 1.5 s. |
| `isShotgun` | `WFCState` (derived) | Tournament uses a shotgun start; play order wraps from the team's assigned starting hole. |
| `lockResolved` | `StoreProvider` (local ref) | Firestore snapshot listener has returned at least one non-pending response. Score writes are gated on this to avoid overwriting server state before hydration. |
| `tournament.status === 'final'` | `TournamentConfig` | Tournament is finalized. Score steppers and wheel spins silently no-op. Non-host players are redirected to `/results`. Host retains access to `/home` and `/admin`. |
| `tournament.status === 'live'` | `TournamentConfig` | Normal active state. All scoring enabled. |
| `autoTeeRule` | `TournamentConfig` | WFC-specific mechanic. When `true`, `currentTee` is computed as `rawNet < 0 ? 'tips' : 'womens'`. When `false`, defaults to `'womens'`. |

---

## 2. THE "JOIN / REGISTER" USER JOURNEY

### Step-by-Step: Joining a Tournament

**Entry point:** `Landing.tsx` → tap **Join Tournament** → navigates to `/join`

**Step 1 — Code Entry (`JoinTournament.tsx`, `step === 'code'`)**

1. User enters a 6-character join code (case-insensitive; auto-uppercased in the input).
2. On tap of **Continue**, `resolveCode()` is called:
   - Guards: Firebase must be configured. Code length must be ≥ 4 characters.
   - Calls `lookupJoinCode(code)` → Firestore query: `collection('tournaments').where('joinCode', '==', normalisedCode)`.
   - Returns `null` if no match → shows error "No tournament found for that code."
3. On success, `resolved` state is set to the `TournamentConfig` doc and the step advances to `'choose'`.

**Deep-link shortcuts:**

- `/join/{code}` — auto-resolves the code, skips manual entry.
- `/join/{code}/{teamCode}` — auto-resolves + directly rejoins the matching team (no step selection).
- `/watch/{code}` — auto-resolves + immediately enters spectator mode, skips `'choose'`.

**Step 2 — Choose (`step === 'choose'`)**

Four options are presented:

| Option | Action |
|---|---|
| **Register new team** | Calls `enterAsPlayer(t.id)` → stores `t.id` in `wfc-active-tournament`, removes spectator flag. Navigates to `/home` where the registration form is shown. |
| **Rejoin my team** | Advances to `step === 'rejoin'`. Fetches all teams for the tournament via `getDocs`. |
| **Spectate** | Calls `enterSpectator(t.id)` → stores `wfc-spectator::{tId} = "1"`. Navigates to `/leaderboard`. |
| **I'm the host on a new device** *(subtle link)* | Expands a key-entry card. See Section 4 for host recovery logic. |

**Step 3 — Rejoin (`step === 'rejoin'`)**

1. All registered teams are listed (fetched once via `getDocs`; no live listener here).
2. User selects their team from the list.
3. User enters their **4-character team code** (`teamCode` field on the Firestore team doc).
4. On confirm: code is compared locally with `selectedTeam.teamCode.toUpperCase()`.
   - Mismatch → error shown, no navigation.
   - Match → `enterAsTeam()` is called: writes `wfc-team-id::{tId}` to localStorage (the existing team doc ID), removes the local state cache (`wfc-state::{tId}`), sets `wfc-joined-at`, calls `enterAsPlayer()`, navigates to `/home`. Page then reloads so the Firestore snapshot listener hydrates all state from the server.

---

### "Create Team" / Registration — `Home.tsx`

Registration happens at `/home` once a device is inside a tournament.

**Validation applied before `setTeamInfo()` is called:**

```typescript
const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  const cleaned = players.map(p => p.trim()).filter(Boolean);
  if (!teamName.trim() || cleaned.length === 0) return; // HTML required + JS guard
  setTeamInfo({ teamName: teamName.trim(), players: cleaned });
};
```

**What is NOT validated:**

- **No duplicate team name check.** The app does not query Firestore to confirm uniqueness before writing. Two teams can register with the same name; Firestore will have two separate documents with the same `teamName` field. The leaderboard and admin panel display both. This is a known gap.
- **No profanity filter.** Any string is accepted.

**What happens on submit:**

1. `setTeamInfo()` in `StoreProvider` is called.
2. A 4-character `teamCode` is generated (if this device doesn't already have one) using a URL-safe alphabet with no ambiguous characters (no 0/O, 1/I/L).
3. State is saved to `localStorage` immediately.
4. `wfc-joined-at::{tId}` is set to `Date.now()`.
5. Firestore write: `setDoc(teamDoc, { teamName, players, teamCode, scores: {}, netScore: 0, holesPlayed: 0, ... }, { merge: true })`. This fires asynchronously.
6. Before the Firestore write, the app does a one-time `getDocs` of all existing teams to detect any pre-existing Lightning wheel hits that should apply to this team on entry (cross-team wheel reconciliation).
7. After `setTeamInfo()` returns, the form is hidden and the user is navigated to `/hole` automatically.

---

### Lobby / Real-Time Updates

- **Leaderboard (`/leaderboard`):** Uses `onSnapshot(teamsCol(db), ...)` — fully real-time. Updates push to all clients the moment any team doc changes in Firestore.
- **Admin team list:** Also uses `onSnapshot` while team management, audit, or share panels are open.
- **Home (`/home`):** Does **not** have a lobby listener. The registration form is shown/hidden based on local `teamInfo` state. There is no live list of "who else has joined."
- **The join `rejoin` step:** Teams are fetched **once** with `getDocs` at the moment the user taps "Rejoin my team." It does not refresh in real time. If a team registers while this step is open, it will not appear until the user backs out and re-enters.

---

## 3. STATE LOCKS AND DEVICE AUTHENTICATION

### How a Device is Tied to Its Team

There are no cookies, JWTs, or sessions. Authentication is entirely `localStorage`-based:

1. On first registration, `crypto.randomUUID()` (or a timestamp fallback) is generated as `teamId` and stored at `wfc-team-id::{tId}`.
2. This `teamId` is the Firestore document ID for that team's score doc under `tournaments/{tId}/teams/{teamId}`.
3. Every Firestore read/write uses this ID directly. There is no server-side session validation — any device that has the correct `teamId` in localStorage can write to that team's Firestore doc.

### Browser Close → Return 2 Hours Later

On next page load:

1. `getActiveTournamentId()` reads `wfc-active-tournament` from `localStorage`.
2. `StoreProvider` initialises with `getOrCreateTeamId()` → reads `wfc-team-id::{tId}`.
3. The `localStorage` hydration `useEffect` runs and restores all gameplay state (scores, teamInfo, hasSubmitted, etc.) from `wfc-state::{tId}`.
4. The Firestore `onSnapshot` listener then fires. If the server doc has data newer than the local cache, specific fields are overwritten (scores, wheelAdjustment, hasSubmitted, teamInfo, teamCode).
5. The device is fully restored to its previous state within one round-trip to Firestore.

There is **no session expiry.** localStorage persists until the user clears their browser data, the device resets, or the admin deletes the team (which triggers an auto-wipe — see below).

### Score / Name Lock Logic

**Score writes are blocked when any of the following is true:**

```typescript
// In setScore():
if (hasSubmitted) return;
if (tournament?.status === 'final') return;
```

Both conditions are checked independently. A scorecard is locked by either the team submitting (`hasSubmitted = true`) or the host finalizing the tournament (`status = 'final'`). The admin can unlock a team by writing `{ hasSubmitted: false }` to the team's Firestore doc, which the `onSnapshot` listener picks up and immediately re-enables scoring.

**Team name / player writes are blocked when:**

```typescript
// In updateTeamInfo():
if (hasSubmitted) {
  toast({ title: 'Round already submitted', variant: 'destructive' });
  return;
}
```

**Wheel spin writes are blocked when:**

```typescript
if (hasSubmitted) return;
if (tournament?.status === 'final') return;
if (wheelSpins[hole]?.item) return; // already spun this hole
```

**There is no server-side write rule enforcement.** Locking is purely client-side. A motivated user with browser dev tools could write directly to their Firestore team doc since the app uses Firebase in client mode with no security rules enforced by this codebase. Firestore Security Rules (configured in the Firebase Console, not in this repo) are the only server-side enforcement layer.

### Admin-Triggered Auto-Wipe

If the host deletes a team from the admin panel, the `serverTeamMissing` flag is set in the deleted team's `onSnapshot` handler. The `StoreProvider` detects this and (if `wfc-server-confirmed::{tId} === '1'`) triggers `resetDevice()` after 1.5 seconds, clearing all local state and reloading the page.

---

## 4. ADMIN CONTROLS AND RECOVERY

### Accessing Admin

- Route: `/admin` (accessible to all devices inside a tournament, including spectators).
- **Authentication:** The admin panel prompts for the `adminCode` (6-char code set at tournament creation, stored in the `TournamentConfig` doc). On correct entry, `auth` state is set to `true` locally. There is no server-side session; refreshing the page requires re-entering the code.
- **Host shortcut:** Devices where `isHost === true` (localStorage host key matches Firestore) see the admin panel unlocked by default without needing the `adminCode`.

### Admin Capabilities (from `Admin.tsx`)

| Capability | Mechanism |
|---|---|
| **Broadcast message** | `addDoc(eventsCol, { type: 'message', message, ... })` → appears in the live ticker on all devices. |
| **Seed demo teams** | Writes N fake team docs to Firestore with random scores. Configurable count (default 13). |
| **Simulate live scoring** | `setInterval`-based loop that advances demo team scores in real-time. |
| **View / manage all teams** | Live `onSnapshot` listener on `teamsCol`. Sorted by `netScore` ascending. |
| **Delete a team** | `deleteDoc(teamDoc)` → auto-wipe fires on the deleted device within 1.5 s. |
| **Edit team name / players** | `setDoc(teamDoc, { teamName, players }, { merge: true })`. |
| **Manually adjust net score** | `setDoc(teamDoc, { wheelAdjustment: increment(delta), netScore: increment(delta) }, { merge: true })`. |
| **Per-hole score correction** | Computes a diff between the corrected scorecard and the current one, then writes only the changed holes as field-level merges to avoid concurrency conflicts. Also recalculates and writes `netScore`. |
| **Force tee override** | `setDoc(teamDoc, { teeOverride: 'tips' | 'womens' | null }, { merge: true })`. Overrides the auto-tee rule for a specific team. |
| **Finalize tournament** | `setDoc(tournamentDoc, { status: 'final' }, { merge: true })`. Non-host players are redirected to `/results`. |
| **Reopen tournament** | `setDoc(tournamentDoc, { status: 'live' }, { merge: true })`. Host-only. |
| **Full reset** | Writes `{ resetAt: serverTimestamp() }` to `config/tournament`. Every device compares `resetAt` vs their `wfc-joined-at::{tId}`; if `resetAt` is newer, local state is wiped. **Does not delete Firestore team docs.** |
| **Delete all demo teams** | Batch deletes all docs where `isDemo === true`. |
| **Delete all teams** | Batch deletes all team docs regardless of `isDemo`. |
| **Shotgun hole assignment** | Writes `{ shotgunAssignments: { [teamId]: holeNumber } }` to the tournament doc. Clients pick this up via their tournament `onSnapshot` listener. |
| **Edit live hole rules** | Writes updated `holeRules[]` + `customRules[]` to the tournament doc. Live on all devices immediately. |
| **Rotate host key** | Generates a new `hostKey`, writes it to the tournament doc, updates the host device's localStorage. All other host devices are immediately signed out. |
| **Share / QR code** | Generates a QR code (lime-on-black, `qrcode` library) pointing to the join link. Displays per-team invite links with team codes. |
| **Score audit flags** | Detects: submitted with < 18 holes, doc edited after `submittedAt`, suspiciously low net score (≤ -5 high / ≤ -3 medium), eagle on a par-3, Item Box hole scored without a recorded spin. |

---

### Host Recovery Key — Complete Flow

**At creation (`CreateTournament.tsx` → `createTournamentDoc()`):**

1. `generateHostKey()` produces a 16-character key in the format `XXXX-XXXX-XXXX-XXXX` using a URL-safe alphabet (no ambiguous characters).
2. The key is stored in the `TournamentConfig` doc as `hostKey` in Firestore.
3. `localStorage.setItem('wfc-host-key::{tId}', key)` is written on the creating device immediately after the Firestore write succeeds.
4. The key is displayed on the creation success screen with a "Screenshot this now" prompt.

**`isHost` check (`tournamentContext.tsx`):**

```typescript
const isHost = (() => {
  if (!activeId || !tournament) return false;
  try {
    return localStorage.getItem(hostKeyKey(activeId)) === tournament.hostKey;
  } catch {
    return false;
  }
})();
```

There is no bearer token, cookie, or server session. Host status is purely a localStorage equality check against the live Firestore value.

**Recovery on a new device (`JoinTournament.tsx`):**

1. User enters the join code and reaches the `'choose'` step.
2. At the bottom of the options, a dim text link reads "I'm the host on a new device".
3. Tapping it expands a "Host Recovery" card with a monospace key input and "Claim Access" button.
4. On submit, `claimAndEnterAsHost()` runs:
   ```typescript
   const claimAndEnterAsHost = (t: TournamentConfig) => {
     const key = hostKeyInput.trim();
     if (!key) { setHostKeyError('Enter the recovery key.'); return; }
     if (key !== t.hostKey) { setHostKeyError('That key doesn't match.'); return; }
     localStorage.setItem(hostKeyKey(t.id), key);
     enterAsPlayer(t.id);
     setLocation('/home');
   };
   ```
   The key is validated **client-side** against `t.hostKey` (which was fetched from Firestore during the join code lookup). On success, it is written to localStorage and the device becomes the host.

**Key rotation (`Admin.tsx` → `handleRotateHostKey()`):**

1. New key generated with `generateHostKey()`.
2. Written to Firestore via `setDoc(tournamentDoc, { hostKey: newKey }, { merge: true })`.
3. Written to the current device's localStorage.
4. All other devices' `isHost` checks immediately return `false` (their cached key no longer matches the Firestore value).

---

## 5. ROUTING ARCHITECTURE

All routes are defined in `App.tsx` using `wouter`. The router is mounted with `base={import.meta.env.BASE_URL}` for subdirectory-aware path-based proxying.

### Route Table

| Path | Component | Guard | Notes |
|---|---|---|---|
| `/` | `Landing` | None | Entry point. Shows Create / Join / Spectate. If `activeId` is set, shows a "Continue" card. |
| `/create` | `CreateTournament` | None | Multi-step form: basic info → course setup → rules builder → confirmation. Requires Firebase. |
| `/join` | `JoinTournament` | None | Code entry → choose (Register / Rejoin / Spectate / Host recovery). |
| `/join/:code` | `JoinTournament` | None | Deep link — auto-resolves the code. |
| `/join/:code/:teamCode` | `JoinTournament` | None | Deep link — auto-resolves + auto-rejoins matching team. |
| `/watch/:code` | `JoinTournament` | None | Deep link — auto-resolves + enters spectator mode. |
| `/home` | `Home` | `activeId` required; `blockOnFinal` (non-host → `/results`) | Team registration form + team card + admin link. |
| `/hole` | `HoleView` | `activeId` required; `blockOnFinal`; spectators → `/leaderboard` | Per-hole score entry with +/- steppers. Primary scoring view. |
| `/scorecard` | `Scorecard` | `activeId` required; `blockOnFinal`; spectators → `/leaderboard` | Full 18-hole scorecard grid. |
| `/leaderboard` | `Leaderboard` | `activeId` required; spectators allowed | Real-time standings + live event feed. |
| `/results` | `Results` | `activeId` required; spectators allowed | Read-only final results screen (shown to non-hosts when `status === 'final'`). |
| `/rules` | `Rules` | `activeId` required; spectators allowed | Swipeable per-hole rule deck carousel. |
| `/stats` | `Stats` | `activeId` required; spectators allowed | Score stats and longest drive tracker. |
| `/admin` | `Admin` | `activeId` required; spectators allowed | Password-gated admin panel. |
| `*` | `NotFound` | None | 404 catch-all. |

### Route Guard Logic (`App.tsx`)

```typescript
function Guard({ children, allowSpectator = false, blockOnFinal = false }) {
  const { activeId, isSpectator, isHost, tournament } = useTournament();

  if (!activeId) return <Redirect to="/" />;

  // Non-host players redirected to read-only results when tournament is finalized.
  if (blockOnFinal && tournament?.status === 'final' && !isHost)
    return <Redirect to="/results" />;

  // Spectators blocked from scoring routes; sent to leaderboard.
  if (isSpectator && !allowSpectator)
    return <Redirect to="/leaderboard" />;

  return <>{children}</>;
}
```

### Bottom Navigation (`BottomNav.tsx`)

Visible on all guarded routes. Tab destinations: **Home** (`/home`), **Hole** (`/hole`), **Leaderboard** (`/leaderboard`), **Rules** (`/rules`). The nav itself does not enforce guard logic — the destination routes do.

---

## KNOWN GAPS (AUDIT FINDINGS)

| Severity | Issue |
|---|---|
| **High** | No server-side Firestore Security Rules enforced by this codebase. Client-side lock logic (`hasSubmitted`, `status === 'final'`) can be bypassed with dev tools. |
| **High** | No duplicate team name validation. Two teams can register identical names; both appear on the leaderboard and admin panel. |
| **Medium** | `isHost` is a client-side localStorage equality check with no server-side session. Anyone who obtains the `hostKey` value (e.g. from the creation screenshot) gains permanent host access on any device. |
| **Medium** | The rejoin team list (`step === 'rejoin'`) is fetched once with `getDocs` — no live listener. Late registrations do not appear without backing out and re-entering. |
| **Medium** | Admin `adminCode` authentication is local state only (`auth` boolean in React). Refreshing the page requires re-entering the code. No server-side enforcement. |
| **Low** | `mid` yardage field exists on `CourseHole` interface and is stored in Firestore but is no longer surfaced in the course setup UI (only Tips and Womns are editable). Pre-existing data with `mid` values is preserved. |
| **Low** | The WFC 2026 host key is a hardcoded constant (`WFC2-026H-OST0-KEY9`) exported from `lib/tournament.ts`. It is visible in the compiled JavaScript bundle. |
