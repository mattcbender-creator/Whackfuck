import { useState } from 'react';
import { Lock, RotateCcw, Loader2 } from 'lucide-react';
import { useTournament } from '@/lib/tournamentContext';
import { useToast } from '@/hooks/use-toast';

/**
 * Shown on scoring screens when the tournament has been finalized. A finalized
 * tournament locks all score entry (setScore silently no-ops), which otherwise
 * looks like the app is broken — taps on the steppers do nothing. This banner
 * makes the locked state obvious and lets the host reopen scoring in one tap,
 * instead of hunting for the control buried in the Admin panel.
 *
 * Renders nothing unless the active tournament is final. Non-host players are
 * already redirected to the Results page by the route Guard, so in practice the
 * reopen button is only reachable by the host.
 */
export function FinalizedBanner() {
  const { tournament, isHost, reopenTournament } = useTournament();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  if (tournament?.status !== 'final') return null;

  const handleReopen = async () => {
    setBusy(true);
    try {
      await reopenTournament();
      toast({ title: 'Scoring reopened', description: 'You can edit scores again.' });
    } catch {
      toast({ title: 'Could not reopen', description: 'Check your connection and try again.', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      data-testid="banner-finalized"
      className="w-full bg-yellow-400/10 border border-yellow-400/40 rounded-2xl px-4 py-3 flex flex-col items-center gap-2 text-center"
    >
      <p className="flex items-center gap-2 text-yellow-300 font-condensed font-bold uppercase tracking-widest text-xs">
        <Lock className="w-4 h-4" /> Tournament finalized — scoring is locked
      </p>
      {isHost ? (
        <button
          onClick={handleReopen}
          disabled={busy}
          data-testid="button-reopen-scoring"
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground font-condensed font-bold uppercase tracking-widest text-xs transition-all active:scale-95 disabled:opacity-60"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
          Reopen scoring
        </button>
      ) : (
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          The host has ended the round. Final results are on the leaderboard.
        </p>
      )}
    </div>
  );
}
