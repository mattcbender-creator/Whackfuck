# WFC – Whack Fuck Cup

Live golf tournament scoring PWA for the Whack Fuck Cup at Dundee Country Club (1801 Queen St N, New Dundee, ON N0B 2E0, Canada).

## Run & Operate

- `pnpm --filter @workspace/wfc-app run dev` — run the WFC PWA (reads PORT env var)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 18 + Vite + Tailwind CSS + shadcn/ui
- Routing: wouter
- Maps: Leaflet.js + react-leaflet
- Real-time: Firebase Firestore (optional — app works offline without it)
- PWA: vite-plugin-pwa (installable, offline-first)
- Scoring: canvas-confetti for eagle/birdie celebrations

## Where things live

- `artifacts/wfc-app/src/lib/holes.ts` — All 18 holes: yardages, pars, and rules (source of truth)
- `artifacts/wfc-app/src/lib/firebase.ts` — Firebase initialization (gracefully disabled without env vars)
- `artifacts/wfc-app/src/lib/store.tsx` — Global state: team info, scores, current tee (localStorage)
- `artifacts/wfc-app/src/lib/confetti.ts` — Eagle/birdie confetti helpers
- `artifacts/wfc-app/src/pages/` — All 7 pages
- `artifacts/wfc-app/src/components/LeafletMap.tsx` — GPS course map (lazy-loaded)

## Pages

- `/` — Home: animated logo + tournament setup
- `/scorecard` — Live 18-hole scorecard with +/- steppers + rule sheets
- `/leaderboard` — Real-time Firebase leaderboard + groups on course
- `/map` — Leaflet GPS course map (lat: 43.35146, lng: -80.52140)
- `/rules` — Swipeable rule deck carousel for all 18 holes
- `/stats` — Score stats, longest drive tracker
- `/admin` — Password-gated admin panel (password: "dundee2025")

## Tee Auto-Rule

- Net score -5 or better → **Tips tees** (longest yardage)
- Everyone else → **Women's tees** (shortest yardage)
- Updates automatically as scores are entered

## Firebase Setup (optional — for real-time leaderboard)

1. Go to https://console.firebase.google.com and create a project
2. Enable **Firestore Database** (start in test mode)
3. Enable **Authentication** (optional, for admin security)
4. Go to Project Settings → Your apps → Add web app
5. Copy the config values and set these env vars:

```
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

6. Restart the workflow after adding env vars
7. Firestore collections used:
   - `teams` — team scores and progress
   - `events` — live feed (birdies, eagles, lead changes)
   - `longestDrives` — drive contest tracking

## Without Firebase

The app works fully offline using localStorage. All scoring, rules, and the map work without any Firebase config. The leaderboard will show local team data only.

## Architecture decisions

- Firebase config is optional — all VITE_FIREBASE_* vars checked at startup; if missing, app silently falls back to localStorage-only mode
- Leaflet map is lazy-loaded (React.lazy + Suspense) to avoid SSR/bundle issues
- Tee assignment is computed reactively from net score in the store; every component reads currentTee from context
- All 18 holes hard-coded in a single const array in holes.ts — no database needed for course data
- vite-plugin-pwa enables service worker + installability — users can add to home screen on iOS/Android

## Product

Live golf tournament scoring for WFC at Dundee CC. Teams register, enter scores hole-by-hole, check per-hole rules, track their position on the live leaderboard, navigate the course via GPS map, and see the rule deck. Admin panel allows tournament broadcast messages and resets. Confetti fires on eagles/birdies.

## User preferences

- Dark neon theme: black backgrounds, electric lime-green (#39FF14) accents, Barlow Condensed font for headings
- No emojis — use Lucide icons only
- Score steppers (not text inputs) for hole-by-hole entry

## Gotchas

- Always restart the workflow after changing env vars (VITE_* vars are baked in at build time)
- Leaflet's default marker icons need a fix — handled in LeafletMap.tsx by overriding L.Icon.Default
- Google Fonts @import must be the VERY FIRST line in index.css before any other @import
