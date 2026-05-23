import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useWFC } from '@/lib/store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Users, ShieldAlert } from 'lucide-react';

// June 27 2026, 7:00 AM Eastern (UTC-4 in summer / EDT)
const EVENT_START = new Date('2026-06-27T07:00:00-04:00');

function useCountdown() {
  const [parts, setParts] = useState<{ d: number; h: number; m: number; s: number } | null>(null);

  useEffect(() => {
    function tick() {
      const diff = EVENT_START.getTime() - Date.now();
      if (diff <= 0) {
        setParts(null);
        return;
      }
      const totalSecs = Math.floor(diff / 1000);
      setParts({
        d: Math.floor(totalSecs / 86400),
        h: Math.floor((totalSecs % 86400) / 3600),
        m: Math.floor((totalSecs % 3600) / 60),
        s: totalSecs % 60,
      });
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return parts;
}

function Countdown() {
  const parts = useCountdown();
  if (!parts) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <div className="w-full bg-card/50 border border-primary/30 rounded-2xl px-4 py-3 flex flex-col items-center gap-1.5">
      <span className="text-[9px] font-bold text-primary uppercase tracking-[0.2em]">
        Tournament Starts In
      </span>
      <div className="flex items-end gap-2">
        {parts.d > 0 && (
          <>
            <div className="flex flex-col items-center">
              <span
                className="font-condensed font-black text-foreground leading-none"
                style={{ fontSize: 'clamp(2rem, 10vw, 2.8rem)' }}
              >
                {parts.d}
              </span>
              <span className="text-[9px] text-muted-foreground uppercase tracking-widest mt-0.5">
                {parts.d === 1 ? 'day' : 'days'}
              </span>
            </div>
            <span className="font-condensed font-black text-primary/60 text-3xl mb-2">:</span>
          </>
        )}
        <div className="flex flex-col items-center">
          <span
            className="font-condensed font-black text-foreground leading-none tabular-nums"
            style={{ fontSize: 'clamp(2rem, 10vw, 2.8rem)' }}
          >
            {pad(parts.h)}
          </span>
          <span className="text-[9px] text-muted-foreground uppercase tracking-widest mt-0.5">hrs</span>
        </div>
        <span className="font-condensed font-black text-primary/60 text-3xl mb-2">:</span>
        <div className="flex flex-col items-center">
          <span
            className="font-condensed font-black text-foreground leading-none tabular-nums"
            style={{ fontSize: 'clamp(2rem, 10vw, 2.8rem)' }}
          >
            {pad(parts.m)}
          </span>
          <span className="text-[9px] text-muted-foreground uppercase tracking-widest mt-0.5">min</span>
        </div>
        <span className="font-condensed font-black text-primary/60 text-3xl mb-2">:</span>
        <div className="flex flex-col items-center">
          <span
            className="font-condensed font-black text-primary leading-none tabular-nums"
            style={{ fontSize: 'clamp(2rem, 10vw, 2.8rem)' }}
          >
            {pad(parts.s)}
          </span>
          <span className="text-[9px] text-muted-foreground uppercase tracking-widest mt-0.5">sec</span>
        </div>
      </div>
      <span className="text-[9px] text-muted-foreground">Jun 27 · Dundee CC</span>
    </div>
  );
}

const wfcLogo = `${import.meta.env.BASE_URL}wfc-logo.png`;

export default function Home() {
  const [, setLocation] = useLocation();
  const { setTeamInfo, teamInfo, hasSubmitted, serverTeamMissing, resetDevice } = useWFC();
  const [teamName, setTeamName] = useState('');
  const [player1, setPlayer1] = useState('');
  const [player2, setPlayer2] = useState('');
  const [animate, setAnimate] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimate(true), 80);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (teamInfo) {
      setTeamName(teamInfo.teamName);
      setPlayer1(teamInfo.player1);
      setPlayer2(teamInfo.player2);
    }
  }, [teamInfo]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim() || !player1.trim() || !player2.trim()) return;
    setTeamInfo({ teamName: teamName.trim(), player1: player1.trim(), player2: player2.trim() });
    setEditing(false);
    setLocation('/hole');
  };

  const showForm = !teamInfo || (editing && !hasSubmitted);

  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center bg-background relative overflow-hidden px-6">

      {/* Dot grid background */}
      <div
        className="absolute inset-0 z-0 pointer-events-none opacity-[0.06]"
        style={{
          backgroundImage: 'radial-gradient(circle, #39FF14 1px, transparent 1px)',
          backgroundSize: '36px 36px',
        }}
      />
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full pointer-events-none z-0"
        style={{ background: 'radial-gradient(circle, rgba(57,255,20,0.05) 0%, transparent 70%)' }}
      />

      <div className="z-10 flex flex-col items-center text-center w-full max-w-sm mx-auto gap-5">

        {/* Logo */}
        <div
          className={`transition-all duration-700 transform ${animate ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-6 opacity-0 scale-95'}`}
          style={{ filter: 'drop-shadow(0 0 24px rgba(57,255,20,0.28)) drop-shadow(0 0 52px rgba(57,255,20,0.10))' }}
        >
          <img
            src={wfcLogo}
            alt="WFC – Whack Fuck Cup"
            className="w-44 h-44 object-contain mx-auto"
            draggable={false}
          />
        </div>

        {/* Wordmark */}
        <div className={`transition-all duration-700 delay-100 transform ${animate ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
          <h1
            className="font-condensed font-black leading-[0.9] uppercase tracking-tight text-foreground"
            style={{ fontSize: 'clamp(2.8rem, 15vw, 4.8rem)' }}
          >
            WHACK FUCK CUP
          </h1>
          <p className="mt-3 text-muted-foreground tracking-widest text-[11px] uppercase font-medium">
            Dundee Country Club · Under par = Tips
          </p>
        </div>

        {/* Countdown timer — auto-hides at 7am day of event */}
        <div className={`w-full transition-all duration-700 delay-150 transform ${animate ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
          <Countdown />
        </div>

        {/* ── Team already registered ── */}
        {teamInfo && !editing && (
          <div className={`w-full transition-all duration-700 delay-200 transform ${animate ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>

            {/* Team card */}
            <div className="bg-card border border-border/60 rounded-2xl p-4 text-left mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Your Team</span>
              </div>
              <p className="font-condensed text-2xl font-black text-foreground uppercase tracking-wide leading-tight">
                {teamInfo.teamName}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {teamInfo.player1} &amp; {teamInfo.player2}
              </p>
            </div>

            <button
              data-testid="button-start-tournament"
              onClick={() => setLocation('/hole')}
              className="w-full bg-primary text-primary-foreground font-condensed text-2xl font-black py-5 rounded-full uppercase tracking-widest transition-all active:scale-95 neon-border"
            >
              Continue Round
            </button>

            {!hasSubmitted ? (
              <div className="mt-3">
                <button
                  onClick={() => setEditing(true)}
                  className="w-full py-3 rounded-full bg-secondary text-secondary-foreground font-condensed font-bold uppercase tracking-widest text-sm hover:bg-secondary/80 transition-colors"
                >
                  Change Team
                </button>
              </div>
            ) : (
              <div className="mt-3 w-full py-3 rounded-full border border-primary/40 bg-primary/10 flex items-center justify-center gap-2">
                <span className="font-condensed font-bold uppercase tracking-widest text-xs text-primary">
                  Round Submitted — Team Locked
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── Locked-out state: round already submitted, but no teamInfo
            (e.g. browser data was cleared on this device). Don't show the
            registration form — that would let someone start a brand-new round
            from a "blank" home screen. ── */}
        {!teamInfo && hasSubmitted && (
          <div className={`w-full transition-all duration-700 delay-200 transform ${animate ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
            <div className="bg-card border border-primary/40 rounded-2xl p-5 text-center">
              <p className="font-condensed text-xl font-black uppercase tracking-wide text-primary mb-1">
                Round Already Submitted
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                A final score for this device is already on the leaderboard. See the tournament admin if something looks wrong.
              </p>
            </div>
          </div>
        )}

        {/* ── Escape hatch: device says "submitted" but the server has no
            record of this team (admin deleted them, or it's a stale test
            device). Lets the user wipe local state and re-register from
            scratch. Hidden for genuinely-submitted teams whose server doc
            still exists. ── */}
        {hasSubmitted && serverTeamMissing && (
          <div className={`w-full transition-all duration-700 delay-300 transform ${animate ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
            <div className="bg-card/40 border border-border/40 rounded-xl p-4 text-center space-y-3">
              <div className="text-left">
                <p className="font-condensed text-sm font-bold uppercase tracking-widest text-foreground/80 mb-1">
                  This team isn't on the server
                </p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Looks like an admin deleted this team, or this is a test device. You can wipe this device and register again.
                </p>
              </div>
              <button
                onClick={() => {
                  if (window.confirm('Wipe this device and start over? Your local data will be cleared and the page will reload.')) {
                    resetDevice();
                  }
                }}
                data-testid="button-reset-device"
                className="w-full py-3 rounded-full bg-secondary text-secondary-foreground font-condensed font-bold uppercase tracking-widest text-sm hover:bg-secondary/80 transition-colors"
              >
                Start Fresh on This Device
              </button>
            </div>
          </div>
        )}

        {/* ── Registration form ── */}
        {showForm && !hasSubmitted && (
          <div className={`w-full transition-all duration-700 delay-200 transform ${animate ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Team Name</label>
                <Input
                  data-testid="input-team-name"
                  value={teamName}
                  onChange={e => setTeamName(e.target.value)}
                  placeholder="e.g. The Mulligans"
                  className="h-12 bg-input/60 border-border/80 focus:border-primary text-base"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Player 1</label>
                  <Input
                    data-testid="input-player1"
                    value={player1}
                    onChange={e => setPlayer1(e.target.value)}
                    placeholder="Name"
                    className="h-12 bg-input/60 border-border/80 focus:border-primary text-base"
                    required
                  />
                </div>
                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Player 2</label>
                  <Input
                    data-testid="input-player2"
                    value={player2}
                    onChange={e => setPlayer2(e.target.value)}
                    placeholder="Name"
                    className="h-12 bg-input/60 border-border/80 focus:border-primary text-base"
                    required
                  />
                </div>
              </div>

              <Button
                data-testid="button-submit-team"
                type="submit"
                className="w-full h-14 font-condensed text-2xl font-black tracking-widest uppercase rounded-full neon-border"
              >
                Start Tournament
              </Button>

              {editing && (
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                >
                  Cancel
                </button>
              )}
            </form>
          </div>
        )}

        {/* ── Tee rule note ── */}
        {!showForm && (
          <p className={`text-[10px] text-muted-foreground/60 transition-all duration-700 delay-300 ${animate ? 'opacity-100' : 'opacity-0'}`}>
            Tee auto-updates as you score each hole.
          </p>
        )}

        {showForm && (
          <div className={`w-full transition-all duration-700 delay-300 transform ${animate ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
            <div className="bg-card/40 border border-border/40 rounded-xl p-3 text-left">
              <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1.5">Tee Assignment</p>
              <div className="flex gap-4">
                <div>
                  <span className="text-[10px] font-bold text-red-400 uppercase tracking-wide">Tips</span>
                  <span className="text-[10px] text-muted-foreground ml-2">Raw score under par</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wide">Women's</span>
                  <span className="text-[10px] text-muted-foreground ml-2">Everyone else</span>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground/80 mt-2 leading-snug">
                Based on your <span className="font-bold text-foreground/80">scorecard vs par only</span>. Wheel hits add to your net but never move your tee block.
              </p>
            </div>
          </div>
        )}

        {/* ── Tournament Admin link ── */}
        <div className={`w-full transition-all duration-700 delay-500 transform ${animate ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
          <button
            onClick={() => setLocation('/admin')}
            data-testid="button-open-admin"
            className="w-full flex items-center justify-center gap-2 py-3 rounded-full border border-border/50 bg-card/30 hover:bg-card/60 transition-colors"
          >
            <ShieldAlert className="w-4 h-4 text-muted-foreground" />
            <span className="font-condensed font-bold uppercase tracking-widest text-xs text-muted-foreground">Tournament Admin</span>
          </button>
        </div>

      </div>
    </div>
  );
}
