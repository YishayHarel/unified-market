import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useErrorTracking } from "@/hooks/useErrorTracking";
import { useAnalytics } from "@/hooks/useAnalytics";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import StockDetail from "./pages/StockDetail";
import Earnings from "./pages/Earnings";
import Dividends from "./pages/Dividends";
import News from "./pages/News";
import Markets from "./pages/Markets";
import YishAI from "./pages/YishAI";
import Subscription from "./pages/Subscription";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import BottomNavigation from "./components/BottomNavigation";
import PerformanceMonitor from "./components/PerformanceMonitor";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors
        if (error?.status >= 400 && error?.status < 500) {
          return false;
        }
        return failureCount < 3;
      },
      refetchOnWindowFocus: false,
    },
  },
});

const AppContent = () => {
  useErrorTracking();
  useAnalytics();

  return (
    <div className="relative">
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
              <Route path="/stock/:symbol" element={<StockDetail />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
      </Routes>
      <BottomNavigation />
      <PerformanceMonitor />
    </div>
  );
};

const App = () => {
  console.log('🎯 App component mounting...');
  
  return (
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
  );
};

export default App;
