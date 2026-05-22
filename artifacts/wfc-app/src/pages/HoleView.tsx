import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Minus, Plus, Flag, Lock, Sparkles } from 'lucide-react';
import { useWFC } from '@/lib/store';
import { HOLES } from '@/lib/holes';
import { fireEagleConfetti, fireBirdieConfetti } from '@/lib/confetti';
import { getWheelItem } from '@/lib/wheel';
import WheelModal from '@/components/WheelModal';
import { useToast } from '@/hooks/use-toast';

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
    teamInfo, scores, currentTee, netScore, holesPlayed, setScore,
    frontNineConfirmed, wheelSpin,
  } = useWFC();
  const [holeIdx, setHoleIdx] = useState(0);
  const [wheelOpen, setWheelOpen] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const autoTriggeredRef = useRef(false);
  const { toast } = useToast();

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
  const holeLocked = frontNineConfirmed && holeIdx < 9;

  // ── The gate: anything trying to land on hole 10+ runs through here.
  // Returns true if navigation is allowed; false if it was blocked (and triggers wheel/toast).
  const tryGoToIdx = (targetIdx: number): boolean => {
    // Allow moving anywhere in the front 9 or backwards freely.
    if (targetIdx < 9) {
      setHoleIdx(targetIdx);
      return true;
    }
    // Target is back 9.
    if (!front9Complete) {
      toast({
        title: 'Finish the front 9 first',
        description: 'Enter scores for all 9 front holes before moving on.',
        variant: 'destructive',
      });
      return false;
    }
    if (!wheelSpin) {
      setWheelOpen(true);
      return false;
    }
    setHoleIdx(targetIdx);
    return true;
  };

  // ── Auto-trigger: the SECOND the user completes all 9 front holes
  // (typically by scoring hole 9), open the Item Box automatically. They can
  // still dismiss it ("let me fix a front 9 score first") and edit before spinning.
  useEffect(() => {
    if (front9Complete && !wheelSpin && !autoTriggeredRef.current) {
      autoTriggeredRef.current = true;
      // small delay so the score-entry confetti/UX finishes first
      const t = window.setTimeout(() => setWheelOpen(true), 700);
      return () => window.clearTimeout(t);
    }
    if (!front9Complete) autoTriggeredRef.current = false;
    return undefined;
  }, [front9Complete, wheelSpin]);

  const handleScore = (delta: number) => {
    if (holeLocked) {
      toast({
        title: 'Front 9 locked',
        description: 'You already spun the Item Box — scores 1–9 are final.',
      });
      return;
    }
    const current = scores[holeIdx];
    let next = current === null ? hole.par + delta : current + delta;
    if (next < 1) next = 1;
    setScore(holeIdx + 1, next);
    const d = next - hole.par;
    if (d <= -2) fireEagleConfetti();
    else if (d === -1) fireBirdieConfetti();
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
      className="min-h-[100dvh] bg-background flex flex-col pb-24 select-none"
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

      {/* Main Content */}
      <div className="flex-1 flex flex-col max-w-md mx-auto w-full px-5 pt-5 gap-4">

        {/* Hole Stats Card */}
        <div className="bg-card border border-border rounded-3xl p-6 relative overflow-hidden">
          {/* Background hole number */}
          <div
            className="absolute -top-6 -right-2 font-condensed font-black text-primary/[0.06] pointer-events-none select-none leading-none"
            style={{ fontSize: '200px' }}
          >
            {hole.hole.toString().padStart(2, '0')}
          </div>

          <div className="relative">
            {/* Par hero */}
            <div className="flex items-end gap-3">
              <span className="font-condensed text-[88px] font-black leading-[0.85] text-foreground">
                {hole.par}
              </span>
              <div className="pb-2">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Par</p>
                <p className="text-xs font-bold text-foreground/80 uppercase tracking-widest mt-1">Hdcp {hole.hdcp}</p>
              </div>
            </div>

            {/* Tee yardages */}
            <div className="grid grid-cols-3 gap-2 mt-6">
              {[
                { key: 'tips', label: 'Tips', val: hole.tips },
                { key: 'mid', label: 'Mid', val: hole.mid },
                { key: 'womens', label: "Women's", val: hole.womens },
              ].map(({ key, label, val }) => {
                const isActive =
                  (key === 'tips' && currentTee === 'tips') ||
                  (key === 'womens' && currentTee === 'womens');
                return (
                  <div
                    key={key}
                    className={`rounded-2xl p-3 text-center border transition-colors ${
                      isActive
                        ? 'bg-primary/10 border-primary/60'
                        : 'bg-secondary/40 border-transparent'
                    }`}
                  >
                    <div className={`text-[10px] font-bold uppercase tracking-widest ${
                      isActive ? 'text-primary' : 'text-muted-foreground'
                    }`}>
                      {label}
                    </div>
                    <div className={`font-condensed text-2xl font-black mt-1 leading-none ${
                      isActive ? 'text-primary' : 'text-foreground/70'
                    }`}>
                      {val}
                    </div>
                    <div className="text-[9px] text-muted-foreground uppercase tracking-widest mt-1">yds</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Rule Card */}
        <div className="bg-card border border-primary/30 rounded-3xl p-5 relative overflow-hidden">
          <div className="flex items-center gap-2 mb-2">
            <Flag className="w-3.5 h-3.5 text-primary" />
            <p className="text-[10px] font-black text-primary uppercase tracking-widest">
              Hole Rule
            </p>
          </div>
          <h3 className="font-condensed text-2xl font-black uppercase tracking-tight leading-tight text-foreground mb-2">
            {hole.ruleName}
          </h3>
          <p className="text-sm text-foreground/75 leading-relaxed">
            {hole.rule}
          </p>
        </div>

        {/* Score Entry */}
        <div className={`bg-card border rounded-3xl p-5 ${holeLocked ? 'border-primary/30 opacity-80' : 'border-border'}`}>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest text-center mb-4 flex items-center justify-center gap-1.5">
            {holeLocked && <Lock className="w-3 h-3 text-primary" />}
            {holeLocked ? 'Front 9 Locked' : 'Enter Score'}
          </p>

          <div className="flex items-center justify-between gap-4">
            <button
              data-testid={`score-decrease-hole-${hole.hole}`}
              onClick={() => handleScore(-1)}
              disabled={holeLocked}
              className="w-16 h-16 flex items-center justify-center rounded-full bg-secondary border border-border/60 active:scale-90 active:bg-secondary/60 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {holeLocked ? <Lock className="w-6 h-6 text-foreground/60" /> : <Minus className="w-7 h-7 text-foreground" />}
            </button>

            <div className="flex flex-col items-center w-28">
              <span
                data-testid={`score-value-hole-${hole.hole}`}
                className={`font-condensed text-7xl font-black leading-none transition-colors ${scoreColor(diff)}`}
              >
                {score === null ? '—' : score}
              </span>
              <span className={`text-[11px] font-black uppercase tracking-widest mt-2 transition-colors ${sLabelColor}`}>
                {sLabel}
              </span>
            </div>

            <button
              data-testid={`score-increase-hole-${hole.hole}`}
              onClick={() => handleScore(1)}
              disabled={holeLocked}
              className="w-16 h-16 flex items-center justify-center rounded-full bg-secondary border border-border/60 active:scale-90 active:bg-secondary/60 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {holeLocked ? <Lock className="w-6 h-6 text-foreground/60" /> : <Plus className="w-7 h-7 text-foreground" />}
            </button>
          </div>

          {holeLocked && (
            <p className="text-[10px] text-muted-foreground text-center mt-3 uppercase tracking-widest font-bold">
              Final — set when you spun the Item Box
            </p>
          )}

          <div className="flex justify-center gap-8 mt-5 pt-4 border-t border-border/50">
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Par</p>
              <p className="font-condensed text-lg font-bold text-foreground mt-1">{hole.par}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Your Yds</p>
              <p className="font-condensed text-lg font-bold text-foreground mt-1">{yardage}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Vs Par</p>
              <p className={`font-condensed text-lg font-bold mt-1 ${scoreColor(diff)}`}>
                {diff === null ? '—' : diff === 0 ? 'E' : diff > 0 ? `+${diff}` : diff}
              </p>
            </div>
          </div>
        </div>

        {/* Big Spin Item Box CTA when front 9 done & no spin yet (in case they
            dismissed the auto-popup and want to re-open it). */}
        {front9Complete && !wheelSpin && (
          <button
            onClick={() => setWheelOpen(true)}
            data-testid="button-open-item-box"
            className="w-full h-14 rounded-2xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-condensed font-black text-base uppercase tracking-widest active:scale-[0.99] transition-transform flex items-center justify-center gap-2 shadow-lg shadow-primary/30"
          >
            <Sparkles className="w-5 h-5" />
            Spin Item Box to Start Back 9
          </button>
        )}

        {/* Subtle "what you spun" pill once they've spun */}
        {spunItem && (
          <div
            className="rounded-2xl px-4 py-3 flex items-center gap-3"
            style={{ background: `${spunItem.color}22`, borderLeft: `4px solid ${spunItem.color}` }}
          >
            <Sparkles className="w-4 h-4" style={{ color: spunItem.color }} />
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">You spun</p>
              <p className="font-condensed text-sm font-black uppercase tracking-wider" style={{ color: spunItem.color }}>
                {spunItem.label}
              </p>
            </div>
          </div>
        )}

        {/* Up next strip */}
        {holeIdx < 17 && (
          <div>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 px-1">Up next</p>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {HOLES.slice(holeIdx + 1, Math.min(holeIdx + 6, 18)).map((h, i) => {
                const targetIdx = holeIdx + 1 + i;
                const s = scores[targetIdx];
                const d = s !== null ? s - h.par : null;
                const isLockedTarget = targetIdx >= 9 && (!front9Complete || !wheelSpin);
                return (
                  <button
                    key={h.hole}
                    onClick={() => tryGoToIdx(targetIdx)}
                    className={`shrink-0 flex flex-col items-center bg-card border rounded-2xl px-4 py-2 min-w-[60px] transition-colors relative ${
                      isLockedTarget ? 'border-border/40 opacity-50' : 'border-border hover:border-primary/40'
                    }`}
                  >
                    {isLockedTarget && (
                      <Lock className="w-2.5 h-2.5 absolute top-1.5 right-1.5 text-muted-foreground" />
                    )}
                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">H{h.hole}</span>
                    <span className="font-condensed text-lg font-black text-foreground leading-none mt-1">P{h.par}</span>
                    {d !== null && (
                      <span className={`text-[10px] font-bold mt-0.5 ${scoreColor(d)}`}>
                        {d === 0 ? 'E' : d > 0 ? `+${d}` : d}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <WheelModal open={wheelOpen} onClose={() => setWheelOpen(false)} />
    </div>
  );
}
