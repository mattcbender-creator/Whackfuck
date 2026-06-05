import { useState } from 'react';
import { useLocation } from 'wouter';
import { useTournament, createTournamentDoc, fetchTournament } from '@/lib/tournamentContext';
import { isFirebaseConfigured } from '@/lib/firebase';
import { buildWfc2026Config, WFC_2026_ID } from '@/lib/tournament';
import { PlusCircle, LogIn, Eye, Trophy, ArrowRight, Repeat, WifiOff } from 'lucide-react';

const wfcLogo = `${import.meta.env.BASE_URL}wfc-logo.png`;

export default function Landing() {
  const [, setLocation] = useLocation();
  const { activeId, tournament, isSpectator, setActiveTournament, leaveTournament } = useTournament();
  const [seeding, setSeeding] = useState(false);

  const seedWfc = async () => {
    if (!isFirebaseConfigured) return;
    setSeeding(true);
    try {
      const existing = await fetchTournament(WFC_2026_ID);
      if (!existing) {
        await createTournamentDoc(buildWfc2026Config());
      } else {
        try { localStorage.setItem(`wfc-host-key::${WFC_2026_ID}`, existing.hostKey); } catch { /* ignore */ }
      }
      setActiveTournament(WFC_2026_ID);
      setLocation('/home');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center bg-background relative overflow-hidden px-6 py-10">
      <div
        className="absolute inset-0 z-0 pointer-events-none opacity-[0.06]"
        style={{ backgroundImage: 'radial-gradient(circle, #39FF14 1px, transparent 1px)', backgroundSize: '36px 36px' }}
      />
      <div className="z-10 flex flex-col items-center text-center w-full max-w-sm mx-auto gap-6">
        <img
          src={wfcLogo}
          alt="WFC"
          className="w-32 h-32 object-contain"
          style={{ filter: 'drop-shadow(0 0 24px rgba(57,255,20,0.28))' }}
          draggable={false}
        />
        <div>
          <h1 className="font-condensed font-black leading-[0.9] uppercase tracking-tight text-foreground" style={{ fontSize: 'clamp(2.4rem, 12vw, 3.6rem)' }}>
            Whack Fuck Cup
          </h1>
          <p className="mt-2 text-muted-foreground tracking-widest text-[11px] uppercase font-medium">
            Live tournament scoring
          </p>
        </div>

        {!isFirebaseConfigured && (
          <div className="w-full bg-card/50 border border-border/60 rounded-xl px-4 py-3 flex items-start gap-3 text-left">
            <WifiOff className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Live sync is off. Creating, joining, and spectating need a live connection. Single-device scoring still works.
            </p>
          </div>
        )}

        {/* Active tournament card */}
        {activeId && (
          <div className="w-full bg-card border border-primary/40 rounded-2xl p-4 text-left">
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] font-bold text-primary uppercase tracking-widest">You're in</span>
            </div>
            <p className="font-condensed text-2xl font-black text-foreground uppercase tracking-wide leading-tight">
              {tournament?.name ?? 'Tournament'}
            </p>
            {tournament?.courseName && (
              <p className="text-xs text-muted-foreground mt-0.5">{tournament.courseName}{isSpectator ? ' · Spectating' : ''}</p>
            )}
            <button
              onClick={() => setLocation(isSpectator ? '/leaderboard' : '/home')}
              data-testid="button-continue-tournament"
              className="mt-3 w-full bg-primary text-primary-foreground font-condensed text-xl font-black py-3.5 rounded-full uppercase tracking-widest active:scale-95 transition-all neon-border flex items-center justify-center gap-2"
            >
              Continue <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => leaveTournament()}
              data-testid="button-switch-tournament"
              className="mt-2 w-full py-2.5 rounded-full bg-secondary text-secondary-foreground font-condensed font-bold uppercase tracking-widest text-xs hover:bg-secondary/80 transition-colors flex items-center justify-center gap-2"
            >
              <Repeat className="w-3.5 h-3.5" /> Switch tournament
            </button>
          </div>
        )}

        {/* Entry actions */}
        <div className="w-full flex flex-col gap-3">
          <button
            onClick={() => setLocation('/create')}
            data-testid="button-create"
            className="w-full flex items-center gap-3 bg-primary text-primary-foreground font-condensed text-xl font-black py-4 px-5 rounded-2xl uppercase tracking-widest active:scale-95 transition-all neon-border"
          >
            <PlusCircle className="w-5 h-5" /> Create Tournament
          </button>
          <button
            onClick={() => setLocation('/join')}
            data-testid="button-join"
            className="w-full flex items-center gap-3 bg-card border border-border/70 text-foreground font-condensed text-xl font-black py-4 px-5 rounded-2xl uppercase tracking-widest active:scale-95 transition-all hover:border-primary/50"
          >
            <LogIn className="w-5 h-5 text-primary" /> Join Tournament
          </button>
          <button
            onClick={() => setLocation('/join')}
            data-testid="button-spectate"
            className="w-full flex items-center gap-3 bg-card/40 border border-border/50 text-muted-foreground font-condensed text-lg font-bold py-3.5 px-5 rounded-2xl uppercase tracking-widest active:scale-95 transition-all hover:text-foreground"
          >
            <Eye className="w-5 h-5" /> Spectate
          </button>
        </div>

        {/* WFC 2026 seed */}
        {isFirebaseConfigured && (
          <button
            onClick={seedWfc}
            disabled={seeding}
            data-testid="button-seed-wfc"
            className="text-[11px] text-muted-foreground/70 hover:text-primary transition-colors underline underline-offset-4 disabled:opacity-50"
          >
            {seeding ? 'Setting up…' : 'Initialize WFC 2026 (Dundee CC)'}
          </button>
        )}
      </div>
    </div>
  );
}
