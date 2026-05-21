import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useWFC } from '@/lib/store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Users, RotateCcw } from 'lucide-react';

const wfcLogo = `${import.meta.env.BASE_URL}wfc-logo.png`;

export default function Home() {
  const [, setLocation] = useLocation();
  const { setTeamInfo, teamInfo, resetScores } = useWFC();
  const [teamName, setTeamName] = useState('');
  const [player1, setPlayer1] = useState('');
  const [player2, setPlayer2] = useState('');
  const [animate, setAnimate] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimate(true), 80);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (teamInfo) {
      setTeamName(teamInfo.teamName);
      setPlayer1(teamInfo.player1);
      setPlayer2(teamInfo.player2);
    }
  }, [teamInfo]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim() || !player1.trim() || !player2.trim()) return;
    setTeamInfo({ teamName: teamName.trim(), player1: player1.trim(), player2: player2.trim() });
    setEditing(false);
    setLocation('/hole');
  };

  const showForm = !teamInfo || editing;

  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center bg-background relative overflow-hidden px-6">

      {/* Dot grid background */}
      <div
        className="absolute inset-0 z-0 pointer-events-none opacity-[0.06]"
        style={{
          backgroundImage: 'radial-gradient(circle, #39FF14 1px, transparent 1px)',
          backgroundSize: '36px 36px',
        }}
      />
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full pointer-events-none z-0"
        style={{ background: 'radial-gradient(circle, rgba(57,255,20,0.05) 0%, transparent 70%)' }}
      />

      <div className="z-10 flex flex-col items-center text-center w-full max-w-sm mx-auto gap-5">

        {/* Logo */}
        <div
          className={`transition-all duration-700 transform ${animate ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-6 opacity-0 scale-95'}`}
          style={{ filter: 'drop-shadow(0 0 24px rgba(57,255,20,0.28)) drop-shadow(0 0 52px rgba(57,255,20,0.10))' }}
        >
          <img
            src={wfcLogo}
            alt="WFC – Whack Fuck Cup"
            className="w-44 h-44 object-contain mx-auto"
            draggable={false}
          />
        </div>

        {/* Wordmark */}
        <div className={`transition-all duration-700 delay-100 transform ${animate ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
          <h1
            className="font-condensed font-black leading-[0.9] uppercase tracking-tight text-foreground"
            style={{ fontSize: 'clamp(2.8rem, 15vw, 4.8rem)' }}
          >
            WHACK FUCK CUP
          </h1>
          <p className="mt-3 text-muted-foreground tracking-widest text-[11px] uppercase font-medium">
            Dundee Country Club · Minus 5 or better = Tips
          </p>
        </div>

        {/* ── Team already registered ── */}
        {teamInfo && !editing && (
          <div className={`w-full transition-all duration-700 delay-200 transform ${animate ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>

            {/* Team card */}
            <div className="bg-card border border-border/60 rounded-2xl p-4 text-left mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Your Team</span>
              </div>
              <p className="font-condensed text-2xl font-black text-foreground uppercase tracking-wide leading-tight">
                {teamInfo.teamName}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {teamInfo.player1} &amp; {teamInfo.player2}
              </p>
            </div>

            <button
              data-testid="button-start-tournament"
              onClick={() => setLocation('/hole')}
              className="w-full bg-primary text-primary-foreground font-condensed text-2xl font-black py-5 rounded-full uppercase tracking-widest transition-all active:scale-95 neon-border"
            >
              Continue Round
            </button>

            <div className="flex gap-3 mt-3">
              <button
                onClick={() => setEditing(true)}
                className="flex-1 py-3 rounded-full bg-secondary text-secondary-foreground font-condensed font-bold uppercase tracking-widest text-sm hover:bg-secondary/80 transition-colors"
              >
                Change Team
              </button>
              <button
                onClick={() => {
                  if (confirm('Reset all scores and start fresh?')) {
                    resetScores();
                    setTeamName('');
                    setPlayer1('');
                    setPlayer2('');
                  }
                }}
                className="px-5 py-3 rounded-full bg-secondary text-muted-foreground font-condensed font-bold uppercase tracking-widest text-sm hover:bg-secondary/80 transition-colors flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
            </div>
          </div>
        )}

        {/* ── Registration form ── */}
        {showForm && (
          <div className={`w-full transition-all duration-700 delay-200 transform ${animate ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5 text-left">
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
                <div className="space-y-1.5 text-left">
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
                <div className="space-y-1.5 text-left">
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
                className="w-full h-14 font-condensed text-2xl font-black tracking-widest uppercase rounded-full neon-border"
              >
                Start Tournament
              </Button>

              {editing && (
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                >
                  Cancel
                </button>
              )}
            </form>
          </div>
        )}

        {/* ── Tee rule note (only when no form) ── */}
        {!showForm && (
          <p className={`text-[10px] text-muted-foreground/60 transition-all duration-700 delay-300 ${animate ? 'opacity-100' : 'opacity-0'}`}>
            Tee auto-updates as you score each hole.
          </p>
        )}

        {showForm && (
          <div className={`w-full transition-all duration-700 delay-300 transform ${animate ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
            <div className="bg-card/40 border border-border/40 rounded-xl p-3 text-left">
              <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1.5">Tee Assignment</p>
              <div className="flex gap-4">
                <div>
                  <span className="text-[10px] font-bold text-red-400 uppercase tracking-wide">Tips</span>
                  <span className="text-[10px] text-muted-foreground ml-2">Net -5 or better</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wide">Women's</span>
                  <span className="text-[10px] text-muted-foreground ml-2">Everyone else</span>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
