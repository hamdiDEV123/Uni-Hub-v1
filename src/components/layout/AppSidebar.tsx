import { useEffect, useState } from 'react';
import { 
  ShoppingBag, Truck, Home, Trophy, Bell, LayoutDashboard, 
  Shield, LogOut, User // ضفنا أيقونة User هنا ✅
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from '@/components/ui/sidebar';

const mainNav = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Profile', url: '/profile', icon: User }, // السطر ده اللي هينورلك صفحة البروفايل ✅
  { title: 'Marketplace', url: '/marketplace', icon: ShoppingBag },
  { title: 'Delivery', url: '/delivery', icon: Truck },
  { title: 'Housing', url: '/housing', icon: Home },
  { title: 'Sports Hub', url: '/sports', icon: Trophy },
  { title: 'Notifications', url: '/notifications', icon: Bell },
];

const adminNav = [
  { title: 'Admin Panel', url: '/admin', icon: Shield },
];

export function AppSidebar() {
  const { signOut, user } = useAuth();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    async function getProfile() {
      if (user?.id) {
        // بنستخدم (as any) هنا عشان نتجنب مشاكل الـ Types بكرة في العرض
        const { data } = await (supabase.from('profiles') as any)
          .select('role')
          .eq('id', user.id)
          .single();
        
        if (data) setRole(data.role);
      }
    }
    getProfile();
  }, [user]);

  const isAdmin = role === 'admin';

  return (
    <Sidebar className="border-r border-border/50 bg-sidebar">
      <div className="p-5 border-b border-border/50">
        <h1 className="text-xl font-bold tracking-tight">
          <span className="neon-text-blue">Uni</span>
          <span className="text-foreground">Hub</span>
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5 font-mono uppercase tracking-tighter">
          {isAdmin ? 'ADMIN CONTROL PANEL' : 'UNIVERSITY SUPER-APP'}
        </p>
      </div>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground/70 text-[10px] uppercase tracking-widest">Modules</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
                      activeClassName="text-primary bg-primary/10 neon-glow-blue"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-orange-500 text-[10px] uppercase tracking-widest">Admin Management</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminNav.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
                        activeClassName="text-secondary bg-secondary/10 neon-glow-orange"
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-border/50 p-3">
        {/* ممكن هنا تضيف اسم المستخدم بشكل شيك قبل زرار الخروج */}
        <div className="px-3 py-2 mb-2 text-[10px] text-muted-foreground truncate font-mono">
          Logged in as: {user?.email?.split('@')[0]}
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all w-full"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign Out</span>
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}