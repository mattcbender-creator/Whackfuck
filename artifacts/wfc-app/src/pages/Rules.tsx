import useEmblaCarousel from 'embla-carousel-react';
import { HOLES } from '@/lib/holes';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

export default function Rules() {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false, align: 'center' });
  const [selectedIndex, setSelectedIndex] = useState(0);

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
            {HOLES.map((hole) => (
              <div key={hole.hole} className="flex-[0_0_85%] min-w-0 pl-4 relative h-[60vh]">
                <div className="h-full bg-card border border-border rounded-2xl p-6 flex flex-col justify-between shadow-xl relative overflow-hidden">
                  {/* Big background number */}
                  <div className="absolute -top-10 -right-10 font-condensed text-[200px] font-black text-primary/5 pointer-events-none leading-none select-none">
                    {hole.hole}
                  </div>

                  <div>
                    <div className="flex justify-between items-start mb-8">
                      <span className="font-condensed text-6xl font-black text-primary leading-none">
                        #{hole.hole.toString().padStart(2, '0')}
                      </span>
                      <div className="text-right">
                        <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Par {hole.par}</div>
                        <div className="text-sm font-condensed font-bold mt-1">{hole.tips} / {hole.womens} YDS</div>
                      </div>
                    </div>

                    <h3 className="font-condensed text-4xl font-bold uppercase tracking-tight leading-none mb-6">
                      {hole.ruleName}
                    </h3>
                    
                    <p className="text-lg text-card-foreground/90 leading-relaxed font-medium">
                      {hole.rule}
                    </p>
                  </div>
                </div>
              </div>
            ))}
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
            {selectedIndex + 1} / 18
          </div>

          <button 
            onClick={scrollNext}
            disabled={selectedIndex === HOLES.length - 1}
            className="w-12 h-12 flex items-center justify-center rounded-full bg-secondary text-secondary-foreground disabled:opacity-30 transition-opacity"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
}