import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { collection, doc, setDoc, onSnapshot, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import {
  type TournamentConfig, type CourseHole,
  dundeeCourseDefaults,
  getActiveTournamentId, setActiveTournamentId,
  tournamentDoc, hostKeyKey, spectatorKey,
} from './tournament';

interface TournamentContextValue {
  activeId: string | null;
  tournament: TournamentConfig | null;
  loading: boolean;
  isHost: boolean;
  isSpectator: boolean;
  /** Effective course (tournament course, or Dundee defaults when none active). */
  courseHoles: CourseHole[];
  trackYardages: boolean;
  autoTeeRule: boolean;
  setActiveTournament: (id: string | null) => void;
  enterSpectator: (id: string) => void;
  leaveTournament: () => void;
  /** Resolve a 6-char join code to a tournament id (Firestore lookup). */
  lookupJoinCode: (code: string) => Promise<TournamentConfig | null>;
}

const TournamentContext = createContext<TournamentContextValue | null>(null);

export function TournamentProvider({ children }: { children: ReactNode }) {
  const [activeId, setActiveIdState] = useState<string | null>(() => getActiveTournamentId());
  const [tournament, setTournament] = useState<TournamentConfig | null>(null);
  const [loading, setLoading] = useState<boolean>(!!getActiveTournamentId() && isFirebaseConfigured);
  const [isSpectator, setIsSpectator] = useState<boolean>(() => {
    const id = getActiveTournamentId();
    if (!id) return false;
    try { return localStorage.getItem(spectatorKey(id)) === '1'; } catch { return false; }
  });

  // Subscribe to the active tournament doc.
  useEffect(() => {
    if (!activeId || !isFirebaseConfigured || !db) {
      setTournament(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(
      tournamentDoc(db, activeId),
      snap => {
        if (snap.exists()) {
          setTournament({ id: snap.id, ...snap.data() } as TournamentConfig);
        } else {
          setTournament(null);
        }
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, [activeId]);

  const setActiveTournament = useCallback((id: string | null) => {
    setActiveTournamentId(id);
    setActiveIdState(id);
    if (id) {
      try { setIsSpectator(localStorage.getItem(spectatorKey(id)) === '1'); } catch { setIsSpectator(false); }
    } else {
      setIsSpectator(false);
    }
  }, []);

  const enterSpectator = useCallback((id: string) => {
    try { localStorage.setItem(spectatorKey(id), '1'); } catch { /* ignore */ }
    setActiveTournamentId(id);
    setActiveIdState(id);
    setIsSpectator(true);
  }, []);

  const leaveTournament = useCallback(() => {
    const id = getActiveTournamentId();
    if (id) {
      try { localStorage.removeItem(spectatorKey(id)); } catch { /* ignore */ }
    }
    setActiveTournamentId(null);
    setActiveIdState(null);
    setIsSpectator(false);
    setTournament(null);
  }, []);

  const lookupJoinCode = useCallback(async (code: string): Promise<TournamentConfig | null> => {
    if (!isFirebaseConfigured || !db) return null;
    const norm = code.trim().toUpperCase();
    if (!norm) return null;
    // Join codes are stored on the tournament doc. Query the collection group
    // by joinCode. tournaments is a top-level collection.
    try {
      const { collection } = await import('firebase/firestore');
      const snap = await getDocs(query(collection(db, 'tournaments'), where('joinCode', '==', norm)));
      if (snap.empty) return null;
      const d = snap.docs[0];
      return { id: d.id, ...d.data() } as TournamentConfig;
    } catch {
      return null;
    }
  }, []);

  const isHost = (() => {
    if (!activeId || !tournament) return false;
    try {
      return localStorage.getItem(hostKeyKey(activeId)) === tournament.hostKey;
    } catch {
      return false;
    }
  })();

  const courseHoles = tournament?.holes && tournament.holes.length === 18
    ? tournament.holes
    : dundeeCourseDefaults();
  const trackYardages = tournament ? !!tournament.trackYardages : true;
  const autoTeeRule = tournament ? !!tournament.autoTeeRule : true;

  return (
    <TournamentContext.Provider
      value={{
        activeId,
        tournament,
        loading,
        isHost,
        isSpectator,
        courseHoles,
        trackYardages,
        autoTeeRule,
        setActiveTournament,
        enterSpectator,
        leaveTournament,
        lookupJoinCode,
      }}
    >
      {children}
    </TournamentContext.Provider>
  );
}

export function useTournament(): TournamentContextValue {
  const ctx = useContext(TournamentContext);
  if (!ctx) throw new Error('useTournament must be used within TournamentProvider');
  return ctx;
}

export function useCourse(): { holes: CourseHole[]; trackYardages: boolean; autoTeeRule: boolean } {
  const { courseHoles, trackYardages, autoTeeRule } = useTournament();
  return { holes: courseHoles, trackYardages, autoTeeRule };
}

// Helper for fetching a tournament by id once (used by join-by-team-code flows).
export async function fetchTournament(id: string): Promise<TournamentConfig | null> {
  if (!isFirebaseConfigured || !db) return null;
  try {
    const snap = await getDoc(doc(db, 'tournaments', id));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as TournamentConfig) : null;
  } catch {
    return null;
  }
}

// Fetch the teams registered in a tournament (used by the join/rejoin flow
// before the tournament becomes active). Returns identity only.
export interface TeamLookup {
  id: string;
  teamName: string;
  players: string[];
  teamCode: string;
}
export async function fetchTeamsForTournament(tId: string): Promise<TeamLookup[]> {
  if (!isFirebaseConfigured || !db) return [];
  try {
    const snap = await getDocs(collection(db, 'tournaments', tId, 'teams'));
    return snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        teamName: typeof data.teamName === 'string' ? data.teamName : 'Team',
        players: Array.isArray(data.players)
          ? data.players
          : [data.player1, data.player2].filter((p: unknown): p is string => typeof p === 'string' && !!p),
        teamCode: typeof data.teamCode === 'string' ? data.teamCode : '',
      };
    });
  } catch {
    return [];
  }
}

// Write a new tournament doc. Stores the host recovery key locally so the
// creating device is auto-authenticated as host. Does not change the active
// tournament — the caller decides when to enter.
export async function createTournamentDoc(config: TournamentConfig): Promise<void> {
  if (!isFirebaseConfigured || !db) {
    throw new Error('A live connection is required to create a tournament.');
  }
  await setDoc(doc(db, 'tournaments', config.id), { ...config });
  try { localStorage.setItem(hostKeyKey(config.id), config.hostKey); } catch { /* ignore */ }
}
