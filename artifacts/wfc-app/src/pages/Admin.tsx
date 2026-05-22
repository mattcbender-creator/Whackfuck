import { useState, useEffect, useCallback, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/firebase';
import {
  collection, addDoc, doc, setDoc, getDocs, writeBatch, serverTimestamp,
  query, where, deleteDoc, updateDoc, onSnapshot, increment, Timestamp,
} from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { HOLES } from '@/lib/holes';
import { WHEEL_ITEMS, pickRandomIndex, type WheelItemId } from '@/lib/wheel';
import {
  Sparkles, Trash2, Beaker, Megaphone, Lock, Users, Pencil, X,
  Plus, Minus, RefreshCw, ChevronDown, ChevronUp, Play, Pause,
} from 'lucide-react';

const ADMIN_PASSWORD = 'wfc';

const DEMO_TEAM_NAMES = [
  'Birdie Bandits', 'Sandbaggers', 'Bogey Boys', 'Mulligan Mafia', 'Whack Attack',
  'Bunker Bros', 'Fairway Felons', 'Eagle Eyes', 'Slice Society', 'Hook Hooligans',
  'Putt Pirates', 'Tee Time Titans', 'The Shankopotamuses', 'Divot Demons', 'Chip Shots',
  'Iron Sheikhs', 'Wedge Warriors', 'The Yips', 'Lost Ball Legends', 'Cart Path Crew',
  'Grip It & Rip It', 'Tin Cups', 'Albatross Alliance', 'Rough Riders', 'Pin Seekers',
  'Green Goblins', 'Stroke of Genius', 'Par-Tee Animals', 'Driving Range Rangers', 'Whiff Whisperers',
];

const DEMO_FIRST_NAMES = [
  'Mike', 'Dave', 'Steve', 'Justin', 'Ryan', 'Brad', 'Kyle', 'Chris', 'Matt', 'Jeff',
  'Tyler', 'Mark', 'Adam', 'Greg', 'Dan', 'Nate', 'Sean', 'Jon', 'Andy', 'Tom',
  'Will', 'Pete', 'Sam', 'Luke', 'Eric', 'Paul', 'Jake', 'Ben', 'Drew', 'Cole',
];

function randomHoleScore(par: number): number {
  const r = Math.random();
  if (par >= 4 && r < 0.02) return par - 2; // eagle (par 4/5 only)
  if (r < 0.07) return par - 1;             // birdie
  if (r < 0.38) return par;                 // par
  if (r < 0.72) return par + 1;             // bogey
  if (r < 0.90) return par + 2;             // double
  return par + 3;                           // triple
}

// Weighted distribution so demo teams feel mid-round:
// ~8% very early (2-3), 15% front 9 (5-7), 22% at the turn (8-10),
// 28% back 9 (11-13), 17% late (14-16), 10% finishing (17-18)
function liveHolesPlayed(): number {
  const r = Math.random();
  if (r < 0.08) return 2 + Math.floor(Math.random() * 2);  // 2-3
  if (r < 0.23) return 5 + Math.floor(Math.random() * 3);  // 5-7
  if (r < 0.45) return 8 + Math.floor(Math.random() * 3);  // 8-10
  if (r < 0.73) return 11 + Math.floor(Math.random() * 3); // 11-13
  if (r < 0.90) return 14 + Math.floor(Math.random() * 3); // 14-16
  if (r < 0.96) return 17;
  return 18;
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

interface LiveTeam {
  id: string;
  teamName: string;
  player1: string;
  player2: string;
  netScore: number;
  holesPlayed: number;
  wheelAdjustment?: number;
  isDemo?: boolean;
}

export default function Admin() {
  const [password, setPassword] = useState('');
  const [auth, setAuth] = useState(false);
  const [message, setMessage] = useState('');
  const [demoCount, setDemoCount] = useState(13);
  const [seeding, setSeeding] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const simTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast } = useToast();

  // Team management state
  const [teams, setTeams] = useState<LiveTeam[]>([]);
  const [teamsOpen, setTeamsOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingTeam, setEditingTeam] = useState<LiveTeam | null>(null);
  const [editName, setEditName] = useState('');
  const [editP1, setEditP1] = useState('');
  const [editP2, setEditP2] = useState('');
  const [adjustingTeam, setAdjustingTeam] = useState<LiveTeam | null>(null);
  const [adjustDelta, setAdjustDelta] = useState(0);
  const [saving, setSaving] = useState(false);

  const loadTeams = useCallback(async () => {
    if (!db) return;
    const snap = await getDocs(collection(db, 'teams'));
    const list: LiveTeam[] = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        teamName: data.teamName ?? '(unnamed)',
        player1: data.player1 ?? '',
        player2: data.player2 ?? '',
        netScore: typeof data.netScore === 'number' ? data.netScore : 0,
        holesPlayed: typeof data.holesPlayed === 'number' ? data.holesPlayed : 0,
        wheelAdjustment: typeof data.wheelAdjustment === 'number' ? data.wheelAdjustment : 0,
        isDemo: !!data.isDemo,
      };
    });
    list.sort((a, b) => a.netScore - b.netScore);
    setTeams(list);
  }, []);

  // Live listener while panel is open
  useEffect(() => {
    if (!auth || !teamsOpen || !db) return;
    const unsub = onSnapshot(collection(db, 'teams'), snap => {
      const list: LiveTeam[] = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          teamName: data.teamName ?? '(unnamed)',
          player1: data.player1 ?? '',
          player2: data.player2 ?? '',
          netScore: typeof data.netScore === 'number' ? data.netScore : 0,
          holesPlayed: typeof data.holesPlayed === 'number' ? data.holesPlayed : 0,
          wheelAdjustment: typeof data.wheelAdjustment === 'number' ? data.wheelAdjustment : 0,
          isDemo: !!data.isDemo,
        };
      });
      list.sort((a, b) => a.netScore - b.netScore);
      setTeams(list);
    });
    return () => unsub();
  }, [auth, teamsOpen]);

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

  const handleDelete = async (team: LiveTeam) => {
    if (!db) return;
    if (!window.confirm(`Delete "${team.teamName}" (${team.player1} & ${team.player2})? This cannot be undone.`)) return;
    setDeletingId(team.id);
    try {
      await deleteDoc(doc(db, 'teams', team.id));
      toast({ title: `Deleted "${team.teamName}"` });
    } catch (e) {
      toast({ title: 'Delete failed', description: String(e), variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  const openEdit = (team: LiveTeam) => {
    setEditingTeam(team);
    setEditName(team.teamName);
    setEditP1(team.player1);
    setEditP2(team.player2);
  };

  const handleSaveEdit = async () => {
    if (!db || !editingTeam) return;
    if (!editName.trim()) { toast({ title: 'Team name required', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      await updateDoc(doc(db, 'teams', editingTeam.id), {
        teamName: editName.trim(),
        player1: editP1.trim(),
        player2: editP2.trim(),
      });
      toast({ title: 'Team updated' });
      setEditingTeam(null);
    } catch (e) {
      toast({ title: 'Save failed', description: String(e), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const openAdjust = (team: LiveTeam) => {
    setAdjustingTeam(team);
    setAdjustDelta(0);
  };

  const handleSaveAdjust = async () => {
    if (!db || !adjustingTeam || adjustDelta === 0) { setAdjustingTeam(null); return; }
    setSaving(true);
    try {
      await updateDoc(doc(db, 'teams', adjustingTeam.id), {
        wheelAdjustment: increment(adjustDelta),
        netScore: increment(adjustDelta),
      });
      toast({
        title: `Adjusted "${adjustingTeam.teamName}"`,
        description: `${adjustDelta > 0 ? '+' : ''}${adjustDelta} stroke${Math.abs(adjustDelta) !== 1 ? 's' : ''} applied`,
      });
      setAdjustingTeam(null);
    } catch (e) {
      toast({ title: 'Adjust failed', description: String(e), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSeedDemo = async () => {
    if (!db) {
      toast({ title: 'Firebase not configured', variant: 'destructive' });
      return;
    }
    const n = Math.max(2, Math.min(30, demoCount));
    setSeeding(true);
    try {
      const fdb = db;
      const existing = await getDocs(query(collection(fdb, 'teams'), where('isDemo', '==', true)));
      if (!existing.empty) {
        const wipeBatch = writeBatch(fdb);
        existing.docs.forEach(d => wipeBatch.delete(d.ref));
        await wipeBatch.commit();
      }

      const names = shuffle(DEMO_TEAM_NAMES).slice(0, n);
      const firsts = shuffle(DEMO_FIRST_NAMES);
      const now = Date.now();

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
        _lastUpdatedMs: number;
      }

      // Assign holesPlayed using a live-tournament distribution, then clamp so
      // no two teams share the exact same hole if we have enough spread.
      const rawHoles = names.map(() => liveHolesPlayed());
      // Sort one copy to spread teams, then shuffle back to random order
      const sortedHoles = [...rawHoles].sort((a, b) => a - b);
      const assignedHoles = shuffle(sortedHoles);

      const demoTeams: DemoTeam[] = names.map((teamName, i) => {
        const holesPlayed = assignedHoles[i];
        const scores: (number | null)[] = Array(18).fill(null);
        for (let h = 0; h < holesPlayed; h++) {
          scores[h] = randomHoleScore(HOLES[h].par);
        }
        const playedPar = HOLES.slice(0, holesPlayed).reduce((s, h) => s + h.par, 0);
        const playedScore = scores.slice(0, holesPlayed).reduce<number>((s, v) => s + (v ?? 0), 0);
        const rawNet = playedScore - playedPar;
        const spun = holesPlayed >= 9;
        const wheelItemId: WheelItemId | null = spun ? WHEEL_ITEMS[pickRandomIndex()].id : null;
        // Teams further along updated Firestore more recently (~9 min/hole variance)
        const minsAgo = Math.max(0, (18 - holesPlayed) * 9 + Math.floor(Math.random() * 8));
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
          currentTee: rawNet < 0 ? 'tips' : 'womens',
          targetedBy: [],
          _lastUpdatedMs: now - minsAgo * 60 * 1000,
        };
      });

      for (const spinner of demoTeams) {
        if (!spinner.wheelSpin) continue;
        const { item, at } = spinner.wheelSpin;
        const others = demoTeams.filter(t => t.id !== spinner.id);
        const fromTeam = spinner.teamName;

        const hit = (t: DemoTeam, src: WheelItemId) => {
          t.wheelAdjustment += 1;
          t.netScore += 1;
          t.targetedBy.push({ item: src, fromTeam, at });
        };

        switch (item) {
          case 'lightning':
            for (const t of others) hit(t, 'lightning');
            break;
          case 'boo': {
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
            spinner.wheelAdjustment -= 1;
            spinner.netScore -= 1;
            break;
          case 'super_star':
            spinner.wheelAdjustment -= 2;
            spinner.netScore -= 2;
            break;
          case 'green_shell': {
            const target = pick(others);
            if (target) {
              hit(target, 'green_shell');
              spinner.wheelSpin.targetTeam = target.teamName;
            }
            break;
          }
          case 'red_shell': {
            const target = pick(others);
            if (target) {
              hit(target, 'red_shell');
              spinner.wheelSpin.targetTeam = target.teamName;
            }
            break;
          }
          case 'blue_shell': {
            const sorted = [...demoTeams].sort((a, b) => a.netScore - b.netScore);
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

      for (const t of demoTeams) {
        t.currentTee = t.netScore < 0 ? 'tips' : 'womens';
      }

      const batch = writeBatch(fdb);
      for (const t of demoTeams) {
        const ref = doc(fdb, 'teams', t.id);
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
          lastUpdated: Timestamp.fromDate(new Date(t._lastUpdatedMs)),
        });
      }
      await batch.commit();

      // Seed recent birdie/eagle events to populate the live ticker
      // Pick up to 6 teams that scored at least one birdie/eagle
      interface BirdieEvent { teamName: string; hole: number; score: number; par: number; subtype: string; tsMs: number }
      const recentEvents: BirdieEvent[] = [];
      for (const t of demoTeams) {
        for (let h = Math.max(0, t.holesPlayed - 3); h < t.holesPlayed; h++) {
          const s = t.scores[h];
          const par = HOLES[h].par;
          if (s === null) continue;
          const diff = s - par;
          if (diff <= -1) {
            // Timestamp: as if they played this hole relative to their lastUpdated
            const holeAgo = (t.holesPlayed - 1 - h) * 9 * 60 * 1000;
            recentEvents.push({
              teamName: t.teamName,
              hole: h + 1,
              score: s,
              par,
              subtype: diff <= -2 ? 'eagle' : 'birdie',
              tsMs: t._lastUpdatedMs - holeAgo,
            });
          }
        }
      }
      // Sort newest-first, keep at most 8
      recentEvents.sort((a, b) => b.tsMs - a.tsMs);
      const toSeed = recentEvents.slice(0, 8);
      await Promise.all(toSeed.map(ev =>
        addDoc(collection(fdb, 'events'), {
          type: 'score',
          subtype: ev.subtype,
          teamName: ev.teamName,
          hole: ev.hole,
          score: ev.score,
          par: ev.par,
          isDemo: true,
          timestamp: Timestamp.fromDate(new Date(ev.tsMs)),
        })
      ));

      toast({
        title: `Seeded ${n} demo teams`,
        description: `Teams spread across the course. ${toSeed.length} recent events added to the ticker.`,
      });
    } catch (e) {
      console.error(e);
      toast({ title: 'Seed failed', description: String(e), variant: 'destructive' });
    } finally {
      setSeeding(false);
    }
  };

  // ── Live simulation: every tick, advance one random unfinished demo team ──
  // by a single hole. This drives leaderboard reshuffles so the position
  // arrows actually fire during a demo (otherwise demo teams are static and
  // no movement = no arrows).
  const simulationTick = useCallback(async () => {
    if (!db) return;
    try {
      const fdb = db;
      const snap = await getDocs(query(collection(fdb, 'teams'), where('isDemo', '==', true)));
      const candidates = snap.docs.filter(d => {
        const hp = d.data().holesPlayed;
        return typeof hp === 'number' && hp < 18;
      });
      if (candidates.length === 0) return;
      // Advance 1-2 teams per tick for visible movement
      const advanceCount = Math.min(candidates.length, Math.random() < 0.5 ? 2 : 1);
      const picks = shuffle(candidates).slice(0, advanceCount);

      for (const d of picks) {
        const data = d.data();
        const scores: (number | null)[] = Array.isArray(data.scores) ? [...data.scores] : Array(18).fill(null);
        const hp: number = data.holesPlayed;
        const nextHole = hp; // 0-indexed
        if (nextHole >= 18) continue;
        const par = HOLES[nextHole].par;
        const newScore = randomHoleScore(par);
        scores[nextHole] = newScore;
        const newHp = hp + 1;
        // Recompute netScore = strokes - par for all played holes, plus existing wheelAdjustment
        const playedPar = HOLES.slice(0, newHp).reduce((s, h) => s + h.par, 0);
        const playedScore = scores.slice(0, newHp).reduce<number>((s, v) => s + (v ?? 0), 0);
        const wheelAdj = typeof data.wheelAdjustment === 'number' ? data.wheelAdjustment : 0;
        const newNet = playedScore - playedPar + wheelAdj;
        const currentTee = newNet < 0 ? 'tips' : 'womens';

        await updateDoc(d.ref, {
          scores,
          holesPlayed: newHp,
          netScore: newNet,
          currentTee,
          lastUpdated: Timestamp.now(),
        });

        const diff = newScore - par;
        if (diff <= -1) {
          await addDoc(collection(fdb, 'events'), {
            type: 'score',
            subtype: diff <= -2 ? 'eagle' : 'birdie',
            teamName: data.teamName,
            hole: nextHole + 1,
            score: newScore,
            par,
            isDemo: true,
            timestamp: Timestamp.now(),
          });
        }
        if (newHp === 18) {
          await addDoc(collection(fdb, 'events'), {
            type: 'finish',
            teamName: data.teamName,
            netScore: newNet,
            isDemo: true,
            timestamp: Timestamp.now(),
          });
        }
      }
    } catch (e) {
      console.error('sim tick failed', e);
    }
  }, []);

  // Start/stop the simulation interval
  useEffect(() => {
    if (!simulating) {
      if (simTimer.current) { clearInterval(simTimer.current); simTimer.current = null; }
      return;
    }
    // Fire immediately, then every 8 seconds
    simulationTick();
    simTimer.current = setInterval(simulationTick, 8000);
    return () => {
      if (simTimer.current) { clearInterval(simTimer.current); simTimer.current = null; }
    };
  }, [simulating, simulationTick]);

  // Stop simulation if we navigate away from admin
  useEffect(() => () => {
    if (simTimer.current) clearInterval(simTimer.current);
  }, []);

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

  const realTeams = teams.filter(t => !t.isDemo);
  const demoTeams = teams.filter(t => t.isDemo);

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

        {/* ── Team Management ── */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <button
            className="w-full flex items-center justify-between p-5 text-left"
            onClick={() => { setTeamsOpen(v => !v); }}
          >
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <h3 className="font-bold uppercase tracking-widest text-sm text-muted-foreground">Manage Teams</h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-condensed text-lg font-black text-primary leading-none">
                {realTeams.length} real · {demoTeams.length} demo
              </span>
              {teamsOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </div>
          </button>

          {teamsOpen && (
            <div className="border-t border-border">
              {teams.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6 px-5">No teams registered yet.</p>
              )}

              {/* Real teams */}
              {realTeams.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary/60 px-5 py-2 border-b border-border/50">
                    Real Teams
                  </p>
                  {realTeams.map(team => (
                    <TeamRow
                      key={team.id}
                      team={team}
                      deleting={deletingId === team.id}
                      onDelete={() => handleDelete(team)}
                      onEdit={() => openEdit(team)}
                      onAdjust={() => openAdjust(team)}
                    />
                  ))}
                </div>
              )}

              {/* Demo teams (collapsed count only) */}
              {demoTeams.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 px-5 py-2 border-t border-border/50">
                    Demo Teams ({demoTeams.length}) — use "Clear Demo Teams" below to remove
                  </p>
                </div>
              )}

              <div className="p-4 border-t border-border/50">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadTeams}
                  className="w-full text-xs uppercase tracking-widest font-bold border-border text-muted-foreground"
                >
                  <RefreshCw className="w-3 h-3 mr-2" />
                  Refresh List
                </Button>
              </div>
            </div>
          )}
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
              max={30}
              value={demoCount}
              onChange={e => setDemoCount(Number(e.target.value))}
              className="w-full accent-primary"
              data-testid="slider-demo-count"
            />
            <div className="flex justify-between text-[9px] text-muted-foreground/60 uppercase tracking-widest">
              <span>2</span><span>30</span>
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
            onClick={() => setSimulating(v => !v)}
            variant="outline"
            className={`w-full h-10 text-xs uppercase tracking-widest font-bold ${
              simulating
                ? 'border-red-500/50 text-red-400 hover:bg-red-500/10'
                : 'border-primary/40 text-primary hover:bg-primary/10'
            }`}
            data-testid="button-simulate-live"
          >
            {simulating ? (
              <><Pause className="w-3 h-3 mr-2" /> Stop Live Simulation</>
            ) : (
              <><Play className="w-3 h-3 mr-2" /> Simulate Live Play (8s ticks)</>
            )}
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

      {/* ── Edit Team Modal ── */}
      {editingTeam && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setEditingTeam(null)}>
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-condensed text-xl font-black uppercase tracking-wider">Edit Team</h3>
              <button onClick={() => setEditingTeam(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Team Name</label>
                <Input value={editName} onChange={e => setEditName(e.target.value)} className="h-11 bg-input" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Player 1</label>
                <Input value={editP1} onChange={e => setEditP1(e.target.value)} className="h-11 bg-input" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Player 2</label>
                <Input value={editP2} onChange={e => setEditP2(e.target.value)} className="h-11 bg-input" />
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 h-11" onClick={() => setEditingTeam(null)}>Cancel</Button>
              <Button className="flex-1 h-11 font-bold" onClick={handleSaveEdit} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Stroke Adjustment Modal ── */}
      {adjustingTeam && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setAdjustingTeam(null)}>
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm space-y-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-condensed text-xl font-black uppercase tracking-wider">Manual Adjustment</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{adjustingTeam.teamName}</p>
              </div>
              <button onClick={() => setAdjustingTeam(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
              Adds strokes directly to this team's net score (positive = penalty, negative = bonus). Use to correct scoring errors or apply rulings.
            </p>

            <div className="flex items-center justify-center gap-6">
              <button
                onClick={() => setAdjustDelta(d => d - 1)}
                className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/70 transition-colors"
              >
                <Minus className="w-6 h-6" />
              </button>
              <div className="text-center min-w-[80px]">
                <p className={`font-condensed text-5xl font-black leading-none ${adjustDelta > 0 ? 'text-orange-400' : adjustDelta < 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                  {adjustDelta > 0 ? `+${adjustDelta}` : adjustDelta === 0 ? '0' : adjustDelta}
                </p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">strokes</p>
              </div>
              <button
                onClick={() => setAdjustDelta(d => d + 1)}
                className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/70 transition-colors"
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>

            <div className="bg-secondary/40 rounded-lg px-4 py-2 text-center">
              <span className="text-xs text-muted-foreground">Net score: </span>
              <span className="font-bold text-sm">{adjustingTeam.netScore > 0 ? `+${adjustingTeam.netScore}` : adjustingTeam.netScore}</span>
              {adjustDelta !== 0 && (
                <>
                  <span className="text-muted-foreground mx-1.5">→</span>
                  <span className={`font-bold text-sm ${(adjustingTeam.netScore + adjustDelta) <= 0 ? 'text-primary' : 'text-orange-400'}`}>
                    {(adjustingTeam.netScore + adjustDelta) > 0 ? `+${adjustingTeam.netScore + adjustDelta}` : adjustingTeam.netScore + adjustDelta}
                  </span>
                </>
              )}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 h-11" onClick={() => setAdjustingTeam(null)}>Cancel</Button>
              <Button
                className="flex-1 h-11 font-bold"
                onClick={handleSaveAdjust}
                disabled={saving || adjustDelta === 0}
              >
                {saving ? 'Applying…' : 'Apply'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface TeamRowProps {
  team: LiveTeam;
  deleting: boolean;
  onDelete: () => void;
  onEdit: () => void;
  onAdjust: () => void;
}

function TeamRow({ team, deleting, onDelete, onEdit, onAdjust }: TeamRowProps) {
  const net = team.netScore;
  const netLabel = net === 0 ? 'E' : net > 0 ? `+${net}` : String(net);
  const netColor = net < 0 ? 'text-primary' : net > 0 ? 'text-orange-400' : 'text-muted-foreground';

  return (
    <div className="flex items-center gap-3 px-5 py-3 border-t border-border/30 first:border-t-0">
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm truncate leading-tight">{team.teamName}</p>
        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
          {team.player1}{team.player2 ? ` & ${team.player2}` : ''} · {team.holesPlayed}/18
        </p>
      </div>

      <span className={`font-condensed text-lg font-black leading-none shrink-0 ${netColor}`}>{netLabel}</span>

      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onAdjust}
          title="Adjust strokes"
          className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          onClick={onEdit}
          title="Edit team"
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={onDelete}
          disabled={deleting}
          title="Delete team"
          className="p-2 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-950/30 transition-colors disabled:opacity-40"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
