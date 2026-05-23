import PDFDocument from 'pdfkit';
import { createWriteStream, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const LIME = '#39FF14';
const BLACK = '#000000';
const DARK = '#111111';
const GREY = '#555555';
const LIGHT_GREY = '#DDDDDD';

const OUT = resolve(process.cwd(), '../attached_assets/wfc-owner-guide.pdf');
mkdirSync(dirname(OUT), { recursive: true });

const doc = new PDFDocument({
  size: 'LETTER',
  margins: { top: 64, bottom: 64, left: 64, right: 64 },
  info: {
    Title: 'WFC – Whack Fuck Cup · Owner Handover Guide',
    Author: 'WFC',
    Subject: 'Tournament app handover documentation',
  },
});
doc.pipe(createWriteStream(OUT));

const PAGE_W = doc.page.width;
const PAGE_H = doc.page.height;
const M = 64;
const CONTENT_W = PAGE_W - M * 2;

// ── Helpers ────────────────────────────────────────────────────────────────
function condensed(size: number, weight: 'bold' | 'reg' = 'bold') {
  doc.font(weight === 'bold' ? 'Helvetica-Bold' : 'Helvetica').fontSize(size);
}
function body(size = 10.5) {
  doc.font('Helvetica').fontSize(size).fillColor(DARK);
}
function rule(color = LIGHT_GREY, y?: number) {
  const yy = y ?? doc.y;
  doc.save().strokeColor(color).lineWidth(0.6).moveTo(M, yy).lineTo(PAGE_W - M, yy).stroke().restore();
}
function ensure(space: number) {
  if (doc.y + space > PAGE_H - M) doc.addPage();
}
function h1(text: string) {
  ensure(60);
  doc.fillColor(BLACK).font('Helvetica-Bold').fontSize(26).text(text.toUpperCase(), { characterSpacing: 1 });
  doc.moveDown(0.2);
  doc.save().fillColor(LIME).rect(M, doc.y, 56, 4).fill().restore();
  doc.moveDown(1);
  body();
}
function h2(text: string) {
  ensure(40);
  doc.moveDown(0.6);
  doc.fillColor(BLACK).font('Helvetica-Bold').fontSize(15).text(text.toUpperCase(), { characterSpacing: 0.5 });
  doc.moveDown(0.4);
  body();
}
function h3(text: string) {
  ensure(28);
  doc.moveDown(0.4);
  doc.fillColor(BLACK).font('Helvetica-Bold').fontSize(11.5).text(text.toUpperCase(), { characterSpacing: 0.5 });
  doc.moveDown(0.2);
  body();
}
function p(text: string, opts: PDFKit.Mixins.TextOptions = {}) {
  body();
  doc.fillColor(DARK).text(text, { lineGap: 2, ...opts });
  doc.moveDown(0.4);
}
function bullets(items: string[]) {
  body();
  doc.fillColor(DARK);
  for (const it of items) {
    ensure(14);
    const x = doc.x;
    const y = doc.y;
    doc.save().fillColor(LIME).circle(x + 3, y + 6, 1.8).fill().restore();
    doc.text(it, x + 12, y, { width: CONTENT_W - 12, lineGap: 2 });
    doc.x = x;
    doc.moveDown(0.15);
  }
  doc.moveDown(0.3);
}
function kvTable(rows: [string, string][], keyW = 150) {
  body();
  for (const [k, v] of rows) {
    ensure(18);
    const y = doc.y;
    doc.font('Helvetica-Bold').fillColor(BLACK).text(k, M, y, { width: keyW, continued: false });
    doc.font('Helvetica').fillColor(DARK).text(v, M + keyW, y, { width: CONTENT_W - keyW });
    doc.moveDown(0.15);
  }
  doc.moveDown(0.3);
}
function callout(title: string, text: string) {
  ensure(60);
  const startY = doc.y;
  const padX = 12, padY = 10;
  // Measure
  body();
  const titleH = 14;
  doc.font('Helvetica').fontSize(10);
  const bodyH = doc.heightOfString(text, { width: CONTENT_W - padX * 2 - 6 });
  const boxH = titleH + bodyH + padY * 2 + 4;
  doc.save().fillColor('#F4FFF0').rect(M, startY, CONTENT_W, boxH).fill().restore();
  doc.save().fillColor(LIME).rect(M, startY, 4, boxH).fill().restore();
  doc.font('Helvetica-Bold').fontSize(10).fillColor(BLACK)
    .text(title.toUpperCase(), M + padX + 6, startY + padY, { characterSpacing: 0.8 });
  doc.font('Helvetica').fontSize(10).fillColor(DARK)
    .text(text, M + padX + 6, startY + padY + titleH, { width: CONTENT_W - padX * 2 - 6, lineGap: 2 });
  doc.y = startY + boxH + 8;
  body();
}

// Cover page
function cover() {
  doc.save().fillColor(BLACK).rect(0, 0, PAGE_W, PAGE_H).fill().restore();
  // Lime accent bar
  doc.save().fillColor(LIME).rect(0, 120, 120, 8).fill().restore();
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(64)
    .text('WFC', M, 160, { characterSpacing: 2 });
  doc.fillColor(LIME).font('Helvetica-Bold').fontSize(28)
    .text('WHACK FUCK CUP', M, 240, { characterSpacing: 4 });
  doc.fillColor('#FFFFFF').font('Helvetica').fontSize(14)
    .text('OWNER HANDOVER GUIDE', M, 280, { characterSpacing: 3 });

  doc.save().strokeColor(LIME).lineWidth(0.6).moveTo(M, 330).lineTo(PAGE_W - M, 330).stroke().restore();

  doc.fillColor('#CCCCCC').font('Helvetica').fontSize(11)
    .text('Live tournament scoring PWA for the Whack Fuck Cup', M, 350, { width: CONTENT_W })
    .text('Dundee Country Club  ·  1801 Queen St N, New Dundee, ON N0B 2E0', M, 370);

  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(11)
    .text('WHAT\'S INSIDE', M, PAGE_H - 250, { characterSpacing: 2 });
  doc.fillColor('#AAAAAA').font('Helvetica').fontSize(10);
  const toc = [
    '01  Overview & tournament-day quick start',
    '02  Every page — Home, Scorecard, Leaderboard, Map, Rules, Stats, Admin',
    '03  Scoring & the tee auto-rule',
    '04  The wheel + all 8 Mario Kart items',
    '05  All 18 hole rules (course reference)',
    '06  Admin panel walkthrough',
    '07  Troubleshooting',
    '08  Optional Firebase setup',
    '09  Deployment',
    '10  One-page tournament-day checklist',
  ];
  let yy = PAGE_H - 230;
  for (const t of toc) {
    doc.text(t, M, yy);
    yy += 14;
  }

  doc.fillColor(LIME).font('Helvetica-Bold').fontSize(9)
    .text('PRINT-FRIENDLY  ·  BLACK ON WHITE INTERIOR  ·  BARLOW CONDENSED HEADINGS IN-APP',
      M, PAGE_H - 60, { width: CONTENT_W, characterSpacing: 1.5 });
  doc.addPage();
  body();
}

// ── Build pages ────────────────────────────────────────────────────────────
cover();

// 01 Overview
h1('01 · Overview');
p('WFC (Whack Fuck Cup) is a mobile-first Progressive Web App built for live tournament scoring at Dundee Country Club. Teams register on their phone, enter scores hole-by-hole, watch the live leaderboard, follow the rule deck, navigate the course on a GPS map, and spin the wheel at the turn for a chaos modifier on the back nine.');
p('The app is installable to the home screen on iOS and Android, works offline against localStorage, and (when Firebase env vars are set) syncs every device to a shared real-time leaderboard.');

h2('Stack at a glance');
kvTable([
  ['Frontend', 'React 18 + Vite + TypeScript + Tailwind + shadcn/ui'],
  ['Routing', 'wouter (file-style page routes)'],
  ['Maps', 'Leaflet.js + react-leaflet (lazy-loaded)'],
  ['Real-time', 'Firebase Firestore (optional — app works offline without it)'],
  ['PWA', 'vite-plugin-pwa — installable, offline-first'],
  ['Effects', 'canvas-confetti on eagles and birdies'],
  ['Monorepo', 'pnpm workspaces, Node 24'],
]);

h2('Course details');
kvTable([
  ['Venue', 'Dundee Country Club'],
  ['Address', '1801 Queen St N, New Dundee, ON N0B 2E0, Canada'],
  ['GPS', '43.35146, -80.52140'],
  ['Layout', 'Par 72 · 18 holes (front 9 + back 9)'],
  ['Tee blocks used', 'Tips (longest) and Women\'s (shortest)'],
]);

h2('Tournament-day quick start');
bullets([
  'Open the app on every team captain\'s phone (one device per team is enough).',
  'On the Home screen, each team taps Get Started, enters their team name and both player names.',
  'Captains use the Scorecard page to enter each hole\'s strokes with the +/- steppers — no typing.',
  'After confirming the front 9 (hole 9 score saved), every team spins the wheel ONCE for a chaos modifier on the back nine.',
  'Leaderboard updates live across all devices (if Firebase env vars are configured). Without Firebase, each phone shows only its own team.',
  'After hole 18, the round auto-submits to the leaderboard. Use the Admin panel to broadcast announcements, edit a team, or apply manual adjustments.',
]);

// 02 Pages
h1('02 · Every Page');

h3('/  Home');
p('Animated WFC logo on a black neon background. The team setup card collects the team name and both players, then unlocks the full app. Returning users see their saved team and a "Continue" action. All registration is stored in localStorage on the device.');

h3('/scorecard  Scorecard');
p('Live 18-hole scorecard. Each hole has a +/- stepper so captains can tap to add strokes — no keyboard required. The header shows raw score, net score (vs par), holes played, and the team\'s currently assigned tee block. After the 9th score is entered, a Confirm Front 9 button appears; confirming locks the front 9 and triggers the wheel modal on the next visit.');
p('Eagles and birdies fire confetti instantly. The current hole highlights, and per-hole rule sheets are tappable inline so players never need to leave the scorecard during play.');

h3('/leaderboard  Leaderboard');
p('Sticky header shows a green "LIVE" pulse when Firebase sync is active, or a muted "OFFLINE" dot when running in localStorage-only mode. Below the header you get an optional broadcast banner (sent from Admin) and an auto-cycling live ticker of recent birdies, eagles, finishes, and wheel hits.');
p('The table lists every team sorted by net score: position (crown for #1), team name + players, "Thru" (holes completed, or F for finished), and net score. Position changes since the last update show as ▲/▼ arrows. Tap any row to expand a full mini-scorecard (all 18 holes color-coded: yellow = eagle, lime = birdie, white = par, orange = bogey, red = double+).');
p('If a team has spun the wheel, a coloured badge appears under their name. If they\'ve been hit by another team\'s item, "Hit by [Item]" badges aggregate and show under their row.');

h3('Course Map  (via in-app Leaflet component)');
p('A GPS-anchored Leaflet map of Dundee Country Club, lazy-loaded so it never blocks the rest of the app. Centered on the clubhouse coordinates above. Leaflet\'s default marker icons are explicitly overridden in components/LeafletMap.tsx so they render correctly under the Vite bundler.');

h3('/rules  Rule Deck');
p('A swipeable horizontal carousel (Embla). Three intro cards explain (1) how tee assignment works, (2) item-box rules, and (3) the 8 wheel items at a glance. Then one card per hole shows the hole number, par, yardages (tips/women\'s), the rule name, and the full rule text. Designed for table-top reference between holes.');

h3('/stats  Tournament Stats');
p('Score distribution bar chart (Recharts) — eagles, birdies, pars, bogeys, double+ — for the current team\'s round. Below it, the three official contests are listed: Hole 2 (Free Throw / Longest Drive), Hole 8 (Long Drive Contest), Hole 12 (Longest Drive Official). The current leader for each is shown.');

h3('/admin  Admin Panel');
p('Password-gated control room for whoever is running the tournament. Covers broadcasting messages, editing or deleting teams, applying manual stroke adjustments, seeding demo teams to practice with, and running a live simulation to demo the leaderboard for spectators. Full walk-through in Section 06.');

// 03 Scoring & tees
h1('03 · Scoring & the Tee Auto-Rule');

h2('Net score');
p('Net score is computed as (strokes scored) − (par for the same holes) + (wheel adjustment). So a team that has played 5 holes worth 18 par in 19 strokes with a +1 wheel hit is at +2 net. Negative net = under par.');

h2('Tee assignment (auto)');
p('The tee block is recomputed reactively from the current net score every time a stroke is entered:');
kvTable([
  ['Net under par  (rawNet < 0)', 'Tips tees — longest yardage'],
  ['Net at par or over  (rawNet ≥ 0)', 'Women\'s tees — shortest yardage'],
]);
callout('Important', 'Wheel adjustments affect net score only — they NEVER move your tee block. The tee rule is based on the raw scorecard versus par. Make sure players understand this on day one so they don\'t expect a wheel hit to bump them back to the tips.');

h2('Front-9 lock and back-9 lock');
bullets([
  'After hole 9 is scored, the captain must tap "Confirm Front 9" before the back 9 unlocks. This freezes the front-9 total and queues the wheel spin.',
  'Back-9 scoring is gated on a completed wheel spin. The Admin audit flags any team that scored the back 9 without spinning — this should never happen and indicates a bypassed lock.',
]);

// 04 Wheel
h1('04 · The Wheel & All 8 Items');
p('At the turn (after the front-9 confirm), the WheelModal opens automatically. Each team spins ONCE per round. The wheel lands on one of 8 Mario Kart-themed items. Some items hit the spinner only, some target a random other team, some let you pick a victim, and one targets the overall leader.');

const WHEEL = [
  { name: 'Green Shell',  color: '#2ecc40', flavor: 'Random attack',    desc: '+1 stroke to a random team (any team in the tournament).' },
  { name: 'Red Shell',    color: '#e63946', flavor: 'Targeted attack',  desc: 'Pick any team → +1 stroke. The picker UI hides scores so you choose a rival, not a rank.' },
  { name: 'Blue Shell',   color: '#2a9df4', flavor: 'Auto leader',      desc: '+1 stroke to the current 1st-place leader (hits you if you are leading).' },
  { name: 'Banana',       color: '#f4d35e', flavor: 'Slipped!',         desc: '+1 stroke to a random other team on the course.' },
  { name: 'Lightning',    color: '#3aa1ff', flavor: 'Strikes everyone', desc: '+1 stroke to every other team.' },
  { name: 'Mushroom',     color: '#ff7043', flavor: 'Boost',            desc: '−1 stroke to your own back-9 total.' },
  { name: 'Super Star',   color: '#ffd700', flavor: 'Invincible!',      desc: '−2 strokes to your own back-9 total.' },
  { name: 'Boo',          color: '#a05ec6', flavor: 'Steal',            desc: 'Steal 1 stroke from a random other team — their score +1, yours −1.' },
];

body();
for (const w of WHEEL) {
  ensure(50);
  const y0 = doc.y;
  // colored chip
  doc.save().fillColor(w.color).rect(M, y0, 6, 36).fill().restore();
  doc.font('Helvetica-Bold').fontSize(12).fillColor(BLACK)
    .text(w.name.toUpperCase(), M + 14, y0, { width: 180, characterSpacing: 1 });
  doc.font('Helvetica-Oblique').fontSize(9).fillColor(GREY)
    .text(w.flavor, M + 14, y0 + 14, { width: 180 });
  doc.font('Helvetica').fontSize(10).fillColor(DARK)
    .text(w.desc, M + 200, y0 + 2, { width: CONTENT_W - 200, lineGap: 2 });
  doc.y = y0 + 42;
  rule('#EEEEEE', doc.y - 4);
}
doc.moveDown(0.4);
callout('Wheel rules of thumb', 'One spin per team per round. Items modify NET score only — they never move tee assignment. Random targets are blind (no "behind you" bias). When a team is hit, a "Hit by [Item]" badge appears on their leaderboard row so everyone can see the chaos in real time.');

// 05 Hole rules
h1('05 · All 18 Hole Rules');
p('The source of truth lives in artifacts/wfc-app/src/lib/holes.ts. Edit there to change anything below — the rule deck, scorecard, and stats all read from this one file.');

const HOLES = [
  { hole: 1,  par: 4, tips: 313, womens: 275, ruleName: "Green Is The Hole", rule: "Skip the fairway — if your ball lands and stays on the green from your tee shot, the hole is complete. Wagers welcome. Confidence mandatory." },
  { hole: 2,  par: 5, tips: 493, womens: 405, ruleName: "Free Throw / Longest Drive", rule: "Longest drive in the fairway wins a free throw (mulligan) usable on any future hole. Side bet: closest to 200 yds can revoke someone else's tee mulligan. Use it wisely." },
  { hole: 3,  par: 3, tips: 186, womens: 148, ruleName: "One Club Only", rule: "Pick ONE club off the tee. That's your club for the ENTIRE hole — approach, chip, and putt. The guy who picks driver for a par 3 deserves everything that comes next." },
  { hole: 4,  par: 4, tips: 287, womens: 240, ruleName: "Worst Ball", rule: "Both players hit tee shots. The team plays from the WORST ball. The suffering is shared. The blame is entirely individual." },
  { hole: 5,  par: 3, tips: 140, womens: 112, ruleName: "Scramble", rule: "Full scramble this hole. Both hit, pick the best, both hit again from there. The catch: you still count every stroke. No mercy in the WFC rulebook." },
  { hole: 6,  par: 5, tips: 510, womens: 428, ruleName: "Putt With Your Driver", rule: "On the green, you putt using ONLY your driver. Sideways, backwards, whatever — the big stick only. This hole has ended 14 documented friendships since 2019." },
  { hole: 7,  par: 4, tips: 435, womens: 362, ruleName: "Captain's Choice", rule: "After tee shots, the captain picks which ball to play for the approach. The captain then MUST hit the second shot. Power. Accountability. Regret." },
  { hole: 8,  par: 5, tips: 475, womens: 395, ruleName: "Long Drive Contest", rule: "Longest drive in the fairway wins a 2-stroke reduction on final score. Out of bounds still counts — land it in the short grass or go home." },
  { hole: 9,  par: 3, tips: 167, womens: 132, ruleName: "Par Means Free Beer", rule: "Make par and the bar covers one round. Birdie? The whole group drinks on your tab — complimentary. Bogey? You watch everyone else drink while you reflect." },
  { hole: 10, par: 4, tips: 370, womens: 308, ruleName: "Sniper Hole", rule: "Hit a tree = 2 penalty strokes. Hit TWO trees = you carry someone's bag for the next hole. Historical tree-hit rate: 40%. Stay humble." },
  { hole: 11, par: 3, tips: 162, womens: 128, ruleName: "Closest To The Pin", rule: "Closest tee shot to the pin cancels that team's worst hole score from their card. Accuracy rewarded. Bragging rights eternal." },
  { hole: 12, par: 5, tips: 540, womens: 450, ruleName: "Longest Drive Official", rule: "Official longest drive measurement this hole. A volunteer marks it. A photo is taken. It is referenced at every subsequent WFC event until someone beats it." },
  { hole: 13, par: 4, tips: 380, womens: 318, ruleName: "Alternate Shot", rule: "Players alternate every shot for the entire hole. Team decides who tees off. Back and forth from there. Communication is key. Mutual destruction is likely." },
  { hole: 14, par: 5, tips: 490, womens: 412, ruleName: "One Bounce Counts", rule: "Your tee shot must bounce at least once before reaching the green or it doesn't count. Spin it back into the water? Classic. Grip it and skip it." },
  { hole: 15, par: 3, tips: 195, womens: 155, ruleName: "Sandbagging Penalty", rule: "Any team whose handicap is disputed by two or more other groups gets a 1-stroke penalty. Democracy rules. Cheaters pay. The WFC is watching." },
  { hole: 16, par: 4, tips: 385, womens: 322, ruleName: "Free Throw Fairway", rule: "Each player gets ONE free throw this hole — literally throw the ball with your hand toward the green. Distance is real. Use it at the right moment. Fully legal under WFC rules." },
  { hole: 17, par: 3, tips: 148, womens: 112, ruleName: "Island Green Penalty", rule: "Miss the green entirely = 2-stroke penalty + mandatory replay. It's a par 3. The green is RIGHT THERE. No excuse. Pay the toll. Walk of shame included." },
  { hole: 18, par: 5, tips: 495, womens: 415, ruleName: "Victory Lap", rule: "Final hole. Last year's losing team buys a round regardless of today's result. Today's winning team names the hardest rule for WFC next year. Make it legendary." },
];

for (const h of HOLES) {
  ensure(70);
  const y0 = doc.y;
  // hole number block
  doc.save().fillColor(BLACK).rect(M, y0, 48, 48).fill().restore();
  doc.fillColor(LIME).font('Helvetica-Bold').fontSize(20).text(String(h.hole), M, y0 + 14, { width: 48, align: 'center' });
  // title + meta
  doc.fillColor(BLACK).font('Helvetica-Bold').fontSize(13)
    .text(h.ruleName.toUpperCase(), M + 60, y0, { width: CONTENT_W - 60, characterSpacing: 0.5 });
  doc.fillColor(GREY).font('Helvetica').fontSize(9)
    .text(`PAR ${h.par}  ·  ${h.tips} yds (tips)  /  ${h.womens} yds (women's)`,
      M + 60, y0 + 16, { width: CONTENT_W - 60, characterSpacing: 1 });
  doc.fillColor(DARK).font('Helvetica').fontSize(10)
    .text(h.rule, M + 60, y0 + 30, { width: CONTENT_W - 60, lineGap: 2 });
  const finalY = doc.y;
  doc.y = Math.max(finalY, y0 + 50) + 6;
  rule('#EEEEEE', doc.y - 2);
}

// 06 Admin
h1('06 · Admin Panel');

h2('Access');
kvTable([
  ['Route', '/admin'],
  ['Password', 'wfc  (defined as ADMIN_PASSWORD in src/pages/Admin.tsx)'],
]);
callout('Change the password before tournament day', 'Open artifacts/wfc-app/src/pages/Admin.tsx and replace the value of ADMIN_PASSWORD. Any new value takes effect on the next build / page reload. The password is a simple shared secret — fine for an in-person event, not for anything sensitive.');

h2('What you can do from Admin');
bullets([
  'Send a Broadcast message: appears as a dismissible banner across every connected leaderboard.',
  'Seed demo teams: spin up 2–30 fake teams scattered across the course, each with random scores, wheel spins, and a recent burst of birdie/eagle events. Great for demoing the leaderboard before a real round starts.',
  'Run live simulation: every few seconds, one or two demo teams advance one hole. The leaderboard reshuffles in real time so the position-change arrows fire — perfect for a clubhouse TV demo.',
  'Manage teams: open the team list to edit names/players, delete a team, or apply a manual stroke adjustment (the adjustment is also recorded on the team\'s wheelAdjustment field so it shows up in audits).',
  'Score audit: flags suspicious rounds — submitted with fewer than 18 holes, edited after submitting, net ≤ −5, more than 4 under-par holes, eagle on a par 3, back 9 played without a wheel spin, front 9 never confirmed.',
]);

h2('Resetting between rounds');
bullets([
  'To wipe demo teams only: re-run the seed action (it deletes existing demo teams before re-seeding) or delete each demo team individually from the team list.',
  'To wipe everything (real teams included): in the Firebase console, delete the teams, events, and longestDrives collections. The app re-creates them on next write.',
  'On any device, players can clear their local team via the browser\'s "Clear site data" — there\'s no destructive button in the public UI by design.',
]);

// 07 Troubleshooting
h1('07 · Troubleshooting');

const T: [string, string][] = [
  ['Leaderboard shows "Offline" with a muted dot', 'Firebase env vars are missing or wrong. The app still works on localStorage. Confirm all six VITE_FIREBASE_* vars are set, then rebuild (VITE vars are baked in at build time — runtime changes don\'t apply).'],
  ['A team\'s back 9 won\'t unlock', 'They never confirmed the front 9 or never completed the wheel spin. Either have them tap Confirm Front 9 on the scorecard, or (admin) apply a manual edit in the team list.'],
  ['Wheel never appears at the turn', 'The auto-trigger fires after hole 9 score is saved AND the front-9 confirm button is tapped. If they skipped the confirm, send them back to the scorecard and tap it.'],
  ['Position arrows on the leaderboard look wrong', 'Arrows reflect movement since the most-recent snapshot only. If you seeded demo teams and immediately re-seeded, the first batch of arrows can appear stale until the next reshuffle. This self-corrects after one update.'],
  ['Map shows a blank tile or broken marker icon', 'Leaflet\'s default marker assets are overridden in components/LeafletMap.tsx. If you moved the component or removed that override, markers fall back to broken-image icons. Restore the L.Icon.Default code.'],
  ['Site won\'t install as a PWA on iPhone', 'iOS only installs from Safari\'s Share → Add to Home Screen menu (not Chrome). The site must be served over HTTPS — the deployed URL is fine, localhost preview is not.'],
  ['Demo teams won\'t seed', 'Firebase isn\'t configured. Seeding writes directly to Firestore. Set the VITE_FIREBASE_* env vars, rebuild, and try again.'],
  ['Confetti doesn\'t fire on a birdie', 'Check the browser console for canvas-confetti errors. Some aggressive privacy extensions block canvas. Retry in a clean browser profile.'],
];
for (const [q, a] of T) {
  ensure(36);
  doc.font('Helvetica-Bold').fontSize(10.5).fillColor(BLACK).text(q);
  doc.moveDown(0.1);
  doc.font('Helvetica').fontSize(10).fillColor(DARK).text(a, { lineGap: 2 });
  doc.moveDown(0.4);
}

// 08 Firebase setup
h1('08 · Optional Firebase Setup');
p('Skip this entire section if you only need single-device scoring. The app is fully functional in localStorage-only mode — every page works, scores save, the wheel spins, the map renders. The leaderboard simply shows only the local team and the "LIVE" indicator stays muted.');

h2('Why turn it on');
bullets([
  'Every team\'s phone sees every other team in real time.',
  'The admin broadcast banner and live ticker actually have data to display.',
  'You can run the score-audit panel against the whole field at once.',
  'Demo seeding and live simulation work for a clubhouse-TV demo.',
]);

h2('Setup steps (≈ 3 minutes)');
bullets([
  'Open https://console.firebase.google.com and create a new project.',
  'Enable Firestore Database — choose "Start in test mode" for the tournament weekend.',
  '(Optional) Enable Authentication if you want to lock down writes later.',
  'Project Settings → Your apps → Add web app. Copy the config object.',
  'Set the six VITE_FIREBASE_* env vars (see below) in the Replit Secrets pane.',
  'Restart the WFC workflow. Vite re-bakes the env vars at build time.',
]);

h3('Required env vars');
body();
const env = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
];
doc.font('Courier').fontSize(10).fillColor(DARK);
for (const e of env) { ensure(14); doc.text('  ' + e); }
body();
doc.moveDown(0.3);

h3('Firestore collections used');
kvTable([
  ['teams', 'One doc per team: scores array, netScore, holesPlayed, currentTee, wheelSpin, wheelAdjustment, targetedBy[]'],
  ['events', 'Append-only log of score events (birdie/eagle), finishes, wheel hits, and admin broadcasts'],
  ['longestDrives', 'Drive contest tracking for holes 2, 8, 12'],
]);

callout('Security note', 'Test-mode Firestore rules allow anyone with the URL to read and write. That\'s fine for a one-day event with a private link. Before re-using the same Firebase project, switch the rules to a more restrictive policy or recycle the project.');

// 09 Deployment
h1('09 · Deployment');
p('The app deploys directly from Replit. Use the Publish button at the top of the workspace — Replit handles the build, the HTTPS cert, the .replit.app subdomain (or your custom domain), and health checks.');

h2('Build commands');
kvTable([
  ['Dev (run via Replit workflow)', 'pnpm --filter @workspace/wfc-app run dev'],
  ['Full typecheck', 'pnpm run typecheck'],
  ['Full build', 'pnpm run build'],
]);

h2('Before you publish');
bullets([
  'Make sure all Firebase env vars are set if you want the live leaderboard in production. VITE_* vars are baked in at build time — a missing one silently disables Firebase in the deployed build.',
  'Change the admin password in src/pages/Admin.tsx.',
  'Open the deployed URL on a phone and add it to the home screen to confirm the PWA install works.',
  'Send a test broadcast and confirm it appears on a second device.',
]);

h2('After tournament day');
bullets([
  'Export anything you want to keep from Firestore (the events log doubles as a tournament highlight reel).',
  'Optionally turn the deployment off in Replit to stop billing — the code stays in the workspace.',
]);

// 10 Checklist (one page)
doc.addPage();
h1('10 · Tournament-Day Checklist');
p('Print this page. Tear it out. Stick it on the clubhouse wall.');

h3('The night before');
bullets([
  'Confirm Firebase env vars are set and the deployed URL loads on a fresh phone.',
  'Open /leaderboard on a laptop or TV in the clubhouse — confirm "LIVE" pulses green.',
  'Change the admin password from "wfc" to something only you know.',
  'Seed 8–12 demo teams from /admin and run the live simulation for 30 seconds to confirm the leaderboard reshuffles cleanly. Then wipe demo teams.',
  'Send a test broadcast ("Welcome to WFC!") and confirm it shows on every device.',
]);

h3('Tournament morning');
bullets([
  'Every team captain opens the deployed URL, taps Add to Home Screen, and registers their team on /.',
  'Walk the captains through the +/- steppers on /scorecard and the swipe gesture on /rules.',
  'Remind captains: confirm front 9 → spin the wheel ONCE → back 9 unlocks. No spin = no back 9.',
  'Position one device on a TV at the clubhouse on /leaderboard for spectators.',
]);

h3('During the round');
bullets([
  'Use /admin → Broadcast for course updates ("Hole 11 cart path only", weather, etc).',
  'Watch the audit panel — high-severity flags (submitted with <18 holes, back 9 without a wheel spin) deserve a phone call to that group.',
  'If a team disputes their net score, open the team list in admin, click Adjust, and apply the correction. The change is logged as a wheel adjustment so it\'s auditable later.'  ,
]);

h3('After hole 18');
bullets([
  'Confirm every team\'s "Thru" shows F on the leaderboard.',
  'Take a screenshot of the final leaderboard for the WFC archive.',
  'Read out the Hole 12 longest-drive winner and the Hole 11 closest-to-the-pin winner.',
  'Last year\'s losing team buys the round (Hole 18 rule). This year\'s winning team names next year\'s hardest rule. Make it legendary.',
]);

doc.moveDown(1);
rule(LIME);
doc.moveDown(0.4);
doc.font('Helvetica-Bold').fontSize(9).fillColor(BLACK).text('WFC · WHACK FUCK CUP', { characterSpacing: 2 });
doc.font('Helvetica').fontSize(8).fillColor(GREY).text('Dundee Country Club  ·  1801 Queen St N, New Dundee, ON N0B 2E0  ·  43.35146, -80.52140');

doc.end();
console.log(`Wrote ${OUT}`);
