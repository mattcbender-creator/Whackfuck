import { Switch } from '@/components/ui/switch';
import { type CourseHole, dundeeCourseDefaults, blankCourse } from '@/lib/tournament';
import { MapPin } from 'lucide-react';

interface Props {
  holes: CourseHole[];
  onHolesChange: (holes: CourseHole[]) => void;
  trackYardages: boolean;
  onTrackYardagesChange: (v: boolean) => void;
  usingDefaults: boolean;
  onUsingDefaultsChange: (v: boolean) => void;
  /** When the auto-tee rule is on, yardages are required and can't be turned off. */
  yardagesLocked?: boolean;
}

export function CourseSetup({
  holes, onHolesChange, trackYardages, onTrackYardagesChange,
  usingDefaults, onUsingDefaultsChange, yardagesLocked = false,
}: Props) {
  const setDefaults = (use: boolean) => {
    onUsingDefaultsChange(use);
    onHolesChange(use ? dundeeCourseDefaults() : blankCourse());
  };

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
      <div className="flex items-center gap-2">
        <MapPin className="w-3.5 h-3.5 text-primary" />
        <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Course Setup</span>
      </div>

      {/* Use Dundee defaults */}
      <label className="flex items-center justify-between bg-card/50 border border-border/60 rounded-xl px-4 py-3 cursor-pointer">
        <div>
          <p className="text-sm font-bold text-foreground">Use Dundee CC course defaults</p>
          <p className="text-[11px] text-muted-foreground">Prefill all 18 pars{trackYardages ? ' and yardages' : ''} — edit any value below.</p>
        </div>
        <Switch checked={usingDefaults} onCheckedChange={setDefaults} data-testid="switch-use-defaults" />
      </label>

      {/* Track yardages */}
      <label className="flex items-center justify-between bg-card/50 border border-border/60 rounded-xl px-4 py-3 cursor-pointer">
        <div>
          <p className="text-sm font-bold text-foreground">Track yardages</p>
          <p className="text-[11px] text-muted-foreground">
            {yardagesLocked
              ? 'Required while the auto-tee rule is on.'
              : 'Off by default — keeps scoring clean. Turn on to show distances.'}
          </p>
        </div>
        <Switch
          checked={trackYardages}
          onCheckedChange={onTrackYardagesChange}
          disabled={yardagesLocked}
          data-testid="switch-track-yardages"
        />
      </label>

      {/* Hole table */}
      <div className="rounded-xl border border-border/60 overflow-hidden">
        <div className={`grid ${trackYardages ? 'grid-cols-[2.5rem_1fr_1fr_1fr_1fr]' : 'grid-cols-[2.5rem_1fr]'} gap-2 px-3 py-2 bg-secondary/50 text-[9px] font-bold uppercase tracking-widest text-muted-foreground`}>
          <span className="text-center">#</span>
          <span className="text-center">Par</span>
          {trackYardages && <><span className="text-center">Tips</span><span className="text-center">Mid</span><span className="text-center">Wmn</span></>}
        </div>
        <div className="divide-y divide-border/40">
          {holes.map((h, i) => (
            <div
              key={h.hole}
              className={`grid ${trackYardages ? 'grid-cols-[2.5rem_1fr_1fr_1fr_1fr]' : 'grid-cols-[2.5rem_1fr]'} gap-2 px-3 py-1.5 items-center`}
            >
              <span className="text-center font-condensed font-black text-primary text-sm">{h.hole}</span>
              {numField(h.par, n => updateHole(i, { par: n }), 3, 7, `input-par-${h.hole}`)}
              {trackYardages && (
                <>
                  {numField(h.tips, n => updateHole(i, { tips: n }), 0, 999, `input-tips-${h.hole}`)}
                  {numField(h.mid, n => updateHole(i, { mid: n }), 0, 999, `input-mid-${h.hole}`)}
                  {numField(h.womens, n => updateHole(i, { womens: n }), 0, 999, `input-womens-${h.hole}`)}
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
