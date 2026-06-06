// Whacky's WFC roast engine — no filter, no mercy.
// pickRoast returns { text, face } so the bubble can match Whacky's expression
// to the insult. msgIndex is incremented per message so successive calls vary.

export type FaceType = 'angry' | 'laugh' | 'shocked' | 'fire' | 'sad' | 'smug';

export interface RoastResult {
  text: string;
  face: FaceType;
}

export interface RoastParams {
  teamName: string;
  players: string[];     // only include non-empty names
  netScore: number;
  holesPlayed: number;
  holeNum: number;
  score: number | null;  // score on PREVIOUS hole
  par: number;           // par on PREVIOUS hole
  msgIndex?: number;     // increments per message call to vary seed
}

// ── Plural helpers ──────────────────────────────────────────────────────────

function plural(players: string[], singular: string, few: string, many: string): string {
  const n = players.filter(p => p.trim()).length;
  if (n <= 1) return singular;
  if (n === 2) return few;
  return many;
}

function them(players: string[]): string {
  return plural(players, 'this guy', 'these two', 'you lot');
}

function youPl(players: string[]): string {
  return plural(players, 'you', 'you two', 'you lot');
}

function fags(players: string[]): string {
  const n = players.filter(p => p.trim()).length;
  if (n <= 1) return 'you dumb fuck';
  if (n === 2) return 'you pair of faggots';
  if (n === 3) return 'you three faggots';
  return 'all four of you faggots';
}

// ── Roast pools ─────────────────────────────────────────────────────────────

const GENERIC: Array<{ text: (p: string[]) => string; face: FaceType }> = [
  { face: 'laugh', text: p => `Your swing is biological proof that dad was right to be disappointed in ${youPl(p)}.` },
  { face: 'shocked', text: p => `The groundskeeping crew filed a trauma report after watching ${them(p)} take that divot.` },
  { face: 'angry', text: p => `Every ball ${youPl(p)} hit is a hate crime against physics and the sport of golf.` },
  { face: 'laugh', text: p => `Par is a polite suggestion. ${youPl(p).charAt(0).toUpperCase() + youPl(p).slice(1)} treat it as a personal threat.` },
  { face: 'sad', text: p => `The cart girl drove past ${them(p)} without stopping. She's seen the scorecard.` },
  { face: 'angry', text: p => `${youPl(p).charAt(0).toUpperCase() + youPl(p).slice(1)} couldn't hit a fairway if it was the size of your combined ego.` },
  { face: 'shocked', text: p => `The golf ball didn't go out of bounds. It was fleeing ${them(p)}.` },
  { face: 'laugh', text: p => `Somewhere on this course, a goose watched that shot and shook its head at ${them(p)}.` },
  { face: 'angry', text: p => `${youPl(p).charAt(0).toUpperCase() + youPl(p).slice(1)} read that green like ${plural(p, 'a dyslexic reading a map', 'two dyslexics sharing one map', 'a group of dyslexics with no map')} in the dark.` },
  { face: 'smug', text: p => `Nobody has ever complimented ${plural(p, 'your', 'your', 'your collective')} course management. Nobody ever will.` },
  { face: 'shocked', text: p => `${youPl(p).charAt(0).toUpperCase() + youPl(p).slice(1)}'ve done more damage to this course than the frost last winter.` },
  { face: 'laugh', text: p => `Even the crows are judging ${them(p)} and they literally eat roadkill for a living.` },
  { face: 'angry', text: p => `${fags(p).charAt(0).toUpperCase() + fags(p).slice(1)} — out here turning a sport into a hate act.` },
  { face: 'sad', text: p => `${youPl(p).charAt(0).toUpperCase() + youPl(p).slice(1)}'re playing this like it owes ${youPl(p)} money. It doesn't.` },
  { face: 'shocked', text: p => `A 9-year-old at a birthday golf party just outdrew ${them(p)}. Twice.` },
  { face: 'laugh', text: p => `The GPS on the cart keeps rerouting because it gave up trying to predict where ${plural(p, 'you\'re', 'you\'re both', 'you\'re all')} going.` },
  { face: 'angry', text: p => `${fags(p).charAt(0).toUpperCase() + fags(p).slice(1)} — proof that confidence and competence don't always travel together.` },
  { face: 'sad', text: p => `Water hazards see ${them(p)} coming and get excited.` },
  { face: 'laugh', text: p => `Three-putting is a choice. A bad one. But it's ${plural(p, 'your', 'both of yours', 'all of yours')}.` },
  { face: 'shocked', text: p => `${youPl(p).charAt(0).toUpperCase() + youPl(p).slice(1)}'d play better blindfolded. Worth trying.` },
  { face: 'angry', text: p => `Whatever ${youPl(p)} practiced in the off-season, it wasn't this. Definitely wasn't this.` },
  { face: 'laugh', text: p => `If bad golf was a currency ${fags(p)} would be fucking rich right now.` },
  { face: 'smug', text: p => `Whack Fuck Cup has seen some bad golf. ${youPl(p).charAt(0).toUpperCase() + youPl(p).slice(1)} are genuinely remarkable even by those standards.` },
];

const OVER_PAR: Array<{ text: (p: string[]) => string; face: FaceType }> = [
  { face: 'angry', text: p => `Over par already. If disappointment were a sport ${fags(p)} would be champion.` },
  { face: 'fire', text: p => `${youPl(p).charAt(0).toUpperCase() + youPl(p).slice(1)} are bleeding strokes like ${plural(p, 'you\'ve', 'you\'ve both', 'you\'ve all')} got a quota to fill.` },
  { face: 'angry', text: p => `${youPl(p).charAt(0).toUpperCase() + youPl(p).slice(1)}'re over par and under-performing. Simultaneously, somehow.` },
  { face: 'laugh', text: p => `Keep this up and ${youPl(p)} will need a calculator to count ${plural(p, 'your', 'both your', 'all your')} strokes.` },
  { face: 'sad', text: p => `${youPl(p).charAt(0).toUpperCase() + youPl(p).slice(1)} play this badly for free. Imagine if someone paid ${youPl(p)} to suck.` },
  { face: 'angry', text: p => `The leaderboard has a section for ${plural(p, 'teams', 'teams', 'teams')} like ${youPl(p)}. It's called the bottom.` },
  { face: 'fire', text: p => `${youPl(p).charAt(0).toUpperCase() + youPl(p).slice(1)}'re over par on this course the same way ${youPl(p)}'re over ${plural(p, 'your', 'both your', 'all your')} heads in life.` },
];

const UNDER_PAR: Array<{ text: (p: string[]) => string; face: FaceType }> = [
  { face: 'smug', text: p => `Under par. Great. Now everyone has to pretend to like ${them(p)}.` },
  { face: 'laugh', text: p => `${youPl(p).charAt(0).toUpperCase() + youPl(p).slice(1)}'re under par and still the most annoying ${plural(p, 'person', 'two people', 'group')} on this course.` },
  { face: 'smug', text: p => `Low net. Still ${plural(p, 'a mediocre human being', 'two mediocre human beings', 'a mediocre group of human beings')}. Nothing changes.` },
  { face: 'laugh', text: p => `Under par and acting like ${youPl(p)} qualified for the fucking Masters.` },
  { face: 'smug', text: p => `${youPl(p).charAt(0).toUpperCase() + youPl(p).slice(1)}'re under par. ${plural(p, 'Your teammate is', 'Your teammates are', 'Your teammates are')} still embarrassed by association.` },
];

const EVEN: Array<{ text: (p: string[]) => string; face: FaceType }> = [
  { face: 'smug', text: p => `Even par. The beige wallpaper of golf scores. Well done ${youPl(p)}.` },
  { face: 'sad', text: p => `Even par. ${youPl(p).charAt(0).toUpperCase() + youPl(p).slice(1)} exist. Congratulations on the bare minimum.` },
  { face: 'smug', text: _ => `Even par is golf's way of saying "you tried and it didn't matter."` },
];

interface PlayerEntry { text: (name: string, p: string[]) => string; face: FaceType }
const PLAYER_TEMPLATES: PlayerEntry[] = [
  { face: 'fire', text: (n) => `${n}, that was the worst fucking swing I've seen since your conception.` },
  { face: 'laugh', text: (n) => `${n} has the course management of a golden retriever chasing a tennis ball.` },
  { face: 'angry', text: (n) => `${n} hits it like they're settling a beef with the grass personally.` },
  { face: 'shocked', text: (n) => `${n} asked the cart girl for help reading the green. She laughed and drove away.` },
  { face: 'sad', text: (n) => `${n} plays every hole like it's a new traumatic experience.` },
  { face: 'fire', text: (n) => `${n} took that divot so fat it's now classified as a soil disturbance.` },
  { face: 'laugh', text: (n) => `Someone tell ${n} the cup is on THIS side of the course.` },
  { face: 'angry', text: (n) => `${n} putts like a man who's never seen a slope before in his life.` },
  { face: 'shocked', text: (n) => `${n} is what happens when confidence doesn't come with receipts.` },
  { face: 'fire', text: (n) => `${n} hit that so fat the divot is pregnant now.` },
  { face: 'laugh', text: (n) => `${n} has more excuses than strokes. That's saying something.` },
  { face: 'angry', text: (n) => `Nice whiff ${n}. The ball stood there and watched you miss it.` },
  { face: 'sad', text: (n) => `${n} missed a two-footer. Closer to the hole than your dad was to being there for you.` },
  { face: 'shocked', text: (n) => `${n} lined up that putt, looked confident, and fucked it completely. Classic ${n}.` },
  { face: 'fire', text: (n) => `${n} topped it so bad your dick is jealous of the contact.` },
  { face: 'laugh', text: (n) => `${n}'s pullout game is still better than their iron game. Still not good.` },
  { face: 'angry', text: (n) => `${n} that putt missed harder than your dad missed your childhood.` },
  { face: 'sad', text: (n) => `${n} swings that club like they fucking hate it. The club hates them back.` },
  { face: 'laugh', text: (n) => `${n} just out-sliced a banana. On a par 3.` },
  { face: 'shocked', text: (n) => `${n} needs a GPS to find the fairway and still ends up in the trees.` },
];

interface TeamEntry { text: (t: string, p: string[]) => string; face: FaceType }
const TEAM_TEMPLATES: TeamEntry[] = [
  { face: 'angry', text: (t, p) => `${t} — ${fags(p)} are out here playing like you collectively failed kindergarten.` },
  { face: 'laugh', text: (t) => `${t} has a great team name. That's genuinely the only great thing about ${t}.` },
  { face: 'fire', text: (t, p) => `${t} is proof that ${plural(p, 'one person', 'two people', 'multiple people')} can be catastrophically wrong at the exact same time.` },
  { face: 'angry', text: (t) => `The legacy of ${t} on this course: a scorecard that will never see daylight.` },
  { face: 'shocked', text: (t) => `${t} came to play golf. Golf did not consent.` },
  { face: 'fire', text: (t, p) => `Whack Fuck Cup regrets inviting ${t}. ${fags(p).charAt(0).toUpperCase() + fags(p).slice(1)} are fucking useless.` },
  { face: 'sad', text: (t) => `${t}: talked absolute shit in the parking lot, completely different story out here.` },
  { face: 'angry', text: (t, p) => `Look at ${fags(p)} from ${t} acting like they can golf.` },
  { face: 'laugh', text: (t) => `The whole ${t} squad just embarrassed themselves in unison. Beautiful teamwork.` },
  { face: 'fire', text: (t, p) => `${plural(p, 'One grown adult', p.filter(x => x.trim()).length + ' grown adults', p.filter(x => x.trim()).length + ' grown adults')} from ${t} and not one of ${youPl(p)} can find a fucking fairway.` },
  { face: 'sad', text: (t, p) => `${t} as a unit produces less golf than a blind dog with one leg. Remarkable ${youPl(p)}.` },
  { face: 'angry', text: (t, p) => `${t} sent ${fags(p)} out here and somehow none of you can hit a straight ball.` },
  { face: 'shocked', text: (t, p) => `The ${t} boys are out here looking like ${plural(p, 'he\'s', 'they\'ve', 'they\'ve')} never seen grass before.` },
];

interface HighScoreEntry { text: (p: string[], par: number, score: number, players: string[]) => string; face: FaceType }
const HIGH_SCORE: HighScoreEntry[] = [
  { face: 'fire', text: (p, _par, s) => `${s} on that hole? ${fags(p).charAt(0).toUpperCase() + fags(p).slice(1)} — that's not golf, that's assisted suicide.` },
  { face: 'shocked', text: (p, _par, s) => `${s} strokes. That number should require a fucking permit.` },
  { face: 'fire', text: (p, par, s) => `${s - par} over par on one hole, ${youPl(p)}. One. Hole.` },
  { face: 'shocked', text: (p) => `${fags(p).charAt(0).toUpperCase() + fags(p).slice(1)}, that snowman is the most activity any of you will get with a ball this year.` },
  { face: 'fire', text: (p) => `${youPl(p).charAt(0).toUpperCase() + youPl(p).slice(1)} scored higher on that hole than on any exam any of ${plural(p, 'you have', 'you two have', 'you lot have')} ever taken.` },
  { face: 'laugh', text: (_, _par, s) => `A ${s}. The course has seen worse. The course is lying.` },
  { face: 'fire', text: (p, _par, s) => `${s} strokes on one hole. The hole is 150 yards. Do the math, ${youPl(p)}.` },
  { face: 'angry', text: (p, par, s) => `That's ${s - par} shots worse than par, ${fags(p)}. ${s - par} of them.` },
];

const HOLE_SPECIFIC: Record<number, { text: string; face: FaceType }> = {
  1:  { face: 'shocked', text: 'First hole and already looking like that. Not a great omen.' },
  2:  { face: 'laugh',   text: 'Two holes in. Two holes of evidence this round is going to be rough.' },
  3:  { face: 'angry',   text: "Three holes in and still searching for one decent shot. Inspiring persistence." },
  4:  { face: 'smug',    text: 'Hole 4 is when most golfers start lying to themselves. How\'s that going?' },
  5:  { face: 'laugh',   text: 'Five holes in. Still no sign of improvement. Still zero sign of shame.' },
  6:  { face: 'shocked', text: 'Hole 6 is forgiving. What just happened on the last one was not forgivable.' },
  7:  { face: 'angry',   text: 'Seventh hole. Lucky number for everyone except the people watching this.' },
  8:  { face: 'laugh',   text: 'One away from the turn. Try not to completely implode before you get there.' },
  9:  { face: 'smug',    text: 'Last hole before the turn. Whatever is on that scorecard — own it, coward.' },
  10: { face: 'fire',    text: 'Back nine. Fresh start. Same fucking problems.' },
  11: { face: 'sad',     text: 'Hole 11 is when people pretend the front nine didn\'t happen. It happened.' },
  12: { face: 'laugh',   text: 'Halfway through the back nine. The bar is getting louder in your head.' },
  13: { face: 'angry',   text: 'Hole 13. Unlucky for some. Statistically unavoidable for you.' },
  14: { face: 'smug',    text: 'Four from home. Pick it up or pick a different sport.' },
  15: { face: 'fire',    text: 'Still trying to figure out what\'s going wrong? Everything. Everything is going wrong.' },
  16: { face: 'laugh',   text: 'Two holes from the clubhouse. The beer is almost worth surviving this.' },
  17: { face: 'shocked', text: 'Second to last. Just enough time to make it worse. And you might.' },
  18: { face: 'fire',    text: 'Final hole. Whatever you post here is your legacy today. God help you.' },
};

const SCORE_CONTEXT: Array<{ text: (p: string[]) => string; face: FaceType }> = [
  { face: 'laugh', text: p => `${plural(p, 'Your', 'Both your', 'Everyone\'s')} game is like ${plural(p, 'your', 'both your', 'all your')} pullout game — nonexistent and disappointing everyone.` },
  { face: 'angry', text: p => `${youPl(p).charAt(0).toUpperCase() + youPl(p).slice(1)} play golf like it's a form of self-harm and ${plural(p, 'you\'re', 'you\'re both', 'you\'re all')} committed to the bit.` },
  { face: 'fire', text: p => `${plural(p, 'Your', 'Both your', 'Your collective')} round so far is a hate letter to the sport of golf.` },
  { face: 'shocked', text: p => `The Whack Fuck Cup has seen some bad golf. ${fags(p).charAt(0).toUpperCase() + fags(p).slice(1)} are genuinely remarkable even by those standards.` },
  { face: 'sad', text: p => `Somewhere ${plural(p, 'your', 'both your', 'all your')} old golf coach${plural(p, ' is', 'es are', 'es are')} having a drink and not thinking about ${youPl(p)}. Good for ${plural(p, 'him', 'them', 'them')}.` },
  { face: 'angry', text: p => `${fags(p).charAt(0).toUpperCase() + fags(p).slice(1)} are on pace for a score that'll be talked about. Not positively.` },
];

// ── Seed & pick ──────────────────────────────────────────────────────────────

function seededIdx(arr: unknown[], seed: number): number {
  return ((seed % arr.length) + arr.length) % arr.length;
}

export function pickRoast(params: RoastParams): RoastResult {
  const { teamName, players, netScore, holesPlayed, holeNum, score, par, msgIndex = 0 } = params;
  const activePlayers = players.filter(p => p.trim());

  const nameSeed = teamName.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const seed = holeNum * 31 + holesPlayed * 17 + nameSeed + msgIndex * 7;

  // High-score roast — highest priority when last hole was a disaster
  if (score !== null && score - par >= 2) {
    const entry = HIGH_SCORE[seededIdx(HIGH_SCORE, seed + 3)];
    return { text: entry.text(activePlayers, par, score, activePlayers), face: entry.face };
  }

  // Rotate through categories using the seed
  const category = ((seed * 7 + holesPlayed * 3 + msgIndex * 11) % 14);

  if (category === 0 && HOLE_SPECIFIC[holeNum]) {
    const h = HOLE_SPECIFIC[holeNum];
    return { text: h.text, face: h.face };
  }

  if (category === 1 && holesPlayed > 2) {
    if (netScore > 4)  { const e = OVER_PAR[seededIdx(OVER_PAR, seed + 11)];  return { text: e.text(activePlayers), face: e.face }; }
    if (netScore < -2) { const e = UNDER_PAR[seededIdx(UNDER_PAR, seed + 5)]; return { text: e.text(activePlayers), face: e.face }; }
    if (netScore === 0){ const e = EVEN[seededIdx(EVEN, seed + 9)];            return { text: e.text(activePlayers), face: e.face }; }
  }

  if ((category === 2 || category === 8) && activePlayers.length > 0) {
    const player = activePlayers[seededIdx(activePlayers, seed + 13)];
    const firstName = player.trim().split(' ')[0];
    const entry = PLAYER_TEMPLATES[seededIdx(PLAYER_TEMPLATES, seed + 7)];
    return { text: entry.text(firstName, activePlayers), face: entry.face };
  }

  if ((category === 3 || category === 9) && activePlayers.length >= 2) {
    const player = activePlayers[(seededIdx(activePlayers, seed + 19) + 1) % activePlayers.length];
    const firstName = player.trim().split(' ')[0];
    const entry = PLAYER_TEMPLATES[seededIdx(PLAYER_TEMPLATES, seed + 23)];
    return { text: entry.text(firstName, activePlayers), face: entry.face };
  }

  if (category === 4 || category === 10) {
    const entry = TEAM_TEMPLATES[seededIdx(TEAM_TEMPLATES, seed + 3)];
    return { text: entry.text(teamName, activePlayers), face: entry.face };
  }

  if (category === 5 || category === 11) {
    const entry = SCORE_CONTEXT[seededIdx(SCORE_CONTEXT, seed + 13)];
    return { text: entry.text(activePlayers), face: entry.face };
  }

  if (category === 12 && HOLE_SPECIFIC[holeNum]) {
    const h = HOLE_SPECIFIC[holeNum];
    return { text: h.text, face: h.face };
  }

  const entry = GENERIC[seededIdx(GENERIC, seed + 17)];
  return { text: entry.text(activePlayers), face: entry.face };
}
