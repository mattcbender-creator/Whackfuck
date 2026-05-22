import { useState, useEffect, useRef } from 'react';
import { X, Sparkles, Crown, Target, Zap, Ban, Ghost, Star, Shell, ChevronRight } from 'lucide-react';
import { useWFC, TeamSnapshot } from '@/lib/store';
import {
  WHEEL_ITEMS, WheelItem, WheelItemId,
  targetAngleForIndex, pickRandomIndex, getWheelItem,
} from '@/lib/wheel';
import { fireBirdieConfetti, fireEagleConfetti } from '@/lib/confetti';

const wheelImg = `${import.meta.env.BASE_URL}wheel/mariokart-wheel.png`;

type Phase = 'intro' | 'spinning' | 'picking' | 'applied';

interface Props {
  open: boolean;
  onClose: () => void;
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

export default function WheelModal({ open, onClose }: Props) {
  const {
    teamId, teamInfo, netScore, wheelSpin: priorSpin,
    confirmFrontNine, frontNineConfirmed,
    recordWheelSpin, applyEffectToOthers, applyEffectToSelf, listTeamsOnce,
  } = useWFC();

  const [phase, setPhase] = useState<Phase>('intro');
  const [angle, setAngle] = useState(0);
  const [landed, setLanded] = useState<WheelItem | null>(null);
  const [teams, setTeams] = useState<TeamSnapshot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const spinTimer = useRef<number | null>(null);
  const spinLockRef = useRef(false); // Guards against rapid double-taps of spin

  useEffect(() => {
    if (open) {
      // If this team already spun, re-opening the modal MUST NOT allow another
      // spin. Show the result they already got and let them dismiss.
      const existing = priorSpin ? WHEEL_ITEMS.find(w => w.id === priorSpin.item) ?? null : null;
      if (existing) {
        setPhase('applied');
        setLanded(existing);
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
  }, [open, priorSpin]);

  const otherTeams = teams.filter(t => t.id !== teamId);

  const handleSpin = async () => {
    if (phase !== 'intro') return;
    // Defense in depth: NEVER allow a second spin for the same team, even if
    // the modal somehow opens with an existing spin.
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
    // LOCK THE FRONT 9 NOW — the moment they commit to spinning, edits stop.
    if (!frontNineConfirmed) confirmFrontNine();
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

    spinTimer.current = window.setTimeout(async () => {
      setLanded(item);
      if (item.selection === 'none') {
        await applyAutoEffect(item, snap);
      } else {
        setPhase('picking');
      }
    }, 4200);
  };

  const recordSpinOnSelf = async (item: WheelItem, targetTeam?: string) => {
    await recordWheelSpin({ item: item.id, at: Date.now(), targetTeam });
  };

  const applyAutoEffect = async (item: WheelItem, snap: TeamSnapshot[]) => {
    if (!teamInfo) return;
    const others = snap.filter(t => t.id !== teamId);
    try {
      switch (item.id) {
        case 'blue_shell': {
          // Auto-fire at current leader, excluding self.
          const sorted = [...others].sort((a, b) => a.netScore - b.netScore);
          const leader = sorted[0];
          if (leader) {
            await applyEffectToOthers('blue_shell', [leader.id]);
            await recordSpinOnSelf(item, leader.teamName);
          } else {
            // Only team on the course — nothing to hit.
            await recordSpinOnSelf(item);
          }
          break;
        }
        case 'banana':
          applyEffectToSelf(+1);
          await recordSpinOnSelf(item);
          break;
        case 'lightning': {
          const ids = others.map(t => t.id);
          await applyEffectToOthers('lightning', ids);
          await recordSpinOnSelf(item);
          break;
        }
        case 'mushroom':
          applyEffectToSelf(-1);
          await recordSpinOnSelf(item);
          fireBirdieConfetti();
          break;
        case 'super_star':
          applyEffectToSelf(-2);
          await recordSpinOnSelf(item);
          fireEagleConfetti();
          break;
      }
      setPhase('applied');
    } catch (e) {
      console.error('Effect failed', e);
      setError('Failed to apply effect. You can try again.');
    }
  };

  const handlePickTarget = async (target: TeamSnapshot) => {
    if (!landed) return;
    try {
      if (landed.id === 'boo') {
        // Steal -1 from target → +1 on target, -1 on self, hide worst back-9
        await applyEffectToOthers('boo', [target.id]);
        applyEffectToSelf(-1, true);
      } else {
        await applyEffectToOthers(landed.id, [target.id]);
      }
      await recordSpinOnSelf(landed, target.teamName);
      setPhase('applied');
    } catch (e) {
      console.error('Target effect failed', e);
      setError('Failed to apply effect to target.');
    }
  };

  // Filter team options by selection mode
  const pickOptions = (() => {
    if (!landed) return [];
    if (landed.selection === 'ahead') {
      // Teams with netScore strictly less than our raw netScore
      return otherTeams.filter(t => t.netScore < netScore);
    }
    if (landed.selection === 'nearby') {
      // Sort by closeness in net score and take top 5
      return [...otherTeams]
        .sort((a, b) => Math.abs(a.netScore - netScore) - Math.abs(b.netScore - netScore))
        .slice(0, 5);
    }
    return otherTeams;
  })();

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
            aria-label="Close"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col items-center">
        {/* Wheel + pointer (always visible until applied) */}
        {phase !== 'applied' && (
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
              Front 9 Done
            </h2>
            <p className="text-sm text-white/70 mb-6 leading-relaxed">
              Spin the Item Box to unlock the back 9. Whatever you land on applies immediately — to you or to another team.
              <br />
              <span className="text-white/50 text-xs">Once you tap spin, your front 9 scores are locked.</span>
            </p>
            <button
              onClick={handleSpin}
              data-testid="button-wheel-spin"
              className="w-full h-16 rounded-full bg-primary text-primary-foreground font-condensed font-black text-xl uppercase tracking-widest active:scale-95 transition-transform shadow-lg shadow-primary/40 flex items-center justify-center gap-2"
            >
              <Sparkles className="w-6 h-6" />
              Spin Item Box
            </button>
            <button
              onClick={onClose}
              data-testid="button-wheel-edit-front-nine"
              className="mt-3 text-white/50 text-xs font-bold uppercase tracking-widest hover:text-white/80 transition-colors py-2"
            >
              Wait — let me fix a front 9 score first
            </button>
          </div>
        )}

        {/* SPINNING */}
        {phase === 'spinning' && (
          <p className="font-condensed text-xl font-black text-white/70 uppercase tracking-widest animate-pulse">
            Spinning…
          </p>
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
              {landed.selection === 'ahead' && 'Pick a team ahead of you'}
              {landed.selection === 'nearby' && 'Pick a nearby team'}
              {landed.selection === 'any' && 'Pick any team to steal from'}
            </h3>

            {pickOptions.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center">
                <p className="text-sm text-white/70 mb-3">
                  {landed.selection === 'ahead'
                    ? 'No teams ahead of you — lucky them. Spin is a dud.'
                    : 'No other teams available.'}
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
                        {t.player1} & {t.player2} · Thru {t.holesPlayed}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`font-condensed text-lg font-black ${
                        t.netScore < 0 ? 'text-primary' : t.netScore > 0 ? 'text-orange-400' : 'text-white'
                      }`}>
                        {t.netScore === 0 ? 'E' : t.netScore > 0 ? `+${t.netScore}` : t.netScore}
                      </span>
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
              Onto the Back 9
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
    switch (id) {
      case 'green_shell':
      case 'red_shell':
        return 'Target hit. +1 stroke applied to their net score.';
      case 'blue_shell':
        return 'Blue shell tracked the leader. +1 stroke applied to them.';
      case 'banana':
        return 'You slipped on a banana. +1 stroke added to your back 9.';
      case 'lightning':
        return 'Lightning struck every other team. +1 stroke each.';
      case 'mushroom':
        return 'Speed boost! -1 stroke off your back 9.';
      case 'super_star':
        return 'Invincibility! -2 strokes off your back 9.';
      case 'boo':
        return 'Boo stole 1 stroke and your worst back-9 hole is hidden.';
    }
  }
}

// Used by Leaderboard to show small badges; we re-export icons mapping.
export { iconFor as wheelIcon };
export const wheelBadgeColor = (id: WheelItemId) => {
  const item = getWheelItem(id);
  return item?.color ?? '#666';
};

// Avoid unused import warnings
void Crown; void Target;
