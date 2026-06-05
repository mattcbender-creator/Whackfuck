import {
  collection, doc, type Firestore,
  type CollectionReference, type DocumentReference,
} from 'firebase/firestore';
import { HOLES } from './holes';

// ── Course data ─────────────────────────────────────────────────────────────
// A tournament carries its own 18-hole course definition. Par is always
// required; yardages (tips/mid/womens) are optional and only surfaced when the
// tournament tracks them. ruleName/rule are placeholders edited by the rule
// builder task.
export interface CourseHole {
  hole: number;
  par: number;
  hdcp: number;
  tips: number;
  mid: number;
  womens: number;
  ruleName: string;
  rule: string;
}

// ── Hole rules ──────────────────────────────────────────────────────────────
// Each of the 18 holes carries a configurable rule. 'standard' is a plain WFC
// rule (name + text); 'wheel' is the special Mario Kart Item Box that fires a
// spin when the hole's score is entered; 'none' is an empty slot.
export type HoleRuleType = 'standard' | 'wheel' | 'none';

export interface HoleRule {
  type: HoleRuleType;
  ruleName: string;
  ruleText: string;
}

// A rule that can be assigned to a hole — built-in (derived from the Dundee
// course), the special wheel rule, or a host-authored custom rule.
export interface RuleLibraryEntry {
  id: string;
  type: HoleRuleType;
  ruleName: string;
  ruleText: string;
  builtIn: boolean;
}

// The wheel rule is a single well-known sentinel. Assigning it to a hole makes
// that hole auto-fire the Mario Kart Item Box wheel when its score is entered.
export const WHEEL_RULE_NAME = 'Mario Kart Item Box';
export const WHEEL_RULE_TEXT =
  'Entering your score on this hole triggers a spin of the Mario Kart Item Box. Whatever you land on applies immediately — to you or another team.';
export const WHEEL_RULE_ID = 'wheel';

export function wheelLibraryEntry(): RuleLibraryEntry {
  return { id: WHEEL_RULE_ID, type: 'wheel', ruleName: WHEEL_RULE_NAME, ruleText: WHEEL_RULE_TEXT, builtIn: true };
}

// Built-in rule library, derived from the Dundee course rule set (deduped by
// name). The wheel sentinel is always first.
export function buildRuleLibrary(): RuleLibraryEntry[] {
  const entries: RuleLibraryEntry[] = [wheelLibraryEntry()];
  const seen = new Set<string>();
  for (const h of HOLES) {
    if (!h.ruleName || seen.has(h.ruleName)) continue;
    seen.add(h.ruleName);
    entries.push({ id: `builtin::${h.ruleName}`, type: 'standard', ruleName: h.ruleName, ruleText: h.rule, builtIn: true });
  }
  return entries;
}

export const RULE_LIBRARY: RuleLibraryEntry[] = buildRuleLibrary();

// Derive an 18-slot rule set from a course's own ruleName/rule fields. No wheel
// is placed — a generic tournament starts with plain rules only.
export function holeRulesFromCourse(holes: CourseHole[]): HoleRule[] {
  return Array.from({ length: 18 }, (_, i) => {
    const h = holes[i];
    if (h?.ruleName) return { type: 'standard', ruleName: h.ruleName, ruleText: h.rule };
    return { type: 'none', ruleName: '', ruleText: '' };
  });
}

// WFC default rule set: the Dundee rules with the wheel on hole 9 (index 8),
// reproducing the existing June 27 experience exactly.
export function wfcDefaultHoleRules(): HoleRule[] {
  return HOLES.map((h, i) => {
    if (i === 8) return { type: 'wheel', ruleName: WHEEL_RULE_NAME, ruleText: WHEEL_RULE_TEXT };
    if (!h.ruleName) return { type: 'none', ruleName: '', ruleText: '' };
    return { type: 'standard', ruleName: h.ruleName, ruleText: h.rule };
  });
}

// Resolve the effective 18 hole rules for a tournament. Falls back to the
// course's own rule fields per-hole when the tournament has no configured
// holeRules (legacy docs created before the rule builder existed).
export function resolveHoleRules(
  configured: HoleRule[] | undefined | null,
  courseHoles: CourseHole[],
): HoleRule[] {
  const hasConfig = Array.isArray(configured) && configured.length === 18;
  return Array.from({ length: 18 }, (_, i) => {
    const c = hasConfig ? configured![i] : undefined;
    if (c && c.type) return c;
    const h = courseHoles[i];
    if (h?.ruleName) return { type: 'standard', ruleName: h.ruleName, ruleText: h.rule };
    return { type: 'none', ruleName: '', ruleText: '' };
  });
}

export type StartType = 'normal' | 'shotgun';
export type TournamentStatus = 'setup' | 'live' | 'final';

export interface TournamentConfig {
  id: string;
  name: string;
  courseName: string;
  holes: CourseHole[];
  trackYardages: boolean;
  teamSize: number; // 1–4 name fields per team
  startType: StartType;
  autoTeeRule: boolean; // WFC under-par → Tips mechanic
  adminCode: string;
  hostKey: string;
  joinCode: string;
  holeRules: HoleRule[]; // 18 configurable rule slots, edited by the rule builder
  customRules?: RuleLibraryEntry[]; // host-authored rules available in the builder
  status: TournamentStatus;
  createdAt: number;
  // Shotgun-format only: maps a team id to its starting hole (1–18). Absent /
  // empty for normal-start tournaments. Set by the host in the admin panel.
  shotgunAssignments?: Record<string, number>;
}

// ── Code / id generators ────────────────────────────────────────────────────
// Ambiguity-free alphabet: no 0/O, 1/I/L to keep codes easy to read aloud and
// type on a phone.
const SAFE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomCode(len: number): string {
  let out = '';
  const arr = new Uint32Array(len);
  try {
    crypto.getRandomValues(arr);
    for (let i = 0; i < len; i++) out += SAFE_ALPHABET[arr[i] % SAFE_ALPHABET.length];
  } catch {
    for (let i = 0; i < len; i++) out += SAFE_ALPHABET[Math.floor(Math.random() * SAFE_ALPHABET.length)];
  }
  return out;
}

export function generateJoinCode(): string {
  return randomCode(6);
}

export function generateAdminCode(): string {
  return randomCode(6);
}

export function generateTeamCode(): string {
  return randomCode(4);
}

export function generateHostKey(): string {
  // 4 groups of 4 — long enough to be unguessable, formatted to screenshot.
  return [randomCode(4), randomCode(4), randomCode(4), randomCode(4)].join('-');
}

export function generateTournamentId(): string {
  try {
    if (crypto.randomUUID) return `t_${crypto.randomUUID()}`;
  } catch { /* ignore */ }
  return `t_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ── Dundee CC defaults ──────────────────────────────────────────────────────
export function dundeeCourseDefaults(): CourseHole[] {
  return HOLES.map(h => ({
    hole: h.hole,
    par: h.par,
    hdcp: h.hdcp,
    tips: h.tips,
    mid: h.mid,
    womens: h.womens,
    ruleName: h.ruleName,
    rule: h.rule,
  }));
}

// A blank 18-hole course (par 4 placeholder) for hosts entering their own.
export function blankCourse(): CourseHole[] {
  return Array.from({ length: 18 }, (_, i) => ({
    hole: i + 1,
    par: 4,
    hdcp: i + 1,
    tips: 0,
    mid: 0,
    womens: 0,
    ruleName: '',
    rule: '',
  }));
}

// A course "tracks yardages" when any hole carries a non-zero distance. This
// lets a par-only course render cleanly without relying on a manual toggle.
export function tracksYardages(holes: CourseHole[]): boolean {
  return holes.some(h => (h.tips ?? 0) > 0 || (h.mid ?? 0) > 0 || (h.womens ?? 0) > 0);
}

// The clean-slate setup applied when the WFC preset is OFF: blank holes (par
// placeholder, no yardages, no rules) and empty/default settings.
export interface TournamentSetupDefaults {
  name: string;
  courseName: string;
  teamSize: number;
  startType: StartType;
  autoTeeRule: boolean;
  adminCode: string;
  holes: CourseHole[];
  holeRules: HoleRule[];
  customRules: RuleLibraryEntry[];
}

export function blankTournamentSetup(): TournamentSetupDefaults {
  const holes = blankCourse();
  return {
    name: '',
    courseName: '',
    teamSize: 2,
    startType: 'normal',
    autoTeeRule: false,
    adminCode: '',
    holes,
    holeRules: holeRulesFromCourse(holes),
    customRules: [],
  };
}

// ── Shotgun play order & in-order scoring lock ──────────────────────────────
// A tournament starts either "normal" (everyone tees off hole 1) or "shotgun"
// (each team begins on its own assigned hole and wraps around all 18). Play
// order is the sequence of hole numbers a team plays. A normal start, and any
// shotgun team without an assignment (startingHole 1), reduce to [1..18].
export function playOrder(startingHole: number): number[] {
  const s = startingHole >= 1 && startingHole <= 18 ? Math.floor(startingHole) : 1;
  return Array.from({ length: 18 }, (_, i) => ((s - 1 + i) % 18) + 1);
}

// Position (0–17) of the first hole still unscored in play order; 18 when every
// hole has a score.
export function firstUnscoredPlayPos(order: number[], scores: (number | null)[]): number {
  const p = order.findIndex(n => scores[n - 1] == null);
  return p === -1 ? 18 : p;
}

// Whether entering a score for hole `holeIdx` (0–17) would be out of play order.
// The strict in-order lock only applies to a NORMAL start. A shotgun start is
// inherently non-linear — teams begin on different holes, and unassigned teams
// (and the host, who never joins as a team) fall back to hole 1 — so enforcing
// order there traps players on a blocked hole they can't score. Relaxing it for
// shotgun lets every team score and navigate freely; normal start is unchanged.
export function isHoleOutOfOrder(params: {
  holeIdx: number;
  order: number[];
  scores: (number | null)[];
  isShotgun: boolean;
}): boolean {
  if (params.isShotgun) return false;
  const pos = params.order.indexOf(params.holeIdx + 1);
  if (pos < 0) return false;
  return pos > firstUnscoredPlayPos(params.order, params.scores);
}

// ── WFC 2026 seed ───────────────────────────────────────────────────────────
// Fixed identifiers so the existing June 27 event resolves to a stable
// tournament regardless of which device seeds it.
export const WFC_2026_ID = 'wfc-2026';
export const WFC_2026_JOIN_CODE = 'WFCDUN';
export const WFC_2026_HOST_KEY = 'WFC2-026H-OST0-KEY9';

export function buildWfc2026Config(): TournamentConfig {
  return {
    id: WFC_2026_ID,
    name: 'Whack Fuck Cup 2026',
    courseName: 'Dundee Country Club',
    holes: dundeeCourseDefaults(),
    trackYardages: true,
    teamSize: 2,
    startType: 'normal',
    autoTeeRule: true,
    adminCode: 'dundee2025',
    hostKey: WFC_2026_HOST_KEY,
    joinCode: WFC_2026_JOIN_CODE,
    holeRules: wfcDefaultHoleRules(),
    customRules: [],
    status: 'live',
    createdAt: Date.now(),
  };
}

// ── Player display ──────────────────────────────────────────────────────────
export function formatPlayers(players: string[] | undefined | null): string {
  const list = (players ?? []).map(p => p.trim()).filter(Boolean);
  if (list.length === 0) return '';
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} & ${list[1]}`;
  return `${list.slice(0, -1).join(', ')} & ${list[list.length - 1]}`;
}

// ── Score map <-> array ─────────────────────────────────────────────────────
// Scores are stored in Firestore as a map keyed by hole number ("1".."18") so
// concurrent per-hole writes from multiple teammates merge without clobbering.
// Local state keeps an 18-length array. These helpers convert between the two
// and tolerate the legacy array shape so old docs/demo data still read.
export function normalizeScores(raw: unknown): (number | null)[] {
  const out: (number | null)[] = Array(18).fill(null);
  if (Array.isArray(raw)) {
    for (let i = 0; i < 18; i++) {
      const v = raw[i];
      out[i] = typeof v === 'number' ? v : null;
    }
    return out;
  }
  if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const idx = parseInt(k, 10) - 1;
      if (idx >= 0 && idx < 18 && typeof v === 'number') out[idx] = v;
    }
  }
  return out;
}

export function scoresToMap(arr: (number | null)[]): Record<string, number> {
  const map: Record<string, number> = {};
  arr.forEach((v, i) => {
    if (typeof v === 'number') map[String(i + 1)] = v;
  });
  return map;
}

// ── Firestore path builders ─────────────────────────────────────────────────
// Spec-required string builders.
export function teamsPath(tId: string): string[] {
  return ['tournaments', tId, 'teams'];
}
export function eventsPath(tId: string): string[] {
  return ['tournaments', tId, 'events'];
}
export function configPath(tId: string): string[] {
  return ['tournaments', tId, 'config'];
}
export function tournamentDocPath(tId: string): string[] {
  return ['tournaments', tId];
}

// ── Active-tournament module global ──────────────────────────────────────────
// One tournament is active per page load. We keep its id in a module global so
// the many scattered Firestore call sites can build scoped refs without
// threading the id through every function. TournamentProvider keeps this in
// sync with localStorage; the global is read synchronously at module load.
const ACTIVE_KEY = 'wfc-active-tournament';

function readActiveId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

let _activeId: string | null = readActiveId();

export function getActiveTournamentId(): string | null {
  return _activeId;
}

export function setActiveTournamentId(id: string | null): void {
  _activeId = id;
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  } catch { /* ignore */ }
}

export function hasActiveTournament(): boolean {
  return !!_activeId;
}

// ── Scoped Firestore ref helpers ────────────────────────────────────────────
// Callers must guard with hasActiveTournament()/isFirebaseConfigured before
// using these for writes. A null active id falls back to a sentinel collection
// so accidental reads return empty rather than throwing.
function activeOrSentinel(): string {
  return _activeId ?? '__no_tournament__';
}

export function teamsCol(db: Firestore): CollectionReference {
  return collection(db, 'tournaments', activeOrSentinel(), 'teams');
}
export function teamDoc(db: Firestore, teamId: string): DocumentReference {
  return doc(db, 'tournaments', activeOrSentinel(), 'teams', teamId);
}
export function eventsCol(db: Firestore): CollectionReference {
  return collection(db, 'tournaments', activeOrSentinel(), 'events');
}
export function configDoc(db: Firestore): DocumentReference {
  return doc(db, 'tournaments', activeOrSentinel(), 'config', 'tournament');
}
export function drivesCol(db: Firestore): CollectionReference {
  return collection(db, 'tournaments', activeOrSentinel(), 'longestDrives');
}
export function tournamentDoc(db: Firestore, tId: string): DocumentReference {
  return doc(db, 'tournaments', tId);
}

// ── Per-tournament localStorage key helpers ─────────────────────────────────
// Team identity + game state are scoped per tournament so one device can hold
// state for several tournaments and switching between them stays clean.
export function storeKey(tId: string | null): string {
  return tId ? `wfc-state::${tId}` : 'wfc-state';
}
export function teamIdKey(tId: string | null): string {
  return tId ? `wfc-team-id::${tId}` : 'wfc-team-id';
}
export function joinedAtKey(tId: string | null): string {
  return tId ? `wfc-joined-at::${tId}` : 'wfc-joined-at';
}
export function serverConfirmedKey(tId: string | null): string {
  return tId ? `wfc-server-confirmed::${tId}` : 'wfc-server-confirmed';
}
export function hostKeyKey(tId: string): string {
  return `wfc-host-key::${tId}`;
}
// Cached starting hole for the current team, so a shotgun player keeps the
// right wrap-around order while offline before the tournament doc loads.
export function startingHoleKey(tId: string | null): string {
  return tId ? `wfc-starting-hole::${tId}` : 'wfc-starting-hole';
}
export function spectatorKey(tId: string): string {
  return `wfc-spectator::${tId}`;
}
