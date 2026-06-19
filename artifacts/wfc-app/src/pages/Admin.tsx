import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'wouter';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { db } from '@/lib/firebase';
import {
  addDoc, setDoc, getDocs, writeBatch, serverTimestamp,
  query, where, deleteDoc, updateDoc, onSnapshot, Timestamp,
} from 'firebase/firestore';
import QRCode from 'qrcode';
import { useToast } from '@/hooks/use-toast';
import { useCourse, useTournament } from '@/lib/tournamentContext';
import { RuleBuilder } from '@/components/RuleBuilder';
import {
  teamsCol, eventsCol, drivesCol, teamDoc, configDoc, tournamentDoc,
  getActiveTournamentId, formatPlayers, teamSubtitle, normalizeScores, scoresToMap,
  resolveHoleRules, generateAdminCode, generateHostKey, generateTeamCode, hostKeyKey,
  chatCol, dmChannelId,
  type CourseHole, type HoleRule, type RuleLibraryEntry,
} from '@/lib/tournament';
import { diffCorrectionEdits, correctTeamScores, applyManualAdjustment, spinsFromData, type WheelSpinRecord } from '@/lib/scoreSync';
import { WHEEL_ITEMS, pickRandomIndex, DEFAULT_WHEEL_WEIGHTS, type WheelItemId } from '@/lib/wheel';
import { useWFC } from '@/lib/store';
import { pickRoast } from '@/lib/roasts';
import {
  Sparkles, Trash2, Beaker, Megaphone, Lock, LockOpen, Users, Pencil, X,
  Plus, Minus, RefreshCw, ChevronDown, ChevronUp, Play, Pause,
  ShieldAlert, AlertTriangle, CheckCircle2, Flag, ClipboardList,
  Share2, Copy, Check, KeyRound, Grid3x3, Trophy, Timer, MessageSquare,
} from 'lucide-react';

const DEMO_TEAM_NAMES = [
  'Birdie Bandits', 'Sandbaggers', 'Bogey Boys', 'Mulligan Mafia', 'Whack Attack',
  'Bunker Bros', 'Fairway Felons', 'Eagle Eyes', 'Slice Society', 'Hook Hooligans',
  'Putt Pirates', 'Tee Time Titans', 'The Shankopotamuses', 'Divot Demons', 'Chip Shots',
  'Iron Sheikhs', 'Wedge Warriors', 'The Yips', 'Lost Ball Legends', 'Cart Path Crew',
  'Grip It & Rip It', 'Tin Cups', 'Albatross Alliance', 'Rough Riders', 'Pin Seekers',
  'Green Goblins', 'Stroke of Genius', 'Par-Tee Animals', 'Driving Range Rangers', 'Whiff Whisperers',
];

const DEMO_FIRST_NAMES = [
  'Mike', 'Dave', 'Steve', 'Justin', 'Ryan', 'Brad', 'Kyle', 'Chris', 'Matt', 'Jeff',
  'Tyler', 'Mark', 'Adam', 'Greg', 'Dan', 'Nate', 'Sean', 'Jon', 'Andy', 'Tom',
  'Will', 'Pete', 'Sam', 'Luke', 'Eric', 'Paul', 'Jake', 'Ben', 'Drew', 'Cole',
];

function randomHoleScore(par: number): number {
  const r = Math.random();
  if (par >= 4 && r < 0.02) return par - 2; // eagle (par 4/5 only)
  if (r < 0.07) return par - 1;             // birdie
  if (r < 0.38) return par;                 // par
  if (r < 0.72) return par + 1;             // bogey
  if (r < 0.90) return par + 2;             // double
  return par + 3;                           // triple
}

// Wilder distribution used during LIVE simulation so the leaderboard swings
// hard: occasional good ones, but plenty of triples, snowmen (8+), and whiffs.
function demoHoleScore(par: number): number {
  const r = Math.random();
  if (par >= 4 && r < 0.04) return par - 2;            // eagle
  if (r < 0.15) return par - 1;                        // birdie (occasional good ones)
  if (r < 0.30) return par;                            // par
  if (r < 0.48) return par + 1;                        // bogey
  if (r < 0.66) return par + 2;                        // double
  if (r < 0.82) return par + 3;                        // triple
  if (r < 0.93) return Math.max(8, par + 4);           // snowman territory
  return par + 5 + Math.floor(Math.random() * 2);      // total whiff blowup
}

// Trash-talk one-liners demo teams fire into the global Lounge.
const DEMO_CHATTER = [
  'who let the bogey boys out 😂 oh wait no emojis. who let the bogey boys out',
  'just carded a snowman on a par 3, dont @ me',
  'pour one out for my scorecard',
  'we are LITERALLY the best team here and the leaderboard is lying',
  'whoever raked the bunker on 7 you are a hero',
  'my partner has not made contact with the ball since hole 4',
  'tips tees were a mistake. a huge mistake.',
  'someone explain how we are losing to the Sandbaggers',
  'three putts. three of them. on one green.',
  'lost two balls in the pond, found someone elses prius keys',
  'the wheel of fortune just ruined my entire life',
  'we came here to have fun and we are failing at that too',
  'cart girl pls come back to hole 11 we need you',
  'i have peaked. it was the first tee shot. all downhill from here',
  'whacky is being mean again and honestly its deserved',
  'currently negotiating a mulligan with my conscience',
  'big swings energy, zero results',
  'leaderboard check: still humbling',
  'genuinely incredible how bad we are at a game we paid to play',
  'shoutout to the foursome ahead playing at the speed of continental drift',
];

// What a rival team slides into your DMs with (these pop up as banners).
const DEMO_DM_LINES = [
  'we are coming for you. check the leaderboard.',
  'no way you actually beat us on 9. no way.',
  'wanna make this interesting? loser buys the round',
  'your team name is mid and your scores are worse',
  'heard you whiffed on the tee box. classic.',
  'good luck on the back 9, youll need it',
  'we saw that triple bogey. we all saw it.',
  'tell your partner the bunkers are not lava, you can hit out of them',
  'you up? (on the leaderboard? barely.)',
  'respect the game, respect the grind, respect US specifically',
];

// Weighted distribution so demo teams feel mid-round:
// ~8% very early (2-3), 15% front 9 (5-7), 22% at the turn (8-10),
// 28% back 9 (11-13), 17% late (14-16), 10% finishing (17-18)
function liveHolesPlayed(): number {
  const r = Math.random();
  if (r < 0.08) return 2 + Math.floor(Math.random() * 2);  // 2-3
  if (r < 0.23) return 5 + Math.floor(Math.random() * 3);  // 5-7
  if (r < 0.45) return 8 + Math.floor(Math.random() * 3);  // 8-10
  if (r < 0.73) return 11 + Math.floor(Math.random() * 3); // 11-13
  if (r < 0.90) return 14 + Math.floor(Math.random() * 3); // 14-16
  if (r < 0.96) return 17;
  return 18;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

interface LiveTeam {
  id: string;
  teamName: string;
  players: string[];
  netScore: number;
  holesPlayed: number;
  wheelAdjustment?: number;
  isDemo?: boolean;
  scores?: (number | null)[];
  hasSubmitted?: boolean;
  submittedAt?: number | null;
  lastUpdated?: number | null;
  frontNineConfirmed?: boolean;
  wheelSpin?: { item?: string } | null;
  wheelSpins?: Record<number, WheelSpinRecord>;
  teamCode?: string;
  teeOverride?: 'tips' | 'womens' | null;
}

interface AuditFlag {
  severity: 'high' | 'medium' | 'low';
  label: string;
  detail: string;
}

function mapTeam(id: string, data: Record<string, unknown>): LiveTeam {
  const d = data as Record<string, unknown>;
  const submittedAtRaw = d.submittedAt as { toMillis?: () => number } | number | null | undefined;
  const lastUpdatedRaw = d.lastUpdated as { toMillis?: () => number } | number | null | undefined;
  const toMs = (v: typeof submittedAtRaw): number | null => {
    if (!v) return null;
    if (typeof v === 'number') return v;
    if (typeof v === 'object' && typeof v.toMillis === 'function') return v.toMillis();
    return null;
  };
  const players = Array.isArray(d.players)
    ? (d.players as unknown[]).filter((p): p is string => typeof p === 'string')
    : [d.player1, d.player2].filter((p): p is string => typeof p === 'string' && p.trim() !== '');
  return {
    id,
    teamName: (d.teamName as string) ?? '(unnamed)',
    players,
    netScore: typeof d.netScore === 'number' ? d.netScore : 0,
    holesPlayed: typeof d.holesPlayed === 'number' ? d.holesPlayed : 0,
    wheelAdjustment: typeof d.wheelAdjustment === 'number' ? d.wheelAdjustment : 0,
    isDemo: !!d.isDemo,
    scores: normalizeScores(d.scores),
    hasSubmitted: !!d.hasSubmitted,
    submittedAt: toMs(submittedAtRaw),
    lastUpdated: toMs(lastUpdatedRaw),
    frontNineConfirmed: !!d.frontNineConfirmed,
    wheelSpin: (d.wheelSpin as { item?: string } | null | undefined) ?? null,
    wheelSpins: spinsFromData(d),
    teamCode: typeof d.teamCode === 'string' ? d.teamCode : undefined,
    teeOverride: d.teeOverride === 'tips' || d.teeOverride === 'womens' ? d.teeOverride : null,
  };
}

function auditTeam(
  t: LiveTeam,
  holes: CourseHole[],
  holeRules: Array<{ type?: string } | null | undefined>,
): AuditFlag[] {
  const flags: AuditFlag[] = [];
  const scores = Array.isArray(t.scores) ? t.scores : [];
  let birdies = 0;
  let eagles = 0;
  let eagleOnPar3 = false;
  scores.forEach((s, i) => {
    if (s === null || s === undefined) return;
    const par = holes[i]?.par ?? 4;
    const d = s - par;
    if (d <= -2) {
      eagles++;
      if (par === 3) eagleOnPar3 = true;
    } else if (d === -1) {
      birdies++;
    }
  });

  if (t.hasSubmitted && (t.holesPlayed ?? 0) < 18) {
    flags.push({
      severity: 'high',
      label: 'Submitted with < 18 holes',
      detail: `Only ${t.holesPlayed}/18 holes scored when round was submitted.`,
    });
  }
  if (t.hasSubmitted && t.submittedAt && t.lastUpdated && t.lastUpdated - t.submittedAt > 5000) {
    const mins = Math.round((t.lastUpdated - t.submittedAt) / 60000);
    flags.push({
      severity: 'high',
      label: 'Edited after submitting',
      detail: `Doc updated ~${mins}m after the submit timestamp.`,
    });
  }
  if (t.netScore <= -5) {
    flags.push({
      severity: 'high',
      label: 'Suspiciously low net score',
      detail: `Net is ${t.netScore > 0 ? '+' : ''}${t.netScore} — confirm with playing partners.`,
    });
  } else if (t.netScore <= -3) {
    flags.push({
      severity: 'medium',
      label: 'Low net score',
      detail: `Net is ${t.netScore > 0 ? '+' : ''}${t.netScore} — worth a glance.`,
    });
  }
  if (birdies + eagles > 4) {
    flags.push({
      severity: 'medium',
      label: 'High under-par count',
      detail: `${birdies} birdie${birdies === 1 ? '' : 's'} + ${eagles} eagle${eagles === 1 ? '' : 's'} across the round.`,
    });
  }
  if (eagleOnPar3) {
    flags.push({
      severity: 'medium',
      label: 'Eagle on a par 3',
      detail: 'Hole-in-one claimed — verify before paying out.',
    });
  }
  // Wheel-aware: only tournaments that place Item Box holes can be flagged for
  // skipping a spin. For each scored wheel hole with no recorded spin, flag it.
  // Plain tournaments (no wheel holes) never trip this.
  const unspunWheelHoles = holeRules
    .map((r, i) => (r?.type === 'wheel' ? i : -1))
    .filter(i => i >= 0 && scores[i] !== null && scores[i] !== undefined && !t.wheelSpins?.[i + 1]?.item);
  if (unspunWheelHoles.length > 0) {
    const list = unspunWheelHoles.map(i => i + 1).join(', ');
    flags.push({
      severity: 'high',
      label: 'Item Box hole scored without a spin',
      detail: `Hole${unspunWheelHoles.length === 1 ? '' : 's'} ${list} scored but the wheel was never spun.`,
    });
  }
  return flags;
}

export default function Admin() {
  const { holes, autoTeeRule, holeRules } = useCourse();
  const { tournament } = useTournament();
  const { teamId } = useWFC();
  const [, navigate] = useLocation();
  const [password, setPassword] = useState('');
  const [auth, setAuth] = useState(false);
  const [message, setMessage] = useState('');
  const [demoCount, setDemoCount] = useState(13);
  const [seeding, setSeeding] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const simTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast } = useToast();

  // ── Demo simulation safety + scheduling ──────────────────────────────────
  const DEMO_MAX_SECONDS = 300; // hard 5-minute cap to protect Firebase limits
  const SIM_TICK_MS = 2500;     // how often we check the per-team advance schedule
  const [demoSecondsLeft, setDemoSecondsLeft] = useState(DEMO_MAX_SECONDS);
  const demoStartRef = useRef<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Hard cancellation flag: an in-flight async tick checks this before every
  // write so stopping/timing out can't leak writes after the sim is killed.
  const runningRef = useRef(false);
  // Per-team "next time this bot may complete a hole" (ms epoch) → 8-15s cadence.
  const nextAdvanceRef = useRef<Record<string, number>>({});
  const nextLobbyChatRef = useRef(0);
  const nextDmChatRef = useRef(0);
  const chatIdxRef = useRef(Math.floor(Math.random() * 100));
  // Latest-callback refs so the interval never closes over stale functions.
  const simTickRef = useRef<() => void>(() => {});
  const timeoutDemoRef = useRef<() => void>(() => {});

  // Team management state
  const [teams, setTeams] = useState<LiveTeam[]>([]);
  const [teamsOpen, setTeamsOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingTeam, setEditingTeam] = useState<LiveTeam | null>(null);
  const [editName, setEditName] = useState('');
  const [editPlayers, setEditPlayers] = useState<string[]>([]);
  const [adjustingTeam, setAdjustingTeam] = useState<LiveTeam | null>(null);
  const [adjustDelta, setAdjustDelta] = useState(0);
  const [saving, setSaving] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditExpandedId, setAuditExpandedId] = useState<string | null>(null);

  // Share & invite panel
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  // Per-hole score correction modal
  const [correctingTeam, setCorrectingTeam] = useState<LiveTeam | null>(null);
  const [correctDraft, setCorrectDraft] = useState<(number | null)[]>([]);
  const [teeDraft, setTeeDraft] = useState<'tips' | 'womens' | null>(null);
  const [correctSaving, setCorrectSaving] = useState(false);

  // Code management
  const [codeBusy, setCodeBusy] = useState(false);
  const [newHostKey, setNewHostKey] = useState<string | null>(null);

  // Finalize flow
  const [finalizing, setFinalizing] = useState(false);
  const isFinal = tournament?.status === 'final';

  // Scoring lock (pause) — distinct from finalize: blocks entry but keeps players
  // on their own screens (no results-page redirect).
  const scoringLocked = tournament?.scoringLocked === true;
  const [lockBusy, setLockBusy] = useState(false);

  // Shotgun-start hole assignments (only used when startType === 'shotgun').
  const isShotgun = tournament?.startType === 'shotgun';
  const [shotgunDraft, setShotgunDraft] = useState<Record<string, number>>({});
  const [shotgunSaving, setShotgunSaving] = useState(false);
  const [startTypeBusy, setStartTypeBusy] = useState(false);

  // Pre-create team modal (set teams up before play; assign holes when shotgun).
  const [addingTeam, setAddingTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamPlayers, setNewTeamPlayers] = useState<string[]>([]);
  const [newTeamHole, setNewTeamHole] = useState(1);
  const [creating, setCreating] = useState(false);

  const [rulesOpen, setRulesOpen] = useState(false);
  const [ruleDraft, setRuleDraft] = useState<HoleRule[]>([]);
  const [customDraft, setCustomDraft] = useState<RuleLibraryEntry[]>([]);
  const [rulesSaving, setRulesSaving] = useState(false);
  const [wheelWeightsBusy, setWheelWeightsBusy] = useState(false);
  // Once the host starts editing, stop reseeding from live snapshots so their
  // in-progress edits aren't clobbered by an incoming Firestore update.
  const [rulesDirty, setRulesDirty] = useState(false);

  // New collapsible panel states
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [formatOpen, setFormatOpen] = useState(false);
  const [regOpen, setRegOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [perTeamLinksOpen, setPerTeamLinksOpen] = useState(false);

  const loadTeams = useCallback(async () => {
    if (!db || !getActiveTournamentId()) return;
    const snap = await getDocs(teamsCol(db));
    const list: LiveTeam[] = snap.docs.map(d => mapTeam(d.id, d.data()));
    list.sort((a, b) => a.netScore - b.netScore);
    setTeams(list);
  }, []);

  // Live listener while any team-driven panel is open
  useEffect(() => {
    if (!auth || (!teamsOpen && !auditOpen && !perTeamLinksOpen) || !db || !getActiveTournamentId()) return;
    const unsub = onSnapshot(teamsCol(db), snap => {
      const list: LiveTeam[] = snap.docs.map(d => mapTeam(d.id, d.data()));
      list.sort((a, b) => a.netScore - b.netScore);
      setTeams(list);
    });
    return () => unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth, teamsOpen, auditOpen, perTeamLinksOpen]);

  // Build the join QR whenever the join code changes (always visible once authenticated).
  const joinCode = tournament?.joinCode ?? '';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const joinLink = joinCode ? `${origin}${import.meta.env.BASE_URL}join/${joinCode}` : '';
  const inviteLink = (teamCode: string) =>
    joinCode && teamCode ? `${origin}${import.meta.env.BASE_URL}join/${joinCode}/${teamCode}` : '';

  useEffect(() => {
    if (!auth || !joinLink) { setQr(''); return; }
    QRCode.toDataURL(joinLink, { margin: 1, width: 240, color: { dark: '#39FF14', light: '#0a0a0a' } })
      .then(setQr)
      .catch(() => setQr(''));
  }, [auth, joinLink]);

  // Keep a live team list for the shotgun assignment card without needing the
  // host to open the Team Management panel first.
  useEffect(() => {
    if (!auth || !isShotgun || !db || !getActiveTournamentId()) return;
    const unsub = onSnapshot(teamsCol(db), snap => {
      const list: LiveTeam[] = snap.docs.map(d => mapTeam(d.id, d.data()));
      list.sort((a, b) => a.netScore - b.netScore);
      setTeams(list);
    });
    return () => unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth, isShotgun]);

  // Seed the editable draft from the saved assignments whenever they change.
  useEffect(() => {
    setShotgunDraft(tournament?.shotgunAssignments ?? {});
  }, [tournament?.shotgunAssignments]);

  // Seed the rule-builder draft from the saved tournament rules (resolved
  // against the course). Stop once the host begins editing so live snapshots
  // don't overwrite their unsaved work.
  useEffect(() => {
    if (rulesDirty) return;
    setRuleDraft(resolveHoleRules(tournament?.holeRules, holes));
    setCustomDraft(tournament?.customRules ?? []);
  }, [tournament?.holeRules, tournament?.customRules, holes, rulesDirty]);

  const handleSaveShotgun = async () => {
    const tId = getActiveTournamentId();
    if (!db || !tId) {
      toast({ title: 'Not connected', description: 'Shotgun assignments need Firebase.', variant: 'destructive' });
      return;
    }
    setShotgunSaving(true);
    try {
      await setDoc(tournamentDoc(db, tId), { shotgunAssignments: shotgunDraft }, { merge: true });
      toast({ title: 'Shotgun assignments saved' });
    } catch (e) {
      toast({ title: 'Save failed', description: String(e), variant: 'destructive' });
    } finally {
      setShotgunSaving(false);
    }
  };

  const handleSaveRules = async () => {
    const tId = getActiveTournamentId();
    if (!db || !tId) {
      toast({ title: 'Not connected', description: 'Saving hole rules needs Firebase.', variant: 'destructive' });
      return;
    }
    setRulesSaving(true);
    try {
      await setDoc(tournamentDoc(db, tId), { holeRules: ruleDraft, customRules: customDraft }, { merge: true });
      setRulesDirty(false);
      toast({ title: 'Hole rules saved' });
    } catch (e) {
      toast({ title: 'Save failed', description: String(e), variant: 'destructive' });
    } finally {
      setRulesSaving(false);
    }
  };

  // Round-robin: spread teams across holes 1, 2, 3 … wrapping at 18.
  const handleAutoAssignShotgun = () => {
    const next: Record<string, number> = {};
    teams.forEach((t, i) => { next[t.id] = (i % 18) + 1; });
    setShotgunDraft(next);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Everyone — including the tournament creator — must enter the admin code.
    const code = tournament?.adminCode;
    if (code && password.trim() === code) {
      setAuth(true);
    } else {
      toast({ title: 'Access Denied', variant: 'destructive' });
    }
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !message.trim() || !getActiveTournamentId()) return;
    try {
      await addDoc(eventsCol(db), {
        type: 'broadcast',
        message,
        timestamp: new Date().toISOString(),
      });
      toast({ title: 'Broadcast Sent' });
      setMessage('');
    } catch {
      toast({ title: 'Failed to send', variant: 'destructive' });
    }
  };

  const handleUnlockScorecard = async (team: LiveTeam) => {
    if (!db || !getActiveTournamentId()) return;
    if (!window.confirm(`Unlock scorecard for "${team.teamName}"? They will be able to edit scores again.`)) return;
    try {
      await updateDoc(teamDoc(db, team.id), { hasSubmitted: false, submittedAt: null });
      toast({ title: `Unlocked "${team.teamName}"`, description: 'Scorecard is editable again.' });
    } catch (e) {
      toast({ title: 'Unlock failed', description: String(e), variant: 'destructive' });
    }
  };

  const handleDelete = async (team: LiveTeam) => {
    if (!db || !getActiveTournamentId()) return;
    if (!window.confirm(`Delete "${team.teamName}" (${formatPlayers(team.players)})? This cannot be undone.`)) return;
    setDeletingId(team.id);
    try {
      await deleteDoc(teamDoc(db, team.id));
      toast({ title: `Deleted "${team.teamName}"` });
    } catch (e) {
      toast({ title: 'Delete failed', description: String(e), variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  const openEdit = (team: LiveTeam) => {
    setEditingTeam(team);
    setEditName(team.teamName);
    const size = Math.max(team.players.length, tournament?.teamSize ?? team.players.length, 1);
    const filled = Array.from({ length: size }, (_, i) => team.players[i] ?? '');
    setEditPlayers(filled);
  };

  const handleSaveEdit = async () => {
    if (!db || !editingTeam || !getActiveTournamentId()) return;
    const useTeamNames = tournament?.useTeamNames ?? true;
    const players = editPlayers.map(p => p.trim()).filter(p => p !== '');
    const teamName = useTeamNames
      ? editName.trim()
      : (formatPlayers(players) || 'Team');
    if (useTeamNames && !editName.trim()) {
      toast({ title: 'Team name required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await updateDoc(teamDoc(db, editingTeam.id), {
        teamName,
        players,
      });
      toast({ title: 'Team updated' });
      setEditingTeam(null);
    } catch (e) {
      toast({ title: 'Save failed', description: String(e), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const openAdjust = (team: LiveTeam) => {
    setAdjustingTeam(team);
    setAdjustDelta(0);
  };

  const handleSaveAdjust = async () => {
    if (!db || !adjustingTeam || adjustDelta === 0 || !getActiveTournamentId()) { setAdjustingTeam(null); return; }
    setSaving(true);
    try {
      await applyManualAdjustment(db, teamDoc(db, adjustingTeam.id), adjustDelta, holes);
      toast({
        title: `Adjusted "${adjustingTeam.teamName}"`,
        description: `${adjustDelta > 0 ? '+' : ''}${adjustDelta} stroke${Math.abs(adjustDelta) !== 1 ? 's' : ''} applied`,
      });
      setAdjustingTeam(null);
    } catch (e) {
      toast({ title: 'Adjust failed', description: String(e), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ── Per-hole score correction (conflict-free scores.{hole} merge) ──
  const openCorrect = (team: LiveTeam) => {
    setCorrectingTeam(team);
    setCorrectDraft(team.scores && team.scores.length === 18 ? [...team.scores] : Array(18).fill(null));
    setTeeDraft(team.teeOverride ?? null);
  };

  const handleSaveCorrection = async () => {
    const team = correctingTeam;
    if (!db || !team || !getActiveTournamentId()) { setCorrectingTeam(null); return; }
    setCorrectSaving(true);
    try {
      // Determine which holes the admin explicitly touched (vs. the snapshot the
      // modal opened with). Only these are applied; everything else stays under
      // the authority of whatever the player has written since.
      const snapshot = team.scores ?? [];
      const edits = diffCorrectionEdits(snapshot, correctDraft);
      const teeChanged = autoTeeRule && (teeDraft ?? null) !== (team.teeOverride ?? null);

      if (edits.length === 0 && !teeChanged) { setCorrectingTeam(null); return; }

      // Conflict-free correction: reads the latest team doc inside a transaction,
      // applies only the edited holes onto the CURRENT server scores map, and
      // recomputes aggregates. Concurrent player edits to other holes survive.
      const ref = teamDoc(db, team.id);
      await correctTeamScores(db, ref, edits, { changed: teeChanged, value: teeDraft }, holes);

      toast({ title: `Updated "${team.teamName}"` });
      setCorrectingTeam(null);
    } catch (e) {
      toast({ title: 'Save failed', description: String(e), variant: 'destructive' });
    } finally {
      setCorrectSaving(false);
    }
  };

  // ── Code management ──
  const handleRegenAdminCode = async () => {
    const tId = getActiveTournamentId();
    if (!db || !tId) { toast({ title: 'Not connected', variant: 'destructive' }); return; }
    if (!window.confirm('Generate a new admin code? The current code stops working immediately.')) return;
    setCodeBusy(true);
    try {
      const code = generateAdminCode();
      await setDoc(tournamentDoc(db, tId), { adminCode: code }, { merge: true });
      toast({ title: 'New admin code', description: code });
    } catch (e) {
      toast({ title: 'Failed', description: String(e), variant: 'destructive' });
    } finally {
      setCodeBusy(false);
    }
  };

  const handleRotateHostKey = async () => {
    const tId = getActiveTournamentId();
    if (!db || !tId) { toast({ title: 'Not connected', variant: 'destructive' }); return; }
    if (!window.confirm('Rotate the host recovery key? Any previously saved host key (and host links using it) stops working. This device stays signed in.')) return;
    setCodeBusy(true);
    try {
      const key = generateHostKey();
      await setDoc(tournamentDoc(db, tId), { hostKey: key }, { merge: true });
      // Keep this device authenticated as host after the rotation.
      try { localStorage.setItem(hostKeyKey(tId), key); } catch { /* ignore */ }
      setNewHostKey(key);
      toast({ title: 'Host key rotated', description: 'Screenshot the new key now.' });
    } catch (e) {
      toast({ title: 'Failed', description: String(e), variant: 'destructive' });
    } finally {
      setCodeBusy(false);
    }
  };

  const handleToggleRequireTeamCode = async (next: boolean) => {
    const tId = getActiveTournamentId();
    if (!db || !tId) { toast({ title: 'Not connected', variant: 'destructive' }); return; }
    setCodeBusy(true);
    try {
      await setDoc(tournamentDoc(db, tId), { requireTeamCode: next }, { merge: true });
      toast({
        title: next ? 'Team code required' : 'Team code not required',
        description: next
          ? 'Players need the 4-character code to rejoin a team.'
          : 'Players can rejoin any team by tapping it.',
      });
    } catch (e) {
      toast({ title: 'Failed', description: String(e), variant: 'destructive' });
    } finally {
      setCodeBusy(false);
    }
  };

  const handleToggleUseTeamNames = async (next: boolean) => {
    const tId = getActiveTournamentId();
    if (!db || !tId) { toast({ title: 'Not connected', variant: 'destructive' }); return; }
    setCodeBusy(true);
    try {
      await setDoc(tournamentDoc(db, tId), { useTeamNames: next }, { merge: true });
      toast({
        title: next ? 'Team names on' : 'Team names off',
        description: next
          ? 'Teams enter their own name when registering.'
          : "Player names are used as the team name.",
      });
    } catch (e) {
      toast({ title: 'Failed', description: String(e), variant: 'destructive' });
    } finally {
      setCodeBusy(false);
    }
  };

  // ── Finalize / reopen ──
  const handleFinalize = async () => {
    const tId = getActiveTournamentId();
    if (!db || !tId) { toast({ title: 'Not connected', variant: 'destructive' }); return; }
    if (!window.confirm('Finalize the tournament? Scoring locks for ALL teams and everyone is moved to the results page.')) return;
    setFinalizing(true);
    try {
      await setDoc(tournamentDoc(db, tId), { status: 'final' }, { merge: true });
      toast({ title: 'Tournament finalized', description: 'Scoring is locked. Players see the results page.' });
    } catch (e) {
      toast({ title: 'Failed', description: String(e), variant: 'destructive' });
    } finally {
      setFinalizing(false);
    }
  };

  const handleReopen = async () => {
    const tId = getActiveTournamentId();
    if (!db || !tId) { toast({ title: 'Not connected', variant: 'destructive' }); return; }
    if (!window.confirm('Reopen scoring? Teams can edit scores again and the results page stops being forced.')) return;
    setFinalizing(true);
    try {
      await setDoc(tournamentDoc(db, tId), { status: 'live' }, { merge: true });
      toast({ title: 'Scoring reopened' });
    } catch (e) {
      toast({ title: 'Failed', description: String(e), variant: 'destructive' });
    } finally {
      setFinalizing(false);
    }
  };

  // ── Lock / unlock scoring (pause, no redirect) ──
  const handleToggleScoringLock = async (next: boolean) => {
    const tId = getActiveTournamentId();
    if (!db || !tId) { toast({ title: 'Not connected', variant: 'destructive' }); return; }
    setLockBusy(true);
    try {
      await setDoc(tournamentDoc(db, tId), { scoringLocked: next }, { merge: true });
      toast({
        title: next ? 'Scoring locked' : 'Scoring unlocked',
        description: next
          ? "Teams can't enter scores or spin. They stay on their own screens — nobody is moved to results."
          : 'Teams can enter scores again.',
      });
    } catch (e) {
      toast({ title: 'Failed', description: String(e), variant: 'destructive' });
    } finally {
      setLockBusy(false);
    }
  };

  // ── Item Box wheel item weights ──
  const handleSetWheelWeight = async (itemId: WheelItemId, weight: number) => {
    const tId = getActiveTournamentId();
    if (!db || !tId) { toast({ title: 'Not connected', variant: 'destructive' }); return; }
    setWheelWeightsBusy(true);
    try {
      const current = tournament?.wheelItemWeights ?? {};
      await setDoc(tournamentDoc(db, tId), { wheelItemWeights: { ...current, [itemId]: weight } }, { merge: true });
    } catch (e) {
      toast({ title: 'Failed to save weight', description: String(e), variant: 'destructive' });
    } finally {
      setWheelWeightsBusy(false);
    }
  };

  // ── Start format (normal vs shotgun) ──
  const handleToggleStartType = async (next: boolean) => {
    const tId = getActiveTournamentId();
    if (!db || !tId) { toast({ title: 'Not connected', variant: 'destructive' }); return; }
    setStartTypeBusy(true);
    try {
      await setDoc(tournamentDoc(db, tId), { startType: next ? 'shotgun' : 'normal' }, { merge: true });
      toast({
        title: next ? 'Shotgun start on' : 'Normal start on',
        description: next ? 'Assign each team a starting hole.' : 'All teams start on hole 1.',
      });
    } catch (e) {
      toast({ title: 'Failed', description: String(e), variant: 'destructive' });
    } finally {
      setStartTypeBusy(false);
    }
  };

  // ── Pre-create a team (before play) ──
  const openCreateTeam = () => {
    const size = Math.max(1, Math.min(4, tournament?.teamSize ?? 2));
    setNewTeamName('');
    setNewTeamPlayers(Array(size).fill(''));
    setNewTeamHole(1);
    setAddingTeam(true);
  };

  const handleCreateTeam = async () => {
    const tId = getActiveTournamentId();
    if (!db || !tId) {
      toast({ title: 'Not connected', description: 'Creating teams needs Firebase.', variant: 'destructive' });
      return;
    }
    const useTeamNames = tournament?.useTeamNames ?? true;
    const players = newTeamPlayers.map(p => p.trim()).filter(p => p !== '');
    const teamName = useTeamNames ? newTeamName.trim() : (formatPlayers(players) || 'Team');
    if (useTeamNames && !newTeamName.trim()) {
      toast({ title: 'Team name required', variant: 'destructive' });
      return;
    }
    if (players.length === 0) {
      toast({ title: 'Add at least one player', variant: 'destructive' });
      return;
    }
    setCreating(true);
    try {
      const ref = await addDoc(teamsCol(db), {
        teamName,
        players,
        teamCode: generateTeamCode(),
        scores: {},
        netScore: 0,
        holesPlayed: 0,
        currentTee: 'womens',
        frontNineConfirmed: false,
        wheelSpins: {},
        wheelAdjustment: 0,
        targetedBy: [],
      });
      if (isShotgun) {
        await setDoc(tournamentDoc(db, tId), {
          shotgunAssignments: { ...(tournament?.shotgunAssignments ?? {}), [ref.id]: newTeamHole },
        }, { merge: true });
      }
      toast({
        title: 'Team created',
        description: isShotgun ? `Starting on hole ${newTeamHole}.` : undefined,
      });
      setAddingTeam(false);
      await loadTeams();
    } catch (e) {
      toast({ title: 'Create failed', description: String(e), variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const copy = async (text: string, which: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(c => (c === which ? null : c)), 1500);
    } catch { /* ignore */ }
  };

  const handleSeedDemo = async () => {
    if (!db) {
      toast({ title: 'Firebase not configured', variant: 'destructive' });
      return;
    }
    const n = Math.max(2, Math.min(30, demoCount));
    setSeeding(true);
    try {
      const fdb = db;
      const existing = await getDocs(query(teamsCol(fdb), where('isDemo', '==', true)));
      if (!existing.empty) {
        const wipeBatch = writeBatch(fdb);
        existing.docs.forEach(d => wipeBatch.delete(d.ref));
        await wipeBatch.commit();
      }

      const names = shuffle(DEMO_TEAM_NAMES).slice(0, n);
      const firsts = shuffle(DEMO_FIRST_NAMES);
      const now = Date.now();

      interface DemoTeam {
        id: string;
        teamName: string;
        players: string[];
        scores: (number | null)[];
        holesPlayed: number;
        frontNineConfirmed: boolean;
        wheelSpins: Record<number, { item: WheelItemId; at: number; targetTeam?: string }>;
        wheelAdjustment: number;
        netScore: number;
        currentTee: string;
        targetedBy: { item: WheelItemId; fromTeam: string; at: number }[];
        _lastUpdatedMs: number;
      }

      // Assign holesPlayed using a live-tournament distribution, then clamp so
      // no two teams share the exact same hole if we have enough spread.
      const rawHoles = names.map(() => liveHolesPlayed());
      // Sort one copy to spread teams, then shuffle back to random order
      const sortedHoles = [...rawHoles].sort((a, b) => a - b);
      const assignedHoles = shuffle(sortedHoles);

      // Item Box holes are opt-in: only the holes whose effective rule is a
      // wheel get spins. A preset/plain tournament with no wheel holes seeds
      // zero spins (no more everyone-spun-on-hole-9 skew).
      const wheelHoleNums = holeRules
        .map((r, i) => (r?.type === 'wheel' ? i + 1 : 0))
        .filter(n => n > 0);

      const demoTeams: DemoTeam[] = names.map((teamName, i) => {
        const holesPlayed = assignedHoles[i];
        const scores: (number | null)[] = Array(18).fill(null);
        for (let h = 0; h < holesPlayed; h++) {
          scores[h] = randomHoleScore(holes[h].par);
        }
        const playedPar = holes.slice(0, holesPlayed).reduce((s, h) => s + h.par, 0);
        const playedScore = scores.slice(0, holesPlayed).reduce<number>((s, v) => s + (v ?? 0), 0);
        const rawNet = playedScore - playedPar;
        // One spin per wheel hole the team has actually reached, keyed by the
        // real hole number so leaderboard badges show the correct hole.
        const wheelSpins: Record<number, { item: WheelItemId; at: number; targetTeam?: string }> = {};
        for (const hn of wheelHoleNums) {
          if (holesPlayed >= hn) {
            wheelSpins[hn] = {
              item: WHEEL_ITEMS[pickRandomIndex()].id,
              at: now - Math.floor(Math.random() * 1000 * 60 * 30),
            };
          }
        }
        // Teams further along updated Firestore more recently (~9 min/hole variance)
        const minsAgo = Math.max(0, (18 - holesPlayed) * 9 + Math.floor(Math.random() * 8));
        return {
          id: `demo_${i}_${now}`,
          teamName,
          players: [firsts[i * 2 % firsts.length], firsts[(i * 2 + 1) % firsts.length]],
          scores,
          holesPlayed,
          frontNineConfirmed: holesPlayed >= 9,
          wheelSpins,
          wheelAdjustment: 0,
          netScore: rawNet,
          currentTee: rawNet < 0 ? 'tips' : 'womens',
          targetedBy: [],
          _lastUpdatedMs: now - minsAgo * 60 * 1000,
        };
      });

      for (const spinner of demoTeams) {
        const others = demoTeams.filter(t => t.id !== spinner.id);
        const fromTeam = spinner.teamName;

        for (const spin of Object.values(spinner.wheelSpins)) {
          const { item, at } = spin;
          const hit = (t: DemoTeam, src: WheelItemId) => {
            t.wheelAdjustment += 1;
            t.netScore += 1;
            t.targetedBy.push({ item: src, fromTeam, at });
          };

          switch (item) {
            case 'lightning':
              for (const t of others) hit(t, 'lightning');
              break;
            case 'boo': {
              const target = pick(others);
              if (target) {
                hit(target, 'boo');
                spin.targetTeam = target.teamName;
              }
              spinner.wheelAdjustment -= 1;
              spinner.netScore -= 1;
              break;
            }
            case 'mushroom':
              spinner.wheelAdjustment -= 1;
              spinner.netScore -= 1;
              break;
            case 'super_star':
              spinner.wheelAdjustment -= 2;
              spinner.netScore -= 2;
              break;
            case 'green_shell': {
              const target = pick(others);
              if (target) {
                hit(target, 'green_shell');
                spin.targetTeam = target.teamName;
              }
              break;
            }
            case 'red_shell': {
              const target = pick(others);
              if (target) {
                hit(target, 'red_shell');
                spin.targetTeam = target.teamName;
              }
              break;
            }
            case 'blue_shell': {
              const sorted = [...demoTeams].sort((a, b) => a.netScore - b.netScore);
              const leader = sorted[0];
              if (leader) {
                if (leader.id === spinner.id) {
                  spinner.wheelAdjustment += 1;
                  spinner.netScore += 1;
                } else {
                  hit(leader, 'blue_shell');
                }
                spin.targetTeam = leader.teamName;
              }
              break;
            }
            case 'banana': {
              const behind = others.filter(t => t.holesPlayed < spinner.holesPlayed);
              const target = pick(behind);
              if (target) {
                hit(target, 'banana');
                spin.targetTeam = target.teamName;
              }
              break;
            }
          }
        }
      }

      for (const t of demoTeams) {
        t.currentTee = t.netScore < 0 ? 'tips' : 'womens';
      }

      const batch = writeBatch(fdb);
      for (const t of demoTeams) {
        const ref = teamDoc(fdb, t.id);
        // Strip undefined fields (Firestore rejects them) from each per-hole
        // spin record, keying the map by hole number.
        const cleanSpins: Record<string, Record<string, unknown>> = {};
        for (const [hn, spin] of Object.entries(t.wheelSpins)) {
          const clean: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(spin)) {
            if (v !== undefined) clean[k] = v;
          }
          cleanSpins[hn] = clean;
        }
        batch.set(ref, {
          teamName: t.teamName,
          players: t.players,
          scores: scoresToMap(t.scores),
          netScore: t.netScore,
          holesPlayed: t.holesPlayed,
          currentTee: t.currentTee,
          frontNineConfirmed: t.frontNineConfirmed,
          wheelSpins: cleanSpins,
          wheelAdjustment: t.wheelAdjustment,
          targetedBy: t.targetedBy,
          isDemo: true,
          lastUpdated: Timestamp.fromDate(new Date(t._lastUpdatedMs)),
        });
      }
      await batch.commit();

      // Seed recent birdie/eagle events to populate the live ticker
      // Pick up to 6 teams that scored at least one birdie/eagle
      interface BirdieEvent { teamName: string; hole: number; score: number; par: number; subtype: string; tsMs: number }
      const recentEvents: BirdieEvent[] = [];
      for (const t of demoTeams) {
        for (let h = Math.max(0, t.holesPlayed - 3); h < t.holesPlayed; h++) {
          const s = t.scores[h];
          const par = holes[h].par;
          if (s === null) continue;
          const diff = s - par;
          if (diff <= -1) {
            // Timestamp: as if they played this hole relative to their lastUpdated
            const holeAgo = (t.holesPlayed - 1 - h) * 9 * 60 * 1000;
            recentEvents.push({
              teamName: t.teamName,
              hole: h + 1,
              score: s,
              par,
              subtype: diff <= -2 ? 'eagle' : 'birdie',
              tsMs: t._lastUpdatedMs - holeAgo,
            });
          }
        }
      }
      // Sort newest-first, keep at most 8
      recentEvents.sort((a, b) => b.tsMs - a.tsMs);
      const toSeed = recentEvents.slice(0, 8);
      await Promise.all(toSeed.map(ev =>
        addDoc(eventsCol(fdb), {
          type: 'score',
          subtype: ev.subtype,
          teamName: ev.teamName,
          hole: ev.hole,
          score: ev.score,
          par: ev.par,
          isDemo: true,
          timestamp: Timestamp.fromDate(new Date(ev.tsMs)),
        })
      ));

      toast({
        title: `Seeded ${n} demo teams`,
        description: `Teams spread across the course. ${toSeed.length} recent events added to the ticker.`,
      });
    } catch (e) {
      console.error(e);
      toast({ title: 'Seed failed', description: String(e), variant: 'destructive' });
    } finally {
      setSeeding(false);
    }
  };

  // ── Live simulation: every tick, advance one random unfinished demo team ──
  // by a single hole. This drives leaderboard reshuffles so the position
  // arrows actually fire during a demo (otherwise demo teams are static and
  // no movement = no arrows).
  const simulationTick = useCallback(async () => {
    if (!db || !getActiveTournamentId() || !runningRef.current) return;
    const now = Date.now();
    try {
      const fdb = db;
      const snap = await getDocs(query(teamsCol(fdb), where('isDemo', '==', true)));
      const demoDocs = snap.docs;
      if (demoDocs.length === 0) return;

      // Seed any not-yet-scheduled bot with a staggered first-hole time (0-12s)
      // so the simulation ramps up instead of dumping every team's write at once.
      for (const d of demoDocs) {
        if (nextAdvanceRef.current[d.id] === undefined) {
          nextAdvanceRef.current[d.id] = now + Math.random() * 12000;
        }
      }

      // ── Score progression: each bot completes a hole every 8-15s ──────────
      const due = demoDocs.filter(d => {
        const hp = d.data().holesPlayed;
        if (typeof hp !== 'number' || hp >= 18) return false;
        return now >= (nextAdvanceRef.current[d.id] ?? 0);
      });

      for (const d of due) {
        if (!runningRef.current) return; // sim was stopped mid-flight
        // Schedule this bot's next hole 8-15s out (staggered, realistic cadence).
        nextAdvanceRef.current[d.id] = now + 8000 + Math.random() * 7000;
        const data = d.data();
        const scores = normalizeScores(data.scores);
        const hp: number = data.holesPlayed;
        const nextHole = hp; // 0-indexed
        if (nextHole >= 18) continue;
        const par = holes[nextHole].par;
        const newScore = demoHoleScore(par);
        scores[nextHole] = newScore;
        const newHp = hp + 1;
        // Recompute netScore = strokes - par for all played holes, plus existing wheelAdjustment
        const playedPar = holes.slice(0, newHp).reduce((s, h) => s + h.par, 0);
        const playedScore = scores.slice(0, newHp).reduce<number>((s, v) => s + (v ?? 0), 0);
        const wheelAdj = typeof data.wheelAdjustment === 'number' ? data.wheelAdjustment : 0;
        const newNet = playedScore - playedPar + wheelAdj;
        const currentTee = newNet < 0 ? 'tips' : 'womens';

        await updateDoc(d.ref, {
          scores: scoresToMap(scores),
          holesPlayed: newHp,
          netScore: newNet,
          currentTee,
          lastUpdated: Timestamp.now(),
        });

        const diff = newScore - par;
        if (diff <= -1) {
          await addDoc(eventsCol(fdb), {
            type: 'score',
            subtype: diff <= -2 ? 'eagle' : 'birdie',
            teamName: data.teamName,
            hole: nextHole + 1,
            score: newScore,
            par,
            isDemo: true,
            timestamp: Timestamp.now(),
          });
        }
        if (newHp === 18) {
          await addDoc(eventsCol(fdb), {
            type: 'finish',
            teamName: data.teamName,
            netScore: newNet,
            isDemo: true,
            timestamp: Timestamp.now(),
          });
        }
      }

      // Helper: build roast params from a demo team doc.
      const roastFor = (data: Record<string, unknown>) => pickRoast({
        teamName: (data.teamName as string) ?? 'A team',
        players: Array.isArray(data.players) ? (data.players as string[]) : [],
        netScore: typeof data.netScore === 'number' ? data.netScore : 0,
        holesPlayed: typeof data.holesPlayed === 'number' ? data.holesPlayed : 0,
        holeNum: 1,
        score: null,
        par: 4,
        msgIndex: chatIdxRef.current++,
      });

      // ── Lobby (Trash Talk Lounge): team-to-team text only, no Whacky ───────
      if (runningRef.current && now >= nextLobbyChatRef.current) {
        nextLobbyChatRef.current = now + 7000 + Math.random() * 8000;
        const bot = pick(demoDocs);
        const bd = bot.data();
        // A team either fires a roast line or drops a funny one-liner.
        const text = Math.random() < 0.45 ? roastFor(bd).text : pick(DEMO_CHATTER);
        await addDoc(chatCol(fdb), {
          fromTeamId: bot.id,
          fromTeamName: (bd.teamName as string) ?? 'A team',
          text,
          toTeamId: null,
          channel: 'general',
          ts: serverTimestamp(),
          isWhacky: false,
          isDemo: true,
        });
      }

      // ── DM to the host every ~12-25s (these trigger pop-up banners) ───────
      // All DMs come from rival teams — Whacky never DMs anyone.
      if (runningRef.current && teamId && now >= nextDmChatRef.current) {
        nextDmChatRef.current = now + 12000 + Math.random() * 13000;
        const bot = pick(demoDocs);
        const bd = bot.data();
        const text = Math.random() < 0.5 ? pick(DEMO_DM_LINES) : roastFor(bd).text;
        await addDoc(chatCol(fdb), {
          fromTeamId: bot.id,
          fromTeamName: (bd.teamName as string) ?? 'A team',
          toTeamId: teamId,
          text,
          channel: dmChannelId(bot.id, teamId),
          ts: serverTimestamp(),
          isWhacky: false,
          isDemo: true,
        });
      }
    } catch (e) {
      console.error('sim tick failed', e);
    }
  }, [holes, teamId]);

  // Delete every demo artifact: teams, ticker events, and chat messages.
  const clearAllDemo = useCallback(async (): Promise<number> => {
    if (!db) return 0;
    const fdb = db;
    const [teamsSnap, evSnap, chatSnap] = await Promise.all([
      getDocs(query(teamsCol(fdb), where('isDemo', '==', true))),
      getDocs(query(eventsCol(fdb), where('isDemo', '==', true))),
      getDocs(query(chatCol(fdb), where('isDemo', '==', true))),
    ]);
    const allDocs = [...teamsSnap.docs, ...evSnap.docs, ...chatSnap.docs];
    // Chunk into batches of 450 (Firestore caps batches at 500 ops).
    for (let i = 0; i < allDocs.length; i += 450) {
      const batch = writeBatch(fdb);
      allDocs.slice(i, i + 450).forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
    return teamsSnap.size;
  }, []);

  // Auto-timeout: stop the sim, wipe demo data, and warn the host.
  const timeoutDemo = useCallback(async () => {
    runningRef.current = false; // hard-stop any in-flight tick immediately
    setSimulating(false);
    try {
      await clearAllDemo();
    } catch (e) {
      console.error('demo timeout cleanup failed', e);
    }
    toast({
      title: 'Demo Mode has timed out for safety.',
      description: 'Demo teams, scores, and messages were cleared automatically.',
    });
  }, [clearAllDemo, toast]);

  // Keep callback refs current so the interval always calls the latest closures.
  useEffect(() => { simTickRef.current = simulationTick; }, [simulationTick]);
  useEffect(() => { timeoutDemoRef.current = timeoutDemo; }, [timeoutDemo]);

  // Start/stop the simulation + 5-minute safety countdown.
  useEffect(() => {
    if (!simulating) {
      runningRef.current = false;
      if (simTimer.current) { clearInterval(simTimer.current); simTimer.current = null; }
      if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
      return;
    }
    // Fresh run: reset schedules and the 5-minute clock.
    runningRef.current = true;
    demoStartRef.current = Date.now();
    nextAdvanceRef.current = {};
    nextLobbyChatRef.current = Date.now() + 4000;   // first lounge post ~4s in
    nextDmChatRef.current = Date.now() + 10000;      // first DM ~10s in
    setDemoSecondsLeft(DEMO_MAX_SECONDS);

    simTickRef.current();
    simTimer.current = setInterval(() => simTickRef.current(), SIM_TICK_MS);
    countdownRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - (demoStartRef.current ?? Date.now())) / 1000);
      const left = Math.max(0, DEMO_MAX_SECONDS - elapsed);
      setDemoSecondsLeft(left);
      if (left <= 0) {
        if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
        timeoutDemoRef.current();
      }
    }, 1000);

    return () => {
      runningRef.current = false;
      if (simTimer.current) { clearInterval(simTimer.current); simTimer.current = null; }
      if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    };
  }, [simulating]);

  // Stop simulation if we navigate away from admin
  useEffect(() => () => {
    runningRef.current = false;
    if (simTimer.current) clearInterval(simTimer.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  const handleClearDemo = async () => {
    if (!db || !getActiveTournamentId()) return;
    try {
      const cleared = await clearAllDemo();
      toast({
        title: cleared > 0 ? `Cleared ${cleared} demo teams` : 'No demo teams to clear',
        description: cleared > 0 ? 'Demo scores, events, and messages also removed.' : undefined,
      });
    } catch (e) {
      toast({ title: 'Clear failed', description: String(e), variant: 'destructive' });
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Wipe ALL teams (real AND demo), scores, wheel spins, and the leaderboard? This cannot be undone.')) return;
    try {
      const fdb = db;
      if (fdb && getActiveTournamentId()) {
        const wipeCol = async (col: ReturnType<typeof teamsCol>) => {
          const snap = await getDocs(col);
          if (snap.empty) return;
          // Firestore batches cap at 500 ops; chunk so large collections
          // (e.g. a busy live events feed) are still fully wiped.
          for (let i = 0; i < snap.docs.length; i += 500) {
            const batch = writeBatch(fdb);
            snap.docs.slice(i, i + 500).forEach(d => batch.delete(d.ref));
            await batch.commit();
          }
        };
        await Promise.all([
          wipeCol(teamsCol(fdb)),
          wipeCol(eventsCol(fdb)),
          wipeCol(drivesCol(fdb)),
        ]);
        // Clear the finished/locked state so the tournament behaves like a
        // brand-new one when it is re-entered (the WFC preset reuses the same
        // deterministic doc, so leftover 'final' status would otherwise persist).
        const tId = getActiveTournamentId();
        if (tId) await setDoc(tournamentDoc(fdb, tId), { status: 'live', scoringLocked: false }, { merge: true });
        await setDoc(configDoc(fdb), { resetAt: serverTimestamp() }, { merge: true });
      }
      localStorage.clear();
      toast({ title: 'Tournament reset', description: 'Reloading…' });
      setTimeout(() => window.location.href = '/', 600);
    } catch (e) {
      console.error(e);
      toast({ title: 'Reset failed', description: String(e), variant: 'destructive' });
    }
  };

  if (!auth) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background p-4">
        <form onSubmit={handleLogin} className="w-full max-w-sm bg-card p-8 rounded-xl border border-border space-y-6">
          <div className="flex items-center justify-center gap-2">
            <Lock className="w-6 h-6 text-primary" />
            <h2 className="font-condensed text-3xl font-black uppercase text-center">
              Admin <span className="text-primary">Access</span>
            </h2>
          </div>
          <Input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            className="h-12 bg-input"
            autoFocus
            data-testid="input-admin-password"
          />
          <Button
            type="submit"
            className="w-full h-12 font-condensed text-xl tracking-widest font-bold"
            data-testid="button-admin-login"
          >
            LOGIN
          </Button>
        </form>
      </div>
    );
  }

  const realTeams = teams.filter(t => !t.isDemo);
  const demoTeams = teams.filter(t => t.isDemo);

  return (
    <div className="min-h-[100dvh] bg-background p-4 pb-24">
      <div className="max-w-md mx-auto space-y-6">
        <h2 className="font-condensed text-3xl font-black uppercase mt-8">
          Tournament <span className="text-primary">Control</span>
        </h2>

        {/* ── Status Strip ── */}
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-3 flex-wrap">
            {isFinal ? (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-muted-foreground text-[11px] font-black uppercase tracking-widest shrink-0">
                <Trophy className="w-3 h-3" /> Final
              </span>
            ) : scoringLocked ? (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-950/60 text-amber-400 border border-amber-700/50 text-[11px] font-black uppercase tracking-widest shrink-0">
                <Lock className="w-3 h-3" /> Locked
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/15 text-primary border border-primary/30 text-[11px] font-black uppercase tracking-widest shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse inline-block" /> Live
              </span>
            )}
            {joinCode ? (
              <span className="font-condensed text-base font-black tracking-widest text-foreground/80 leading-none shrink-0">{joinCode}</span>
            ) : (
              <span className="text-[11px] text-muted-foreground/50 shrink-0">No join code</span>
            )}
            <span className="text-[11px] text-muted-foreground/60 leading-none shrink-0">
              {realTeams.length} {realTeams.length === 1 ? 'team' : 'teams'}
            </span>
            <div className="flex-1" />
            {!isFinal && (
              <Button
                type="button"
                size="sm"
                variant={scoringLocked ? 'default' : 'outline'}
                className="h-8 px-3 text-[11px] font-condensed font-black uppercase tracking-widest shrink-0"
                onClick={() => handleToggleScoringLock(!scoringLocked)}
                disabled={lockBusy}
                data-testid="button-toggle-scoring-lock"
              >
                {scoringLocked
                  ? <><LockOpen className="w-3 h-3 mr-1" /> Unlock</>
                  : <><Lock className="w-3 h-3 mr-1" /> Lock</>}
              </Button>
            )}
          </div>
          {scoringLocked && !isFinal && (
            <p className="text-[11px] text-amber-400/80 mt-2 leading-relaxed">
              Scoring is paused — teams can't enter scores or spin, but they stay on their own screens.
            </p>
          )}
        </div>

        {/* ── Player Join QR ── */}
        {joinCode ? (
          <div className="bg-card rounded-xl border border-primary/40 overflow-hidden" data-testid="card-join-qr">
            <div className="flex items-center gap-2 px-5 pt-5 pb-3">
              <Grid3x3 className="w-4 h-4 text-primary" />
              <h3 className="font-bold uppercase tracking-widest text-sm text-muted-foreground">Scan to Join</h3>
            </div>
            <div className="flex flex-col items-center gap-3 px-5 pb-5">
              {qr ? (
                <div className="bg-[#0a0a0a] border border-primary/30 rounded-2xl p-3">
                  <img src={qr} alt="Join QR code" className="w-52 h-52" data-testid="img-join-qr" />
                </div>
              ) : (
                <div className="w-52 h-52 bg-[#0a0a0a] border border-primary/30 rounded-2xl flex items-center justify-center">
                  <span className="text-xs text-muted-foreground">Generating…</span>
                </div>
              )}
              <div className="text-center">
                <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Join code</p>
                <p className="font-condensed text-4xl font-black tracking-[0.3em]" data-testid="text-qr-join-code">{joinCode}</p>
              </div>
              <Button
                type="button"
                variant="secondary"
                className="w-full h-11 font-condensed font-bold uppercase tracking-widest text-xs"
                onClick={() => copy(joinLink, 'joinlink')}
                data-testid="button-copy-join-link-qr"
              >
                {copied === 'joinlink' ? <><Check className="w-3.5 h-3.5 mr-2" /> Copied</> : <><Copy className="w-3.5 h-3.5 mr-2" /> Copy join link</>}
              </Button>
            </div>
          </div>
        ) : null}

        {/* ── Share & Invite (QR always visible) ── */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Share2 className="w-4 h-4 text-primary" />
              <h3 className="font-bold uppercase tracking-widest text-sm text-muted-foreground">Share &amp; Invite</h3>
            </div>
            {!joinCode ? (
              <p className="text-xs text-muted-foreground">No join code — a live connection is required.</p>
            ) : (
              <>
                <div className="border-t border-border/50 pt-3">
                  <button
                    type="button"
                    className="w-full flex items-center justify-between text-left"
                    onClick={() => setPerTeamLinksOpen(v => !v)}
                    data-testid="button-toggle-share"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Per-team invite links</p>
                    {perTeamLinksOpen ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                  </button>
                  {perTeamLinksOpen && (
                    <div className="mt-3 space-y-2">
                      {realTeams.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No real teams registered yet.</p>
                      ) : (
                        realTeams.map(team => {
                          const link = inviteLink(team.teamCode ?? '');
                          return (
                            <div key={`invite-${team.id}`} className="flex items-center gap-3 bg-secondary/30 rounded-lg px-3 py-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-sm truncate leading-tight">{team.teamName}</p>
                                <p className="text-[11px] text-muted-foreground truncate">{team.teamCode ? `Code · ${team.teamCode}` : 'No team code yet'}</p>
                              </div>
                              <button
                                type="button"
                                disabled={!link}
                                onClick={() => copy(link, `invite-${team.id}`)}
                                className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-30"
                                data-testid={`button-copy-invite-${team.id}`}
                                title="Copy invite link"
                              >
                                {copied === `invite-${team.id}` ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Global Broadcast (collapsible) ── */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <button
            className="w-full flex items-center justify-between p-5 text-left"
            onClick={() => setBroadcastOpen(v => !v)}
            data-testid="button-toggle-broadcast"
          >
            <div className="flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-primary" />
              <h3 className="font-bold uppercase tracking-widest text-sm text-muted-foreground">Global Broadcast</h3>
            </div>
            {broadcastOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          {broadcastOpen && (
            <div className="border-t border-border p-5">
              <form onSubmit={handleBroadcast} className="space-y-4">
                <Input
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Message to all players..."
                  className="h-12 bg-input"
                  data-testid="input-broadcast-message"
                />
                <Button type="submit" className="w-full h-12" data-testid="button-send-broadcast">Send Broadcast</Button>
              </form>
            </div>
          )}
        </div>

        {/* ── Manage Teams ── */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4">
            <button
              className="flex items-center gap-2 flex-1 text-left"
              onClick={() => setTeamsOpen(v => !v)}
            >
              <Users className="w-4 h-4 text-primary" />
              <h3 className="font-bold uppercase tracking-widest text-sm text-muted-foreground">Manage Teams</h3>
            </button>
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-condensed text-lg font-black text-primary leading-none">
                {realTeams.length} real · {demoTeams.length} demo
              </span>
              <button
                type="button"
                onClick={openCreateTeam}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                title="Add team"
                data-testid="button-add-team-quick"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button className="p-1" onClick={() => setTeamsOpen(v => !v)}>
                {teamsOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>
            </div>
          </div>

          {teamsOpen && (
            <div className="border-t border-border">
              <div className="p-4 border-b border-border/50">
                <Button
                  size="sm"
                  onClick={openCreateTeam}
                  className="w-full text-xs uppercase tracking-widest font-bold"
                  data-testid="button-add-team"
                >
                  <Plus className="w-3 h-3 mr-2" /> Add Team
                </Button>
              </div>

              {teams.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6 px-5">No teams registered yet.</p>
              )}

              {realTeams.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary/60 px-5 py-2 border-b border-border/50">
                    Real Teams
                  </p>
                  {realTeams.map(team => (
                    <TeamRow
                      key={team.id}
                      team={team}
                      deleting={deletingId === team.id}
                      onDelete={() => handleDelete(team)}
                      onEdit={() => openEdit(team)}
                      onAdjust={() => openAdjust(team)}
                      onCorrect={() => openCorrect(team)}
                      onUnlock={() => handleUnlockScorecard(team)}
                    />
                  ))}
                </div>
              )}

              {demoTeams.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 px-5 py-2 border-t border-border/50">
                    Demo Teams ({demoTeams.length}) — use "Clear Demo Teams" below to remove
                  </p>
                </div>
              )}

              <div className="p-4 border-t border-border/50">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadTeams}
                  className="w-full text-xs uppercase tracking-widest font-bold border-border text-muted-foreground"
                >
                  <RefreshCw className="w-3 h-3 mr-2" />
                  Refresh List
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ── Score Audit ── */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <button
            className="w-full flex items-center justify-between p-5 text-left"
            onClick={() => setAuditOpen(v => !v)}
            data-testid="button-toggle-audit"
          >
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-primary" />
              <h3 className="font-bold uppercase tracking-widest text-sm text-muted-foreground">Score Audit</h3>
            </div>
            <div className="flex items-center gap-3">
              {(() => {
                const flagged = realTeams.filter(t => auditTeam(t, holes, holeRules).length > 0).length;
                return (
                  <span className={`font-condensed text-lg font-black leading-none ${flagged > 0 ? 'text-orange-400' : 'text-primary'}`}>
                    {flagged === 0 ? 'All Clear' : `${flagged} flagged`}
                  </span>
                );
              })()}
              {auditOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </div>
          </button>

          {auditOpen && (
            <div className="border-t border-border">
              <p className="text-[10px] text-muted-foreground/80 px-5 py-3 border-b border-border/40 leading-relaxed">
                Real teams only. Flags catch likely score-glitches: edits after submitting, suspiciously low net scores, eagles on par 3s, Item Box holes scored without a spin, etc. Tap a team for the breakdown.
              </p>
              {realTeams.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6 px-5">No real teams yet.</p>
              )}
              {realTeams.map(team => {
                const flags = auditTeam(team, holes, holeRules);
                const hasHigh = flags.some(f => f.severity === 'high');
                const expanded = auditExpandedId === team.id;
                const showSubmitTime = team.hasSubmitted && team.submittedAt
                  ? new Date(team.submittedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                  : null;
                return (
                  <div key={team.id} className="border-t border-border/30 first:border-t-0">
                    <button
                      onClick={() => setAuditExpandedId(prev => prev === team.id ? null : team.id)}
                      className="w-full flex items-center gap-3 px-5 py-3 text-left active:bg-secondary/40 transition-colors"
                      data-testid={`audit-team-${team.id}`}
                    >
                      <div className="shrink-0">
                        {flags.length === 0 ? (
                          <CheckCircle2 className="w-4 h-4 text-primary" />
                        ) : (
                          <AlertTriangle className={`w-4 h-4 ${hasHigh ? 'text-red-400' : 'text-orange-400'}`} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate leading-tight">{team.teamName}</p>
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {team.holesPlayed}/18 · Net {team.netScore > 0 ? `+${team.netScore}` : team.netScore === 0 ? 'E' : team.netScore}
                          {team.hasSubmitted ? ` · Submitted${showSubmitTime ? ` ${showSubmitTime}` : ''}` : ' · In progress'}
                        </p>
                      </div>
                      <span className={`font-condensed text-sm font-black shrink-0 ${flags.length === 0 ? 'text-primary' : hasHigh ? 'text-red-400' : 'text-orange-400'}`}>
                        {flags.length === 0 ? 'OK' : `${flags.length}`}
                      </span>
                      {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                    </button>

                    {expanded && (
                      <div className="px-5 pb-4 space-y-2">
                        {flags.length === 0 ? (
                          <p className="text-[11px] text-muted-foreground/80">No anomalies detected.</p>
                        ) : flags.map((f, i) => (
                          <div
                            key={i}
                            className={`rounded-lg p-3 border ${
                              f.severity === 'high'
                                ? 'bg-red-950/30 border-red-900/60'
                                : 'bg-orange-950/20 border-orange-900/50'
                            }`}
                          >
                            <p className={`text-[11px] font-black uppercase tracking-widest ${f.severity === 'high' ? 'text-red-400' : 'text-orange-400'}`}>
                              {f.label}
                            </p>
                            <p className="text-[11px] text-foreground/80 mt-1 leading-snug">{f.detail}</p>
                          </div>
                        ))}
                        <div className="bg-secondary/30 rounded-lg p-2 mt-2">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 px-1">
                            Hole-by-Hole
                          </p>
                          <div className="grid grid-cols-9 gap-0.5">
                            {Array.from({ length: 18 }).map((_, i) => {
                              const s = team.scores?.[i] ?? null;
                              const par = holes[i]?.par ?? 4;
                              const d = s !== null ? s - par : null;
                              let cls = 'text-muted-foreground/40 bg-background/40';
                              if (d !== null) {
                                if (d <= -2) cls = 'text-yellow-300 bg-yellow-900/40';
                                else if (d === -1) cls = 'text-primary bg-primary/15';
                                else if (d === 0) cls = 'text-foreground/80 bg-background/60';
                                else if (d === 1) cls = 'text-orange-300 bg-orange-900/20';
                                else cls = 'text-red-300 bg-red-900/30';
                              }
                              return (
                                <div
                                  key={i}
                                  className={`text-center py-1 rounded text-[10px] font-condensed font-black ${cls}`}
                                  title={`Hole ${i + 1} (par ${par})`}
                                >
                                  {s ?? '—'}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <div className="flex gap-2 text-[10px] text-muted-foreground/70 pt-1 px-1 flex-wrap">
                          <span>Spins: <span className="text-foreground/80">{Object.keys(team.wheelSpins ?? {}).length}</span></span>
                          <span>· Adj: <span className="text-foreground/80">{team.wheelAdjustment ?? 0}</span></span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Format & Rules (Start Format + Shotgun Assignments + Hole Rules merged) ── */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <button
            className="w-full flex items-center justify-between p-5 text-left"
            onClick={() => setFormatOpen(v => !v)}
            data-testid="button-toggle-format"
          >
            <div className="flex items-center gap-2">
              <Flag className="w-4 h-4 text-primary" />
              <h3 className="font-bold uppercase tracking-widest text-sm text-muted-foreground">Format &amp; Rules</h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-muted-foreground/60 leading-none">{isShotgun ? 'Shotgun' : 'Normal'}</span>
              {formatOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </div>
          </button>

          {formatOpen && (
            <div className="border-t border-border divide-y divide-border/50">
              {/* Start type */}
              <div className="p-5">
                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <div className="pr-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Shotgun start</p>
                    <p className="text-[11px] text-muted-foreground/80 leading-relaxed mt-1">
                      {isShotgun
                        ? 'Teams tee off on their assigned hole and wrap around all 18. Assign holes below.'
                        : 'All teams start on hole 1. Turn on to give each team its own starting hole.'}
                    </p>
                  </div>
                  <Switch
                    checked={isShotgun}
                    onCheckedChange={handleToggleStartType}
                    disabled={startTypeBusy}
                    data-testid="switch-admin-start-type"
                  />
                </label>
              </div>

              {/* Shotgun hole assignments */}
              {isShotgun && (
                <div className="p-5 space-y-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Hole Assignments</p>
                  <p className="text-xs text-muted-foreground">
                    Set the starting hole for each team. Players tee off there and wrap around all 18.
                  </p>
                  {teams.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No teams registered yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {teams.map(team => (
                        <div key={`shotgun-${team.id}`} className="flex items-center justify-between gap-3">
                          <span className="font-bold text-sm truncate flex-1">{team.teamName}</span>
                          <select
                            value={shotgunDraft[team.id] ?? 1}
                            onChange={e => setShotgunDraft(d => ({ ...d, [team.id]: Number(e.target.value) }))}
                            data-testid={`select-shotgun-hole-${team.id}`}
                            className="h-10 px-3 rounded-lg bg-input border border-border text-sm font-condensed font-bold"
                          >
                            {Array.from({ length: 18 }, (_, i) => i + 1).map(n => (
                              <option key={n} value={n}>Hole {n}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="secondary"
                      className="flex-1 h-11"
                      onClick={handleAutoAssignShotgun}
                      disabled={teams.length === 0}
                      data-testid="button-auto-assign-shotgun"
                    >
                      <RefreshCw className="w-4 h-4 mr-1" />
                      Auto-assign
                    </Button>
                    <Button
                      type="button"
                      className="flex-1 h-11"
                      onClick={handleSaveShotgun}
                      disabled={shotgunSaving || teams.length === 0}
                      data-testid="button-save-shotgun"
                    >
                      {shotgunSaving ? 'Saving…' : 'Save'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Hole Rules */}
              <div className="p-5 space-y-4">
                <button
                  type="button"
                  className="w-full flex items-center justify-between"
                  onClick={() => setRulesOpen(o => !o)}
                  data-testid="button-toggle-rules"
                >
                  <div className="flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-primary" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Hole Rules</p>
                  </div>
                  {rulesOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>
                {rulesOpen && (
                  <div className="space-y-4">
                    <RuleBuilder
                      holeRules={ruleDraft}
                      onHoleRulesChange={r => { setRuleDraft(r); setRulesDirty(true); }}
                      customRules={customDraft}
                      onCustomRulesChange={r => { setCustomDraft(r); setRulesDirty(true); }}
                    />
                    <Button
                      type="button"
                      className="w-full h-12"
                      onClick={handleSaveRules}
                      disabled={rulesSaving}
                      data-testid="button-save-rules"
                    >
                      {rulesSaving ? 'Saving…' : 'Save Hole Rules'}
                    </Button>
                  </div>
                )}
              </div>

              {/* Item Box Odds — only visible when at least one wheel hole is configured */}
              {(holeRules.some(r => r?.type === 'wheel') || ruleDraft.some(r => r?.type === 'wheel')) && (
                <div className="p-5 space-y-3 border-t border-border/50" data-testid="section-wheel-weights">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Item Box Odds</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
                    How often each item lands. Default is 1× for all except Lightning (½×). Changes take effect immediately.
                  </p>
                  <div className="space-y-1.5">
                    {WHEEL_ITEMS.map(item => {
                      const w = tournament?.wheelItemWeights?.[item.id] ?? DEFAULT_WHEEL_WEIGHTS[item.id];
                      return (
                        <div key={item.id} className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: item.color }} />
                            <span className="text-[11px] font-medium text-foreground/80 truncate">{item.label}</span>
                          </div>
                          <select
                            value={String(w)}
                            onChange={e => handleSetWheelWeight(item.id, Number(e.target.value))}
                            disabled={wheelWeightsBusy}
                            data-testid={`select-wheel-weight-${item.id}`}
                            className="h-8 px-2 rounded-lg bg-input border border-border text-[11px] font-condensed font-bold shrink-0"
                          >
                            <option value="0">Off</option>
                            <option value="0.5">½×</option>
                            <option value="1">1×</option>
                            <option value="2">2×</option>
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Registration Settings ── */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <button
            className="w-full flex items-center justify-between p-5 text-left"
            onClick={() => setRegOpen(v => !v)}
            data-testid="button-toggle-registration"
          >
            <div className="flex items-center gap-2">
              <Grid3x3 className="w-4 h-4 text-primary" />
              <h3 className="font-bold uppercase tracking-widest text-sm text-muted-foreground">Registration</h3>
            </div>
            {regOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>

          {regOpen && (
            <div className="border-t border-border p-5 space-y-4">
              <label className="flex items-center justify-between gap-3 cursor-pointer">
                <div className="pr-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Require team code to join</p>
                  <p className="text-[11px] text-muted-foreground/80 leading-relaxed mt-1">
                    {(tournament?.requireTeamCode ?? true)
                      ? 'Players need the 4-character team code to rejoin an existing team.'
                      : 'Players can rejoin any team by tapping it — no code needed.'}
                  </p>
                </div>
                <Switch
                  checked={tournament?.requireTeamCode ?? true}
                  onCheckedChange={handleToggleRequireTeamCode}
                  disabled={codeBusy}
                  data-testid="switch-admin-require-team-code"
                />
              </label>

              <label className="flex items-center justify-between gap-3 pt-1 border-t border-border/50 cursor-pointer">
                <div className="pr-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Use team names</p>
                  <p className="text-[11px] text-muted-foreground/80 leading-relaxed mt-1">
                    {(tournament?.useTeamNames ?? true)
                      ? 'Each team enters its own name when registering.'
                      : "No team names — the players' names are used as the team name."}
                  </p>
                </div>
                <Switch
                  checked={tournament?.useTeamNames ?? true}
                  onCheckedChange={handleToggleUseTeamNames}
                  disabled={codeBusy}
                  data-testid="switch-admin-use-team-names"
                />
              </label>
            </div>
          )}
        </div>

        {/* ── Tournament Finale ── */}
        <div className="bg-card p-6 rounded-xl border border-border space-y-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-primary" />
            <h3 className="font-bold uppercase tracking-widest text-sm text-muted-foreground">Tournament Finale</h3>
          </div>
          {isFinal ? (
            <>
              <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
                Scoring is locked and all players see the Results podium. Reopen to return everyone to live scoring.
              </p>
              <div className="grid grid-cols-1 gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full h-12 font-condensed font-black uppercase tracking-widest"
                  onClick={() => navigate('/results')}
                  data-testid="button-view-results"
                >
                  <Trophy className="w-4 h-4 mr-2" /> View Results
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12 font-condensed font-black uppercase tracking-widest"
                  onClick={handleReopen}
                  disabled={finalizing}
                  data-testid="button-reopen-tournament"
                >
                  Reopen Scoring
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
                Finalizing locks all scoring across every device and shows the Results podium. You can reopen at any time.
              </p>
              <Button
                type="button"
                className="w-full h-12 font-condensed font-black uppercase tracking-widest"
                onClick={handleFinalize}
                disabled={finalizing}
                data-testid="button-finalize-tournament"
              >
                <Trophy className="w-4 h-4 mr-2" /> Finalize &amp; Crown Winners
              </Button>
            </>
          )}
        </div>

        {/* ── Security (renamed from Code Management) ── */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <button
            className="w-full flex items-center justify-between p-5 text-left"
            onClick={() => setSecurityOpen(v => !v)}
            data-testid="button-toggle-codes"
          >
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-primary" />
              <h3 className="font-bold uppercase tracking-widest text-sm text-muted-foreground">Security</h3>
            </div>
            {securityOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>

          {securityOpen && (
            <div className="border-t border-border p-5 space-y-5">
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Admin code</p>
                <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
                  Regenerating creates a new admin code. Anyone using the old code can no longer reach this panel — re-share the new code with co-hosts.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full h-11 font-condensed font-bold uppercase tracking-widest text-xs"
                  onClick={handleRegenAdminCode}
                  disabled={codeBusy}
                  data-testid="button-regen-admin-code"
                >
                  <KeyRound className="w-3.5 h-3.5 mr-2" /> Regenerate admin code
                </Button>
              </div>

              <div className="space-y-2 pt-1 border-t border-border/50">
                <p className="text-[10px] font-bold uppercase tracking-widest text-red-400">Host key</p>
                <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
                  Rotating the host key immediately signs out every other host device. This device stays in control. Only do this if a host link leaked.
                </p>
                <Button
                  type="button"
                  variant="destructive"
                  className="w-full h-11 font-condensed font-bold uppercase tracking-widest text-xs"
                  onClick={handleRotateHostKey}
                  disabled={codeBusy}
                  data-testid="button-rotate-host-key"
                >
                  <KeyRound className="w-3.5 h-3.5 mr-2" /> Rotate host key
                </Button>
                {newHostKey && (
                  <p className="text-[11px] text-primary leading-relaxed">
                    Host key rotated. This device remains the host. Other host devices must rejoin with a fresh invite.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Demo Mode (collapsible, de-emphasized) ── */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <button
            className="w-full flex items-center justify-between p-5 text-left"
            onClick={() => setDemoOpen(v => !v)}
            data-testid="button-toggle-demo"
          >
            <div className="flex items-center gap-2">
              <Beaker className="w-4 h-4 text-primary" />
              <h3 className="font-bold uppercase tracking-widest text-sm text-muted-foreground">Demo Mode</h3>
            </div>
            {demoOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>

          {demoOpen && (
            <div className="border-t border-border p-6 space-y-4">
              <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
                Seeds fake teams scattered randomly across the course. Live Simulation makes them play like real users — firing off wild scores, trash-talking the Lounge, and sliding into your DMs. Use this to walk the group through the leaderboard, wheel effects, chat, and live sync before tee-off.
              </p>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="demo-count" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Number of Teams
                  </label>
                  <span className="font-condensed text-2xl font-black text-primary leading-none">{demoCount}</span>
                </div>
                <input
                  id="demo-count"
                  type="range"
                  min={2}
                  max={30}
                  value={demoCount}
                  onChange={e => setDemoCount(Number(e.target.value))}
                  className="w-full accent-primary"
                  data-testid="slider-demo-count"
                />
                <div className="flex justify-between text-[9px] text-muted-foreground/60 uppercase tracking-widest">
                  <span>2</span><span>30</span>
                </div>
              </div>

              <Button
                onClick={handleSeedDemo}
                disabled={seeding}
                className="w-full h-12 font-condensed font-black uppercase tracking-widest"
                data-testid="button-seed-demo"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                {seeding ? 'Seeding…' : `Seed ${demoCount} Demo Teams`}
              </Button>

              {simulating ? (
                <div className="space-y-3" data-testid="demo-running-panel">
                  <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/40 rounded-lg p-3">
                    <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-yellow-200/90 leading-relaxed">
                      Demo Mode active — will auto-stop in 5 minutes to protect Firebase limits.
                    </p>
                  </div>

                  <div className="flex items-center justify-center gap-2 bg-black/40 border border-primary/30 rounded-lg py-3">
                    <Timer className="w-5 h-5 text-primary" />
                    <span
                      className="font-condensed text-3xl font-black text-primary leading-none tabular-nums"
                      data-testid="text-demo-countdown"
                    >
                      {Math.floor(demoSecondsLeft / 60)}:{String(demoSecondsLeft % 60).padStart(2, '0')}
                    </span>
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground/70">until auto-stop</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 uppercase tracking-widest justify-center">
                    <MessageSquare className="w-3 h-3 text-primary/70" />
                    Bots scoring + chatting live
                  </div>

                  <Button
                    onClick={() => setSimulating(false)}
                    className="w-full h-12 bg-red-500 text-white font-condensed font-black uppercase tracking-widest hover:bg-red-600"
                    data-testid="button-stop-demo"
                  >
                    <Pause className="w-4 h-4 mr-2" /> Stop Demo Now
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => setSimulating(true)}
                  variant="outline"
                  className="w-full h-10 text-xs uppercase tracking-widest font-bold border-primary/40 text-primary hover:bg-primary/10"
                  data-testid="button-simulate-live"
                >
                  <Play className="w-3 h-3 mr-2" /> Start Live Simulation
                </Button>
              )}

              <Button
                onClick={handleClearDemo}
                variant="outline"
                className="w-full h-10 text-xs uppercase tracking-widest font-bold border-border text-muted-foreground/80 hover:bg-secondary/50"
                data-testid="button-clear-demo"
              >
                Clear All Demo Data
              </Button>
            </div>
          )}
        </div>

        {/* ── Danger Zone ── */}
        <div className="bg-red-950/20 p-6 rounded-xl border border-red-900/50 space-y-4">
          <div className="flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-red-400" />
            <h3 className="font-bold uppercase tracking-widest text-sm text-red-500">Danger Zone</h3>
          </div>
          <Button
            variant="destructive"
            className="w-full h-12 font-condensed font-black uppercase tracking-widest"
            onClick={handleReset}
            data-testid="button-reset-tournament"
          >
            Reset Tournament
          </Button>
          <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
            Wipes ALL teams (real and demo), scores, wheel spins, and the leaderboard from Firestore, and clears any scoring lock or final state so the tournament is fresh and live. Every connected device will be reset to the home screen automatically. Use this to clean up after a test run before tournament day.
          </p>
        </div>
      </div>

      {/* ── Edit Team Modal ── */}
      {editingTeam && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setEditingTeam(null)}>
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-condensed text-xl font-black uppercase tracking-wider">Edit Team</h3>
              <button onClick={() => setEditingTeam(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {(tournament?.useTeamNames ?? true) && (
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Team Name</label>
                  <Input value={editName} onChange={e => setEditName(e.target.value)} className="h-11 bg-input" />
                </div>
              )}
              {editPlayers.map((p, i) => (
                <div key={i}>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Player {i + 1}</label>
                  <Input
                    value={p}
                    onChange={e => setEditPlayers(prev => prev.map((v, j) => (j === i ? e.target.value : v)))}
                    className="h-11 bg-input"
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 h-11" onClick={() => setEditingTeam(null)}>Cancel</Button>
              <Button className="flex-1 h-11 font-bold" onClick={handleSaveEdit} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Team Modal ── */}
      {addingTeam && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setAddingTeam(false)}>
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-condensed text-xl font-black uppercase tracking-wider">Add Team</h3>
              <button onClick={() => setAddingTeam(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {(tournament?.useTeamNames ?? true) && (
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Team Name</label>
                  <Input value={newTeamName} onChange={e => setNewTeamName(e.target.value)} className="h-11 bg-input" data-testid="input-new-team-name" />
                </div>
              )}
              {newTeamPlayers.map((p, i) => (
                <div key={i}>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Player {i + 1}</label>
                  <Input
                    value={p}
                    onChange={e => setNewTeamPlayers(prev => prev.map((v, j) => (j === i ? e.target.value : v)))}
                    className="h-11 bg-input"
                  />
                </div>
              ))}
              {isShotgun && (
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Starting Hole</label>
                  <select
                    value={newTeamHole}
                    onChange={e => setNewTeamHole(Number(e.target.value))}
                    data-testid="select-new-team-hole"
                    className="w-full h-11 px-3 rounded-lg bg-input border border-border text-sm font-condensed font-bold"
                  >
                    {Array.from({ length: 18 }, (_, i) => i + 1).map(n => (
                      <option key={n} value={n}>Hole {n}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 h-11" onClick={() => setAddingTeam(false)}>Cancel</Button>
              <Button className="flex-1 h-11 font-bold" onClick={handleCreateTeam} disabled={creating} data-testid="button-save-new-team">
                {creating ? 'Creating…' : 'Create'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Stroke Adjustment Modal ── */}
      {adjustingTeam && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setAdjustingTeam(null)}>
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm space-y-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-condensed text-xl font-black uppercase tracking-wider">Manual Adjustment</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{adjustingTeam.teamName}</p>
              </div>
              <button onClick={() => setAdjustingTeam(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
              Adds strokes directly to this team's net score (positive = penalty, negative = bonus). Use to correct scoring errors or apply rulings.
            </p>

            <div className="flex items-center justify-center gap-6">
              <button
                onClick={() => setAdjustDelta(d => d - 1)}
                className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/70 transition-colors"
              >
                <Minus className="w-6 h-6" />
              </button>
              <div className="text-center min-w-[80px]">
                <p className={`font-condensed text-5xl font-black leading-none ${adjustDelta > 0 ? 'text-orange-400' : adjustDelta < 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                  {adjustDelta > 0 ? `+${adjustDelta}` : adjustDelta === 0 ? '0' : adjustDelta}
                </p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">strokes</p>
              </div>
              <button
                onClick={() => setAdjustDelta(d => d + 1)}
                className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/70 transition-colors"
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>

            <div className="bg-secondary/40 rounded-lg px-4 py-2 text-center">
              <span className="text-xs text-muted-foreground">Net score: </span>
              <span className="font-bold text-sm">{adjustingTeam.netScore > 0 ? `+${adjustingTeam.netScore}` : adjustingTeam.netScore}</span>
              {adjustDelta !== 0 && (
                <>
                  <span className="text-muted-foreground mx-1.5">→</span>
                  <span className={`font-bold text-sm ${(adjustingTeam.netScore + adjustDelta) <= 0 ? 'text-primary' : 'text-orange-400'}`}>
                    {(adjustingTeam.netScore + adjustDelta) > 0 ? `+${adjustingTeam.netScore + adjustDelta}` : adjustingTeam.netScore + adjustDelta}
                  </span>
                </>
              )}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 h-11" onClick={() => setAdjustingTeam(null)}>Cancel</Button>
              <Button
                className="flex-1 h-11 font-bold"
                onClick={handleSaveAdjust}
                disabled={saving || adjustDelta === 0}
              >
                {saving ? 'Applying…' : 'Apply'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Score Correction Modal ── */}
      {correctingTeam && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setCorrectingTeam(null)}>
          <div
            className="bg-card border border-border rounded-t-2xl sm:rounded-xl w-full max-w-md max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
              <div>
                <h3 className="font-condensed text-xl font-black uppercase tracking-wider">Correct Scores</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{correctingTeam.teamName}</p>
              </div>
              <button onClick={() => setCorrectingTeam(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-5 space-y-2 flex-1">
              <p className="text-[11px] text-muted-foreground/80 leading-relaxed mb-2">
                Edit any hole's gross strokes. Leave a hole blank to mark it unplayed. Net score and holes played are recalculated on save.
              </p>
              {holes.map((hole, i) => {
                const val = correctDraft[i] ?? null;
                return (
                  <div key={`correct-${hole.hole}`} className="flex items-center gap-3 bg-secondary/30 rounded-lg px-3 py-2">
                    <div className="w-16 shrink-0">
                      <p className="font-condensed text-lg font-black leading-none">H{hole.hole}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Par {hole.par}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                      <button
                        onClick={() => setCorrectDraft(d => {
                          const next = [...d];
                          const cur = next[i] ?? hole.par;
                          next[i] = Math.max(1, cur - 1);
                          return next;
                        })}
                        className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/70 transition-colors"
                        aria-label={`Decrease hole ${hole.hole}`}
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <div className="w-12 text-center">
                        <span className={`font-condensed text-2xl font-black leading-none ${val == null ? 'text-muted-foreground/40' : 'text-foreground'}`}>
                          {val == null ? '—' : val}
                        </span>
                      </div>
                      <button
                        onClick={() => setCorrectDraft(d => {
                          const next = [...d];
                          const cur = next[i] ?? hole.par - 1;
                          next[i] = Math.min(20, cur + 1);
                          return next;
                        })}
                        className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/70 transition-colors"
                        aria-label={`Increase hole ${hole.hole}`}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setCorrectDraft(d => {
                          const next = [...d];
                          next[i] = null;
                          return next;
                        })}
                        disabled={val == null}
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-400 hover:bg-red-950/30 transition-colors disabled:opacity-30"
                        aria-label={`Clear hole ${hole.hole}`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {autoTeeRule && (
                <div className="bg-secondary/30 rounded-lg p-3 mt-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Flag className="w-3.5 h-3.5 text-primary" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Tee override</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
                    Auto-tee is on. Override forces this team's tee regardless of net score. "Auto" returns to the automatic rule.
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { key: null, label: 'Auto' },
                      { key: 'tips' as const, label: 'Tips' },
                      { key: 'womens' as const, label: "Women's" },
                    ]).map(opt => (
                      <button
                        key={opt.label}
                        onClick={() => setTeeDraft(opt.key)}
                        className={`h-10 rounded-lg font-condensed font-bold uppercase tracking-wide text-xs transition-colors ${
                          teeDraft === opt.key ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
                        }`}
                        data-testid={`button-tee-${opt.label.toLowerCase()}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 p-5 border-t border-border shrink-0">
              <Button variant="outline" className="flex-1 h-11" onClick={() => setCorrectingTeam(null)}>Cancel</Button>
              <Button
                className="flex-1 h-11 font-bold"
                onClick={handleSaveCorrection}
                disabled={correctSaving}
                data-testid="button-save-correction"
              >
                {correctSaving ? 'Saving…' : 'Save Scores'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface TeamRowProps {
  team: LiveTeam;
  deleting: boolean;
  onDelete: () => void;
  onEdit: () => void;
  onAdjust: () => void;
  onCorrect: () => void;
  onUnlock: () => void;
}

function TeamRow({ team, deleting, onDelete, onEdit, onAdjust, onCorrect, onUnlock }: TeamRowProps) {
  const net = team.netScore;
  const netLabel = net === 0 ? 'E' : net > 0 ? `+${net}` : String(net);
  const netColor = net < 0 ? 'text-primary' : net > 0 ? 'text-orange-400' : 'text-muted-foreground';

  return (
    <div className="flex items-center gap-3 px-5 py-3 border-t border-border/30 first:border-t-0">
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm truncate leading-tight">{team.teamName}</p>
        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
          {[teamSubtitle(team.teamName, team.players), `${team.holesPlayed}/18`].filter(Boolean).join(' · ')}
          {team.teeOverride ? ` · ${team.teeOverride === 'tips' ? 'Tips' : "Women's"} (set)` : ''}
        </p>
      </div>

      <span className={`font-condensed text-lg font-black leading-none shrink-0 ${netColor}`}>{netLabel}</span>

      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onCorrect}
          title="Correct scores"
          className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
        >
          <Grid3x3 className="w-4 h-4" />
        </button>
        <button
          onClick={onAdjust}
          title="Adjust strokes"
          className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
        {team.hasSubmitted && (
          <button
            onClick={onUnlock}
            title="Unlock scorecard"
            className="p-2 rounded-lg text-yellow-400 hover:text-yellow-300 hover:bg-yellow-950/30 transition-colors"
          >
            <LockOpen className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={onEdit}
          title="Edit team"
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={onDelete}
          disabled={deleting}
          title="Delete team"
          className="p-2 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-950/30 transition-colors disabled:opacity-40"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
