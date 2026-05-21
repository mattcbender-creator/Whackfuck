import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Minus, Plus, Flag, AlertTriangle } from 'lucide-react';
import { useWFC } from '@/lib/store';
import { HOLES } from '@/lib/holes';
import { fireEagleConfetti, fireBirdieConfetti } from '@/lib/confetti';

// ─── Hole SVG Layout Data ───────────────────────────────────────────────────
// ViewBox: 0 0 160 220  |  Tee = bottom, Green = top

interface HoleLayout {
  tee: [number, number];
  green: [number, number, number, number]; // cx, cy, rx, ry
  fairway: string;
  bunkers: [number, number, number, number][]; // cx, cy, rx, ry
  water?: string; // polygon points
}

const LAYOUTS: HoleLayout[] = [
  // Hole 1: Par 4, 313 yds — Straight, short
  { tee:[80,205], green:[80,20,17,12], fairway:"65,205 95,205 95,22 65,22",
    bunkers:[[100,108,12,7]] },
  // Hole 2: Par 5, 493 yds — Wide straight, long drive
  { tee:[80,205], green:[80,16,21,14], fairway:"57,205 103,205 103,18 57,18",
    bunkers:[[54,100,13,8],[108,65,12,7]] },
  // Hole 3: Par 3, 165 yds — Short, narrow
  { tee:[80,195], green:[80,25,22,15], fairway:"70,195 90,195 90,30 70,30",
    bunkers:[[57,30,14,8],[103,32,12,7]] },
  // Hole 4: Par 4, 378 yds — Slight dogleg right
  { tee:[75,205], green:[92,18,16,11],
    fairway:"62,205 92,205 95,140 100,90 100,45 90,22 75,22 65,45 65,90 65,140",
    bunkers:[[104,65,11,6]] },
  // Hole 5: Par 5, 520 yds — Dogleg left
  { tee:[82,205], green:[38,20,18,12],
    fairway:"68,205 98,205 98,130 92,100 82,72 68,50 52,32 38,22 24,22 24,32 38,32 52,40 66,58 78,80 90,108 90,132 68,132",
    bunkers:[[95,100,11,6],[44,50,9,5]] },
  // Hole 6: Par 3, 198 yds — Straight, wide green (putt with driver)
  { tee:[80,200], green:[80,22,24,16], fairway:"67,200 93,200 93,28 67,28",
    bunkers:[[55,28,15,8],[105,30,13,7],[97,42,8,5]] },
  // Hole 7: Par 4, 412 yds — Dogleg left
  { tee:[82,205], green:[30,20,15,10],
    fairway:"68,205 98,205 98,125 92,100 80,78 62,58 46,42 34,28 22,22 16,22 16,32 28,34 44,46 60,62 78,82 90,105 90,128 68,128",
    bunkers:[[100,115,12,6],[44,50,9,5]] },
  // Hole 8: Par 4, 445 yds — Wide fairway, long drive contest
  { tee:[80,205], green:[80,18,20,13],
    fairway:"55,205 105,205 108,140 110,90 105,48 90,22 70,22 55,48 52,90 52,140",
    bunkers:[[50,120,12,7],[113,105,11,6]], water:"14,160 48,150 52,205 14,205" },
  // Hole 9: Par 5, 485 yds — Gentle bend right
  { tee:[75,205], green:[88,16,18,12],
    fairway:"60,205 90,205 93,140 98,100 103,65 102,32 90,18 74,18 65,32 62,65 60,100 60,140",
    bunkers:[[55,100,11,6],[106,62,10,6]] },
  // Hole 10: Par 4, 345 yds — Short straight, sniper
  { tee:[80,200], green:[80,18,15,10], fairway:"68,200 92,200 92,22 68,22",
    bunkers:[[95,85,10,5]] },
  // Hole 11: Par 3, 175 yds — Straight
  { tee:[80,195], green:[80,25,20,14], fairway:"68,195 92,195 92,32 68,32",
    bunkers:[[60,30,13,7],[100,32,11,7]] },
  // Hole 12: Par 4, 420 yds — Slight dogleg right, official long drive
  { tee:[76,205], green:[86,18,17,12],
    fairway:"62,205 92,205 96,140 100,95 100,50 90,22 74,22 64,50 62,95 62,140",
    bunkers:[[104,70,11,6],[60,40,10,6]] },
  // Hole 13: Par 5, 510 yds — S-curve, alternate shot
  { tee:[78,205], green:[50,20,17,11],
    fairway:"64,205 94,205 97,140 102,108 108,82 100,58 88,40 76,28 65,20 50,20 44,28 50,30 65,28 76,40 86,58 92,80 85,108 80,138 64,140",
    bunkers:[[110,88,12,6]], water:"26,65 52,55 56,92 30,100" },
  // Hole 14: Par 3, 188 yds — Straight
  { tee:[80,195], green:[80,24,22,14], fairway:"68,195 92,195 92,30 68,30",
    bunkers:[[55,28,14,8],[106,30,13,7]] },
  // Hole 15: Par 4, 395 yds — Straight, bunker heavy
  { tee:[80,205], green:[80,18,17,12], fairway:"65,205 95,205 95,22 65,22",
    bunkers:[[99,115,13,7],[60,82,12,7],[99,38,10,6]] },
  // Hole 16: Par 5, 545 yds — Long, dogleg right
  { tee:[74,205], green:[92,16,19,13],
    fairway:"60,205 90,205 94,140 100,105 108,75 112,48 105,25 92,18 76,18 68,28 62,52 58,82 58,110 60,140",
    bunkers:[[56,125,11,6],[115,72,11,6],[108,42,9,5]] },
  // Hole 17: Par 3, 155 yds — Island green penalty
  { tee:[80,200], green:[80,35,24,18], fairway:"72,200 88,200 88,60 72,60",
    bunkers:[], water:"14,14 146,14 146,68 14,68" },
  // Hole 18: Par 4, 438 yds — Victory lap, sweeping left
  { tee:[82,205], green:[68,18,18,12],
    fairway:"68,205 98,205 98,140 95,105 90,75 82,52 72,32 60,20 46,18 42,28 58,24 70,38 80,58 88,82 92,112 92,142 68,142",
    bunkers:[[98,115,12,7],[96,70,10,6],[38,32,11,7]] },
];

// ─── SVG Diagram Component ──────────────────────────────────────────────────
function HoleDiagram({ layout, holeNum }: { layout: HoleLayout; holeNum: number }) {
  const [tx, ty] = layout.tee;
  const [gx, gy, grx, gry] = layout.green;

  // Midpoint label for yardage markers
  const midY = (ty + gy) / 2;
  const midX = (tx + gx) / 2;

  return (
    <svg
      viewBox="0 0 160 220"
      className="h-full w-auto mx-auto drop-shadow-lg"
      style={{ filter: 'drop-shadow(0 0 12px rgba(57,255,20,0.15))' }}
    >
      {/* Rough background */}
      <rect width="160" height="220" fill="#0a130a" rx="8" />

      {/* Water hazard (rendered behind fairway) */}
      {layout.water && (
        <polygon points={layout.water} fill="#06182c" opacity="0.95" />
      )}

      {/* Fairway */}
      <polygon points={layout.fairway} fill="#1a4410" />

      {/* Fairway edge highlight */}
      <polygon points={layout.fairway} fill="none" stroke="#1e5c14" strokeWidth="0.5" opacity="0.6" />

      {/* 150-yard marker line (approximate mid-fairway) */}
      <line
        x1={midX - 12} y1={midY} x2={midX + 12} y2={midY}
        stroke="#39FF14" strokeWidth="0.8" strokeDasharray="3 2" opacity="0.3"
      />
      <text x={midX + 16} y={midY + 3} fontSize="6" fill="#39FF14" opacity="0.35" fontFamily="monospace">150</text>

      {/* Bunkers */}
      {layout.bunkers.map(([cx, cy, rx, ry], i) => (
        <ellipse key={i} cx={cx} cy={cy} rx={rx} ry={ry} fill="#3d3214" />
      ))}

      {/* Green (putting surface) */}
      <ellipse cx={gx} cy={gy} rx={grx} ry={gry} fill="#246b14" />
      <ellipse cx={gx} cy={gy} rx={grx} ry={gry} fill="none" stroke="#2e8a1a" strokeWidth="1" opacity="0.8" />

      {/* Pin */}
      <line x1={gx} y1={gy} x2={gx} y2={gy - 14} stroke="white" strokeWidth="0.8" />
      <polygon points={`${gx},${gy - 14} ${gx + 7},${gy - 10} ${gx},${gy - 6}`} fill="#39FF14" />
      <circle cx={gx} cy={gy} r="2" fill="white" opacity="0.8" />

      {/* Hole number */}
      <text
        x="8" y="214" fontSize="22" fontWeight="900"
        fill="#39FF14" opacity="0.18"
        fontFamily="'Barlow Condensed', sans-serif"
        letterSpacing="-1"
      >
        {holeNum.toString().padStart(2, '0')}
      </text>

      {/* Tee marker */}
      <rect x={tx - 6} y={ty - 4} width="12" height="6" rx="2" fill="#39FF14" opacity="0.9" />
      <rect x={tx - 6} y={ty - 4} width="12" height="6" rx="2" fill="none" stroke="#ffffff" strokeWidth="0.5" opacity="0.5" />
    </svg>
  );
}

// ─── Score helpers ────────────────────────────────────────────────────────
function getScoreDiff(score: number | null, par: number) {
  return score === null ? null : score - par;
}

function getScoreLabel(diff: number | null) {
  if (diff === null) return { label: '—', color: 'text-muted-foreground' };
  if (diff <= -2)   return { label: 'EAGLE', color: 'text-yellow-400' };
  if (diff === -1)  return { label: 'BIRDIE', color: 'text-primary' };
  if (diff === 0)   return { label: 'PAR', color: 'text-foreground' };
  if (diff === 1)   return { label: 'BOGEY', color: 'text-orange-400' };
  return { label: `+${diff} OVER`, color: 'text-red-400' };
}

function getScoreColor(diff: number | null) {
  if (diff === null) return 'text-muted-foreground/40';
  if (diff <= -2)   return 'text-yellow-400';
  if (diff === -1)  return 'text-primary';
  if (diff === 0)   return 'text-foreground';
  if (diff === 1)   return 'text-orange-400';
  return 'text-red-400';
}

function formatNet(net: number) {
  if (net === 0) return 'E';
  return net > 0 ? `+${net}` : `${net}`;
}

// ─── Main Component ──────────────────────────────────────────────────────
export default function HoleView() {
  const { teamInfo, scores, currentTee, netScore, holesPlayed, setScore } = useWFC();
  const [holeIdx, setHoleIdx] = useState(0);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  // Auto-jump to first unscored hole on mount
  useEffect(() => {
    const firstUnscored = scores.findIndex(s => s === null);
    if (firstUnscored !== -1) setHoleIdx(firstUnscored);
  }, []);

  const hole = HOLES[holeIdx];
  const layout = LAYOUTS[holeIdx];
  const score = scores[holeIdx];
  const diff = getScoreDiff(score, hole.par);
  const { label: scoreLabel, color: scoreLabelColor } = getScoreLabel(diff);
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
      className="min-h-[100dvh] bg-background flex flex-col pb-20 select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* ── Sticky Header ── */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center justify-between px-4 py-3 max-w-md mx-auto">
          <div>
            <p className="font-condensed text-lg font-bold uppercase tracking-widest text-foreground leading-none">
              {teamInfo?.teamName || 'YOUR TEAM'}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-widest ${
                currentTee === 'tips'
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-blue-500/20 text-blue-400'
              }`}>
                {currentTee === 'tips' ? 'Tips' : "Women's"}
              </span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Thru {holesPlayed}
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="font-condensed text-2xl font-black tracking-tight text-foreground">
              {formatNet(netScore)}
            </div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</p>
          </div>
        </div>
      </div>

      {/* ── Hole Navigation Bar ── */}
      <div className="flex items-center justify-between px-4 py-2 max-w-md mx-auto w-full">
        <button
          onClick={goPrev}
          disabled={holeIdx === 0}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-secondary/80 text-secondary-foreground disabled:opacity-20 active:scale-90 transition-all"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center">
          <span className="font-condensed text-4xl font-black leading-none neon-text tracking-tighter">
            {`HOLE ${hole.hole.toString().padStart(2, '0')}`}
          </span>
          <div className="flex gap-1.5 mt-1.5">
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
                    isActive
                      ? 'w-4 h-2 bg-primary'
                      : `w-1.5 h-1.5 ${dotColor} hover:opacity-80`
                  }`}
                />
              );
            })}
          </div>
        </div>

        <button
          onClick={goNext}
          disabled={holeIdx === 17}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-secondary/80 text-secondary-foreground disabled:opacity-20 active:scale-90 transition-all"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col max-w-md mx-auto w-full px-4 gap-3">

        {/* ── Hole Layout Card ── */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex">
            {/* SVG Diagram */}
            <div className="w-32 shrink-0 bg-[#070f07] flex items-center justify-center py-3 px-2">
              <div style={{ height: '160px' }} className="w-full">
                <HoleDiagram layout={layout} holeNum={hole.hole} />
              </div>
            </div>

            {/* Hole Stats */}
            <div className="flex-1 p-4 flex flex-col justify-between">
              {/* Par */}
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Par</p>
                <p className="font-condensed text-5xl font-black leading-none text-foreground">{hole.par}</p>
              </div>

              {/* Yardages — all 3 tees */}
              <div className="mt-3 space-y-1.5">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Yardages</p>
                {[
                  { label: 'Tips', val: hole.tips },
                  { label: 'Mid', val: hole.mid },
                  { label: "Women's", val: hole.womens },
                ].map(({ label, val }) => {
                  const isActive =
                    (label === 'Tips' && currentTee === 'tips') ||
                    (label === "Women's" && currentTee === 'womens');
                  return (
                    <div key={label} className={`flex items-center justify-between rounded-md px-2 py-1 ${
                      isActive ? 'bg-primary/10 border border-primary/30' : ''
                    }`}>
                      <span className={`text-xs font-medium uppercase tracking-wide ${
                        isActive ? 'text-primary font-bold' : 'text-muted-foreground'
                      }`}>{label}</span>
                      <span className={`font-condensed text-lg font-bold leading-none ${
                        isActive ? 'text-primary' : 'text-foreground/50'
                      }`}>{val}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Rule Banner ── */}
          <div className="border-t border-border bg-card/60 px-4 py-3">
            <div className="flex items-start gap-2">
              <Flag className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-black text-primary uppercase tracking-widest leading-none mb-1">
                  {hole.ruleName}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                  {hole.rule}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Score Entry ── */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center mb-4">
            Enter Score
          </p>

          <div className="flex items-center justify-between gap-4">
            <button
              data-testid={`score-decrease-hole-${hole.hole}`}
              onClick={() => handleScore(-1)}
              className="flex-1 h-16 flex items-center justify-center rounded-xl bg-secondary border border-border/50 active:scale-95 active:bg-secondary/60 transition-all"
            >
              <Minus className="w-7 h-7 text-foreground" />
            </button>

            <div className="flex flex-col items-center w-24">
              <span
                data-testid={`score-value-hole-${hole.hole}`}
                className={`font-condensed text-7xl font-black leading-none transition-colors ${getScoreColor(diff)}`}
              >
                {score === null ? '—' : score}
              </span>
              <span className={`text-xs font-black uppercase tracking-widest mt-1 transition-colors ${scoreLabelColor}`}>
                {scoreLabel}
              </span>
            </div>

            <button
              data-testid={`score-increase-hole-${hole.hole}`}
              onClick={() => handleScore(1)}
              className="flex-1 h-16 flex items-center justify-center rounded-xl bg-secondary border border-border/50 active:scale-95 active:bg-secondary/60 transition-all"
            >
              <Plus className="w-7 h-7 text-foreground" />
            </button>
          </div>

          {/* Par reference */}
          <div className="flex justify-center gap-6 mt-4 pt-4 border-t border-border/50">
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Par</p>
              <p className="font-condensed text-lg font-bold text-foreground">{hole.par}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Your Yds</p>
              <p className="font-condensed text-lg font-bold text-foreground">{yardage}</p>
            </div>
            {score !== null && (
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Vs Par</p>
                <p className={`font-condensed text-lg font-bold ${getScoreColor(diff)}`}>
                  {diff === 0 ? 'E' : diff! > 0 ? `+${diff}` : diff}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Upcoming holes strip ── */}
        {holeIdx < 17 && (
          <div className="bg-card/40 border border-border/50 rounded-xl p-3">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Up next</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {HOLES.slice(holeIdx + 1, holeIdx + 4).map((h, i) => {
                const s = scores[holeIdx + 1 + i];
                return (
                  <button
                    key={h.hole}
                    onClick={() => setHoleIdx(holeIdx + 1 + i)}
                    className="shrink-0 flex flex-col items-center bg-card border border-border rounded-lg px-3 py-2 hover:border-primary/30 transition-colors"
                  >
                    <span className="text-[10px] text-muted-foreground">H{h.hole}</span>
                    <span className="font-condensed text-base font-bold text-foreground">P{h.par}</span>
                    {s !== null && (
                      <span className={`text-[10px] font-bold ${getScoreColor(s - h.par)}`}>
                        {s - h.par === 0 ? 'E' : s - h.par > 0 ? `+${s-h.par}` : s - h.par}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Tee rule notice if near threshold ── */}
        {netScore >= -7 && netScore <= -3 && (
          <div className="flex items-start gap-2 bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-3">
            <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-400/80 leading-relaxed">
              You're at <strong>{formatNet(netScore)}</strong>. Reach -5 or better to unlock <strong>Tips tees</strong>.
            </p>
          </div>
        )}
        {currentTee === 'tips' && (
          <div className="flex items-start gap-2 bg-red-500/5 border border-red-500/20 rounded-xl p-3">
            <Flag className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-400/80 leading-relaxed">
              You're on <strong className="text-red-300">Tips tees</strong> — you're shooting -5 or better. Don't blow it.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
