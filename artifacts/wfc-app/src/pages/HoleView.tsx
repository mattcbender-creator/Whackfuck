import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Minus, Plus, Flag, Lock, Sparkles, Unlock, Trophy, X } from 'lucide-react';
import { useLocation } from 'wouter';
import { useWFC } from '@/lib/store';
import { useCourse, useTournament } from '@/lib/tournamentContext';
import { FinalizedBanner } from '@/components/FinalizedBanner';
import { teamDoc, scoresToMap, getActiveTournamentId } from '@/lib/tournament';
import { fireEagleConfetti, fireBirdieConfetti } from '@/lib/confetti';
import { getWheelItem } from '@/lib/wheel';
import { pickRoast, type FaceType } from '@/lib/roasts';
import { db } from '@/lib/firebase';
import { setDoc, serverTimestamp } from 'firebase/firestore';
import WheelModal from '@/components/WheelModal';
import { hapticLight, hapticMedium } from '@/lib/haptics';
import { useToast } from '@/hooks/use-toast';
import { pickChirp } from '@/lib/chirps';

function ordinal(n: number): string {
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}

function diffOf(score: number | null, par: number) {
  return score === null ? null : score - par;
}

function scoreLabel(diff: number | null) {
  if (diff === null) return { label: '—', color: 'text-muted-foreground' };
  if (diff <= -2) return { label: 'EAGLE', color: 'text-yellow-400' };
  if (diff === -1) return { label: 'BIRDIE', color: 'text-primary' };
  if (diff === 0) return { label: 'PAR', color: 'text-foreground' };
  if (diff === 1) return { label: 'BOGEY', color: 'text-orange-400' };
  return { label: `+${diff}`, color: 'text-red-400' };
}

function scoreColor(diff: number | null) {
  if (diff === null) return 'text-muted-foreground/40';
  if (diff <= -2) return 'text-yellow-400';
  if (diff === -1) return 'text-primary';
  if (diff === 0) return 'text-foreground';
  if (diff === 1) return 'text-orange-400';
  return 'text-red-400';
}

function fmtNet(net: number) {
  if (net === 0) return 'E';
  return net > 0 ? `+${net}` : `${net}`;
}

export default function HoleView() {
  const { holes: HOLES, holeRules, trackYardages, autoTeeRule } = useCourse();
  const {
    teamId, teamInfo, scores, currentTee, netScore, rawNet, holesPlayed, setScore,
    wheelSpins, listTeamsOnce, logEvent,
    hasSubmitted, submitFinal,
    holeOrder, startingHole,
  } = useWFC();
  const { tournament, isHost } = useTournament();
  const isFinal = tournament?.status === 'final';
  const [, setLocation] = useLocation();
  // Position within the team's play order (0–17), not the raw hole index. For a
  // normal start holeOrder is [1..18] so orderPos === holeIdx; for a shotgun
  // start it wraps around from the team's assigned starting hole.
  const [orderPos, setOrderPos] = useState(0);
  const userNavigatedRef = useRef(false);
  const [wheelOpen, setWheelOpen] = useState(false);
  // Which hole's Item Box the wheel modal is acting on (1–18).
  const [wheelHole, setWheelHole] = useState<number | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const [finishPosition, setFinishPosition] = useState<number | null>(null);
  const [finishLoading, setFinishLoading] = useState(false);
  const [totalTeams, setTotalTeams] = useState(0);
  const [finishChirp, setFinishChirp] = useState('');
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const { toast } = useToast();

  const markSubmitted = submitFinal;

  // Round-complete modal is opened only by the Submit Final Score button.
  // (Previously auto-opened on holesPlayed===18, which blocked score edits.)

  const handleSubmitFinal = async () => {
    if (!teamInfo) return;
    // Block submission until every wheel hole with a score has been spun.
    const unspunHole = findUnspunWheelHole();
    if (unspunHole !== null) {
      const unspunPos = holeOrder.findIndex(h => h === unspunHole);
      if (unspunPos !== -1) { userNavigatedRef.current = true; setOrderPos(unspunPos); }
      setTimeout(() => { setWheelHole(unspunHole); setWheelOpen(true); }, 150);
      toast({ title: 'Spin the Item Box', description: `Hole ${unspunHole} is an Item Box hole — spin it before submitting.` });
      return;
    }
    setFinishLoading(true);
    // Flush latest score to Firestore so position lookup is accurate
    const tId = getActiveTournamentId();
    if (db && tId) {
      try {
        await setDoc(teamDoc(db, teamId), {
          teamName: teamInfo.teamName, players: teamInfo.players,
          scores: scoresToMap(scores), netScore, holesPlayed, currentTee,
          lastUpdated: serverTimestamp(),
        }, { merge: true });
      } catch { /* non-fatal */ }
    }
    let pos: number | null = null;
    let total = 0;
    try {
      const snap = await listTeamsOnce();
      const sorted = [...snap].sort((a, b) => a.netScore - b.netScore);
      total = sorted.length;
      const idx = sorted.findIndex(t => t.id === teamId);
      pos = idx >= 0 ? idx + 1 : null;
      setTotalTeams(total);
      setFinishPosition(pos);
    } catch {
      setFinishPosition(null);
    }
    logEvent({ type: 'finish', teamName: teamInfo.teamName, netScore, position: pos, totalTeams: total });
    if (netScore <= 0) fireEagleConfetti();
    setFinishChirp(pickChirp(scores, netScore));
    setFinishLoading(false);
    setFinishOpen(true);
  };

  // Auto-jump to the first unscored hole in play order. Re-runs when the
  // team's starting hole resolves (shotgun assignments load after mount), but
  // never stomps a manual navigation.
  useEffect(() => {
    if (userNavigatedRef.current) return;
    const firstUnscoredPos = holeOrder.findIndex(h => scores[h - 1] === null);
    if (firstUnscoredPos !== -1) setOrderPos(firstUnscoredPos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startingHole]);

  const holeIdx = holeOrder[orderPos] - 1;
  const hole = HOLES[holeIdx];
  const score = scores[holeIdx];
  const diff = diffOf(score, hole.par);
  const { label: sLabel, color: sLabelColor } = scoreLabel(diff);

  // Rule for this hole comes from the resolved tournament rules (falls back to
  // holes.ts inside the context). A 'wheel' rule turns this hole into an Item Box.
  const rule = holeRules[holeIdx];
  const isWheelHole = rule?.type === 'wheel';
  const holeSpin = wheelSpins[holeIdx + 1] ?? null;
  const spunItem = getWheelItem(holeSpin?.item);
  // Scores lock only once the round is submitted. The old front-9 lock tied to
  // spinning the wheel is gone — the wheel is now a per-hole rule.
  const holeLocked = hasSubmitted;

  // ── Whacky message queue ────────────────────────────────────────────────
  // Behaves like an iMessage thread: messages appear, linger, then disappear.
  // Occasionally two arrive in quick succession (double-chirp).
  // The async loop keeps firing while the team is registered; cancelled on unmount.

  interface WhackyMsg { id: number; text: string; face: FaceType }
  const [whackyMsgs, setWhackyMsgs] = useState<WhackyMsg[]>([]);
  const whackyTimers = useRef<number[]>([]);
  const whackyMsgIdx = useRef(0);

  // Ref always holds the latest params for use inside the async loop closure.
  const roastParamsRef = useRef({
    teamName: teamInfo?.teamName ?? '',
    players: teamInfo?.players ?? [],
    netScore,
    holesPlayed,
    holeNum: hole.hole,
    score: score ?? null,
    par: hole.par,
  });
  useEffect(() => {
    roastParamsRef.current = {
      teamName: teamInfo?.teamName ?? '',
      players: teamInfo?.players ?? [],
      netScore,
      holesPlayed,
      holeNum: hole.hole,
      score: score ?? null,
      par: hole.par,
    };
  }, [teamInfo, netScore, holesPlayed, hole.hole, score, hole.par]);

  useEffect(() => {
    if (!teamInfo) return;
    whackyTimers.current = [];
    let cancelled = false;

    const addTimer = (fn: () => void, ms: number) => {
      const t = window.setTimeout(() => { if (!cancelled) fn(); }, ms);
      whackyTimers.current.push(t);
    };

    const pushMsg = () => {
      const idx = whackyMsgIdx.current++;
      const roast = pickRoast({ ...roastParamsRef.current, msgIndex: idx });
      const id = Date.now() + idx;
      // Only ever one Whacky bubble on screen at a time — a new one replaces it.
      setWhackyMsgs([{ id, text: roast.text, face: roast.face }]);
      // Auto-expire after 7-10 s
      addTimer(() => setWhackyMsgs(prev => prev.filter(m => m.id !== id)), 7000 + Math.random() * 3000);
    };

    const schedule = (initialDelay: number) => {
      addTimer(() => {
        pushMsg();
        // Schedule next burst: 60–120 s gap (Whacky appears far less often now)
        schedule(60000 + Math.random() * 60000);
      }, initialDelay);
    };

    // First message after 20–40 s
    schedule(20000 + Math.random() * 20000);

    return () => {
      cancelled = true;
      whackyTimers.current.forEach(t => window.clearTimeout(t));
      whackyTimers.current = [];
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!teamInfo]);

  // Free navigation: players may move to any hole and score holes in any order.
  // Works on play-order positions (0–17), not raw hole indices.
  const tryGoToPos = (targetPos: number): boolean => {
    if (targetPos === orderPos) return true;
    userNavigatedRef.current = true;
    setOrderPos(targetPos);
    return true;
  };

  // Returns the 1-based hole number of the first scored-but-unspun wheel hole,
  // or null if none. Used to block scoring/submitting until the spin is done.
  const findUnspunWheelHole = (): number | null => {
    for (const holeNum of holeOrder) {
      const idx = holeNum - 1;
      if (holeRules[idx]?.type === 'wheel' && scores[idx] !== null && !wheelSpins[holeNum]) {
        return holeNum;
      }
    }
    return null;
  };

  const handleScore = (delta: number) => {
    if (isFinal) {
      toast({
        title: 'Tournament finalized',
        description: isHost
          ? 'Scoring is locked. Tap "Reopen scoring" above to make changes.'
          : 'The host has ended the round, so scores are locked.',
        variant: 'destructive',
      });
      return;
    }
    if (hasSubmitted) {
      toast({ title: 'Score locked', description: 'You already submitted your final score.' });
      return;
    }
    // Block scoring on any other hole while an Item Box is waiting to be spun.
    const unspunHole = findUnspunWheelHole();
    if (unspunHole !== null && unspunHole !== holeIdx + 1) {
      toast({
        title: 'Spin required first',
        description: `Spin the Item Box on hole ${unspunHole} before scoring other holes.`,
        variant: 'destructive',
      });
      const unspunPos = holeOrder.findIndex(h => h === unspunHole);
      if (unspunPos !== -1) { userNavigatedRef.current = true; setOrderPos(unspunPos); }
      setTimeout(() => { setWheelHole(unspunHole); setWheelOpen(true); }, 150);
      return;
    }
    const current = scores[holeIdx];
    const prevDiff = current !== null ? current - hole.par : null;
    let next = current === null ? hole.par + delta : current + delta;
    if (next < 1) next = 1;
    hapticLight();
    setScore(holeIdx + 1, next);
    const d = next - hole.par;
    if (d <= -2) fireEagleConfetti();
    else if (d === -1) fireBirdieConfetti();
    if (teamInfo && d <= -1 && (prevDiff === null || prevDiff > -1)) {
      logEvent({ type: 'score', subtype: d <= -2 ? 'eagle' : 'birdie', teamName: teamInfo.teamName, hole: holeIdx + 1, score: next, par: hole.par });
    }
  };

  const goPrev = () => {
    userNavigatedRef.current = true;
    setOrderPos(i => Math.max(0, i - 1));
  };
  const goNext = () => tryGoToPos(Math.min(17, orderPos + 1));

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = touchStartX.current - e.changedTouches[0].clientX;
    const dy = Math.abs(touchStartY.current - e.changedTouches[0].clientY);
    if (Math.abs(dx) > 50 && dy < 60) {
      if (dx > 0) goNext();
      else goPrev();
    }
  };

  return (
    <div
      className="h-[100dvh] bg-background flex flex-col select-none overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center justify-between px-5 py-3 max-w-md mx-auto">
          <div className="min-w-0">
            <p className="font-condensed text-lg font-bold uppercase tracking-wider text-foreground leading-none truncate">
              {teamInfo?.teamName || 'YOUR TEAM'}
            </p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5 leading-snug">
              Thru {holesPlayed}
              {autoTeeRule ? ` · ${currentTee === 'tips' ? 'Tips' : "Women's"}` : ''}
              {autoTeeRule && (
                <span className="normal-case tracking-normal">
                  {' · Raw '}
                  <span className={`font-black uppercase tracking-widest ${rawNet < 0 ? 'text-primary' : 'text-foreground/80'}`}>
                    {rawNet === 0 ? 'E' : rawNet > 0 ? `+${rawNet}` : rawNet}
                  </span>
                </span>
              )}
            </p>
          </div>
          <div className="text-right">
            <div className={`font-condensed text-3xl font-black leading-none ${netScore < 0 ? 'text-primary' : 'text-foreground'}`}>
              {fmtNet(netScore)}
            </div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Net Total</p>
          </div>
        </div>

        {/* Hole pager */}
        <div className="flex items-center justify-between px-5 pb-3 max-w-md mx-auto">
          <button
            onClick={() => { hapticLight(); goPrev(); }}
            disabled={orderPos === 0}
            className="w-16 h-16 flex items-center justify-center rounded-full bg-secondary text-foreground disabled:opacity-20 active:scale-90 transition-all"
            data-testid="button-prev-hole"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <div className="flex flex-col items-center">
            <span className="font-condensed text-3xl font-black leading-none tracking-tight">
              HOLE {hole.hole.toString().padStart(2, '0')}
            </span>
            <div className="flex gap-1 mt-2">
              {holeOrder.map((holeNum, p) => {
                const idx = holeNum - 1;
                const s = scores[idx];
                const isActive = p === orderPos;
                const isScored = s !== null;
                const d = isScored ? s! - HOLES[idx].par : null;
                let dotColor = 'bg-secondary';
                if (isScored && d !== null) {
                  if (d <= -1) dotColor = 'bg-primary';
                  else if (d === 0) dotColor = 'bg-white/70';
                  else dotColor = 'bg-orange-500/60';
                }
                return (
                  <button
                    key={holeNum}
                    onClick={() => tryGoToPos(p)}
                    className={`rounded-full transition-all ${
                      isActive ? 'w-5 h-1.5 bg-primary' : `w-1.5 h-1.5 ${dotColor}`
                    }`}
                    aria-label={`Go to hole ${holeNum}`}
                  />
                );
              })}
            </div>
          </div>

          <button
            onClick={() => { hapticLight(); goNext(); }}
            disabled={orderPos === 17}
            className="w-16 h-16 flex items-center justify-center rounded-full text-foreground disabled:opacity-20 active:scale-90 transition-all bg-secondary"
            data-testid="button-next-hole"
            aria-label="Next hole"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Main Content — tightened spacing so everything important fits without
          scrolling on a typical phone (par/yds, rule, score stepper). */}
      <div className="flex-1 overflow-y-auto flex flex-col max-w-md mx-auto w-full px-4 pt-3 gap-3 pb-36">
        <FinalizedBanner />

        {/* Hole Stats Card — par hero shrunk + tee yardages compacted into a
            single row beside it instead of below, saving a full row of height. */}
        <div className="bg-card border border-border rounded-2xl px-5 py-5 relative overflow-hidden">
          {/* Background hole number */}
          <div
            className="absolute -top-6 -right-2 font-condensed font-black text-primary/[0.07] pointer-events-none select-none leading-none"
            style={{ fontSize: '180px' }}
          >
            {hole.hole.toString().padStart(2, '0')}
          </div>

          <div className="relative flex items-center gap-4">
            {/* Par hero */}
            <div className="flex items-end gap-3 shrink-0">
              <span className="font-condensed text-[64px] font-black leading-[0.85] text-foreground">
                {hole.par}
              </span>
              <div className="pb-2">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Par</p>
                <p className="text-[11px] font-bold text-foreground/80 uppercase tracking-widest">Hdcp {hole.hdcp}</p>
              </div>
            </div>

            {/* Tee yardages — compact column on the right */}
            {trackYardages && (
            <div className="flex-1 grid grid-cols-3 gap-1.5">
              {[
                { key: 'tips', label: 'Tips', val: hole.tips },
                { key: 'mid', label: 'Mid', val: hole.mid },
                { key: 'womens', label: "Wmn's", val: hole.womens },
              ].map(({ key, label, val }) => {
                const isActive =
                  autoTeeRule &&
                  ((key === 'tips' && currentTee === 'tips') ||
                  (key === 'womens' && currentTee === 'womens'));
                return (
                  <div
                    key={key}
                    className={`rounded-lg px-1.5 py-1.5 text-center border ${
                      isActive
                        ? 'bg-primary/10 border-primary/60'
                        : 'bg-secondary/40 border-transparent'
                    }`}
                  >
                    <div className={`text-[9px] font-bold uppercase tracking-wider ${
                      isActive ? 'text-primary' : 'text-muted-foreground'
                    }`}>
                      {label}
                    </div>
                    <div className={`font-condensed text-lg font-black leading-none mt-0.5 ${
                      isActive ? 'text-primary' : 'text-foreground/70'
                    }`}>
                      {val}
                    </div>
                  </div>
                );
              })}
            </div>
            )}
          </div>
        </div>

        {/* Rule Card — reads the resolved tournament rule for this hole. A wheel
            rule gets the Item Box treatment (sparkles + accent). 'none' shows a
            subtle Standard Play placeholder so the space never looks broken. */}
        {rule && rule.type !== 'none' ? (
        <div className={`bg-card border rounded-2xl px-4 py-3 relative overflow-hidden ${isWheelHole ? 'border-primary/60' : 'border-primary/30'}`}>
          <div className="flex items-center gap-2 mb-1.5">
            {isWheelHole ? <Sparkles className="w-3 h-3 text-primary" /> : <Flag className="w-3 h-3 text-primary" />}
            <p className="text-[9px] font-black text-primary uppercase tracking-widest">
              {isWheelHole ? 'Item Box Hole' : 'Hole Rule'}
            </p>
          </div>
          <h3 className="font-condensed text-xl font-black uppercase tracking-tight leading-tight text-foreground mb-1.5">
            {rule.ruleName}
          </h3>
          <p className="text-[13px] text-foreground/75 leading-snug">
            {rule.ruleText}
          </p>
        </div>
        ) : null}

        {/* Score Entry — removed the bottom Par/Yds/VsPar row (already shown
            above) so the stepper fits without scrolling on most phones. */}
        <div className={`bg-card border rounded-2xl px-4 py-3 ${holeLocked ? 'border-primary/30 opacity-80' : 'border-border'}`}>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest text-center mb-3 flex items-center justify-center gap-1.5">
            {holeLocked && <Lock className="w-3 h-3 text-primary" />}
            {hasSubmitted ? 'Round Submitted' : 'Enter Score'}
          </p>

          <div className="flex items-center justify-between gap-4">
            <button
              data-testid={`score-decrease-hole-${hole.hole}`}
              onClick={() => handleScore(-1)}
              disabled={holeLocked}
              className="w-20 h-20 flex items-center justify-center rounded-full bg-secondary border border-border/60 active:scale-90 active:bg-secondary/60 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {holeLocked ? <Lock className="w-6 h-6 text-foreground/60" /> : <Minus className="w-7 h-7 text-foreground" />}
            </button>

            <button
              className="flex flex-col items-center min-w-[60px] min-h-[60px] justify-center active:scale-95 transition-transform disabled:active:scale-100"
              onClick={() => {
                if (!holeLocked && !isFinal && score === null) setScore(holeIdx + 1, hole.par);
              }}
              disabled={holeLocked || isFinal || score !== null}
              aria-label={score === null ? `Set score to par ${hole.par}` : `Score: ${score}`}
            >
              {score === null ? (
                <span
                  data-testid={`score-value-hole-${hole.hole}`}
                  className="font-condensed text-6xl font-bold leading-none text-foreground/20"
                >
                  —
                </span>
              ) : (
                <span
                  data-testid={`score-value-hole-${hole.hole}`}
                  className={`font-condensed text-6xl font-bold leading-none transition-colors ${scoreColor(diff)}`}
                >
                  {score}
                </span>
              )}
              <span className={`text-[10px] font-black uppercase tracking-widest mt-1.5 transition-colors ${sLabelColor}`}>
                {sLabel}
              </span>
            </button>

            <button
              data-testid={`score-increase-hole-${hole.hole}`}
              onClick={() => handleScore(1)}
              disabled={holeLocked}
              className="w-20 h-20 flex items-center justify-center rounded-full bg-secondary border border-border/60 active:scale-90 active:bg-secondary/60 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {holeLocked ? <Lock className="w-6 h-6 text-foreground/60" /> : <Plus className="w-7 h-7 text-foreground" />}
            </button>
          </div>

          {holeLocked && (
            <p className="text-[10px] text-center mt-2 uppercase tracking-widest font-bold text-yellow-400/90">
              Score submitted — scores are final
            </p>
          )}
        </div>

        {/* Re-open the Item Box on a wheel hole that hasn't been spun yet (e.g. if
            the auto-fire was dismissed). Hidden once the round is submitted. */}
        {isWheelHole && score !== null && !holeSpin && !hasSubmitted && !isFinal && (
          <button
            onClick={() => { hapticMedium(); setWheelHole(holeIdx + 1); setWheelOpen(true); }}
            data-testid="button-open-item-box"
            className="w-full h-16 rounded-2xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-condensed font-black text-lg uppercase tracking-widest active:scale-[0.99] transition-transform flex items-center justify-center gap-2 shadow-lg shadow-primary/40 animate-pulse"
          >
            <Sparkles className="w-5 h-5" />
            Spin the Item Box
          </button>
        )}

        {/* Subtle "what you spun" pill once they've spun this hole's Item Box */}
        {spunItem && (
          <div
            className="rounded-2xl px-4 py-3 flex items-center gap-3"
            style={{ background: `${spunItem.color}22`, borderLeft: `4px solid ${spunItem.color}` }}
          >
            <Unlock className="w-4 h-4" style={{ color: spunItem.color }} />
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">You spun</p>
              <p className="font-condensed text-sm font-black uppercase tracking-wider" style={{ color: spunItem.color }}>
                {spunItem.label}
              </p>
            </div>
          </div>
        )}

        {/* Submit Final Score button — appears when all 18 done */}
        {holesPlayed === 18 && !hasSubmitted && (
          <button
            onClick={handleSubmitFinal}
            disabled={finishLoading}
            className="w-full h-16 rounded-2xl bg-gradient-to-r from-yellow-500 to-yellow-400 text-black font-condensed font-black text-lg uppercase tracking-widest active:scale-[0.99] transition-transform flex items-center justify-center gap-2 shadow-lg shadow-yellow-500/30 disabled:opacity-60"
          >
            <Trophy className="w-6 h-6" />
            {finishLoading ? 'Submitting…' : 'Submit Final Score'}
          </button>
        )}
        {hasSubmitted && holesPlayed === 18 && (
          <div className="w-full h-12 rounded-2xl bg-card border border-primary/30 flex items-center justify-center gap-2">
            <Trophy className="w-4 h-4 text-primary" />
            <span className="font-condensed text-sm font-bold text-primary uppercase tracking-widest">Score Submitted</span>
          </div>
        )}
      </div>

      {/* ── Whacky message stack — up to 2 bubbles above the nav bar ── */}
      {whackyMsgs.length > 0 && (() => {
        const FACES: Record<FaceType, string> = {
          angry: '/whacky-angry.jpg',
          laugh: '/whacky-laugh.jpg',
          fire:  '/whacky-fire.jpg',
          smug:  '/whacky-smug.jpg',
        };
        return (
          <div className="fixed bottom-[68px] left-0 right-0 z-30 px-4 pb-1 flex flex-col gap-1.5 max-w-md mx-auto pointer-events-none">
            <AnimatePresence mode="popLayout" initial={false}>
              {whackyMsgs.map((msg, i) => {
                const isLast = i === whackyMsgs.length - 1;
                return (
                  <motion.div
                    key={msg.id}
                    layout
                    initial={{ y: 40, opacity: 0, scale: 0.96 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.2 } }}
                    transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                    className="flex items-end gap-2.5 pointer-events-auto"
                  >
                    {isLast ? (
                      <img
                        src={FACES[msg.face]}
                        alt="Whacky"
                        className="w-11 h-11 rounded-full object-cover shrink-0 border border-primary/30"
                      />
                    ) : (
                      <div className="w-11 shrink-0" />
                    )}
                    <div className="flex-1 relative bg-zinc-900/95 backdrop-blur-sm border border-white/8 rounded-2xl rounded-bl-sm px-3 py-2 pr-8 shadow-2xl">
                      {isLast && (
                        <p className="text-[9px] font-black text-primary/70 uppercase tracking-widest mb-0.5">Whacky</p>
                      )}
                      <p className="text-[12px] text-muted-foreground leading-snug line-clamp-3">{msg.text}</p>
                      <button
                        onClick={() => setWhackyMsgs(prev => prev.filter(m => m.id !== msg.id))}
                        className="absolute top-1.5 right-1.5 w-5 h-5 flex items-center justify-center rounded-full bg-white/10 active:bg-white/20"
                        aria-label="Dismiss"
                      >
                        <X className="w-3 h-3 text-muted-foreground" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        );
      })()}

      <WheelModal open={wheelOpen} onClose={() => setWheelOpen(false)} hole={wheelHole} />

      {/* ── Final Score Modal ── */}
      {finishOpen && (
        <div className="fixed inset-0 z-[110] bg-black/95 backdrop-blur flex flex-col overflow-y-auto">
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 text-center min-h-[100dvh]">
            <button
              onClick={() => setFinishOpen(false)}
              className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 active:bg-white/20"
            >
              <X className="w-5 h-5 text-white" />
            </button>
            <div className="mb-6">
              <Trophy className="w-12 h-12 text-yellow-400 mx-auto mb-3" style={{ filter: 'drop-shadow(0 0 12px #facc15)' }} />
              <h2 className="font-condensed text-4xl font-black uppercase tracking-widest text-white">Round Complete</h2>
              <p className="text-sm text-white/50 mt-1 uppercase tracking-widest font-bold">{teamInfo?.teamName}</p>
            </div>
            <div className="mb-6">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">Final Net Score</p>
              <span
                className={`font-condensed text-8xl font-black leading-none ${netScore < 0 ? 'text-primary' : netScore > 0 ? 'text-orange-400' : 'text-white'}`}
                style={netScore < 0 ? { textShadow: '0 0 30px #39FF14' } : {}}
              >
                {netScore === 0 ? 'E' : netScore > 0 ? `+${netScore}` : netScore}
              </span>
            </div>
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
              </div>
            )}
            {finishChirp && (
              <div className="w-full max-w-sm mb-6 px-5 py-5 rounded-2xl bg-white/5 border border-white/10">
                <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-3">The Verdict</p>
                <p className="text-base text-white/90 leading-relaxed font-medium text-left">
                  {finishChirp}
                </p>
              </div>
            )}
            <div className="w-full max-w-xs space-y-3">
              <button
                onClick={() => { setFinishOpen(false); markSubmitted(); }}
                className="w-full h-14 rounded-full bg-primary text-primary-foreground font-condensed font-black text-lg uppercase tracking-widest active:scale-95 transition-transform"
              >
                Lock It In
              </button>
              <button
                onClick={() => { setFinishOpen(false); markSubmitted(); setLocation('/leaderboard'); }}
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
