import { useState, useEffect } from 'react';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, getDocs, deleteDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useWFC } from '@/lib/store';
import { Crown, X, Trash2, Flame, CheckCircle2, Target, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fireEagleConfetti } from '@/lib/confetti';
import { getWheelItem, type WheelItemId } from '@/lib/wheel';
import type { WheelSpinRecord, TargetedByEntry } from '@/lib/store';

// ⚙️ ADMIN RESET PASSWORD — change this string to rotate the reset password.
// Also referenced in README.md ("Change the admin reset password" section).
const ADMIN_RESET_PASSWORD = 'wfcreset2026';

interface TeamData {
  id: string;
  teamName: string;
  player1: string;
  player2: string;
  netScore: number;
  holesPlayed: number;
  currentTee: string;
  lastUpdated?: string;
  wheelSpin?: WheelSpinRecord | null;
  targetedBy?: TargetedByEntry[];
  wheelAdjustment?: number;
  booActive?: boolean;
}

function WheelBadge({ item, label }: { item: WheelItemId; label: string }) {
  const w = getWheelItem(item);
  if (!w) return null;
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border"
      style={{
        background: `${w.color}26`,
        color: w.color,
        borderColor: `${w.color}66`,
      }}
      title={label}
    >
      <Sparkles className="w-2.5 h-2.5" />
      {w.label}
    </span>
  );
}

function HitBadge({ item, from }: { item: WheelItemId; from: string }) {
  const w = getWheelItem(item);
  if (!w) return null;
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border border-white/10 bg-white/5 text-white/80"
      title={`Hit by ${w.label} from ${from}`}
    >
      <Target className="w-2.5 h-2.5" style={{ color: w.color }} />
      Hit by {w.label}
    </span>
  );
}

export default function Leaderboard() {
  const { teamInfo, netScore, holesPlayed, currentTee } = useWFC();
  const [teams, setTeams] = useState<TeamData[]>([]);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [adminPw, setAdminPw] = useState('');
  const [adminErr, setAdminErr] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured || !db) {
      if (teamInfo) {
        setTeams([{
          id: 'local',
          teamName: teamInfo.teamName,
          player1: teamInfo.player1,
          player2: teamInfo.player2,
          netScore,
          holesPlayed,
          currentTee
        }]);
      }
      return;
    }

    const q = query(collection(db, 'teams'), orderBy('netScore', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as TeamData));
      setTeams(data);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => unsub();
  }, [teamInfo, netScore, holesPlayed, currentTee]);

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPw !== ADMIN_RESET_PASSWORD) {
      setAdminErr('Wrong password.');
      return;
    }
    if (!db) {
      setAdminErr('Firebase not configured — nothing to reset.');
      return;
    }
    setAdminErr('');
    setResetting(true);
    try {
      // Wipe each collection that holds tournament state.
      for (const name of ['teams', 'scores', 'liveFeed', 'events', 'longestDrives']) {
        const snap = await getDocs(collection(db, name));
        await Promise.all(snap.docs.map(d => deleteDoc(doc(db!, name, d.id))));
      }
      // Write a reset signal — every connected device listens for this
      // and auto-clears its own localStorage when the timestamp is newer than joinedAt.
      await setDoc(doc(db, 'config', 'tournament'), { resetAt: serverTimestamp() });
      setResetDone(true);
      fireEagleConfetti();
      setTimeout(() => fireEagleConfetti(), 500);
      setTimeout(() => {
        // Hard refresh every connected device that loads this URL again;
        // onSnapshot listeners will already show empty state instantly.
        window.location.reload();
      }, 2500);
    } catch (err) {
      console.error(err);
      setAdminErr('Reset failed. Check console.');
      setResetting(false);
    }
  };

  const closeAdmin = () => {
    setShowAdmin(false);
    setAdminPw('');
    setAdminErr('');
    setResetDone(false);
    setResetting(false);
  };

  return (
    <div className="min-h-[100dvh] w-full bg-background pb-24 relative">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border p-4">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <h2 className="font-condensed text-3xl font-black uppercase tracking-wider text-foreground">
            WFC <span className="text-primary">LIVE</span>
          </h2>
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${isFirebaseConfigured ? 'animate-ping bg-primary' : 'bg-muted'}`}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${isFirebaseConfigured ? 'bg-primary' : 'bg-muted-foreground'}`}></span>
            </span>
            <span className={`text-xs font-bold uppercase tracking-widest ${isFirebaseConfigured ? 'text-primary' : 'text-muted-foreground'}`}>
              {isFirebaseConfigured ? 'Live' : 'Offline'}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4">
        {!isFirebaseConfigured && (
          <button
            onClick={() => setShowSetup(true)}
            className="w-full mb-6 p-4 bg-primary/10 border border-primary/40 rounded-xl flex items-start gap-3 text-left hover:bg-primary/15 transition-colors"
          >
            <Flame className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-condensed text-base font-bold uppercase tracking-wider text-primary leading-tight">
                Turn on live sync (3 min)
              </p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Tap here for the one-time Firebase setup so every device sees the same leaderboard in real time.
              </p>
            </div>
          </button>
        )}

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="grid grid-cols-12 gap-2 p-3 bg-secondary/50 border-b border-border text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <div className="col-span-1 text-center">POS</div>
            <div className="col-span-6">Team</div>
            <div className="col-span-2 text-center">Thru</div>
            <div className="col-span-3 text-right">Net</div>
          </div>

          <div className="divide-y divide-border">
            {teams.length === 0 && !loading && (
              <div className="p-8 text-center text-muted-foreground font-medium text-sm">
                No teams on the course yet.
              </div>
            )}

            {teams.map((team, idx) => {
              const hits = (team.targetedBy ?? []).slice(-3);
              return (
                <div key={team.id} className="grid grid-cols-12 gap-2 p-3 items-center hover:bg-secondary/20 transition-colors">
                  <div className="col-span-1 flex justify-center">
                    {idx === 0 ? (
                      <Crown className="w-4 h-4 text-yellow-400" />
                    ) : (
                      <span className="font-condensed font-bold text-muted-foreground">{idx + 1}</span>
                    )}
                  </div>
                  <div className="col-span-6 flex flex-col gap-1 min-w-0">
                    <span className="font-bold text-sm truncate">{team.teamName}</span>
                    <span className="text-[10px] text-muted-foreground truncate">{team.player1} & {team.player2}</span>
                    {(team.wheelSpin || hits.length > 0 || team.booActive) && (
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {team.wheelSpin && (
                          <WheelBadge item={team.wheelSpin.item} label={`Spun ${team.wheelSpin.item}`} />
                        )}
                        {team.booActive && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border border-purple-500/40 bg-purple-500/15 text-purple-300">
                            Boo · worst hole hidden
                          </span>
                        )}
                        {hits.map((h, i) => (
                          <HitBadge key={`${h.at}-${i}`} item={h.item} from={h.fromTeam} />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="col-span-2 text-center font-condensed font-bold text-muted-foreground">
                    {team.holesPlayed === 18 ? 'F' : team.holesPlayed || '-'}
                  </div>
                  <div className="col-span-3 text-right font-condensed text-xl font-black">
                    <span className={team.netScore < 0 ? 'text-primary' : team.netScore > 0 ? 'text-orange-500' : 'text-foreground'}>
                      {team.netScore === 0 ? 'E' : team.netScore > 0 ? `+${team.netScore}` : team.netScore}
                    </span>
                    {typeof team.wheelAdjustment === 'number' && team.wheelAdjustment !== 0 && (
                      <div className={`text-[9px] font-bold tracking-wider mt-0.5 ${team.wheelAdjustment > 0 ? 'text-orange-400' : 'text-primary'}`}>
                        {team.wheelAdjustment > 0 ? `+${team.wheelAdjustment}` : team.wheelAdjustment} wheel
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-8">
          <h3 className="font-condensed text-xl font-bold uppercase tracking-widest text-muted-foreground mb-4">Groups on Course</h3>
          <div className="grid grid-cols-2 gap-3">
            {teams.map(team => (
              <div key={`tracker-${team.id}`} className="bg-card border border-border p-3 rounded-lg flex flex-col gap-2">
                <span className="font-bold text-sm truncate">{team.teamName}</span>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Hole</span>
                  <span className="font-condensed text-xl font-black text-primary">
                    {team.holesPlayed < 18 ? team.holesPlayed + 1 : 'Clubhouse'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Admin reset modal */}
      {showAdmin && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur flex items-center justify-center p-4" onClick={closeAdmin}>
          <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 relative" onClick={e => e.stopPropagation()}>
            <button onClick={closeAdmin} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>

            {resetDone ? (
              <div className="text-center py-6">
                <CheckCircle2 className="w-16 h-16 text-primary mx-auto mb-4" />
                <h3 className="font-condensed text-3xl font-black uppercase text-primary mb-2">Tournament Reset!</h3>
                <p className="text-sm text-muted-foreground">Refreshing every device…</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-red-500/15 border border-red-500/40 flex items-center justify-center">
                    <Trash2 className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <h3 className="font-condensed text-xl font-black uppercase tracking-wider">Reset Tournament</h3>
                    <p className="text-[11px] text-muted-foreground">Wipes all teams, scores, and live feed.</p>
                  </div>
                </div>
                <form onSubmit={handleAdminSubmit} className="space-y-3">
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
                    {resetting ? 'Wiping…' : 'Wipe All Data'}
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* In-app Firebase setup modal */}
      {showSetup && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur flex items-center justify-center p-4" onClick={() => setShowSetup(false)}>
          <div className="w-full max-w-md max-h-[85vh] overflow-y-auto bg-card border border-border rounded-2xl p-6 relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowSetup(false)} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <Flame className="w-6 h-6 text-primary" />
              <h3 className="font-condensed text-2xl font-black uppercase tracking-wider text-primary">Firebase Setup</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">Takes about 3 minutes. Do this once on any device.</p>

            <ol className="space-y-3 text-sm">
              {[
                <>Go to <span className="text-primary font-bold">firebase.google.com</span> and sign in with Google.</>,
                <>Click <span className="font-bold">Add project</span> → name it <span className="text-primary font-bold">wfc-golf</span> → continue (skip Analytics).</>,
                <>In the project, click the <span className="font-bold">&lt;/&gt;</span> web icon → register an app called <span className="text-primary font-bold">WFC</span>.</>,
                <>Copy the 6 values from the <span className="font-bold">firebaseConfig</span> object that Firebase shows you.</>,
                <>In the left menu open <span className="font-bold">Build → Firestore Database</span> → <span className="font-bold">Create database</span> → start in <span className="text-primary font-bold">test mode</span>.</>,
                <>Back in Replit, open the <span className="font-bold">Secrets</span> tab and add these 6 keys (paste the matching values from step 4):</>,
              ].map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center">{i + 1}</span>
                  <span className="text-foreground/90 leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>

            <pre className="mt-4 p-3 bg-background/60 border border-border rounded-lg text-[11px] text-primary/90 overflow-x-auto leading-relaxed">{`VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=wfc-golf.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=wfc-golf
VITE_FIREBASE_STORAGE_BUCKET=wfc-golf.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
VITE_FIREBASE_APP_ID=1:1234:web:abcd`}</pre>

            <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
              After you save the secrets, tap the button below. The app will reload and live sync will turn on.
            </p>

            <Button
              onClick={() => window.location.reload()}
              className="w-full mt-4 h-12 font-condensed font-black uppercase tracking-widest rounded-full"
            >
              I just did this — Reload
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
