# WFC – Whack Fuck Cup

Live golf tournament scoring PWA for the Whack Fuck Cup at Dundee Country Club.

---

## 🔥 ONE-TIME FIREBASE SETUP (Takes 3 minutes)

Do this **once** so every phone sees the same live leaderboard. Without it the app still works, but each phone only sees its own scores.

### Step 1 — Create the Firebase project
1. Open **https://firebase.google.com** and click **Get started** / **Go to console** (sign in with any Google account).
2. Click **Add project**.
3. Name it exactly: `wfc-golf` → **Continue**.
4. **Disable** Google Analytics (you don't need it) → **Create project**.
5. Wait ~20 seconds → **Continue**.

### Step 2 — Register the web app
1. On the project dashboard, click the **`</>`** (web) icon.
2. App nickname: `WFC` → **Register app**.
3. Firebase will show you a `firebaseConfig` object that looks like this:

   ```js
   const firebaseConfig = {
     apiKey: "AIzaSyABCDEF...",
     authDomain: "wfc-golf.firebaseapp.com",
     projectId: "wfc-golf",
     storageBucket: "wfc-golf.appspot.com",
     messagingSenderId: "1234567890",
     appId: "1:1234567890:web:abcdef123456"
   };
   ```

4. **Keep this tab open** — you'll paste these 6 values into Replit in Step 4.
5. Click **Continue to console**.

### Step 3 — Turn on Firestore
1. Left sidebar → **Build → Firestore Database**.
2. Click **Create database**.
3. Choose **Start in test mode** → **Next**.
4. Pick the location closest to Dundee, ON (e.g. `nam5 (us-central)`) → **Enable**.

### Step 4 — Paste the 6 keys into Replit Secrets
In your Replit workspace, open the **Secrets** tab (lock icon in the left sidebar) and add these 6 secrets, copying the values from the `firebaseConfig` object in Step 2:

| Secret name | Value from firebaseConfig |
|---|---|
| `VITE_FIREBASE_API_KEY` | `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `VITE_FIREBASE_PROJECT_ID` | `projectId` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `storageBucket` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
| `VITE_FIREBASE_APP_ID` | `appId` |

### Step 5 — Restart the app
The dev workflow auto-restarts when secrets change. If not, click **Stop** then **Run** on the `artifacts/wfc-app: web` workflow. On a deployed app, click **Publish** again to bake the new env vars into the build.

✅ The yellow "Turn on live sync" banner on the **Live** screen will disappear, the green **LIVE** dot will start pulsing, and every phone with the URL will see the same leaderboard in real time.

> If you ever lose these values, you can find them again in **Firebase Console → Project settings (gear icon) → Your apps → SDK setup**.

---

## 🛠 Admin Reset (wipe the tournament)

On the **Live** leaderboard screen, tap the small **⚙ gear icon** in the bottom-right corner.

- Password: **`wfcreset2026`**
- This deletes everything in the Firestore collections `teams`, `scores`, `liveFeed`, `events`, and `longestDrives`.
- Confetti fires, then every connected device auto-refreshes within ~2.5 seconds.

### Change the admin reset password
Edit one constant:

- File: `artifacts/wfc-app/src/pages/Leaderboard.tsx`
- Look for: `const ADMIN_RESET_PASSWORD = 'wfcreset2026';`
- Change the string, save, then re-publish.

The legacy `/admin` page (broadcasts, separate password `dundee2025`) still works for sending tournament messages and is unrelated to the reset.

---

## Run locally

```bash
pnpm --filter @workspace/wfc-app run dev
```

The workflow `artifacts/wfc-app: web` already runs this for you.

## Stack

- React 18 + Vite + Tailwind + shadcn/ui
- Firebase Firestore (live sync) + localStorage (offline fallback)
- vite-plugin-pwa (installable)
- Leaflet (course map)
- canvas-confetti (eagles / birdies / admin reset)

## Without Firebase

The app still runs fully offline using `localStorage`. Scores, rules, map, and stats all work — only the cross-device leaderboard is disabled.
