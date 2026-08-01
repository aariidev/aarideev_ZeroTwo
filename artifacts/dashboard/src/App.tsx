import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import { AuthGate } from "@/components/auth-gate";
import { AppLayout } from "@/components/layout/app-layout";
import Home from "@/pages/home";
import Guilds from "@/pages/guilds";
import GuildDetail from "@/pages/guild-detail";
import Commands from "@/pages/commands";
import Warns from "@/pages/warns";
import DevPanel from "@/pages/dev";
import Logs from "@/pages/logs";
import TicketsPage from "@/pages/tickets";
import SettingsPage from "@/pages/settings";
import AccountPage from "@/pages/account";
import BetaPage from "@/pages/beta";
import LoginPage from "@/pages/login";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, err) => {
        // Don't hammer on 401
        const status = (err as { status?: number })?.status;
        if (status === 401) return false;
        return count < 2;
      },
    },
  },
});

function ProtectedRouter() {
  return (
    <AuthGate>
      <AppLayout>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/guilds" component={Guilds} />
          <Route path="/guilds/:id" component={GuildDetail} />
          <Route path="/commands" component={Commands} />
          <Route path="/warns" component={Warns} />
          <Route path="/tickets" component={TicketsPage} />
          <Route path="/beta" component={BetaPage} />
          <Route path="/logs" component={Logs} />
          <Route path="/dev" component={DevPanel} />
          <Route path="/account" component={AccountPage} />
          <Route path="/settings" component={SettingsPage} />
          <Route path="/login" component={LoginPage} />
          <Route component={NotFound} />
        </Switch>
      </AppLayout>
    </AuthGate>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <AuthProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <ProtectedRouter />
            </WouterRouter>
            <Toaster />
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
