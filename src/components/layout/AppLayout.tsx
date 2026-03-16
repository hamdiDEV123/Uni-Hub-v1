import { ReactNode } from "react";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Bell, User, Zap, Wallet, Trophy } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function AppLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: profile } = useQuery<Record<string, any> | null>({
    queryKey: ['user-profile-layout', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*').eq('id', user?.id ?? '').single();
      return data;
    },
    enabled: !!user
  });

  const walletDisplay = Number(profile?.wallet ?? 0).toFixed(1);

  const getRank = (p: { role?: string | null; verified_status?: boolean | null } | null) => {
    if (p?.role === 'store') return { label: 'بائع موثّق', color: 'text-primary bg-primary/10 border-primary/20' };
    if (p?.verified_status) return { label: 'حساب موثّق', color: 'text-success bg-success/10 border-success/20' };
    return { label: 'مستخدم عادي', color: 'text-muted-foreground bg-muted/30 border-border' };
  };

  return (
    <SidebarProvider dir="rtl" className="min-h-screen w-full bg-background">
      <AppSidebar />

      <SidebarInset className="min-w-0 bg-background">
        <div className="pointer-events-none fixed inset-0 -z-20 bg-[radial-gradient(circle_at_12%_18%,rgba(59,130,246,0.14),transparent_30%),radial-gradient(circle_at_86%_20%,rgba(29,78,216,0.12),transparent_28%)]" />
        <div className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(to_right,rgba(59,130,246,.14)_1px,transparent_1px),linear-gradient(to_bottom,rgba(59,130,246,.14)_1px,transparent_1px)] bg-[size:140px_140px]" />

        <header className="sticky top-0 z-30 h-16 border-b border-border bg-card/80 px-6 backdrop-blur-xl supports-[backdrop-filter]:bg-card/65">
          <div className="flex h-full items-center justify-between">
            <SidebarTrigger className="text-muted-foreground transition-colors hover:text-primary md:hidden" />

            <Link to="/dashboard" className="hidden items-center gap-2 md:flex">
              <img src="/UniHup-StudentLogo-markOnly-creativePurple.svg" alt="UniHub Logo" className="h-8 w-8" />
              <div className="text-right">
                <p className="text-sm font-extrabold leading-none text-foreground">UniHub Connect</p>
                <p className="text-[10px] text-muted-foreground">منصة الطالب الجامعي الشاملة</p>
              </div>
            </Link>

            <div className="flex items-center gap-2">
              {/* Rank Badge */}
              <div className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl border ${getRank(profile).color}`}>
                <Trophy className="h-3.5 w-3.5" />
                <span className="text-[10px] font-black">{getRank(profile).label}</span>
              </div>

              {/* Global Wallet Display */}
              <div className="hidden md:flex items-center gap-2 bg-card/30 border border-border px-3 py-1.5 rounded-xl mr-2">
                <div className="bg-primary/20 p-1.5 rounded-lg">
                  <Wallet className="h-4 w-4 text-primary" />
                </div>
                <span className="text-sm font-black text-foreground">{walletDisplay} <span className="text-[10px] text-muted-foreground">ج.م</span></span>
              </div>

              <button
                onClick={() => navigate("/profile")}
                className="rounded-xl p-2.5 text-muted-foreground transition-all hover:bg-primary/10 hover:text-primary"
              >
                <User className="h-5 w-5" />
              </button>

              <button
                onClick={() => navigate("/notifications")}
                className="relative rounded-xl p-2.5 text-muted-foreground transition-all hover:bg-primary/10 hover:text-primary"
              >
                <Bell className="h-5 w-5" />
                  <span className="absolute right-2.5 top-2.5 h-2 w-2 animate-pulse rounded-full bg-primary" />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden bg-transparent p-6">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
