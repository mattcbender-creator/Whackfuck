import { HOLES } from './holes';

export function pickChirp(scores: (number | null)[], netScore: number): string {
  let worstIdx = -1;
  let worstDiff = -999;
  let tripleCount = 0;
  let birdieCount = 0;
  let bogeyCount = 0;
  let doubleCount = 0;

  scores.forEach((s, i) => {
    if (s === null) return;
    const diff = s - HOLES[i].par;
    if (diff >= 3) tripleCount++;
    if (diff === 2) doubleCount++;
    if (diff === 1) bogeyCount++;
    if (diff === -1) birdieCount++;
    if (diff > worstDiff) { worstDiff = diff; worstIdx = i; }
  });

  const wh = worstIdx >= 0 ? HOLES[worstIdx] : null;
  const ws = worstIdx >= 0 ? scores[worstIdx] as number : 0;
  const rnd = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

  if (netScore <= -4) return rnd([
    `${netScore}?? Absolutely fucking not. Who was marking your card — your wife? Your dog? The guy who owes you money? This is getting audited.`,
    `${Math.abs(netScore)} under par. Congratulations, you cheating piece of shit. We all saw you kick that ball on hole 7.`,
    `${netScore} net. Beautiful. Stunning. Completely made up. Hand over the scorecard — we're counting again from scratch.`,
    `${Math.abs(netScore)} under? Sure. And I've got oceanfront property in Saskatchewan. Absolutely cooked the math on this one.`,
    `${netScore}. You played like a man with nothing to lose and everything to falsify. Remarkable. Suspicious. Both.`,
    `${Math.abs(netScore)} under par at the WFC?? I've seen you golf. I've watched you golf. This does not add up. What did you do with the real scorecard?`,
    `${netScore} net. The committee is convening. Bring receipts. Bring witnesses. Bring a lawyer.`,
  ]);

  if (netScore <= -2) return rnd([
    `${netScore}. Not bad. Too good, actually. We're watching you. Both of you.`,
    `${Math.abs(netScore)} under par. Impressive. Almost too impressive. A recount has been requested by several teams.`,
    `${netScore} net. That's the score of a man who either played great golf or found a very creative pencil. We'll never know.`,
    `${Math.abs(netScore)} under. Look at the big brain on you. Or the light hand on the pencil. Hard to say.`,
    `${netScore}. Two under. The boys are impressed. The boys are also suspicious. The boys contain multitudes.`,
    `That's a legit score. Genuinely. Fucking hate it. Well played, you smug bastard.`,
  ]);

  if (netScore === -1) return rnd([
    `One under. One! That's real golf. We're adding a stroke for the one time you definitely grounded your club in a hazard on 14.`,
    `${netScore}. Under par at the WFC. Your dad would be proud. Your golf game is still a mess but you scraped it together today.`,
    `One under par. Honestly solid. We still think you moved the ball on hole 11 but we can't prove it.`,
    `−1. You hung in there. Like a bad smell. Like a guy who refuses to admit he's lost the bet. Respect.`,
  ]);

  if (netScore === 0) return rnd([
    `Even par. You are perfectly, magnificently, aggressively mediocre. Frame this scorecard and hang it in the bathroom.`,
    `E. Right down the middle. The Switzerland of golf scores. No commitment to being good or bad. Just even. God, how boring.`,
    `Even par. That's the score of a man who peaked today and knows it. This is the highlight reel.`,
    `Even par at the WFC. You're not a golfer, you're a golf-shaped person. But today? Even. Take it and shut up about it.`,
    `E. As in "Exactly what everyone expected from someone with your swing." Technically fine. Deeply uninspiring.`,
  ]);

  if (netScore === 1) return rnd([
    `+1. One fucking stroke. You had 18 swings at par and couldn't find one more birdie. Absolutely brutal. Go home.`,
    `One over. Par was RIGHT THERE. You could smell it. You reached out and it slapped your hand away. Tragic.`,
    `+1. That's the score of a man who almost gave a shit but ran out at hole 17. So close. So fucking close.`,
    `One over par. You know what's worse than shooting +10? Shooting +1. Because you KNOW. You'll think about this tonight.`,
  ]);

  if (netScore === 2) return rnd([
    `+2. You left two strokes on the course like a twenty on a bar — just sitting there, yours for the taking. Gone.`,
    `Two over. Statistically, you birdied nothing meaningful and bogeyed everything that mattered. Classic.`,
    `+2. The heartbreak special. You were RIGHT THERE and you blew it not once, but twice. Outstanding.`,
    `Two over par. Bold of you to show up to the leaderboard with a +2 and make eye contact with people.`,
  ]);

  if (wh && worstDiff >= 5) return rnd([
    `A ${ws} on hole ${wh.hole}?? That's not golf, that's a criminal investigation. The "${wh.ruleName}" rule didn't do that to you — YOU did that to you.`,
    `Hole ${wh.hole}, par ${wh.par}, you made ${ws}. Five over on one fucking hole. The marshals are still out there looking for balls. Plural.`,
    `${ws} on hole ${wh.hole}. Your playing partners didn't say anything at the time but they haven't made eye contact with you since.`,
    `The incident on hole ${wh.hole} will not be discussed. Not today. Not ever. The number ${ws} dies in this room.`,
    `You scored ${ws} on a par ${wh.par}. On hole ${wh.hole}. The groundskeeper is pressing charges.`,
  ]);

  if (wh && worstDiff === 4) return rnd([
    `A ${ws} on hole ${wh.hole}? That's not a golf score, that's a cry for help. "${wh.ruleName}" wasn't the rule that got you — you got yourself.`,
    `Hole ${wh.hole}, par ${wh.par}. You made ${ws}. The marshal is filing paperwork. There may be legal consequences.`,
    `${ws} on hole ${wh.hole}?? The ball was eventually found. Your dignity was not.`,
    `Hole ${wh.hole} ("${wh.ruleName}") is seeking a restraining order. A ${ws} on a par ${wh.par} is not a golf score, it's a war crime.`,
    `Four over on one hole. On hole ${wh.hole}. You absolute fucking disaster. The course has feelings and you hurt them.`,
  ]);

  if (wh && worstDiff === 3) return rnd([
    `Triple bogey on hole ${wh.hole}. "${wh.ruleName}" — clearly a rule you treated as a suggestion.`,
    `A ${ws} on hole ${wh.hole}, par ${wh.par}. The groundskeeper watched in real time and quietly wept.`,
    `Hole ${wh.hole} — you turned a par ${wh.par} into a ${ws}. At least you're consistently shit about it.`,
    `The flag on hole ${wh.hole} was just a suggestion. You saw it, nodded, and then took three more shots anyway.`,
    `${ws} on hole ${wh.hole}. That's a triple. In an 18-hole tournament. With actual people watching. Ballsy.`,
    `Par ${wh.par} on hole ${wh.hole} and you made ${ws}. That is a personal failure we will all carry with us.`,
  ]);

  if (tripleCount >= 4) return rnd([
    `${tripleCount} triples or worse. You didn't play golf today — you committed ${tripleCount} separate assaults on par.`,
    `${tripleCount}x triple bogey. The course needs therapy. You owe the greens an apology card.`,
    `Four or more triples at the WFC. That's not a round, that's a nature documentary. Survival of the fittest and you were not fit.`,
    `${tripleCount} triples. Astounding. Historically bad. You should frame this scorecard.`,
  ]);

  if (tripleCount >= 2) return rnd([
    `${tripleCount} triple bogeys. You didn't play the course — the course played you, beat you, and took your lunch money.`,
    `Two or more triples in a WFC round. That's not bad luck, that's a pattern. A deeply troubling pattern.`,
    `${tripleCount} triples. Somewhere out there, a golf cart is weeping into its steering wheel.`,
  ]);

  if (netScore >= 15) return rnd([
    `+${netScore}? Jesus fucking Christ. That scorecard looks like a receipt from a very bad Vegas weekend.`,
    `+${netScore} net. That's not a golf score, that's a blood pressure reading. See a doctor.`,
    `You shot +${netScore}. The course FEELS BAD for you. Not bad enough to give you a stroke back, but emotionally, it's struggling.`,
    `+${netScore}. At some point today you were just hitting balls into the void and hoping something would improve. It didn't.`,
    `+${netScore}. Your cart GPS routed you directly into every hazard on this course and you just went with it. Every. Time.`,
    `${netScore} over par. That's a score you tell people is "+${netScore - 5} with some bad luck" at the bar. We will not be allowing that.`,
  ]);

  if (netScore >= 12) return rnd([
    `+${netScore}. Truly. Genuinely. An impressive commitment to losing.`,
    `+${netScore} net. You played every single hole like it had personally wronged you and your family.`,
    `The pro shop called. They're not banning you — they just need some time apart.`,
    `+${netScore}. At least you finished. You absolute hero. You crossed the finish line of a race no one else was running that badly.`,
    `+${netScore}. Your ball spent more time in the rough than a squirrel. Just live there. Set up a tent.`,
    `+${netScore}?? Did you play golf today or just commit ${netScore} crimes against the sport?`,
  ]);

  if (netScore >= 8) return rnd([
    `+${netScore}. Not a disaster. Just a very, very confident mediocrity. Hats off to the audacity.`,
    `+${netScore} net. You had moments out there. None of them were good moments, but you had them.`,
    `+${netScore}. The good news is nobody's gonna chirp you too hard at the bar. The bad news is that's because they pity you.`,
    `+${netScore}. You gave it everything you had. Golf looked at everything you had and said "not enough, buddy."`,
    `+${netScore}. A classic WFC performance. Showed up, swung hard, accomplished very little. The true spirit of this tournament.`,
    `+${netScore} net. At least you didn't quit. You stayed out there, with your dignity, and threw it into the rough on every hole.`,
  ]);

  if (netScore >= 5) return rnd([
    `+${netScore}. Not bad. Not good. The beige of golf scores. The plain yogurt. The mid Tuesday of a round.`,
    `+${netScore}. You almost sniffed par. Par smelled you coming and moved away.`,
    `Look at you — +${netScore} and thinking about what might've been. You bogey'd everything that mattered. Proud of yourself?`,
    `+${netScore} net. The round you describe as "actually not bad" after your third beer. It was bad. We were there.`,
    `+${netScore}. Respectable. Ish. We're being generous with "respectable." The correct word might be "tolerable."`,
    `+${netScore}. You played ${bogeyCount} bogeys and ${doubleCount} doubles and acted surprised at the end. Classic.`,
  ]);

  if (netScore >= 3) return rnd([
    `+${netScore}. You almost had it. Almost. The word "almost" is doing so much heavy lifting right now.`,
    `+${netScore}. Look at you, fighting for the lower half of the leaderboard with your whole chest. Inspiring, kind of.`,
    `+${netScore} net. You're telling people you shot even next year and we will not be able to stop you.`,
    `+${netScore}. The round where everything that could go slightly wrong, did. You're not bad. You're just reliably disappointing.`,
    `Three over par. You know what you needed? One birdie. One. You had 18 chances. ${birdieCount > 0 ? `You found ${birdieCount} and then gave it all back.` : 'You found zero. Not one. Remarkable.'}`,
  ]);

  return rnd([
    `${netScore > 0 ? '+' : ''}${netScore}. A round of golf was played today. We'll leave it at that.`,
    `${netScore > 0 ? '+' : ''}${netScore}. The course has seen worse. Not much worse, but worse.`,
    `${netScore > 0 ? '+' : ''}${netScore} net. You were out there. We'll give you that. You were definitely out there.`,
  ]);
}
