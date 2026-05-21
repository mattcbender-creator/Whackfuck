import { useState, useEffect } from 'react';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { useWFC } from '@/lib/store';
import { Crown, AlertCircle } from 'lucide-react';

interface TeamData {
  id: string;
  teamName: string;
  player1: string;
  player2: string;
  netScore: number;
  holesPlayed: number;
  currentTee: string;
  lastUpdated?: string;
}

export default function Leaderboard() {
  const { teamInfo, netScore, holesPlayed, currentTee } = useWFC();
  const [teams, setTeams] = useState<TeamData[]>([]);
  const [loading, setLoading] = useState(isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured || !db) {
      // Demo data
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
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeamData));
      setTeams(data);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => unsub();
  }, [teamInfo, netScore, holesPlayed, currentTee]);

  return (
    <div className="min-h-[100dvh] w-full bg-background pb-24">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border p-4">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <h2 className="font-condensed text-3xl font-black uppercase tracking-wider text-foreground">
            WFC <span className="text-primary">LIVE</span>
          </h2>
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
            </span>
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Live</span>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4">
        {!isFirebaseConfigured && (
          <div className="mb-6 p-3 bg-yellow-500/10 border border-yellow-500/50 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-200/80 leading-relaxed">
              Firebase is not configured. Showing local device data only. 
              Configure environment variables to enable real-time leaderboard.
            </p>
          </div>
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
            
            {teams.map((team, idx) => (
              <div key={team.id} className="grid grid-cols-12 gap-2 p-3 items-center hover:bg-secondary/20 transition-colors">
                <div className="col-span-1 flex justify-center">
                  {idx === 0 ? (
                    <Crown className="w-4 h-4 text-yellow-400" />
                  ) : (
                    <span className="font-condensed font-bold text-muted-foreground">{idx + 1}</span>
                  )}
                </div>
                <div className="col-span-6 flex flex-col">
                  <span className="font-bold text-sm truncate">{team.teamName}</span>
                  <span className="text-[10px] text-muted-foreground truncate">{team.player1} & {team.player2}</span>
                </div>
                <div className="col-span-2 text-center font-condensed font-bold text-muted-foreground">
                  {team.holesPlayed === 18 ? 'F' : team.holesPlayed || '-'}
                </div>
                <div className="col-span-3 text-right font-condensed text-xl font-black">
                  <span className={team.netScore < 0 ? 'text-primary' : team.netScore > 0 ? 'text-orange-500' : 'text-foreground'}>
                    {team.netScore === 0 ? 'E' : team.netScore > 0 ? `+${team.netScore}` : team.netScore}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Groups on Course Tracker */}
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
    </div>
  );
}