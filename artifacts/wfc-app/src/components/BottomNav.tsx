import { Link, useLocation } from 'wouter';
import { Home, ClipboardList, Trophy, Flag, BookOpen } from 'lucide-react';

export function BottomNav() {
  const [location] = useLocation();

  const tabs = [
    { href: '/',           icon: Home,          label: 'Home',      testid: 'tab-home' },
    { href: '/hole',       icon: Flag,          label: 'Hole',      testid: 'tab-hole' },
    { href: '/scorecard',  icon: ClipboardList, label: 'Scorecard', testid: 'tab-scorecard' },
    { href: '/leaderboard',icon: Trophy,        label: 'Live',      testid: 'tab-leaderboard' },
    { href: '/rules',      icon: BookOpen,      label: 'Rules',     testid: 'tab-rules' },
  ];

  if (location === '/') return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/98 backdrop-blur supports-[backdrop-filter]:bg-background/90 border-t border-border">
      <div className="flex justify-around items-center h-16 max-w-md mx-auto px-1">
        {tabs.map((tab) => {
          const isActive = location === tab.href;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              data-testid={tab.testid}
              className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all active:scale-90 ${
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground/70'
              }`}
            >
              <div className={`relative ${isActive ? 'drop-shadow-[0_0_6px_#39FF14]' : ''}`}>
                <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 1.8} />
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                )}
              </div>
              <span className={`text-[9px] font-bold tracking-widest uppercase font-condensed leading-none mt-0.5 ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
