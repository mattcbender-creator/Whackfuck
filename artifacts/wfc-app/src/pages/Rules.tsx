import useEmblaCarousel from 'embla-carousel-react';
import { useCourse } from '@/lib/tournamentContext';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

export default function Rules() {
  const { holes: HOLES, holeRules, trackYardages, autoTeeRule } = useCourse();
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false, align: 'center' });
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Intro cards are opt-in: the tee card only when this tournament uses the
  // WFC auto-tee rule, and the Item Box cards only when at least one hole
  // carries the wheel. The carousel label + bounds derive from which exist.
  const anyWheelHole = holeRules.some(r => r?.type === 'wheel');
  const introLabels: string[] = [];
  if (autoTeeRule) introLabels.push('TEE');
  if (anyWheelHole) introLabels.push('BOX', 'ITEMS');
  const introCount = introLabels.length;

  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext();
  }, [emblaApi]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi, setSelectedIndex]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
  }, [emblaApi, onSelect]);

  return (
    <div className="min-h-[100dvh] w-full bg-background flex flex-col pb-16 overflow-hidden">
      <div className="p-4 pt-8 shrink-0 text-center">
        <h2 className="font-condensed text-4xl font-black uppercase tracking-widest text-foreground">
          Rule <span className="text-primary">Deck</span>
        </h2>
        <p className="text-sm text-muted-foreground mt-2 uppercase tracking-widest font-bold">
          Ignorance is not an excuse
        </p>
      </div>

      <div className="flex-1 flex flex-col justify-center w-full relative">
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex touch-pan-y h-full">
            {/* ── Intro card 1: How Tees Work (auto-tee tournaments only) ── */}
            {autoTeeRule && (
            <div className="flex-[0_0_85%] min-w-0 pl-4 relative h-[60vh]">
              <div className="h-full bg-card border-2 border-primary/50 rounded-2xl p-6 flex flex-col justify-between shadow-xl relative overflow-hidden">
                <div className="absolute -top-10 -right-10 font-condensed text-[200px] font-black text-primary/5 pointer-events-none leading-none select-none">
                  TEE
                </div>

                <div>
                  <div className="flex justify-between items-start mb-5">
                    <span className="font-condensed text-5xl font-black text-primary leading-none">
                      HOW TEES WORK
                    </span>
                  </div>

                  <div className="space-y-3 text-card-foreground/90 text-base leading-relaxed font-medium">
                    <p>
                      Your tee block is set by your <span className="font-black text-primary">raw scorecard vs par</span>.
                    </p>
                    <div className="bg-secondary/40 rounded-xl p-3 border border-border/50 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-condensed text-base font-black text-red-400 uppercase tracking-widest w-20">Tips</span>
                        <span className="text-sm">Raw score under par</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-condensed text-base font-black text-blue-400 uppercase tracking-widest w-20">Women's</span>
                        <span className="text-sm">Raw score at par or over</span>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground leading-snug">
                      Wheel items hit your <span className="font-bold text-foreground/80">net</span> score only — they <span className="font-bold text-foreground/80">never</span> move your tee block.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            )}

            {/* ── Intro card 2: Item Box rules (wheel tournaments only) ── */}
            {anyWheelHole && (
            <div className="flex-[0_0_85%] min-w-0 pl-4 relative h-[60vh]">
              <div className="h-full bg-card border-2 border-primary/50 rounded-2xl p-6 flex flex-col justify-between shadow-xl relative overflow-hidden">
                <div className="absolute -top-10 -right-10 font-condensed text-[200px] font-black text-primary/5 pointer-events-none leading-none select-none">
                  BOX
                </div>

                <div>
                  <div className="flex justify-between items-start mb-5">
                    <span className="font-condensed text-5xl font-black text-primary leading-none">
                      ITEM BOX RULES
                    </span>
                  </div>

                  <div className="space-y-3 text-card-foreground/90 text-base leading-relaxed font-medium">
                    <p>
                      Some holes are <span className="font-black text-primary">Item Box</span> holes. Enter your score on one and you spin the wheel <span className="font-black text-primary">once</span>.
                    </p>
                    <ul className="space-y-2 text-sm">
                      <li className="flex gap-2">
                        <span className="text-primary font-black">›</span>
                        <span>One spin per Item Box hole</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-primary font-black">›</span>
                        <span>Items add / subtract <span className="font-bold">net</span> strokes only</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-primary font-black">›</span>
                        <span>Items <span className="font-bold">never</span> move your tee block</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-primary font-black">›</span>
                        <span>Targets are random or auto — no opt-outs</span>
                      </li>
                    </ul>
                    <p className="text-sm text-muted-foreground leading-snug">
                      Hit appears on your scorecard. Tap it. Take your medicine.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            )}

            {/* ── Intro card 3: The 8 items (wheel tournaments only) ── */}
            {anyWheelHole && (
            <div className="flex-[0_0_85%] min-w-0 pl-4 relative h-[60vh]">
              <div className="h-full bg-card border-2 border-primary/50 rounded-2xl p-6 flex flex-col justify-between shadow-xl relative overflow-hidden">
                <div className="absolute -top-10 -right-10 font-condensed text-[200px] font-black text-primary/5 pointer-events-none leading-none select-none">
                  8
                </div>

                <div>
                  <div className="flex justify-between items-start mb-4">
                    <span className="font-condensed text-5xl font-black text-primary leading-none">
                      THE 8 ITEMS
                    </span>
                  </div>

                  <div className="space-y-1.5 text-[13px] leading-snug font-medium">
                    <div className="flex gap-2">
                      <span className="font-condensed font-black uppercase tracking-wider w-24 shrink-0" style={{ color: '#2ecc40' }}>Green</span>
                      <span className="text-card-foreground/90">+1 to a random team</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="font-condensed font-black uppercase tracking-wider w-24 shrink-0" style={{ color: '#e63946' }}>Red</span>
                      <span className="text-card-foreground/90">Pick any team, +1</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="font-condensed font-black uppercase tracking-wider w-24 shrink-0" style={{ color: '#2a9df4' }}>Blue</span>
                      <span className="text-card-foreground/90">+1 to current leader</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="font-condensed font-black uppercase tracking-wider w-24 shrink-0" style={{ color: '#f4d35e' }}>Banana</span>
                      <span className="text-card-foreground/90">+1 to a random other team</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="font-condensed font-black uppercase tracking-wider w-24 shrink-0" style={{ color: '#3aa1ff' }}>Lightning</span>
                      <span className="text-card-foreground/90">+1 to <span className="font-bold">all</span> other teams</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="font-condensed font-black uppercase tracking-wider w-24 shrink-0" style={{ color: '#ff7043' }}>Mushroom</span>
                      <span className="text-card-foreground/90">−1 off your net score</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="font-condensed font-black uppercase tracking-wider w-24 shrink-0" style={{ color: '#ffd700' }}>Star</span>
                      <span className="text-card-foreground/90">−2 off your net score</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="font-condensed font-black uppercase tracking-wider w-24 shrink-0" style={{ color: '#a05ec6' }}>Boo</span>
                      <span className="text-card-foreground/90">Steal 1: their +1, your −1</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-snug mt-3 pt-3 border-t border-border/40">
                    Random targets are blind — no "behind you" bias. Red Shell picker hides scores so you pick a rival, not a rank.
                  </p>
                </div>
              </div>
            </div>
            )}

            {HOLES.map((hole, idx) => {
              const rule = holeRules[idx];
              const isWheel = rule?.type === 'wheel';
              const ruleName = rule && rule.type !== 'none' ? rule.ruleName : '';
              const ruleText = rule && rule.type !== 'none' ? rule.ruleText : 'This hole plays as a standard hole.';
              const ruleLen = ruleText.length;
              const ruleNameLen = ruleName.length;
              // Tighten spacing and shrink text for longer rules
              const isLong = ruleLen > 130;
              const isVeryLong = ruleLen > 200;
              const headerMb = isLong ? 'mb-3' : 'mb-6';
              const titleMb = isLong ? 'mb-3' : 'mb-5';
              const titleSize = ruleNameLen > 22 ? 'text-3xl' : 'text-4xl';
              const ruleTextClass = isVeryLong
                ? 'text-sm leading-snug'
                : isLong
                ? 'text-[15px] leading-snug'
                : 'text-base leading-relaxed';
              return (
                <div key={hole.hole} className="flex-[0_0_85%] min-w-0 pl-4 relative h-[60vh]">
                  <div className={`h-full bg-card border rounded-2xl p-5 flex flex-col shadow-xl relative overflow-hidden ${isWheel ? 'border-primary/60' : 'border-border'}`}>
                    {/* Big background number */}
                    <div className="absolute -top-10 -right-10 font-condensed text-[200px] font-black text-primary/5 pointer-events-none leading-none select-none">
                      {hole.hole}
                    </div>

                    <div className={`flex justify-between items-start ${headerMb}`}>
                      <span className="font-condensed text-6xl font-black text-primary leading-none">
                        #{hole.hole.toString().padStart(2, '0')}
                      </span>
                      <div className="text-right">
                        <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Par {hole.par}</div>
                        {trackYardages && (
                          <div className="text-sm font-condensed font-bold mt-1">{hole.tips} / {hole.womens} YDS</div>
                        )}
                      </div>
                    </div>

                    {isWheel && (
                      <div className="flex items-center gap-1.5 mb-2">
                        <Sparkles className="w-4 h-4 text-primary" />
                        <span className="text-[10px] font-black text-primary uppercase tracking-widest">Item Box Hole</span>
                      </div>
                    )}

                    {ruleName && (
                      <h3 className={`font-condensed ${titleSize} font-bold uppercase tracking-tight leading-none ${titleMb}`}>
                        {ruleName}
                      </h3>
                    )}

                    <p className={`${ruleTextClass} text-card-foreground/90 font-medium`}>
                      {ruleText}
                    </p>
                  </div>
                </div>
              );
            })}
            {/* Empty padding at the end to allow last slide to center */}
            <div className="flex-[0_0_15%] min-w-0" />
          </div>
        </div>

        {/* Controls */}
        <div className="absolute bottom-4 left-0 right-0 flex justify-center items-center gap-6">
          <button 
            onClick={scrollPrev}
            disabled={selectedIndex === 0}
            className="w-12 h-12 flex items-center justify-center rounded-full bg-secondary text-secondary-foreground disabled:opacity-30 transition-opacity"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          
          <div className="font-condensed text-xl font-bold tracking-widest">
            {selectedIndex < introCount
              ? introLabels[selectedIndex]
              : `${selectedIndex - introCount + 1} / 18`}
          </div>

          <button 
            onClick={scrollNext}
            disabled={selectedIndex === HOLES.length + introCount - 1}
            data-testid="button-rule-next"
            className="w-12 h-12 flex items-center justify-center rounded-full bg-secondary text-secondary-foreground disabled:opacity-30 transition-opacity"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
}