import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
import {
  ShoppingBag,
  Truck,
  Home,
  Trophy,
  TrendingUp,
  Package,
  DollarSign,
  Flame,
  Heart,
  MessageCircle,
  Clock3,
  LayoutDashboard,
  MessagesSquare,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fadeUpItem, pageVariants, staggerContainer } from "@/lib/motion";
import { useToast } from "@/hooks/use-toast";
import {
  type CampusPostCategory,
  createCampusPost,
  deleteCampusPost,
  fetchCampusLeaderboard,
  fetchCampusPosts,
  fetchCampusStories,
  pinCampusPost,
  toggleCampusPostUpvote,
} from "@/backend/campusFeedApi";
import { Button } from "@/components/ui/button";
import { useMemo, useState } from "react";

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [postContent, setPostContent] = useState("");
  const [postCategory, setPostCategory] = useState<CampusPostCategory>("general");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [activeTab, setActiveTab] = useState<"summary" | "feed">("summary");

  type DashboardProfile = {
    full_name: string | null;
    wallet?: string | number | null;
  };

  const categoryLabel: Record<CampusPostCategory, string> = {
    general: "عام",
    academic: "أكاديمي",
    memes: "ميمز",
    lost_found: "فاقد وموجود",
  };

  const feedQueryKey = ["campus-feed", user?.id ?? ""];
  const storiesQueryKey = ["campus-stories", user?.id ?? ""];
  const leaderboardQueryKey = ["campus-leaderboard"];

  const createPostMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("يجب تسجيل الدخول أولاً");
      if (!postContent.trim() || postContent.trim().length < 2) {
        throw new Error("اكتب محتوى البوست أولاً");
      }

      await createCampusPost({
        authorId: user.id,
        postType: "thread",
        category: postCategory,
        content: postContent.trim(),
        isAnonymous: false,
      });
    },
    onSuccess: async () => {
      setPostContent("");
      setIsAnonymous(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: feedQueryKey }),
        queryClient.invalidateQueries({ queryKey: leaderboardQueryKey }),
      ]);
      toast({ title: "تم نشر البوست", description: "بوستك نزل في الفيد بنجاح" });
    },
    onError: (error: unknown) => {
      toast({
        title: "فشل نشر البوست",
        description: error instanceof Error ? error.message : "حاول مرة أخرى",
        variant: "destructive",
      });
    },
  });

  const toggleUpvoteMutation = useMutation({
    mutationFn: async (postId: string) => toggleCampusPostUpvote(postId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: feedQueryKey }),
        queryClient.invalidateQueries({ queryKey: leaderboardQueryKey }),
      ]);
    },
    onError: (error: unknown) => {
      toast({
        title: "تعذر تنفيذ التفاعل",
        description: error instanceof Error ? error.message : "حاول مرة أخرى",
        variant: "destructive",
      });
    },
  });

  const togglePinMutation = useMutation({
    mutationFn: async ({ postId, pin }: { postId: string; pin: boolean }) => {
      if (!user?.id) throw new Error("يجب تسجيل الدخول");
      await pinCampusPost(postId, user.id, pin);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: feedQueryKey });
      toast({ title: "تم تحديث حالة التثبيت" });
    },
    onError: (error: unknown) => {
      toast({
        title: "فشل تحديث التثبيت",
        description: error instanceof Error ? error.message : "حاول مرة أخرى",
        variant: "destructive",
      });
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      await deleteCampusPost(postId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: feedQueryKey });
      toast({ title: "تم حذف البوست" });
    },
    onError: (error: unknown) => {
      toast({
        title: "فشل حذف البوست",
        description: error instanceof Error ? error.message : "حاول مرة أخرى",
        variant: "destructive",
      });
    },
  });

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

  const { data: isAdmin = false } = useQuery({
    queryKey: ["is-admin", user?.id ?? ""],
    enabled: !!user?.id,
    queryFn: async () => {
      if (!user?.id) return false;
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
      if (error) throw error;
      return Boolean(data);
    },
  });

  const { data: myGamification } = useQuery({
    queryKey: ["my-gamification", user?.id ?? ""],
    enabled: !!user?.id,
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("user_gamification")
        .select("current_streak,highest_streak,karma_points")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  const { data: stories = [] } = useQuery({
    queryKey: storiesQueryKey,
    enabled: !!user?.id,
    queryFn: async () => fetchCampusStories(user?.id, 20),
  });

  const { data: feed = [] } = useQuery({
    queryKey: feedQueryKey,
    enabled: !!user?.id,
    queryFn: async () => fetchCampusPosts({ limit: 30 }, user?.id),
  });

  const { data: leaderboard = [] } = useQuery({
    queryKey: leaderboardQueryKey,
    enabled: !!user?.id,
    queryFn: async () => fetchCampusLeaderboard(5),
  });

  const topStories = useMemo(() => stories.slice(0, 12), [stories]);

  const formatTimeAgo = (isoDate: string) => {
    const diffMs = Date.now() - new Date(isoDate).getTime();
    const minutes = Math.max(1, Math.floor(diffMs / (1000 * 60)));
    if (minutes < 60) return `منذ ${minutes} د`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `منذ ${hours} س`;
    const days = Math.floor(hours / 24);
    return `منذ ${days} يوم`;
  };

  const profile = dashboard?.profile;
  const orderCount = dashboard?.order_count ?? 0;
  const productCount = dashboard?.product_count ?? 0;

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
            <span className="text-primary">{profile?.full_name || "طالب"}</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeTab === "summary"
              ? "دي نظرة سريعة على حسابك والخدمات الأساسية"
              : "هنا مجتمع الجامعة: استريكات + فيد + تفاعل"}
          </p>

          <div className="mt-4 inline-flex rounded-2xl border border-border bg-muted/30 p-1">
            <button
              type="button"
              onClick={() => setActiveTab("summary")}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
                activeTab === "summary"
                  ? "bg-card text-primary shadow-hard-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              الملخص
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("feed")}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
                activeTab === "feed"
                  ? "bg-card text-primary shadow-hard-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <MessagesSquare className="h-4 w-4" />
              فيد الجامعة
            </button>
          </div>
        </div>
      </motion.div>

      {activeTab === "feed" ? (
      <>
      <motion.div variants={fadeUpItem as Variants} className="rounded-3xl border border-border bg-card p-5 shadow-hard">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-black">استريكات الجامعة</h2>
          <span className="inline-flex items-center gap-1 rounded-full border border-orange-300/50 bg-orange-500/10 px-3 py-1 text-xs font-bold text-orange-500">
            <Flame className="h-4 w-4" />
            {`استريكك: ${myGamification?.current_streak ?? 0}`}
          </span>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-2">
          {topStories.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
              لا توجد ستوريز حالياً — كن أول من ينشر قصة اليوم
            </div>
          ) : (
            topStories.map((story) => (
              <div
                key={story.id}
                className="min-w-[180px] rounded-2xl border border-primary/20 bg-primary/5 p-3 shadow-hard-sm"
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-bold text-primary">{story.author_profile?.full_name?.trim() || "طالب"}</span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock3 className="h-3 w-3" />
                    {formatTimeAgo(story.created_at)}
                  </span>
                </div>
                <p className="mb-1 line-clamp-1 text-[11px] text-muted-foreground">
                  {story.author_profile?.university?.trim() || "جامعة غير محددة"}
                </p>
                <p className="line-clamp-3 text-sm leading-6 text-foreground/90">{story.content ?? "Story"}</p>
              </div>
            ))
          )}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <motion.div variants={fadeUpItem as Variants} className="space-y-4 lg:col-span-2">
          <div className="rounded-3xl border border-border bg-card p-5 shadow-hard">
            <h2 className="mb-3 text-lg font-black">اكتب بوست جديد</h2>
            <textarea
              value={postContent}
              onChange={(event) => setPostContent(event.target.value)}
              rows={4}
              placeholder="شارك دفعتك معلومة، سؤال، أو حتى ميم..."
              className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary"
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <select
                value={postCategory}
                onChange={(event) => setPostCategory(event.target.value as CampusPostCategory)}
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="general">عام</option>
                <option value="academic">أكاديمي</option>
                <option value="memes">ميمز</option>
                <option value="lost_found">فاقد وموجود</option>
              </select>
              <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(event) => setIsAnonymous(event.target.checked)}
                  disabled
                />
                نشر بالهوية (مفعل)
              </label>
              <Button
                className="mr-auto"
                onClick={() => createPostMutation.mutate()}
                disabled={createPostMutation.isPending}
              >
                {createPostMutation.isPending ? "جاري النشر..." : "نشر"}
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {feed.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground shadow-hard-sm">
                لا يوجد محتوى بعد. ابدأ أنت أول بوست 👌
              </div>
            ) : (
              feed.map((post) => (
                <article key={post.id} className="rounded-2xl border border-border bg-card p-5 shadow-hard-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-start gap-2">
                      {post.author_profile?.avatar_url ? (
                        <img
                          src={post.author_profile.avatar_url}
                          alt={post.author_profile?.full_name ?? "طالب"}
                          className="h-8 w-8 rounded-full border border-border object-cover"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-muted text-xs font-black text-foreground">
                          {(post.author_profile?.full_name?.trim() || "ط").charAt(0)}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-black text-foreground">{post.author_profile?.full_name?.trim() || "طالب"}</p>
                        <p className="text-[11px] text-muted-foreground">{post.author_profile?.university?.trim() || "جامعة غير محددة"}</p>
                      </div>
                      <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                        {categoryLabel[(post.category as CampusPostCategory) ?? "general"] ?? "عام"}
                      </span>
                      {post.is_pinned ? (
                        <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-600">
                          مثبت
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{formatTimeAgo(post.created_at)}</span>
                      {isAdmin ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              togglePinMutation.mutate({
                                postId: post.id,
                                pin: !post.is_pinned,
                              })
                            }
                            className="rounded-full border border-amber-500/40 px-2 py-0.5 text-[11px] font-bold text-amber-600 hover:bg-amber-500/10"
                          >
                            {post.is_pinned ? "فك التثبيت" : "تثبيت"}
                          </button>
                          <button
                            type="button"
                            onClick={() => deletePostMutation.mutate(post.id)}
                            className="rounded-full border border-red-500/40 px-2 py-0.5 text-[11px] font-bold text-red-600 hover:bg-red-500/10"
                          >
                            حذف
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {post.content ? <p className="whitespace-pre-wrap text-sm leading-7 text-foreground/95">{post.content}</p> : null}

                  <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
                    <button
                      type="button"
                      onClick={() => toggleUpvoteMutation.mutate(post.id)}
                      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 transition ${
                        post.user_has_upvoted
                          ? "border-rose-500/40 bg-rose-500/10 text-rose-500"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <Heart className="h-3.5 w-3.5" />
                      {post.upvotes_count}
                    </button>
                    <span className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1">
                      <MessageCircle className="h-3.5 w-3.5" />
                      {post.comments_count}
                    </span>
                  </div>
                </article>
              ))
            )}
          </div>
        </motion.div>

        <motion.aside variants={fadeUpItem as Variants} className="space-y-4">
          <div className="rounded-3xl border border-border bg-card p-5 shadow-hard">
            <h3 className="mb-3 text-base font-black">لوحة الشرف 🔥</h3>
            <div className="space-y-2">
              {leaderboard.length === 0 ? (
                <p className="text-sm text-muted-foreground">لا توجد بيانات ترتيب بعد</p>
              ) : (
                leaderboard.map((entry, index) => (
                  <div key={entry.user_id} className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
                    <div>
                      <p className="text-sm font-bold">{`${index + 1}. ${entry.full_name}`}</p>
                      <p className="text-[11px] text-muted-foreground">{`Karma: ${entry.karma_points}`}</p>
                    </div>
                    <span className="text-sm font-black text-orange-500">{`🔥 ${entry.current_streak}`}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-card p-5 shadow-hard">
            <h3 className="mb-3 text-base font-black">الوصول السريع</h3>
            <div className="grid gap-2">
              {modules.map((m) => (
                <Link key={m.title} to={m.url} className="rounded-xl border border-border px-3 py-2 text-sm font-bold hover:border-primary/40">
                  {m.title}
                </Link>
              ))}
            </div>
          </div>
        </motion.aside>
      </div>
      </>
      ) : null}

      {activeTab === "summary" ? (
      <>
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
      </>
      ) : null}
    </motion.div>
  );
}
