import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import StockDetail from "./pages/StockDetail";
import Earnings from "./pages/Earnings";
import Dividends from "./pages/Dividends";
import News from "./pages/News";
import Markets from "./pages/Markets";
import NotFound from "./pages/NotFound";
import BottomNavigation from "./components/BottomNavigation";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <div className="relative">
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/earnings" element={
                <ProtectedRoute>
                  <Earnings />
                </ProtectedRoute>
              } />
              <Route path="/dividends" element={
                <ProtectedRoute>
                  <Dividends />
                </ProtectedRoute>
              } />
              <Route path="/news" element={<News />} />
              <Route path="/markets" element={
                <ProtectedRoute>
                  <Markets />
                </ProtectedRoute>
              } />
              <Route path="/stock/:symbol" element={<StockDetail />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            <BottomNavigation />
          </div>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
