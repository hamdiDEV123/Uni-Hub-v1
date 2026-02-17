import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import { AppLayout } from "@/components/layout/AppLayout"; // الربط هنا بقى سليم ✅

import Index from "./pages/Index";
import Marketplace from "./pages/Marketplace";
import Dashboard from "./pages/Dashboard";
import Delivery from "./pages/Delivery";
import Housing from "./pages/Housing";
import Sports from "./pages/Sports";
import Notifications from "./pages/Notifications";
import AdminLegacy from "./pages/Admin";
import Profile from "./pages/Profile"; 
import NotFound from "./pages/NotFound";
import MarketplaceV2 from "./pages/marketplace/MarketplaceV2";
import ProductLanding from "./pages/marketplace/ProductLanding";
import MarketplaceCheckoutV2 from "./pages/marketplace/MarketplaceCheckoutV2";
import AdminMarketplaceConsoleV2 from "./pages/admin/AdminMarketplaceConsoleV2";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/" replace />;
  return <AppLayout>{children}</AppLayout>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/marketplace" element={<ProtectedRoute><MarketplaceV2 /></ProtectedRoute>} />
            <Route path="/marketplace/legacy" element={<ProtectedRoute><Marketplace /></ProtectedRoute>} />
            <Route path="/marketplace/product/:id" element={<ProtectedRoute><ProductLanding /></ProtectedRoute>} />
            <Route path="/marketplace/checkout" element={<ProtectedRoute><MarketplaceCheckoutV2 /></ProtectedRoute>} />
            <Route path="/delivery" element={<ProtectedRoute><Delivery /></ProtectedRoute>} />
            <Route path="/housing" element={<ProtectedRoute><Housing /></ProtectedRoute>} />
            <Route path="/sports" element={<ProtectedRoute><Sports /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><AdminMarketplaceConsoleV2 /></ProtectedRoute>} />
            <Route path="/admin/marketplace" element={<ProtectedRoute><AdminMarketplaceConsoleV2 /></ProtectedRoute>} />
            <Route path="/admin/legacy" element={<ProtectedRoute><AdminLegacy /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
