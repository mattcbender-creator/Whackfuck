import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useWFC } from '@/lib/store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Users, ShieldAlert, X, Trash2, CheckCircle2 } from 'lucide-react';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { collection, getDocs, deleteDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { fireEagleConfetti } from '@/lib/confetti';

const wfcLogo = `${import.meta.env.BASE_URL}wfc-logo.png`;

// ⚙️ TOURNAMENT ADMIN PASSWORD — change this string to rotate the password.
const ADMIN_RESET_PASSWORD = 'wfcreset2026';

export default function Home() {
  const [, setLocation] = useLocation();
  const { setTeamInfo, teamInfo, resetScores } = useWFC();
  const [teamName, setTeamName] = useState('');
  const [player1, setPlayer1] = useState('');
  const [player2, setPlayer2] = useState('');
  const [animate, setAnimate] = useState(false);
  const [editing, setEditing] = useState(false);

  // Admin reset modal state
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminPw, setAdminPw] = useState('');
  const [adminErr, setAdminErr] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);

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

  const closeAdmin = () => {
    setShowAdmin(false);
    setAdminPw('');
    setAdminErr('');
    setResetDone(false);
    setResetting(false);
  };

  const handleAdminReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPw !== ADMIN_RESET_PASSWORD) {
      setAdminErr('Wrong password. Try again.');
      return;
    }
    setAdminErr('');
    setResetting(true);

    try {
      // Wipe all Firestore collections that hold tournament data
      if (isFirebaseConfigured && db) {
        for (const name of ['teams', 'scores', 'liveFeed', 'events', 'longestDrives']) {
          const snap = await getDocs(collection(db, name));
          await Promise.all(snap.docs.map(d => deleteDoc(doc(db!, name, d.id))));
        }
        // Write a reset signal — every other connected device listens for this
        // and will auto-clear its own localStorage when it sees it.
        await setDoc(doc(db, 'config', 'tournament'), { resetAt: serverTimestamp() });
      }

      // Also clear this device's local state
      resetScores();
      setTeamName('');
      setPlayer1('');
      setPlayer2('');

      setResetDone(true);
      fireEagleConfetti();
      setTimeout(() => fireEagleConfetti(), 400);
    } catch (err) {
      console.error(err);
      setAdminErr('Reset failed — check your Firebase connection.');
      setResetting(false);
    }
  };

  const showForm = !teamInfo || editing;

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
            Dundee Country Club · Minus 5 or better = Tips
          </p>
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

            <div className="mt-3">
              <button
                onClick={() => setEditing(true)}
                className="w-full py-3 rounded-full bg-secondary text-secondary-foreground font-condensed font-bold uppercase tracking-widest text-sm hover:bg-secondary/80 transition-colors"
              >
                Change Team
              </button>
            </div>
          </div>
        )}

        {/* ── Registration form ── */}
        {showForm && (
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
                  <span className="text-[10px] text-muted-foreground ml-2">Net -5 or better</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wide">Women's</span>
                  <span className="text-[10px] text-muted-foreground ml-2">Everyone else</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Tournament Admin (always visible at bottom) ── */}
        <div className={`w-full transition-all duration-700 delay-500 transform ${animate ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
          <button
            onClick={() => setShowAdmin(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-full border border-border/50 bg-card/30 hover:bg-card/60 transition-colors"
          >
            <ShieldAlert className="w-4 h-4 text-muted-foreground" />
            <span className="font-condensed font-bold uppercase tracking-widest text-xs text-muted-foreground">Tournament Admin</span>
          </button>
        </div>

      </div>

      {/* ── Admin Reset Modal ── */}
      {showAdmin && (
        <div
          className="fixed inset-0 z-[60] bg-black/80 backdrop-blur flex items-center justify-center p-4"
          onClick={closeAdmin}
        >
          <div
            className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 relative"
            onClick={e => e.stopPropagation()}
          >
            <button onClick={closeAdmin} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>

            {resetDone ? (
              <div className="text-center py-6">
                <CheckCircle2 className="w-16 h-16 text-primary mx-auto mb-4" />
                <h3 className="font-condensed text-3xl font-black uppercase text-primary mb-2">
                  Tournament Reset!
                </h3>
                <p className="text-sm text-muted-foreground mb-6">
                  All scores and teams have been wiped.{'\n'}Everyone can now re-register fresh.
                </p>
                <button
                  onClick={closeAdmin}
                  className="w-full py-3 rounded-full bg-primary text-primary-foreground font-condensed font-black uppercase tracking-widest text-sm"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-full bg-red-500/15 border border-red-500/40 flex items-center justify-center shrink-0">
                    <Trash2 className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <h3 className="font-condensed text-xl font-black uppercase tracking-wider">Reset Tournament</h3>
                    <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                      Wipes all teams &amp; scores from every device instantly.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleAdminReset} className="space-y-3">
                  <Input
                    type="password"
                    autoFocus
                    placeholder="Admin password"
                    value={adminPw}
                    onChange={e => { setAdminPw(e.target.value); setAdminErr(''); }}
                    className="h-12 bg-input"
                  />
                  {adminErr && <p className="text-xs text-red-400">{adminErr}</p>}
                  <Button
                    type="submit"
                    disabled={resetting}
                    variant="destructive"
                    className="w-full h-12 font-condensed font-black uppercase tracking-widest rounded-full"
                  >
                    {resetting ? 'Wiping all data…' : 'Wipe All Tournament Data'}
                  </Button>
                  <p className="text-[10px] text-center text-muted-foreground">
                    This cannot be undone. All connected devices will update instantly.
                  </p>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
