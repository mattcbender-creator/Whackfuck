import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useWFC } from '@/lib/store';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function Home() {
  const [, setLocation] = useLocation();
  const { setTeamInfo, teamInfo } = useWFC();
  const [isOpen, setIsOpen] = useState(false);
  const [teamName, setTeamName] = useState(teamInfo?.teamName || '');
  const [player1, setPlayer1] = useState(teamInfo?.player1 || '');
  const [player2, setPlayer2] = useState(teamInfo?.player2 || '');
  
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    setAnimate(true);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName || !player1 || !player2) return;
    setTeamInfo({ teamName, player1, player2 });
    setIsOpen(false);
    setLocation('/scorecard');
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center bg-background relative overflow-hidden">
      {/* Background Pattern */}
      <div 
        className="absolute inset-0 z-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle at center, var(--primary) 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }}
      />

      <div className="z-10 flex flex-col items-center text-center p-6 w-full max-w-md mx-auto">
        <div className={`transition-all duration-1000 transform ${animate ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
          <h1 className="font-condensed text-8xl md:text-9xl font-black leading-none text-foreground neon-text uppercase tracking-tighter">
            WHACK
            <br />
            <span className="text-primary">FUCK CUP</span>
          </h1>
          <p className="mt-6 text-muted-foreground font-medium tracking-widest text-sm uppercase">
            Dundee Country Club • New Dundee, ON
          </p>
        </div>

        <div className={`mt-16 w-full transition-all duration-1000 delay-300 transform ${animate ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
          <button
            data-testid="button-start-tournament"
            onClick={() => setIsOpen(true)}
            className="w-full bg-primary text-primary-foreground font-condensed text-2xl font-bold py-6 rounded-xl uppercase tracking-widest hover:bg-primary/90 transition-all neon-border active:scale-95"
          >
            {teamInfo ? 'Continue Tournament' : 'Start Tournament'}
          </button>
        </div>

        <div className={`mt-10 w-full bg-card/50 border border-border p-4 rounded-xl backdrop-blur-sm transition-all duration-1000 delay-500 transform ${animate ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
          <p className="text-sm text-card-foreground/80 leading-relaxed">
            <strong className="text-primary">Tee Rules:</strong> Net -5 or better shoots from <span className="text-foreground font-bold">Tips</span> • Everyone else shoots <span className="text-foreground font-bold">Women's</span> tees • Updates live as you score
          </p>
        </div>
      </div>

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="bottom" className="h-[80vh] rounded-t-3xl bg-card border-t-primary/20">
          <SheetHeader>
            <SheetTitle className="font-condensed text-3xl neon-text tracking-wider uppercase text-left">Team Registration</SheetTitle>
            <SheetDescription className="text-left">
              Enter your team details to hit the course.
            </SheetDescription>
          </SheetHeader>
          
          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Team Name</label>
              <Input 
                data-testid="input-team-name"
                value={teamName} 
                onChange={e => setTeamName(e.target.value)} 
                placeholder="e.g. The Mulligans"
                className="h-12 bg-input/50 border-border focus:border-primary focus:ring-primary text-lg"
                required
              />
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Player 1</label>
                <Input 
                  data-testid="input-player1"
                  value={player1} 
                  onChange={e => setPlayer1(e.target.value)}
                  className="h-12 bg-input/50 border-border focus:border-primary focus:ring-primary text-lg"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Player 2</label>
                <Input 
                  data-testid="input-player2"
                  value={player2} 
                  onChange={e => setPlayer2(e.target.value)}
                  className="h-12 bg-input/50 border-border focus:border-primary focus:ring-primary text-lg"
                  required
                />
              </div>
            </div>

            <Button 
              data-testid="button-submit-team"
              type="submit" 
              className="w-full h-14 font-condensed text-xl tracking-widest font-bold mt-4"
            >
              TEE OFF
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}