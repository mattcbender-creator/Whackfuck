import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useWFC } from '@/lib/store';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
const wfcLogo = `${import.meta.env.BASE_URL}wfc-logo.png`;

export default function Home() {
  const [, setLocation] = useLocation();
  const { setTeamInfo, teamInfo } = useWFC();
  const [isOpen, setIsOpen] = useState(false);
  const [teamName, setTeamName] = useState(teamInfo?.teamName || '');
  const [player1, setPlayer1] = useState(teamInfo?.player1 || '');
  const [player2, setPlayer2] = useState(teamInfo?.player2 || '');
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimate(true), 80);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName || !player1 || !player2) return;
    setTeamInfo({ teamName, player1, player2 });
    setIsOpen(false);
    setLocation('/hole');
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center bg-background relative overflow-hidden">
      {/* Subtle dot grid background */}
      <div
        className="absolute inset-0 z-0 pointer-events-none opacity-[0.07]"
        style={{
          backgroundImage: 'radial-gradient(circle, #39FF14 1px, transparent 1px)',
          backgroundSize: '36px 36px',
        }}
      />

      {/* Neon glow orb */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full pointer-events-none z-0"
        style={{ background: 'radial-gradient(circle, rgba(57,255,20,0.04) 0%, transparent 70%)' }}
      />

      <div className="z-10 flex flex-col items-center text-center px-6 w-full max-w-sm mx-auto gap-6">

        {/* Logo */}
        <div
          className={`transition-all duration-700 transform ${
            animate ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-6 opacity-0 scale-95'
          }`}
          style={{ filter: 'drop-shadow(0 0 24px rgba(57,255,20,0.25)) drop-shadow(0 0 48px rgba(57,255,20,0.1))' }}
        >
          <img
            src={wfcLogo}
            alt="WFC – Whack Fuck Cup"
            className="w-48 h-48 object-contain mx-auto"
            draggable={false}
          />
        </div>

        {/* Wordmark */}
        <div
          className={`transition-all duration-700 delay-100 transform ${
            animate ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
          }`}
        >
          <h1 className="font-condensed font-black leading-none uppercase tracking-tight text-foreground"
              style={{ fontSize: 'clamp(3rem, 16vw, 5rem)', textShadow: '0 0 40px rgba(57,255,20,0.2)' }}>
            WHACK<br />
            <span className="text-primary" style={{ textShadow: '0 0 20px #39FF14, 0 0 60px rgba(57,255,20,0.4)' }}>
              FUCK CUP
            </span>
          </h1>
          <p className="mt-3 text-muted-foreground tracking-widest text-xs uppercase font-medium">
            Dundee Country Club · New Dundee, ON
          </p>
        </div>

        {/* CTA */}
        <div
          className={`w-full transition-all duration-700 delay-200 transform ${
            animate ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
          }`}
        >
          <button
            data-testid="button-start-tournament"
            onClick={() => setIsOpen(true)}
            className="w-full bg-primary text-primary-foreground font-condensed text-2xl font-black py-5 rounded-xl uppercase tracking-widest transition-all active:scale-95"
            style={{ boxShadow: '0 0 20px rgba(57,255,20,0.4), 0 0 60px rgba(57,255,20,0.15)' }}
          >
            {teamInfo ? 'Continue Round' : 'Start Tournament'}
          </button>

          {teamInfo && (
            <p className="mt-2 text-xs text-muted-foreground">
              {teamInfo.teamName} · {teamInfo.player1} & {teamInfo.player2}
            </p>
          )}
        </div>

        {/* Tee rule */}
        <div
          className={`w-full transition-all duration-700 delay-300 transform ${
            animate ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
          }`}
        >
          <div className="bg-card/60 border border-border/60 rounded-xl p-4 text-left">
            <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2">Tee Assignment Rule</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-16 text-[10px] font-bold text-red-400 uppercase tracking-wide shrink-0">Tips</span>
                <span className="text-xs text-muted-foreground">Net score -5 or better</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-16 text-[10px] font-bold text-blue-400 uppercase tracking-wide shrink-0">Women's</span>
                <span className="text-xs text-muted-foreground">Everyone else</span>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground/60 mt-2">Updates automatically as you score each hole.</p>
          </div>
        </div>
      </div>

      {/* Team Setup Sheet */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="bottom" className="h-auto rounded-t-3xl bg-card border-t border-border">
          <SheetHeader className="text-left pb-2">
            <SheetTitle className="font-condensed text-3xl neon-text tracking-wider uppercase">
              Team Registration
            </SheetTitle>
            <SheetDescription>
              Enter your team details before teeing off.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5 pb-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Team Name</label>
              <Input
                data-testid="input-team-name"
                value={teamName}
                onChange={e => setTeamName(e.target.value)}
                placeholder="e.g. The Mulligans"
                className="h-12 bg-input/60 border-border/80 focus:border-primary text-base"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Player 1</label>
                <Input
                  data-testid="input-player1"
                  value={player1}
                  onChange={e => setPlayer1(e.target.value)}
                  placeholder="Name"
                  className="h-12 bg-input/60 border-border/80 focus:border-primary text-base"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Player 2</label>
                <Input
                  data-testid="input-player2"
                  value={player2}
                  onChange={e => setPlayer2(e.target.value)}
                  placeholder="Name"
                  className="h-12 bg-input/60 border-border/80 focus:border-primary text-base"
                  required
                />
              </div>
            </div>

            <Button
              data-testid="button-submit-team"
              type="submit"
              className="w-full h-14 font-condensed text-xl font-black tracking-widest uppercase mt-2"
              style={{ boxShadow: '0 0 16px rgba(57,255,20,0.3)' }}
            >
              Tee Off
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
