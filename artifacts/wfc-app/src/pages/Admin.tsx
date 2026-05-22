import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/firebase';
import {
  collection, addDoc, doc, setDoc, getDocs, writeBatch, serverTimestamp,
  query, where,
} from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { HOLES } from '@/lib/holes';
import { WHEEL_ITEMS, pickRandomIndex, type WheelItemId } from '@/lib/wheel';
import { Sparkles, Trash2, Beaker, Megaphone, Lock } from 'lucide-react';

const ADMIN_PASSWORD = 'wfc2026!';

const DEMO_TEAM_NAMES = [
  'Birdie Bandits', 'Sandbaggers', 'Bogey Boys', 'Mulligan Mafia', 'Whack Attack',
  'Bunker Bros', 'Fairway Felons', 'Eagle Eyes', 'Slice Society', 'Hook Hooligans',
  'Putt Pirates', 'Tee Time Titans', 'The Shankopotamuses', 'Divot Demons', 'Chip Shots',
  'Iron Sheikhs', 'Wedge Warriors', 'The Yips', 'Lost Ball Legends', 'Cart Path Crew',
];

const DEMO_FIRST_NAMES = [
  'Mike', 'Dave', 'Steve', 'Justin', 'Ryan', 'Brad', 'Kyle', 'Chris', 'Matt', 'Jeff',
  'Tyler', 'Mark', 'Adam', 'Greg', 'Dan', 'Nate', 'Sean', 'Jon', 'Andy', 'Tom',
  'Will', 'Pete', 'Sam', 'Luke', 'Eric', 'Paul', 'Jake', 'Ben', 'Drew', 'Cole',
];

// Realistic score for a hole — weighted toward bogey/par with occasional birdies/blow-ups
function randomHoleScore(par: number): number {
  const r = Math.random();
  if (r < 0.05) return par - 1;        // 5% birdie
  if (r < 0.40) return par;            // 35% par
  if (r < 0.75) return par + 1;        // 35% bogey
  if (r < 0.92) return par + 2;        // 17% double
  return par + 3;                      // 8% triple+
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export default function Admin() {
  const [password, setPassword] = useState('');
  const [auth, setAuth] = useState(false);
  const [message, setMessage] = useState('');
  const [demoCount, setDemoCount] = useState(13);
  const [seeding, setSeeding] = useState(false);
  const { toast } = useToast();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setAuth(true);
    } else {
      toast({ title: 'Access Denied', variant: 'destructive' });
    }
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !message.trim()) return;
    try {
      await addDoc(collection(db, 'events'), {
        type: 'broadcast',
        message,
        timestamp: new Date().toISOString(),
      });
      toast({ title: 'Broadcast Sent' });
      setMessage('');
    } catch {
      toast({ title: 'Failed to send', variant: 'destructive' });
    }
  };

  const handleSeedDemo = async () => {
    if (!db) {
      toast({ title: 'Firebase not configured', variant: 'destructive' });
      return;
    }
    const n = Math.max(2, Math.min(20, demoCount));
    setSeeding(true);
    try {
      const fdb = db;
      // First wipe any existing demo teams so re-seeding doesn't pile up.
      const existing = await getDocs(query(collection(fdb, 'teams'), where('isDemo', '==', true)));
      if (!existing.empty) {
        const wipeBatch = writeBatch(fdb);
        existing.docs.forEach(d => wipeBatch.delete(d.ref));
        await wipeBatch.commit();
      }

      const names = shuffle(DEMO_TEAM_NAMES).slice(0, n);
      const firsts = shuffle(DEMO_FIRST_NAMES);
      const now = Date.now();

      // ── Phase 1: build base team data ──────────────────────────────────────
      interface DemoTeam {
        id: string;
        teamName: string;
        player1: string;
        player2: string;
        scores: (number | null)[];
        holesPlayed: number;
        frontNineConfirmed: boolean;
        wheelSpin: { item: WheelItemId; at: number; targetTeam?: string } | null;
        wheelAdjustment: number;
        netScore: number;
        currentTee: string;
        targetedBy: { item: WheelItemId; fromTeam: string; at: number }[];
      }

      const teams: DemoTeam[] = names.map((teamName, i) => {
        const holesPlayed = 1 + Math.floor(Math.random() * 18);
        const scores: (number | null)[] = Array(18).fill(null);
        for (let h = 0; h < holesPlayed; h++) {
          scores[h] = randomHoleScore(HOLES[h].par);
        }
        const playedPar = HOLES.slice(0, holesPlayed).reduce((s, h) => s + h.par, 0);
        const playedScore = scores.slice(0, holesPlayed).reduce<number>((s, v) => s + (v ?? 0), 0);
        const rawNet = playedScore - playedPar;
        const spun = holesPlayed >= 9;
        const wheelItemId: WheelItemId | null = spun ? WHEEL_ITEMS[pickRandomIndex()].id : null;
        return {
          id: `demo_${i}_${now}`,
          teamName,
          player1: firsts[i * 2 % firsts.length],
          player2: firsts[(i * 2 + 1) % firsts.length],
          scores,
          holesPlayed,
          frontNineConfirmed: spun,
          wheelSpin: wheelItemId
            ? { item: wheelItemId, at: now - Math.floor(Math.random() * 1000 * 60 * 30) }
            : null,
          wheelAdjustment: 0,
          netScore: rawNet,
          currentTee: rawNet <= -5 ? 'tips' : 'womens',
          targetedBy: [],
        };
      });

      // ── Phase 2: apply wheel effects so scores & hit-badges match spins ────
      for (const spinner of teams) {
        if (!spinner.wheelSpin) continue;
        const { item, at } = spinner.wheelSpin;
        const others = teams.filter(t => t.id !== spinner.id);
        const fromTeam = spinner.teamName;

        const hit = (t: DemoTeam, src: WheelItemId) => {
          t.wheelAdjustment += 1;
          t.netScore += 1;
          t.targetedBy.push({ item: src, fromTeam, at });
        };

        switch (item) {
          case 'lightning':
            // All other teams +1
            for (const t of others) hit(t, 'lightning');
            break;
          case 'boo': {
            // Steal: random other +1, self -1
            const target = pick(others);
            if (target) {
              hit(target, 'boo');
              spinner.wheelSpin.targetTeam = target.teamName;
            }
            spinner.wheelAdjustment -= 1;
            spinner.netScore -= 1;
            break;
          }
          case 'mushroom':
            // Self -1
            spinner.wheelAdjustment -= 1;
            spinner.netScore -= 1;
            break;
          case 'super_star':
            // Self -2
            spinner.wheelAdjustment -= 2;
            spinner.netScore -= 2;
            break;
          case 'green_shell': {
            // Random other +1
            const target = pick(others);
            if (target) {
              hit(target, 'green_shell');
              spinner.wheelSpin.targetTeam = target.teamName;
            }
            break;
          }
          case 'red_shell': {
            // Random other +1 (picker in real game, random for demo)
            const target = pick(others);
            if (target) {
              hit(target, 'red_shell');
              spinner.wheelSpin.targetTeam = target.teamName;
            }
            break;
          }
          case 'blue_shell': {
            // Leader +1 (or self if leading)
            const sorted = [...teams].sort((a, b) => a.netScore - b.netScore);
            const leader = sorted[0];
            if (leader) {
              if (leader.id === spinner.id) {
                spinner.wheelAdjustment += 1;
                spinner.netScore += 1;
              } else {
                hit(leader, 'blue_shell');
              }
              spinner.wheelSpin.targetTeam = leader.teamName;
            }
            break;
          }
          case 'banana': {
            // Random team behind (fewer holes played) +1, fizzles if none
            const behind = others.filter(t => t.holesPlayed < spinner.holesPlayed);
            const target = pick(behind);
            if (target) {
              hit(target, 'banana');
              spinner.wheelSpin.targetTeam = target.teamName;
            }
            break;
          }
        }
      }

      // ── Phase 3: recompute currentTee now that adjustments are final ───────
      for (const t of teams) {
        t.currentTee = t.netScore <= -5 ? 'tips' : 'womens';
      }

      // ── Phase 4: write to Firestore ────────────────────────────────────────
      const batch = writeBatch(fdb);
      for (const t of teams) {
        const ref = doc(fdb, 'teams', t.id);
        // Clean wheelSpin: strip undefined fields (Firestore rejects them)
        let cleanSpin: Record<string, unknown> | null = null;
        if (t.wheelSpin) {
          cleanSpin = {};
          for (const [k, v] of Object.entries(t.wheelSpin)) {
            if (v !== undefined) cleanSpin[k] = v;
          }
        }
        batch.set(ref, {
          teamName: t.teamName,
          player1: t.player1,
          player2: t.player2,
          scores: t.scores,
          netScore: t.netScore,
          holesPlayed: t.holesPlayed,
          currentTee: t.currentTee,
          frontNineConfirmed: t.frontNineConfirmed,
          wheelSpin: cleanSpin,
          wheelAdjustment: t.wheelAdjustment,
          targetedBy: t.targetedBy,
          isDemo: true,
          lastUpdated: serverTimestamp(),
        });
      }
      await batch.commit();
      toast({
        title: `Seeded ${n} demo teams`,
        description: 'Open the Live tab to see them scattered across the course.',
      });
    } catch (e) {
      console.error(e);
      toast({ title: 'Seed failed', description: String(e), variant: 'destructive' });
    } finally {
      setSeeding(false);
    }
  };

  const handleClearDemo = async () => {
    if (!db) return;
    try {
      const fdb = db;
      const snap = await getDocs(query(collection(fdb, 'teams'), where('isDemo', '==', true)));
      if (snap.empty) {
        toast({ title: 'No demo teams to clear' });
        return;
      }
      const batch = writeBatch(fdb);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      toast({ title: `Cleared ${snap.size} demo teams` });
    } catch (e) {
      toast({ title: 'Clear failed', description: String(e), variant: 'destructive' });
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Wipe ALL teams (real AND demo), scores, wheel spins, and the leaderboard? This cannot be undone.')) return;
    try {
      const fdb = db;
      if (fdb) {
        const wipeCollection = async (name: string) => {
          const snap = await getDocs(collection(fdb, name));
          if (snap.empty) return;
          const batch = writeBatch(fdb);
          snap.docs.forEach(d => batch.delete(d.ref));
          await batch.commit();
        };
        await Promise.all([
          wipeCollection('teams'),
          wipeCollection('events'),
          wipeCollection('longestDrives'),
        ]);
        await setDoc(doc(fdb, 'config', 'tournament'), { resetAt: serverTimestamp() }, { merge: true });
      }
      localStorage.clear();
      toast({ title: 'Tournament reset', description: 'Reloading…' });
      setTimeout(() => window.location.href = '/', 600);
    } catch (e) {
      console.error(e);
      toast({ title: 'Reset failed', description: String(e), variant: 'destructive' });
    }
  };

  if (!auth) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background p-4">
        <form onSubmit={handleLogin} className="w-full max-w-sm bg-card p-8 rounded-xl border border-border space-y-6">
          <div className="flex items-center justify-center gap-2">
            <Lock className="w-6 h-6 text-primary" />
            <h2 className="font-condensed text-3xl font-black uppercase text-center">
              Admin <span className="text-primary">Access</span>
            </h2>
          </div>
          <Input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            className="h-12 bg-input"
            autoFocus
            data-testid="input-admin-password"
          />
          <Button
            type="submit"
            className="w-full h-12 font-condensed text-xl tracking-widest font-bold"
            data-testid="button-admin-login"
          >
            LOGIN
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background p-4 pb-24">
      <div className="max-w-md mx-auto space-y-6">
        <h2 className="font-condensed text-3xl font-black uppercase mt-8">
          Tournament <span className="text-primary">Control</span>
        </h2>

        {/* ── Broadcast ── */}
        <div className="bg-card p-6 rounded-xl border border-border space-y-4">
          <div className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-primary" />
            <h3 className="font-bold uppercase tracking-widest text-sm text-muted-foreground">Global Broadcast</h3>
          </div>
          <form onSubmit={handleBroadcast} className="space-y-4">
            <Input
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Message to all players..."
              className="h-12 bg-input"
              data-testid="input-broadcast-message"
            />
            <Button type="submit" className="w-full h-12" data-testid="button-send-broadcast">Send Broadcast</Button>
          </form>
        </div>

        {/* ── Demo Mode ── */}
        <div className="bg-primary/5 p-6 rounded-xl border border-primary/30 space-y-4">
          <div className="flex items-center gap-2">
            <Beaker className="w-4 h-4 text-primary" />
            <h3 className="font-bold uppercase tracking-widest text-sm text-primary">Demo Mode</h3>
          </div>
          <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
            Seeds fake teams scattered randomly across the course. Teams past hole 9 will already have a random wheel result locked in. Use this to walk the group through the leaderboard, wheel effects, and live sync before tee-off.
          </p>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="demo-count" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Number of Teams
              </label>
              <span className="font-condensed text-2xl font-black text-primary leading-none">{demoCount}</span>
            </div>
            <input
              id="demo-count"
              type="range"
              min={2}
              max={20}
              value={demoCount}
              onChange={e => setDemoCount(Number(e.target.value))}
              className="w-full accent-primary"
              data-testid="slider-demo-count"
            />
            <div className="flex justify-between text-[9px] text-muted-foreground/60 uppercase tracking-widest">
              <span>2</span><span>20</span>
            </div>
          </div>

          <Button
            onClick={handleSeedDemo}
            disabled={seeding}
            className="w-full h-12 bg-primary text-primary-foreground font-condensed font-black uppercase tracking-widest"
            data-testid="button-seed-demo"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            {seeding ? 'Seeding…' : `Seed ${demoCount} Demo Teams`}
          </Button>

          <Button
            onClick={handleClearDemo}
            variant="outline"
            className="w-full h-10 text-xs uppercase tracking-widest font-bold border-primary/30 text-primary/80 hover:bg-primary/10"
            data-testid="button-clear-demo"
          >
            Clear Demo Teams Only
          </Button>
        </div>

        {/* ── Danger Zone ── */}
        <div className="bg-red-950/20 p-6 rounded-xl border border-red-900/50 space-y-4">
          <div className="flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-red-400" />
            <h3 className="font-bold uppercase tracking-widest text-sm text-red-500">Danger Zone</h3>
          </div>
          <Button
            variant="destructive"
            className="w-full h-12 font-condensed font-black uppercase tracking-widest"
            onClick={handleReset}
            data-testid="button-reset-tournament"
          >
            Reset Tournament
          </Button>
          <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
            Wipes ALL teams (real and demo), scores, wheel spins, and the leaderboard from Firestore. Every connected device will be reset to the home screen automatically.
          </p>
        </div>
      </div>
    </div>
  );
}
