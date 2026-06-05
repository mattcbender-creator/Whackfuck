import { Minus, Plus } from 'lucide-react';
import { type CourseHole } from '@/lib/tournament';

interface Props {
  holes: CourseHole[];
  onHolesChange: (holes: CourseHole[]) => void;
  /** Show yardage inputs (Tips / Mid / Wmn). Only needed when autoTeeRule is on. */
  showYardages?: boolean;
}

export function CourseSetup({ holes, onHolesChange, showYardages = false }: Props) {
  const updateHole = (idx: number, patch: Partial<CourseHole>) => {
    onHolesChange(holes.map((h, i) => (i === idx ? { ...h, ...patch } : h)));
  };

  // Inline stepper for par — renders [−] value [+] in a pill
  const parStepper = (h: CourseHole, idx: number) => (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        onClick={() => updateHole(idx, { par: Math.max(3, h.par - 1) })}
        data-testid={`btn-par-dec-${h.hole}`}
        aria-label={`Decrease par for hole ${h.hole}`}
        className="w-7 h-7 rounded-md bg-secondary text-muted-foreground hover:text-foreground active:scale-90 flex items-center justify-center transition-transform"
      >
        <Minus className="w-3 h-3" />
      </button>
      <span
        data-testid={`input-par-${h.hole}`}
        className="w-6 text-center font-condensed font-black text-base text-foreground tabular-nums select-none"
      >
        {h.par || '–'}
      </span>
      <button
        type="button"
        onClick={() => updateHole(idx, { par: Math.min(6, h.par + 1) })}
        data-testid={`btn-par-inc-${h.hole}`}
        aria-label={`Increase par for hole ${h.hole}`}
        className="w-7 h-7 rounded-md bg-secondary text-muted-foreground hover:text-foreground active:scale-90 flex items-center justify-center transition-transform"
      >
        <Plus className="w-3 h-3" />
      </button>
    </div>
  );

  const yardInput = (h: CourseHole, idx: number, field: 'tips' | 'womens', testid: string) => (
    <input
      key={field}
      type="number"
      inputMode="numeric"
      min={0}
      max={999}
      value={h[field] === 0 ? '' : h[field]}
      onChange={e => updateHole(idx, { [field]: parseInt(e.target.value, 10) || 0 })}
      data-testid={testid}
      placeholder="—"
      className="w-full h-9 text-center bg-input/60 border border-border/80 rounded-md text-sm font-condensed font-bold text-foreground focus:border-primary focus:outline-none"
    />
  );

  // ── Par-only layout: front 9 / back 9 side by side ──────────────────────
  if (!showYardages) {
    const front = holes.slice(0, 9);
    const back = holes.slice(9, 18);
    const colHeader = (
      <div className="flex items-center justify-between pb-1.5 mb-0.5 border-b border-border/50">
        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest w-6 text-center">#</span>
        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest flex-1 text-center">Par</span>
      </div>
    );
    return (
      <div className="space-y-2.5">
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Tap +/− to set par. Yardages aren't needed — enable the Auto-tee rule above if you want them.
        </p>
        <div className="flex gap-3">
          {/* Front 9 */}
          <div className="flex-1 min-w-0">
            {colHeader}
            {front.map((h, i) => (
              <div key={h.hole} className="flex items-center justify-between py-1 border-b border-border/20 last:border-0">
                <span className="font-condensed font-black text-primary text-sm w-6 text-center shrink-0">{h.hole}</span>
                <div className="flex-1 flex justify-center">{parStepper(h, i)}</div>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="w-px bg-border/40 self-stretch" />

          {/* Back 9 */}
          <div className="flex-1 min-w-0">
            {colHeader}
            {back.map((h, i) => (
              <div key={h.hole} className="flex items-center justify-between py-1 border-b border-border/20 last:border-0">
                <span className="font-condensed font-black text-primary text-sm w-6 text-center shrink-0">{h.hole}</span>
                <div className="flex-1 flex justify-center">{parStepper(h, i + 9)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Yardage layout: full table with par stepper + Tips + Wmn ────────────
  // Grid: [#=2rem] [Par stepper=88px fixed] [Tips=1fr] [Wmn=1fr]
  const COL = 'grid-cols-[2rem_88px_1fr_1fr]';
  return (
    <div className="space-y-2.5">
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Tips = longest tee, Wmn = shortest. Leave blank if you don't have the yardages handy.
      </p>
      <div className="rounded-xl border border-border/60 overflow-hidden">
        <div className={`grid ${COL} gap-x-2 px-2 py-2 bg-secondary/50 text-[9px] font-bold uppercase tracking-widest text-muted-foreground`}>
          <span className="text-center">#</span>
          <span className="text-center">Par</span>
          <span className="text-center">Tips</span>
          <span className="text-center">Wmn</span>
        </div>
        <div className="divide-y divide-border/40">
          {holes.map((h, i) => (
            <div key={h.hole} className={`grid ${COL} gap-x-2 px-2 py-1.5 items-center`}>
              <span className="text-center font-condensed font-black text-primary text-sm">{h.hole}</span>
              <div className="flex justify-center">{parStepper(h, i)}</div>
              {yardInput(h, i, 'tips', `input-tips-${h.hole}`)}
              {yardInput(h, i, 'womens', `input-womens-${h.hole}`)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
