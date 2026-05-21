import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { TOTAL_PAR, HOLES } from './holes';

export interface TeamInfo { teamName: string; player1: string; player2: string; }

export interface WFCState {
  teamInfo: TeamInfo | null;
  scores: (number | null)[];  // 18 elements
  currentTee: 'tips' | 'womens';
  netScore: number;
  holesPlayed: number;
  setTeamInfo: (info: TeamInfo) => void;
  setScore: (hole: number, score: number | null) => void;
  resetScores: () => void;
}

const StoreContext = createContext<WFCState | null>(null);

const STORE_KEY = 'wfc-state';

export function StoreProvider({ children }: { children: ReactNode }) {
  const [teamInfo, setTeamInfo] = useState<TeamInfo | null>(null);
  const [scores, setScoresState] = useState<(number | null)[]>(Array(18).fill(null));

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
  }, []);

  const saveToLocal = (t: TeamInfo | null, s: (number | null)[]) => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ teamInfo: t, scores: s }));
    } catch (e) {
      console.error('Failed to save store', e);
    }
  };

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
  const currentTee = netScore <= -5 ? 'tips' : 'womens';

  return (
    <StoreContext.Provider
      value={{
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