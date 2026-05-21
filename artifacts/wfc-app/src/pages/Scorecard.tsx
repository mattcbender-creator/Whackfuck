import { useState, useEffect } from 'react';
import { useWFC } from '@/lib/store';
import { HOLES, TOTAL_PAR } from '@/lib/holes';
import { fireEagleConfetti, fireBirdieConfetti } from '@/lib/confetti';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Minus, Plus, RefreshCw, Info } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

function formatToPar(score: number) {
  if (score === 0) return 'E';
  return score > 0 ? `+${score}` : `${score}`;
}

function getScoreColor(score: number | null, par: number) {
  if (score === null) return 'text-muted-foreground';
  const diff = score - par;
  if (diff <= -2) return 'text-yellow-400 font-bold'; // Eagle
  if (diff === -1) return 'text-primary font-bold'; // Birdie
  if (diff === 0) return 'text-foreground font-bold'; // Par
  if (diff === 1) return 'text-orange-500 font-bold'; // Bogey
  return 'text-red-500 font-bold'; // Double+
}

export default function Scorecard() {
  const { teamInfo, scores, currentTee, netScore, holesPlayed, setScore } = useWFC();
  const [activeRule, setActiveRule] = useState<typeof HOLES[0] | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  const handleScoreChange = (holeIdx: number, par: number, delta: number) => {
    const current = scores[holeIdx];
    let next = current === null ? par + delta : current + delta;
    if (next < 1) next = 1;
    
    setScore(holeIdx + 1, next);
    
    // Confetti
    if (next - par <= -2) fireEagleConfetti();
    else if (next - par === -1) fireBirdieConfetti();
  };

  const handleSync = async () => {
    if (!db || !teamInfo) return;
    setIsSyncing(true);
    try {
      const teamId = teamInfo.teamName.toLowerCase().replace(/[^a-z0-9]/g, '-');
      await setDoc(doc(db, 'teams', teamId), {
        ...teamInfo,
        scores,
        netScore,
        holesPlayed,
        currentTee,
        lastUpdated: new Date().toISOString()
      }, { merge: true });
      toast({ title: 'Synced successfully', description: 'Scores pushed to live leaderboard.' });
    } catch (e) {
      toast({ title: 'Sync failed', description: 'Could not connect to Firebase.', variant: 'destructive' });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full bg-background pb-24">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border p-4">
        <div className="flex justify-between items-start max-w-md mx-auto">
          <div>
            <h2 className="font-condensed text-2xl font-bold uppercase tracking-wider text-foreground neon-text">
              {teamInfo?.teamName || 'Unknown Team'}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-sm uppercase tracking-widest ${currentTee === 'tips' ? 'bg-red-500/20 text-red-500' : 'bg-blue-500/20 text-blue-500'}`}>
                {currentTee === 'tips' ? 'Tips' : "Women's"}
              </span>
              <span className="text-sm text-muted-foreground">Thru {holesPlayed}</span>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <div className="font-condensed text-3xl font-black tracking-tighter">
              {formatToPar(netScore)}
            </div>
            <button 
              onClick={handleSync}
              disabled={isSyncing}
              className="mt-1 flex items-center gap-1 text-[10px] uppercase font-bold tracking-widest text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              Sync
            </button>
          </div>
        </div>
        
        {/* Progress */}
        <div className="max-w-md mx-auto mt-4">
          <div className="h-1 w-full bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${(holesPlayed / 18) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Holes List */}
      <div className="max-w-md mx-auto p-4 space-y-4">
        {HOLES.map((hole, i) => {
          const score = scores[i];
          return (
            <div key={hole.hole} className="bg-card border border-border rounded-xl p-4 flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <div className="flex items-baseline gap-3">
                  <span className="font-condensed text-4xl font-black text-foreground/20 leading-none">
                    {hole.hole.toString().padStart(2, '0')}
                  </span>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold uppercase text-muted-foreground tracking-widest">
                      Par {hole.par}
                    </span>
                    <span className="text-lg font-condensed font-bold text-foreground">
                      {currentTee === 'tips' ? hole.tips : hole.womens} YDS
                    </span>
                  </div>
                </div>
                
                <button 
                  data-testid={`button-check-rule-${hole.hole}`}
                  onClick={() => setActiveRule(hole)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors text-xs font-bold uppercase tracking-wider"
                >
                  <Info className="w-3.5 h-3.5" />
                  Rule
                </button>
              </div>

              <div className="flex items-center justify-between bg-background rounded-lg p-2 border border-border/50">
                <button
                  data-testid={`score-decrease-hole-${hole.hole}`}
                  onClick={() => handleScoreChange(i, hole.par, -1)}
                  className="w-12 h-12 flex items-center justify-center rounded-md bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground transition-colors active:scale-95"
                >
                  <Minus className="w-6 h-6" />
                </button>
                
                <div className="flex flex-col items-center justify-center w-20">
                  <span data-testid={`score-value-hole-${hole.hole}`} className={`font-condensed text-4xl font-black leading-none ${getScoreColor(score, hole.par)}`}>
                    {score === null ? '—' : score}
                  </span>
                  {score !== null && (
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">
                      {formatToPar(score - hole.par)}
                    </span>
                  )}
                </div>

                <button
                  data-testid={`score-increase-hole-${hole.hole}`}
                  onClick={() => handleScoreChange(i, hole.par, 1)}
                  className="w-12 h-12 flex items-center justify-center rounded-md bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground transition-colors active:scale-95"
                >
                  <Plus className="w-6 h-6" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <Sheet open={!!activeRule} onOpenChange={(o) => !o && setActiveRule(null)}>
        <SheetContent side="bottom" className="h-auto max-h-[80vh] rounded-t-3xl bg-card border-t-primary/20">
          {activeRule && (
            <div className="py-6">
              <div className="flex items-center gap-4 mb-6">
                <span className="font-condensed text-5xl font-black text-primary neon-text opacity-50">
                  {activeRule.hole.toString().padStart(2, '0')}
                </span>
                <SheetTitle className="font-condensed text-3xl uppercase tracking-wider text-left">
                  {activeRule.ruleName}
                </SheetTitle>
              </div>
              <SheetDescription className="text-base text-foreground/90 leading-relaxed font-medium">
                {activeRule.rule}
              </SheetDescription>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}