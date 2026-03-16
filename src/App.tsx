import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GlowingCursor } from "@/components/ui/GlowingCursor";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import { AppLayout } from "@/components/layout/AppLayout";
import { RouteErrorBoundary } from "@/components/errors/RouteErrorBoundary";
import { useQuery } from "@tanstack/react-query";
import { callRpc } from "@/backend/rpc";

const Index = lazy(() => import("./pages/Index"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Delivery = lazy(() => import("./pages/Delivery"));
const Housing = lazy(() => import("./pages/Housing"));
const Sports = lazy(() => import("./pages/Sports"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Profile = lazy(() => import("./pages/Profile"));
const Auth = lazy(() => import("./pages/Auth"));
const Chat = lazy(() => import("./pages/chat"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Marketplace = lazy(() => import("./pages/marketplace/MarketplaceV2"));
const MarketplaceCheckout = lazy(() => import("./pages/marketplace/MarketplaceCheckoutV2"));
const MarketplaceProduct = lazy(() => import("./pages/marketplace/ProductLanding"));
const MarketplaceOrders = lazy(() => import("./pages/marketplace/MarketplaceOrdersV2"));
const AdminMarketplaceConsole = lazy(() => import("./pages/admin/AdminMarketplaceConsoleV2"));
const DesignSystem = lazy(() => import("./pages/DesignSystem"));

const queryClient = new QueryClient();

const RouteLoading = () => (
  <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground" dir="rtl">
    {"جاري تحميل الصفحة..."}
  </div>
);

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  return (
    <AppLayout>
      {children}
    </AppLayout>
  );
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { data: isAdmin, isLoading } = useQuery({
    queryKey: ["is-admin-route", user?.id ?? ""],
    enabled: !!user?.id,
    queryFn: async () => {
      if (!user?.id) return false;
      return callRpc("has_role", { _user_id: user.id, _role: "admin" });
    },
  });

  if (loading || isLoading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return <AppLayout>{children}</AppLayout>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <GlowingCursor />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route
                path="/marketplace"
                element={
                  <ProtectedRoute>
                    <RouteErrorBoundary routeName="السوق">
                      <Marketplace />
                    </RouteErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/marketplace/product/:id"
                element={
                  <ProtectedRoute>
                    <RouteErrorBoundary routeName="تفاصيل المنتج">
                      <MarketplaceProduct />
                    </RouteErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/marketplace/checkout"
                element={
                  <ProtectedRoute>
                    <RouteErrorBoundary routeName="إتمام الشراء">
                      <MarketplaceCheckout />
                    </RouteErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/marketplace/orders"
                element={
                  <ProtectedRoute>
                    <RouteErrorBoundary routeName="الطلبات">
                      <MarketplaceOrders />
                    </RouteErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route path="/delivery" element={<ProtectedRoute><Delivery /></ProtectedRoute>} />
              <Route path="/housing" element={<ProtectedRoute><Housing /></ProtectedRoute>} />
              <Route path="/sports" element={<ProtectedRoute><Sports /></ProtectedRoute>} />
              <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
              <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/design-system" element={<ProtectedRoute><DesignSystem /></ProtectedRoute>} />
              <Route
                path="/admin"
                element={
                  <AdminRoute>
                    <RouteErrorBoundary routeName="لوحة إدارة السوق">
                      <AdminMarketplaceConsole />
                    </RouteErrorBoundary>
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/marketplace"
                element={
                  <AdminRoute>
                    <RouteErrorBoundary routeName="لوحة إدارة السوق">
                      <AdminMarketplaceConsole />
                    </RouteErrorBoundary>
                  </AdminRoute>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
