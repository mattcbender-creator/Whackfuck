import PDFDocument from 'pdfkit';
import { createWriteStream, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const LIME = '#39FF14';
const BLACK = '#000000';
const DARK = '#111111';
const GREY = '#555555';
const LIGHT_GREY = '#DDDDDD';

const OUT = resolve(process.cwd(), '../attached_assets/wfc-product-brief.pdf');
mkdirSync(dirname(OUT), { recursive: true });

const doc = new PDFDocument({
  size: 'LETTER',
  margins: { top: 64, bottom: 64, left: 64, right: 64 },
  info: {
    Title: 'WFC — Product Brief & Monetization Analysis',
    Author: 'WFC',
    Subject: 'From private tournament to public party-golf product',
  },
});
doc.pipe(createWriteStream(OUT));

const PAGE_W = doc.page.width;
const PAGE_H = doc.page.height;
const M = 64;
const CONTENT_W = PAGE_W - M * 2;

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
  doc.fillColor(BLACK).font('Helvetica-Bold').fontSize(24).text(text.toUpperCase(), { characterSpacing: 1 });
  doc.moveDown(0.2);
  doc.save().fillColor(LIME).rect(M, doc.y, 56, 4).fill().restore();
  doc.moveDown(1);
  body();
}
function h2(text: string) {
  ensure(40);
  doc.moveDown(0.6);
  doc.fillColor(BLACK).font('Helvetica-Bold').fontSize(14).text(text.toUpperCase(), { characterSpacing: 0.5 });
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
function kvTable(rows: [string, string][], keyW = 170) {
  body();
  for (const [k, v] of rows) {
    ensure(18);
    const y = doc.y;
    doc.font('Helvetica-Bold').fillColor(BLACK).text(k, M, y, { width: keyW });
    doc.font('Helvetica').fillColor(DARK).text(v, M + keyW, y, { width: CONTENT_W - keyW });
    doc.moveDown(0.15);
  }
  doc.moveDown(0.3);
}
function callout(title: string, text: string) {
  ensure(60);
  const startY = doc.y;
  const padX = 12, padY = 10;
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

// ── COVER ──────────────────────────────────────────────────────────────────
function cover() {
  doc.save().fillColor(BLACK).rect(0, 0, PAGE_W, PAGE_H).fill().restore();
  doc.save().fillColor(LIME).rect(0, 120, 120, 8).fill().restore();
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(58)
    .text('WFC', M, 160, { characterSpacing: 2 });
  doc.fillColor(LIME).font('Helvetica-Bold').fontSize(22)
    .text('PRODUCT BRIEF', M, 234, { characterSpacing: 4 });
  doc.fillColor(LIME).font('Helvetica-Bold').fontSize(22)
    .text('& MONETIZATION ANALYSIS', M, 262, { characterSpacing: 4 });
  doc.fillColor('#FFFFFF').font('Helvetica').fontSize(13)
    .text('From private tournament to public party-golf product', M, 308, { characterSpacing: 1 });

  doc.save().strokeColor(LIME).lineWidth(0.6).moveTo(M, 348).lineTo(PAGE_W - M, 348).stroke().restore();

  doc.fillColor('#CCCCCC').font('Helvetica').fontSize(10)
    .text('A self-contained briefing — written for a strategy reader or AI copilot with', M, 370, { width: CONTENT_W })
    .text('zero prior context. Pair with the source files for the full picture.', M, 384, { width: CONTENT_W });

  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(11)
    .text('CONTENTS', M, PAGE_H - 280, { characterSpacing: 2 });
  doc.fillColor('#AAAAAA').font('Helvetica').fontSize(10);
  const toc = [
    '01  Executive summary',
    '02  What the product is today',
    '03  Market & opportunity',
    '04  Competitive landscape',
    '05  Monetization paths, ranked',
    '06  Revenue scenarios',
    '07  What would have to change to go public',
    '08  Risks',
    '09  90-day validation roadmap',
    '10  Bottom line',
    'A   Appendix · full hole-rule catalogue',
  ];
  let yy = PAGE_H - 260;
  for (const t of toc) { doc.text(t, M, yy); yy += 14; }

  doc.fillColor(LIME).font('Helvetica-Bold').fontSize(9)
    .text('STRATEGIC BRIEF  ·  PRINT-FRIENDLY  ·  COMPANION TO THE OWNER HANDOVER GUIDE',
      M, PAGE_H - 60, { width: CONTENT_W, characterSpacing: 1.5 });
  doc.addPage();
  body();
}

cover();

// ── 01 Executive summary ───────────────────────────────────────────────────
h1('01 · Executive Summary');
p('WFC ("Whack Fuck Cup") is a mobile-first Progressive Web App originally built for a single private golf tournament at Dundee Country Club in New Dundee, Ontario. It combines (1) a real, live-syncing scorecard, (2) 18 custom per-hole novelty rules ("putt with your driver," "worst ball," "alternate shot," etc.), and (3) a Mario Kart-style "item wheel" that every team spins at the turn for a chaos modifier on the back nine. Scores, leaderboard, ticker, broadcasts, and an admin panel all work in real time across every phone in the field.');
p('The opportunity: there are tens of millions of casual golfers worldwide, the on-course "fun golf" category is a real venture-funded trend (TopGolf, Puttery, PopStroke), and the dominant golf apps (18Birdies, GHIN, Golfshot) all optimise for serious scoring and handicaps. Nobody owns the "party / chaos golf format" software layer. WFC, reskinned and turned multi-tenant, is a credible answer to that gap.');
p('Realistic outcome with focused execution: $150K–500K ARR as a one-person business within 24 months is highly achievable. A real small business at $1–1.5M ARR requires full-time effort plus B2B (course partnerships and charity-tournament packages). A venture-scale outcome ($5M+ ARR or strategic acquisition) is a long shot but plausibly routes through the same B2B motion.');
callout('The single biggest unlock',
  'Not more wheel items — it is making the rules and items user-editable so the app becomes a platform any group, league, or course can mold to their crowd. That converts WFC from "fun for one tournament" into "the thing my foursome uses every Saturday."');

// ── 02 Product today ───────────────────────────────────────────────────────
h1('02 · What The Product Is Today');

h2('In plain language');
p('WFC turns an ordinary 18-hole round into a tournament-game-show hybrid. You and your group register your team on your phones, enter your strokes hole by hole with simple +/– buttons, follow a different silly rule on every hole, and at the halfway point you each spin a digital wheel that adds or subtracts strokes based on which "item" you land on. A shared leaderboard pulses live on every phone (and a TV in the clubhouse, if you want one).');
p('It is built for the use case of "8–30 friends paying for a tee time together and wanting more chaos than a normal round." Today it is hard-coded to Dundee CC and one tournament. Everything else — gameplay loop, scoring engine, wheel, leaderboard, admin tools — is general-purpose.');

h2('Gameplay loop');
bullets([
  'Register: each team captain opens the deployed URL on their phone, enters team name + both players, and the app saves them locally.',
  'Score hole-by-hole on the Scorecard page using +/– steppers — no keyboards. Eagles and birdies fire confetti.',
  'After hole 9 is scored, the captain taps "Confirm Front 9," which locks the front nine total.',
  'The Wheel modal then opens automatically. The team spins ONCE per round. The item that lands is applied to net score (their own −1 or −2, a random other team +1, a chosen team +1, the leader +1, or all other teams +1).',
  'Back nine unlocks. Scoring resumes. Confetti continues. The leaderboard reshuffles in real time and shows ▲/▼ position arrows for every change.',
  'After hole 18, the round auto-submits. The clubhouse leaderboard shows final standings. The admin can broadcast announcements throughout.',
]);

h2('The wheel — 8 items');
const WHEEL: [string, string, string][] = [
  ['Green Shell', 'Random attack',    '+1 stroke to a random team (any team in the tournament).'],
  ['Red Shell',   'Targeted attack',  'Pick any team → +1 stroke. The picker hides scores so you choose a rival, not a rank.'],
  ['Blue Shell',  'Auto leader',      '+1 stroke to the current 1st-place team (hits you if you are leading).'],
  ['Banana',      'Slipped!',         '+1 stroke to a random other team on the course.'],
  ['Lightning',   'Strikes everyone', '+1 stroke to every other team.'],
  ['Mushroom',    'Boost',            '−1 stroke off your own back-9 total.'],
  ['Super Star',  'Invincible!',      '−2 strokes off your own back-9 total.'],
  ['Boo',         'Steal',            'Steal 1 stroke from a random other team — their +1, your −1.'],
];
for (const [name, flavor, desc] of WHEEL) {
  ensure(28);
  const y0 = doc.y;
  doc.save().fillColor(LIME).rect(M, y0 + 1, 4, 22).fill().restore();
  doc.font('Helvetica-Bold').fontSize(10.5).fillColor(BLACK)
    .text(name.toUpperCase(), M + 12, y0, { width: 110, characterSpacing: 0.8, continued: false });
  doc.font('Helvetica-Oblique').fontSize(9).fillColor(GREY)
    .text(flavor, M + 12, y0 + 12, { width: 110 });
  doc.font('Helvetica').fontSize(10).fillColor(DARK)
    .text(desc, M + 130, y0 + 1, { width: CONTENT_W - 130, lineGap: 2 });
  doc.y = y0 + 28;
}
doc.moveDown(0.3);
p('Critical mechanic: wheel items modify NET score only. They never move tee assignment. That keeps the format rule (below) honest.');

h2('Tee auto-rule');
kvTable([
  ['Raw scorecard under par   (rawNet < 0)', 'Tips tees — the longest yardage. Punishes the leaders.'],
  ['Raw scorecard at par or over   (rawNet ≥ 0)', "Women's tees — the shortest yardage. Helps the field stay competitive."],
]);
p('Tee block is recomputed every time a stroke is entered. The whole field has to think about whether birdying the next hole is actually a good idea.');

h2('The 18 custom rules — one-liners');
p('Full text in the appendix. Summarised here so you can feel the tone:');
const RULES_SHORT = [
  ['1',  'Green Is The Hole — land on the green from the tee, the hole is done.'],
  ['2',  'Free Throw / Longest Drive — longest fairway drive earns a future mulligan.'],
  ['3',  'One Club Only — pick one club, use it for the entire hole.'],
  ['4',  'Worst Ball — both hit, team plays the worse ball.'],
  ['5',  'Scramble — best ball, but every stroke still counts.'],
  ['6',  'Putt With Your Driver — putt on the green using only the driver.'],
  ['7',  "Captain's Choice — captain picks the ball and must hit the next shot."],
  ['8',  'Long Drive Contest — winner gets a 2-stroke reduction.'],
  ['9',  'Par Means Free Beer — par = round on the bar, birdie = whole group, bogey = you watch.'],
  ['10', 'Sniper Hole — tree hit = 2 penalty strokes; two trees = carry someone\'s bag.'],
  ['11', 'Closest To The Pin — winner cancels their worst hole.'],
  ['12', 'Longest Drive Official — measured, photographed, referenced forever.'],
  ['13', 'Alternate Shot — partners alternate every shot for the whole hole.'],
  ['14', "One Bounce Counts — tee shot must bounce before the green or it doesn't count."],
  ['15', 'Sandbagging Penalty — if two groups dispute your handicap, +1 stroke.'],
  ['16', 'Free Throw Fairway — one literal hand-throw of the ball, each player.'],
  ['17', 'Island Green Penalty — miss the green entirely = 2 strokes and replay.'],
  ['18', "Victory Lap — last year's losers buy. This year's winners write next year's hardest rule."],
];
body();
for (const [h, line] of RULES_SHORT) {
  ensure(14);
  const y = doc.y;
  doc.font('Helvetica-Bold').fillColor(LIME).text(h.padStart(2, '0'), M, y, { width: 24 });
  doc.font('Helvetica').fillColor(DARK).text(line, M + 28, y, { width: CONTENT_W - 28 });
  doc.moveDown(0.1);
}
doc.moveDown(0.3);

h2('Tech stack at a glance');
kvTable([
  ['Frontend', 'React 18 + Vite + TypeScript + Tailwind + shadcn/ui'],
  ['Routing', 'wouter'],
  ['Maps', 'Leaflet.js + react-leaflet (lazy-loaded)'],
  ['Real-time', 'Firebase Firestore (optional — degrades gracefully to localStorage)'],
  ['PWA', 'vite-plugin-pwa — installable, offline-first'],
  ['Effects', 'canvas-confetti on eagles + birdies'],
  ['Monorepo', 'pnpm workspaces, Node 24'],
  ['Hosting', 'Replit Deployments (HTTPS + .replit.app domain or custom)'],
]);
p('Backend cost today: $0 on the Firebase free tier for a single-day tournament. The architecture is multi-tenant ready — Firestore collections (teams, events, longestDrives) are already keyed in a way that supports per-tournament partitioning with a single field added.');

// ── 03 Market ──────────────────────────────────────────────────────────────
h1('03 · Market & Opportunity');

h2('Raw audience');
kvTable([
  ['United States', '~26M on-course golfers (NGF, 2024)'],
  ['Canada', '~5.6M (Golf Canada)'],
  ['United Kingdom', '~3.4M (England Golf + R&A)'],
  ['Australia', '~3.4M (Golf Australia)'],
  ['Total (4 key markets)', '~38M golfers'],
  ['Casual segment share', "~70% of all rounds played — these are the people who don't track handicap and play for fun"],
  ['Realistic addressable', '~5M people who play 5+ group rounds a year and would happily pay $5–30 to make one of them more chaotic'],
]);

h2('Adjacent indicators — this audience already pays');
bullets([
  'TopGolf: $4B+ valuation, built entirely on "make golf fun for non-golfers."',
  '18Birdies: ~13M registered users, freemium model, $50M+ raised.',
  'Puttery, PopStroke, Drive Shack: venture-backed "party golf venues" — clear thesis that the casual segment monetises.',
  'Bachelor-party spend per attendee: $300–$1,500. Golf is the #1 daytime activity.',
  'Charity golf tournaments: ~140,000 hosted annually in the US alone, average raise $30K each. Most are run on Google Sheets and printed scorecards.',
  'Corporate outings: a $1.5B+ annual category in the US — same operational pain.',
]);

h2('What is missing in the market');
p('Every existing golf app optimises for one of: official handicap (GHIN), GPS rangefinder + analytics (Golfshot, Hole19, 18Birdies), or social posting (18Birdies again). The closest things to "format management" are scoring apps like GameBook and Golf GameBook — but they treat side games (skins, Nassau, Wolf) as dry score-counting, not as entertainment design.');
p('Nobody is shipping the actual fun layer: the rule packs, the wheel, the in-round chaos modifiers, the spectator-friendly leaderboard. That gap is what WFC fills.');

// ── 04 Competitive landscape ───────────────────────────────────────────────
h1('04 · Competitive Landscape');

const COMPETITORS: [string, string, string][] = [
  ['18Birdies', '~13M users, freemium', 'GPS + social feed + handicap. Has a "Games" tab with skins, but no format rules, no item box, no per-tournament organizer flow. Could copy the feature, but their product DNA is solo-tracking, not party-hosting.'],
  ['GHIN', 'USGA-official handicap', 'Pure handicap service. Has zero entertainment ambition. Will never compete here.'],
  ['Golfshot / Hole19', '1–5M each', 'GPS rangefinder + stat tracking. Solo-player oriented. Same gap as 18Birdies.'],
  ['Golf GameBook', '~1M users', 'Closest competitor. Live scoring + leaderboards + side games. But UI is dry and the "games" are conventional formats (skins, scramble), no chaos mechanics, no in-round modifiers, no themed item packs.'],
  ['TheGrint', 'Mid-size US handicap', 'Handicap + tournaments. Tournament feature is form-filling, not playable.'],
  ['Tournament software (BlueGolf, Golf Genius)', 'B2B, charity / club market', 'Real money is here for B2B WFC. They sell registration + leaderboards to event organizers but the on-course experience is a printed scorecard. Adjacent, not competitive — could become a partner or acquirer.'],
];

for (const [name, pos, note] of COMPETITORS) {
  ensure(40);
  const y0 = doc.y;
  doc.font('Helvetica-Bold').fontSize(11).fillColor(BLACK).text(name, M, y0);
  doc.font('Helvetica-Oblique').fontSize(9).fillColor(GREY).text(pos, M + 200, y0, { width: CONTENT_W - 200 });
  doc.moveDown(0.1);
  doc.font('Helvetica').fontSize(10).fillColor(DARK).text(note, { lineGap: 2 });
  doc.moveDown(0.3);
  rule('#EEEEEE', doc.y - 4);
}

callout('Why WFC is genuinely novel',
  'Wheel-driven random chaos applied to live net scores, paired with packaged per-hole format rules, paired with a real-time spectator leaderboard. No incumbent ships all three. Most ship none. The wheel in particular is the kind of feature that gets screenshotted and shared — it is the product\'s organic acquisition surface.');

// ── 05 Monetization ────────────────────────────────────────────────────────
h1('05 · Monetization Paths, Ranked');

function path(idx: string, title: string, who: string, price: string, friction: string, realism: string, note: string) {
  ensure(80);
  const y0 = doc.y;
  doc.font('Helvetica-Bold').fontSize(11).fillColor(LIME).text(idx, M, y0, { width: 28 });
  doc.font('Helvetica-Bold').fontSize(11).fillColor(BLACK).text(title, M + 28, y0, { width: CONTENT_W - 28 });
  doc.moveDown(0.2);
  body();
  kvTableInline([
    ['Who pays', who],
    ['Price', price],
    ['Friction', friction],
    ['Realism', realism],
  ]);
  doc.font('Helvetica').fontSize(10).fillColor(DARK).text(note, { lineGap: 2 });
  doc.moveDown(0.5);
  rule('#EEEEEE', doc.y - 2);
}
function kvTableInline(rows: [string, string][]) {
  for (const [k, v] of rows) {
    ensure(14);
    const y = doc.y;
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(GREY).text(k.toUpperCase(), M, y, { width: 90, characterSpacing: 1 });
    doc.font('Helvetica').fontSize(10).fillColor(DARK).text(v, M + 90, y, { width: CONTENT_W - 90 });
    doc.moveDown(0.1);
  }
  doc.moveDown(0.2);
}

path('01', 'Per-tournament unlock',
  'Organizer of a single event (bachelor party planner, captain of an annual guys\' trip, charity coordinator)',
  '$5–15 one-time per tournament, up to N teams',
  'Lowest possible — no subscription, no account commitment',
  'HIGH — this is the natural day-one product',
  'Most realistic first revenue. Stripe checkout, code generated, organizer shares the join link. Pricing tiered by team count caps the high end without alienating small groups.');

path('02', 'Organizer Pro subscription',
  'Anyone who runs leagues, recurring foursomes, charity events, or corporate outings 4+ times a year',
  '$9.99/mo or $49/yr',
  'Medium — requires belief in repeat usage',
  'HIGH — this is the long-term ARR engine',
  'Unlimited tournaments, custom rule packs, branded leaderboard, PDF exports for the clubhouse wall, season-long aggregate stats. Most golfers who organize anything are happy to pay this if it saves them the printed-scorecard headache.');

path('03', 'Freemium consumer',
  'A casual golfer who downloaded the app once and wants to use it again',
  'Free for 1 tournament/month with default rules; $4.99/mo or $29/yr unlimited',
  'Medium — App Store / Play Store consumer-app conversion is brutal (2–5%)',
  'MEDIUM — works only if you nail viral mechanics',
  "Don't lead with this. Lead with organizer revenue. Consumer freemium only becomes meaningful once you have content (rule packs, themed events, seasonal items) that justifies recurring subscription. Apple/Google take 15–30% — price accordingly.");

path('04', 'Course / venue partnership',
  'Golf course general manager looking to fill twilight tee times',
  '$100–500/mo per course for co-branded version, or rev-share per round',
  'High — long sales cycles, manual outreach',
  'MEDIUM — slow but defensible once landed',
  '"Chaos Night Tuesdays" — courses license a co-branded version, push it to their members, fill dead tee times. 15,000+ courses in the US alone. Conversion is hard but each landed course is sticky for years.');

path('05', 'Charity tournament package',
  'Charity tournament organizers (140K+ events/yr in US alone)',
  '$250–1,000 per event, fully turn-key',
  'Medium — requires onboarding support, but events are pre-planned 3+ months out',
  'HIGH — most underrated revenue path',
  'Turn-key: registration, payment processing, sponsor branding on item boxes, real-time leaderboard for the clubhouse TV, photo recap PDF afterward. Charities will happily pay $500 to look modern in front of donors. Tournament software vendors (BlueGolf, Golf Genius) charge multiples of this for inferior experiences.');

path('06', 'Sponsored item boxes / hole sponsorships',
  'Beer brands (Modelo, Michelob ULTRA), ball brands (Titleist, Callaway), local breweries, golf brands',
  '$500–5,000 per sponsorship campaign or event',
  'High — requires brand sales team or partnership network',
  'LOW initially, MEDIUM at scale',
  '"Modelo Mushroom: +1 stroke, free beer at the turn." Brands already spend on golf — they have nowhere good to spend digital dollars. Not the first revenue source, but a clear margin booster once you have audience.');

path('07', 'Strategic acquisition',
  '18Birdies, Garmin Golf, Bushnell, GolfNow, Topgolf, BlueGolf, Golf Genius',
  '$1M–10M depending on traction',
  'N/A — outcome, not a path',
  'LOW (5–10% in 3–5 years if you hit 50K+ MAU)',
  'Plausible exit. Strategic buyers in golf actively acquire feature-set additions. The acquirer is more likely to be a B2B tournament-software vendor than a consumer app, which reinforces the case for prioritising the charity/course channels.');

// ── 06 Revenue scenarios ───────────────────────────────────────────────────
h1('06 · Revenue Scenarios');

h2('Scenario A — Lifestyle business (highly achievable)');
p('5,000 paying users at $30/yr (mix of per-tournament unlocks and organizer subscriptions) = ~$150K ARR. Solo-founder operable. 18-24 month timeline. Net margin 70%+ after Stripe + hosting. This is the realistic first ceiling for a focused indie builder.');

h2('Scenario B — Small business (achievable with full-time effort)');
kvTable([
  ['25,000 organizer subs × $40 ARPU', '$1.0M'],
  ['100 charity-tournament packages × $500', '$50K'],
  ['50 course partnerships × $200/mo × 6 months', '$60K'],
  ['Sponsored item-box campaigns', '$100K'],
  ['Total', '~$1.2M ARR'],
]);
p('Requires founder full-time + 1–2 hires (B2B sales / customer success). 3-year timeline. Net margin 50–60% after team and B2B sales effort.');

h2('Scenario C — Venture scale (possible, not probable)');
kvTable([
  ['200K MAU × 5% conversion × $40 ARPU', '$4.0M'],
  ['500 charity packages × $750', '$0.4M'],
  ['300 course partnerships × $200/mo', '$0.7M'],
  ['Sponsor revenue', '$0.5–1.0M'],
  ['Total', '~$5–6M ARR'],
]);
p('~5–10% probability with focused execution and one funding round. Routes more through B2B (course + charity) than consumer. Acquisition outcome at this scale: $20–60M to a strategic.');

callout('Cost side, all scenarios',
  'Firebase, Stripe, and hosting scale at <5% of revenue. The real cost is people and marketing. Solo at Scenario A: ~$5K/yr operating cost. Scenario B: $300–500K/yr team + marketing. Scenario C: $2–3M/yr — requires raising.');

// ── 07 What has to change ──────────────────────────────────────────────────
h1('07 · What Has To Change To Go Public');

h2('Product (in priority order)');
bullets([
  'Strip the Nintendo IP. "Mario Kart items" guarantees a cease-and-desist once you have any traction. Reskin to original IP: Boost, Strike, Sweep, Steal, Bolt, Bomb, Ghost, Shield. Same mechanics, original art. One-week job.',
  'Multi-tenant: any organizer can create a tournament with a join code. Real auth (not the shared "wfc" admin password). User accounts.',
  'Bring-your-own course. Replace hard-coded Dundee CC with a course directory. Start with USGA / GHIN data or partner with a course API. Per-hole par + yardage is enough; rules default to a starter pack the organizer customises.',
  'Custom rule editor. Organizers write their own per-hole rules. This is the killer feature — the app becomes a platform, not one tournament. Combined with a public "rule pack library" it gives you content marketing and SEO for free.',
  'More wheel items + multiple spins per round. Mario Kart\'s entire genius is multiple item boxes per lap. Three spins (tee 1, turn, tee 14) plus rotating seasonal item packs ("Bachelor Pack," "St. Patrick\'s Pack," "Charity Scramble Pack") gives you a content treadmill that justifies subscription.',
  'Items that actually modify gameplay, not just net score. Banana = next putt must be one-handed. Mushroom = play next tee from forward markers. Blue Shell = leader replays their last hole. This is what makes the app talked-about, not just used.',
  'Native iOS / Android. PWA install friction is real for non-tech users. Expo-wrap the existing React app — 2-week job.',
  'Handicap support + GHIN sync. Required for any serious organizer or charity event.',
]);

h2('Business');
bullets([
  'Privacy policy, terms of service, data retention policy (basic, not enterprise — but required for App Store).',
  'Stripe for web checkout. Apple IAP + Google Play Billing for mobile — both take 15–30% so price tiers accordingly.',
  'Trademark a name. "WFC" is fine as a working title; you will need something cleaner for public launch ("Caddy Chaos," "Fore Chaos," "Wildcard Golf," etc.).',
  'LLC or corp. Liability shield + clean billing.',
  'Insurance: a $1M general-liability policy is cheap (~$500/yr) and required by most courses if you do B2B.',
]);

// ── 08 Risks ───────────────────────────────────────────────────────────────
h1('08 · Risks');

const RISKS: [string, string][] = [
  ['Nintendo trademark', 'Real and immediate. Reskin before any marketing spend. Mitigation cost: 1 week of design work. Risk after mitigation: zero.'],
  ['Seasonality', 'April–October in most markets. ~6 months of dead time. Partial offsets: Hawaii / FL / AZ / CA / AU / NZ users, indoor simulator partnerships (Trackman, Foresight, Aboutgolf venues), off-season "league planning" tooling. Plan revenue around it — Q2-Q3 will be 60–70% of annual revenue forever.'],
  ['Weak network effects', 'Your foursome buys together, but there is no automatic spread to other foursomes. Mitigation: cross-course leaderboards, public rule packs (Reddit-style upvoting), a "rule of the week" content loop, referral credits.'],
  ['Retention without fresh content', 'Novelty wears off in 3 rounds without new content. Mitigation: monthly item-pack drops, seasonal events, a "challenge of the month," league-mode persistence. Treat content cadence as a permanent ops cost (~$1–2K/mo at the lifestyle stage).'],
  ['Customer acquisition cost', 'Golf media is expensive. Best ROI channels at the start: r/golf, Barstool "Fore Play," NoLayingUp, golf influencers on Instagram / TikTok (still cheap), local pro-shop partnerships, bachelor-party planning sites (PartyPaddle, Bach.com), corporate-outing planners.'],
  ['Platform tax', 'Apple and Google each take 15–30% on mobile IAP. Stripe web checkout is 2.9% + 30¢ — push organizers to web checkout where possible.'],
  ['Live-event reliability', "If the leaderboard breaks during a real tournament, the reputational damage is severe. Mitigation: offline-first architecture (already in place via localStorage fallback), redundant Firebase regions, paid Firebase tier for any organizer with >50 teams, status-page transparency."],
];
for (const [r, mit] of RISKS) {
  ensure(40);
  doc.font('Helvetica-Bold').fontSize(10.5).fillColor(BLACK).text(r);
  doc.moveDown(0.1);
  doc.font('Helvetica').fontSize(10).fillColor(DARK).text(mit, { lineGap: 2 });
  doc.moveDown(0.4);
}

// ── 09 90-day roadmap ──────────────────────────────────────────────────────
h1('09 · 90-Day Validation Roadmap');

h2('Weeks 1–2 · Reskin + multi-tenant scaffolding');
bullets([
  'Strip Nintendo IP. Rename items. Original art (8 simple SVG icons, ~1 day).',
  'Add tournament-id partitioning to Firestore collections. Generate join codes.',
  'Replace shared admin password with per-tournament organizer account (email + magic link is fine).',
  'New "Create tournament" landing page — name, course (free-text for now), team count, rule pack pick.',
]);

h2('Weeks 3–5 · Default rule packs + course freedom');
bullets([
  'Ship 3 starter rule packs: "Chaos Classic" (current WFC rules), "Bachelor Mode" (drinking-friendly), "Charity Scramble" (corporate-safe).',
  'Per-pack: 18 rules + 8 items + a header colour + 1-paragraph description.',
  'Allow organizer to swap individual hole rules from a library before locking the tournament.',
  'Replace Dundee CC hard-coding with a "choose a course" search powered by free public data (USGA course directory scrape or partner API).',
]);

h2('Weeks 6–8 · Land 30 free public tournaments');
bullets([
  'Founder-led acquisition. Post in r/golf, golf Discords, bachelor-party Facebook groups, local pro-shop community boards.',
  'Offer to set up the first tournament personally for any group that asks — direct feedback is more valuable than the time it costs.',
  'Instrument analytics: install → complete round → share rate. Goal: 50%+ complete-round rate, 30%+ share rate.',
  'Interview every organizer post-round. Capture: would they pay, how much, what was missing.',
]);

h2('Weeks 9–10 · Add Stripe at tournament #30');
bullets([
  'Charge $9 per tournament unlock (up to 12 teams). $19 for 12–30 teams. $29 for 30+.',
  'Free trial: first tournament free. Second tournament onwards: paid.',
  'Conversion target: 20%+ from free → paid. 5–20% means you have a real but narrow market. <2% means kill the consumer path and pivot fully to B2B.',
]);

h2('Weeks 11–12 · B2B discovery sprint (parallel track)');
bullets([
  'Cold outreach to 10 charity-tournament organizers and 5 course general managers.',
  'Offer free white-label tournament for their next event in exchange for a 30-minute post-event interview.',
  'Decision point at day 90: do you have stronger pull from organizers, courses, or consumers? Whichever wins becomes the primary GTM motion for year 1.',
]);

// ── 10 Bottom line ─────────────────────────────────────────────────────────
h1('10 · Bottom Line');
p('You have a real, differentiated product in a market that already pays for golf software and golf entertainment. The product is closer to launch-ready than most "idea-stage" apps because the live-tournament use case has already shaken out the hard engineering problems (real-time scoring sync, offline fallback, leaderboard reshuffling, PWA installability).');
p('The achievable outcome is $150–500K ARR as a one-person business within 24 months. The realistic ambitious outcome is $1–1.5M ARR with two years of focused work and a B2B motion focused on charity tournaments and course partnerships. The venture-scale outcome is plausible but not the right thing to optimise for from day one.');
callout('Single biggest unlock',
  "It is not more wheel items. It is making the rules and items user-editable so the app becomes a platform any group, league, course, or charity can shape to their crowd. That is what converts a private tournament tool into a recurring product — and it is the difference between a clever weekend hack and a real business.");
p('Recommended next step: spend two weeks on the reskin + multi-tenant work, then run the 90-day validation roadmap above. The cost is low, the signal at day 90 is high, and the downside is just a great party-golf app you and your friends keep playing every year.');

// ── Appendix ───────────────────────────────────────────────────────────────
doc.addPage();
h1('Appendix · Full Hole-Rule Catalogue');
p('Source: artifacts/wfc-app/src/lib/holes.ts. Yardages from real Dundee CC scorecard data (front 9 confirmed via 18Birdies / GolfNorth; back 9 estimated). Rules are WFC custom tournament rules, not official course rules — included here so any AI reading this brief has the source material when reasoning about the product.');

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
  ensure(64);
  const y0 = doc.y;
  doc.save().fillColor(BLACK).rect(M, y0, 44, 44).fill().restore();
  doc.fillColor(LIME).font('Helvetica-Bold').fontSize(18).text(String(h.hole), M, y0 + 12, { width: 44, align: 'center' });
  doc.fillColor(BLACK).font('Helvetica-Bold').fontSize(12)
    .text(h.ruleName.toUpperCase(), M + 56, y0, { width: CONTENT_W - 56, characterSpacing: 0.5 });
  doc.fillColor(GREY).font('Helvetica').fontSize(9)
    .text(`PAR ${h.par}  ·  ${h.tips} yds (tips)  /  ${h.womens} yds (women's)`,
      M + 56, y0 + 14, { width: CONTENT_W - 56, characterSpacing: 1 });
  doc.fillColor(DARK).font('Helvetica').fontSize(10)
    .text(h.rule, M + 56, y0 + 28, { width: CONTENT_W - 56, lineGap: 2 });
  const finalY = doc.y;
  doc.y = Math.max(finalY, y0 + 46) + 6;
  rule('#EEEEEE', doc.y - 2);
}

doc.moveDown(0.6);
rule(LIME);
doc.moveDown(0.4);
doc.font('Helvetica-Bold').fontSize(9).fillColor(BLACK).text('WFC · PRODUCT BRIEF & MONETIZATION ANALYSIS', { characterSpacing: 2 });
doc.font('Helvetica').fontSize(8).fillColor(GREY).text('Companion document to the WFC Owner Handover Guide. Source repository: WFC pnpm monorepo, artifacts/wfc-app/.');

doc.end();
console.log(`Wrote ${OUT}`);
