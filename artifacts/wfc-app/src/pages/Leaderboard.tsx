import { useState, useEffect, useRef } from 'react';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { useWFC } from '@/lib/store';
import { Crown, X, Flame, Target, Sparkles, Megaphone, Star, Zap, Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getWheelItem, type WheelItemId } from '@/lib/wheel';
import type { WheelSpinRecord, TargetedByEntry } from '@/lib/store';

interface FeedEvent {
  id: string;
  type: string;
  subtype?: string;
  teamName?: string;
  hole?: number;
  score?: number;
  par?: number;
  netScore?: number;
  position?: number | null;
  message?: string;
  tsMs: number;
}

function formatTicker(e: FeedEvent): string {
  if (e.type === 'score' && e.teamName && e.hole) {
    const sub = (e.subtype ?? '').toUpperCase();
    return `${e.teamName} — ${sub} · Hole ${e.hole}`;
  }
  if (e.type === 'finish' && e.teamName) {
    const net = e.netScore === 0 ? 'E' : (e.netScore ?? 0) > 0 ? `+${e.netScore}` : `${e.netScore}`;
    return `${e.teamName} finished at ${net}`;
  }
  return '';
}

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60000) return 'just now';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}


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

function HitBadge({ item, count, fromList }: { item: WheelItemId; count: number; fromList: string[] }) {
  const w = getWheelItem(item);
  if (!w) return null;
  const title = count === 1
    ? `Hit by ${w.label} from ${fromList[0]}`
    : `Hit by ${w.label} ×${count} — from ${fromList.join(', ')}`;
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border border-white/10 bg-white/5 text-white/80"
      title={title}
    >
      <Target className="w-2.5 h-2.5" style={{ color: w.color }} />
      Hit by {w.label}{count > 1 ? ` ×${count}` : ''}
    </span>
  );
}

// Aggregate targetedBy entries by item so identical hits collapse into one
// badge with a count instead of N duplicate badges. Returns the items in
// descending count order so the most-hit shows first.
function aggregateHits(hits: TargetedByEntry[]): { item: WheelItemId; count: number; fromList: string[] }[] {
  const buckets = new Map<WheelItemId, { count: number; fromList: string[] }>();
  for (const h of hits) {
    const cur = buckets.get(h.item);
    if (cur) {
      cur.count += 1;
      cur.fromList.push(h.fromTeam);
    } else {
      buckets.set(h.item, { count: 1, fromList: [h.fromTeam] });
    }
  }
  return [...buckets.entries()]
    .map(([item, v]) => ({ item, count: v.count, fromList: v.fromList }))
    .sort((a, b) => b.count - a.count);
}

export default function Leaderboard() {
  const { teamInfo, netScore, holesPlayed, currentTee } = useWFC();
  const [teams, setTeams] = useState<TeamData[]>([]);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [showSetup, setShowSetup] = useState(false);
  const [broadcastDismissed, setBroadcastDismissed] = useState<string | null>(null);
  const [feedEvents, setFeedEvents] = useState<FeedEvent[]>([]);
  const [tickerIdx, setTickerIdx] = useState(0);
  const prevPositionsRef = useRef<Record<string, number>>({});
  const [posChanges, setPosChanges] = useState<Record<string, number>>({});

  // ── Single events listener: powers both broadcast banner and live ticker ──
  useEffect(() => {
    if (!isFirebaseConfigured || !db) return;
    const q = query(collection(db, 'events'), orderBy('timestamp', 'desc'), limit(20));
    const unsub = onSnapshot(q, snap => {
      const events: FeedEvent[] = snap.docs
        .filter(d => d.data().type)
        .map(d => {
          const data = d.data();
          return { id: d.id, tsMs: data.timestamp?.toMillis?.() ?? Date.now(), ...data } as FeedEvent;
        });
      setFeedEvents(events);
    });
    return () => unsub();
  }, []);

  // Derive broadcast and ticker events from the unified feed
  const latestBroadcast = feedEvents.find(e => e.type === 'broadcast');
  const tickerEvents = feedEvents.filter(e => e.type === 'score' || e.type === 'finish');

  // Auto-cycle ticker every 3 s
  useEffect(() => {
    if (tickerEvents.length <= 1) return;
    const t = setInterval(() => setTickerIdx(i => (i + 1) % tickerEvents.length), 3000);
    return () => clearInterval(t);
  }, [tickerEvents.length]);

  const currentTickerEvent = tickerEvents.length > 0 ? tickerEvents[tickerIdx % tickerEvents.length] : null;

  const broadcastKey = latestBroadcast ? `${latestBroadcast.message}|${latestBroadcast.tsMs}` : null;
  const showBroadcast = latestBroadcast?.message && broadcastDismissed !== broadcastKey;

  // ── Track position changes ──
  useEffect(() => {
    if (teams.length === 0) return;
    const newPositions: Record<string, number> = {};
    teams.forEach((team, idx) => { newPositions[team.id] = idx + 1; });
    if (Object.keys(prevPositionsRef.current).length > 0) {
      const newChanges: Record<string, number> = {};
      teams.forEach((team, idx) => {
        const prevPos = prevPositionsRef.current[team.id];
        if (prevPos !== undefined && prevPos !== idx + 1) {
          newChanges[team.id] = prevPos - (idx + 1); // positive = moved up
        }
      });
      // REPLACE (not merge): only show arrows for the most recent shift.
      // Merging caused stale ▼ arrows to pile up from older shifts while
      // newer ▲ moves overwrote each other — net effect was "down only".
      setPosChanges(newChanges);
    }
    prevPositionsRef.current = newPositions;
  }, [teams]);

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

      {/* ── Broadcast Banner ── */}
      {showBroadcast && (
        <div className="border-b border-primary/40 bg-primary/10 px-4 py-3">
          <div className="max-w-md mx-auto flex items-start gap-3">
            <Megaphone className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <p className="flex-1 text-sm font-bold text-foreground leading-snug">{latestBroadcast?.message}</p>
            <button
              onClick={() => setBroadcastDismissed(broadcastKey!)}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Live Ticker ── */}
      {currentTickerEvent && (
        <div className="border-b border-border/60 bg-card/60 px-4 py-2">
          <div className="max-w-md mx-auto flex items-center gap-2.5">
            <span className="text-[8px] font-black text-primary uppercase tracking-widest shrink-0 border border-primary/40 rounded px-1 py-0.5">
              LIVE
            </span>
            {currentTickerEvent.type === 'score' && currentTickerEvent.subtype === 'eagle' && (
              <Zap className="w-3 h-3 text-yellow-400 shrink-0" />
            )}
            {currentTickerEvent.type === 'score' && currentTickerEvent.subtype === 'birdie' && (
              <Star className="w-3 h-3 text-primary shrink-0" />
            )}
            {currentTickerEvent.type === 'finish' && (
              <Flag className="w-3 h-3 text-white/50 shrink-0" />
            )}
            <p className="flex-1 text-xs font-bold text-foreground/90 truncate">
              {formatTicker(currentTickerEvent)}
            </p>
            <span className="text-[9px] text-muted-foreground/70 shrink-0">
              {timeAgo(currentTickerEvent.tsMs)}
            </span>
          </div>
        </div>
      )}

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
              const allHits = team.targetedBy ?? [];
              const aggregated = aggregateHits(allHits);
              const totalHits = allHits.length;
              return (
                <div key={team.id} className="grid grid-cols-12 gap-2 p-3 items-center hover:bg-secondary/20 transition-colors">
                  <div className="col-span-1 flex flex-col justify-center items-center gap-0.5">
                    {idx === 0 ? (
                      <Crown className="w-4 h-4 text-yellow-400" />
                    ) : (
                      <span className="font-condensed font-bold text-muted-foreground">{idx + 1}</span>
                    )}
                    {posChanges[team.id] !== undefined && posChanges[team.id] !== 0 && (
                      <span className={`text-[8px] font-black leading-none ${posChanges[team.id] > 0 ? 'text-primary' : 'text-red-400'}`}>
                        {posChanges[team.id] > 0 ? `▲${posChanges[team.id]}` : `▼${Math.abs(posChanges[team.id])}`}
                      </span>
                    )}
                  </div>
                  <div className="col-span-6 flex flex-col gap-1 min-w-0">
                    <span className="font-bold text-sm truncate">{team.teamName}</span>
                    <span className="text-[10px] text-muted-foreground truncate">{team.player1} & {team.player2}</span>
                    {(team.wheelSpin || totalHits > 0) && (
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {team.wheelSpin && (
                          <WheelBadge item={team.wheelSpin.item} label={`Spun ${team.wheelSpin.item}`} />
                        )}
                        {aggregated.map(h => (
                          <HitBadge key={h.item} item={h.item} count={h.count} fromList={h.fromList} />
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
                        {totalHits > 1 && <span className="text-muted-foreground/70 ml-1">({totalHits} hits)</span>}
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
