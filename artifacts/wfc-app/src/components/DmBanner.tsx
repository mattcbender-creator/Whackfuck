import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, MessageCircle } from 'lucide-react';
import { useLocation } from 'wouter';
import { useChatNotif } from '@/lib/chatContext';

export function DmBanner() {
  const { latestDm, markOpened } = useChatNotif();
  const [, navigate] = useLocation();
  const autoTimer = useRef<number | null>(null);

  // Auto-dismiss after 8 s
  useEffect(() => {
    if (!latestDm) return;
    if (autoTimer.current) window.clearTimeout(autoTimer.current);
    autoTimer.current = window.setTimeout(() => {
      markOpened();
    }, 8500);
    return () => {
      if (autoTimer.current) window.clearTimeout(autoTimer.current);
    };
  }, [latestDm?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTap = () => {
    markOpened();
    navigate('/chat');
  };

  return (
    <AnimatePresence>
      {latestDm && (
        <motion.div
          key={latestDm.id}
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          className="fixed top-3 left-0 right-0 z-[200] px-3"
          onClick={handleTap}
        >
          <div className="max-w-md mx-auto flex items-center gap-2.5 bg-zinc-900 border border-primary/30 rounded-2xl px-3 py-2.5 shadow-2xl cursor-pointer active:scale-[0.98] transition-transform">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
              <MessageCircle className="w-4 h-4 text-primary" strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black text-primary uppercase tracking-widest leading-none mb-0.5">
                {latestDm.fromTeamName}
              </p>
              <p className="text-[12px] text-foreground/80 truncate leading-snug">
                {latestDm.text}
              </p>
            </div>
            <button
              onClick={e => { e.stopPropagation(); markOpened(); }}
              className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-white/10 active:bg-white/20"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
