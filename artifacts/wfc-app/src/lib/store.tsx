import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { TOTAL_PAR, HOLES } from './holes';
import { db, isFirebaseConfigured } from './firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

export interface TeamInfo { teamName: string; player1: string; player2: string; }

export interface WFCState {
  teamId: string;
  teamInfo: TeamInfo | null;
  scores: (number | null)[];
  currentTee: 'tips' | 'womens';
  netScore: number;
  holesPlayed: number;
  setTeamInfo: (info: TeamInfo) => void;
  setScore: (hole: number, score: number | null) => void;
  resetScores: () => void;
}

const StoreContext = createContext<WFCState | null>(null);

const STORE_KEY = 'wfc-state';
const TEAM_ID_KEY = 'wfc-team-id';

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
  const hydratedRef = useRef(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.teamInfo) setTeamInfo(parsed.teamInfo);
        if (parsed.scores && Array.isArray(parsed.scores)) setScoresState(parsed.scores);
      }
    } catch (e) {
      console.error('Failed to load store', e);
    }
    hydratedRef.current = true;
  }, []);

  const saveToLocal = (t: TeamInfo | null, s: (number | null)[]) => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ teamInfo: t, scores: s }));
    } catch (e) {
      console.error('Failed to save store', e);
    }
  };

  // Derive aggregates
  let totalScore = 0;
  let parPlayed = 0;
  let holesPlayed = 0;
  scores.forEach((s, i) => {
    if (s !== null) {
      totalScore += s;
      parPlayed += HOLES[i].par;
      holesPlayed += 1;
    }
  });
  const netScore = holesPlayed > 0 ? totalScore - parPlayed : 0;
  const currentTee: 'tips' | 'womens' = netScore <= -5 ? 'tips' : 'womens';

  // Live Firestore sync — push this device's team doc whenever it changes
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (!isFirebaseConfigured || !db) return;
    if (!teamInfo) return;
    const ref = doc(db, 'teams', teamId);
    setDoc(ref, {
      teamName: teamInfo.teamName,
      player1: teamInfo.player1,
      player2: teamInfo.player2,
      scores,
      netScore,
      holesPlayed,
      currentTee,
      lastUpdated: serverTimestamp(),
    }, { merge: true }).catch(err => console.error('Firestore sync failed', err));
  }, [teamId, teamInfo, scores, netScore, holesPlayed, currentTee]);

  const updateTeamInfo = (info: TeamInfo) => {
    setTeamInfo(info);
    saveToLocal(info, scores);
  };

  const setScore = (hole: number, score: number | null) => {
    const newScores = [...scores];
    newScores[hole - 1] = score;
    setScoresState(newScores);
    saveToLocal(teamInfo, newScores);
  };

  const resetScores = () => {
    const newScores = Array(18).fill(null);
    setScoresState(newScores);
    setTeamInfo(null);
    saveToLocal(null, newScores);
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
        setTeamInfo: updateTeamInfo,
        setScore,
        resetScores
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useWFC() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useWFC must be used within StoreProvider');
  }
  return context;
}
