import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
} from '@/components/ui/accordion';
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
}

const NONE_ID = 'none';
const NONE_ENTRY: RuleLibraryEntry = {
  id: NONE_ID, type: 'none', ruleName: 'No rule', ruleText: '', builtIn: true,
};

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
  holeRules, onHoleRulesChange, customRules, onCustomRulesChange,
}: RuleBuilderProps) {
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

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-condensed text-2xl font-black uppercase tracking-wider text-foreground">
          Hole <span className="text-primary">Rules</span>
        </h3>
        <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">
          Tap a hole to expand it, then pick the rule for that hole. Add the Item Box to as many holes as you like.
        </p>
      </div>

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

      {/* ── 18 holes as an accordion ── */}
      <Accordion type="single" collapsible className="space-y-2">
        {Array.from({ length: 18 }, (_, idx) => {
          const rule = holeRules[idx] ?? { type: 'none', ruleName: '', ruleText: '' };
          const isWheel = rule.type === 'wheel';
          const empty = rule.type === 'none' || !rule.ruleName;
          return (
            <AccordionItem
              key={idx}
              value={`hole-${idx}`}
              data-testid={`hole-rule-${idx + 1}`}
              className={`rounded-xl border px-3 overflow-hidden ${
                isWheel
                  ? 'border-primary/60 bg-primary/10'
                  : empty
                  ? 'border-border/50 bg-card/40'
                  : 'border-border bg-card'
              }`}
            >
              <AccordionTrigger className="py-3 hover:no-underline">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="font-condensed text-xl font-black text-primary leading-none w-6 shrink-0">
                    {idx + 1}
                  </span>
                  {isWheel && <Sparkles className="w-4 h-4 text-primary shrink-0" />}
                  <span className={`text-sm font-bold truncate ${empty ? 'text-muted-foreground/60' : 'text-foreground/90'}`}>
                    {empty ? 'No rule' : rule.ruleName}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                {!empty && rule.ruleText && (
                  <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">
                    {rule.ruleText}
                  </p>
                )}
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">
                  Assign rule
                </p>
                <div className="space-y-1.5">
                  {allEntries.map(entry => {
                    const selected = ruleMatchesEntry(rule, entry);
                    const wheel = isWheelEntry(entry);
                    const none = entry.type === 'none';
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => assign(idx, entry)}
                        data-testid={`assign-rule-${idx + 1}-${entry.id}`}
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
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
