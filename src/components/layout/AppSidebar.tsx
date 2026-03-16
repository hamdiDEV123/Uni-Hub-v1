import { useEffect, useState } from "react";
import {
  ShoppingBag,
  Truck,
  Home,
  Trophy,
  Bell,
  LayoutDashboard,
  Palette,
  Shield,
  LogOut,
  User,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
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
} from "@/components/ui/sidebar";

const mainNav = [
  { title: "\u0644\u0648\u062d\u0629 \u0627\u0644\u062a\u062d\u0643\u0645", url: "/dashboard", icon: LayoutDashboard },
  { title: "\u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0634\u062e\u0635\u064a", url: "/profile", icon: User },
  { title: "\u0627\u0644\u0633\u0648\u0642", url: "/marketplace", icon: ShoppingBag },
  { title: "\u0627\u0644\u062a\u0648\u0635\u064a\u0644", url: "/delivery", icon: Truck },
  { title: "\u0627\u0644\u0633\u0643\u0646", url: "/housing", icon: Home },
  { title: "\u0627\u0644\u0631\u064a\u0627\u0636\u0629", url: "/sports", icon: Trophy },
  { title: "\u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062a", url: "/notifications", icon: Bell },
  { title: "\u0646\u0638\u0627\u0645 \u0627\u0644\u062a\u0635\u0645\u064a\u0645", url: "/design-system", icon: Palette },
];

const adminNav = [
  { title: "\u0644\u0648\u062d\u0629 \u0623\u062f\u0645\u0646 \u0627\u0644\u0633\u0648\u0642", url: "/admin", icon: Shield },
];

export function AppSidebar() {
  const { signOut, user } = useAuth();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    async function getProfile() {
      if (!user?.id) return;

      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      setRole(data?.role ?? null);
    }

    getProfile();
  }, [user]);

  const isAdmin = role === "admin";

  return (
    <Sidebar side="right" className="z-30 border-l border-navy/20 bg-card/90 shadow-hard backdrop-blur-xl supports-[backdrop-filter]:bg-card/80" dir="rtl">
      <div className="sticky top-0 z-10 border-b border-navy/20 bg-card p-5 backdrop-blur-xl supports-[backdrop-filter]:bg-card/90">
        <img src="/UniHup-StudentLogo-markOnly-creativePurple.svg" alt="UniHub Logo" className="h-12 w-auto mx-auto" />
        <p className="mt-2 text-center font-mono text-xs tracking-tighter text-muted-foreground">
          {isAdmin
            ? "لوحة إدارة المنصة"
            : "منصة الطالب الجامعي"}
        </p>
      </div>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] tracking-widest text-muted-foreground/70">
            {"\u0627\u0644\u0648\u062d\u062f\u0627\u062a"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                        className="flex flex-row-reverse items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-sm font-bold text-muted-foreground transition-all pressable hover:bg-primary/10 hover:text-primary"
                        activeClassName="bg-primary/10 text-primary shadow-hard-sm border border-primary/30"
                    >
                      <span>{item.title}</span>
                      <item.icon className="h-4 w-4" />
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] tracking-widest text-primary">
              {"\u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0645\u0646\u0635\u0629"}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminNav.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className="flex flex-row-reverse items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-sm font-bold text-muted-foreground transition-all pressable hover:bg-primary/10 hover:text-primary"
                        activeClassName="bg-primary/10 text-primary shadow-hard-sm border border-primary/30"
                      >
                        <span>{item.title}</span>
                        <item.icon className="h-4 w-4" />
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-navy/20 p-3">
        <div className="mb-2 truncate rounded-xl border border-navy/20 bg-muted/20 px-3 py-2 font-mono text-[10px] text-muted-foreground shadow-hard-sm">
          {"\u0627\u0644\u062d\u0633\u0627\u0628:"} {user?.email?.split("@")[0]}
        </div>
        <button
          onClick={signOut}
          className="flex w-full flex-row-reverse items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold text-destructive transition-all pressable hover:bg-destructive/10 hover:text-destructive"
        >
          <span>{"\u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062e\u0631\u0648\u062c"}</span>
          <LogOut className="h-4 w-4" />
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
