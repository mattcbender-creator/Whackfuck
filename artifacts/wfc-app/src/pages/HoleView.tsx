import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Minus, Plus, Flag, Lock, Sparkles, Unlock, Trophy, X, Check } from 'lucide-react';
import { useLocation } from 'wouter';
import { useWFC } from '@/lib/store';
import { useCourse, useTournament } from '@/lib/tournamentContext';
import { FinalizedBanner } from '@/components/FinalizedBanner';
import { teamDoc, scoresToMap, getActiveTournamentId } from '@/lib/tournament';
import { fireEagleConfetti, fireBirdieConfetti } from '@/lib/confetti';
import { getWheelItem } from '@/lib/wheel';
import { db } from '@/lib/firebase';
import { setDoc, serverTimestamp } from 'firebase/firestore';
import WheelModal from '@/components/WheelModal';
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
    lockedHoles, lockHole,
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
    // If hole 18 is an Item Box hole that hasn't been spun yet, force the spin
    // before the round can be submitted.
    const finalRule = holeRules[17];
    if (finalRule?.type === 'wheel' && !wheelSpins[18]) {
      setWheelHole(18);
      setWheelOpen(true);
      toast({
        title: 'Spin the Item Box',
        description: 'Hole 18 is an Item Box hole — spin it before you submit.',
      });
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
  // Per-hole lock: set by any teammate tapping "Lock Score" on this hole.
  // Synced via Firestore onSnapshot so all devices disable inputs instantly.
  const isHoleLocked = !hasSubmitted && !!lockedHoles[holeIdx + 1];
  // holeLocked covers both the round-level submit and per-hole lock.
  const holeLocked = hasSubmitted || isHoleLocked;

  // Free navigation: players may move to any hole and score holes in any order.
  // Works on play-order positions (0–17), not raw hole indices.
  const tryGoToPos = (targetPos: number): boolean => {
    if (targetPos === orderPos) return true;
    userNavigatedRef.current = true;
    setOrderPos(targetPos);
    return true;
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
    const current = scores[holeIdx];
    const prevDiff = current !== null ? current - hole.par : null;
    let next = current === null ? hole.par + delta : current + delta;
    if (next < 1) next = 1;
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
      className="min-h-[100dvh] bg-background flex flex-col pb-20 select-none"
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
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">
              Thru {holesPlayed}{autoTeeRule ? ` · ${currentTee === 'tips' ? 'Tips' : "Women's"} tees` : ''}
            </p>
            {/* Raw-vs-par chip: shows the value that actually drives the tee
                assignment, so a player who sees TOTAL +2 / TIPS isn't
                confused. Updates live as scores are entered. Only shown when the
                tournament uses the WFC auto-tee rule. */}
            {autoTeeRule && (
            <p className="text-[10px] uppercase tracking-widest mt-1">
              <span className="text-muted-foreground/70 font-bold">Raw vs Par&nbsp;</span>
              <span className={`font-black ${rawNet < 0 ? 'text-primary' : 'text-foreground/80'}`}>
                {rawNet === 0 ? 'E' : rawNet > 0 ? `+${rawNet}` : rawNet}
              </span>
              <span className="text-muted-foreground/50 normal-case tracking-normal ml-1">
                — drives your tee
              </span>
            </p>
            )}
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
            onClick={goPrev}
            disabled={orderPos === 0}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-secondary text-foreground disabled:opacity-20 active:scale-90 transition-all"
            data-testid="button-prev-hole"
          >
            <ChevronLeft className="w-5 h-5" />
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
                  else if (d === 0) dotColor = 'bg-foreground/40';
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
            onClick={goNext}
            disabled={orderPos === 17}
            className="w-10 h-10 flex items-center justify-center rounded-full text-foreground disabled:opacity-20 active:scale-90 transition-all bg-secondary"
            data-testid="button-next-hole"
            aria-label="Next hole"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Content — tightened spacing so everything important fits without
          scrolling on a typical phone (par/yds, rule, score stepper). */}
      <div className="flex-1 flex flex-col max-w-md mx-auto w-full px-4 pt-3 gap-3">
        <FinalizedBanner />

        {/* Hole Stats Card — par hero shrunk + tee yardages compacted into a
            single row beside it instead of below, saving a full row of height. */}
        <div className="bg-card border border-border rounded-2xl p-4 relative overflow-hidden">
          {/* Background hole number */}
          <div
            className="absolute -top-4 -right-2 font-condensed font-black text-primary/[0.06] pointer-events-none select-none leading-none"
            style={{ fontSize: '140px' }}
          >
            {hole.hole.toString().padStart(2, '0')}
          </div>

          <div className="relative flex items-center gap-3">
            {/* Par hero */}
            <div className="flex items-end gap-2 shrink-0">
              <span className="font-condensed text-[60px] font-black leading-[0.85] text-foreground">
                {hole.par}
              </span>
              <div className="pb-1">
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Par</p>
                <p className="text-[10px] font-bold text-foreground/80 uppercase tracking-widest">Hdcp {hole.hdcp}</p>
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
            rule gets the Item Box treatment (sparkles + accent). 'none' hides it. */}
        {rule && rule.type !== 'none' && (
        <div className={`bg-card border rounded-2xl p-4 relative overflow-hidden ${isWheelHole ? 'border-primary/60' : 'border-primary/30'}`}>
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
        )}

        {/* Score Entry — removed the bottom Par/Yds/VsPar row (already shown
            above) so the stepper fits without scrolling on most phones. */}
        <div className={`bg-card border rounded-2xl p-4 ${holeLocked ? 'border-primary/30 opacity-80' : 'border-border'}`}>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest text-center mb-3 flex items-center justify-center gap-1.5">
            {holeLocked && <Lock className="w-3 h-3 text-primary" />}
            {hasSubmitted ? 'Round Submitted' : isHoleLocked ? 'Score Locked' : 'Enter Score'}
          </p>

          <div className="flex items-center justify-between gap-4">
            <button
              data-testid={`score-decrease-hole-${hole.hole}`}
              onClick={() => handleScore(-1)}
              disabled={holeLocked}
              className="w-14 h-14 flex items-center justify-center rounded-full bg-secondary border border-border/60 active:scale-90 active:bg-secondary/60 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {holeLocked ? <Lock className="w-5 h-5 text-foreground/60" /> : <Minus className="w-6 h-6 text-foreground" />}
            </button>

            <div className="flex flex-col items-center w-24">
              <span
                data-testid={`score-value-hole-${hole.hole}`}
                className={`font-condensed text-6xl font-black leading-none transition-colors ${scoreColor(diff)}`}
              >
                {score === null ? '—' : score}
              </span>
              <span className={`text-[10px] font-black uppercase tracking-widest mt-1.5 transition-colors ${sLabelColor}`}>
                {sLabel}
              </span>
            </div>

            <button
              data-testid={`score-increase-hole-${hole.hole}`}
              onClick={() => handleScore(1)}
              disabled={holeLocked}
              className="w-14 h-14 flex items-center justify-center rounded-full bg-secondary border border-border/60 active:scale-90 active:bg-secondary/60 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {holeLocked ? <Lock className="w-5 h-5 text-foreground/60" /> : <Plus className="w-6 h-6 text-foreground" />}
            </button>
          </div>

          {/* Footer: per-hole locked waiting state */}
          {isHoleLocked && (
            <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-primary/10 border border-primary/30 py-2.5">
              <Check className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="text-[11px] font-black text-primary uppercase tracking-widest">
                Submitted — Waiting for Next Hole
              </span>
            </div>
          )}

          {/* Footer: whole round submitted */}
          {hasSubmitted && (
            <p className="text-[10px] text-center mt-2 uppercase tracking-widest font-bold text-yellow-400/90">
              Score submitted — scores are final
            </p>
          )}

          {/* Lock Score button — visible once a score is entered on this hole */}
          {!holeLocked && score !== null && !isFinal && (
            <button
              type="button"
              data-testid={`button-lock-hole-${hole.hole}`}
              onClick={() => {
                toast({ title: 'Score locked — nice shot!' });
                lockHole(holeIdx + 1);
              }}
              className="mt-3 w-full h-11 rounded-xl bg-primary text-primary-foreground font-condensed font-black text-base uppercase tracking-widest active:scale-[0.97] transition-all flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" /> Lock Score
            </button>
          )}
        </div>

        {/* Re-open the Item Box on a wheel hole that hasn't been spun yet (e.g. if
            the auto-fire was dismissed). Hidden once the round is submitted. */}
        {isWheelHole && score !== null && !holeSpin && !hasSubmitted && !isFinal && (
          <button
            onClick={() => { setWheelHole(holeIdx + 1); setWheelOpen(true); }}
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
