import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useWFC, type TeamSnapshot } from '@/lib/store';
import { useTournament } from '@/lib/tournamentContext';
import { WFC_2026_ID, formatPlayers, teamSubtitle } from '@/lib/tournament';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ResetControl } from '@/components/ResetControl';
import { FinalizedBanner } from '@/components/FinalizedBanner';
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

function TeamInvite({ joinCode, teamCode, requireCode }: { joinCode: string; teamCode: string; requireCode: boolean }) {
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
    <div className="bg-card/40 border border-primary/40 rounded-xl p-4 mb-3 text-left">
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
        {requireCode ? 'Share this code with your team' : 'Invite your team'}
      </p>
      {requireCode && (
        <p className="font-condensed text-5xl font-black text-primary tracking-[0.25em] mb-3 leading-none">{teamCode}</p>
      )}
      <p className="text-[11px] text-muted-foreground mb-3 leading-snug">
        {requireCode
          ? 'Your teammates need this code to rejoin on their device.'
          : 'Send your teammates this link — they tap your team to join, no code needed.'}
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
  const { setTeamInfo, teamInfo, teamCode, hasSubmitted, serverTeamMissing, resetDevice, listTeamsOnce, adoptTeam } = useWFC();
  const { tournament, activeId, autoTeeRule, leaveTournament } = useTournament();
  const isLocked = hasSubmitted || tournament?.status === 'final';

  const teamSize = Math.max(1, Math.min(4, tournament?.teamSize ?? 2));
  const joinCode = tournament?.joinCode ?? '';
  const isWfc2026 = activeId === WFC_2026_ID;
  // Host setting: when off, teams don't name themselves — player names are used.
  const useTeamNames = tournament?.useTeamNames !== false;

  const [teamName, setTeamName] = useState('');
  const [players, setPlayers] = useState<string[]>(() => Array(teamSize).fill(''));
  const [animate, setAnimate] = useState(false);
  const [editing, setEditing] = useState(false);
  const [nameTaken, setNameTaken] = useState(false);
  const [existingTeams, setExistingTeams] = useState<TeamSnapshot[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);

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

  // Fetch existing teams when someone hasn't registered yet, so they can join
  // a teammate instead of accidentally creating a duplicate team.
  useEffect(() => {
    if (teamInfo || hasSubmitted) return;
    setTeamsLoading(true);
    listTeamsOnce()
      .then(teams => setExistingTeams(teams))
      .catch(() => setExistingTeams([]))
      .finally(() => setTeamsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!teamInfo, hasSubmitted]);

  useEffect(() => {
    const name = teamName.trim();
    if (!name || isLocked || !useTeamNames) { setNameTaken(false); return; }
    const t = setTimeout(async () => {
      try {
        const existing = await listTeamsOnce();
        setNameTaken(existing.some(e => e.teamName.toLowerCase() === name.toLowerCase()));
      } catch {
        setNameTaken(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [teamName, isLocked, useTeamNames]);

  const setPlayerAt = (i: number, val: string) => {
    setPlayers(prev => prev.map((p, idx) => (idx === i ? val : p)));
  };
  const addPlayer = () => setPlayers(prev => (prev.length < teamSize ? [...prev, ''] : prev));
  const removePlayer = (i: number) => setPlayers(prev => prev.filter((_, idx) => idx !== i));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = players.map(p => p.trim()).filter(Boolean);
    const typedName = teamName.trim();
    // When the host disabled team names, the players' names ARE the team name.
    // Otherwise use the typed name, falling back to the player list (or a
    // generic label) so the stored team always has a non-blank display name.
    const name = useTeamNames
      ? (typedName || formatPlayers(cleaned) || 'Team')
      : (formatPlayers(cleaned) || 'Team');
    if (cleaned.length === 0 || nameTaken) return;

    const wasEditing = editing;
    setTeamInfo({ teamName: name, players: cleaned });
    setEditing(false);
    if (!wasEditing) {
      // First registration → go straight to hole view
      setLocation('/hole');
    }
    // Edit → stay on home, form closes, team card refreshes
  };

  const showForm = !teamInfo || (editing && !hasSubmitted);

  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center bg-background relative overflow-x-hidden overflow-y-auto px-6">

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

      <div className="z-10 flex flex-col items-center text-center w-full max-w-sm mx-auto gap-5 pt-10 pb-28 my-auto">

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

        {/* Finalized notice + host reopen — surfaces the locked state so scoring
            taps that silently no-op are explained and recoverable. */}
        <FinalizedBanner />

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
              {teamSubtitle(teamInfo.teamName, teamInfo.players) && (
                <p className="text-sm text-muted-foreground mt-1">
                  {teamSubtitle(teamInfo.teamName, teamInfo.players)}
                </p>
              )}
            </div>

            {joinCode && teamCode && !hasSubmitted && (
              <TeamInvite joinCode={joinCode} teamCode={teamCode} requireCode={tournament?.requireTeamCode !== false} />
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
                  Edit Team
                </button>
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                <div className="w-full py-3 rounded-full border border-primary/40 bg-primary/10 flex items-center justify-center gap-2">
                  <span className="font-condensed font-bold uppercase tracking-widest text-xs text-primary">
                    Round Submitted — Team Locked
                  </span>
                </div>
                <button
                  onClick={() => {
                    if (window.confirm('Leave this tournament? You can join or create another one from the home screen.')) {
                      leaveTournament();
                    }
                  }}
                  className="w-full py-2.5 rounded-full bg-secondary text-secondary-foreground font-condensed font-bold uppercase tracking-widest text-xs hover:bg-secondary/80 transition-colors"
                >
                  Leave Tournament
                </button>
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

        {/* ── Existing teams to join — shown to unregistered devices so teammates
            don't accidentally create duplicate teams ── */}
        {!teamInfo && !hasSubmitted && !editing && existingTeams.length > 0 && (
          <div className={`w-full transition-all duration-700 delay-150 transform ${animate ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
            <div className="space-y-2">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                <Users className="w-3 h-3" />
                {teamsLoading ? 'Loading teams…' : 'Join a team already in the tournament'}
              </p>
              {existingTeams.map(t => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-3 bg-card border border-border/60 rounded-2xl px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-condensed font-black uppercase tracking-tight text-base text-foreground leading-tight truncate">
                      {t.teamName}
                    </p>
                    {teamSubtitle(t.teamName, t.players) && (
                      <p className="text-[11px] text-muted-foreground truncate">
                        {teamSubtitle(t.teamName, t.players)}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => adoptTeam(t.id)}
                    className="shrink-0 px-4 py-2 rounded-full bg-primary text-black font-condensed font-black uppercase tracking-widest text-xs hover:opacity-90 transition-opacity"
                  >
                    Join
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-3 py-1">
                <div className="h-px flex-1 bg-border/40" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest">or create a new team</span>
                <div className="h-px flex-1 bg-border/40" />
              </div>
            </div>
          </div>
        )}

        {/* ── Registration form ── */}
        {showForm && !hasSubmitted && (
          <div className={`w-full transition-all duration-700 delay-200 transform ${animate ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>

            <form onSubmit={handleSubmit} className="space-y-4">
              {useTeamNames && (
                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Team Name</label>
                  <Input
                    data-testid="input-team-name"
                    value={teamName}
                    onChange={e => setTeamName(e.target.value)}
                    placeholder="e.g. The Mulligans"
                    className="h-12 bg-input/60 border-border/80 focus:border-primary text-base disabled:opacity-50"
                    disabled={isLocked}
                  />
                </div>
              )}

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
                        className="h-12 bg-input/60 border-border/80 focus:border-primary text-base disabled:opacity-50"
                        disabled={isLocked}
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

              {nameTaken && (
                <p className="text-xs font-bold text-destructive uppercase tracking-wide -mt-1">
                  Name taken. Tap JOIN on the existing team above.
                </p>
              )}

              <Button
                data-testid="button-submit-team"
                type="submit"
                disabled={isLocked || nameTaken}
                className="w-full h-14 font-condensed text-2xl font-black tracking-widest uppercase rounded-full neon-border disabled:opacity-50"
              >
                {editing ? 'Save Changes' : 'Start Tournament'}
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

        {/* Password-gated full reset — wipes all local data on this device */}
        <ResetControl label="Reset app" />

      </div>
    </div>
  );
}
