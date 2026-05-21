import { useState, useEffect } from 'react';
import { useWFC } from '@/lib/store';
import { HOLES } from '@/lib/holes';
import { fireEagleConfetti, fireBirdieConfetti } from '@/lib/confetti';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Minus, Plus, RefreshCw, Info, ChevronLeft, ChevronRight } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

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

export default function Scorecard() {
  const { teamInfo, scores, currentTee, netScore, holesPlayed, setScore } = useWFC();
  const [half, setHalf] = useState<Half>('front');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [activeRule, setActiveRule] = useState<typeof HOLES[number] | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

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

  const handleChange = (delta: number) => {
    const cur = scores[selectedIdx];
    let next = cur === null ? selHole.par + delta : cur + delta;
    if (next < 1) next = 1;
    setScore(selectedIdx + 1, next);
    if (next - selHole.par <= -2) fireEagleConfetti();
    else if (next - selHole.par === -1) fireBirdieConfetti();
  };

  const handleSync = async () => {
    if (!db || !teamInfo) return;
    setIsSyncing(true);
    try {
      const teamId = teamInfo.teamName.toLowerCase().replace(/[^a-z0-9]/g, '-');
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
                  setHalf(h);
                  setSelectedIdx(h === 'front' ? 0 : 9);
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
            <div className="flex items-center justify-between bg-background/60 rounded-xl p-2 border border-border/50">
              <button
                data-testid={`score-decrease-hole-${selHole.hole}`}
                onClick={() => handleChange(-1)}
                className="w-14 h-14 flex items-center justify-center rounded-full bg-secondary hover:bg-primary hover:text-primary-foreground transition-all active:scale-95 text-secondary-foreground"
              >
                <Minus className="w-6 h-6" />
              </button>

              <div className="flex flex-col items-center min-w-[96px]">
                <span
                  data-testid={`score-value-hole-${selHole.hole}`}
                  className={`font-condensed text-6xl font-black leading-none ${netCls(selDiff)}`}
                >
                  {selScore ?? '—'}
                </span>
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mt-1 h-4">
                  {scoreLabel(selDiff)}
                </span>
              </div>

              <button
                data-testid={`score-increase-hole-${selHole.hole}`}
                onClick={() => handleChange(1)}
                className="w-14 h-14 flex items-center justify-center rounded-full bg-secondary hover:bg-primary hover:text-primary-foreground transition-all active:scale-95 text-secondary-foreground"
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>
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
              onClick={() => setSelectedIdx(i => Math.min(17, i + 1))}
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
    </div>
  );
}
