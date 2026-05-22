import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Minus, Plus, Flag, Lock, Sparkles, Unlock, Trophy, X } from 'lucide-react';
import { useLocation } from 'wouter';
import { useWFC } from '@/lib/store';
import { HOLES } from '@/lib/holes';
import { fireEagleConfetti, fireBirdieConfetti } from '@/lib/confetti';
import { getWheelItem } from '@/lib/wheel';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
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
  const {
    teamId, teamInfo, scores, currentTee, netScore, holesPlayed, setScore,
    frontNineConfirmed, wheelSpin, listTeamsOnce, logEvent,
    hasSubmitted, submitFinal,
  } = useWFC();
  const [, setLocation] = useLocation();
  const [holeIdx, setHoleIdx] = useState(0);
  const [wheelOpen, setWheelOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [finishPosition, setFinishPosition] = useState<number | null>(null);
  const [finishLoading, setFinishLoading] = useState(false);
  const [totalTeams, setTotalTeams] = useState(0);
  const [finishChirp, setFinishChirp] = useState('');
  const finishShownRef = useRef(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const { toast } = useToast();

  const markSubmitted = submitFinal;

  // Reset finish-shown latch when admin wipes the team
  useEffect(() => {
    if (!teamInfo) finishShownRef.current = false;
  }, [teamInfo]);

  // Auto-trigger finish modal the first time hole 18 is completed
  useEffect(() => {
    if (!(holesPlayed === 18 && !hasSubmitted && !finishShownRef.current)) return;
    finishShownRef.current = true;
    const t = setTimeout(() => {
      setFinishChirp(pickChirp(scores, netScore));
      setFinishOpen(true);
    }, 700);
    return () => clearTimeout(t);
  }, [holesPlayed, hasSubmitted]);

  const handleSubmitFinal = async () => {
    if (!teamInfo) return;
    setFinishLoading(true);
    // Flush latest score to Firestore so position lookup is accurate
    if (db) {
      try {
        await setDoc(doc(db, 'teams', teamId), {
          teamName: teamInfo.teamName, player1: teamInfo.player1, player2: teamInfo.player2,
          scores, netScore, holesPlayed, currentTee,
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

  // Auto-jump to first unscored hole on mount
  useEffect(() => {
    const firstUnscored = scores.findIndex(s => s === null);
    if (firstUnscored !== -1) setHoleIdx(firstUnscored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hole = HOLES[holeIdx];
  const score = scores[holeIdx];
  const diff = diffOf(score, hole.par);
  const { label: sLabel, color: sLabelColor } = scoreLabel(diff);
  const yardage = currentTee === 'tips' ? hole.tips : hole.womens;

  const front9Complete = scores.slice(0, 9).every(s => s !== null);
  const spunItem = getWheelItem(wheelSpin?.item);
  const holeLocked = hasSubmitted || (frontNineConfirmed && holeIdx < 9);

  // ── The gate: enforces ordered scoring + back-9 lock.
  // Returns true if navigation is allowed; false if blocked.
  const tryGoToIdx = (targetIdx: number): boolean => {
    if (targetIdx === holeIdx) return true;
    // Backwards is always fine.
    if (targetIdx < holeIdx) {
      setHoleIdx(targetIdx);
      return true;
    }
    // Forwards: every hole before `targetIdx` must have a score.
    const missing = scores.slice(0, targetIdx).findIndex(s => s === null);
    if (missing !== -1) {
      toast({
        title: `Score hole ${missing + 1} first`,
        description: 'Holes must be entered in order.',
        variant: 'destructive',
      });
      setHoleIdx(missing);
      return false;
    }
    // Back-9 lock: must have spun the Item Box. Once submitted, the wheel
    // never re-opens — navigation just goes through.
    if (targetIdx >= 9 && !wheelSpin && !hasSubmitted) {
      if (!front9Complete) {
        toast({
          title: 'Finish the front 9 first',
          description: 'Enter scores for all 9 front holes before moving on.',
          variant: 'destructive',
        });
        return false;
      }
      setWheelOpen(true);
      return false;
    }
    setHoleIdx(targetIdx);
    return true;
  };

  const handleScore = (delta: number) => {
    if (hasSubmitted) {
      toast({ title: 'Score locked', description: 'You already submitted your final score.' });
      return;
    }
    if (holeLocked) {
      toast({ title: 'Front 9 locked', description: 'You already spun the Item Box — scores 1–9 are final.' });
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

  const goPrev = () => setHoleIdx(i => Math.max(0, i - 1));
  const goNext = () => tryGoToIdx(Math.min(17, holeIdx + 1));

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
              Thru {holesPlayed} · {currentTee === 'tips' ? 'Tips' : "Women's"} tees
            </p>
          </div>
          <div className="text-right">
            <div className={`font-condensed text-3xl font-black leading-none ${netScore < 0 ? 'text-primary' : 'text-foreground'}`}>
              {fmtNet(netScore)}
            </div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Total</p>
          </div>
        </div>

        {/* Hole pager */}
        <div className="flex items-center justify-between px-5 pb-3 max-w-md mx-auto">
          <button
            onClick={goPrev}
            disabled={holeIdx === 0}
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
              {HOLES.map((_, i) => {
                const s = scores[i];
                const isActive = i === holeIdx;
                const isScored = s !== null;
                const d = isScored ? s! - HOLES[i].par : null;
                let dotColor = 'bg-secondary';
                if (isScored && d !== null) {
                  if (d <= -1) dotColor = 'bg-primary';
                  else if (d === 0) dotColor = 'bg-foreground/40';
                  else dotColor = 'bg-orange-500/60';
                }
                const isBack9Locked = i >= 9 && (!front9Complete || !wheelSpin);
                return (
                  <button
                    key={i}
                    onClick={() => tryGoToIdx(i)}
                    className={`rounded-full transition-all ${
                      isActive ? 'w-5 h-1.5 bg-primary' : `w-1.5 h-1.5 ${dotColor} ${isBack9Locked ? 'opacity-40' : ''}`
                    }`}
                    aria-label={`Go to hole ${i + 1}`}
                  />
                );
              })}
            </div>
          </div>

          <button
            onClick={goNext}
            disabled={holeIdx === 17}
            className={`w-10 h-10 flex items-center justify-center rounded-full text-foreground disabled:opacity-20 active:scale-90 transition-all ${
              holeIdx === 8 && front9Complete && !wheelSpin
                ? 'bg-primary text-primary-foreground animate-pulse shadow-lg shadow-primary/40'
                : 'bg-secondary'
            }`}
            data-testid="button-next-hole"
            aria-label={holeIdx === 8 && front9Complete && !wheelSpin ? 'Spin Item Box to unlock back 9' : 'Next hole'}
          >
            {holeIdx === 8 && front9Complete && !wheelSpin
              ? <Sparkles className="w-5 h-5" />
              : <ChevronRight className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Main Content — tightened spacing so everything important fits without
          scrolling on a typical phone (par/yds, rule, score stepper). */}
      <div className="flex-1 flex flex-col max-w-md mx-auto w-full px-4 pt-3 gap-3">

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
            <div className="flex-1 grid grid-cols-3 gap-1.5">
              {[
                { key: 'tips', label: 'Tips', val: hole.tips },
                { key: 'mid', label: 'Mid', val: hole.mid },
                { key: 'womens', label: "Wmn's", val: hole.womens },
              ].map(({ key, label, val }) => {
                const isActive =
                  (key === 'tips' && currentTee === 'tips') ||
                  (key === 'womens' && currentTee === 'womens');
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
          </div>
        </div>

        {/* Rule Card — tighter padding & label rolled into the same row */}
        <div className="bg-card border border-primary/30 rounded-2xl p-4 relative overflow-hidden">
          <div className="flex items-center gap-2 mb-1.5">
            <Flag className="w-3 h-3 text-primary" />
            <p className="text-[9px] font-black text-primary uppercase tracking-widest">Hole Rule</p>
          </div>
          <h3 className="font-condensed text-xl font-black uppercase tracking-tight leading-tight text-foreground mb-1.5">
            {hole.ruleName}
          </h3>
          <p className="text-[13px] text-foreground/75 leading-snug">
            {hole.rule}
          </p>
        </div>

        {/* Score Entry — removed the bottom Par/Yds/VsPar row (already shown
            above) so the stepper fits without scrolling on most phones. */}
        <div className={`bg-card border rounded-2xl p-4 ${holeLocked ? 'border-primary/30 opacity-80' : 'border-border'}`}>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest text-center mb-3 flex items-center justify-center gap-1.5">
            {holeLocked && <Lock className="w-3 h-3 text-primary" />}
            {hasSubmitted ? 'Round Submitted' : holeLocked ? 'Front 9 Locked' : 'Enter Score'}
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

          {holeLocked && (
            <p className={`text-[10px] text-center mt-2 uppercase tracking-widest font-bold ${hasSubmitted ? 'text-yellow-400/90' : 'text-muted-foreground'}`}>
              {hasSubmitted ? 'Score submitted — scores are final' : 'Final — set when you spun the Item Box'}
            </p>
          )}
        </div>

        {/* Big LOCK CTA when front 9 done & no spin yet — user must tap this
            explicitly. No auto-pop. Hidden entirely once the round is
            submitted so there is no path back into the wheel. */}
        {front9Complete && !wheelSpin && !hasSubmitted && (
          <button
            onClick={() => setWheelOpen(true)}
            data-testid="button-open-item-box"
            className="w-full h-16 rounded-2xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-condensed font-black text-lg uppercase tracking-widest active:scale-[0.99] transition-transform flex items-center justify-center gap-2 shadow-lg shadow-primary/40 animate-pulse"
          >
            <Lock className="w-5 h-5" />
            Lock Front 9 &amp; Spin Item Box
          </button>
        )}

        {/* Subtle "what you spun" pill once they've spun */}
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

      <WheelModal open={wheelOpen} onClose={() => setWheelOpen(false)} />

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
