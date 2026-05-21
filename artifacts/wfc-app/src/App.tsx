import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { StoreProvider } from "@/lib/store";
import { useEffect } from "react";

import Home from "@/pages/Home";
import Scorecard from "@/pages/Scorecard";
import Leaderboard from "@/pages/Leaderboard";
import CourseMap from "@/pages/CourseMap";
import Rules from "@/pages/Rules";
import Stats from "@/pages/Stats";
import Admin from "@/pages/Admin";
import NotFound from "@/pages/not-found";
import { BottomNav } from "@/components/BottomNav";

const queryClient = new QueryClient();

function Router() {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/scorecard" component={Scorecard} />
        <Route path="/leaderboard" component={Leaderboard} />
        <Route path="/map" component={CourseMap} />
        <Route path="/rules" component={Rules} />
        <Route path="/stats" component={Stats} />
        <Route path="/admin" component={Admin} />
        <Route component={NotFound} />
      </Switch>
      <BottomNav />
    </div>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <StoreProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </StoreProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;