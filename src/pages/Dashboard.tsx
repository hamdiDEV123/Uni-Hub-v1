import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
import { ShoppingBag, Truck, Home, Trophy, TrendingUp, Package, DollarSign } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fadeUpItem, pageVariants, staggerContainer } from "@/lib/motion";

export default function Dashboard() {
  const { user } = useAuth();

  type DashboardProfile = {
    full_name: string | null;
    wallet?: string | number | null;
  };

  // consolidated RPC call to reduce N+1 queries
  const { data: dashboard } = useQuery({
    queryKey: ["dashboard-summary", user?.id ?? ""],
    queryFn: async () => {
      if (!user?.id) {
        throw new Error("Missing user id");
      }
      // this RPC returns { profile, order_count, product_count, notification_count }
      const { data, error } = await supabase.rpc("get_dashboard_summary", {
        user_id: user.id,
      });
      if (error) throw error;
      const row = data ? (Array.isArray(data) ? data[0] : data) : null;
      return row as unknown as {
        profile: DashboardProfile | null;
        order_count: number;
        product_count: number;
        notification_count: number;
      };
    },
    enabled: !!user,
  });

  const profile = dashboard?.profile;
  const orderCount = dashboard?.order_count ?? 0;
  const productCount = dashboard?.product_count ?? 0;

  const stats = [
    { label: "رصيد المحفظة", value: `${profile?.wallet ?? "0.00"} ج.م`, icon: DollarSign },
    { label: "إعلاناتي", value: productCount ?? 0, icon: Package },
    { label: "طلباتي", value: orderCount ?? 0, icon: Truck },
    { label: "حالة الحساب", value: "نشط", icon: TrendingUp },
  ];

  const modules = [
    { title: "السوق", desc: "بيع وشراء المنتجات الجامعية", icon: ShoppingBag, url: "/marketplace" },
    { title: "التوصيل", desc: "خدمات توصيل طلابية مؤمنة", icon: Truck, url: "/delivery" },
    { title: "السكن", desc: "ابحث عن سكن ورفيق مناسب", icon: Home, url: "/housing" },
    { title: "الرياضة", desc: "احجز وشارك في الفعاليات", icon: Trophy, url: "/sports" },
  ];

  return (
    <motion.div
      dir="rtl"
      variants={pageVariants as Variants}
      initial="hidden"
      animate="show"
      className="space-y-8"
    >
      <motion.div variants={fadeUpItem as Variants}>
        <div className="rounded-3xl border border-navy/20 bg-card p-6 shadow-hard">
          <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
            لوحة تحكم الطالب
          </span>
          <h1 className="mt-3 text-3xl font-black text-foreground">
            {"مرحباً، "}
            <span className="text-primary">{profile?.full_name || "طالب"}</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{"هذه نظرة سريعة على حسابك"}</p>
        </div>
      </motion.div>

      <motion.div variants={staggerContainer as Variants} initial="hidden" animate="show" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <motion.div key={s.label} variants={fadeUpItem as Variants} whileHover={{ y: -4 }} className="stat-card shadow-hard interactive-lift interactive-glow bg-card border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs tracking-wide text-muted-foreground">{s.label}</p>
                <p className="mt-1 text-2xl font-black text-foreground">{s.value}</p>
              </div>
              <s.icon className="h-8 w-8 text-primary/40" />
            </div>
          </motion.div>
        ))}
      </motion.div>

      <motion.div variants={fadeUpItem as Variants}>
        <h2 className="mb-4 text-lg font-black tracking-tight">{"الوصول السريع"}</h2>
        <motion.div variants={staggerContainer as Variants} initial="hidden" animate="show" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {modules.map((m) => (
            <motion.div key={m.title} variants={fadeUpItem as Variants} whileHover={{ y: -4, scale: 1.01 }}>
              <Link to={m.url} className="block p-5 rounded-2xl border border-navy/20 bg-card shadow-hard interactive-lift interactive-glow">
                <m.icon className="mb-3 h-8 w-8 text-primary" />
                <h3 className="font-black tracking-tight text-foreground transition-colors hover:text-primary">{m.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{m.desc}</p>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
