import { Switch, Route, Redirect, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { StoreProvider } from "@/lib/store";
import { TournamentProvider, useTournament } from "@/lib/tournamentContext";
import { useEffect, type ReactNode } from "react";

import Landing from "@/pages/Landing";
import CreateTournament from "@/pages/CreateTournament";
import JoinTournament from "@/pages/JoinTournament";
import Home from "@/pages/Home";
import Scorecard from "@/pages/Scorecard";
import Leaderboard from "@/pages/Leaderboard";
import HoleView from "@/pages/HoleView";
import Rules from "@/pages/Rules";
import Stats from "@/pages/Stats";
import Admin from "@/pages/Admin";
import Results from "@/pages/Results";
import NotFound from "@/pages/not-found";
import { BottomNav } from "@/components/BottomNav";
import { LiveTicker } from "@/components/LiveTicker";

const queryClient = new QueryClient();

// Gameplay routes require an active tournament. Scoring routes additionally
// block spectators (redirect them to the leaderboard).
function Guard({ children, allowSpectator = false, blockOnFinal = false }: { children: ReactNode; allowSpectator?: boolean; blockOnFinal?: boolean }) {
  const { activeId, isSpectator, tournament } = useTournament();
  if (!activeId) return <Redirect to="/" />;
  if (blockOnFinal && tournament?.status === 'final') return <Redirect to="/results" />;
  if (isSpectator && !allowSpectator) return <Redirect to="/leaderboard" />;
  return <>{children}</>;
}

function Router() {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <LiveTicker />
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/create" component={CreateTournament} />
        <Route path="/join" component={JoinTournament} />
        <Route path="/join/:code" component={JoinTournament} />
        <Route path="/join/:code/:teamCode" component={JoinTournament} />
        <Route path="/watch/:code" component={JoinTournament} />

        <Route path="/home">
          <Guard blockOnFinal><Home /></Guard>
        </Route>
        <Route path="/scorecard">
          <Guard blockOnFinal><Scorecard /></Guard>
        </Route>
        <Route path="/hole">
          <Guard blockOnFinal><HoleView /></Guard>
        </Route>
        <Route path="/results">
          <Guard allowSpectator><Results /></Guard>
        </Route>
        <Route path="/leaderboard">
          <Guard allowSpectator><Leaderboard /></Guard>
        </Route>
        <Route path="/rules">
          <Guard allowSpectator><Rules /></Guard>
        </Route>
        <Route path="/stats">
          <Guard allowSpectator><Stats /></Guard>
        </Route>
        <Route path="/admin">
          <Guard allowSpectator><Admin /></Guard>
        </Route>
        <Route component={NotFound} />
      </Switch>
      <BottomNav />
    </div>
  );
}

function AppInner() {
  const { activeId } = useTournament();
  return (
    <StoreProvider key={activeId ?? "__none__"}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Router />
      </WouterRouter>
      <Toaster />
    </StoreProvider>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <TournamentProvider>
          <AppInner />
        </TournamentProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
