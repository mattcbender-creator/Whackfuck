import { useState, useEffect, useRef } from 'react';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { useWFC } from '@/lib/store';
import { useCourse, useTournament } from '@/lib/tournamentContext';
import { teamsCol, eventsCol, getActiveTournamentId, formatPlayers, normalizeScores, type CourseHole } from '@/lib/tournament';
import { Crown, X, Flame, Target, Sparkles, Megaphone, Star, Zap, Flag, ChevronDown } from 'lucide-react';
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
  itemLabel?: string;
  targetTeam?: string;
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
  if (e.type === 'wheel' && e.teamName) {
    const item = e.itemLabel ?? getWheelItem(e.subtype as WheelItemId)?.label ?? 'Item';
    return e.targetTeam
      ? `${e.teamName} used ${item} on ${e.targetTeam}`
      : `${e.teamName} used ${item}`;
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
  players: string[];
  netScore: number;
  holesPlayed: number;
  currentTee: string;
  lastUpdated?: string;
  wheelSpin?: WheelSpinRecord | null;
  wheelSpins?: Record<string, WheelSpinRecord>;
  targetedBy?: TargetedByEntry[];
  wheelAdjustment?: number;
  scores?: (number | null)[];
}

// Color a score by its diff vs par (eagle/birdie/par/bogey/double+)
function scoreColor(score: number | null | undefined, par: number): string {
  if (score === null || score === undefined) return 'text-muted-foreground/40';
  const d = score - par;
  if (d <= -2) return 'text-yellow-400';
  if (d === -1) return 'text-primary';
  if (d === 0) return 'text-foreground/80';
  if (d === 1) return 'text-orange-400';
  return 'text-red-500';
}

// Compact horizontal scorecard shown when a leaderboard row is expanded.
// All 18 holes in a single horizontally-scrollable row, with OUT / IN / TOT
// totals tucked into the same table so the user can scrub across the whole
// round without jumping between blocks.
function MiniScorecard({ scores, holes: HOLES }: { scores: (number | null)[]; holes: CourseHole[] }) {
  const playedSum = (start: number, end: number) => {
    let s = 0; let any = false;
    for (let i = start; i < end; i++) {
      const v = scores[i];
      if (v !== null && v !== undefined) { s += v; any = true; }
    }
    return any ? s : null;
  };
  const parSum = (start: number, end: number) =>
    HOLES.slice(start, end).reduce((a, h) => a + h.par, 0);

  const outScore = playedSum(0, 9);
  const inScore = playedSum(9, 18);
  const totScore = (outScore ?? 0) + (inScore ?? 0);
  const anyScored = outScore !== null || inScore !== null;
  const outPar = parSum(0, 9);
  const inPar = parSum(9, 18);
  const totPar = outPar + inPar;

  const totalCell = 'px-2 py-1.5 text-center border-l-2 border-primary/30 font-condensed font-black w-12';
  const labelCell = 'sticky left-0 z-10 px-2 py-1.5 text-left text-[9px] font-bold uppercase tracking-widest w-14';

  return (
    <div className="overflow-x-auto rounded-lg border border-white/10" style={{ background: '#0d0d0d' }}>
      <table className="w-max border-collapse text-[11px]">
        <tbody>
          {/* Hole numbers */}
          <tr className="border-b border-white/10">
            <td className={`${labelCell} text-muted-foreground/70 bg-[#0d0d0d]`}>Hole</td>
            {HOLES.slice(0, 9).map(h => (
              <td key={h.hole} className="px-2 py-1.5 text-center font-condensed font-black w-8 text-foreground/70">{h.hole}</td>
            ))}
            <td className={`${totalCell} text-[9px] tracking-widest text-muted-foreground/70`}>Out</td>
            {HOLES.slice(9, 18).map(h => (
              <td key={h.hole} className="px-2 py-1.5 text-center font-condensed font-black w-8 text-foreground/70">{h.hole}</td>
            ))}
            <td className={`${totalCell} text-[9px] tracking-widest text-muted-foreground/70`}>In</td>
            <td className={`${totalCell} text-[9px] tracking-widest text-muted-foreground/70`}>Tot</td>
          </tr>
          {/* Par row */}
          <tr className="border-b border-white/8">
            <td className={`${labelCell} text-muted-foreground/60 bg-[#0d0d0d]`}>Par</td>
            {HOLES.slice(0, 9).map(h => (
              <td key={h.hole} className="px-2 py-1.5 text-center text-muted-foreground/60">{h.par}</td>
            ))}
            <td className={`${totalCell} text-muted-foreground/60`}>{outPar}</td>
            {HOLES.slice(9, 18).map(h => (
              <td key={h.hole} className="px-2 py-1.5 text-center text-muted-foreground/60">{h.par}</td>
            ))}
            <td className={`${totalCell} text-muted-foreground/60`}>{inPar}</td>
            <td className={`${totalCell} text-muted-foreground/60`}>{totPar}</td>
          </tr>
          {/* Score row */}
          <tr>
            <td className={`${labelCell} text-foreground/80 bg-[#0d0d0d]`}>Score</td>
            {HOLES.slice(0, 9).map((h, i) => {
              const s = scores[i] ?? null;
              return (
                <td key={h.hole} className={`px-2 py-2 text-center font-condensed text-base font-black ${scoreColor(s, h.par)}`}>
                  {s ?? '—'}
                </td>
              );
            })}
            <td className={`${totalCell} text-base text-foreground/80 py-2`}>
              {outScore ?? ''}
            </td>
            {HOLES.slice(9, 18).map((h, i) => {
              const s = scores[i + 9] ?? null;
              return (
                <td key={h.hole} className={`px-2 py-2 text-center font-condensed text-base font-black ${scoreColor(s, h.par)}`}>
                  {s ?? '—'}
                </td>
              );
            })}
            <td className={`${totalCell} text-base text-foreground/80 py-2`}>
              {inScore ?? ''}
            </td>
            <td className={`${totalCell} text-base py-2 ${anyScored ? 'text-primary' : 'text-foreground/80'}`}>
              {anyScored ? totScore : ''}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
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
  const { holes: courseHoles } = useCourse();
  const { tournament } = useTournament();
  const { teamInfo, netScore, holesPlayed, currentTee } = useWFC();
  const [teams, setTeams] = useState<TeamData[]>([]);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [showSetup, setShowSetup] = useState(false);
  const [broadcastDismissed, setBroadcastDismissed] = useState<string | null>(null);
  const [feedEvents, setFeedEvents] = useState<FeedEvent[]>([]);
  const [tickerIdx, setTickerIdx] = useState(0);
  const prevPositionsRef = useRef<Record<string, number>>({});
  const [posChanges, setPosChanges] = useState<Record<string, number>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── Single events listener: powers both broadcast banner and live ticker ──
  useEffect(() => {
    if (!isFirebaseConfigured || !db || !getActiveTournamentId()) return;
    const q = query(eventsCol(db), orderBy('timestamp', 'desc'), limit(20));
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
  const tickerEvents = feedEvents.filter(e =>
    e.type === 'score' || e.type === 'finish' || e.type === 'wheel'
  );

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
          players: teamInfo.players,
          netScore,
          holesPlayed,
          currentTee
        }]);
      }
      return;
    }

    if (!getActiveTournamentId()) return;
    const q = query(teamsCol(db), orderBy('netScore', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => {
        const raw = d.data();
        return { id: d.id, ...raw, scores: normalizeScores(raw.scores) } as TeamData;
      });
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
            {currentTickerEvent.type === 'wheel' && (
              <Sparkles
                className="w-3 h-3 shrink-0"
                style={{ color: getWheelItem(currentTickerEvent.subtype as WheelItemId)?.color ?? '#39FF14' }}
              />
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
            <div className="col-span-5">Team</div>
            <div className="col-span-2 text-center">Wheel</div>
            <div className="col-span-1 text-center">Thru</div>
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
              const isExpanded = expandedId === team.id;
              const hasScores = Array.isArray(team.scores) && team.scores.some(s => s !== null && s !== undefined);
              // One badge per wheel spin, ordered by hole. Fall back to the
              // legacy single-spin field for older Firestore docs.
              const spinEntries: [string, WheelSpinRecord][] = team.wheelSpins
                ? Object.entries(team.wheelSpins).sort((a, b) => Number(a[0]) - Number(b[0]))
                : team.wheelSpin
                ? [['9', team.wheelSpin]]
                : [];
              return (
                <div key={team.id}>
                  <button
                    type="button"
                    onClick={() => setExpandedId(prev => prev === team.id ? null : team.id)}
                    data-testid={`leaderboard-row-${team.id}`}
                    className={`w-full grid grid-cols-12 gap-2 p-3 items-center text-left transition-colors ${isExpanded ? 'bg-secondary/30' : 'hover:bg-secondary/20'}`}
                  >
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
                    <div className="col-span-5 flex flex-col gap-1 min-w-0">
                      <span className="font-bold text-sm truncate flex items-center gap-1.5">
                        {team.teamName}
                        <ChevronDown className={`w-3 h-3 text-muted-foreground/60 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </span>
                      <span className="text-[10px] text-muted-foreground truncate">{formatPlayers(team.players)}</span>
                      {totalHits > 0 && (
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {aggregated.map(h => (
                            <HitBadge key={h.item} item={h.item} count={h.count} fromList={h.fromList} />
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="col-span-2 flex flex-col items-center justify-center gap-1">
                      {spinEntries.length > 0 ? (
                        spinEntries.map(([holeStr, rec]) => (
                          <WheelBadge key={holeStr} item={rec.item} label={`Hole ${holeStr}: spun ${rec.item}`} />
                        ))
                      ) : (
                        <span className="text-muted-foreground/30 text-xs">—</span>
                      )}
                    </div>
                    <div className="col-span-1 text-center font-condensed font-bold text-muted-foreground">
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
                  </button>

                  {isExpanded && (
                    <div className="px-3 pb-4 pt-1 bg-secondary/10 border-t border-border/40">
                      {hasScores ? (
                        <MiniScorecard scores={team.scores as (number | null)[]} holes={courseHoles} />
                      ) : (
                        <p className="text-xs text-muted-foreground text-center py-4">
                          No scores entered yet.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-8">
          <h3 className="font-condensed text-xl font-bold uppercase tracking-widest text-muted-foreground mb-4">Groups on Course</h3>
          <div className="grid grid-cols-2 gap-3">
            {teams.map(team => {
              // For a shotgun start each team begins on its assigned hole and
              // wraps around. Normal start always starts on hole 1 (ignoring any
              // stale assignment data), so this collapses to holesPlayed + 1.
              const startHole = tournament?.startType === 'shotgun'
                ? (tournament.shotgunAssignments?.[team.id] ?? 1)
                : 1;
              const currentHole = ((startHole - 1 + team.holesPlayed) % 18) + 1;
              return (
                <div key={`tracker-${team.id}`} className="bg-card border border-border p-3 rounded-lg flex flex-col gap-2">
                  <span className="font-bold text-sm truncate">{team.teamName}</span>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Hole</span>
                    <span className="font-condensed text-xl font-black text-primary">
                      {team.holesPlayed < 18 ? currentHole : 'Clubhouse'}
                    </span>
                  </div>
                </div>
              );
            })}
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
