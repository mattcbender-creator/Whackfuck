import { useEffect, useState } from 'react';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { Star, Zap, Flag, Sparkles } from 'lucide-react';
import { useLocation } from 'wouter';
import { getWheelItem, type WheelItemId } from '@/lib/wheel';

interface FeedEvent {
  id: string;
  type: string;
  subtype?: string;
  teamName?: string;
  hole?: number;
  netScore?: number;
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

export function LiveTicker() {
  const [location] = useLocation();
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!isFirebaseConfigured || !db) return;
    const q = query(collection(db, 'events'), orderBy('timestamp', 'desc'), limit(20));
    const unsub = onSnapshot(q, snap => {
      const list: FeedEvent[] = snap.docs
        .filter(d => {
          const t = d.data().type;
          return t === 'score' || t === 'finish' || t === 'wheel';
        })
        .map(d => {
          const data = d.data();
          return { id: d.id, tsMs: data.timestamp?.toMillis?.() ?? Date.now(), ...data } as FeedEvent;
        });
      setEvents(list);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (events.length <= 1) return;
    const t = setInterval(() => setIdx(i => (i + 1) % events.length), 3000);
    return () => clearInterval(t);
  }, [events.length]);

  // Hide on home (clean landing) and leaderboard (own header style)
  if (location === '/' || location === '/leaderboard') return null;
  if (events.length === 0) return null;

  const current = events[idx % events.length];
  if (!current) return null;

  return (
    <div className="border-b border-border/60 bg-background/95 px-4 py-1.5">
      <div className="max-w-md mx-auto flex items-center gap-2.5">
        <span className="text-[8px] font-black text-primary uppercase tracking-widest shrink-0 border border-primary/40 rounded px-1 py-0.5">
          LIVE
        </span>
        {current.type === 'score' && current.subtype === 'eagle' && (
          <Zap className="w-3 h-3 text-yellow-400 shrink-0" />
        )}
        {current.type === 'score' && current.subtype === 'birdie' && (
          <Star className="w-3 h-3 text-primary shrink-0" />
        )}
        {current.type === 'finish' && (
          <Flag className="w-3 h-3 text-white/50 shrink-0" />
        )}
        {current.type === 'wheel' && (
          <Sparkles
            className="w-3 h-3 shrink-0"
            style={{ color: getWheelItem(current.subtype as WheelItemId)?.color ?? '#39FF14' }}
          />
        )}
        <p className="flex-1 text-xs font-bold text-foreground/90 truncate">
          {formatTicker(current)}
        </p>
        <span className="text-[9px] text-muted-foreground/70 shrink-0">
          {timeAgo(current.tsMs)}
        </span>
      </div>
    </div>
  );
}
