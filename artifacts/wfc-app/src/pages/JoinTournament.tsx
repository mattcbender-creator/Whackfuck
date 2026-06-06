import { useState, useEffect, useCallback } from 'react';
import { useLocation, useParams } from 'wouter';
import { Input } from '@/components/ui/input';
import { useTournament, fetchTeamsForTournament, type TeamLookup } from '@/lib/tournamentContext';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { onSnapshot, collection } from 'firebase/firestore';
import {
  type TournamentConfig, formatPlayers,
  teamIdKey, joinedAtKey, storeKey, hostKeyKey,
} from '@/lib/tournament';
import {
  ArrowLeft, LogIn, UserPlus, Repeat, Eye, AlertTriangle, ArrowRight, Users, WifiOff, KeyRound,
} from 'lucide-react';

type Step = 'code' | 'choose' | 'rejoin';

export default function JoinTournament() {
  const [location, setLocation] = useLocation();
  const params = useParams<{ code?: string; teamCode?: string }>();
  const { enterAsPlayer, enterSpectator, lookupJoinCode } = useTournament();

  const watchIntent = location.startsWith('/watch');

  const [step, setStep] = useState<Step>('code');
  const [codeInput, setCodeInput] = useState(params.code ?? '');
  const [resolved, setResolved] = useState<TournamentConfig | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [teams, setTeams] = useState<TeamLookup[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<TeamLookup | null>(null);
  const [teamCodeInput, setTeamCodeInput] = useState('');

  const [showHostEntry, setShowHostEntry] = useState(false);
  const [hostKeyInput, setHostKeyInput] = useState('');
  const [hostKeyError, setHostKeyError] = useState('');

  const claimAndEnterAsHost = (t: TournamentConfig) => {
    const key = hostKeyInput.trim();
    if (!key) { setHostKeyError('Enter the recovery key.'); return; }
    if (key !== t.hostKey) { setHostKeyError('That key doesn\u2019t match. Check your screenshot.'); return; }
    try { localStorage.setItem(hostKeyKey(t.id), key); } catch { /* ignore */ }
    enterAsPlayer(t.id);
    setLocation('/home');
  };

  // Enter the tournament as a fresh device (registration happens on Home).
  const enterToRegister = (t: TournamentConfig) => {
    enterAsPlayer(t.id);
    setLocation('/home');
  };

  // Adopt an existing team's identity then enter.
  const enterAsTeam = (t: TournamentConfig, teamId: string) => {
    try {
      localStorage.setItem(teamIdKey(t.id), teamId);
      localStorage.setItem(joinedAtKey(t.id), String(Date.now()));
      localStorage.removeItem(storeKey(t.id));
    } catch { /* ignore */ }
    enterAsPlayer(t.id);
    setLocation('/home');
  };

  const enterToSpectate = (t: TournamentConfig) => {
    enterSpectator(t.id);
    setLocation('/leaderboard');
  };

  const resolveCode = useCallback(async (code: string, autoTeamCode?: string) => {
    setError('');
    if (!isFirebaseConfigured) { setError('A live connection is required to join.'); return; }
    const norm = code.trim().toUpperCase();
    if (norm.length < 4) { setError('Enter the full join code.'); return; }
    setBusy(true);
    try {
      const t = await lookupJoinCode(norm);
      if (!t) { setError('No tournament found for that code.'); return; }
      setResolved(t);
      // Watch deep-link → straight to spectate.
      if (watchIntent) { enterToSpectate(t); return; }
      // Team deep-link → adopt that team directly.
      if (autoTeamCode) {
        const list = await fetchTeamsForTournament(t.id);
        const match = list.find(tm => tm.teamCode && tm.teamCode.toUpperCase() === autoTeamCode.toUpperCase());
        if (match) { enterAsTeam(t, match.id); return; }
        setTeams(list);
        setError('That team link didn\u2019t match — pick your team below.');
        setStep('rejoin');
        return;
      }
      setStep('choose');
    } catch {
      setError('Something went wrong looking up that code.');
    } finally {
      setBusy(false);
    }
  }, [lookupJoinCode, watchIntent]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-resolve when arriving via a link.
  useEffect(() => {
    if (params.code) resolveCode(params.code, params.teamCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real-time team list while the rejoin step is active.
  useEffect(() => {
    if (step !== 'rejoin' || !resolved || !isFirebaseConfigured || !db) return;
    const col = collection(db, 'tournaments', resolved.id, 'teams');
    const unsub = onSnapshot(col, snap => {
      const entries = snap.docs.map(d => {
        const data = d.data();
        const players = Array.isArray(data.players)
          ? (data.players as unknown[]).filter((p): p is string => typeof p === 'string')
          : ([data.player1, data.player2] as unknown[]).filter((p): p is string => typeof p === 'string' && !!p);
        const lu = data.lastUpdated;
        const ts: number = lu && typeof lu.toMillis === 'function'
          ? (lu.toMillis() as number)
          : typeof lu === 'number' ? lu : 0;
        return {
          id: d.id,
          teamName: typeof data.teamName === 'string' ? data.teamName : 'Team',
          players,
          teamCode: typeof data.teamCode === 'string' ? data.teamCode : '',
          ts,
        };
      });
      entries.sort((a, b) => b.ts - a.ts);
      setTeams(entries.map(e => ({ id: e.id, teamName: e.teamName, players: e.players, teamCode: e.teamCode })));
    }, () => { /* ignore snapshot errors */ });
    return () => unsub();
  }, [step, resolved?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const openRejoin = () => {
    if (!resolved) return;
    setTeams([]);
    setStep('rejoin');
  };

  const confirmRejoin = () => {
    if (!resolved || !selectedTeam) return;
    if (teamCodeInput.trim().toUpperCase() !== (selectedTeam.teamCode ?? '').toUpperCase()) {
      setError('Team code doesn\u2019t match. Ask a teammate for the 4-character code.');
      return;
    }
    enterAsTeam(resolved, selectedTeam.id);
  };

  return (
    <div className="min-h-[100dvh] w-full bg-background px-6 py-8">
      <div className="max-w-md mx-auto">
        <button
          onClick={() => (step === 'code' ? setLocation('/') : setStep('code'))}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-sm mb-6"
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <h1 className="font-condensed text-4xl font-black uppercase tracking-tight text-foreground mb-2">
          {watchIntent ? 'Spectate' : 'Join'} <span className="text-primary">Tournament</span>
        </h1>

        {!isFirebaseConfigured && (
          <div className="mb-6 bg-card/50 border border-border/60 rounded-xl px-4 py-3 flex items-start gap-3">
            <WifiOff className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Live sync is off, so joining isn't available on this device.
            </p>
          </div>
        )}

        {/* STEP: code entry */}
        {step === 'code' && (
          <div className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">Enter the 6-character code your host shared.</p>
            <Input
              value={codeInput}
              onChange={e => setCodeInput(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={6}
              data-testid="input-join-code"
              className="h-16 text-center font-condensed text-3xl font-black tracking-[0.4em] bg-input/60 border-border/80 focus:border-primary"
            />
            {error && <ErrorNote text={error} />}
            <button
              onClick={() => resolveCode(codeInput)}
              disabled={busy}
              data-testid="button-resolve-code"
              className="w-full h-14 bg-primary text-primary-foreground font-condensed text-2xl font-black tracking-widest uppercase rounded-full neon-border active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <LogIn className="w-5 h-5" /> {busy ? 'Checking…' : 'Continue'}
            </button>
          </div>
        )}

        {/* STEP: choose */}
        {step === 'choose' && resolved && (
          <div className="space-y-4 mt-4">
            <div className="bg-card border border-primary/40 rounded-2xl p-4">
              <p className="font-condensed text-2xl font-black text-foreground uppercase tracking-wide leading-tight">{resolved.name}</p>
              {resolved.courseName && <p className="text-xs text-muted-foreground mt-0.5">{resolved.courseName}</p>}
            </div>
            {error && <ErrorNote text={error} />}
            <ChoiceButton icon={UserPlus} title="Register new team" desc="Start a fresh team and get an invite link" onClick={() => enterToRegister(resolved)} testid="button-register" />
            <ChoiceButton icon={Repeat} title="Rejoin my team" desc="Get back in on this device" onClick={openRejoin} testid="button-open-rejoin" />
            <ChoiceButton icon={Eye} title="Spectate" desc="Watch the leaderboard, read-only" onClick={() => enterToSpectate(resolved)} testid="button-spectate-choice" />

            {/* Subtle host recovery — only shown when tapped */}
            {!showHostEntry ? (
              <button
                type="button"
                onClick={() => { setShowHostEntry(true); setHostKeyError(''); }}
                data-testid="button-show-host-recovery"
                className="w-full text-center text-[11px] text-muted-foreground/50 hover:text-muted-foreground py-1 transition-colors"
              >
                I&apos;m the host on a new device
              </button>
            ) : (
              <div className="bg-card border border-border/60 rounded-2xl px-4 py-4 space-y-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-primary shrink-0" />
                  <p className="font-condensed text-lg font-black uppercase tracking-wide text-foreground leading-tight">Host Recovery</p>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Enter the recovery key from your tournament setup screenshot.
                </p>
                <Input
                  value={hostKeyInput}
                  onChange={e => { setHostKeyInput(e.target.value.trim()); setHostKeyError(''); }}
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  data-testid="input-host-key"
                  className="h-12 text-center font-mono text-sm font-bold tracking-widest bg-input/60 border-border/80 focus:border-primary"
                  autoCapitalize="characters"
                />
                {hostKeyError && <ErrorNote text={hostKeyError} />}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setShowHostEntry(false); setHostKeyInput(''); setHostKeyError(''); }}
                    className="flex-1 h-11 rounded-xl border border-border/70 text-sm font-bold uppercase tracking-widest text-muted-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => claimAndEnterAsHost(resolved)}
                    data-testid="button-claim-host"
                    className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground text-sm font-black uppercase tracking-widest"
                  >
                    Claim Access
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP: rejoin */}
        {step === 'rejoin' && resolved && (
          <div className="space-y-4 mt-4">
            {error && <ErrorNote text={error} />}
            {!selectedTeam ? (
              <>
                <p className="text-sm text-muted-foreground">Pick your team:</p>
                {teams.length === 0 && (
                  <p className="text-sm text-muted-foreground/70 py-4 text-center">
                    {isFirebaseConfigured ? 'Loading teams…' : 'No teams registered yet.'}
                  </p>
                )}
                <div className="space-y-2">
                  {teams.map(tm => (
                    <div
                      key={tm.id}
                      className="w-full flex items-center justify-between gap-3 bg-card border border-border/70 rounded-xl px-4 py-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Users className="w-4 h-4 text-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="font-bold text-foreground truncate">{tm.teamName}</p>
                          {tm.players.length > 0 && (
                            <p className="text-[11px] text-muted-foreground truncate">{formatPlayers(tm.players)}</p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => { setSelectedTeam(tm); setError(''); }}
                        data-testid={`button-team-${tm.id}`}
                        className="shrink-0 h-9 px-4 rounded-full bg-primary text-primary-foreground font-condensed font-bold uppercase tracking-widest text-xs active:scale-95 transition-all"
                      >
                        Join
                      </button>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="bg-card border border-primary/40 rounded-2xl p-4">
                  <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Rejoining</p>
                  <p className="font-condensed text-2xl font-black text-foreground uppercase tracking-wide">{selectedTeam.teamName}</p>
                </div>
                <p className="text-sm text-muted-foreground">Enter your team's 4-character code:</p>
                <Input
                  value={teamCodeInput}
                  onChange={e => setTeamCodeInput(e.target.value.toUpperCase())}
                  placeholder="WXYZ"
                  maxLength={4}
                  data-testid="input-team-code"
                  className="h-14 text-center font-condensed text-2xl font-black tracking-[0.4em] bg-input/60 border-border/80 focus:border-primary"
                />
                <button
                  onClick={confirmRejoin}
                  data-testid="button-confirm-rejoin"
                  className="w-full h-14 bg-primary text-primary-foreground font-condensed text-2xl font-black tracking-widest uppercase rounded-full neon-border active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  Rejoin <ArrowRight className="w-5 h-5" />
                </button>
                <button
                  onClick={() => { setSelectedTeam(null); setTeamCodeInput(''); setError(''); }}
                  className="w-full text-xs text-muted-foreground hover:text-foreground py-1"
                >
                  Pick a different team
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ErrorNote({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 bg-destructive/15 border border-destructive/40 rounded-xl px-4 py-3">
      <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
      <p className="text-sm text-destructive">{text}</p>
    </div>
  );
}

function ChoiceButton({ icon: Icon, title, desc, onClick, testid }: {
  icon: typeof UserPlus; title: string; desc: string; onClick: () => void; testid: string;
}) {
  return (
    <button
      onClick={onClick}
      data-testid={testid}
      className="w-full flex items-center gap-3 bg-card border border-border/70 rounded-2xl px-4 py-4 text-left hover:border-primary/50 transition-colors active:scale-[0.98]"
    >
      <Icon className="w-5 h-5 text-primary shrink-0" />
      <div>
        <p className="font-condensed text-lg font-black uppercase tracking-wide text-foreground leading-tight">{title}</p>
        <p className="text-[11px] text-muted-foreground">{desc}</p>
      </div>
    </button>
  );
}
