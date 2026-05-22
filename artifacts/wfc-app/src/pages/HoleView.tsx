import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Minus, Plus, Flag } from 'lucide-react';
import { useWFC } from '@/lib/store';
import { HOLES } from '@/lib/holes';
import { fireEagleConfetti, fireBirdieConfetti } from '@/lib/confetti';

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
  const { teamInfo, scores, currentTee, netScore, holesPlayed, setScore } = useWFC();
  const [holeIdx, setHoleIdx] = useState(0);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

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

  const handleScore = (delta: number) => {
    const current = scores[holeIdx];
    let next = current === null ? hole.par + delta : current + delta;
    if (next < 1) next = 1;
    setScore(holeIdx + 1, next);
    const d = next - hole.par;
    if (d <= -2) fireEagleConfetti();
    else if (d === -1) fireBirdieConfetti();
  };

  const goPrev = () => setHoleIdx(i => Math.max(0, i - 1));
  const goNext = () => setHoleIdx(i => Math.min(17, i + 1));

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
                return (
                  <button
                    key={i}
                    onClick={() => setHoleIdx(i)}
                    className={`rounded-full transition-all ${
                      isActive ? 'w-5 h-1.5 bg-primary' : `w-1.5 h-1.5 ${dotColor}`
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
            className="w-10 h-10 flex items-center justify-center rounded-full bg-secondary text-foreground disabled:opacity-20 active:scale-90 transition-all"
            data-testid="button-next-hole"
          >
            <ChevronRight className="w-5 h-5" />
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
        <div className="bg-card border border-border rounded-3xl p-5">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest text-center mb-4">
            Enter Score
          </p>

          <div className="flex items-center justify-between gap-4">
            <button
              data-testid={`score-decrease-hole-${hole.hole}`}
              onClick={() => handleScore(-1)}
              className="w-16 h-16 flex items-center justify-center rounded-full bg-secondary border border-border/60 active:scale-90 active:bg-secondary/60 transition-all"
            >
              <Minus className="w-7 h-7 text-foreground" />
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
              className="w-16 h-16 flex items-center justify-center rounded-full bg-secondary border border-border/60 active:scale-90 active:bg-secondary/60 transition-all"
            >
              <Plus className="w-7 h-7 text-foreground" />
            </button>
          </div>

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

        {/* Up next strip */}
        {holeIdx < 17 && (
          <div>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 px-1">Up next</p>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {HOLES.slice(holeIdx + 1, Math.min(holeIdx + 6, 18)).map((h, i) => {
                const s = scores[holeIdx + 1 + i];
                const d = s !== null ? s - h.par : null;
                return (
                  <button
                    key={h.hole}
                    onClick={() => setHoleIdx(holeIdx + 1 + i)}
                    className="shrink-0 flex flex-col items-center bg-card border border-border rounded-2xl px-4 py-2 min-w-[60px] hover:border-primary/40 transition-colors"
                  >
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
    </div>
  );
}
