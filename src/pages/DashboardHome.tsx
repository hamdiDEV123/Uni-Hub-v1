import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
import { ShoppingBag, Truck, Home, Trophy, TrendingUp, Package, DollarSign, MessagesSquare, CheckCircle2, Clock3 } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fadeUpItem, pageVariants, staggerContainer } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { hasRequiredStudentContext } from "@/pages/profile/profile.utils";

type DashboardProfile = {
  full_name: string | null;
  wallet?: string | number | null;
  university?: string | null;
  faculty?: string | null;
  study_year?: string | null;
  onboarding_completed?: boolean | null;
};

export default function DashboardHome() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [university, setUniversity] = useState("");
  const [faculty, setFaculty] = useState("");
  const [studyYear, setStudyYear] = useState("");

  const profileQuery = useQuery({
    queryKey: ["dashboard-profile", user?.id ?? ""],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,full_name,wallet,university,faculty,study_year,onboarding_completed")
        .eq("id", user!.id)
        .single();

      if (error) throw error;
      return data as DashboardProfile;
    },
  });

  useEffect(() => {
    if (!profileQuery.data) return;
    setUniversity((current) => current || profileQuery.data?.university || "");
    setFaculty((current) => current || profileQuery.data?.faculty || "");
    setStudyYear((current) => current || profileQuery.data?.study_year || "");
  }, [profileQuery.data]);

  const { data: dashboard } = useQuery({
    queryKey: ["dashboard-summary", user?.id ?? ""],
    queryFn: async () => {
      if (!user?.id) {
        throw new Error("Missing user id");
      }
      const { data, error } = await supabase.rpc("get_dashboard_summary", {
        user_id: user.id,
      });
      if (error) throw error;
      const row = data ? (Array.isArray(data) ? data[0] : data) : null;
      return row as unknown as {
        profile: { full_name: string | null; wallet?: string | number | null } | null;
        order_count: number;
        product_count: number;
        notification_count: number;
      };
    },
    enabled: !!user,
  });

  const { data: myGamification } = useQuery({
    queryKey: ["my-gamification", user?.id ?? ""],
    enabled: !!user?.id,
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("user_gamification")
        .select("current_streak")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  const profile = dashboard?.profile;
  const profileDetails = profileQuery.data;
  const orderCount = dashboard?.order_count ?? 0;
  const productCount = dashboard?.product_count ?? 0;
  const notificationCount = dashboard?.notification_count ?? 0;

  const isProfileOnboardingComplete = hasRequiredStudentContext(profileDetails ?? {});

  const completeOnboardingMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("يجب تسجيل الدخول أولاً");

      const payload = {
        university: university.trim(),
        faculty: faculty.trim(),
        study_year: studyYear.trim(),
        onboarding_completed: true,
      };

      if (!payload.university || !payload.faculty || !payload.study_year) {
        throw new Error("اكمل الجامعة والكلية والفرقة أولاً");
      }

      const { error } = await supabase.from("profiles").update(payload).eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dashboard-profile", user?.id ?? ""] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-summary", user?.id ?? ""] }),
      ]);
      toast.success("تم حفظ بياناتك الأساسية بنجاح");
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "تعذر حفظ بياناتك");
    },
  });

  const stats = [
    { label: "رصيد المحفظة", value: `${profile?.wallet ?? "0.00"} ج.م`, icon: DollarSign },
    { label: "إعلاناتي", value: productCount ?? 0, icon: Package },
    { label: "طلباتي", value: orderCount ?? 0, icon: Truck },
    { label: "الاستريك", value: `🔥 ${myGamification?.current_streak ?? 0}`, icon: TrendingUp },
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
            <span className="text-primary">{profileDetails?.full_name || profile?.full_name || "طالب"}</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">مركز تحكم موحد للمهام السريعة والخدمات الأساسية</p>

          <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-primary">مجتمع الجامعة</p>
                <p className="text-xs text-muted-foreground">الستوريز والفيد في صفحة مستقلة عشان تكون أوضح وأسهل</p>
              </div>
              <Link to="/campus-feed">
                <Button className="gap-2">
                  <MessagesSquare className="h-4 w-4" />
                  افتح فيد الجامعة
                </Button>
              </Link>
            </div>
          </div>

          {!isProfileOnboardingComplete ? (
            <div className="mt-5 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-black text-amber-200">إكمال بيانات الطالب</p>
                  <p className="text-xs text-amber-100/80">أضف الجامعة والكلية والفرقة لفلترة المحتوى بشكل أدق</p>
                </div>
                <Clock3 className="h-5 w-5 text-amber-200" />
              </div>
              <div className="grid gap-2 md:grid-cols-3">
                <Input
                  placeholder="الجامعة"
                  value={university}
                  onChange={(event) => setUniversity(event.target.value)}
                  className="bg-card"
                />
                <Input
                  placeholder="الكلية"
                  value={faculty}
                  onChange={(event) => setFaculty(event.target.value)}
                  className="bg-card"
                />
                <Input
                  placeholder="الفرقة (مثال: أولى)"
                  value={studyYear}
                  onChange={(event) => setStudyYear(event.target.value)}
                  className="bg-card"
                />
              </div>
              <div className="mt-3 flex justify-end">
                <Button onClick={() => completeOnboardingMutation.mutate()} disabled={completeOnboardingMutation.isPending}>
                  {completeOnboardingMutation.isPending ? "جاري الحفظ..." : "حفظ البيانات"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-5 inline-flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-200">
              <CheckCircle2 className="h-4 w-4" />
              تم إكمال بيانات الطالب الأساسية
            </div>
          )}
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

      <motion.div variants={fadeUpItem as Variants} className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-navy/20 bg-card p-4 shadow-hard-sm">
          <p className="text-xs text-muted-foreground">الإشعارات</p>
          <p className="mt-1 text-2xl font-black text-foreground">{notificationCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">تنبيهات جديدة تحتاج مراجعة</p>
        </div>
        <div className="rounded-2xl border border-navy/20 bg-card p-4 shadow-hard-sm">
          <p className="text-xs text-muted-foreground">السياق الأكاديمي</p>
          <p className="mt-1 text-sm font-black text-foreground">
            {profileDetails?.university?.trim() ? `${profileDetails.university} - ${profileDetails.faculty ?? "-"}` : "غير مكتمل"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">الفرقة: {profileDetails?.study_year || "-"}</p>
        </div>
        <div className="rounded-2xl border border-navy/20 bg-card p-4 shadow-hard-sm">
          <p className="text-xs text-muted-foreground">إجراءات سريعة</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link to="/profile"><Button size="sm" variant="outline">تعديل البروفايل</Button></Link>
            <Link to="/marketplace"><Button size="sm" variant="outline">أضف إعلان</Button></Link>
            <Link to="/delivery"><Button size="sm" variant="outline">طلبات التوصيل</Button></Link>
          </div>
        </div>
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
