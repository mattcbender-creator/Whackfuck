import { useState, useEffect, useRef } from 'react';
import { X, Sparkles, Crown, Target, Zap, Ban, Ghost, Star, Shell, ChevronRight } from 'lucide-react';
import { useWFC, TeamSnapshot } from '@/lib/store';
import {
  WHEEL_ITEMS, WheelItem, WheelItemId,
  targetAngleForIndex, pickRandomIndex, getWheelItem,
} from '@/lib/wheel';
import { formatPlayers } from '@/lib/tournament';
import { useTournament } from '@/lib/tournamentContext';
import { fireBirdieConfetti, fireEagleConfetti } from '@/lib/confetti';

const wheelImg = `${import.meta.env.BASE_URL}wheel/mariokart-wheel.png`;

// 'resolving' = wheel stopped, item known, async effects in-flight
type Phase = 'intro' | 'spinning' | 'resolving' | 'picking' | 'applied';

interface Props {
  open: boolean;
  onClose: () => void;
  /** The hole this Item Box belongs to (1–18). Required to record/guard the spin. */
  hole: number | null;
}

function iconFor(id: WheelItemId) {
  switch (id) {
    case 'green_shell': return Shell;
    case 'red_shell':   return Shell;
    case 'blue_shell':  return Shell;
    case 'banana':      return Ban;
    case 'lightning':   return Zap;
    case 'mushroom':    return Sparkles;
    case 'super_star':  return Star;
    case 'boo':         return Ghost;
  }
}

export default function WheelModal({ open, onClose, hole }: Props) {
  const {
    teamId, teamInfo, netScore, wheelSpins,
    recordWheelSpin, applyEffectToOthers, applyEffectToSelf, listTeamsOnce,
    logEvent, hasSubmitted,
  } = useWFC();
  const { tournament } = useTournament();
  const isFinal = tournament?.status === 'final';
  const priorSpin = hole != null ? (wheelSpins[hole] ?? null) : null;

  const [phase, setPhase] = useState<Phase>('intro');
  const [angle, setAngle] = useState(0);
  const [landed, setLanded] = useState<WheelItem | null>(null);
  const [teams, setTeams] = useState<TeamSnapshot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const spinTimer = useRef<number | null>(null);
  const spinLockRef = useRef(false); // Guards against rapid double-taps of spin

  useEffect(() => {
    if (open) {
      // If this team already spun OR the round is submitted, re-opening the
      // modal MUST NOT allow another spin. Show whatever they got (or a
      // locked-out message) and let them dismiss.
      const existing = priorSpin ? WHEEL_ITEMS.find(w => w.id === priorSpin.item) ?? null : null;
      if (existing) {
        setPhase('applied');
        setLanded(existing);
        setAngle(0);
      } else if (hasSubmitted) {
        // Submitted with no spin on record — extremely unusual, but bail out
        // hard. Don't let the wheel render an 'intro' that could be tapped.
        setPhase('applied');
        setLanded(null);
        setAngle(0);
      } else {
        setPhase('intro');
        setAngle(0);
        setLanded(null);
      }
      setError(null);
      spinLockRef.current = false;
    }
    return () => {
      if (spinTimer.current) {
        window.clearTimeout(spinTimer.current);
        spinTimer.current = null;
      }
    };
  }, [open, priorSpin, hasSubmitted]);

  const otherTeams = teams.filter(t => t.id !== teamId);

  const handleSpin = async () => {
    if (phase !== 'intro') return;
    // Defense in depth: NEVER spin if the round was already submitted, OR if
    // the team has any existing spin on record. Either condition is a hard
    // stop — no recovery to 'intro' phase.
    if (hasSubmitted) {
      setError('Round submitted — wheel is locked.');
      return;
    }
    if (isFinal) {
      setError('Tournament finalized — wheel is locked.');
      return;
    }
    if (priorSpin) {
      setPhase('applied');
      const existing = WHEEL_ITEMS.find(w => w.id === priorSpin.item) ?? null;
      setLanded(existing);
      return;
    }
    // Rapid double-tap guard — React state isn't synchronous so two clicks in
    // the same tick could both pass the phase check.
    if (spinLockRef.current) return;
    spinLockRef.current = true;
    // Load teams snapshot synchronously so targeting uses fresh data
    // (don't rely on React state being updated by the time spin resolves).
    let snap: TeamSnapshot[] = [];
    try {
      snap = await listTeamsOnce();
      setTeams(snap);
    } catch (e) {
      console.error('Failed to load teams', e);
    }

    const idx = pickRandomIndex();
    const item = WHEEL_ITEMS[idx];
    const finalAngle = targetAngleForIndex(idx, 6);
    setAngle(finalAngle);
    setPhase('spinning');

    spinTimer.current = window.setTimeout(() => {
      spinTimer.current = null; // mark timer as consumed so cleanup is a no-op
      setLanded(item);
      if (item.selection === 'none') {
        setPhase('resolving'); // show item immediately; effects apply in background
        applyAutoEffect(item, snap); // fire-and-forget; always ends with setPhase('applied')
      } else {
        setPhase('picking');
      }
    }, 4200);
  };

  const recordSpinOnSelf = async (item: WheelItem, targetTeam?: string) => {
    if (hole == null) return;
    await recordWheelSpin(hole, { item: item.id, at: Date.now(), targetTeam });
    // Push a 'wheel' event onto the global feed so it shows up in the live
    // ticker alongside birdies/eagles. targetTeam is "all teams" for
    // lightning, the picked/random opponent for shells & boo, or omitted for
    // self-only items (mushroom, super star).
    if (teamInfo) {
      logEvent({
        type: 'wheel',
        subtype: item.id,
        itemLabel: item.label,
        teamName: teamInfo.teamName,
        targetTeam: item.id === 'lightning' ? 'all teams' : targetTeam,
      });
    }
  };

  // Local helper — pick one random element or null if empty.
  const pickRandom = <T,>(arr: T[]): T | null =>
    arr.length === 0 ? null : arr[Math.floor(Math.random() * arr.length)];

  const applyAutoEffect = async (item: WheelItem, snap: TeamSnapshot[]) => {
    // Always ends with setPhase('applied') — no matter what — so the UI never freezes.
    if (!teamInfo) { setPhase('applied'); return; }
    const others = snap.filter(t => t.id !== teamId);
    try {
      switch (item.id) {
        case 'green_shell': {
          const target = pickRandom(others);
          if (target) {
            await applyEffectToOthers('green_shell', [target.id]);
            await recordSpinOnSelf(item, target.teamName);
          } else {
            await recordSpinOnSelf(item);
          }
          break;
        }
        case 'blue_shell': {
          const sorted = [...snap].sort((a, b) => a.netScore - b.netScore);
          const leader = sorted[0];
          if (leader) {
            if (leader.id === teamId) {
              // Record spin BEFORE self-effect to avoid a Firestore write race
              await recordSpinOnSelf(item, leader.teamName);
              applyEffectToSelf(+1);
            } else {
              await applyEffectToOthers('blue_shell', [leader.id]);
              await recordSpinOnSelf(item, leader.teamName);
            }
          } else {
            await recordSpinOnSelf(item);
          }
          break;
        }
        case 'banana': {
          const target = pickRandom(others);
          if (target) {
            await applyEffectToOthers('banana', [target.id]);
            await recordSpinOnSelf(item, target.teamName);
          } else {
            await recordSpinOnSelf(item);
          }
          break;
        }
        case 'lightning': {
          const ids = others.map(t => t.id);
          await applyEffectToOthers('lightning', ids);
          await recordSpinOnSelf(item);
          break;
        }
        case 'mushroom':
          // Record spin FIRST so the transaction doesn't race with the self-effect
          // Firestore write that the state change triggers via the sync useEffect.
          await recordSpinOnSelf(item);
          applyEffectToSelf(-1);
          fireBirdieConfetti();
          break;
        case 'super_star':
          await recordSpinOnSelf(item);
          applyEffectToSelf(-2);
          fireEagleConfetti();
          break;
        case 'boo': {
          const target = pickRandom(others);
          if (target) {
            await applyEffectToOthers('boo', [target.id]);
            await recordSpinOnSelf(item, target.teamName);
            applyEffectToSelf(-1);
          } else {
            // Record spin FIRST before the self-effect write
            await recordSpinOnSelf(item);
            applyEffectToSelf(-1);
          }
          break;
        }
      }
      setPhase('applied');
    } catch (e) {
      console.error('Effect failed', e);
      // Always advance — never leave the user stuck on 'resolving' or 'spinning'
      setError('Effect could not be applied — your spin is still recorded.');
      setPhase('applied');
    }
  };

  const handlePickTarget = async (target: TeamSnapshot) => {
    if (!landed) return;
    try {
      // Only Red Shell uses the picker now — straight +1 on chosen team.
      await applyEffectToOthers(landed.id, [target.id]);
      await recordSpinOnSelf(landed, target.teamName);
      setPhase('applied');
    } catch (e) {
      console.error('Target effect failed', e);
      setError('Could not apply effect to target — your spin is still recorded.');
      setPhase('applied'); // never leave stuck on 'picking'
    }
  };

  // Only 'any' selection (Red Shell) requires picking — everything else is auto.
  const pickOptions = landed?.selection === 'any' ? otherTeams : [];

  if (!open) return null;

  const LandedIcon = landed ? iconFor(landed.id) : Sparkles;

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <span className="font-condensed text-base font-black text-white uppercase tracking-widest">
            Mario Kart Turn
          </span>
        </div>
        {(phase === 'intro' || phase === 'applied') && (
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 active:bg-white/20"
            data-testid="button-wheel-close"
            aria-label="Back"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col items-center">
        {/* Wheel + pointer — hidden once we have a result (resolving or applied) */}
        {phase !== 'applied' && phase !== 'resolving' && (
          <div className="relative w-[min(80vw,360px)] aspect-square mb-6">
            {/* Pointer */}
            <div className="absolute top-[-14px] left-1/2 -translate-x-1/2 z-10">
              <div
                style={{
                  width: 0, height: 0,
                  borderLeft: '14px solid transparent',
                  borderRight: '14px solid transparent',
                  borderTop: '22px solid #39FF14',
                  filter: 'drop-shadow(0 0 6px #39FF14)',
                }}
              />
            </div>
            {/* Wheel image */}
            <img
              src={wheelImg}
              alt="Mario Kart Item Wheel"
              className="w-full h-full select-none"
              draggable={false}
              style={{
                transform: `rotate(${angle}deg)`,
                transition: phase === 'spinning'
                  ? 'transform 4s cubic-bezier(0.18, 0.85, 0.22, 1)'
                  : 'none',
              }}
            />
          </div>
        )}

        {/* INTRO */}
        {phase === 'intro' && (
          <div className="max-w-sm w-full text-center">
            <h2 className="font-condensed text-3xl font-black text-white uppercase tracking-wider mb-2">
              {hole != null ? `Item Box — Hole ${hole}` : 'Item Box'}
            </h2>
            <p className="text-sm text-white/70 mb-6 leading-relaxed">
              You hit the Item Box. Spin it — whatever you land on applies immediately, to you or to another team.
              <br />
              <span className="text-white/50 text-xs">Wheel effects change scores only — they never move your tee block.</span>
            </p>
            <button
              onClick={handleSpin}
              data-testid="button-wheel-spin"
              className="w-full h-16 rounded-full bg-primary text-primary-foreground font-condensed font-black text-xl uppercase tracking-widest active:scale-95 transition-transform shadow-lg shadow-primary/40 flex items-center justify-center gap-2"
            >
              <Sparkles className="w-6 h-6" />
              Spin Item Box
            </button>
            <p className="mt-3 text-white/40 text-[11px] font-bold uppercase tracking-widest py-2">
              You scored this hole — the Item Box must be spun
            </p>
          </div>
        )}

        {/* SPINNING */}
        {phase === 'spinning' && (
          <p className="font-condensed text-xl font-black text-white/70 uppercase tracking-widest animate-pulse">
            Spinning…
          </p>
        )}

        {/* RESOLVING — item known, async effects in-flight */}
        {phase === 'resolving' && landed && (
          <div className="max-w-sm w-full text-center mt-6">
            <div
              className="mx-auto w-24 h-24 rounded-full flex items-center justify-center mb-4 border-4 border-white/20"
              style={{ background: landed.color, color: landed.textColor }}
            >
              <LandedIcon className="w-12 h-12" />
            </div>
            <h2 className="font-condensed text-4xl font-black text-white uppercase tracking-wider mb-2">
              {landed.label}
            </h2>
            <p className="text-sm text-white/50 animate-pulse uppercase tracking-widest font-bold">
              Applying effect…
            </p>
          </div>
        )}

        {/* PICKING */}
        {phase === 'picking' && landed && (
          <div className="max-w-sm w-full">
            <div
              className="rounded-2xl px-5 py-4 mb-4 text-center"
              style={{ background: landed.color, color: landed.textColor }}
            >
              <div className="flex items-center justify-center gap-2 mb-1">
                <LandedIcon className="w-5 h-5" />
                <span className="font-condensed text-2xl font-black uppercase tracking-widest">
                  {landed.label}
                </span>
              </div>
              <p className="text-sm font-medium opacity-90">{landed.description}</p>
            </div>

            <h3 className="text-[11px] font-black text-white/70 uppercase tracking-widest mb-2 px-1">
              Pick any team — they take +1 stroke
            </h3>

            {pickOptions.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center">
                <p className="text-sm text-white/70 mb-3">
                  No other teams available.
                </p>
                <button
                  onClick={async () => {
                    await recordSpinOnSelf(landed);
                    setPhase('applied');
                  }}
                  className="px-5 py-2 rounded-full bg-white/10 text-white text-xs font-bold uppercase tracking-widest"
                >
                  Continue
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {pickOptions.map(t => (
                  <button
                    key={t.id}
                    onClick={() => handlePickTarget(t)}
                    data-testid={`wheel-target-${t.id}`}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 rounded-xl transition-colors"
                  >
                    <div className="text-left min-w-0">
                      <p className="font-bold text-sm text-white truncate">{t.teamName}</p>
                      <p className="text-[11px] text-white/50 truncate">
                        {formatPlayers(t.players)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <ChevronRight className="w-4 h-4 text-white/40" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* APPLIED */}
        {phase === 'applied' && landed && (
          <div className="max-w-sm w-full text-center mt-6">
            <div
              className="mx-auto w-24 h-24 rounded-full flex items-center justify-center mb-4 border-4 border-white/20"
              style={{ background: landed.color, color: landed.textColor }}
            >
              <LandedIcon className="w-12 h-12" />
            </div>
            <p className="text-[11px] font-black text-white/60 uppercase tracking-widest mb-1">You Landed On</p>
            <h2 className="font-condensed text-4xl font-black text-white uppercase tracking-wider mb-3">
              {landed.label}
            </h2>
            <p className="text-sm text-white/80 leading-relaxed mb-6">
              {effectSummary(landed.id)}
            </p>

            <button
              onClick={onClose}
              data-testid="button-wheel-done"
              className="w-full h-14 rounded-full bg-primary text-primary-foreground font-condensed font-black text-lg uppercase tracking-widest active:scale-95 transition-transform"
            >
              Keep Playing
            </button>
          </div>
        )}

        {error && (
          <p className="mt-4 text-sm text-red-400">{error}</p>
        )}
      </div>
    </div>
  );

  function effectSummary(id: WheelItemId): string {
    const item = getWheelItem(id);
    if (!item) return '';
    const last = priorSpin?.item === id ? priorSpin.targetTeam : undefined;
    switch (id) {
      case 'green_shell':
        return last
          ? `Random shell hit ${last}. +1 stroke on their net score.`
          : 'Random shell — no targets available, no effect.';
      case 'red_shell':
        return last
          ? `You targeted ${last}. +1 stroke on their net score.`
          : 'Targeted attack — no targets available.';
      case 'blue_shell':
        return last
          ? `Blue shell tracked the leader (${last}). +1 stroke on them.`
          : 'Blue shell — no other teams to hit.';
      case 'banana':
        return last
          ? `Banana slipped onto ${last}. +1 stroke on them.`
          : 'Banana fizzled — no other teams on the course.';
      case 'lightning':
        return 'Lightning struck every other team. +1 stroke each.';
      case 'mushroom':
        return 'Speed boost! -1 stroke off your net score.';
      case 'super_star':
        return 'Invincibility! -2 strokes off your net score.';
      case 'boo':
        return last
          ? `Boo stole 1 stroke from ${last}. They get +1, you get -1.`
          : 'Boo — no one to steal from. Took -1 for yourself instead.';
    }
  }
}

// Avoid unused import warnings
void Crown; void Target;
