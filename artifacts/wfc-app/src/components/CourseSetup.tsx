import { type CourseHole } from '@/lib/tournament';

interface Props {
  holes: CourseHole[];
  onHolesChange: (holes: CourseHole[]) => void;
}

export function CourseSetup({ holes, onHolesChange }: Props) {
  const updateHole = (idx: number, patch: Partial<CourseHole>) => {
    const next = holes.map((h, i) => (i === idx ? { ...h, ...patch } : h));
    onHolesChange(next);
  };

  const numField = (val: number, onChange: (n: number) => void, min: number, max: number, testid: string) => (
    <input
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={val === 0 ? '' : val}
      onChange={e => onChange(parseInt(e.target.value, 10) || 0)}
      data-testid={testid}
      className="w-full h-9 text-center bg-input/60 border border-border/80 rounded-md text-sm font-condensed font-bold text-foreground focus:border-primary focus:outline-none"
    />
  );

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-muted-foreground">
        Enter a par for every hole. Yardages are optional — leave them blank for a par-only course.
      </p>

      {/* Hole table */}
      <div className="rounded-xl border border-border/60 overflow-hidden">
        <div className="grid grid-cols-[2.5rem_1fr_1fr_1fr_1fr] gap-2 px-3 py-2 bg-secondary/50 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
          <span className="text-center">#</span>
          <span className="text-center">Par</span>
          <span className="text-center">Tips</span>
          <span className="text-center">Mid</span>
          <span className="text-center">Wmn</span>
        </div>
        <div className="divide-y divide-border/40">
          {holes.map((h, i) => (
            <div
              key={h.hole}
              className="grid grid-cols-[2.5rem_1fr_1fr_1fr_1fr] gap-2 px-3 py-1.5 items-center"
            >
              <span className="text-center font-condensed font-black text-primary text-sm">{h.hole}</span>
              {numField(h.par, n => updateHole(i, { par: n }), 3, 7, `input-par-${h.hole}`)}
              {numField(h.tips, n => updateHole(i, { tips: n }), 0, 999, `input-tips-${h.hole}`)}
              {numField(h.mid, n => updateHole(i, { mid: n }), 0, 999, `input-mid-${h.hole}`)}
              {numField(h.womens, n => updateHole(i, { womens: n }), 0, 999, `input-womens-${h.hole}`)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
