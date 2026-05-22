import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { HOLES } from './holes';
import { db, isFirebaseConfigured } from './firebase';
import { useToast } from '@/hooks/use-toast';
import {
  doc, setDoc, onSnapshot, serverTimestamp,
  collection, writeBatch, increment, arrayUnion, query, orderBy, getDocs,
  runTransaction, addDoc,
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
  rawNet: number;
  holesPlayed: number;
  frontNineConfirmed: boolean;
  wheelSpin: WheelSpinRecord | null;
  wheelAdjustment: number;
  targetedBy: TargetedByEntry[];
  hasSubmitted: boolean;
  submittedAt: number | null;
  serverTeamMissing: boolean;
  resetDevice: () => void;
  setTeamInfo: (info: TeamInfo) => void;
  setScore: (hole: number, score: number | null) => void;
  resetScores: () => void;
  confirmFrontNine: () => void;
  recordWheelSpin: (record: WheelSpinRecord) => Promise<void>;
  applyEffectToOthers: (item: WheelItemId, targetIds: string[]) => Promise<void>;
  applyEffectToSelf: (delta: number) => void;
  submitFinal: () => void;
  listTeamsOnce: () => Promise<TeamSnapshot[]>;
  logEvent: (event: Record<string, unknown>) => void;
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
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [submittedAt, setSubmittedAt] = useState<number | null>(null);
  // True once we've confirmed (via a server-authoritative snapshot) that the
  // team doc does NOT exist on Firestore. Used to power the "Start fresh on
  // this device" escape hatch — only shown when the server has clearly
  // dropped this team (e.g. admin deleted them), so genuinely-submitted
  // teams can't accidentally unlock themselves.
  const [serverTeamMissing, setServerTeamMissing] = useState(false);
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
        if (typeof parsed.hasSubmitted === 'boolean') setHasSubmitted(parsed.hasSubmitted);
        if (typeof parsed.submittedAt === 'number') setSubmittedAt(parsed.submittedAt);
      }
      // Legacy flag from older versions — honor it so existing submitted teams stay locked.
      if (localStorage.getItem('wfc-submitted') === 'true') setHasSubmitted(true);
    } catch (e) {
      console.error('Failed to load store', e);
    }
    hydratedRef.current = true;
  }, []);

  // Flips true after the first server-confirmed snapshot for our team doc
  // (or the first time we know the doc doesn't exist on the server). Until
  // then we DO NOT push any sync writes — that would let a stale client
  // overwrite server-truth gameplay data during the hydration race window.
  const lockResolvedRef = useRef(false);
  const [lockResolved, setLockResolved] = useState(false);

  // ── Listen to our own Firestore doc — picks up cross-device effects (Lightning, Shells, etc.) ──
  // Skips local-cache-only events to avoid feedback loops with our own writes.
  useEffect(() => {
    if (!isFirebaseConfigured || !db) {
      // No Firestore — local state is the only truth, mark resolved immediately.
      lockResolvedRef.current = true;
      setLockResolved(true);
      return;
    }
    const ref = doc(db, 'teams', teamId);
    const unsub = onSnapshot(ref, (snap) => {
      // Only react to confirmed server state; ignore optimistic local-cache events.
      if (snap.metadata.hasPendingWrites) return;
      // Mark the lock as resolved on the first server-confirmed snapshot,
      // regardless of whether the doc exists. From here on it is safe to write.
      if (!lockResolvedRef.current) {
        lockResolvedRef.current = true;
        setLockResolved(true);
      }
      // Only trust missing-doc snapshots that came from the SERVER, not the
      // local Firestore cache. Otherwise a cold-boot cache snapshot can
      // false-positive `serverTeamMissing` for a fraction of a second and
      // briefly expose the "Start Fresh" escape hatch to genuinely
      // submitted teams.
      const serverConfirmed = snap.metadata.fromCache === false;
      if (!snap.exists()) {
        if (serverConfirmed) {
          // Server-confirmed: no doc for this teamId. Could mean (a) never
          // registered, or (b) admin deleted the team. Either way, surface
          // this so the Home screen can offer a recovery path for a stale
          // hasSubmitted=true device.
          setServerTeamMissing(prev => prev ? prev : true);
        }
        return;
      }
      // Doc exists — clear the missing flag (and only trust this when
      // server-confirmed, to symmetrically avoid cache flicker).
      if (serverConfirmed) {
        setServerTeamMissing(prev => prev ? false : prev);
      }
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
      // Submission lock is sticky once Firestore confirms it — even clearing
      // localStorage on the device won't let a team unlock and re-edit scores.
      if (data.hasSubmitted === true) {
        setHasSubmitted(prev => prev ? prev : true);
        if (typeof data.submittedAt === 'number') {
          setSubmittedAt(prev => prev ?? data.submittedAt);
        }
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
        setHasSubmitted(false);
        setSubmittedAt(null);
        try {
          localStorage.setItem(STORE_KEY, JSON.stringify({ teamInfo: null, scores: emptyScores }));
          localStorage.setItem(JOINED_AT_KEY, String(resetAt + 1));
          localStorage.removeItem('wfc-submitted');
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
    hasSubmitted: boolean;
    submittedAt: number | null;
  }>) => {
    try {
      const current = {
        teamInfo, scores, frontNineConfirmed, wheelSpin,
        wheelAdjustment, targetedBy, hasSubmitted, submittedAt,
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
  // Raw under-par count (your scorecard vs par, NO wheel adjustments).
  // Used for tee assignment so being hit by lightning/shells/etc. never
  // moves your tee block. Wheel items affect your net score on the
  // leaderboard but do not change which tees you play from.
  const rawNet = holesPlayed > 0 ? totalScore - parPlayed : 0;
  const netScore = rawNet + wheelAdjustment;
  const currentTee: 'tips' | 'womens' = rawNet < 0 ? 'tips' : 'womens';

  // ── Global tee-change notification: fires on any tab (Hole, Scorecard, etc.)
  // because this lives in the provider, not in a page component. Skips the
  // first render so we don't toast on app load.
  const { toast } = useToast();
  const teeMountRef = useRef(false);
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (!teeMountRef.current) {
      teeMountRef.current = true;
      return;
    }
    const teeToastClass =
      'border-primary/60 bg-primary/15 text-foreground backdrop-blur ' +
      '[&>div>div:first-child]:text-primary [&>div>div:first-child]:font-condensed ' +
      '[&>div>div:first-child]:uppercase [&>div>div:first-child]:tracking-widest';
    if (currentTee === 'tips') {
      toast({
        title: 'Tee unlocked: Tips',
        description: 'Your raw score is under par. Next hole plays from the longest yardage.',
        className: teeToastClass,
      });
    } else {
      toast({
        title: 'Tee switched to Women\u2019s',
        description: 'Your raw score is at or over par. Next hole plays from the shortest yardage.',
        className: teeToastClass,
      });
    }
  }, [currentTee, toast]);

  // ── Push own changes to Firestore ──
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (!isFirebaseConfigured || !db) return;
    if (!teamInfo) return;
    // Critical race protection: do NOT push writes until we've seen the first
    // server snapshot. Otherwise a freshly-booted client with hasSubmitted=false
    // locally could overwrite server gameplay state before the snapshot
    // listener has had a chance to restore the true submitted/locked state.
    if (!lockResolved) return;
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
    // Monotonic lock: once hasSubmitted is true (locally OR on the server),
    // NEVER write false back. Clearing localStorage on a device must not
    // unlock the round. We only include the submission fields in the merge
    // payload when locally true so a stale client can't downgrade the server.
    const payload: Record<string, unknown> = {
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
    };
    if (hasSubmitted) {
      payload.hasSubmitted = true;
      payload.submittedAt = submittedAt ?? Date.now();
    }
    setDoc(ref, payload, { merge: true }).catch(err => console.error('Firestore sync failed', err));
  }, [teamId, teamInfo, scores, netScore, holesPlayed, currentTee, frontNineConfirmed, wheelSpin, hasSubmitted, submittedAt, lockResolved]);

  const updateTeamInfo = (info: TeamInfo) => {
    // Once submitted, the team identity is frozen for audit integrity.
    if (hasSubmitted) {
      toast({
        title: 'Round already submitted',
        description: 'Team info is locked once a final score is in. Ask the tournament admin to make changes.',
        variant: 'destructive',
      });
      return;
    }
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
    if (hasSubmitted) return; // sticky lock — silent ignore (UI also blocks)
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
    setHasSubmitted(false);
    setSubmittedAt(null);
    saveToLocal({
      teamInfo: null, scores: newScores, frontNineConfirmed: false,
      wheelSpin: null, wheelAdjustment: 0, targetedBy: [],
      hasSubmitted: false, submittedAt: null,
    });
    try { localStorage.removeItem('wfc-submitted'); } catch { /* ignore */ }
  };

  const confirmFrontNine = () => {
    if (hasSubmitted) return;
    setFrontNineConfirmed(true);
    saveToLocal({ frontNineConfirmed: true });
  };

  const submitFinal = () => {
    if (hasSubmitted) return;
    const at = Date.now();
    setHasSubmitted(true);
    setSubmittedAt(at);
    saveToLocal({ hasSubmitted: true, submittedAt: at });
    try { localStorage.setItem('wfc-submitted', 'true'); } catch { /* ignore */ }
  };

  const recordWheelSpin = async (record: WheelSpinRecord) => {
    if (hasSubmitted) return;
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
          const data = snap.exists() ? snap.data() : undefined;
          // Server-authoritative submit lock: if the round is submitted on
          // the server, refuse to record any new spin no matter what the
          // local client believes. This closes the race window where a
          // stale client booting with hasSubmitted=false could still write.
          if (data?.hasSubmitted === true) {
            const existingSpin = data.wheelSpin as WheelSpinRecord | undefined;
            // Return existing spin if any; otherwise throw to abort.
            if (existingSpin && existingSpin.item) return existingSpin;
            throw new Error('submitted');
          }
          const existing = data?.wheelSpin as WheelSpinRecord | undefined;
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
        const msg = e instanceof Error ? e.message : '';
        if (msg === 'submitted') {
          // Hard-stop: server says this team has already submitted. Never
          // record the spin — that would corrupt the final-score audit trail.
          console.warn('Spin refused: round already submitted on server.');
          // Sticky local lock so the UI flips to read-only immediately.
          setHasSubmitted(true);
          saveToLocal({ hasSubmitted: true });
          return;
        }
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

  const logEvent = (event: Record<string, unknown>) => {
    if (!isFirebaseConfigured || !db) return;
    addDoc(collection(db, 'events'), {
      ...event,
      timestamp: serverTimestamp(),
    }).catch(() => { /* non-fatal */ });
  };

  // Escape hatch: wipe ALL local state for this device and reload. Used by
  // the Home screen when a device is locked (hasSubmitted=true) but the
  // server has no doc for this teamId (admin deleted them, or test data).
  // Genuinely-submitted teams whose server doc still exists won't see the
  // button that triggers this, so the submission lock stays sticky.
  const resetDevice = () => {
    try {
      localStorage.removeItem(STORE_KEY);
      localStorage.removeItem(TEAM_ID_KEY);
      localStorage.removeItem(JOINED_AT_KEY);
      localStorage.removeItem('wfc-submitted');
    } catch { /* ignore */ }
    window.location.reload();
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
        rawNet,
        holesPlayed,
        serverTeamMissing,
        resetDevice,
        frontNineConfirmed,
        wheelSpin,
        wheelAdjustment,
        targetedBy,
        hasSubmitted,
        submittedAt,
        setTeamInfo: updateTeamInfo,
        setScore,
        resetScores,
        confirmFrontNine,
        recordWheelSpin,
        applyEffectToOthers,
        applyEffectToSelf,
        submitFinal,
        listTeamsOnce,
        logEvent,
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
