import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useWFC } from '@/lib/store';
import { useTournament } from '@/lib/tournamentContext';
import { WFC_2026_ID, formatPlayers } from '@/lib/tournament';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Users, ShieldAlert, Share2, Copy, Check, Plus, X } from 'lucide-react';

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

function TeamInvite({ joinCode, teamCode }: { joinCode: string; teamCode: string }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}${import.meta.env.BASE_URL}join/${joinCode}/${teamCode}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };
  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: 'Join my team', url: link }); } catch { /* ignore */ }
    } else {
      copy();
    }
  };

  return (
    <div className="bg-card/40 border border-border/50 rounded-xl p-3 mb-3 text-left">
      <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Team code · {teamCode}</p>
      <p className="text-[11px] text-muted-foreground mb-2 leading-snug">
        Share so a teammate can score on their own phone, or rejoin if you switch devices.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={copy}
          data-testid="button-copy-invite"
          className="flex items-center justify-center gap-1.5 py-2 rounded-full bg-secondary text-secondary-foreground font-condensed font-bold uppercase tracking-widest text-[11px]"
        >
          {copied ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy link</>}
        </button>
        <button
          onClick={share}
          data-testid="button-share-invite"
          className="flex items-center justify-center gap-1.5 py-2 rounded-full bg-primary text-primary-foreground font-condensed font-bold uppercase tracking-widest text-[11px]"
        >
          <Share2 className="w-3 h-3" /> Share
        </button>
      </div>
    </div>
  );
}

export default function Home() {
  const [, setLocation] = useLocation();
  const { setTeamInfo, teamInfo, teamCode, hasSubmitted, serverTeamMissing, resetDevice } = useWFC();
  const { tournament, activeId, autoTeeRule } = useTournament();

  const teamSize = Math.max(1, Math.min(4, tournament?.teamSize ?? 2));
  const joinCode = tournament?.joinCode ?? '';
  const isWfc2026 = activeId === WFC_2026_ID;

  const [teamName, setTeamName] = useState('');
  const [players, setPlayers] = useState<string[]>(() => Array(teamSize).fill(''));
  const [animate, setAnimate] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimate(true), 80);
    return () => clearTimeout(t);
  }, []);

  // Keep the empty form sized to the tournament's team size.
  useEffect(() => {
    if (!teamInfo) setPlayers(prev => (prev.length === teamSize ? prev : Array(teamSize).fill('')));
  }, [teamSize, teamInfo]);

  useEffect(() => {
    if (teamInfo) {
      setTeamName(teamInfo.teamName);
      const p = [...teamInfo.players];
      while (p.length < teamSize) p.push('');
      setPlayers(p.slice(0, Math.max(teamSize, teamInfo.players.length)));
    }
  }, [teamInfo, teamSize]);

  const setPlayerAt = (i: number, val: string) => {
    setPlayers(prev => prev.map((p, idx) => (idx === i ? val : p)));
  };
  const addPlayer = () => setPlayers(prev => (prev.length < teamSize ? [...prev, ''] : prev));
  const removePlayer = (i: number) => setPlayers(prev => prev.filter((_, idx) => idx !== i));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = players.map(p => p.trim()).filter(Boolean);
    if (!teamName.trim() || cleaned.length === 0) return;
    setTeamInfo({ teamName: teamName.trim(), players: cleaned });
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

      <div className="z-10 flex flex-col items-center text-center w-full max-w-sm mx-auto gap-5 py-10">

        {/* Logo */}
        <div
          className={`transition-all duration-700 transform ${animate ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-6 opacity-0 scale-95'}`}
          style={{ filter: 'drop-shadow(0 0 24px rgba(57,255,20,0.28)) drop-shadow(0 0 52px rgba(57,255,20,0.10))' }}
        >
          <img
            src={wfcLogo}
            alt="WFC"
            className="w-36 h-36 object-contain mx-auto"
            draggable={false}
          />
        </div>

        {/* Wordmark */}
        <div className={`transition-all duration-700 delay-100 transform ${animate ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
          <h1
            className="font-condensed font-black leading-[0.9] uppercase tracking-tight text-foreground"
            style={{ fontSize: 'clamp(2.4rem, 13vw, 4rem)' }}
          >
            {tournament?.name ?? 'Tournament'}
          </h1>
          <p className="mt-3 text-muted-foreground tracking-widest text-[11px] uppercase font-medium">
            {tournament?.courseName ?? ''}{autoTeeRule ? ' · Under par = Tips' : ''}
          </p>
        </div>

        {/* Countdown — WFC 2026 only */}
        {isWfc2026 && (
          <div className={`w-full transition-all duration-700 delay-150 transform ${animate ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
            <Countdown />
          </div>
        )}

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
                {formatPlayers(teamInfo.players)}
              </p>
            </div>

            {joinCode && teamCode && !hasSubmitted && (
              <TeamInvite joinCode={joinCode} teamCode={teamCode} />
            )}

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

        {/* ── Locked-out state ── */}
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

        {/* ── Escape hatch ── */}
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

              <div className="space-y-2">
                {players.map((p, i) => (
                  <div key={i} className="space-y-1.5 text-left">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      Player {i + 1}{i === 0 ? '' : ' (optional)'}
                    </label>
                    <div className="flex gap-2">
                      <Input
                        data-testid={`input-player-${i + 1}`}
                        value={p}
                        onChange={e => setPlayerAt(i, e.target.value)}
                        placeholder="Name"
                        className="h-12 bg-input/60 border-border/80 focus:border-primary text-base"
                        required={i === 0}
                      />
                      {players.length > 1 && i > 0 && (
                        <button
                          type="button"
                          onClick={() => removePlayer(i)}
                          aria-label="Remove player"
                          className="shrink-0 w-12 h-12 rounded-md bg-secondary/60 text-muted-foreground hover:text-foreground flex items-center justify-center"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {players.length < teamSize && (
                  <button
                    type="button"
                    onClick={addPlayer}
                    data-testid="button-add-player"
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-border/70 text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors font-condensed font-bold uppercase tracking-widest text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add player
                  </button>
                )}
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

        {/* ── Tee rule note (auto-tee tournaments only) ── */}
        {!showForm && autoTeeRule && (
          <p className={`text-[10px] text-muted-foreground/60 transition-all duration-700 delay-300 ${animate ? 'opacity-100' : 'opacity-0'}`}>
            Tee auto-updates as you score each hole.
          </p>
        )}

        {showForm && autoTeeRule && (
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
