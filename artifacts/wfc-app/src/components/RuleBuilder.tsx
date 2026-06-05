import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  RULE_LIBRARY, WHEEL_RULE_ID,
  type HoleRule, type RuleLibraryEntry,
} from '@/lib/tournament';
import { Sparkles, Plus, Trash2, Check } from 'lucide-react';

interface RuleBuilderProps {
  holeRules: HoleRule[];
  onHoleRulesChange: (rules: HoleRule[]) => void;
  customRules: RuleLibraryEntry[];
  onCustomRulesChange: (rules: RuleLibraryEntry[]) => void;
  // Fired when a per-hole rule editor opens, so a parent section can collapse
  // to keep the editor focused (used on the New Tournament screen).
  onHoleOpen?: () => void;
  // Fired when a per-hole rule editor closes (rule selected or dismissed), so
  // the parent section can re-open for quick multi-hole editing.
  onHoleClose?: () => void;
}

const NONE_ID = 'none';
const NONE_ENTRY: RuleLibraryEntry = {
  id: NONE_ID, type: 'none', ruleName: 'No rule', ruleText: '', builtIn: true,
};
const BLANK_RULE: HoleRule = { type: 'none', ruleName: '', ruleText: '' };

function entryToHoleRule(e: RuleLibraryEntry): HoleRule {
  return { type: e.type, ruleName: e.ruleName, ruleText: e.ruleText };
}

function isWheelEntry(e: RuleLibraryEntry): boolean {
  return e.type === 'wheel' || e.id === WHEEL_RULE_ID;
}

// True when a hole's current rule corresponds to the given library entry.
function ruleMatchesEntry(rule: HoleRule, e: RuleLibraryEntry): boolean {
  if (e.type === 'none') return rule.type === 'none' || !rule.ruleName;
  return rule.type === e.type && rule.ruleName === e.ruleName;
}

export function RuleBuilder({
  holeRules, onHoleRulesChange, customRules, onCustomRulesChange, onHoleOpen, onHoleClose,
}: RuleBuilderProps) {
  const [openHole, setOpenHole] = useState<number | null>(null);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customText, setCustomText] = useState('');

  // Every rule a hole can be assigned: clear, the Item Box wheel, built-ins,
  // then any custom rules the host created.
  const allEntries = useMemo<RuleLibraryEntry[]>(
    () => [NONE_ENTRY, ...RULE_LIBRARY, ...customRules],
    [customRules],
  );

  const assign = (holeIdx: number, entry: RuleLibraryEntry) => {
    const next = holeRules.slice();
    next[holeIdx] = entryToHoleRule(entry);
    onHoleRulesChange(next);
    setOpenHole(null);
    // Notify parent so it can re-open the section (same as dismissing the dialog).
    onHoleClose?.();
  };

  const openEditor = (idx: number) => {
    setOpenHole(idx);
    onHoleOpen?.();
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
  };

  const removeCustom = (id: string) => {
    onCustomRulesChange(customRules.filter(e => e.id !== id));
  };

  const activeRule = openHole !== null ? (holeRules[openHole] ?? BLANK_RULE) : BLANK_RULE;

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Tap a hole to set its rule. Most holes can stay empty — drop the Item Box on the chaos holes.
      </p>

      {/* ── Custom rule management ── */}
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
              <div
                key={e.id}
                data-testid={`custom-rule-${e.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card px-2.5 py-1.5"
              >
                <span className="text-xs font-bold text-foreground/90">{e.ruleName}</span>
                <button
                  type="button"
                  onClick={() => removeCustom(e.id)}
                  data-testid={`remove-custom-${e.id}`}
                  className="text-muted-foreground/50 hover:text-red-400"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
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

      {/* ── 18 hole chips ── */}
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 18 }, (_, idx) => {
          const rule = holeRules[idx] ?? BLANK_RULE;
          const isWheel = rule.type === 'wheel';
          const empty = rule.type === 'none' || !rule.ruleName;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => openEditor(idx)}
              data-testid={`hole-rule-${idx + 1}`}
              className={`text-left rounded-xl border p-2.5 min-h-[64px] transition-colors active:scale-[0.98] ${
                isWheel
                  ? 'border-primary/60 bg-primary/10'
                  : empty
                  ? 'border-border/50 bg-card/40 hover:border-primary/40'
                  : 'border-border bg-card hover:border-primary/40'
              }`}
            >
              <span className="font-condensed text-lg font-black text-primary leading-none">
                {idx + 1}
              </span>
              <div className="mt-1 flex items-start gap-1">
                {isWheel && <Sparkles className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />}
                <span className={`text-[11px] font-bold leading-tight line-clamp-2 ${empty ? 'text-muted-foreground/50' : 'text-foreground/90'}`}>
                  {empty ? 'Tap to add' : rule.ruleName}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Per-hole rule editor ── */}
      <Dialog open={openHole !== null} onOpenChange={o => { if (!o) { setOpenHole(null); onHoleClose?.(); } }}>
        <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto bg-card border-border">
          {openHole !== null && (
            <>
              <DialogHeader>
                <DialogTitle className="font-condensed text-2xl font-black uppercase tracking-wider text-left">
                  Hole {openHole + 1} <span className="text-primary">Rule</span>
                </DialogTitle>
                <DialogDescription className="text-xs text-left">
                  Pick what happens on this hole.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-1.5">
                {allEntries.map(entry => {
                  const selected = ruleMatchesEntry(activeRule, entry);
                  const wheel = isWheelEntry(entry);
                  const none = entry.type === 'none';
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => assign(openHole, entry)}
                      data-testid={`assign-rule-${openHole + 1}-${entry.id}`}
                      className={`w-full flex items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                        selected
                          ? 'border-primary bg-primary/15'
                          : wheel
                          ? 'border-primary/40 bg-primary/5 hover:bg-primary/10'
                          : 'border-border/60 bg-card/60 hover:border-primary/40'
                      }`}
                    >
                      {wheel && <Sparkles className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />}
                      <span className="flex-1 min-w-0">
                        <span className={`block text-xs font-bold ${none ? 'text-muted-foreground' : 'text-foreground/90'}`}>
                          {entry.ruleName}
                        </span>
                        {entry.ruleText && (
                          <span className="block text-[10px] text-muted-foreground leading-snug mt-0.5">
                            {entry.ruleText}
                          </span>
                        )}
                      </span>
                      {selected && <Check className="w-4 h-4 text-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
