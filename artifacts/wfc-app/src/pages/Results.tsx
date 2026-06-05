import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { onSnapshot, query, orderBy } from 'firebase/firestore';
import { useWFC } from '@/lib/store';
import { useCourse } from '@/lib/tournamentContext';
import { teamsCol, getActiveTournamentId, formatPlayers, normalizeScores, type CourseHole } from '@/lib/tournament';
import { Trophy, Crown, Medal, Flame, Target, Star, Flag, Share2, Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fireEagleConfetti } from '@/lib/confetti';
import { useToast } from '@/hooks/use-toast';

interface TeamData {
  id: string;
  teamName: string;
  players: string[];
  netScore: number;
  holesPlayed: number;
  scores?: (number | null)[];
}

function netLabel(net: number): string {
  return net === 0 ? 'E' : net > 0 ? `+${net}` : String(net);
}

interface Superlative {
  icon: typeof Flame;
  label: string;
  teamName: string;
  detail: string;
}

function computeSuperlatives(teams: TeamData[], holes: CourseHole[]): Superlative[] {
  let mostBirdies = { team: '', count: 0 };
  let mostEagles = { team: '', count: 0 };
  let bestHole = { team: '', toPar: 1, hole: 0 };

  for (const t of teams) {
    const scores = t.scores ?? [];
    let birdies = 0, eagles = 0;
    scores.forEach((s, i) => {
      if (s == null) return;
      const par = holes[i]?.par ?? 4;
      const diff = s - par;
      if (diff <= -2) eagles += 1;
      else if (diff === -1) birdies += 1;
      if (diff < bestHole.toPar) bestHole = { team: t.teamName, toPar: diff, hole: holes[i]?.hole ?? i + 1 };
    });
    if (birdies > mostBirdies.count) mostBirdies = { team: t.teamName, count: birdies };
    if (eagles > mostEagles.count) mostEagles = { team: t.teamName, count: eagles };
  }

  const out: Superlative[] = [];
  if (mostBirdies.count > 0) {
    out.push({ icon: Star, label: 'Birdie Machine', teamName: mostBirdies.team, detail: `${mostBirdies.count} birdie${mostBirdies.count === 1 ? '' : 's'}` });
  }
  if (mostEagles.count > 0) {
    out.push({ icon: Flame, label: 'Eagle Eye', teamName: mostEagles.team, detail: `${mostEagles.count} eagle${mostEagles.count === 1 ? '' : 's'}` });
  }
  if (bestHole.team && bestHole.toPar < 0) {
    const tp = bestHole.toPar === -1 ? 'birdie' : bestHole.toPar === -2 ? 'eagle' : `${Math.abs(bestHole.toPar)} under`;
    out.push({ icon: Target, label: 'Shot of the Day', teamName: bestHole.team, detail: `${tp} on hole ${bestHole.hole}` });
  }
  return out;
}

function buildShareText(ranked: TeamData[], superlatives: Superlative[]): string {
  const lines: string[] = [];
  lines.push('🏆 WHACK FUCK CUP — FINAL RESULTS');
  lines.push('');

  const champ = ranked[0];
  if (champ) {
    lines.push(`Champions: ${champ.teamName} (${netLabel(champ.netScore)})`);
    lines.push('');
  }

  const medals = ['🥇', '🥈', '🥉'];
  lines.push('Podium:');
  ranked.slice(0, 3).forEach((t, i) => {
    lines.push(`${medals[i] ?? `${i + 1}.`} ${t.teamName} — ${netLabel(t.netScore)}`);
  });

  if (superlatives.length > 0) {
    lines.push('');
    lines.push('Superlatives:');
    superlatives.forEach(s => {
      lines.push(`• ${s.label}: ${s.teamName} (${s.detail})`);
    });
  }

  return lines.join('\n');
}

const PODIUM_ORDER = [1, 0, 2];

function scoreStyle(diff: number): string {
  if (diff <= -2) return 'bg-primary text-background font-black';
  if (diff === -1) return 'bg-primary/25 text-primary font-bold';
  if (diff === 0) return 'text-foreground';
  if (diff === 1) return 'text-orange-400';
  return 'text-red-400';
}

function TeamScorecard({ team, holes }: { team: TeamData; holes: CourseHole[] }) {
  const scores = team.scores ?? [];
  const renderNine = (label: string, start: number) => {
    const slice = holes.slice(start, start + 9);
    let grossSum = 0;
    let parSum = 0;
    slice.forEach((h, idx) => {
      const s = scores[start + idx];
      parSum += h.par;
      if (s != null) grossSum += s;
    });
    return (
      <div>
        <div className="grid grid-cols-[2.2rem_repeat(9,1fr)_2.4rem] text-center text-[10px]">
          <div className="py-1 font-black uppercase tracking-wider text-muted-foreground text-left pl-1">{label}</div>
          {slice.map(h => (
            <div key={`h-${h.hole}`} className="py-1 font-black text-muted-foreground">{h.hole}</div>
          ))}
          <div className="py-1 font-black uppercase tracking-wider text-muted-foreground">Tot</div>
        </div>
        <div className="grid grid-cols-[2.2rem_repeat(9,1fr)_2.4rem] text-center text-[10px] border-b border-border/30">
          <div className="py-1 uppercase tracking-wider text-muted-foreground/60 text-left pl-1">Par</div>
          {slice.map(h => (
            <div key={`p-${h.hole}`} className="py-1 text-muted-foreground/60">{h.par}</div>
          ))}
          <div className="py-1 text-muted-foreground/60">{parSum}</div>
        </div>
        <div className="grid grid-cols-[2.2rem_repeat(9,1fr)_2.4rem] text-center text-xs">
          <div className="py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground text-left pl-1 self-center">Gross</div>
          {slice.map((h, idx) => {
            const s = scores[start + idx];
            return (
              <div key={`g-${h.hole}`} className="py-1 px-0.5">
                {s == null ? (
                  <span className="text-muted-foreground/30">–</span>
                ) : (
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md ${scoreStyle(s - h.par)}`}>{s}</span>
                )}
              </div>
            );
          })}
          <div className="py-1 font-condensed text-base font-black text-primary self-center">{grossSum || '–'}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-background/60 border-t border-border/30 px-3 py-3 space-y-3">
      {renderNine('Out', 0)}
      {renderNine('In', 9)}
      <div className="flex items-center justify-center gap-3 text-[10px] text-muted-foreground pt-1">
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-primary" /> Eagle+</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-primary/25" /> Birdie</span>
        <span className="flex items-center gap-1"><span className="text-orange-400">▲</span> Bogey</span>
        <span className="flex items-center gap-1"><span className="text-red-400">▲</span> Double+</span>
      </div>
    </div>
  );
}

export default function Results() {
  const [, navigate] = useLocation();
  const { holes } = useCourse();
  const { teamInfo, netScore, holesPlayed, scores: myScores } = useWFC();
  const { toast } = useToast();
  const [teams, setTeams] = useState<TeamData[]>([]);
  const [loading, setLoading] = useState(true);
  const [shared, setShared] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!db) {
      if (teamInfo) {
        setTeams([{
          id: 'local',
          teamName: teamInfo.teamName,
          players: teamInfo.players,
          netScore,
          holesPlayed,
          scores: myScores,
        }]);
      }
      setLoading(false);
      return undefined;
    }

    if (!getActiveTournamentId()) { setLoading(false); return undefined; }
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
  }, [teamInfo, netScore, holesPlayed, myScores]);

  const ranked = teams.filter(t => t.holesPlayed > 0);
  const podium = ranked.slice(0, 3);
  const superlatives = computeSuperlatives(ranked, holes);
  const champion = podium[0];

  useEffect(() => {
    if (!loading && champion) {
      const t = setTimeout(() => fireEagleConfetti(), 350);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [loading, champion]);

  const handleShare = async () => {
    const text = buildShareText(ranked, superlatives);
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'Whack Fuck Cup — Final Results', text });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
      toast({ title: 'Results copied', description: 'Final results copied to your clipboard.' });
    } catch {
      toast({ title: 'Could not share', description: 'Sharing is not supported on this device.', variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-[100dvh] w-full bg-background pb-24 relative overflow-hidden">
      {/* Glow backdrop */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-gradient-to-b from-primary/15 to-transparent" />

      <div className="relative max-w-md mx-auto px-4 pt-12">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/30 mb-4">
            <Trophy className="w-8 h-8 text-primary" />
          </div>
          <p className="text-[11px] font-black uppercase tracking-[0.4em] text-primary mb-1">Final Results</p>
          <h1 className="font-condensed text-5xl font-black uppercase tracking-wider leading-none">
            Whack Fuck Cup
          </h1>
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground py-20">Loading results…</p>
        ) : ranked.length === 0 ? (
          <div className="text-center py-20">
            <Flag className="w-10 h-10 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-muted-foreground">No scores were recorded.</p>
          </div>
        ) : (
          <>
            {/* Champion banner */}
            {champion && (
              <div className="bg-gradient-to-b from-primary/20 to-card border border-primary/40 rounded-2xl p-6 text-center mb-8 shadow-[0_0_40px_-12px_rgba(57,255,20,0.5)]">
                <Crown className="w-7 h-7 text-primary mx-auto mb-2" />
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-1">Champions</p>
                <h2 className="font-condensed text-4xl font-black uppercase tracking-wide leading-none mb-1">{champion.teamName}</h2>
                <p className="text-xs text-muted-foreground mb-3">{formatPlayers(champion.players)}</p>
                <span className="inline-block font-condensed text-5xl font-black text-primary leading-none">{netLabel(champion.netScore)}</span>
              </div>
            )}

            {/* Podium */}
            {podium.length > 1 && (
              <div className="flex items-end justify-center gap-3 mb-10">
                {PODIUM_ORDER.map(idx => {
                  const t = podium[idx];
                  if (!t) return <div key={`empty-${idx}`} className="flex-1" />;
                  const place = idx + 1;
                  const heights = ['h-28', 'h-36', 'h-20'];
                  const colors = ['bg-zinc-400/20 border-zinc-400/40', 'bg-primary/20 border-primary/50', 'bg-amber-700/20 border-amber-700/40'];
                  const numColors = ['text-zinc-300', 'text-primary', 'text-amber-600'];
                  return (
                    <div key={t.id} className="flex-1 flex flex-col items-center">
                      <div className="text-center mb-2 min-w-0 w-full">
                        {place === 1 && <Crown className="w-5 h-5 text-primary mx-auto mb-1" />}
                        {place === 2 && <Medal className="w-4 h-4 text-zinc-300 mx-auto mb-1" />}
                        {place === 3 && <Medal className="w-4 h-4 text-amber-600 mx-auto mb-1" />}
                        <p className="font-bold text-xs truncate leading-tight px-0.5">{t.teamName}</p>
                        <p className={`font-condensed text-lg font-black leading-none ${numColors[place - 1]}`}>{netLabel(t.netScore)}</p>
                      </div>
                      <div className={`w-full ${heights[place - 1]} rounded-t-xl border-t border-x ${colors[place - 1]} flex items-start justify-center pt-2`}>
                        <span className={`font-condensed text-3xl font-black ${numColors[place - 1]}`}>{place}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Superlatives */}
            {superlatives.length > 0 && (
              <div className="mb-8">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground mb-3">Superlatives</p>
                <div className="grid gap-2">
                  {superlatives.map(s => (
                    <div key={s.label} className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                        <s.icon className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-widest text-primary leading-none mb-0.5">{s.label}</p>
                        <p className="font-bold text-sm truncate leading-tight">{s.teamName}</p>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">{s.detail}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Full standings */}
            <div className="mb-8">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground mb-3">Full Standings</p>
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                {ranked.map((t, i) => {
                  const isOpen = expandedId === t.id;
                  return (
                    <div key={t.id} className="border-t border-border/30 first:border-t-0">
                      <button
                        type="button"
                        onClick={() => setExpandedId(isOpen ? null : t.id)}
                        aria-expanded={isOpen}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-primary/5 transition-colors"
                        data-testid={`button-expand-team-${t.id}`}
                      >
                        <span className="font-condensed text-lg font-black w-7 text-center shrink-0 text-muted-foreground">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate leading-tight">{t.teamName}</p>
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">{formatPlayers(t.players)} · {t.holesPlayed}/18</p>
                        </div>
                        <span className={`font-condensed text-lg font-black leading-none shrink-0 ${t.netScore < 0 ? 'text-primary' : t.netScore > 0 ? 'text-orange-400' : 'text-muted-foreground'}`}>
                          {netLabel(t.netScore)}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${isOpen ? 'rotate-180 text-primary' : ''}`} />
                      </button>
                      {isOpen && <TeamScorecard team={t} holes={holes} />}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className={`relative inline-flex rounded-full h-2 w-2 ${isFirebaseConfigured ? 'bg-primary' : 'bg-muted-foreground'}`} />
          </span>
          {isFirebaseConfigured ? 'Live results' : 'Local results'}
        </div>

        {ranked.length > 0 && (
          <Button
            className="w-full h-12 mt-6 font-condensed font-bold uppercase tracking-widest gap-2"
            onClick={handleShare}
            data-testid="button-share-results"
          >
            {shared ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
            {shared ? 'Copied' : 'Share Results'}
          </Button>
        )}

        <Button
          variant="outline"
          className="w-full h-11 mt-3 font-condensed font-bold uppercase tracking-widest"
          onClick={() => navigate('/leaderboard')}
          data-testid="button-view-leaderboard"
        >
          View Leaderboard
        </Button>
      </div>
    </div>
  );
}
