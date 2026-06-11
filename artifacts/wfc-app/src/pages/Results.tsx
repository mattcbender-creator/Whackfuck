import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { onSnapshot, query, orderBy } from 'firebase/firestore';
import { useWFC } from '@/lib/store';
import { useCourse, useTournament } from '@/lib/tournamentContext';
import { teamsCol, getActiveTournamentId, teamSubtitle, normalizeScores, type CourseHole } from '@/lib/tournament';
import { Trophy, Crown, Medal, Flame, Target, Star, Flag, Share2, Check, ChevronDown, Repeat } from 'lucide-react';
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
  lines.push('WHACK FUCK CUP — FINAL RESULTS');
  lines.push('Dundee Country Club');
  lines.push('');

  const champ = ranked[0];
  if (champ) {
    lines.push(`CHAMPIONS: ${champ.teamName} (${netLabel(champ.netScore)})`);
    lines.push('');
  }

  const medals = ['1st', '2nd', '3rd'];
  lines.push('Podium:');
  ranked.slice(0, 3).forEach((t, i) => {
    lines.push(`${medals[i] ?? `${i + 1}.`} ${t.teamName} — ${netLabel(t.netScore)}`);
  });

  if (ranked.length > 3) {
    lines.push('');
    ranked.slice(3).forEach((t, i) => {
      lines.push(`${i + 4}. ${t.teamName} — ${netLabel(t.netScore)}`);
    });
  }

  if (superlatives.length > 0) {
    lines.push('');
    lines.push('Awards:');
    superlatives.forEach(s => {
      lines.push(`${s.label}: ${s.teamName} (${s.detail})`);
    });
  }

  lines.push('');
  lines.push('golf-chaos.replit.app');

  return lines.join('\n');
}

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
        <span className="flex items-center gap-1"><span className="text-orange-400 text-[10px]">+1</span> Bogey</span>
        <span className="flex items-center gap-1"><span className="text-red-400 text-[10px]">+2</span> Double+</span>
      </div>
    </div>
  );
}

const PODIUM_ORDER = [1, 0, 2];

const PODIUM_CONFIG = [
  { height: 'h-36', bg: 'bg-yellow-500/15', border: 'border-yellow-500/40', glow: 'shadow-[0_0_20px_-4px_rgba(234,179,8,0.4)]', numColor: 'text-yellow-400', label: '1ST' },
  { height: 'h-28', bg: 'bg-zinc-400/10', border: 'border-zinc-400/30', glow: '', numColor: 'text-zinc-400', label: '2ND' },
  { height: 'h-20', bg: 'bg-amber-700/10', border: 'border-amber-700/30', glow: '', numColor: 'text-amber-600', label: '3RD' },
];

export default function Results() {
  const [, navigate] = useLocation();
  const { holes } = useCourse();
  const { leaveTournament } = useTournament();
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
      toast({ title: 'Results copied', description: 'Paste and share anywhere.' });
    } catch {
      toast({ title: 'Could not share', description: 'Sharing is not supported on this device.', variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-[100dvh] w-full bg-background pb-24 relative overflow-hidden">
      {/* Layered glow backdrop */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-gradient-to-b from-primary/20 via-primary/5 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(57,255,20,0.18),transparent)]" />

      <div className="relative max-w-md mx-auto px-4 pt-10">

        {/* ── Header ── */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 border border-primary/30 mb-4 shadow-[0_0_24px_-4px_rgba(57,255,20,0.5)]">
            <Trophy className="w-7 h-7 text-primary" />
          </div>
          <p className="text-[11px] font-black uppercase tracking-[0.45em] text-primary mb-1">Final Results</p>
          <h1 className="font-condensed text-5xl font-black uppercase tracking-wider leading-none text-foreground">
            Whack Fuck Cup
          </h1>
          <p className="text-xs text-muted-foreground mt-2 uppercase tracking-widest">Dundee Country Club</p>
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
            {/* ── Champion card ── */}
            {champion && (
              <div className="relative rounded-3xl overflow-hidden mb-8 border border-yellow-500/30 shadow-[0_0_48px_-8px_rgba(234,179,8,0.35)]">
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/20 via-card/80 to-card" />
                <div className="relative px-6 pt-6 pb-5 text-center">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <Crown className="w-5 h-5 text-yellow-400" />
                    <span className="text-[10px] font-black uppercase tracking-[0.35em] text-yellow-400">Champions</span>
                    <Crown className="w-5 h-5 text-yellow-400" />
                  </div>
                  <h2 className="font-condensed text-5xl font-black uppercase tracking-wide leading-none text-foreground mb-1">
                    {champion.teamName}
                  </h2>
                  {teamSubtitle(champion.teamName, champion.players) && (
                    <p className="text-xs text-muted-foreground mb-4">{teamSubtitle(champion.teamName, champion.players)}</p>
                  )}
                  <div className="inline-flex flex-col items-center">
                    <span className="font-condensed text-7xl font-black leading-none text-primary" style={{ textShadow: '0 0 32px rgba(57,255,20,0.6)' }}>
                      {netLabel(champion.netScore)}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary/60 mt-1">Net Score</span>
                  </div>
                </div>
              </div>
            )}

            {/* ── Podium ── */}
            {podium.length > 1 && (
              <div className="flex items-end justify-center gap-2 mb-8">
                {PODIUM_ORDER.map(placeIdx => {
                  const t = podium[placeIdx];
                  if (!t) return <div key={`empty-${placeIdx}`} className="flex-1" />;
                  const cfg = PODIUM_CONFIG[placeIdx];
                  const isChamp = placeIdx === 0;
                  return (
                    <div key={t.id} className="flex-1 flex flex-col items-center">
                      <div className="text-center mb-2 w-full px-1">
                        {isChamp
                          ? <Crown className="w-4 h-4 text-yellow-400 mx-auto mb-1" />
                          : placeIdx === 1
                            ? <Medal className="w-3.5 h-3.5 text-zinc-400 mx-auto mb-1" />
                            : <Medal className="w-3.5 h-3.5 text-amber-600 mx-auto mb-1" />
                        }
                        <p className="font-bold text-[11px] truncate leading-tight">{t.teamName}</p>
                        <p className={`font-condensed text-base font-black leading-none ${cfg.numColor}`}>{netLabel(t.netScore)}</p>
                      </div>
                      <div className={`w-full ${cfg.height} rounded-t-xl border-t border-x ${cfg.bg} ${cfg.border} ${cfg.glow} flex flex-col items-center justify-start pt-2`}>
                        <span className={`font-condensed text-2xl font-black ${cfg.numColor}`}>{cfg.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Superlatives ── */}
            {superlatives.length > 0 && (
              <div className="mb-6">
                <p className="text-[10px] font-black uppercase tracking-[0.35em] text-muted-foreground mb-3">Tournament Awards</p>
                <div className="grid gap-2">
                  {superlatives.map(s => (
                    <div key={s.label} className="flex items-center gap-3 bg-card/60 border border-border/60 rounded-2xl px-4 py-3 backdrop-blur">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                        <s.icon className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-black uppercase tracking-widest text-primary leading-none mb-0.5">{s.label}</p>
                        <p className="font-bold text-sm truncate leading-tight">{s.teamName}</p>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">{s.detail}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Full standings ── */}
            <div className="mb-6">
              <p className="text-[10px] font-black uppercase tracking-[0.35em] text-muted-foreground mb-3">Full Standings</p>
              <div className="bg-card/60 border border-border/60 rounded-2xl overflow-hidden backdrop-blur">
                {ranked.map((t, i) => {
                  const isOpen = expandedId === t.id;
                  const isTop3 = i < 3;
                  const rankColor = i === 0
                    ? 'text-yellow-400'
                    : i === 1
                      ? 'text-zinc-400'
                      : i === 2
                        ? 'text-amber-600'
                        : 'text-muted-foreground';
                  return (
                    <div key={t.id} className="border-t border-border/30 first:border-t-0">
                      <button
                        type="button"
                        onClick={() => setExpandedId(isOpen ? null : t.id)}
                        aria-expanded={isOpen}
                        className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${isOpen ? 'bg-secondary/30' : 'hover:bg-primary/5'}`}
                        data-testid={`button-expand-team-${t.id}`}
                      >
                        <span className={`font-condensed text-lg font-black w-7 text-center shrink-0 ${rankColor}`}>
                          {i === 0 ? <Crown className="w-4 h-4 inline" /> : i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className={`font-bold text-sm truncate leading-tight ${isTop3 ? 'text-foreground' : 'text-foreground/80'}`}>{t.teamName}</p>
                          <p className="text-[10px] text-muted-foreground truncate mt-0.5">{[teamSubtitle(t.teamName, t.players), `${t.holesPlayed}/18`].filter(Boolean).join(' · ')}</p>
                        </div>
                        <span className={`font-condensed text-xl font-black leading-none shrink-0 ${t.netScore < 0 ? 'text-primary' : t.netScore > 0 ? 'text-orange-400' : 'text-muted-foreground'}`}>
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

            {/* ── Share ── */}
            <Button
              className="w-full h-14 font-condensed text-xl font-black uppercase tracking-widest gap-2 neon-border"
              onClick={handleShare}
              data-testid="button-share-results"
            >
              {shared ? <Check className="w-5 h-5" /> : <Share2 className="w-5 h-5" />}
              {shared ? 'Copied to Clipboard' : 'Share Results'}
            </Button>
          </>
        )}

        <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground mt-6 mb-2">
          <span className="relative flex h-2 w-2">
            <span className={`relative inline-flex rounded-full h-2 w-2 ${isFirebaseConfigured ? 'bg-primary' : 'bg-muted-foreground'}`} />
          </span>
          {isFirebaseConfigured ? 'Live results' : 'Local results'}
        </div>

        <Button
          variant="outline"
          className="w-full h-11 mt-2 font-condensed font-bold uppercase tracking-widest"
          onClick={() => navigate('/leaderboard')}
          data-testid="button-view-leaderboard"
        >
          View Leaderboard
        </Button>

        <Button
          variant="ghost"
          className="w-full h-11 mt-2 font-condensed font-bold uppercase tracking-widest gap-2 text-muted-foreground"
          onClick={() => { leaveTournament(); navigate('/'); }}
          data-testid="button-main-menu"
        >
          <Repeat className="w-4 h-4" /> Main Menu / Switch Tournament
        </Button>
      </div>
    </div>
  );
}
