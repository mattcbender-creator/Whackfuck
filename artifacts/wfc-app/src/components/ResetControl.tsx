import { useState } from 'react';
import { clearAllLocalAppState } from '@/lib/tournament';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { RotateCcw } from 'lucide-react';

const RESET_PASSWORD = '0010110';

// A small, password-gated control that wipes ALL local app state (the active
// tournament plus every per-tournament key) and reloads into the clean main
// menu. Local only — never touches Firestore. Shared by the main menu (Landing)
// and the in-tournament Home screen.
export function ResetControl({ label = 'Reset app' }: { label?: string }) {
  const [open, setOpen] = useState(false);
  const [pwd, setPwd] = useState('');
  const [error, setError] = useState(false);

  const openDialog = () => {
    setPwd('');
    setError(false);
    setOpen(true);
  };

  const confirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd !== RESET_PASSWORD) {
      setError(true);
      return;
    }
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
              Enter the reset password to clear the active tournament and all data
              saved on this device, then return to the main menu. This only affects
              this device — it does not delete anything on the leaderboard.
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
