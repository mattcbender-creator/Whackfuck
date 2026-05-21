import { Link, useLocation } from 'wouter';
import { Home, ClipboardList, Trophy, Map as MapIcon, BookOpen } from 'lucide-react';

export function BottomNav() {
  const [location] = useLocation();

  const tabs = [
    { href: '/', icon: Home, label: 'Home', testid: 'tab-home' },
    { href: '/scorecard', icon: ClipboardList, label: 'Score', testid: 'tab-scorecard' },
    { href: '/leaderboard', icon: Trophy, label: 'Live', testid: 'tab-leaderboard' },
    { href: '/map', icon: MapIcon, label: 'Map', testid: 'tab-map' },
    { href: '/rules', icon: BookOpen, label: 'Rules', testid: 'tab-rules' },
  ];

  if (location === '/') return null; // Don't show on home

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-t border-border pb-safe">
      <div className="flex justify-around items-center h-16 max-w-md mx-auto">
        {tabs.map((tab) => {
          const isActive = location === tab.href;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              data-testid={tab.testid}
              className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${
                isActive ? 'text-primary glow-green' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium font-condensed tracking-wider uppercase">
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}