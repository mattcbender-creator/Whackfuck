// Whacky's WFC roast engine — no filter, no mercy.
// Roasts are picked deterministically but change as holes are scored
// (seed includes holesPlayed so each new hole scored picks a fresh chirp).
// Templates use {player}, {team}, {hole} which are interpolated at call time.

const GENERIC: string[] = [
  "Your swing is the biological proof that dad was right to be disappointed.",
  "The groundskeeping crew filed a trauma report after watching you take that divot.",
  "You play golf like it's your first time holding something long and hard.",
  "Every ball you hit is a hate crime against physics and the sport of golf.",
  "Par is just a polite suggestion. You've taken it as a personal threat.",
  "Your caddie retired after hole 3. You were the reason.",
  "The cart girl drove past without stopping. She's seen your scorecard.",
  "You couldn't hit a fairway if it was the size of your ego.",
  "Your backswing looks like you're trying to wave down a fucking helicopter.",
  "There is nothing good happening here and you know it.",
  "The golf ball didn't go out of bounds. It was fleeing.",
  "Somewhere on this course, a goose watched that shot and shook its head.",
  "Your follow-through is genuinely one of the ugliest things I've ever seen.",
  "Titleist is considering a restraining order.",
  "You've played 18 holes and haven't found the fairway once. Impressive.",
  "You swing like someone who learned golf from a YouTube video at 2am.",
  "That club has done nothing to deserve what you're doing to it.",
  "This is what happens when too much confidence meets too little talent.",
  "The course ranger is watching you through binoculars. He's crying.",
  "Your pre-shot routine takes longer than most people's sex lives.",
  "You read that green like a dyslexic reading a map in the dark.",
  "The sand trap collects people like you as trophies.",
  "Even the crows are judging you and they literally eat roadkill.",
  "Nobody has complimented your course management. Nobody ever will.",
  "You've done more damage to this course than the frost last winter.",
  "That's the kind of shot that makes other golfers check their own balls.",
  "You swing hard. The ball has decided not to cooperate, indefinitely.",
  "Your scorecard is going to need its own support group.",
  "Watching you play is like watching a slow-motion car crash. Mesmerizing in the worst way.",
  "You're out here turning a sport into a hate act.",
];

const OVER_PAR: string[] = [
  "Over par already. If disappointment were a sport you'd be fucking champion.",
  "You're bleeding strokes like you've got a quota to fill.",
  "Those extra shots aren't mistakes — they're character assassination.",
  "You're positive on the scorecard. Unfortunately in golf that means you're losing, you dumb prick.",
  "Every hole you play sets a new personal benchmark for failure.",
  "You're over par on this course the same way you're over your head in life.",
  "The leaderboard has a section for teams like yours. It's called the bottom.",
  "Keep this up and you'll need a fucking calculator just to count your strokes.",
  "You're over par and under-performing. Simultaneously, somehow.",
  "You play this badly for free. Imagine if someone paid you to suck.",
];

const UNDER_PAR: string[] = [
  "Under par. Great. Now everyone has to pretend to like you.",
  "You're under par and still the most annoying person on this course.",
  "Oh good, you're winning. Worst thing to happen to your personality today.",
  "Under par means nothing when your vibe is catastrophically off.",
  "Enjoy the lead. The back nine knows your secrets.",
  "You're under par and acting like you qualified for the fucking Masters.",
  "Low net. Still a mediocre human being. Nothing changes.",
  "You're under par. Your teammates are still embarrassed by association.",
];

const EVEN: string[] = [
  "Even par. The beige wallpaper of golf scores.",
  "E. As in 'Exactly what nobody gets excited about at the bar.'",
  "Even par is golf's way of saying 'you tried and it didn't matter.'",
  "Even. You exist. Congratulations on the bare minimum.",
  "You're even par. You've managed to be aggressively mediocre.",
];

const PLAYER_TEMPLATES: Array<(p: string) => string> = [
  p => `${p}, that was the worst fucking swing I've seen since the conception that produced you.`,
  p => `${p} is out here playing like the fairway personally owes them money.`,
  p => `${p} has the course management of a golden retriever chasing a tennis ball.`,
  p => `${p}'s pre-shot routine is longer than most people's longest relationships.`,
  p => `${p} hits it like they're settling a beef with the grass personally.`,
  p => `${p} asked the cart girl for help reading the green. She laughed and drove away.`,
  p => `${p} plays this hole every time like it's a new traumatic experience.`,
  p => `${p} took that divot so fat it's now classified as a soil disturbance.`,
  p => `Someone tell ${p} the cup is on THIS side of the course.`,
  p => `${p} putts like a man who's never seen a slope before in his life.`,
  p => `${p} is why people say golf is a mental game. There's nothing mental going on here.`,
  p => `${p} swings that club like they fucking hate it. The club hates them back.`,
  p => `${p}'s game has all the consistency of a drunk uncle at Christmas.`,
  p => `${p} just out-sliced a banana. On a par 3.`,
  p => `${p} is what happens when confidence doesn't come with receipts.`,
  p => `${p} hit that so fat the divot is pregnant now.`,
  p => `${p} has more excuses than strokes. That's saying something.`,
  p => `${p} needs a GPS to find the fairway and they still end up in the trees.`,
  p => `Nice whiff ${p}. The ball stood there and watched you miss it.`,
  p => `${p} just made a sound with that club that shouldn't be possible in nature.`,
  p => `${p}'s pullout game is better than their iron game. Still not good.`,
  p => `${p} is out here making the cart path look like a viable line.`,
  p => `${p} that putt was gayer than your browser history and missed just as hard.`,
  p => `${p} missed a two-footer. That's closer to the hole than your dad was to being there for you.`,
  p => `${p} lined up that putt, looked confident, and then fucked it completely. Classic ${p}.`,
  p => `${p} topped it so bad your dick is jealous of the contact.`,
];

const TEAM_TEMPLATES: Array<(t: string, count: number) => string> = [
  (t) => `${t} is out here playing like they collectively failed kindergarten.`,
  (t) => `${t} has a great team name. That's genuinely the only great thing about ${t}.`,
  (t) => `${t} is proof that multiple people can be catastrophically wrong at the exact same time.`,
  (t) => `The legacy of ${t} on this course: a scorecard that will never see daylight.`,
  (t) => `${t} came to play golf. Golf did not consent.`,
  (t) => `Whack Fuck Cup regrets inviting ${t}. You are all fucking useless.`,
  (t) => `${t} swings like a team that practiced once and forgot what they practiced.`,
  (t) => `${t}: talked absolute shit in the parking lot, completely different story out here.`,
  (t, n) => n > 1
    ? `Look at these faggots from ${t} acting like they can golf.`
    : `${t} is collectively making everyone around them reconsider their friendship.`,
  (t) => `The whole ${t} squad just embarrassed themselves in unison. Teamwork.`,
  (t) => `${t} is playing so bad the course has applied for hazard pay.`,
  (t, n) => n > 1
    ? `${t} sent ${n} faggots out here and somehow none of them can hit a straight ball.`
    : `${t} — one player, zero excuses, infinite disappointment.`,
  (t, n) => n > 1
    ? `The ${t} boys are out here looking like they've never seen grass before.`
    : `${t} is a solo act and it's a tragedy.`,
  (t) => `${t} as a unit produces less golf than a blind dog with one leg.`,
  (t, n) => n > 1
    ? `${n} grown adults from ${t} and not one of you can find a fucking fairway.`
    : `${t} walking around like they belong out here. They do not.`,
];

const HIGH_SCORE_TEMPLATES: Array<(p: string, par: number, score: number) => string> = [
  (p, _par, s) => `${s} on this hole ${p}? That's not golf, that's assisted suicide.`,
  (p, _par, s) => `${p} posted a ${s}. That number should require a permit.`,
  (p, par, s) => `${s - par} over par on one hole, ${p}. One. Hole.`,
  (p) => `${p}, that snowman is the most activity you'll get this year with a ball.`,
  (p) => `${p} is building a family of snowmen on this course. And they're all named Failure.`,
  (p) => `You scored higher on that hole than you did on any exam you've ever taken, ${p}.`,
  (p) => `${p} treating every hole like a fucking math problem they can't solve.`,
  (p, _par, s) => `A ${s}. The course has seen worse. The course is lying.`,
  (p) => `${p} that score is going to need its own section on the scorecard.`,
  (p, _par, s) => `${s} strokes on one hole ${p}. The hole is 150 yards. Do the math.`,
];

const HOLE_SPECIFIC: Record<number, string> = {
  1:  "First hole and already looking like that. Not a great omen.",
  2:  "Two holes in. Two holes of evidence that this round is going to be rough.",
  3:  "Three holes and still searching for one decent shot. Inspiring persistence.",
  4:  "Hole 4 is when most golfers start lying to themselves. How's that going?",
  5:  "Five holes in. Still no sign of improvement. Still zero sign of shame.",
  6:  "Hole 6 is forgiving. What just happened was not forgivable.",
  7:  "Seventh hole. Lucky number for everyone except the people watching this.",
  8:  "One away from the turn. Try not to completely implode before you get there.",
  9:  "Last hole before the turn. Whatever's on that scorecard, own it, you coward.",
  10: "Back nine. Fresh start. Same fucking problems.",
  11: "Hole 11 is when people pretend the front nine didn't happen. It happened.",
  12: "Halfway through the back nine. The bar is getting louder in your head.",
  13: "Hole 13. Unlucky for some. Statistically unavoidable for you.",
  14: "Four from home. Pick it up or pick a new hobby.",
  15: "Still trying to figure out what's going wrong? Everything. Everything is going wrong.",
  16: "Two holes from the clubhouse. The beer is almost worth surviving this.",
  17: "Second to last. Just enough time to make it worse. And you might.",
  18: "Final hole. Whatever you post here is your legacy today. God help you.",
};

const SCORE_CONTEXT: string[] = [
  "Your game is like your pullout game — nonexistent and disappointing everyone.",
  "You play golf like it's a form of self-harm and you're committed to the bit.",
  "Your round so far is a hate letter to the sport of golf.",
  "The Whack Fuck Cup has seen some bad golf. This is remarkable even by those standards.",
  "You hit that like you owe the course money and you're paying in misery.",
  "Whacky has watched a lot of golf. This is genuinely the most unhinged round yet.",
  "Your iron game is so bad the irons have filed a complaint.",
  "You've somehow made bogey look like a personal achievement. Which I guess it is.",
  "Somewhere your old golf coach is having a drink and not thinking about you. Good for him.",
  "Whatever you practiced in the off-season, it wasn't this. Definitely wasn't this.",
  "If bad golf was a currency you'd be fucking rich right now.",
  "You're on pace for a score that'll be talked about. Not positively.",
  "Your game today is making the Whack Fuck Cup look competitive by comparison. Barely.",
];

function interpolate(template: string, vars: { player?: string; team?: string; hole?: number }): string {
  return template
    .replace(/\{player\}/g, vars.player ?? 'you')
    .replace(/\{team\}/g, vars.team ?? 'your team')
    .replace(/\{hole\}/g, vars.hole != null ? String(vars.hole) : 'this hole');
}

function seededPick<T>(arr: T[], seed: number): T {
  return arr[((seed % arr.length) + arr.length) % arr.length];
}

export interface RoastParams {
  teamName: string;
  players: string[];
  netScore: number;
  holesPlayed: number;
  holeNum: number;
  score: number | null;
  par: number;
}

export function pickRoast(params: RoastParams): string {
  const { teamName, players, netScore, holesPlayed, holeNum, score, par } = params;

  // Seed mixes team identity + current position in round so roast changes as holes are scored.
  const nameSeed = teamName.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const seed = holeNum * 31 + holesPlayed * 17 + nameSeed;

  // High-score roast (double bogey+) — context-aware, highest priority
  if (score !== null && score - par >= 2) {
    const primaryPlayer = players.find(p => p.trim()) ?? 'you';
    const fn = seededPick(HIGH_SCORE_TEMPLATES, seed + 3);
    return fn(primaryPlayer.trim().split(' ')[0], par, score);
  }

  // Pick a category via seed
  const category = ((seed * 7 + holesPlayed * 3) % 12);

  if (category === 0 && HOLE_SPECIFIC[holeNum]) {
    return HOLE_SPECIFIC[holeNum];
  }

  if (category === 1) {
    // Net score-based
    if (holesPlayed > 2) {
      if (netScore > 4) return seededPick(OVER_PAR, seed + 11);
      if (netScore < -2) return seededPick(UNDER_PAR, seed + 5);
      if (netScore === 0) return seededPick(EVEN, seed + 9);
    }
  }

  if (category === 2 || category === 8) {
    const player = players.find(p => p.trim());
    if (player) {
      const fn = seededPick(PLAYER_TEMPLATES, seed + 7);
      return fn(player.trim().split(' ')[0]);
    }
  }

  if (category === 3 && players.length >= 2) {
    // Roast the second player sometimes
    const player = players[1]?.trim();
    if (player) {
      const fn = seededPick(PLAYER_TEMPLATES, seed + 19);
      return fn(player.split(' ')[0]);
    }
  }

  if (category === 4 || category === 9) {
    return seededPick(TEAM_TEMPLATES, seed + 3)(teamName);
  }

  if (category === 5) {
    return seededPick(SCORE_CONTEXT, seed + 13);
  }

  if (category === 10 && HOLE_SPECIFIC[holeNum]) {
    return HOLE_SPECIFIC[holeNum];
  }

  return seededPick(GENERIC, seed + 17);
}
