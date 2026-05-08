import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useErrorTracking } from "@/hooks/useErrorTracking";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useAlertChecker } from "@/hooks/useAlertChecker";
import { AuthProvider } from "./contexts/AuthContext";
import ErrorBoundary from "./components/ErrorBoundary";
import BottomNavigation from "./components/BottomNavigation";
import PerformanceMonitor from "./components/PerformanceMonitor";

const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const StockDetail = lazy(() => import("./pages/StockDetail"));
const Earnings = lazy(() => import("./pages/Earnings"));
const Dividends = lazy(() => import("./pages/Dividends"));
const News = lazy(() => import("./pages/News"));
const Markets = lazy(() => import("./pages/Markets"));
const YishAI = lazy(() => import("./pages/YishAI"));
const Subscription = lazy(() => import("./pages/Subscription"));
const Settings = lazy(() => import("./pages/Settings"));
const Install = lazy(() => import("./pages/Install"));
const Social = lazy(() => import("./pages/Social"));
const Discussions = lazy(() => import("./pages/Discussions"));
const UserProfile = lazy(() => import("./pages/UserProfile"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const AdvancedAnalytics = lazy(() => import("./pages/AdvancedAnalytics"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: (failureCount, error: any) => {
        if (error?.status >= 400 && error?.status < 500) {
          return false;
        }
        return failureCount < 3;
      },
      refetchOnWindowFocus: false,
    },
  },
});

function RouteFallback() {
  return (
    <div
      className="flex min-h-[40vh] items-center justify-center text-muted-foreground"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
    </div>
  );
}

const AppContent = () => {
  useErrorTracking();
  useAnalytics();
  useAlertChecker();

  return (
    <div className="relative">
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/earnings" element={<Earnings />} />
          <Route path="/dividends" element={<Dividends />} />
          <Route path="/news" element={<News />} />
          <Route path="/markets" element={<Markets />} />
          <Route path="/yishai" element={<YishAI />} />
          <Route path="/subscription" element={<Subscription />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/install" element={<Install />} />
          <Route path="/social" element={<Social />} />
          <Route path="/discussions" element={<Discussions />} />
          <Route path="/profile/:userId" element={<UserProfile />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/analytics" element={<AdvancedAnalytics />} />
          <Route path="/stock/:symbol" element={<StockDetail />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <BottomNavigation />
      <PerformanceMonitor />
    </div>
  );
};

const App = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AppContent />
            </BrowserRouter>
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
