import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { db, isFirebaseConfigured } from './firebase';
import { useToast } from '@/hooks/use-toast';
import {
  setDoc, onSnapshot, serverTimestamp,
  writeBatch, increment, arrayUnion, query, orderBy, getDocs,
  addDoc,
} from 'firebase/firestore';
import {
  writeHoleScore, spinsFromData, reconcileWheelHits, recordWheelSpinTx,
  type WheelSpinRecord, type TargetedByEntry,
} from './scoreSync';
import type { WheelItemId } from './wheel';
import { useCourse, useTournament } from './tournamentContext';
import {
  getActiveTournamentId, teamDoc, teamsCol, eventsCol, configDoc,
  normalizeScores, generateTeamCode,
  storeKey, teamIdKey, joinedAtKey, serverConfirmedKey, startingHoleKey,
  playOrder,
} from './tournament';

export interface TeamInfo { teamName: string; players: string[]; }

// TargetedByEntry, WheelSpinRecord and spinsFromData now live in scoreSync.ts
// (so the wheel write paths can be unit-tested with the Firestore fake). They're
// re-exported here for the existing `@/lib/store` import sites.
export type { TargetedByEntry, WheelSpinRecord };
export { spinsFromData };

// Latest spin (by timestamp) across all holes, for back-compat single-spin UI.
function latestSpin(spins: Record<number, WheelSpinRecord>): WheelSpinRecord | null {
  const all = Object.values(spins);
  if (all.length === 0) return null;
  return all.reduce((a, b) => (b.at > a.at ? b : a));
}

function spinsEqual(a: Record<number, WheelSpinRecord>, b: Record<number, WheelSpinRecord>): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export interface WFCState {
  teamId: string;
  teamCode: string | null;
  teamInfo: TeamInfo | null;
  scores: (number | null)[];
  currentTee: 'tips' | 'womens';
  netScore: number;
  rawNet: number;
  holesPlayed: number;
  /** This team's starting hole (1–18). Always 1 for normal-start tournaments. */
  startingHole: number;
  /** Play order of hole numbers (1–18). For normal start this is [1..18]; for
   *  shotgun it wraps from startingHole around to startingHole-1. */
  holeOrder: number[];
  /** True when the active tournament uses a shotgun start. */
  isShotgun: boolean;
  frontNineConfirmed: boolean;
  /** Latest spin across all holes (back-compat single-spin UI). */
  wheelSpin: WheelSpinRecord | null;
  /** Per-hole wheel spins, keyed by hole number (1–18). */
  wheelSpins: Record<number, WheelSpinRecord>;
  wheelAdjustment: number;
  targetedBy: TargetedByEntry[];
  hasSubmitted: boolean;
  submittedAt: number | null;
  serverTeamMissing: boolean;
  resetDevice: () => void;
  setTeamInfo: (info: TeamInfo) => void;
  adoptTeam: (existingTeamId: string) => void;
  setScore: (hole: number, score: number | null) => void;
  resetScores: () => void;
  confirmFrontNine: () => void;
  recordWheelSpin: (hole: number, record: WheelSpinRecord) => Promise<void>;
  applyEffectToOthers: (item: WheelItemId, targetIds: string[]) => Promise<void>;
  applyEffectToSelf: (delta: number) => void;
  submitFinal: () => void;
  listTeamsOnce: () => Promise<TeamSnapshot[]>;
  logEvent: (event: Record<string, unknown>) => void;
}

export interface TeamSnapshot {
  id: string;
  teamName: string;
  players: string[];
  teamCode?: string;
  netScore: number;
  holesPlayed: number;
}

const StoreContext = createContext<WFCState | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  // One tournament is active for the lifetime of this provider (App keys the
  // provider on the active tournament id, so it remounts on switch).
  const tId = getActiveTournamentId();
  const STORE_KEY = storeKey(tId);
  const TEAM_ID_KEY = teamIdKey(tId);
  const JOINED_AT_KEY = joinedAtKey(tId);
  const SERVER_CONFIRMED_KEY = serverConfirmedKey(tId);

  const { holes: courseHoles, autoTeeRule } = useCourse();
  const { tournament } = useTournament();
  const STARTING_HOLE_KEY = startingHoleKey(tId);
  const isShotgun = tournament?.startType === 'shotgun';

  const getOrCreateTeamId = (): string => {
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
  };

  const [teamId, setTeamId] = useState<string>(() => getOrCreateTeamId());
  const [teamCode, setTeamCode] = useState<string | null>(null);
  const [teamInfo, setTeamInfo] = useState<TeamInfo | null>(null);
  const [scores, setScoresState] = useState<(number | null)[]>(Array(18).fill(null));
  const [frontNineConfirmed, setFrontNineConfirmed] = useState(false);
  const [wheelSpins, setWheelSpins] = useState<Record<number, WheelSpinRecord>>({});
  const [wheelAdjustment, setWheelAdjustment] = useState(0);
  const [targetedBy, setTargetedBy] = useState<TargetedByEntry[]>([]);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [submittedAt, setSubmittedAt] = useState<number | null>(null);
  const [serverTeamMissing, setServerTeamMissing] = useState(false);
  // Admin-set manual tee override ('tips'|'womens'); null means follow the
  // auto-tee rule. Read from the server doc, written only by the admin panel.
  const [teeOverride, setTeeOverride] = useState<'tips' | 'womens' | null>(null);
  // Starting hole (1–18) for this team. Initialised from the per-tournament
  // cache so a shotgun player keeps the right wrap-around order offline, before
  // the tournament doc resolves. Defaults to 1 (normal start).
  const [startingHole, setStartingHole] = useState<number>(() => {
    try {
      const cached = Number(localStorage.getItem(STARTING_HOLE_KEY));
      return cached >= 1 && cached <= 18 ? cached : 1;
    } catch {
      return 1;
    }
  });
  const hydratedRef = useRef(false);

  // ── Hydrate from localStorage ──
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.teamInfo) {
          // Migrate legacy {player1,player2} shape → players[].
          const ti = parsed.teamInfo;
          if (Array.isArray(ti.players)) {
            setTeamInfo({ teamName: ti.teamName, players: ti.players });
          } else {
            const players = [ti.player1, ti.player2].filter((p: unknown): p is string => typeof p === 'string' && p.trim() !== '');
            setTeamInfo({ teamName: ti.teamName ?? '', players });
          }
        }
        if (typeof parsed.teamCode === 'string') setTeamCode(parsed.teamCode);
        if (parsed.scores && Array.isArray(parsed.scores)) setScoresState(parsed.scores);
        if (typeof parsed.frontNineConfirmed === 'boolean') setFrontNineConfirmed(parsed.frontNineConfirmed);
        if (parsed.wheelSpins && typeof parsed.wheelSpins === 'object') {
          setWheelSpins(spinsFromData(parsed));
        } else if (parsed.wheelSpin) {
          setWheelSpins({ 9: parsed.wheelSpin });
        }
        if (typeof parsed.wheelAdjustment === 'number') setWheelAdjustment(parsed.wheelAdjustment);
        if (Array.isArray(parsed.targetedBy)) setTargetedBy(parsed.targetedBy);
        if (typeof parsed.hasSubmitted === 'boolean') setHasSubmitted(parsed.hasSubmitted);
        if (typeof parsed.submittedAt === 'number') setSubmittedAt(parsed.submittedAt);
      }
    } catch (e) {
      console.error('Failed to load store', e);
    }
    hydratedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lockResolvedRef = useRef(false);
  const [lockResolved, setLockResolved] = useState(false);

  // ── Listen to our own Firestore doc ──
  useEffect(() => {
    if (!isFirebaseConfigured || !db || !tId) {
      lockResolvedRef.current = true;
      setLockResolved(true);
      return;
    }
    const ref = teamDoc(db, teamId);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.metadata.hasPendingWrites) return;
      if (!lockResolvedRef.current) {
        lockResolvedRef.current = true;
        setLockResolved(true);
      }
      const serverConfirmed = snap.metadata.fromCache === false;
      if (!snap.exists()) {
        if (serverConfirmed) {
          setServerTeamMissing(prev => prev ? prev : true);
        }
        return;
      }
      if (serverConfirmed) {
        setServerTeamMissing(prev => prev ? false : prev);
        try { localStorage.setItem(SERVER_CONFIRMED_KEY, '1'); } catch { /* ignore */ }
      }
      const data = snap.data();
      // Restore team identity from the server (powers rejoin / shared access).
      if (typeof data.teamName === 'string' && Array.isArray(data.players)) {
        setTeamInfo(prev => {
          const incoming = { teamName: data.teamName as string, players: data.players as string[] };
          return JSON.stringify(prev) === JSON.stringify(incoming) ? prev : incoming;
        });
      }
      if (typeof data.teamCode === 'string') {
        setTeamCode(prev => prev === data.teamCode ? prev : data.teamCode);
      }
      // Conflict-free scores: server map is authoritative once confirmed.
      if ('scores' in data) {
        const arr = normalizeScores(data.scores);
        setScoresState(prev => JSON.stringify(prev) === JSON.stringify(arr) ? prev : arr);
      }
      if (typeof data.wheelAdjustment === 'number') {
        setWheelAdjustment(prev => prev === data.wheelAdjustment ? prev : data.wheelAdjustment);
      }
      if (Array.isArray(data.targetedBy)) {
        setTargetedBy(prev => {
          const incoming = data.targetedBy as TargetedByEntry[];
          return JSON.stringify(prev) === JSON.stringify(incoming) ? prev : incoming;
        });
      }
      if ('wheelSpins' in data || 'wheelSpin' in data) {
        const incoming = spinsFromData(data);
        setWheelSpins(prev => (spinsEqual(prev, incoming) ? prev : incoming));
      }
      if (typeof data.frontNineConfirmed === 'boolean') {
        setFrontNineConfirmed(prev => prev === data.frontNineConfirmed ? prev : data.frontNineConfirmed);
      }
      // Admin-set manual tee override; anything else clears it (auto-tee rule).
      {
        const ov = data.teeOverride === 'tips' || data.teeOverride === 'womens'
          ? data.teeOverride
          : null;
        setTeeOverride(prev => prev === ov ? prev : ov);
      }
      if (data.hasSubmitted === true) {
        setHasSubmitted(prev => prev ? prev : true);
        if (typeof data.submittedAt === 'number') {
          setSubmittedAt(prev => prev ?? data.submittedAt);
        }
      }
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, tId]);

  // ── Continuous reconciliation of cross-team wheel hits ──
  const reconcileInFlightRef = useRef(false);
  useEffect(() => {
    if (!isFirebaseConfigured || !db || !tId) return;
    if (!lockResolved) return;
    if (!teamInfo) return;
    const fdb = db;
    const ourTeamName = teamInfo.teamName;
    const unsub = onSnapshot(teamsCol(fdb), async (snap) => {
      if (reconcileInFlightRef.current) return;
      const expected: { item: WheelItemId; fromTeam: string; at: number }[] = [];
      for (const d of snap.docs) {
        if (d.id === teamId) continue;
        const data = d.data();
        const fromTeam = (data.teamName as string | undefined) ?? 'Unknown';
        for (const spin of Object.values(spinsFromData(data))) {
          if (!spin.item || typeof spin.at !== 'number') continue;
          if (spin.item === 'lightning') {
            expected.push({ item: 'lightning', fromTeam, at: spin.at });
          } else if (
            (spin.item === 'green_shell' || spin.item === 'red_shell' ||
             spin.item === 'blue_shell' || spin.item === 'banana' ||
             spin.item === 'boo') &&
            spin.targetTeam === ourTeamName
          ) {
            expected.push({ item: spin.item, fromTeam, at: spin.at });
          }
        }
      }
      if (expected.length === 0) return;
      const localKeys = new Set(targetedBy.map(t => `${t.fromTeam}|${t.at}`));
      const possiblyMissing = expected.filter(e => !localKeys.has(`${e.fromTeam}|${e.at}`));
      if (possiblyMissing.length === 0) return;
      reconcileInFlightRef.current = true;
      try {
        const ref = teamDoc(fdb, teamId);
        await reconcileWheelHits(fdb, ref, possiblyMissing);
      } catch (e) {
        console.error('Hit reconciliation failed', e);
      } finally {
        reconcileInFlightRef.current = false;
      }
    }, (err) => console.error('Teams reconcile listener error', err));
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, teamInfo, lockResolved, tId]);

  // ── Admin reset listener ──
  useEffect(() => {
    if (!isFirebaseConfigured || !db || !tId) return;
    const ref = configDoc(db);
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
        setWheelSpins({});
        setWheelAdjustment(0);
        setTargetedBy([]);
        setHasSubmitted(false);
        setSubmittedAt(null);
        try {
          localStorage.setItem(STORE_KEY, JSON.stringify({ teamInfo: null, scores: emptyScores }));
          localStorage.setItem(JOINED_AT_KEY, String(resetAt + 1));
        } catch { /* ignore */ }
      }
    }, (err) => console.error('Reset listener error', err));
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tId]);

  const saveToLocal = (overrides: Partial<{
    teamInfo: TeamInfo | null;
    teamCode: string | null;
    scores: (number | null)[];
    frontNineConfirmed: boolean;
    wheelSpins: Record<number, WheelSpinRecord>;
    wheelAdjustment: number;
    targetedBy: TargetedByEntry[];
    hasSubmitted: boolean;
    submittedAt: number | null;
  }>) => {
    try {
      const current = {
        teamInfo, teamCode, scores, frontNineConfirmed, wheelSpins,
        wheelAdjustment, targetedBy, hasSubmitted, submittedAt,
      };
      const next = { ...current, ...overrides };
      localStorage.setItem(STORE_KEY, JSON.stringify(next));
    } catch (e) {
      console.error('Failed to save store', e);
    }
  };

  // ── Resolve this team's starting hole from the tournament config ──
  // Normal start → always hole 1. Shotgun → the host-assigned hole for this
  // team (falls back to the cached value, then 1). While the tournament doc is
  // still null (offline / loading) we keep whatever was cached so the play
  // order doesn't flicker back to 1.
  useEffect(() => {
    if (!tournament) return;
    let next = 1;
    if (tournament.startType === 'shotgun') {
      const assigned = tournament.shotgunAssignments?.[teamId];
      if (typeof assigned === 'number' && assigned >= 1 && assigned <= 18) {
        next = assigned;
      } else {
        next = startingHole; // keep current until the host assigns one
      }
    }
    if (next !== startingHole) setStartingHole(next);
    try { localStorage.setItem(STARTING_HOLE_KEY, String(next)); } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournament, teamId]);

  // Play order of hole numbers (1–18). Normal start reduces to [1..18], so all
  // downstream play-order math collapses to the original index math.
  const holeOrder = playOrder(startingHole);

  // ── Derive aggregates ──
  let totalScore = 0;
  let parPlayed = 0;
  let holesPlayed = 0;
  scores.forEach((s, i) => {
    if (s !== null) {
      totalScore += s;
      parPlayed += courseHoles[i]?.par ?? 4;
      holesPlayed += 1;
    }
  });
  const rawNet = holesPlayed > 0 ? totalScore - parPlayed : 0;
  const netScore = rawNet + wheelAdjustment;
  // Latest spin across all holes, for single-spin UI (e.g. the "what you spun" pill).
  const wheelSpin = latestSpin(wheelSpins);
  const currentTee: 'tips' | 'womens' = teeOverride ?? (autoTeeRule ? (rawNet < 0 ? 'tips' : 'womens') : 'womens');

  // ── Tee-change notification (only when the auto-tee rule is on) ──
  const { toast } = useToast();
  const teeMountRef = useRef(false);
  useEffect(() => {
    if (!autoTeeRule) return;
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
  }, [currentTee, toast, autoTeeRule]);

  // ── Push own (non-score) changes to Firestore ──
  // Per-hole scores are written by setScore via field-level merges so two
  // teammates never clobber each other. This effect only pushes derived /
  // identity fields.
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (!isFirebaseConfigured || !db || !tId) return;
    if (!teamInfo) return;
    if (!lockResolved) return;
    if (hasSubmitted) return;
    const ref = teamDoc(db, teamId);
    // Per-hole wheel spins are written by recordWheelSpin via field-level merge;
    // this effect only pushes derived / identity fields.
    const payload: Record<string, unknown> = {
      teamName: teamInfo.teamName,
      players: teamInfo.players,
      netScore,
      holesPlayed,
      currentTee,
      frontNineConfirmed,
      lastUpdated: serverTimestamp(),
    };
    if (teamCode) payload.teamCode = teamCode;
    if (hasSubmitted) {
      payload.hasSubmitted = true;
      payload.submittedAt = submittedAt ?? Date.now();
    }
    setDoc(ref, payload, { merge: true }).catch(err => console.error('Firestore sync failed', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, teamInfo, teamCode, netScore, holesPlayed, currentTee, frontNineConfirmed, hasSubmitted, submittedAt, lockResolved, tId]);

  const updateTeamInfo = (info: TeamInfo) => {
    if (hasSubmitted) {
      toast({
        title: 'Round already submitted',
        description: 'Team info is locked once a final score is in. Ask the tournament admin to make changes.',
        variant: 'destructive',
      });
      return;
    }
    // Generate a team code the first time a team registers (used for rejoin).
    let code = teamCode;
    if (!code) {
      code = generateTeamCode();
      setTeamCode(code);
    }
    setTeamInfo(info);
    saveToLocal({ teamInfo: info, teamCode: code });
    try { localStorage.setItem(JOINED_AT_KEY, String(Date.now())); } catch { /* ignore */ }
    if (isFirebaseConfigured && db && tId) {
      const fdb = db;
      const ref = teamDoc(fdb, teamId);
      const finalCode = code;
      (async () => {
        let initialWheelAdj = 0;
        let initialTargetedBy: TargetedByEntry[] = [];
        try {
          const teamsSnap = await getDocs(teamsCol(fdb));
          for (const d of teamsSnap.docs) {
            if (d.id === teamId) continue;
            const data = d.data();
            for (const spin of Object.values(spinsFromData(data))) {
              if (spin.item === 'lightning') {
                initialTargetedBy.push({
                  item: 'lightning',
                  fromTeam: (data.teamName as string | undefined) ?? 'Unknown',
                  at: spin.at ?? Date.now(),
                });
              }
            }
          }
          if (initialTargetedBy.length > 0) {
            initialWheelAdj = initialTargetedBy.length;
            setWheelAdjustment(initialWheelAdj);
            setTargetedBy(initialTargetedBy);
            saveToLocal({ wheelAdjustment: initialWheelAdj, targetedBy: initialTargetedBy });
          }
        } catch { /* non-fatal */ }
        setDoc(ref, {
          teamName: info.teamName,
          players: info.players,
          teamCode: finalCode,
          scores: {},
          netScore: initialWheelAdj,
          holesPlayed: 0,
          currentTee: 'womens',
          frontNineConfirmed: false,
          wheelSpins: {},
          wheelAdjustment: initialWheelAdj,
          targetedBy: initialTargetedBy,
        }, { merge: true }).catch(() => {});
      })();
    }
  };

  // Adopt an existing team's identity on this device (rejoin / shared access).
  // We point the device at the existing team doc id and reload so the snapshot
  // listener hydrates all gameplay state cleanly from the server.
  const adoptTeam = (existingTeamId: string) => {
    try {
      localStorage.setItem(TEAM_ID_KEY, existingTeamId);
      localStorage.removeItem(STORE_KEY);
      localStorage.setItem(JOINED_AT_KEY, String(Date.now()));
    } catch { /* ignore */ }
    setTeamId(existingTeamId);
    window.location.reload();
  };

  const setScore = (hole: number, score: number | null) => {
    if (hasSubmitted) return;
    if (tournament?.status === 'final') return;
    const newScores = [...scores];
    newScores[hole - 1] = score;
    setScoresState(newScores);
    saveToLocal({ scores: newScores });
    // Conflict-free per-hole write — field-level merge so concurrent scoring
    // of different holes by teammates never clobbers.
    if (isFirebaseConfigured && db && tId && teamInfo && lockResolved) {
      writeHoleScore(db, teamDoc(db, teamId), hole, score)
        .catch(err => console.error('Score sync failed', err));
    }
  };

  const resetScores = () => {
    const newScores = Array(18).fill(null);
    setScoresState(newScores);
    setTeamInfo(null);
    setFrontNineConfirmed(false);
    setWheelSpins({});
    setWheelAdjustment(0);
    setTargetedBy([]);
    setHasSubmitted(false);
    setSubmittedAt(null);
    saveToLocal({
      teamInfo: null, scores: newScores, frontNineConfirmed: false,
      wheelSpins: {}, wheelAdjustment: 0, targetedBy: [],
      hasSubmitted: false, submittedAt: null,
    });
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
  };

  const recordWheelSpin = async (hole: number, record: WheelSpinRecord) => {
    if (hasSubmitted) return;
    if (tournament?.status === 'final') return;
    // Guard against a double-spin for this hole using the latest known state.
    if (wheelSpins[hole]?.item) return;
    const commitLocal = (spin: WheelSpinRecord) => {
      setWheelSpins(prev => {
        const next = { ...prev, [hole]: spin };
        saveToLocal({ wheelSpins: next });
        return next;
      });
    };
    if (isFirebaseConfigured && db && tId && teamInfo) {
      const ref = teamDoc(db, teamId);
      try {
        const finalRecord = await recordWheelSpinTx(db, ref, hole, record);
        commitLocal(finalRecord);
      } catch (e) {
        const msg = e instanceof Error ? e.message : '';
        if (msg === 'submitted') {
          console.warn('Spin refused: round already submitted on server.');
          setHasSubmitted(true);
          saveToLocal({ hasSubmitted: true });
          return;
        }
        console.error('Failed to record wheel spin', e);
        commitLocal(record);
      }
    } else {
      commitLocal(record);
    }
  };

  const applyEffectToSelf = (delta: number) => {
    if (hasSubmitted) return;
    if (tournament?.status === 'final') return;
    const nextAdjustment = wheelAdjustment + delta;
    setWheelAdjustment(nextAdjustment);
    saveToLocal({ wheelAdjustment: nextAdjustment });
    if (isFirebaseConfigured && db && tId && teamInfo) {
      setDoc(teamDoc(db, teamId), {
        wheelAdjustment: increment(delta),
      }, { merge: true }).catch(e => console.error('Self effect sync failed', e));
    }
  };

  const applyEffectToOthers = async (item: WheelItemId, targetIds: string[]) => {
    if (hasSubmitted) return;
    if (tournament?.status === 'final') return;
    if (!isFirebaseConfigured || !db || !tId || !teamInfo) return;
    if (targetIds.length === 0) return;
    try {
      const batch = writeBatch(db);
      const now = Date.now();
      for (const tid of targetIds) {
        if (tid === teamId) continue;
        const ref = teamDoc(db, tid);
        batch.set(ref, {
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
    if (!isFirebaseConfigured || !db || !tId) return;
    addDoc(eventsCol(db), {
      ...event,
      timestamp: serverTimestamp(),
    }).catch(() => { /* non-fatal */ });
  };

  const resetDevice = () => {
    try {
      localStorage.removeItem(STORE_KEY);
      localStorage.removeItem(TEAM_ID_KEY);
      localStorage.removeItem(JOINED_AT_KEY);
      localStorage.removeItem(SERVER_CONFIRMED_KEY);
    } catch { /* ignore */ }
    window.location.reload();
  };

  // ── Auto-wipe on admin delete ──
  const autoWipeFiredRef = useRef(false);
  useEffect(() => {
    if (!serverTeamMissing) return;
    if (!hydratedRef.current) return;
    if (autoWipeFiredRef.current) return;
    let wasConfirmed = false;
    try { wasConfirmed = localStorage.getItem(SERVER_CONFIRMED_KEY) === '1'; } catch { /* ignore */ }
    if (!wasConfirmed) return;
    autoWipeFiredRef.current = true;
    toast({
      title: 'Team removed by admin',
      description: 'Wiping this device — you can register again in a moment.',
      variant: 'destructive',
    });
    const t = setTimeout(() => resetDevice(), 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverTeamMissing]);

  const listTeamsOnce = async (): Promise<TeamSnapshot[]> => {
    if (!isFirebaseConfigured || !db || !tId) {
      if (!teamInfo) return [];
      return [{
        id: teamId,
        teamName: teamInfo.teamName,
        players: teamInfo.players,
        teamCode: teamCode ?? undefined,
        netScore,
        holesPlayed,
      }];
    }
    const q = query(teamsCol(db), orderBy('netScore', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        teamName: data.teamName ?? 'Team',
        players: Array.isArray(data.players) ? data.players : [data.player1, data.player2].filter(Boolean),
        teamCode: typeof data.teamCode === 'string' ? data.teamCode : undefined,
        netScore: typeof data.netScore === 'number' ? data.netScore : 0,
        holesPlayed: typeof data.holesPlayed === 'number' ? data.holesPlayed : 0,
      };
    });
  };

  return (
    <StoreContext.Provider
      value={{
        teamId,
        teamCode,
        teamInfo,
        scores,
        currentTee,
        netScore,
        rawNet,
        holesPlayed,
        startingHole,
        holeOrder,
        isShotgun,
        serverTeamMissing,
        resetDevice,
        frontNineConfirmed,
        wheelSpin,
        wheelSpins,
        wheelAdjustment,
        targetedBy,
        hasSubmitted,
        submittedAt,
        setTeamInfo: updateTeamInfo,
        adoptTeam,
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
