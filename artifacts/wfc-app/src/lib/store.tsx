import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { HOLES } from './holes';
import { db, isFirebaseConfigured } from './firebase';
import {
  doc, setDoc, onSnapshot, serverTimestamp,
  collection, writeBatch, increment, arrayUnion, query, orderBy, getDocs,
  runTransaction,
} from 'firebase/firestore';
import type { WheelItemId } from './wheel';

export interface TeamInfo { teamName: string; player1: string; player2: string; }

export interface TargetedByEntry {
  item: WheelItemId;
  fromTeam: string;
  at: number;
}

export interface WheelSpinRecord {
  item: WheelItemId;
  at: number;
  targetTeam?: string; // team name we targeted (Green/Red/Boo)
}

export interface WFCState {
  teamId: string;
  teamInfo: TeamInfo | null;
  scores: (number | null)[];
  currentTee: 'tips' | 'womens';
  netScore: number;
  holesPlayed: number;
  frontNineConfirmed: boolean;
  wheelSpin: WheelSpinRecord | null;
  wheelAdjustment: number;
  targetedBy: TargetedByEntry[];
  setTeamInfo: (info: TeamInfo) => void;
  setScore: (hole: number, score: number | null) => void;
  resetScores: () => void;
  confirmFrontNine: () => void;
  recordWheelSpin: (record: WheelSpinRecord) => Promise<void>;
  applyEffectToOthers: (item: WheelItemId, targetIds: string[]) => Promise<void>;
  applyEffectToSelf: (delta: number) => void;
  listTeamsOnce: () => Promise<TeamSnapshot[]>;
}

export interface TeamSnapshot {
  id: string;
  teamName: string;
  player1: string;
  player2: string;
  netScore: number;
  holesPlayed: number;
}

const StoreContext = createContext<WFCState | null>(null);

const STORE_KEY = 'wfc-state';
const TEAM_ID_KEY = 'wfc-team-id';
const JOINED_AT_KEY = 'wfc-joined-at';

function getOrCreateTeamId(): string {
  try {
    let id = localStorage.getItem(TEAM_ID_KEY);
    if (!id) {
      id = (crypto.randomUUID?.() ?? `team-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
      localStorage.setItem(TEAM_ID_KEY, id);
    }
    return id;
  } catch {
    return `team-${Date.now()}`;
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [teamId] = useState<string>(() => getOrCreateTeamId());
  const [teamInfo, setTeamInfo] = useState<TeamInfo | null>(null);
  const [scores, setScoresState] = useState<(number | null)[]>(Array(18).fill(null));
  const [frontNineConfirmed, setFrontNineConfirmed] = useState(false);
  const [wheelSpin, setWheelSpin] = useState<WheelSpinRecord | null>(null);
  const [wheelAdjustment, setWheelAdjustment] = useState(0);
  const [targetedBy, setTargetedBy] = useState<TargetedByEntry[]>([]);
  const hydratedRef = useRef(false);

  // ── Hydrate from localStorage ──
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.teamInfo) setTeamInfo(parsed.teamInfo);
        if (parsed.scores && Array.isArray(parsed.scores)) setScoresState(parsed.scores);
        if (typeof parsed.frontNineConfirmed === 'boolean') setFrontNineConfirmed(parsed.frontNineConfirmed);
        if (parsed.wheelSpin) setWheelSpin(parsed.wheelSpin);
        if (typeof parsed.wheelAdjustment === 'number') setWheelAdjustment(parsed.wheelAdjustment);
        if (Array.isArray(parsed.targetedBy)) setTargetedBy(parsed.targetedBy);
      }
    } catch (e) {
      console.error('Failed to load store', e);
    }
    hydratedRef.current = true;
  }, []);

  // ── Listen to our own Firestore doc — picks up cross-device effects (Lightning, Shells, etc.) ──
  // Skips local-cache-only events to avoid feedback loops with our own writes.
  useEffect(() => {
    if (!isFirebaseConfigured || !db) return;
    const ref = doc(db, 'teams', teamId);
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      // Only react to confirmed server state; ignore optimistic local-cache events.
      if (snap.metadata.hasPendingWrites) return;
      const data = snap.data();
      if (typeof data.wheelAdjustment === 'number') {
        setWheelAdjustment(prev => prev === data.wheelAdjustment ? prev : data.wheelAdjustment);
      }
      if (Array.isArray(data.targetedBy)) {
        setTargetedBy(prev => {
          const incoming = data.targetedBy as TargetedByEntry[];
          // Compare by serialised content so we never miss an incoming hit even
          // if the array happens to be the same length as the current local state.
          return JSON.stringify(prev) === JSON.stringify(incoming) ? prev : incoming;
        });
      }
      if (data.wheelSpin) {
        // Only update if item/at actually changed — avoids object-ref churn loops.
        setWheelSpin(prev => {
          const incoming = data.wheelSpin as WheelSpinRecord;
          if (prev && prev.item === incoming.item && prev.at === incoming.at) return prev;
          return incoming;
        });
      } else if (data.wheelSpin === null && 'wheelSpin' in data) {
        // Server explicitly cleared the spin (e.g. fresh registration after
        // reset). Honor it — don't leave a stale spin lingering locally.
        setWheelSpin(prev => prev === null ? prev : null);
      }
      if (typeof data.frontNineConfirmed === 'boolean') {
        setFrontNineConfirmed(prev => prev === data.frontNineConfirmed ? prev : data.frontNineConfirmed);
      }
    });
    return () => unsub();
  }, [teamId]);

  // ── Admin reset listener ──
  useEffect(() => {
    if (!isFirebaseConfigured || !db) return;
    const ref = doc(db, 'config', 'tournament');
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      if (!data?.resetAt) return;
      const resetAt: number = data.resetAt.toMillis?.() ?? Number(data.resetAt);
      const joinedAt: number = parseInt(localStorage.getItem(JOINED_AT_KEY) ?? '0', 10);
      if (resetAt > joinedAt) {
        const emptyScores = Array(18).fill(null);
        setScoresState(emptyScores);
        setTeamInfo(null);
        setFrontNineConfirmed(false);
        setWheelSpin(null);
        setWheelAdjustment(0);
        setTargetedBy([]);
        try {
          localStorage.setItem(STORE_KEY, JSON.stringify({ teamInfo: null, scores: emptyScores }));
          localStorage.setItem(JOINED_AT_KEY, String(resetAt + 1));
        } catch { /* ignore */ }
      }
    }, (err) => console.error('Reset listener error', err));
    return () => unsub();
  }, []);

  const saveToLocal = (overrides: Partial<{
    teamInfo: TeamInfo | null;
    scores: (number | null)[];
    frontNineConfirmed: boolean;
    wheelSpin: WheelSpinRecord | null;
    wheelAdjustment: number;
    targetedBy: TargetedByEntry[];
  }>) => {
    try {
      const current = {
        teamInfo, scores, frontNineConfirmed, wheelSpin,
        wheelAdjustment, targetedBy,
      };
      const next = { ...current, ...overrides };
      localStorage.setItem(STORE_KEY, JSON.stringify(next));
    } catch (e) {
      console.error('Failed to save store', e);
    }
  };

  // ── Derive aggregates ──
  let totalScore = 0;
  let parPlayed = 0;
  let holesPlayed = 0;
  let worstBack9Diff = 0;
  scores.forEach((s, i) => {
    if (s !== null) {
      totalScore += s;
      parPlayed += HOLES[i].par;
      holesPlayed += 1;
      if (i >= 9) {
        const d = s - HOLES[i].par;
        if (d > worstBack9Diff) worstBack9Diff = d;
      }
    }
  });
  // worstBack9Diff was used by the old boo/hide-worst-hole rule; kept for
  // potential future rules but suppressed to avoid a lint warning.
  void worstBack9Diff;
  const netScore = (holesPlayed > 0 ? totalScore - parPlayed : 0) + wheelAdjustment;
  const currentTee: 'tips' | 'womens' = netScore <= -5 ? 'tips' : 'womens';

  // ── Push own changes to Firestore ──
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (!isFirebaseConfigured || !db) return;
    if (!teamInfo) return;
    const ref = doc(db, 'teams', teamId);
    // Firestore rejects `undefined`. Strip undefined fields from nested
    // wheelSpin (e.g. targetTeam isn't set for self-only items).
    let cleanWheelSpin: Record<string, unknown> | null = null;
    if (wheelSpin) {
      cleanWheelSpin = {};
      for (const [k, v] of Object.entries(wheelSpin)) {
        if (v !== undefined) cleanWheelSpin[k] = v;
      }
    }
    setDoc(ref, {
      teamName: teamInfo.teamName,
      player1: teamInfo.player1,
      player2: teamInfo.player2,
      scores,
      netScore,
      holesPlayed,
      currentTee,
      frontNineConfirmed,
      wheelSpin: cleanWheelSpin,
      // wheelAdjustment/booActive/targetedBy are owned by Firestore once any
      // cross-team effect lands — only write them on first creation.
      lastUpdated: serverTimestamp(),
    }, { merge: true }).catch(err => console.error('Firestore sync failed', err));
  }, [teamId, teamInfo, scores, netScore, holesPlayed, currentTee, frontNineConfirmed, wheelSpin]);

  const updateTeamInfo = (info: TeamInfo) => {
    setTeamInfo(info);
    saveToLocal({ teamInfo: info });
    try { localStorage.setItem(JOINED_AT_KEY, String(Date.now())); } catch { /* ignore */ }
    // Ensure baseline fields exist on our doc (so other devices can target us)
    // AND explicitly null out every piece of gameplay state. This guarantees a
    // clean slate on (re-)registration even when the same teamId is reused
    // after an admin reset — otherwise stale `wheelSpin` (e.g. an old Boo) can
    // be replayed from the Firestore IndexedDB cache and the snapshot listener
    // will resurrect it locally, making the next spin appear non-random.
    if (isFirebaseConfigured && db) {
      const fdb = db;
      const ref = doc(fdb, 'teams', teamId);
      // Fire-and-forget: scan for retroactive lightning strikes from teams that
      // spun BEFORE this team registered. Late joiners must still take the hit.
      (async () => {
        let initialWheelAdj = 0;
        let initialTargetedBy: TargetedByEntry[] = [];
        try {
          const teamsSnap = await getDocs(collection(fdb, 'teams'));
          const lightningTeams = teamsSnap.docs.filter(
            d => d.id !== teamId && (d.data()?.wheelSpin as { item?: string } | undefined)?.item === 'lightning'
          );
          if (lightningTeams.length > 0) {
            initialWheelAdj = lightningTeams.length;
            initialTargetedBy = lightningTeams.map(d => ({
              item: 'lightning' as WheelItemId,
              fromTeam: (d.data().teamName as string | undefined) ?? 'Unknown',
              at: ((d.data().wheelSpin as { at?: number } | undefined)?.at) ?? Date.now(),
            }));
            setWheelAdjustment(initialWheelAdj);
            setTargetedBy(initialTargetedBy);
            saveToLocal({ wheelAdjustment: initialWheelAdj, targetedBy: initialTargetedBy });
          }
        } catch { /* non-fatal — fall back to zero adjustment */ }
        setDoc(ref, {
          teamName: info.teamName,
          player1: info.player1,
          player2: info.player2,
          scores: Array(18).fill(null),
          netScore: initialWheelAdj,
          holesPlayed: 0,
          currentTee: 'womens',
          frontNineConfirmed: false,
          wheelSpin: null,
          wheelAdjustment: initialWheelAdj,
          targetedBy: initialTargetedBy,
        }, { merge: true }).catch(() => {});
      })();
    }
  };

  const setScore = (hole: number, score: number | null) => {
    const newScores = [...scores];
    newScores[hole - 1] = score;
    setScoresState(newScores);
    saveToLocal({ scores: newScores });
  };

  const resetScores = () => {
    const newScores = Array(18).fill(null);
    setScoresState(newScores);
    setTeamInfo(null);
    setFrontNineConfirmed(false);
    setWheelSpin(null);
    setWheelAdjustment(0);
    setTargetedBy([]);
    saveToLocal({
      teamInfo: null, scores: newScores, frontNineConfirmed: false,
      wheelSpin: null, wheelAdjustment: 0, targetedBy: [],
    });
  };

  const confirmFrontNine = () => {
    setFrontNineConfirmed(true);
    saveToLocal({ frontNineConfirmed: true });
  };

  const recordWheelSpin = async (record: WheelSpinRecord) => {
    // Build a clean copy with no undefined fields (Firestore rejects them).
    const cleanRecord: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(record)) {
      if (v !== undefined) cleanRecord[k] = v;
    }
    // CRITICAL: run a transaction so that two tabs/devices can NEVER both
    // succeed at recording a spin. If the server already has a wheelSpin for
    // this team, abort and surface that prior spin locally instead.
    if (isFirebaseConfigured && db && teamInfo) {
      const ref = doc(db, 'teams', teamId);
      try {
        const finalRecord = await runTransaction(db, async (tx) => {
          const snap = await tx.get(ref);
          const existing = snap.exists() ? (snap.data().wheelSpin as WheelSpinRecord | undefined) : undefined;
          if (existing && existing.item) {
            // Another tab/device already claimed the spin. Keep theirs.
            return existing;
          }
          tx.set(ref, { wheelSpin: cleanRecord, frontNineConfirmed: true }, { merge: true });
          return record;
        });
        setWheelSpin(finalRecord);
        saveToLocal({ wheelSpin: finalRecord });
      } catch (e) {
        console.error('Failed to record wheel spin', e);
        // Fall back to local-only so the user isn't stuck.
        setWheelSpin(record);
        saveToLocal({ wheelSpin: record });
      }
    } else {
      setWheelSpin(record);
      saveToLocal({ wheelSpin: record });
    }
  };

  const applyEffectToSelf = (delta: number) => {
    // Optimistic local update — snapshot listener will reconcile with server.
    const nextAdjustment = wheelAdjustment + delta;
    setWheelAdjustment(nextAdjustment);
    saveToLocal({ wheelAdjustment: nextAdjustment });
    // Use Firestore atomic increment so concurrent writes don't lose updates.
    if (isFirebaseConfigured && db && teamInfo) {
      setDoc(doc(db, 'teams', teamId), {
        wheelAdjustment: increment(delta),
      }, { merge: true }).catch(e => console.error('Self effect sync failed', e));
    }
  };

  const applyEffectToOthers = async (item: WheelItemId, targetIds: string[]) => {
    if (!isFirebaseConfigured || !db || !teamInfo) return;
    if (targetIds.length === 0) return;
    try {
      const batch = writeBatch(db);
      const now = Date.now();
      for (const tid of targetIds) {
        if (tid === teamId) continue;
        const ref = doc(db, 'teams', tid);
        batch.set(ref, {
          // Increment BOTH wheelAdjustment AND netScore so the leaderboard
          // reflects the hit immediately even if the target's device is
          // offline. When they come back online, their own sync will write
          // a freshly-computed netScore that includes the new wheelAdjustment
          // — so the values stay consistent.
          wheelAdjustment: increment(1),
          netScore: increment(1),
          targetedBy: arrayUnion({
            item,
            fromTeam: teamInfo.teamName,
            at: now,
          }),
        }, { merge: true });
      }
      await batch.commit();
    } catch (e) {
      console.error('Cross-team effect failed', e);
    }
  };

  const listTeamsOnce = async (): Promise<TeamSnapshot[]> => {
    if (!isFirebaseConfigured || !db) {
      // Offline: return only ourselves
      if (!teamInfo) return [];
      return [{
        id: teamId,
        teamName: teamInfo.teamName,
        player1: teamInfo.player1,
        player2: teamInfo.player2,
        netScore,
        holesPlayed,
      }];
    }
    const q = query(collection(db, 'teams'), orderBy('netScore', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        teamName: data.teamName ?? 'Team',
        player1: data.player1 ?? '',
        player2: data.player2 ?? '',
        netScore: typeof data.netScore === 'number' ? data.netScore : 0,
        holesPlayed: typeof data.holesPlayed === 'number' ? data.holesPlayed : 0,
      };
    });
  };

  return (
    <StoreContext.Provider
      value={{
        teamId,
        teamInfo,
        scores,
        currentTee,
        netScore,
        holesPlayed,
        frontNineConfirmed,
        wheelSpin,
        wheelAdjustment,
        targetedBy,
        setTeamInfo: updateTeamInfo,
        setScore,
        resetScores,
        confirmFrontNine,
        recordWheelSpin,
        applyEffectToOthers,
        applyEffectToSelf,
        listTeamsOnce,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useWFC() {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useWFC must be used within StoreProvider');
  return context;
}
