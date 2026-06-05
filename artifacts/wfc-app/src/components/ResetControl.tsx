import { useState } from 'react';
import {
  clearAllLocalAppState, getActiveTournamentId,
  teamsCol, eventsCol, drivesCol, tournamentDoc, configDoc,
} from '@/lib/tournament';
import { db } from '@/lib/firebase';
import {
  getDocs, writeBatch, setDoc, serverTimestamp, type CollectionReference,
} from 'firebase/firestore';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { RotateCcw } from 'lucide-react';

const RESET_PASSWORD = '0010110';

// A small, password-gated control that fully resets the app. It is completely
// nuclear: when a tournament is active it wipes ALL teams, scores, wheel spins,
// events and drives from Firestore and flips the tournament status back to
// 'live' (clearing any finalized/locked state), then wipes ALL local app state
// and reloads into the clean main menu. Other connected devices reset too via
// the configDoc resetAt signal. Shared by the main menu (Landing) and the
// in-tournament Home screen.
export function ResetControl({ label = 'Reset app' }: { label?: string }) {
  const [open, setOpen] = useState(false);
  const [pwd, setPwd] = useState('');
  const [error, setError] = useState(false);

  const openDialog = () => {
    setPwd('');
    setError(false);
    setOpen(true);
  };

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd !== RESET_PASSWORD) {
      setError(true);
      return;
    }
    try {
      const fdb = db;
      const tId = getActiveTournamentId();
      if (fdb && tId) {
        const wipeCol = async (col: CollectionReference) => {
          const snap = await getDocs(col);
          if (snap.empty) return;
          // Firestore batches cap at 500 ops; chunk so large collections
          // (e.g. a busy live events feed) are still fully wiped.
          for (let i = 0; i < snap.docs.length; i += 500) {
            const batch = writeBatch(fdb);
            snap.docs.slice(i, i + 500).forEach(d => batch.delete(d.ref));
            await batch.commit();
          }
        };
        await Promise.all([
          wipeCol(teamsCol(fdb)),
          wipeCol(eventsCol(fdb)),
          wipeCol(drivesCol(fdb)),
        ]);
        // Clear the finished/locked state so the tournament behaves like a
        // brand-new one when it is re-entered (the WFC preset reuses the same
        // deterministic doc, so leftover status would otherwise persist).
        await setDoc(tournamentDoc(fdb, tId), { status: 'live' }, { merge: true });
        await setDoc(configDoc(fdb), { resetAt: serverTimestamp() }, { merge: true });
      }
    } catch { /* ignore — still clear local state and reload */ }
    clearAllLocalAppState();
    window.location.href = import.meta.env.BASE_URL;
  };

  return (
    <>
      <button
        onClick={openDialog}
        data-testid="button-open-reset"
        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-full border border-border/50 bg-card/30 text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        <span className="font-condensed font-bold uppercase tracking-widest text-xs">{label}</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border/70 max-w-xs">
          <DialogHeader>
            <DialogTitle className="font-condensed uppercase tracking-widest text-primary flex items-center gap-2">
              <RotateCcw className="w-4 h-4" /> Reset This Device
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              Enter the reset password to fully wipe the active tournament —
              all teams, scores, wheel spins and the leaderboard — and return it
              to a fresh, unlocked state, then go back to the main menu. Every
              connected device resets too. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={confirm} className="space-y-3">
            <div className="space-y-1.5 text-left">
              <Input
                data-testid="input-reset-password"
                type="password"
                inputMode="numeric"
                autoFocus
                value={pwd}
                onChange={e => { setPwd(e.target.value); setError(false); }}
                placeholder="Reset password"
                className="h-12 bg-input/60 border-border/80 focus:border-primary text-base text-center tracking-widest"
              />
              {error && (
                <p data-testid="text-reset-error" className="text-[11px] font-bold text-destructive uppercase tracking-widest">
                  Incorrect password
                </p>
              )}
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 py-3 rounded-full bg-secondary text-secondary-foreground font-condensed font-bold uppercase tracking-widest text-xs hover:bg-secondary/80 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                data-testid="button-confirm-reset"
                className="flex-1 py-3 rounded-full bg-primary text-primary-foreground font-condensed font-bold uppercase tracking-widest text-xs transition-all active:scale-95"
              >
                Reset
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
