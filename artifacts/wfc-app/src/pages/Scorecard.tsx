import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useWFC } from '@/lib/store';
import { HOLES } from '@/lib/holes';
import { fireEagleConfetti, fireBirdieConfetti } from '@/lib/confetti';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Minus, Plus, RefreshCw, Info, ChevronLeft, ChevronRight, Sparkles, Lock, Trophy, X } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import WheelModal from '@/components/WheelModal';
import { getWheelItem } from '@/lib/wheel';

type Half = 'front' | 'back';

function fmtNet(diff: number) {
  if (diff === 0) return 'E';
  return diff > 0 ? `+${diff}` : `${diff}`;
}

function netCls(diff: number | null) {
  if (diff === null) return 'text-muted-foreground/30';
  if (diff <= -2) return 'text-yellow-400 font-bold';
  if (diff === -1) return 'text-primary font-bold';
  if (diff === 0) return 'text-foreground/80';
  if (diff === 1) return 'text-orange-400';
  return 'text-red-500 font-bold';
}

function scoreLabel(diff: number | null) {
  if (diff === null) return '';
  if (diff <= -2) return 'EAGLE';
  if (diff === -1) return 'BIRDIE';
  if (diff === 0) return 'PAR';
  if (diff === 1) return 'BOGEY';
  if (diff === 2) return 'DOUBLE';
  return `+${diff}`;
}

function ordinal(n: number): string {
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}

function pickChirp(scores: (number | null)[], netScore: number): string {
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

  // ── GREAT SCORES: accuse them of cheating / question integrity ──
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

  // ── Hole-specific catastrophic chirps ──
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

  // ── Multiple triples ──
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

  // ── Score tiers — bad ──
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

  // Fallback (shouldn't reach here but just in case)
  return rnd([
    `${netScore > 0 ? '+' : ''}${netScore}. A round of golf was played today. We'll leave it at that.`,
    `${netScore > 0 ? '+' : ''}${netScore}. The course has seen worse. Not much worse, but worse.`,
    `${netScore > 0 ? '+' : ''}${netScore} net. You were out there. We'll give you that. You were definitely out there.`,
  ]);
}

export default function Scorecard() {
  const {
    teamId, teamInfo, scores, currentTee, netScore, holesPlayed, setScore,
    frontNineConfirmed, wheelSpin, confirmFrontNine, targetedBy, listTeamsOnce, logEvent,
  } = useWFC();
  const [, setLocation] = useLocation();
  // Default to the first unscored hole so the scorecard opens on the hole
  // the user is actually playing — not always hole 1.
  const initialIdx = (() => {
    const idx = scores.findIndex(s => s === null);
    if (idx === -1) return 17;
    return Math.min(idx, 17);
  })();
  const [half, setHalf] = useState<Half>(initialIdx >= 9 ? 'back' : 'front');
  const [selectedIdx, setSelectedIdx] = useState(initialIdx);
  const [activeRule, setActiveRule] = useState<typeof HOLES[number] | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [wheelOpen, setWheelOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(() => {
    try { return localStorage.getItem('wfc-submitted') === 'true'; } catch { return false; }
  });
  const [finishPosition, setFinishPosition] = useState<number | null>(null);
  const [finishLoading, setFinishLoading] = useState(false);
  const [finishChirp, setFinishChirp] = useState('');
  const [totalTeams, setTotalTeams] = useState(0);
  const { toast } = useToast();

  // Clear submitted flag if admin resets and team is wiped
  useEffect(() => {
    if (!teamInfo) {
      setHasSubmitted(false);
      try { localStorage.removeItem('wfc-submitted'); } catch { /* ignore */ }
    }
  }, [teamInfo]);

  // Note: front-9 lock happens INSIDE the wheel modal when the user actually
  // taps "Spin Item Box". Until that moment they can dismiss the modal and
  // edit their front-9 scores.

  const front9Complete = scores.slice(0, 9).every(s => s !== null);
  const spunItem = getWheelItem(wheelSpin?.item);

  const offset = half === 'front' ? 0 : 9;
  const halfHoles = HOLES.slice(offset, offset + 9);
  const halfScores = scores.slice(offset, offset + 9);

  // Running cumulative to-par within this half
  let running = 0;
  const cumNets: (number | null)[] = halfHoles.map((h, i) => {
    const s = halfScores[i];
    if (s === null) return null;
    running += s - h.par;
    return running;
  });

  const halfTotalPar = halfHoles.reduce((a, h) => a + h.par, 0);
  const halfTotalYds = halfHoles.reduce((a, h) => a + (currentTee === 'tips' ? h.tips : h.womens), 0);
  const halfPlayedScore = halfHoles.reduce((a, h, i) => halfScores[i] !== null ? a + (halfScores[i] as number) : a, 0);
  const halfPlayedPar = halfHoles.reduce((a, h, i) => halfScores[i] !== null ? a + h.par : a, 0);
  const halfNet = halfPlayedPar > 0 ? halfPlayedScore - halfPlayedPar : null;
  const halfHolesPlayed = halfHoles.filter((_, i) => halfScores[i] !== null).length;

  const selHole = HOLES[selectedIdx];
  const selScore = scores[selectedIdx];
  const selDiff = selScore !== null ? selScore - selHole.par : null;

  // Sync selected half with selectedIdx
  useEffect(() => {
    if (selectedIdx < 9 && half !== 'front') setHalf('front');
    if (selectedIdx >= 9 && half !== 'back') setHalf('back');
  }, [selectedIdx, half]);

  // Front 9 is locked once the team has confirmed (so they can't edit after spinning).
  const isHoleLocked = (idx: number) => frontNineConfirmed && idx < 9;
  const selLocked = isHoleLocked(selectedIdx);

  // First hole that hasn't been scored yet (0-17). 18 means all scored.
  const firstUnscoredIdx = scores.findIndex(s => s === null);
  const firstUnscored = firstUnscoredIdx === -1 ? 18 : firstUnscoredIdx;

  // Gate any attempt to move into the back 9 — must spin the Item Box first.
  const tryGoToBack = (targetIdx: number): boolean => {
    if (!front9Complete) {
      toast({
        title: 'Finish the front 9 first',
        description: 'Enter scores for all 9 front holes before moving on.',
        variant: 'destructive',
      });
      return false;
    }
    if (!wheelSpin) {
      // Just open the wheel. Locking happens inside the modal when they actually spin.
      setWheelOpen(true);
      return false;
    }
    setSelectedIdx(targetIdx);
    return true;
  };

  const handleChange = (delta: number) => {
    if (selLocked) return;
    // STRICT IN-ORDER: cannot enter a score for a hole when any prior hole is
    // still blank. Snap them back to the first unscored hole and tell them.
    if (selectedIdx > firstUnscored) {
      toast({
        title: `Score hole ${firstUnscored + 1} first`,
        description: 'Enter scores in order — no skipping holes.',
        variant: 'destructive',
      });
      setSelectedIdx(firstUnscored);
      return;
    }
    const cur = scores[selectedIdx];
    const prevDiff = cur !== null ? cur - selHole.par : null;
    let next = cur === null ? selHole.par + delta : cur + delta;
    if (next < 1) next = 1;
    setScore(selectedIdx + 1, next);
    const newDiff = next - selHole.par;
    if (newDiff <= -2) fireEagleConfetti();
    else if (newDiff === -1) fireBirdieConfetti();
    if (teamInfo && newDiff <= -1 && (prevDiff === null || prevDiff > -1)) {
      logEvent({
        type: 'score',
        subtype: newDiff <= -2 ? 'eagle' : 'birdie',
        teamName: teamInfo.teamName,
        hole: selectedIdx + 1,
        score: next,
        par: selHole.par,
      });
    }
  };

  // True if entering a score for this hole would be out-of-order
  const isOutOfOrder = (idx: number) => idx > firstUnscored;
  const selOutOfOrder = isOutOfOrder(selectedIdx);

  const handleSync = async () => {
    if (!db || !teamInfo) return;
    setIsSyncing(true);
    try {
      // CRITICAL: must use the canonical teamId (UUID), NOT a slug of the team
      // name. Slugged doc ids create ghost team docs that pollute targeting
      // and the leaderboard.
      await setDoc(doc(db, 'teams', teamId), {
        ...teamInfo, scores, netScore, holesPlayed, currentTee,
        lastUpdated: new Date().toISOString(),
      }, { merge: true });
      toast({ title: 'Synced', description: 'Scores pushed to leaderboard.' });
    } catch {
      toast({ title: 'Sync failed', variant: 'destructive' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSubmitFinal = async () => {
    if (!teamInfo) return;
    setFinishLoading(true);
    // Force a sync first so our final score is in Firestore
    if (db) {
      try {
        await setDoc(doc(db, 'teams', teamId), {
          ...teamInfo, scores, netScore, holesPlayed, currentTee,
          lastUpdated: new Date().toISOString(),
        }, { merge: true });
      } catch { /* non-fatal */ }
    }
    // Fetch leaderboard to find our position
    let finPos: number | null = null;
    let finTotal = 0;
    try {
      const snap = await listTeamsOnce();
      const sorted = [...snap].sort((a, b) => a.netScore - b.netScore);
      const idx = sorted.findIndex(t => t.id === teamId);
      finPos = idx >= 0 ? idx + 1 : null;
      finTotal = sorted.length;
      setFinishPosition(finPos);
      setTotalTeams(finTotal);
    } catch {
      setFinishPosition(null);
    }
    setFinishChirp(pickChirp(scores, netScore));
    setFinishLoading(false);
    setFinishOpen(true);
    if (netScore <= 0) fireEagleConfetti();
    if (teamInfo) {
      logEvent({ type: 'finish', teamName: teamInfo.teamName, netScore, position: finPos, totalTeams: finTotal });
    }
  };

  // How many more strokes under par needed to reach Tips threshold (-5)
  const moreNeeded = Math.max(0, netScore + 5);
  const teeProgress = Math.min(100, Math.max(0, ((-netScore) / 5) * 100));

  const CELL = 'px-3 py-2 text-center cursor-pointer select-none transition-colors';
  const STICKY = 'sticky left-0 z-10 bg-[#0d0d0d] px-3 py-2 text-[10px] font-bold uppercase tracking-widest';

  return (
    <div className="min-h-[100dvh] w-full bg-background flex flex-col pb-20">

      {/* ── Sticky Header ── */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border px-4 pt-3 pb-3">
        <div className="max-w-lg mx-auto">

          {/* Team + Controls row */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-condensed text-xl font-bold uppercase tracking-wider text-foreground leading-tight truncate">
                {teamInfo?.teamName || 'Your Team'}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {teamInfo ? `${teamInfo.player1} · ${teamInfo.player2}` : 'Register on the Home screen'}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Auto-Tee indicator */}
              <div className="bg-card border border-border rounded-lg px-3 py-1.5 text-center min-w-[72px]">
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest leading-tight">Auto-Tee</p>
                <p className={`font-condensed text-xl font-black leading-tight ${currentTee === 'tips' ? 'text-red-400' : 'text-primary'}`}>
                  {netScore === 0 ? 'E' : netScore > 0 ? `+${netScore}` : netScore}
                </p>
                <p className={`text-[9px] font-bold leading-tight ${currentTee === 'tips' ? 'text-red-400' : 'text-blue-400'}`}>
                  {currentTee === 'tips' ? 'TIPS' : "WMN'S"}
                </p>
              </div>

              <button
                onClick={handleSync}
                disabled={isSyncing}
                className="p-2 text-muted-foreground hover:text-primary transition-colors disabled:opacity-40"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Tee progress bar — shows how far to -5 */}
          {currentTee === 'womens' && (
            <div className="mt-2">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[9px] text-muted-foreground uppercase tracking-widest">
                  {moreNeeded > 0 ? `${moreNeeded} under par to unlock Tips tees` : 'Tips tees unlocked'}
                </span>
                <span className="text-[9px] font-bold text-primary">-5</span>
              </div>
              <div className="h-1 w-full bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500 rounded-full"
                  style={{ width: `${teeProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Front / Back toggle */}
          <div className="flex gap-2 mt-3 bg-secondary/40 rounded-full p-1">
            {(['front', 'back'] as const).map(h => (
              <button
                key={h}
                onClick={() => {
                  if (h === 'back') {
                    if (!tryGoToBack(9)) return;
                    setHalf('back');
                  } else {
                    setHalf('front');
                    setSelectedIdx(0);
                  }
                }}
                className={`flex-1 py-2 rounded-full font-condensed font-bold text-sm uppercase tracking-wider transition-colors ${
                  half === h ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {h === 'front' ? 'Front 9' : 'Back 9'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Horizontal Scorecard Table ── */}
      <div className="max-w-lg mx-auto w-full px-4 pt-4">
        <div className="overflow-x-auto rounded-xl border border-border" style={{ background: '#0d0d0d' }}>
          <table className="w-max border-collapse text-xs">
            <tbody>

              {/* HOLE row */}
              <tr className="border-b border-white/8">
                <td className={`${STICKY} text-muted-foreground/60 w-14`}>HOLE</td>
                {halfHoles.map((h, i) => (
                  <td
                    key={h.hole}
                    onClick={() => setSelectedIdx(offset + i)}
                    className={`${CELL} font-condensed font-black text-base w-11 ${
                      selectedIdx === offset + i
                        ? 'bg-primary/20 text-primary'
                        : 'text-foreground/70 hover:bg-white/5'
                    }`}
                  >
                    {h.hole}
                  </td>
                ))}
                <td className={`${CELL} font-bold text-muted-foreground/50 text-[10px] border-l border-white/8 w-11`}>
                  {half === 'front' ? 'OUT' : 'IN'}
                </td>
              </tr>

              {/* PAR row */}
              <tr className="border-b border-white/6">
                <td className={`${STICKY} text-muted-foreground/50`}>PAR</td>
                {halfHoles.map((h, i) => (
                  <td
                    key={h.hole}
                    onClick={() => setSelectedIdx(offset + i)}
                    className={`${CELL} text-muted-foreground/60 ${selectedIdx === offset + i ? 'bg-primary/10' : 'hover:bg-white/3'}`}
                  >
                    {h.par}
                  </td>
                ))}
                <td className={`${CELL} text-muted-foreground/50 border-l border-white/8 font-bold`}>{halfTotalPar}</td>
              </tr>

              {/* HDCP row */}
              <tr className="border-b border-white/8">
                <td className={`${STICKY} text-muted-foreground/40`}>HDCP</td>
                {halfHoles.map((h, i) => (
                  <td
                    key={h.hole}
                    onClick={() => setSelectedIdx(offset + i)}
                    className={`${CELL} text-muted-foreground/40 text-[10px] ${selectedIdx === offset + i ? 'bg-primary/10' : 'hover:bg-white/3'}`}
                  >
                    {h.hdcp}
                  </td>
                ))}
                <td className={`${CELL} border-l border-white/8`} />
              </tr>

              {/* YDS row */}
              <tr className="border-b border-white/10">
                <td
                  className={`${STICKY} ${currentTee === 'tips' ? 'text-red-400' : 'text-blue-400'}`}
                >
                  {currentTee === 'tips' ? 'TIPS' : "WMN'S"}
                </td>
                {halfHoles.map((h, i) => (
                  <td
                    key={h.hole}
                    onClick={() => setSelectedIdx(offset + i)}
                    className={`${CELL} text-foreground/50 text-[11px] ${selectedIdx === offset + i ? 'bg-primary/10' : 'hover:bg-white/3'}`}
                  >
                    {currentTee === 'tips' ? h.tips : h.womens}
                  </td>
                ))}
                <td className={`${CELL} text-foreground/50 border-l border-white/8 font-bold`}>{halfTotalYds}</td>
              </tr>

              {/* Scores divider */}
              <tr><td colSpan={11} className="h-px bg-primary/20" /></tr>

              {/* SCORE row */}
              <tr className="border-b border-white/6">
                <td className={`${STICKY} text-foreground/80`}>SCORE</td>
                {halfHoles.map((h, i) => {
                  const s = halfScores[i];
                  const diff = s !== null ? s - h.par : null;
                  const isSelected = selectedIdx === offset + i;
                  return (
                    <td
                      key={h.hole}
                      onClick={() => setSelectedIdx(offset + i)}
                      className={`${CELL} py-2.5 ${isSelected ? 'bg-primary/20' : 'hover:bg-white/5'}`}
                    >
                      <span className={`font-condensed text-lg font-black ${netCls(diff)}`}>
                        {s ?? '—'}
                      </span>
                    </td>
                  );
                })}
                <td className={`${CELL} border-l border-white/8 font-condensed text-lg font-black text-foreground/80`}>
                  {halfPlayedPar > 0 ? halfPlayedScore : ''}
                </td>
              </tr>

              {/* NET row */}
              <tr className="border-b border-white/4">
                <td className={`${STICKY} text-muted-foreground/50`}>NET</td>
                {halfHoles.map((h, i) => {
                  const s = halfScores[i];
                  const diff = s !== null ? s - h.par : null;
                  return (
                    <td
                      key={h.hole}
                      onClick={() => setSelectedIdx(offset + i)}
                      className={`${CELL} py-1.5 text-[11px] ${selectedIdx === offset + i ? 'bg-primary/10' : 'hover:bg-white/3'}`}
                    >
                      <span className={netCls(diff)}>{diff === null ? '—' : fmtNet(diff)}</span>
                    </td>
                  );
                })}
                <td className={`${CELL} py-1.5 border-l border-white/8`}>
                  <span className={netCls(halfNet)}>{halfNet === null ? '' : fmtNet(halfNet)}</span>
                </td>
              </tr>

              {/* TO PAR row */}
              <tr>
                <td className={`${STICKY} text-muted-foreground/50`}>TO PAR</td>
                {halfHoles.map((h, i) => {
                  const cum = cumNets[i];
                  return (
                    <td
                      key={h.hole}
                      onClick={() => setSelectedIdx(offset + i)}
                      className={`${CELL} py-1.5 text-[11px] ${selectedIdx === offset + i ? 'bg-primary/10' : 'hover:bg-white/3'}`}
                    >
                      <span className={netCls(cum)}>{cum === null ? '—' : fmtNet(cum)}</span>
                    </td>
                  );
                })}
                <td className={`${CELL} py-1.5 border-l border-white/8`}>
                  <span className={netCls(halfNet)}>{halfNet === null ? '' : fmtNet(halfNet)}</span>
                </td>
              </tr>

            </tbody>
          </table>
        </div>

        {/* Half summary bar */}
        <div className="flex justify-between items-center mt-2 px-1">
          <span className="text-[10px] text-muted-foreground">
            {halfHolesPlayed} / 9 holes · {halfTotalYds.toLocaleString()} yds
          </span>
          <span className={`text-[10px] font-bold ${netCls(halfNet)}`}>
            {halfNet === null ? '' : `${fmtNet(halfNet)} this nine`}
          </span>
        </div>

        {/* ── Front 9 complete → offer to open Item Box (no auto-lock) ── */}
        {half === 'front' && front9Complete && !wheelSpin && (
          <button
            onClick={() => setWheelOpen(true)}
            data-testid="button-confirm-front-nine"
            className="mt-4 w-full h-14 rounded-2xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-condensed font-black text-base uppercase tracking-widest active:scale-[0.99] transition-transform flex items-center justify-center gap-2 shadow-lg shadow-primary/25"
          >
            <Sparkles className="w-5 h-5" />
            Spin Item Box
          </button>
        )}

        {/* Show what you spun — tap to re-open the wheel modal for details */}
        {spunItem && (
          <button
            onClick={() => setWheelOpen(true)}
            data-testid="button-show-spun-item"
            className="mt-4 w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2"
            style={{
              background: `linear-gradient(135deg, ${spunItem.color}22, transparent)`,
              borderColor: `${spunItem.color}66`,
            }}
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 border border-white/20 shadow-lg"
              style={{ background: spunItem.color, color: spunItem.textColor }}
            >
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="text-left min-w-0 flex-1">
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Your Item</p>
              <p className="font-condensed text-lg font-black uppercase tracking-wider text-foreground truncate">
                {spunItem.label}
              </p>
              <p className="text-[10px] text-muted-foreground/80 truncate">{spunItem.description}</p>
            </div>
          </button>
        )}

        {/* Show hits received from other teams (so people know they got smacked) */}
        {targetedBy.length > 0 && (
          <div className="mt-3 rounded-2xl bg-red-950/30 border border-red-900/50 px-4 py-3">
            <p className="text-[9px] font-black uppercase tracking-widest text-red-400 mb-2">
              Hits Received · +{targetedBy.length} stroke{targetedBy.length === 1 ? '' : 's'} total
            </p>
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {[...targetedBy].sort((a, b) => b.at - a.at).map((hit, i) => {
                const item = getWheelItem(hit.item);
                return (
                  <div key={`${hit.fromTeam}-${hit.at}-${i}`} className="flex items-center gap-2 text-xs">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: item?.color ?? '#666' }}
                    />
                    <span className="font-bold text-foreground/90 truncate flex-1">
                      {hit.fromTeam}
                    </span>
                    <span className="text-muted-foreground/70 uppercase tracking-wider text-[10px] shrink-0">
                      {item?.label ?? hit.item}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Submit Final Score ── */}
        {holesPlayed === 18 && !hasSubmitted && (
          <button
            onClick={handleSubmitFinal}
            disabled={finishLoading}
            data-testid="button-submit-final"
            className="mt-4 w-full h-16 rounded-2xl bg-gradient-to-r from-yellow-500 to-yellow-400 text-black font-condensed font-black text-lg uppercase tracking-widest active:scale-[0.99] transition-transform flex items-center justify-center gap-2 shadow-lg shadow-yellow-500/30 disabled:opacity-60"
          >
            <Trophy className="w-6 h-6" />
            {finishLoading ? 'Submitting…' : 'Submit Final Score'}
          </button>
        )}
      </div>

      {/* ── Score Entry Panel ── */}
      <div className="max-w-lg mx-auto w-full px-4 pt-4">
        <div className="bg-card border border-border rounded-2xl overflow-hidden">

          {/* Hole info bar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-card/50">
            <div className="flex items-center gap-3">
              <span className="font-condensed text-4xl font-black text-primary/20 leading-none">
                {selHole.hole.toString().padStart(2, '0')}
              </span>
              <div>
                <p className="font-condensed text-base font-bold uppercase tracking-wide text-foreground">
                  Par {selHole.par}
                </p>
                <p className="text-xs text-muted-foreground">
                  {currentTee === 'tips' ? selHole.tips : selHole.womens} yds
                  <span className="ml-2 opacity-60">· Hdcp {selHole.hdcp}</span>
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveRule(selHole)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary/15 border border-primary/40 hover:bg-primary/25 transition-colors text-xs font-bold uppercase tracking-wider text-primary"
            >
              <Info className="w-3.5 h-3.5" />
              Check Rule
            </button>
          </div>

          {/* Score stepper */}
          <div className="px-4 py-4">
            <div className={`flex items-center justify-between bg-background/60 rounded-xl p-2 border ${selLocked || selOutOfOrder ? 'border-primary/30 opacity-70' : 'border-border/50'}`}>
              <button
                data-testid={`score-decrease-hole-${selHole.hole}`}
                onClick={() => handleChange(-1)}
                disabled={selLocked || selOutOfOrder}
                className="w-14 h-14 flex items-center justify-center rounded-full bg-secondary hover:bg-primary hover:text-primary-foreground transition-all active:scale-95 text-secondary-foreground disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-secondary disabled:hover:text-secondary-foreground"
              >
                {selLocked ? <Lock className="w-5 h-5" /> : <Minus className="w-6 h-6" />}
              </button>

              <div className="flex flex-col items-center min-w-[96px]">
                <span
                  data-testid={`score-value-hole-${selHole.hole}`}
                  className={`font-condensed text-6xl font-black leading-none ${netCls(selDiff)}`}
                >
                  {selScore ?? '—'}
                </span>
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mt-1 h-4 flex items-center gap-1">
                  {selLocked && <Lock className="w-3 h-3 text-primary" />}
                  {selLocked ? 'LOCKED' : selOutOfOrder ? 'BLOCKED' : scoreLabel(selDiff)}
                </span>
              </div>

              <button
                data-testid={`score-increase-hole-${selHole.hole}`}
                onClick={() => handleChange(1)}
                disabled={selLocked || selOutOfOrder}
                className="w-14 h-14 flex items-center justify-center rounded-full bg-secondary hover:bg-primary hover:text-primary-foreground transition-all active:scale-95 text-secondary-foreground disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-secondary disabled:hover:text-secondary-foreground"
              >
                {selLocked ? <Lock className="w-5 h-5" /> : <Plus className="w-6 h-6" />}
              </button>
            </div>
            {selLocked && (
              <p className="text-[10px] text-muted-foreground/80 text-center mt-2 uppercase tracking-widest font-bold">
                <Lock className="w-3 h-3 inline-block mr-1 -mt-0.5 text-primary" />
                Front 9 locked after the spin
              </p>
            )}
            {selOutOfOrder && !selLocked && (
              <button
                onClick={() => setSelectedIdx(firstUnscored)}
                className="block mx-auto mt-2 text-[10px] text-primary/90 hover:text-primary uppercase tracking-widest font-bold"
              >
                Score hole {firstUnscored + 1} first →
              </button>
            )}
          </div>

          {/* Hole navigation */}
          <div className="flex items-center justify-between px-4 pb-4">
            <button
              onClick={() => setSelectedIdx(i => Math.max(0, i - 1))}
              disabled={selectedIdx === 0}
              className="flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-primary transition-colors disabled:opacity-25 uppercase tracking-wider"
            >
              <ChevronLeft className="w-4 h-4" />
              Prev
            </button>
            <span className="text-xs text-muted-foreground">
              Hole {selectedIdx + 1} of 18
            </span>
            <button
              onClick={() => {
                const next = Math.min(17, selectedIdx + 1);
                if (selectedIdx === 8 && next === 9) {
                  tryGoToBack(9);
                  return;
                }
                setSelectedIdx(next);
              }}
              disabled={selectedIdx === 17}
              className="flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-primary transition-colors disabled:opacity-25 uppercase tracking-wider"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Rule Sheet ── */}
      <Sheet open={!!activeRule} onOpenChange={o => !o && setActiveRule(null)}>
        <SheetContent side="bottom" className="h-auto max-h-[80vh] rounded-t-3xl bg-card border-t border-primary/20">
          {activeRule && (
            <div className="py-6 px-2">
              <div className="flex items-center gap-4 mb-5">
                <span className="font-condensed text-5xl font-black text-primary/30 leading-none">
                  {activeRule.hole.toString().padStart(2, '0')}
                </span>
                <SheetTitle className="font-condensed text-2xl uppercase tracking-wider text-left leading-tight">
                  {activeRule.ruleName}
                </SheetTitle>
              </div>
              <SheetDescription className="text-base text-foreground/90 leading-relaxed font-medium">
                {activeRule.rule}
              </SheetDescription>
              <div className="mt-4 pt-4 border-t border-border/40 flex gap-4 text-xs text-muted-foreground">
                <span>Hole {activeRule.hole}</span>
                <span>Par {activeRule.par}</span>
                <span>Hdcp {activeRule.hdcp}</span>
                <span>{currentTee === 'tips' ? activeRule.tips : activeRule.womens} yds ({currentTee === 'tips' ? 'Tips' : "Women's"})</span>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Mario Kart Item Wheel ── */}
      <WheelModal open={wheelOpen} onClose={() => setWheelOpen(false)} />

      {/* ── Final Score Submission Modal ── */}
      {finishOpen && (
        <div className="fixed inset-0 z-[110] bg-black/95 backdrop-blur flex flex-col overflow-y-auto">
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 text-center min-h-[100dvh]">

            {/* Close */}
            <button
              onClick={() => { setFinishOpen(false); setHasSubmitted(true); try { localStorage.setItem('wfc-submitted', 'true'); } catch { /* ignore */ } }}
              className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 active:bg-white/20"
            >
              <X className="w-5 h-5 text-white" />
            </button>

            {/* Header */}
            <div className="mb-6">
              <Trophy className="w-12 h-12 text-yellow-400 mx-auto mb-3" style={{ filter: 'drop-shadow(0 0 12px #facc15)' }} />
              <h2 className="font-condensed text-4xl font-black uppercase tracking-widest text-white">
                Round Complete
              </h2>
              <p className="text-sm text-white/50 mt-1 uppercase tracking-widest font-bold">
                {teamInfo?.teamName}
              </p>
            </div>

            {/* Final Net Score */}
            <div className="mb-6">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">Final Net Score</p>
              <span
                className={`font-condensed text-8xl font-black leading-none ${
                  netScore < 0 ? 'text-primary' : netScore > 0 ? 'text-orange-400' : 'text-white'
                }`}
                style={netScore < 0 ? { textShadow: '0 0 30px #39FF14' } : {}}
              >
                {netScore === 0 ? 'E' : netScore > 0 ? `+${netScore}` : netScore}
              </span>
            </div>

            {/* Leaderboard Position */}
            {finishPosition !== null && (
              <div className="mb-8 px-6 py-4 rounded-2xl border border-white/15 bg-white/5 w-full max-w-xs">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">Current Standing</p>
                <p className="font-condensed text-3xl font-black text-white">
                  <span className="text-yellow-400">{ordinal(finishPosition)}</span>
                  <span className="text-white/40 text-lg font-bold"> / {totalTeams} teams</span>
                </p>
                {finishPosition === 1 && (
                  <p className="text-xs text-yellow-400 font-bold mt-1 uppercase tracking-widest">You are leading the tournament</p>
                )}
                {finishPosition === 2 && (
                  <p className="text-xs text-white/60 font-bold mt-1 uppercase tracking-widest">One spot off the lead</p>
                )}
                {finishPosition > totalTeams - 2 && finishPosition > 3 && (
                  <p className="text-xs text-red-400 font-bold mt-1 uppercase tracking-widest">Fighting for your dignity</p>
                )}
              </div>
            )}

            {/* The Chirp */}
            <div className="w-full max-w-sm mb-8 px-5 py-5 rounded-2xl bg-white/5 border border-white/10">
              <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-3">The Verdict</p>
              <p className="text-base text-white/90 leading-relaxed font-medium text-left">
                {finishChirp}
              </p>
            </div>

            {/* Actions */}
            <div className="w-full max-w-xs space-y-3">
              <button
                onClick={() => { setFinishOpen(false); setHasSubmitted(true); try { localStorage.setItem('wfc-submitted', 'true'); } catch { /* ignore */ } }}
                className="w-full h-14 rounded-full bg-primary text-primary-foreground font-condensed font-black text-lg uppercase tracking-widest active:scale-95 transition-transform"
              >
                Back to Scorecard
              </button>
              <button
                onClick={() => { setFinishOpen(false); setHasSubmitted(true); try { localStorage.setItem('wfc-submitted', 'true'); } catch { /* ignore */ } setLocation('/leaderboard'); }}
                className="w-full h-12 rounded-full border border-white/20 text-white/70 font-condensed font-bold text-sm uppercase tracking-widest hover:bg-white/5 transition-colors"
              >
                View Full Leaderboard
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
