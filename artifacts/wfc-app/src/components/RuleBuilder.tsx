import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  RULE_LIBRARY, WHEEL_RULE_ID,
  type HoleRule, type RuleLibraryEntry,
} from '@/lib/tournament';
import { Sparkles, Plus, Trash2, X, Hand } from 'lucide-react';

interface RuleBuilderProps {
  holeRules: HoleRule[];
  onHoleRulesChange: (rules: HoleRule[]) => void;
  customRules: RuleLibraryEntry[];
  onCustomRulesChange: (rules: RuleLibraryEntry[]) => void;
}

const NONE_ID = 'none';
const NONE_ENTRY: RuleLibraryEntry = {
  id: NONE_ID, type: 'none', ruleName: 'No rule', ruleText: '', builtIn: true,
};

function entryToHoleRule(e: RuleLibraryEntry): HoleRule {
  return { type: e.type, ruleName: e.ruleName, ruleText: e.ruleText };
}

// Map an entry id to a single-letter/icon swatch so slots and palette stay
// visually linked. The wheel always reads as the sparkle.
function isWheelEntry(e: RuleLibraryEntry): boolean {
  return e.type === 'wheel' || e.id === WHEEL_RULE_ID;
}

export function RuleBuilder({
  holeRules, onHoleRulesChange, customRules, onCustomRulesChange,
}: RuleBuilderProps) {
  // The "armed" palette rule for tap-to-assign on mobile. Tapping a hole
  // applies it. Drag-and-drop (desktop) bypasses this.
  const [armedId, setArmedId] = useState<string | null>(null);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customText, setCustomText] = useState('');

  const wheelEntry = useMemo(() => RULE_LIBRARY.find(isWheelEntry) ?? null, []);
  const builtInStandard = useMemo(
    () => RULE_LIBRARY.filter(e => !isWheelEntry(e)),
    [],
  );

  const byId = useMemo(() => {
    const m = new Map<string, RuleLibraryEntry>();
    m.set(NONE_ID, NONE_ENTRY);
    for (const e of RULE_LIBRARY) m.set(e.id, e);
    for (const e of customRules) m.set(e.id, e);
    return m;
  }, [customRules]);

  const assign = (holeIdx: number, entry: RuleLibraryEntry) => {
    const next = holeRules.slice();
    next[holeIdx] = entryToHoleRule(entry);
    onHoleRulesChange(next);
  };

  const handleSlotActivate = (holeIdx: number) => {
    if (!armedId) return;
    const entry = byId.get(armedId);
    if (entry) assign(holeIdx, entry);
  };

  const handleDrop = (holeIdx: number, id: string) => {
    const entry = byId.get(id);
    if (entry) assign(holeIdx, entry);
  };

  const clearSlot = (holeIdx: number) => {
    const next = holeRules.slice();
    next[holeIdx] = { type: 'none', ruleName: '', ruleText: '' };
    onHoleRulesChange(next);
  };

  const addCustom = () => {
    const name = customName.trim();
    const text = customText.trim();
    if (!name) return;
    const entry: RuleLibraryEntry = {
      id: `custom::${Date.now()}::${Math.random().toString(36).slice(2, 7)}`,
      type: 'standard',
      ruleName: name,
      ruleText: text,
      builtIn: false,
    };
    onCustomRulesChange([...customRules, entry]);
    setCustomName('');
    setCustomText('');
    setShowCustomForm(false);
    setArmedId(entry.id);
  };

  const removeCustom = (id: string) => {
    onCustomRulesChange(customRules.filter(e => e.id !== id));
    if (armedId === id) setArmedId(null);
  };

  const armedEntry = armedId ? byId.get(armedId) ?? null : null;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-condensed text-2xl font-black uppercase tracking-wider text-foreground">
          Hole <span className="text-primary">Rules</span>
        </h3>
        <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">
          Pick a rule below, then tap the holes to place it. On a computer you can also drag a rule onto a hole. Place the Item Box on as many holes as you like.
        </p>
      </div>

      {/* ── Armed-rule banner ── */}
      {armedEntry && (
        <div className="flex items-center gap-2 bg-primary/10 border border-primary/40 rounded-xl px-3 py-2">
          <Hand className="w-4 h-4 text-primary shrink-0" />
          <p className="flex-1 text-xs font-bold text-foreground leading-snug">
            Placing: <span className="text-primary">{armedEntry.type === 'none' ? 'Clear rule' : armedEntry.ruleName}</span>
            <span className="text-muted-foreground font-medium"> — tap a hole</span>
          </p>
          <button
            type="button"
            onClick={() => setArmedId(null)}
            className="text-muted-foreground hover:text-foreground shrink-0"
            data-testid="button-disarm-rule"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Rule palette ── */}
      <div className="space-y-3">
        {wheelEntry && (
          <PaletteChip
            entry={wheelEntry}
            armed={armedId === wheelEntry.id}
            onArm={() => setArmedId(armedId === wheelEntry.id ? null : wheelEntry.id)}
          />
        )}

        <PaletteChip
          entry={NONE_ENTRY}
          armed={armedId === NONE_ID}
          onArm={() => setArmedId(armedId === NONE_ID ? null : NONE_ID)}
        />

        <div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Built-in rules</p>
          <div className="flex flex-wrap gap-2">
            {builtInStandard.map(e => (
              <PaletteChip
                key={e.id}
                entry={e}
                armed={armedId === e.id}
                onArm={() => setArmedId(armedId === e.id ? null : e.id)}
                compact
              />
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Custom rules</p>
            <button
              type="button"
              onClick={() => setShowCustomForm(v => !v)}
              data-testid="button-add-custom-rule"
              className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-primary hover:text-primary/80"
            >
              <Plus className="w-3 h-3" /> Add rule
            </button>
          </div>

          {customRules.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {customRules.map(e => (
                <PaletteChip
                  key={e.id}
                  entry={e}
                  armed={armedId === e.id}
                  onArm={() => setArmedId(armedId === e.id ? null : e.id)}
                  onRemove={() => removeCustom(e.id)}
                  compact
                />
              ))}
            </div>
          )}

          {showCustomForm && (
            <div className="bg-card border border-border/70 rounded-xl p-3 space-y-2">
              <Input
                value={customName}
                onChange={e => setCustomName(e.target.value)}
                placeholder="Rule name (e.g. Closest to the Pin)"
                className="h-10 bg-input/60 border-border/80 focus:border-primary text-sm"
                data-testid="input-custom-rule-name"
              />
              <Textarea
                value={customText}
                onChange={e => setCustomText(e.target.value)}
                placeholder="What happens on this hole?"
                className="min-h-[64px] bg-input/60 border-border/80 focus:border-primary text-sm"
                data-testid="input-custom-rule-text"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setShowCustomForm(false); setCustomName(''); setCustomText(''); }}
                  className="flex-1 h-10 rounded-lg border border-border/70 text-sm font-bold uppercase tracking-widest text-muted-foreground"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={addCustom}
                  disabled={!customName.trim()}
                  data-testid="button-save-custom-rule"
                  className="flex-1 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-black uppercase tracking-widest disabled:opacity-40"
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 18 hole slots ── */}
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 18 }, (_, idx) => {
          const rule = holeRules[idx] ?? { type: 'none', ruleName: '', ruleText: '' };
          const isWheel = rule.type === 'wheel';
          const empty = rule.type === 'none' || !rule.ruleName;
          return (
            <div
              key={idx}
              onClick={() => handleSlotActivate(idx)}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                const id = e.dataTransfer.getData('text/plain');
                if (id) handleDrop(idx, id);
              }}
              data-testid={`hole-slot-${idx + 1}`}
              className={`relative rounded-xl border p-2.5 min-h-[68px] transition-colors cursor-pointer ${
                isWheel
                  ? 'border-primary/60 bg-primary/10'
                  : empty
                  ? 'border-border/50 bg-card/40'
                  : 'border-border bg-card'
              } ${armedEntry ? 'hover:border-primary' : ''}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-condensed text-lg font-black text-primary leading-none">
                  {idx + 1}
                </span>
                {!empty && (
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); clearSlot(idx); }}
                    data-testid={`clear-slot-${idx + 1}`}
                    className="text-muted-foreground/60 hover:text-red-400"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="mt-1 flex items-start gap-1">
                {isWheel && <Sparkles className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />}
                <span className={`text-[11px] font-bold leading-tight line-clamp-2 ${empty ? 'text-muted-foreground/50' : 'text-foreground/90'}`}>
                  {empty ? 'Empty' : rule.ruleName}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface PaletteChipProps {
  entry: RuleLibraryEntry;
  armed: boolean;
  onArm: () => void;
  onRemove?: () => void;
  compact?: boolean;
}

function PaletteChip({ entry, armed, onArm, onRemove, compact }: PaletteChipProps) {
  const wheel = isWheelEntry(entry);
  const none = entry.type === 'none';
  return (
    <div
      draggable
      onDragStart={e => e.dataTransfer.setData('text/plain', entry.id)}
      onClick={onArm}
      data-testid={`palette-rule-${entry.id}`}
      className={`group inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 cursor-pointer select-none transition-colors ${
        armed
          ? 'border-primary bg-primary/15'
          : wheel
          ? 'border-primary/50 bg-primary/5 hover:bg-primary/10'
          : none
          ? 'border-border/60 bg-card/40 hover:bg-card/70'
          : 'border-border/70 bg-card hover:border-primary/40'
      } ${compact ? '' : 'w-full justify-start'}`}
    >
      {wheel && <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />}
      <span className={`text-xs font-bold ${none ? 'text-muted-foreground' : 'text-foreground/90'} ${compact ? '' : 'flex-1'}`}>
        {entry.ruleName}
      </span>
      {onRemove && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onRemove(); }}
          data-testid={`remove-custom-${entry.id}`}
          className="text-muted-foreground/50 hover:text-red-400"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
