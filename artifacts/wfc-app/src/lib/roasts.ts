// Brutal WFC roast engine — no limits, no mercy.
// Roasts are picked deterministically per (holeNum, teamName) so they stay
// stable while you're on a hole and change when you move to the next one.

const GENERIC: string[] = [
  "The groundskeeping staff found one of your divots and reported it to the EPA.",
  "You swing like you're trying to high-five someone behind you.",
  "Golf courses have a dress code to keep out people who look like they play like you.",
  "Your caddie quit. He left a note: 'I have dignity.'",
  "Somewhere out there, a driving range is wondering where their worst customer went.",
  "The ball has been in play for 3 minutes. The ball is also embarrassed.",
  "Par is a suggestion. You've taken it as a personal threat.",
  "You're the reason golfers drink.",
  "Titleist is considering a restraining order.",
  "The cart path has more fairway time than your ball does.",
  "Your grip is so wrong the club is filing a complaint with HR.",
  "You've convinced yourself the slice is 'your shot shape.' It's not.",
  "The course ranger is watching you. He's crying.",
  "You shoot like you owe par money.",
  "Your pre-shot routine takes longer than the average human pregnancy.",
  "There's a lost and found at the pro shop. It's full of your dignity.",
  "You're playing this hole like it owes you money. It doesn't.",
  "A 9-year-old at a birthday golf party just outdrew you. Twice.",
  "The GPS on the cart keeps rerouting because it gave up trying to predict where you're going.",
  "You're the reason people put 'golf' in air quotes.",
  "Every ball you hit is a hate crime against physics.",
  "Your follow-through looks like you're flagging down an Uber.",
  "Scientists studying your swing have a new name for it: a controlled disaster.",
  "You're an inspiration. Proof that confidence and competence don't always travel together.",
  "Water hazards see you coming and get excited.",
  "Three-putting is a choice. A bad one. But yours.",
  "The hole is 4 inches wide. You've managed to miss it from 2 feet. Incredible.",
  "Your putt read the green, saw the line, and still went somewhere else out of spite.",
  "You're playing scramble rules in your head even when you're not.",
  "The flag is waving. It's waving goodbye to your ball.",
  "You'd play better blindfolded. Worth trying.",
  "This hole has a handicap. It's you.",
  "Your iron play has all the consistency of a drunk uncle at Christmas.",
  "Bogey is just par with extra steps, right? That's what you're going with?",
  "A sand trap is not a suggestion. You treat it like a second home.",
  "That wasn't a shank. That was a shank. Don't lie to yourself.",
  "The bunker raked itself after you left. Out of respect for what it survived.",
  "You told your playing partners you'd been working on your short game. They believed you. They won't again.",
  "Your scorecard should come with a trigger warning.",
  "The 19th hole is calling. It's saying get there faster.",
  "You're playing like someone who discovered golf this morning. Respect for the enthusiasm.",
  "Your takeaway is perfect. The rest of it is a crime scene.",
  "Even the seagulls are judging you and they eat garbage for a living.",
  "Par-3 holes are supposed to be relaxing. You've made this one traumatic.",
  "You've managed to make a 300-yard hole feel like a personal quest.",
  "You play golf like it's a team sport and your team let you down.",
  "Nobody has ever complimented your course management. Nobody ever will.",
];

const OVER_PAR: string[] = [
  "Over par already? Genuinely impressive dedication to failure.",
  "You're not having a bad round — you're crafting an origin story.",
  "Those extra strokes aren't mistakes. They're character development.",
  "You're in positive territory. Unfortunately in golf that's bad.",
  "The leaderboard isn't laughing at you. But we are.",
  "This is what they mean when they say 'the course won today.'",
  "You could blame equipment. Go ahead. We'll wait.",
  "Your net score is positive and so is the chance you finish last.",
  "At least you're consistent. Consistently over par, but still.",
  "This round is going to haunt you. Good. It should.",
];

const UNDER_PAR: string[] = [
  "Under par and still insufferable. Impressive.",
  "Oh great, you're actually good. Worst kind of golf partner.",
  "You're under par. Don't you dare celebrate yet.",
  "Enjoy the lead. The back nine is waiting.",
  "Low net score — your teammates are carrying you emotionally even if not on the scorecard.",
  "Somehow you're under par. Carry that guilt with you to the next tee.",
  "You're winning and you're still annoying about it.",
  "Under par. Fine. But your outfit is still inexcusable.",
];

const EVEN: string[] = [
  "Even par. The most mediocre achievement in golf. Congratulations.",
  "E. As in 'Exactly what nobody brags about at the bar.'",
  "Even par is just failure with extra steps to get there.",
  "Perfectly average. The Switzerland of golf scores.",
  "Even par is the golf equivalent of 'not bad, not good, just... there.'",
];

const PLAYER_TEMPLATES: Array<(name: string) => string> = [
  n => `${n} is out here playing like the fairway personally offended them.`,
  n => `${n}'s pre-shot routine is longer than most people's commutes.`,
  n => `${n} hits it like they're settling a grudge with the grass.`,
  n => `${n} asked the caddie for advice and then ignored it. Classic ${n}.`,
  n => `${n} has played this hole before. You'd never know it.`,
  n => `${n} is what happens when confidence outpaces talent by a significant margin.`,
  n => `${n} read the green like they were deciphering a foreign language.`,
  n => `${n} swings hard. The ball has decided not to cooperate.`,
  n => `Tell ${n} the cup is on this side of the course. They'll aim the other way.`,
  n => `${n} is playing like someone bet against them. Maybe they did.`,
  n => `${n} plays like they've seen golf on TV and thinks that's enough.`,
  n => `${n} putting is performance art. Terrible performance art.`,
];

const TEAM_TEMPLATES: Array<(name: string) => string> = [
  n => `The ${n} team: brave enough to show up, not good enough to back it up.`,
  n => `${n} has a great name. That's the only great thing about ${n}.`,
  n => `${n} is out here making it look hard. It shouldn't be this hard.`,
  n => `${n} is proving today that there's no correlation between attitude and ability.`,
  n => `The legacy of ${n}: a scorecard that will never see the light of day.`,
  n => `${n} is playing with heart. Heart doesn't fix a shank.`,
  n => `${n} — a team name, a dream, and a collective 47 over par.`,
  n => `${n}: talked a big game in the parking lot, different story out here.`,
];

const HOLE_SPECIFIC: Record<number, string> = {
  1:  "First hole jitters are normal. This? This is not normal.",
  2:  "Two holes in and already looking for someone to blame.",
  3:  "Three holes down. Fifteen more chances to keep embarrassing yourself.",
  4:  "Hole 4. Statistically this is when most golfers consider therapy.",
  5:  "Quarter way done. Whatever you were planning to do differently hasn't kicked in yet.",
  6:  "Hole 6 is forgiving. It won't forgive this.",
  7:  "Lucky 7. Doesn't feel that lucky, does it.",
  8:  "Hole 8. One away from the turn. Try not to implode before then.",
  9:  "This is the last hole before anyone has to say the words 'nine-hole score.'",
  10: "Back nine. Fresh start. Same problems.",
  11: "Hole 11 is when people pretend the front nine didn't happen.",
  12: "Halfway through the back nine. The bar can almost be smelled from here.",
  13: "Hole 13. Unlucky for some. Lucky for none of you specifically.",
  14: "Four holes from home. Pick it up or pick a different sport.",
  15: "Hole 15 and still trying to figure out what's going wrong. Everything. Everything is going wrong.",
  16: "Two away from the clubhouse. Don't think about it.",
  17: "Second to last. The cruelest hole in golf — just enough time to blow it.",
  18: "Last hole. Whatever score you post here, you earned it. God help you.",
};

function seededPick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
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
  const { teamName, players, netScore, holesPlayed, holeNum, score } = params;

  // Build a deterministic seed from the hole + team name so it's stable on this hole.
  const nameSeed = teamName.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const seed = holeNum * 31 + nameSeed;

  // Decide which category to pull from using the seed.
  const category = seed % 10;

  if (category === 0 && HOLE_SPECIFIC[holeNum]) {
    return HOLE_SPECIFIC[holeNum];
  }

  if (category === 1 && players.length > 0) {
    const player = players[seed % players.length];
    if (player && player.trim()) {
      return seededPick(PLAYER_TEMPLATES, seed + 7)(player.trim().split(' ')[0]);
    }
  }

  if (category === 2) {
    return seededPick(TEAM_TEMPLATES, seed + 3)(teamName);
  }

  if (category <= 4) {
    if (holesPlayed > 0) {
      if (netScore > 3) return seededPick(OVER_PAR, seed + 11);
      if (netScore < -2) return seededPick(UNDER_PAR, seed + 5);
      if (netScore === 0) return seededPick(EVEN, seed + 9);
    }
  }

  // Score on current hole if entered
  if (score !== null) {
    const diff = score - params.par;
    if (diff >= 3) return "That's an obscene number of strokes on one hole. Take a moment.";
    if (diff === 2) return "Double bogey. The golf equivalent of showing up late and also forgetting your pants.";
  }

  return seededPick(GENERIC, seed + 17);
}
